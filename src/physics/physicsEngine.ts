/**
 * Simultaneous network solver.
 *  - The scene (components + pipes + links) is compiled into closed fluid "systems" (connected networks).
 *  - Unknowns per port-node: pressure P, enthalpy h, mass flow m; plus wall temperatures of heated bodies.
 *  - Every element contributes residuals (mass, momentum/pump/compressor law, energy with thermal inertia, closure).
 *  - All equations of a system are solved together at every time step (implicit Euler) with a damped
 *    Levenberg–Marquardt / Gauss-Newton iteration on a sparse finite-difference Jacobian (element-local perturbations).
 */
import { SPECS } from './components';
import { getFluid, FluidId, FluidModel } from './fluidProperties';
import { wetBulb } from './thermodynamics';
import type { Ambient, BuildCtx, CompInstance, Elem, InitCtx, Link, NodeIdx, PortDef, StepCtx, Telemetry } from './engineTypes';

export interface SceneData { comps: CompInstance[]; links: Link[]; ambient: { T_C: number; RH: number; P: number } }
export interface Issue { comp: string; port?: string; msg: string }
export interface NodeState { P: number; h: number; m: number }

interface NodeRec { ports: { comp: string; def: PortDef }[]; valid: boolean; idx?: NodeIdx; circuit?: string; sysId?: string }
export interface SystemRT {
  id: number; comps: string[]; elems: Elem[]; elemComp: string[]; off: number[]; nVar: number; nEq: number;
  x: Float64Array; prev: Float64Array; xs: Float64Array; r: Float64Array; rt: Float64Array; A: Float64Array; g: Float64Array;
  softP: number; mRef: number;
  portIdx: Map<string, NodeIdx>; wallOf: Map<string, number[]>;
  converged: boolean; iters: number; resid: number;
}
export interface Compiled {
  systems: SystemRT[]; issues: Issue[]; active: Set<string>; fluidOf: Map<string, FluidId[]>;
  nodeOfPort: Map<string, NodeRec>; refLines: Set<string>; comps: Map<string, CompInstance>;
}

/* =============================================================================================== */
/*  Compile                                                                                        */
/* =============================================================================================== */
const key = (c: string, p: string) => c + ':' + p;
class UF {
  p = new Map<string, string>();
  add(a: string) { if (!this.p.has(a)) this.p.set(a, a); }
  find(a: string): string { let r = a; while (this.p.get(r) !== r) r = this.p.get(r)!; let c = a; while (this.p.get(c) !== r) { const n = this.p.get(c)!; this.p.set(c, r); c = n; } return r; }
  union(a: string, b: string) { this.add(a); this.add(b); const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.p.set(ra, rb); }
}

export function makeAmbient(s: SceneData['ambient']): Ambient {
  const T = s.T_C + 273.15; return { T, RH: s.RH / 100, P: s.P, Twb: wetBulb(T, s.RH / 100, s.P) };
}

export function compile(scene: SceneData, preserve?: Map<string, NodeState>, wallPreserve?: Map<string, number[]>): Compiled {
  scene = { ...scene, comps: scene.comps.filter((c) => SPECS[c.type] && !SPECS[c.type].arch) };
  const amb = makeAmbient(scene.ambient);
  const comps = new Map(scene.comps.map((c) => [c.id, c]));
  const issues: Issue[] = [];
  const portDefs = new Map<string, { comp: CompInstance; def: PortDef }>();
  const uf = new UF();
  for (const c of scene.comps) if (c.type !== 'pipe') for (const d of SPECS[c.type].ports(c.params)) { const k = key(c.id, d.id); portDefs.set(k, { comp: c, def: d }); uf.add(k); }
  const refLines = new Set<string>();
  for (const c of scene.comps) {
    if (c.type !== 'pipe') continue;
    const a = c.from && portDefs.get(key(c.from.comp, c.from.port)), b = c.to && portDefs.get(key(c.to.comp, c.to.port));
    if (a && b && (a.def.kind === 'ref' || b.def.kind === 'ref')) { refLines.add(c.id); uf.union(key(c.from!.comp, c.from!.port), key(c.to!.comp, c.to!.port)); continue; }
    for (const d of SPECS.pipe.ports(c.params)) { const k = key(c.id, d.id); portDefs.set(k, { comp: c, def: d }); uf.add(k); }
    if (a && b) { uf.union(key(c.id, 'in'), key(c.from!.comp, c.from!.port)); uf.union(key(c.id, 'out'), key(c.to!.comp, c.to!.port)); }
    else issues.push({ comp: c.id, msg: 'הצינור אינו מחובר בשני קצותיו' });
  }
  for (const l of scene.links) { const ka = key(l.a.comp, l.a.port), kb = key(l.b.comp, l.b.port); if (portDefs.has(ka) && portDefs.has(kb)) uf.union(ka, kb); }
  // nodes
  const nodes = new Map<string, NodeRec>();
  for (const [k, v] of portDefs) { const r = uf.find(k); if (!nodes.has(r)) nodes.set(r, { ports: [], valid: true }); nodes.get(r)!.ports.push({ comp: v.comp.id, def: v.def }); }
  const nodeOfPort = new Map<string, NodeRec>();
  for (const [k] of portDefs) nodeOfPort.set(k, nodes.get(uf.find(k))!);
  for (const n of nodes.values()) {
    const nin = n.ports.filter((p) => p.def.kind === 'in').length, nout = n.ports.filter((p) => p.def.kind === 'out').length, nref = n.ports.filter((p) => p.def.kind === 'ref').length;
    if (nin !== 1 || nout !== 1) {
      n.valid = false;
      for (const p of n.ports) if (p.def.kind !== 'ref' || (nin + nout) === 0) issues.push({ comp: p.comp, port: p.def.id, msg: nin + nout < 2 ? 'פורט לא מחובר' : 'חיבור לא תקין (נדרשים יציאה אחת וכניסה אחת)' });
    }
    void nref;
  }
  // systems (components joined via all their ports) and circuits (joined per pass)
  const sysUF = new UF(), cirUF = new UF();
  const compPorts = (c: CompInstance) => (c.type === 'pipe' ? SPECS.pipe.ports(c.params) : SPECS[c.type].ports(c.params));
  for (const c of scene.comps) {
    if (refLines.has(c.id)) continue;
    const ports = compPorts(c);
    const first = nodes.get(uf.find(key(c.id, ports[0].id)));
    void first;
    const sk = (d: PortDef) => 'N:' + uf.find(key(c.id, d.id));
    for (const d of ports) { sysUF.union(sk(ports[0]), sk(d)); }
    for (const d of ports) { cirUF.union(`${sk(ports.find((q) => q.pass === d.pass)!)}`, sk(d)); }
  }
  const sysNodes = new Map<string, string[]>(), sysComps = new Map<string, string[]>(), sysValid = new Map<string, boolean>();
  for (const c of scene.comps) {
    if (refLines.has(c.id)) continue;
    for (const d of compPorts(c)) {
      const nr = 'N:' + uf.find(key(c.id, d.id)); const s = sysUF.find(nr);
      if (!sysNodes.has(s)) { sysNodes.set(s, []); sysComps.set(s, []); sysValid.set(s, true); }
      if (!sysNodes.get(s)!.includes(nr)) sysNodes.get(s)!.push(nr);
      if (!sysComps.get(s)!.includes(c.id)) sysComps.get(s)!.push(c.id);
      if (!nodes.get(uf.find(key(c.id, d.id)))!.valid) sysValid.set(s, false);
    }
  }
  // circuit fluids (first writer wins)
  const circuitFluid = new Map<string, FluidId>();
  for (const c of scene.comps) {
    if (refLines.has(c.id)) continue;
    const spec = SPECS[c.type];
    for (let ps = 0; ps < spec.passes; ps++) {
      const d = compPorts(c).find((q) => q.pass === ps)!; const cr = cirUF.find('N:' + uf.find(key(c.id, d.id)));
      if (!circuitFluid.has(cr)) circuitFluid.set(cr, ((ps === 0 ? c.params.fluid : c.params.fluid2) ?? spec.defaultFluids[ps]) as FluidId);
    }
  }
  const fluidOf = new Map<string, FluidId[]>();
  for (const c of scene.comps) {
    if (refLines.has(c.id)) continue;
    const spec = SPECS[c.type]; const arr: FluidId[] = [];
    for (let ps = 0; ps < spec.passes; ps++) { const d = compPorts(c).find((q) => q.pass === ps)!; arr.push(circuitFluid.get(cirUF.find('N:' + uf.find(key(c.id, d.id))))!); }
    fluidOf.set(c.id, arr);
  }

  const systems: SystemRT[] = []; const active = new Set<string>();
  let sysCounter = 0;
  for (const [sKey, nodeKeys] of sysNodes) {
    if (!sysValid.get(sKey)) continue;
    const cids = sysComps.get(sKey)!;
    const nodeIdx = new Map<string, NodeIdx>(); // root key -> idx
    nodeKeys.forEach((nk, i) => nodeIdx.set(nk, { P: 3 * i, h: 3 * i + 1, m: 3 * i + 2 }));
    const nNodes = nodeKeys.length;
    const initV = nodeKeys.map(() => ({} as { P?: number; h?: number; m?: number }));
    const idxOfPort = (cid: string, pid: string) => nodeIdx.get('N:' + uf.find(key(cid, pid)))!;
    const slot = (cid: string, pid: string) => initV[idxOfPort(cid, pid).P / 3];
    const fl = (cid: string, ps: number) => getFluid(fluidOf.get(cid)![ps]);
    const mkInit = (c: CompInstance): InitCtx => ({
      comp: c, p: c.params, amb, fluid: (ps) => fl(c.id, ps),
      set: (pid, v) => { const s = slot(c.id, pid); if (v.P !== undefined && Number.isFinite(v.P)) s.P = v.P; if (v.h !== undefined && Number.isFinite(v.h)) s.h = v.h; if (v.m !== undefined && Number.isFinite(v.m)) s.m = v.m; },
      get: (pid) => ({ ...slot(c.id, pid) }),
    });
    const syscomps = cids.map((id) => comps.get(id)!);
    const pass = (c: CompInstance) => SPECS[c.type].passThrough;
    // 1. driver initialisation
    for (const c of syscomps) { const sp = SPECS[c.type]; if (sp.init && !pass(c) && !c.type.startsWith('manifold')) sp.init(mkInit(c)); }
    // 2. propagation through series elements & manifolds
    for (let it = 0; it < 6 * syscomps.length + 6; it++) {
      let changed = false;
      for (const c of syscomps) {
        const sp = SPECS[c.type];
        if (c.type.startsWith('manifold')) { const before = JSON.stringify(initV); sp.init!(mkInit(c)); if (JSON.stringify(initV) !== before) changed = true; }
        else if (pass(c)) {
          const a = slot(c.id, 'in'), b = slot(c.id, 'out');
          for (const f of ['P', 'h', 'm'] as const) {
            if (a[f] !== undefined && b[f] === undefined) { b[f] = a[f]; changed = true; } else if (b[f] !== undefined && a[f] === undefined) { a[f] = b[f]; changed = true; }
          }
        }
      }
      if (!changed) break;
    }
    // 3. defaults
    const nodeCircuit = nodeKeys.map((nk) => cirUF.find(nk));
    const pRef = new Map<string, number>();
    nodeKeys.forEach((_, i) => { if (initV[i].P !== undefined && !pRef.has(nodeCircuit[i])) pRef.set(nodeCircuit[i], initV[i].P!); });
    // fluid per node: find any comp/pass using it
    const nodeFluid: FluidModel[] = nodeKeys.map(() => getFluid('water'));
    for (const c of syscomps) for (const d of compPorts(c)) { const i = idxOfPort(c.id, d.id).P / 3; nodeFluid[i] = fl(c.id, d.pass); }
    let mRef = 0;
    nodeKeys.forEach((_, i) => { const s = initV[i]; if (s.m !== undefined) mRef = Math.max(mRef, Math.abs(s.m)); });
    if (mRef <= 0) mRef = 1;
    nodeKeys.forEach((_, i) => {
      const s = initV[i]; const f = nodeFluid[i];
      if (s.P === undefined) s.P = pRef.get(nodeCircuit[i]) ?? 300;
      if (s.h === undefined) s.h = f.hPT(s.P, amb.T + 6);
      if (s.m === undefined) s.m = mRef;
    });
    // 4. warm start from previous solution
    if (preserve) for (const c of syscomps) for (const d of compPorts(c)) { const o = preserve.get(key(c.id, d.id)); if (o) { const s = slot(c.id, d.id); s.P = o.P; s.h = o.h; s.m = o.m; } }
    // 5. build elements
    const wallInit: number[] = []; const wallOf = new Map<string, number[]>();
    const elems: Elem[] = []; const elemComp: string[] = [];
    let nWalls = 0;
    for (const c of syscomps) {
      const sp = SPECS[c.type];
      const wl: number[] = [];
      const ctx: BuildCtx = {
        comp: c, p: c.params, mRef,
        node: (pid) => idxOfPort(c.id, pid),
        has: (pid) => nodeIdx.has('N:' + uf.find(key(c.id, pid))),
        fluid: (ps) => fl(c.id, ps), fluidId: (ps) => fluidOf.get(c.id)![ps],
        wall: (Tinit) => { const i = 3 * nNodes + nWalls++; const pw = wallPreserve?.get(c.id)?.[wl.length]; wallInit.push(pw ?? Tinit ?? amb.T + 10); wl.push(i); return i; },
        initT: (pid) => { const s = slot(c.id, pid); const p = compPorts(c).find((q) => q.id === pid)!; return fl(c.id, p.pass).T(s.P!, s.h!); },
      };
      const el = sp.build(ctx);
      elems.push(el); elemComp.push(c.id); wallOf.set(c.id, wl);
    }
    const nVar = 3 * nNodes + nWalls;
    const x = new Float64Array(nVar), xs = new Float64Array(nVar);
    for (let i = 0; i < nNodes; i++) { x[3 * i] = initV[i].P!; x[3 * i + 1] = initV[i].h!; x[3 * i + 2] = initV[i].m!; xs[3 * i] = 100; xs[3 * i + 1] = 100; xs[3 * i + 2] = mRef; }
    for (let j = 0; j < nWalls; j++) { x[3 * nNodes + j] = wallInit[j]; xs[3 * nNodes + j] = 20; }
    const off: number[] = []; let nEq = 0;
    for (const e of elems) { off.push(nEq); nEq += e.nEq; }
    const portIdx = new Map<string, NodeIdx>();
    for (const c of syscomps) for (const d of compPorts(c)) portIdx.set(key(c.id, d.id), idxOfPort(c.id, d.id));
    systems.push({ id: sysCounter++, comps: cids, elems, elemComp, off, nVar, nEq, x, prev: x.slice(), xs, r: new Float64Array(nEq + 1), rt: new Float64Array(nEq + 1), A: new Float64Array(nVar * nVar), g: new Float64Array(nVar),
      softP: 0, mRef, portIdx, wallOf, converged: false, iters: 0, resid: NaN });
    for (const id of cids) active.add(id);
  }
  for (const c of scene.comps) if (!active.has(c.id) && !refLines.has(c.id) && !issues.some((i) => i.comp === c.id)) issues.push({ comp: c.id, msg: 'מחובר למעגל לא שלם' });
  return { systems, issues, active, fluidOf, nodeOfPort, refLines, comps };
}

/* =============================================================================================== */
/*  Solver                                                                                         */
/* =============================================================================================== */
const SOFT_W = 1e-3;
function evalAll(sys: SystemRT, x: Float64Array, S: StepCtx, out: Float64Array) {
  for (let i = 0; i < sys.elems.length; i++) sys.elems[i].eval(x, S, out, sys.off[i]);
  out[sys.nEq] = SOFT_W * (x[sys.softP] - S.prev[sys.softP]) / 100;
}
function cholSolve(M: Float64Array, n: number, b: Float64Array, out: Float64Array): boolean {
  // in-place Cholesky of M (lower), solve M out = b
  for (let j = 0; j < n; j++) {
    let d = M[j * n + j];
    for (let k = 0; k < j; k++) d -= M[j * n + k] * M[j * n + k];
    if (!(d > 1e-300)) return false;
    d = Math.sqrt(d); M[j * n + j] = d;
    for (let i = j + 1; i < n; i++) { let s = M[i * n + j]; for (let k = 0; k < j; k++) s -= M[i * n + k] * M[j * n + k]; M[i * n + j] = s / d; }
  }
  for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= M[i * n + k] * out[k]; out[i] = s / M[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let s = out[i]; for (let k = i + 1; k < n; k++) s -= M[k * n + i] * out[k]; out[i] = s / M[i * n + i]; }
  return true;
}
const tmpR = new Float64Array(64);
let M_buf = new Float64Array(0), dy_buf = new Float64Array(0), mg_buf = new Float64Array(0), xn_buf = new Float64Array(0);

export function solveLM(sys: SystemRT, S: StepCtx, maxIt = 40, tol = 1e-7): { converged: boolean; iters: number; resid: number } {
  const n = sys.nVar, nEq = sys.nEq, x = sys.x, xs = sys.xs, r = sys.r, rt = sys.rt, A = sys.A, g = sys.g;
  if (M_buf.length < n * n) { M_buf = new Float64Array(n * n); dy_buf = new Float64Array(n); mg_buf = new Float64Array(n); xn_buf = new Float64Array(n); }
  const M = M_buf, dy = dy_buf, mg = mg_buf, xn = xn_buf;
  evalAll(sys, x, S, r);
  const rn2 = (v: Float64Array) => { let s = 0; for (let i = 0; i <= nEq; i++) s += v[i] * v[i]; return s; };
  const rmax = (v: Float64Array) => { let s = 0; for (let i = 0; i < nEq; i++) { const a = Math.abs(v[i]); if (a > s) s = a; else if (a !== a) return Infinity; } return s; };
  let f = rn2(r), lam = 1e-3, it = 0;
  for (; it < maxIt; it++) {
    if (rmax(r) < tol) return { converged: true, iters: it, resid: rmax(r) };
    A.fill(0, 0, n * n); g.fill(0, 0, n);
    for (let ei = 0; ei < sys.elems.length; ei++) {
      const e = sys.elems[ei], nv = e.vars.length, ne = e.nEq, o = sys.off[ei];
      const Jl = nv * ne <= 4096 ? new Float64Array(nv * ne) : new Float64Array(nv * ne);
      for (let jv = 0; jv < nv; jv++) {
        const v = e.vars[jv], x0 = x[v], d = 1e-6 * xs[v];
        x[v] = x0 + d; e.eval(x, S, tmpR, 0); x[v] = x0;
        for (let k = 0; k < ne; k++) Jl[k * nv + jv] = (tmpR[k] - r[o + k]) / d * xs[v];
      }
      for (let k = 0; k < ne; k++) {
        const rk = r[o + k];
        for (let i = 0; i < nv; i++) {
          const ji = Jl[k * nv + i]; if (ji === 0) continue;
          const vi = e.vars[i]; g[vi] += ji * rk;
          for (let j = 0; j < nv; j++) A[vi * n + e.vars[j]] += ji * Jl[k * nv + j];
        }
      }
    }
    { const sp = sys.softP, dd = SOFT_W / 100 * xs[sp]; A[sp * n + sp] += dd * dd; g[sp] += dd * r[nEq]; }
    let accepted = false;
    for (let tries = 0; tries < 10; tries++) {
      for (let i = 0; i < n; i++) { const di = Math.max(A[i * n + i], 1e-10); for (let j = 0; j < n; j++) M[i * n + j] = A[i * n + j]; M[i * n + i] += lam * di + 1e-12; mg[i] = -g[i]; }
      if (!cholSolve(M, n, mg, dy)) { lam *= 10; continue; }
      for (let i = 0; i < n; i++) xn[i] = x[i] + dy[i] * xs[i];
      evalAll(sys, xn, S, rt);
      const fn = rn2(rt);
      if (fn < f || (fn === fn && fn < 1e-24)) { x.set(xn.subarray(0, n)); r.set(rt); f = fn; lam = Math.max(lam / 4, 1e-10); accepted = true; break; }
      lam *= 5;
    }
    if (!accepted) break;
  }
  const rm = rmax(r);
  return { converged: rm < tol * 10, iters: it, resid: rm };
}

export function stepSystem(sys: SystemRT, dt: number, amb: Ambient, depth = 0): boolean {
  const S: StepCtx = { dt, invDt: Number.isFinite(dt) ? 1 / dt : 0, amb, prev: sys.prev };
  sys.prev.set(sys.x);
  const xOld = sys.x.slice();
  const res = solveLM(sys, S);
  sys.iters = res.iters; sys.resid = res.resid;
  if (res.converged) { sys.converged = true; return true; }
  if (depth < 4 && Number.isFinite(dt)) {
    sys.x.set(xOld);
    const a = stepSystem(sys, dt / 2, amb, depth + 1), b = stepSystem(sys, dt / 2, amb, depth + 1);
    sys.converged = a && b; return sys.converged;
  }
  sys.converged = false; return false;
}

/** Find the steady state by pseudo-transient continuation (growing implicit time steps). */
export function settle(sys: SystemRT, amb: Ambient, schedule = [0.2, 1, 5, 25, 120, 600, 3000, 20000]): boolean {
  for (const dt of schedule) stepSystem(sys, dt, amb);
  stepSystem(sys, Infinity, amb);
  sys.prev.set(sys.x);
  return sys.converged;
}

/* =============================================================================================== */
/*  Simulation                                                                                     */
/* =============================================================================================== */
export class Simulation {
  scene: SceneData; compiled!: Compiled; amb!: Ambient; time = 0;
  telemetry = new Map<string, Telemetry>();
  constructor(scene: SceneData) { this.scene = scene; this.rebuild(scene, { preserve: false, steady: true }); }

  rebuild(scene: SceneData, opt: { preserve?: boolean; steady?: boolean } = {}) {
    this.scene = scene; this.amb = makeAmbient(scene.ambient);
    let pres: Map<string, NodeState> | undefined, wpres: Map<string, number[]> | undefined;
    if (opt.preserve && this.compiled) {
      pres = new Map(); wpres = new Map();
      for (const s of this.compiled.systems) {
        for (const [k, ix] of s.portIdx) pres.set(k, { P: s.x[ix.P], h: s.x[ix.h], m: s.x[ix.m] });
        for (const [cid, w] of s.wallOf) wpres.set(cid, w.map((i) => s.x[i]));
      }
    }
    this.compiled = compile(scene, pres, wpres);
    if (opt.steady) this.settleAll();
    else for (const s of this.compiled.systems) { s.prev.set(s.x); stepSystem(s, 0.5, this.amb); }
    this.refreshTelemetry();
  }
  settleAll() {
    for (const s of this.compiled.systems) settle(s, this.amb);
    if (this.scene.comps.some((c) => c.type === 'expansion_valve' && c.params.mode === 'txv')) {
      for (let k = 0; k < 120; k++) {
        this.refreshTelemetry(); this.control(12, 0.5);
        for (const s of this.compiled.systems) stepSystem(s, Infinity, this.amb);
      }
      for (const s of this.compiled.systems) s.prev.set(s.x);
    }
  }
  /** cold start: all fluid and walls at ambient, then simulate start-up */
  coldStart() {
    this.rebuild(this.scene, { preserve: false, steady: false });
  }
  step(dt: number) {
    for (const s of this.compiled.systems) stepSystem(s, dt, this.amb);
    this.control(dt);
    this.time += dt;
    this.refreshTelemetry();
  }
  get converged() { return this.compiled.systems.every((s) => s.converged); }
  get worstResidual() { return this.compiled.systems.reduce((m, s) => Math.max(m, Number.isFinite(s.resid) ? s.resid : 1), 0); }
  get iterations() { return this.compiled.systems.reduce((m, s) => Math.max(m, s.iters), 0); }

  refreshTelemetry() {
    this.telemetry.clear();
    for (const s of this.compiled.systems) {
      const S: StepCtx = { dt: 1, invDt: 1, amb: this.amb, prev: s.prev };
      s.elems.forEach((e) => { try { this.telemetry.set(e.id, e.tele(s.x, S)); } catch { /* ignore */ } });
    }
  }
  /** external slow controllers (TXV superheat control) */
  control(dt: number, steadyGain = 0) {
    const C = this.compiled;
    for (const c of this.scene.comps) {
      if (c.type !== 'expansion_valve' || c.params.mode !== 'txv' || !C.active.has(c.id)) continue;
      // find the evaporator downstream
      let cid = c.id, evap: string | undefined;
      for (let hop = 0; hop < 12 && !evap; hop++) {
        const cc = C.comps.get(cid)!; const outPort = SPECS[cc.type].ports(cc.params).find((p) => p.kind === 'out'); if (!outPort) break;
        const node = C.nodeOfPort.get(key(cid, outPort.id)); const nxt = node?.ports.find((p) => p.def.kind === 'in' && p.comp !== cid);
        if (!nxt) break; const nc = C.comps.get(nxt.comp)!;
        if (nc.type === 'evaporator') evap = nc.id; else cid = nc.id;
      }
      const t = evap && this.telemetry.get(evap);
      if (!t) continue;
      const sh = (t.superheat as number) ?? 0; const x_out = (t.x_out as number) ?? 1;
      // continuous superheat measure: wet outlet counts as negative superheat
      const shEff = x_out < 0.999 ? -40 * (1 - x_out) : sh;
      const err = (c.params.sh_target as number) - shEff; // positive: too little superheat -> close
      const rate = steadyGain > 0 ? Math.max(-6, Math.min(6, steadyGain * err)) : Math.max(-1.2 * dt, Math.min(1.2 * dt, 0.06 * err * dt));
      c.params.open_pct = Math.min(100, Math.max(3, (c.params.open_pct as number) - rate));
    }
  }
}
