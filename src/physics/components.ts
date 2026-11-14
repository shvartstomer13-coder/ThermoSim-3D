/**
 * Component library: parameters, ports and physical element models (residual equations).
 * Every element contributes algebraic residuals that are solved simultaneously by physicsEngine.ts.
 * Implicit-Euler thermal inertia: fluid hold-up (M [kg-equivalent]) and wall temperature states.
 */
import type { CompSpec, Elem, BuildCtx, InitCtx, Params, ParamDef, PortDef, NodeIdx, Telemetry, StepCtx } from './engineTypes';
import type { FluidModel } from './fluidProperties';
import {
  G, MATERIALS, darcyDp, hInside, exchangerFF, exchangerFC, marchWall, hCompressed, hExpanded, smoothPos, smoothStep, clamp,
} from './thermodynamics';

const PI = Math.PI;
const FLUID_OPTS = [
  { value: 'water', label: 'Water / Steam' }, { value: 'glycol30', label: 'Water-Glycol 30 %' }, { value: 'pg25', label: 'Propylene-Glycol 25 % (PG25)' },
  { value: 'r134a', label: 'R134a' }, { value: 'r410a', label: 'R410A' }, { value: 'air', label: 'Air (ideal gas)' },
];
const fluidParam = (def: string, key = 'fluid', label = 'Working fluid'): ParamDef => ({ key, label, unit: '', min: 0, max: 0, step: 0, def, kind: 'select', options: FLUID_OPTS, group: 'Fluid' });
const num = (key: string, label: string, unit: string, def: number, min: number, max: number, step: number, group = 'Parameters', hint?: string): ParamDef => ({ key, label, unit, min, max, step, def, group, kind: 'number', hint });
const sel = (key: string, label: string, def: string, options: { value: string; label: string }[], group = 'Parameters'): ParamDef => ({ key, label, unit: '', min: 0, max: 0, step: 0, def, kind: 'select', options, group });
const bool = (key: string, label: string, def: boolean, group = 'Parameters'): ParamDef => ({ key, label, unit: '', min: 0, max: 1, step: 1, def, kind: 'bool', group });

const V = (...ns: NodeIdx[]) => ns.flatMap((n) => [n.P, n.h, n.m]);
const tK = (c: number) => c + 273.15;
const SP = 10; // pressure residual scale [kPa]
const SH = 10; // enthalpy residual scale [kJ/kg]

function port(id: string, name: string, kind: PortDef['kind'], pass: number, pos: [number, number, number], dir: [number, number, number], dn: number): PortDef {
  return { id, name, kind, pass, pos, dir, dn };
}
const UP: [number, number, number] = [0, 1, 0];

/* =============================================================================================== */
/*  PIPE-like (pipe + instrument spools)                                                           */
/* =============================================================================================== */
interface PipeGeo { D: number; t: number; L: number; K: number; dz: number; mat: string; ins: number }
function buildPipeLike(c: BuildCtx, type: string, geo: PipeGeo): Elem {
  const a = c.node('in'), b = c.node('out'), f = c.fluid(0);
  const mat = MATERIALS[geo.mat] ?? MATERIALS.carbon;
  const { D, t, L, K, dz, ins } = geo;
  const Ai = PI * D * D / 4, ro = D / 2 + t, rIns = ro + ins;
  const Cw = mat.rhoCp * PI * (ro * ro - D * D / 4) * L; // kJ/K
  const kIns = 0.04, hExt = 9;
  const Rwall = Math.log(ro / (D / 2)) / (2 * PI * mat.k);
  const Rout = (ins > 0 ? Math.log(rIns / ro) / (2 * PI * kIns) : 0) + 1 / (hExt * 2 * PI * rIns);
  const sm = c.mRef, se = c.mRef * 20;
  const calc = (x: Float64Array, S: StepCtx) => {
    const m = 0.5 * (x[a.m] + x[b.m]), Pm = 0.5 * (x[a.P] + x[b.P]), hm = 0.5 * (x[a.h] + x[b.h]);
    const rho = f.rho(Pm, hm), mu = f.mu(Pm, hm), k = f.k(Pm, hm), cp = Math.min(f.cp(Pm, hm), 1e3);
    const d = darcyDp(m, rho, mu, D, L, mat.rough, K);
    const dp = d.dp + rho * G * dz / 1000;
    const Tf = f.T(Pm, hm), twoPhase = f.phase(Pm, hm) === 'two-phase';
    const hi = twoPhase ? 3000 : hInside(d.Re, cp * 1000 * mu / Math.max(k, 1e-6), k, D, Tf > S.amb.T);
    const Rin = 1 / (hi * PI * D);
    const Rtot = Rin + Rwall + Rout;
    const UA = (L / Rtot) / 1000; // kW/K
    const Q = -UA * (Tf - S.amb.T);
    const Meff = Math.max(rho * Ai * L + Cw / Math.max(cp, 0.3), 0.05);
    return { m, Pm, hm, rho, dp, d, Tf, UA, Q, Meff, Rtot, frac: (1 / (hExt * 2 * PI * rIns)) / Rtot };
  };
  return {
    id: c.comp.id, type, nEq: 3, vars: V(a, b),
    eval(x, S, r, o) {
      const q = calc(x, S);
      r[o] = (x[a.m] - x[b.m]) / sm;
      r[o + 1] = (x[a.P] - x[b.P] - q.dp) / SP;
      r[o + 2] = (q.Meff * (x[b.h] - S.prev[b.h]) * S.invDt - q.m * (x[a.h] - x[b.h]) - q.Q) / se;
    },
    tele(x, S): Telemetry {
      const q = calc(x, S);
      const Tin = f.T(x[a.P], x[a.h]), Tout = f.T(x[b.P], x[b.h]);
      const Tsurf = S.amb.T + q.frac * (q.Tf - S.amb.T);
      return { mdot: q.m, P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P], T_in: Tin, T_out: Tout, T_surf: Tsurf, velocity: q.d.v, Re: q.d.Re, f_darcy: q.d.f,
        Q_loss: -q.Q, phase: f.phase(x[b.P], x[b.h]), x_out: f.x(x[b.P], x[b.h]), rho: q.rho, flow_m3h: q.m / q.rho * 3600 };
    },
  };
}
const pipeParams = (D: number): ParamDef[] => [
  fluidParam('pg25'),
  num('D_mm', 'Inner diameter', 'mm', D, 6, 600, 1, 'Geometry'),
  num('wall_mm', 'Wall thickness', 'mm', 5, 0.5, 40, 0.5, 'Geometry'),
  num('L_m', 'Length (auto from route)', 'm', 5, 0.1, 500, 0.1, 'Geometry'),
  num('dz', 'Elevation gain (auto)', 'm', 0, -50, 50, 0.1, 'Geometry'),
  num('K', 'Minor loss K (fittings)', '-', 1.0, 0, 50, 0.1, 'Geometry', 'elbows + flanges, auto-updated from route'),
  sel('material', 'Material', 'carbon', Object.entries(MATERIALS).map(([value, m]) => ({ value, label: m.label }))),
  num('ins_mm', 'Insulation thickness', 'mm', 0, 0, 200, 5, 'Geometry'),
];
function pipeSpec(type: string, label: string, desc: string, cat: CompSpec['category'], D: number, fp: [number, number, number], extra: ParamDef[] = [], spool = false): CompSpec {
  return {
    type, label, desc, category: cat, passes: 1, defaultFluids: ['pg25'], params: [...pipeParams(D), ...extra], footprint: fp, passThrough: true,
    ports: (p) => spool
      ? [port('in', 'Inlet', 'in', 0, [-fp[0] / 2, 0.2, 0], [-1, 0, 0], p.D_mm as number), port('out', 'Outlet', 'out', 0, [fp[0] / 2, 0.2, 0], [1, 0, 0], p.D_mm as number)]
      : [port('in', 'Inlet', 'in', 0, [0, 0, 0], [0, 1, 0], p.D_mm as number), port('out', 'Outlet', 'out', 0, [0, 0, 0], [0, 1, 0], p.D_mm as number)],
    build: (c) => {
      const p = c.p as Params;
      const n = (k: string) => p[k] as number;
      return buildPipeLike(c, type, { D: n('D_mm') / 1000, t: n('wall_mm') / 1000, L: spool ? Math.max(n('L_m'), 0.3) : n('L_m'), K: n('K'), dz: spool ? 0 : n('dz'), mat: p.material as string, ins: n('ins_mm') / 1000 });
    },
  };
}

/* =============================================================================================== */
/*  CONTROL VALVE & EXPANSION VALVE                                                                */
/* =============================================================================================== */
const valveSpec: CompSpec = {
  type: 'valve', label: 'Control Valve', category: 'piping', desc: 'Kv-based globe/ball control valve with equal-percentage or linear trim.', passes: 1, defaultFluids: ['pg25'], passThrough: true,
  footprint: [0.5, 0.7, 0.3],
  params: [fluidParam('pg25'), num('D_mm', 'Nominal diameter', 'mm', 100, 10, 400, 1, 'Geometry'),
    num('Kv', 'Kv at 100 % open', 'm³/h', 250, 1, 5000, 1), num('open_pct', 'Opening', '%', 100, 0, 100, 1),
    sel('char', 'Trim characteristic', 'eqpct', [{ value: 'eqpct', label: 'Equal percentage (R=50)' }, { value: 'linear', label: 'Linear' }])],
  ports: (p) => [port('in', 'Inlet', 'in', 0, [-0.25, 0.2, 0], [-1, 0, 0], p.D_mm as number), port('out', 'Outlet', 'out', 0, [0.25, 0.2, 0], [1, 0, 0], p.D_mm as number)],
  build(c) {
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
    const Kv = c.p.Kv as number;
    const kvEff = () => { const o = clamp((c.p.open_pct as number) / 100, 0, 1); return c.p.char === 'linear' ? Kv * Math.max(o, 0.02) : Kv * Math.pow(50, o - 1); };
    const dpOf = (x: Float64Array) => {
      const m = 0.5 * (x[a.m] + x[b.m]), rho = f.rho(x[a.P], x[a.h]);
      const V = m / rho * 3600; // m3/h
      return { dp: 100 * (rho / 1000) * V * Math.abs(V) / (kvEff() ** 2), V, rho };
    };
    return {
      id: c.comp.id, type: 'valve', nEq: 3, vars: V(a, b),
      eval(x, S, r, o) {
        r[o] = (x[a.m] - x[b.m]) / sm;
        r[o + 1] = (x[a.P] - x[b.P] - dpOf(x).dp) / SP;
        r[o + 2] = (x[b.h] - x[a.h]) / SH;
      },
      tele(x): Telemetry { const d = dpOf(x); return { mdot: x[a.m], dP: d.dp, P_in: x[a.P], P_out: x[b.P], T_in: f.T(x[a.P], x[a.h]), T_out: f.T(x[b.P], x[b.h]), T_surf: f.T(x[a.P], x[a.h]), opening: c.p.open_pct as number, flow_m3h: d.V, Kv_eff: kvEff() }; },
    };
  },
};

const expValveSpec: CompSpec = {
  type: 'expansion_valve', label: 'Expansion / Throttling Valve', category: 'cycle', desc: 'Isenthalpic throttling orifice (ṁ = Cd·A·√(2ρΔP)). TXV mode holds evaporator superheat.', passes: 1, defaultFluids: ['r134a'],
  footprint: [0.5, 0.6, 0.35],
  params: [fluidParam('r134a'), num('d_mm', 'Orifice diameter (full open)', 'mm', 8, 1, 80, 0.1, 'Geometry'), num('open_pct', 'Opening', '%', 60, 1, 100, 1),
    num('Cd', 'Discharge coefficient', '-', 0.65, 0.3, 1, 0.01), sel('mode', 'Control mode', 'txv', [{ value: 'manual', label: 'Manual opening' }, { value: 'txv', label: 'TXV (superheat control)' }]),
    num('sh_target', 'Superheat target (TXV)', 'K', 6, 1, 20, 0.5)],
  ports: () => [port('in', 'Inlet', 'in', 0, [-0.25, 0.2, 0], [-1, 0, 0], 20), port('out', 'Outlet', 'out', 0, [0.25, 0.2, 0], [1, 0, 0], 25)],
  build(c) {
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef;
    const cda = () => c.p.Cd as number * PI * ((c.p.d_mm as number) / 1000) ** 2 / 4 * Math.max((c.p.open_pct as number) / 100, 0.01);
    const dpOf = (x: Float64Array) => { const m = 0.5 * (x[a.m] + x[b.m]); const rho = f.rho(x[a.P], x[a.h]); return m * Math.abs(m) / (2 * rho * cda() ** 2) / 1000; };
    return {
      id: c.comp.id, type: 'expansion_valve', nEq: 3, vars: V(a, b),
      eval(x, S, r, o) {
        r[o] = (x[a.m] - x[b.m]) / sm;
        r[o + 1] = (x[a.P] - x[b.P] - dpOf(x)) / SP;
        r[o + 2] = (x[b.h] - x[a.h]) / SH;
      },
      tele(x): Telemetry { return { mdot: x[a.m], dP: x[a.P] - x[b.P], P_in: x[a.P], P_out: x[b.P], T_in: f.T(x[a.P], x[a.h]), T_out: f.T(x[b.P], x[b.h]), T_surf: f.T(x[b.P], x[b.h]) + 3, x_out: f.x(x[b.P], x[b.h]), opening: c.p.open_pct as number }; },
    };
  },
};

/* =============================================================================================== */
/*  PUMP                                                                                           */
/* =============================================================================================== */
const pumpSpec: CompSpec = {
  type: 'pump', label: 'Centrifugal Pump', category: 'datacenter', desc: 'Variable-speed centrifugal pump (affinity laws, quadratic H-Q curve) or fixed-mass-flow feed pump.', passes: 1, defaultFluids: ['pg25'],
  footprint: [0.95, 0.75, 0.5],
  params: [fluidParam('pg25'), num('speed_pct', 'Speed', '%', 100, 5, 120, 1), sel('mode', 'Operating mode', 'curve', [{ value: 'curve', label: 'Pump curve (variable speed)' }, { value: 'massflow', label: 'Fixed mass flow (feed pump)' }]),
    num('m_rated', 'Rated mass flow', 'kg/s', 12, 0.01, 500, 0.1, 'Pump curve'), num('H_rated', 'Rated head', 'm', 25, 1, 300, 0.5, 'Pump curve'),
    num('eta_peak', 'Peak efficiency', '-', 0.75, 0.3, 0.92, 0.01, 'Pump curve'), num('m_set', 'Mass flow set-point @100 %', 'kg/s', 2, 0.01, 500, 0.05, 'Fixed-flow mode'),
    num('hold_kg', 'Hold-up mass', 'kg', 20, 1, 2000, 1, 'Thermal')],
  ports: () => [port('in', 'Suction', 'in', 0, [-0.5, 0.35, 0], [-1, 0, 0], 80), port('out', 'Discharge', 'out', 0, [0.12, 0.75, 0], UP, 80)],
  build(c) {
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number;
    const calc = (x: Float64Array) => {
      const s = n('speed_pct') / 100, m = 0.5 * (x[a.m] + x[b.m]), rho = f.rho(x[a.P], x[a.h]);
      const mr = n('m_rated'), Hr = n('H_rated');
      const H = 1.2 * Hr * s * s - 0.2 * Hr * (m / mr) ** 2;
      const rise = rho * G * H / 1000;
      const q = m / Math.max(s * mr, 1e-3);
      const eta = clamp(n('eta_peak') * (1 - 0.8 * (q - 1) ** 2), 0.15, n('eta_peak'));
      return { s, m, rho, H, rise, eta };
    };
    const isFlow = c.p.mode === 'massflow';
    return {
      id: c.comp.id, type: 'pump', nEq: 3, vars: V(a, b),
      eval(x, S, r, o) {
        const q = calc(x);
        r[o] = (x[a.m] - x[b.m]) / sm;
        r[o + 1] = isFlow ? (x[a.m] - n('m_set') * q.s) / sm : (x[b.P] - x[a.P] - q.rise) / SP;
        const eta = isFlow ? clamp(n('eta_peak'), 0.3, 0.9) : q.eta;
        const W = q.m * (hCompressed(f, x[a.P], x[a.h], x[b.P], eta) - x[a.h]);
        r[o + 2] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - q.m * (x[a.h] - x[b.h]) - W) / se;
      },
      tele(x): Telemetry {
        const q = calc(x); const eta = isFlow ? n('eta_peak') : q.eta;
        const dP = x[b.P] - x[a.P];
        const Wh = q.m * dP / q.rho; // hydraulic kW
        return { mdot: q.m, dP, head_m: dP * 1000 / (q.rho * G), P_in: x[a.P], P_out: x[b.P], T_in: f.T(x[a.P], x[a.h]), T_out: f.T(x[b.P], x[b.h]), T_surf: f.T(x[b.P], x[b.h]) + 4,
          W_shaft: Wh / Math.max(eta, 0.05), W_hyd: Wh, eta, speed: n('speed_pct'), flow_m3h: q.m / q.rho * 3600 };
      },
    };
  },
  init(c) {
    const m = c.p.mode === 'massflow' ? (c.p.m_set as number) * (c.p.speed_pct as number) / 100 : (c.p.m_rated as number) * (c.p.speed_pct as number) / 100 * 0.9;
    c.set('in', { m }); c.set('out', { m });
  },
};

/* =============================================================================================== */
/*  MANIFOLDS and TANK                                                                             */
/* =============================================================================================== */
function manifoldSpec(split: boolean): CompSpec {
  const type = split ? 'manifold_split' : 'manifold_merge';
  return {
    type, label: split ? 'Supply Header (split)' : 'Return Header (merge)', category: 'piping', desc: split ? 'Distributes flow to N parallel branches (equal pressure at the header).' : 'Collects N parallel branches (adiabatic mixing).', passes: 1, defaultFluids: ['pg25'],
    footprint: [3, 0.6, 0.5],
    params: [fluidParam('pg25'), num('n', 'Branches', '', 4, 2, 8, 1, 'Geometry'), num('D_mm', 'Header diameter', 'mm', 150, 20, 600, 1, 'Geometry'), num('Kb', 'Branch loss coefficient', '-', 1.2, 0, 10, 0.1), num('hold_kg', 'Hold-up mass', 'kg', 15, 0.5, 500, 1, 'Thermal')],
    ports: (p) => {
      const n = Math.round(p.n as number), L = n * 0.9, ports: PortDef[] = [];
      const xs = (k: number) => -L / 2 + 0.45 + k * 0.9;
      if (split) { ports.push(port('in', 'Inlet', 'in', 0, [-L / 2, 0.3, 0], [-1, 0, 0], p.D_mm as number)); for (let k = 0; k < n; k++) ports.push(port('out' + (k + 1), 'Branch ' + (k + 1), 'out', 0, [xs(k), 0.3, 0], UP, 50)); }
      else { for (let k = 0; k < n; k++) ports.push(port('in' + (k + 1), 'Branch ' + (k + 1), 'in', 0, [xs(k), 0.3, 0], UP, 50)); ports.push(port('out', 'Outlet', 'out', 0, [L / 2, 0.3, 0], [1, 0, 0], p.D_mm as number)); }
      return ports;
    },
    build(c) {
      const n = Math.round(c.p.n as number), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
      const D = 0.05, Ab = PI * D * D / 4, Kb = c.p.Kb as number, hold = c.p.hold_kg as number;
      const br = Array.from({ length: n }, (_, k) => c.node((split ? 'out' : 'in') + (k + 1)));
      const trunk = c.node(split ? 'in' : 'out');
      const dpB = (x: Float64Array, nd: NodeIdx) => { const rho = f.rho(x[nd.P], x[nd.h]); const v = x[nd.m] / (rho * Ab); return Kb * rho * v * Math.abs(v) / 2 / 1000; };
      const vars = V(trunk, ...br);
      if (split) {
        return {
          id: c.comp.id, type, nEq: 1 + 2 * n, vars,
          eval(x, S, r, o) {
            let sum = 0; for (const b of br) sum += x[b.m];
            r[o] = (x[trunk.m] - sum) / sm;
            br.forEach((b, k) => { r[o + 1 + k] = (x[trunk.P] - x[b.P] - dpB(x, b)) / SP; r[o + 1 + n + k] = (x[b.h] - x[trunk.h]) / SH; });
          },
          tele(x): Telemetry { const t: Telemetry = { mdot: x[trunk.m], P_in: x[trunk.P], T_in: f.T(x[trunk.P], x[trunk.h]), T_out: f.T(x[trunk.P], x[trunk.h]), T_surf: f.T(x[trunk.P], x[trunk.h]) }; br.forEach((b, k) => { t['m_br' + (k + 1)] = x[b.m]; }); return t; },
        };
      }
      return {
        id: c.comp.id, type, nEq: n + 2, vars,
        eval(x, S, r, o) {
          let sum = 0, hs = 0; for (const b of br) { sum += x[b.m]; hs += x[b.m] * (x[b.h] - x[trunk.h]); }
          r[o] = (sum - x[trunk.m]) / sm;
          br.forEach((b, k) => { r[o + 1 + k] = (x[b.P] - x[trunk.P] - dpB(x, b)) / SP; });
          r[o + 1 + n] = (hold * (x[trunk.h] - S.prev[trunk.h]) * S.invDt - hs) / se;
        },
        tele(x): Telemetry { const t: Telemetry = { mdot: x[trunk.m], P_out: x[trunk.P], T_in: f.T(x[trunk.P], x[trunk.h]), T_out: f.T(x[trunk.P], x[trunk.h]), T_surf: f.T(x[trunk.P], x[trunk.h]) }; br.forEach((b, k) => { t['m_br' + (k + 1)] = x[b.m]; t['T_br' + (k + 1)] = f.T(x[b.P], x[b.h]); }); return t; },
      };
    },
    init(c) {
      const n = Math.round(c.p.n as number);
      if (split) { const g = c.get('in'); for (let k = 1; k <= n; k++) c.set('out' + k, { P: g.P, h: g.h, m: g.m !== undefined ? g.m / n : undefined }); }
      else { let m = 0, ok = true; for (let k = 1; k <= n; k++) { const g = c.get('in' + k); if (g.m === undefined) ok = false; else m += g.m; } if (ok) c.set('out', { m }); }
    },
  };
}

const tankSpec: CompSpec = {
  type: 'exp_tank', label: 'Expansion Tank (pressure ref.)', category: 'datacenter', desc: 'Fixes the absolute pressure of the circuit node it is connected to (closes the pressure level of a closed loop).', passes: 1, defaultFluids: ['pg25'],
  footprint: [0.8, 1.5, 0.8],
  params: [fluidParam('pg25'), num('p_set', 'Set pressure (abs)', 'kPa', 300, 101.325, 2000, 5)],
  ports: () => [port('ref', 'Tank connection', 'ref', 0, [0.4, 0.3, 0], [1, 0, 0], 40)],
  build(c) {
    const a = c.node('ref');
    return { id: c.comp.id, type: 'exp_tank', nEq: 1, vars: [a.P], eval(x, _S, r, o) { r[o] = (x[a.P] - (c.p.p_set as number)) / SP; }, tele: (x) => ({ P_in: x[a.P], P_out: x[a.P], T_surf: c.fluid(0).T(x[a.P], x[a.h]) }) };
  },
  init(c) { c.set('ref', { P: c.p.p_set as number }); },
};

/* =============================================================================================== */
/*  AI SERVER RACK with D2C cold plates                                                            */
/* =============================================================================================== */
const rackSpec: CompSpec = {
  type: 'rack', label: 'AI Server Rack (D2C)', category: 'datacenter', desc: 'High-density GPU rack with direct-to-chip liquid cold plates. Lumped chip/cold-plate thermal mass, flow-dependent UA, thermal throttling.', passes: 1, defaultFluids: ['pg25'],
  footprint: [0.8, 2.2, 1.25],
  params: [fluidParam('pg25'), num('tdp_kw', 'Rack TDP (heat load)', 'kW', 120, 5, 400, 1, 'Heat load'), num('util_pct', 'Compute utilisation', '%', 90, 0, 100, 1, 'Heat load'),
    num('d2c_frac', 'Fraction captured by liquid (D2C)', '-', 0.8, 0.3, 0.98, 0.01, 'Heat load'),
    num('m_rated', 'Rated coolant flow', 'kg/s', 2, 0.05, 20, 0.05, 'Hydraulics'), num('dp_rated', 'Cold-plate ΔP @ rated flow', 'kPa', 80, 5, 400, 1, 'Hydraulics'),
    num('UA', 'Cold-plate UA @ rated flow', 'kW/K', 4.5, 0.5, 50, 0.1, 'Thermal'), num('Cw', 'Chip + cold-plate thermal mass', 'kJ/K', 150, 5, 5000, 5, 'Thermal'),
    num('hold_kg', 'Coolant hold-up', 'kg', 12, 1, 200, 1, 'Thermal'), num('t_throttle', 'Throttle onset (chip)', '°C', 85, 50, 110, 1, 'Protection')],
  ports: () => [port('in', 'Coolant supply', 'in', 0, [-0.22, 2.2, 0], UP, 50), port('out', 'Coolant return', 'out', 0, [0.22, 2.2, 0], UP, 50)],
  build(c) {
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0), w = c.wall(c.initT('in') + 14), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number;
    const calc = (x: Float64Array) => {
      const m = 0.5 * (x[a.m] + x[b.m]), Tw = x[w];
      const thr = 1 - 0.5 * smoothStep((Tw - tK(n('t_throttle'))) / 12);
      const Qchip = n('tdp_kw') * n('util_pct') / 100 * n('d2c_frac') * thr;
      const rel = Math.max(Math.abs(m), 1e-3) / n('m_rated');
      const UA = n('UA') * Math.pow(clamp(rel, 0.15, 3), 0.8);
      const Pm = 0.5 * (x[a.P] + x[b.P]);
      const hX = marchWall(f, Pm, x[a.h], m, Tw, UA, 10);
      const Qwf = m * (hX - x[a.h]);
      const dp = n('dp_rated') * Math.pow(Math.max(rel, 0.05), 0.85) * (m / n('m_rated'));
      return { m, Tw, thr, Qchip, UA, hX, Qwf, dp };
    };
    return {
      id: c.comp.id, type: 'rack', nEq: 4, vars: [...V(a, b), w],
      eval(x, S, r, o) {
        const q = calc(x);
        r[o] = (x[a.m] - x[b.m]) / sm;
        r[o + 1] = (x[a.P] - x[b.P] - q.dp) / SP;
        r[o + 2] = (n('Cw') * (x[w] - S.prev[w]) * S.invDt - q.Qchip + q.Qwf) / se;
        r[o + 3] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - q.m * (x[a.h] - x[b.h]) - q.Qwf) / se;
      },
      tele(x, S): Telemetry {
        const q = calc(x); const rho = f.rho(x[a.P], x[a.h]); const A = PI * 0.05 ** 2 / 4;
        const air = n('tdp_kw') * n('util_pct') / 100 * (1 - n('d2c_frac'));
        return { mdot: q.m, P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P], T_in: f.T(x[a.P], x[a.h]), T_out: f.T(x[b.P], x[b.h]), T_chip: q.Tw, T_surf: S.amb.T + 8 + air * 0.25, Q_liquid: q.m * (x[b.h] - x[a.h]), Q_chip: q.Qchip,
          Q_air: air, throttle_pct: q.thr * 100, velocity: q.m / (rho * A), Re: rho * Math.abs(q.m / (rho * A)) * 0.05 / f.mu(x[a.P], x[a.h]), flow_m3h: q.m / rho * 3600, UA_eff: q.UA };
      },
    };
  },
  init(c) { c.set('in', { m: c.p.m_rated as number }); c.set('out', { m: c.p.m_rated as number }); },
};

/* =============================================================================================== */
/*  PLATE HX, CDU, CHILLER (4-port)                                                                */
/* =============================================================================================== */
const HX_FOOT: [number, number, number] = [0.7, 1.3, 0.45];
const plateSpec: CompSpec = {
  type: 'plate_hx', label: 'Plate Heat Exchanger', category: 'datacenter', desc: 'Counter-flow gasketed plate HX, enthalpy-based ε-NTU with phase-change capable capacity rates.', passes: 2, defaultFluids: ['pg25', 'water'],
  footprint: HX_FOOT,
  params: [fluidParam('pg25', 'fluid', 'Hot-side fluid'), fluidParam('water', 'fluid2', 'Cold-side fluid'), num('UA', 'Overall UA', 'kW/K', 120, 1, 5000, 1, 'Heat transfer'),
    num('m_h0', 'Hot side rated flow', 'kg/s', 8, 0.05, 300, 0.1, 'Hydraulics'), num('dp_h0', 'Hot side ΔP @ rated', 'kPa', 40, 1, 300, 1, 'Hydraulics'),
    num('m_c0', 'Cold side rated flow', 'kg/s', 8, 0.05, 300, 0.1, 'Hydraulics'), num('dp_c0', 'Cold side ΔP @ rated', 'kPa', 40, 1, 300, 1, 'Hydraulics'),
    num('hold_h', 'Hot side hold-up (fluid + plates)', 'kg', 40, 1, 2000, 1, 'Thermal'), num('hold_c', 'Cold side hold-up (fluid + plates)', 'kg', 40, 1, 2000, 1, 'Thermal')],
  ports: () => [port('hot_in', 'Hot inlet', 'in', 0, [-0.24, 1.3, 0], UP, 80), port('hot_out', 'Hot outlet', 'out', 0, [-0.08, 1.3, 0], UP, 80),
    port('cold_in', 'Cold inlet', 'in', 1, [0.08, 1.3, 0], UP, 80), port('cold_out', 'Cold outlet', 'out', 1, [0.24, 1.3, 0], UP, 80)],
  build(c) {
    const hi = c.node('hot_in'), ho = c.node('hot_out'), ci = c.node('cold_in'), co = c.node('cold_out');
    const fh = c.fluid(0), fc = c.fluid(1), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number;
    const ex = (x: Float64Array) => exchangerFF(fh, x[hi.P], x[hi.h], Math.abs(x[hi.m]), fc, x[ci.P], x[ci.h], Math.abs(x[ci.m]), n('UA'));
    return {
      id: c.comp.id, type: 'plate_hx', nEq: 6, vars: V(hi, ho, ci, co),
      eval(x, S, r, o) {
        const e = ex(x);
        r[o] = (x[hi.m] - x[ho.m]) / sm;
        r[o + 1] = (x[hi.P] - x[ho.P] - n('dp_h0') * (x[hi.m] / n('m_h0')) * Math.pow(Math.max(Math.abs(x[hi.m]) / n('m_h0'), 0.05), 0.85)) / SP;
        r[o + 2] = (n('hold_h') * (x[ho.h] - S.prev[ho.h]) * S.invDt - x[hi.m] * (x[hi.h] - x[ho.h]) + e.Q) / se;
        r[o + 3] = (x[ci.m] - x[co.m]) / sm;
        r[o + 4] = (x[ci.P] - x[co.P] - n('dp_c0') * (x[ci.m] / n('m_c0')) * Math.pow(Math.max(Math.abs(x[ci.m]) / n('m_c0'), 0.05), 0.85)) / SP;
        r[o + 5] = (n('hold_c') * (x[co.h] - S.prev[co.h]) * S.invDt - x[ci.m] * (x[ci.h] - x[co.h]) - e.Q) / se;
      },
      tele(x): Telemetry {
        const e = ex(x);
        return { mdot: x[hi.m], mdot_cold: x[ci.m], Q: e.Q, eps: e.eps, NTU: e.NTU, T_hot_in: fh.T(x[hi.P], x[hi.h]), T_hot_out: fh.T(x[ho.P], x[ho.h]), T_cold_in: fc.T(x[ci.P], x[ci.h]), T_cold_out: fc.T(x[co.P], x[co.h]),
          P_in: x[hi.P], P_out: x[ho.P], dP: x[hi.P] - x[ho.P], dP_cold: x[ci.P] - x[co.P], T_in: fh.T(x[hi.P], x[hi.h]), T_out: fh.T(x[ho.P], x[ho.h]), T_surf: 0.5 * (fh.T(x[hi.P], x[hi.h]) + fc.T(x[co.P], x[co.h])) };
      },
    };
  },
  init(c) { const h = (c.p.m_h0 as number), k = (c.p.m_c0 as number); c.set('hot_in', { m: h }); c.set('hot_out', { m: h }); c.set('cold_in', { m: k }); c.set('cold_out', { m: k }); },
};

const cduSpec: CompSpec = {
  type: 'cdu', label: 'Coolant Distribution Unit (CDU)', category: 'datacenter', desc: 'Liquid-to-liquid CDU: secondary (TCS) pump + reservoir/expansion tank + plate HX to facility water (primary).', passes: 2, defaultFluids: ['pg25', 'water'],
  footprint: [1.3, 2.0, 0.9],
  params: [fluidParam('pg25', 'fluid', 'Secondary (TCS) fluid'), fluidParam('water', 'fluid2', 'Primary (facility) fluid'), num('speed_pct', 'Pump speed', '%', 100, 5, 120, 1, 'Secondary pump'),
    num('m_rated', 'Pump rated flow', 'kg/s', 9, 0.1, 200, 0.1, 'Secondary pump'), num('H_rated', 'Pump rated head', 'm', 22, 2, 150, 0.5, 'Secondary pump'), num('eta_peak', 'Pump peak efficiency', '-', 0.72, 0.3, 0.9, 0.01, 'Secondary pump'),
    num('p_tank', 'Reservoir set pressure (abs)', 'kPa', 300, 101.325, 1500, 5, 'Secondary pump'), num('dp_s_hx', 'Secondary HX ΔP @ rated', 'kPa', 30, 1, 200, 1, 'Heat exchanger'),
    num('UA', 'HX overall UA', 'kW/K', 60, 1, 3000, 1, 'Heat exchanger'), num('m_p0', 'Primary rated flow', 'kg/s', 8, 0.1, 300, 0.1, 'Heat exchanger'), num('dp_p0', 'Primary ΔP @ rated', 'kPa', 50, 1, 300, 1, 'Heat exchanger'),
    num('hold_s', 'Secondary hold-up', 'kg', 150, 5, 5000, 5, 'Thermal'), num('hold_p', 'Primary hold-up', 'kg', 60, 5, 3000, 5, 'Thermal')],
  ports: () => [port('sec_in', 'TCS return (from racks)', 'in', 0, [-0.5, 2.0, 0.15], UP, 80), port('sec_out', 'TCS supply (to racks)', 'out', 0, [-0.17, 2.0, 0.15], UP, 80),
    port('pri_in', 'Facility water in', 'in', 1, [0.17, 2.0, 0.15], UP, 80), port('pri_out', 'Facility water out', 'out', 1, [0.5, 2.0, 0.15], UP, 80)],
  build(c) {
    const si = c.node('sec_in'), so = c.node('sec_out'), pi = c.node('pri_in'), po = c.node('pri_out');
    const fs = c.fluid(0), fp = c.fluid(1), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number;
    const calc = (x: Float64Array) => {
      const s = n('speed_pct') / 100, m = 0.5 * (x[si.m] + x[so.m]), rho = fs.rho(x[si.P], x[si.h]);
      const H = 1.2 * n('H_rated') * s * s - 0.2 * n('H_rated') * (m / n('m_rated')) ** 2;
      const rise = rho * G * H / 1000, q = m / Math.max(s * n('m_rated'), 1e-3);
      const eta = clamp(n('eta_peak') * (1 - 0.8 * (q - 1) ** 2), 0.15, n('eta_peak'));
      const dpHx = n('dp_s_hx') * (m / n('m_rated')) * Math.pow(Math.max(Math.abs(m) / n('m_rated'), 0.05), 0.85);
      const e = exchangerFF(fs, x[si.P], x[si.h], Math.abs(x[si.m]), fp, x[pi.P], x[pi.h], Math.abs(x[pi.m]), n('UA'));
      const W = m * (hCompressed(fs, x[si.P], x[si.h], x[si.P] + rise, eta) - x[si.h]);
      return { s, m, rho, H, rise, eta, dpHx, e, W };
    };
    return {
      id: c.comp.id, type: 'cdu', nEq: 7, vars: V(si, so, pi, po),
      eval(x, S, r, o) {
        const q = calc(x);
        r[o] = (x[si.m] - x[so.m]) / sm;
        r[o + 1] = (x[so.P] - x[si.P] - q.rise + q.dpHx) / SP;
        r[o + 2] = (x[si.P] - n('p_tank')) / SP;
        r[o + 3] = (n('hold_s') * (x[so.h] - S.prev[so.h]) * S.invDt - q.m * (x[si.h] - x[so.h]) + q.e.Q - q.W) / se;
        r[o + 4] = (x[pi.m] - x[po.m]) / sm;
        r[o + 5] = (x[pi.P] - x[po.P] - n('dp_p0') * (x[pi.m] / n('m_p0')) * Math.pow(Math.max(Math.abs(x[pi.m]) / n('m_p0'), 0.05), 0.85)) / SP;
        r[o + 6] = (n('hold_p') * (x[po.h] - S.prev[po.h]) * S.invDt - x[pi.m] * (x[pi.h] - x[po.h]) - q.e.Q) / se;
      },
      tele(x): Telemetry {
        const q = calc(x);
        return { mdot: q.m, mdot_cold: x[pi.m], Q: q.e.Q, eps: q.e.eps, NTU: q.e.NTU, W_shaft: q.m * q.rise / q.rho / q.eta, eta: q.eta, speed: n('speed_pct'), head_m: q.H,
          T_hot_in: fs.T(x[si.P], x[si.h]), T_hot_out: fs.T(x[so.P], x[so.h]), T_cold_in: fp.T(x[pi.P], x[pi.h]), T_cold_out: fp.T(x[po.P], x[po.h]), P_in: x[si.P], P_out: x[so.P], dP: x[so.P] - x[si.P],
          T_in: fs.T(x[si.P], x[si.h]), T_out: fs.T(x[so.P], x[so.h]), T_surf: 0.5 * (fs.T(x[so.P], x[so.h]) + fp.T(x[po.P], x[po.h])) + 1, approach: fs.T(x[so.P], x[so.h]) - fp.T(x[pi.P], x[pi.h]), flow_m3h: q.m / q.rho * 3600 };
      },
    };
  },
  init(c) { const s = c.p.m_rated as number * 0.9, p = c.p.m_p0 as number; c.set('sec_in', { P: c.p.p_tank as number, m: s }); c.set('sec_out', { m: s }); c.set('pri_in', { m: p }); c.set('pri_out', { m: p }); },
};

const chillerSpec: CompSpec = {
  type: 'chiller', label: 'Industrial Chiller', category: 'datacenter', desc: 'Packaged water chiller: capacity-limited leaving-water control, Carnot-fraction COP, condenser heat rejection = Qe + W.', passes: 2, defaultFluids: ['water', 'water'],
  footprint: [3.6, 2.1, 1.5],
  params: [fluidParam('water', 'fluid', 'Chilled-water fluid'), fluidParam('water', 'fluid2', 'Condenser-water fluid'), bool('on', 'Chiller enabled', true), num('cap_kw', 'Cooling capacity', 'kW', 700, 10, 20000, 10, 'Performance'),
    num('t_set', 'Leaving chilled-water set-point', '°C', 18, 4, 40, 0.5, 'Performance'), num('eta2', 'Second-law efficiency (Carnot fraction)', '-', 0.55, 0.2, 0.8, 0.01, 'Performance'),
    num('dTe', 'Evaporator approach', 'K', 3, 1, 10, 0.5, 'Performance'), num('dTc', 'Condenser approach', 'K', 4, 1, 12, 0.5, 'Performance'),
    num('m_e0', 'Chilled water rated flow', 'kg/s', 8, 0.1, 400, 0.1, 'Hydraulics'), num('dp_e0', 'Evaporator ΔP @ rated', 'kPa', 60, 1, 300, 1, 'Hydraulics'),
    num('m_c0', 'Condenser water rated flow', 'kg/s', 12, 0.1, 600, 0.1, 'Hydraulics'), num('dp_c0', 'Condenser ΔP @ rated', 'kPa', 50, 1, 300, 1, 'Hydraulics'),
    num('hold_e', 'Evaporator hold-up (water + shell)', 'kg', 250, 5, 10000, 5, 'Thermal'), num('hold_c', 'Condenser hold-up (water + shell)', 'kg', 250, 5, 10000, 5, 'Thermal')],
  ports: () => [port('chw_in', 'Chilled water return', 'in', 0, [-1.4, 2.1, 0.45], UP, 100), port('chw_out', 'Chilled water supply', 'out', 0, [-0.9, 2.1, 0.45], UP, 100),
    port('cw_in', 'Condenser water in', 'in', 1, [0.9, 2.1, 0.45], UP, 125), port('cw_out', 'Condenser water out', 'out', 1, [1.4, 2.1, 0.45], UP, 125)],
  build(c) {
    const ei = c.node('chw_in'), eo = c.node('chw_out'), ci = c.node('cw_in'), co = c.node('cw_out');
    const fe = c.fluid(0), fc = c.fluid(1), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number;
    const calc = (x: Float64Array) => {
      const on = c.p.on ? 1 : 0;
      const Tset = tK(n('t_set'));
      const dem = smoothPos(Math.abs(x[ei.m]) * (x[ei.h] - fe.hPT(x[ei.P], Tset)), 0.5);
      const Qe = on * (dem - smoothPos(dem - n('cap_kw'), 0.02 * n('cap_kw'))); // holds the set-point exactly until the capacity limit
      const Te = Tset - n('dTe'), Tc = fc.T(x[co.P], x[co.h]) + n('dTc');
      const lift = smoothPos(Tc - Te - 5, 0.5) + 5;
      const COP = clamp(n('eta2') * Te / lift, 1.5, 15);
      const W = Qe / COP;
      return { Qe, W, COP, Qc: Qe + W, Te, Tc };
    };
    return {
      id: c.comp.id, type: 'chiller', nEq: 6, vars: V(ei, eo, ci, co),
      eval(x, S, r, o) {
        const q = calc(x);
        r[o] = (x[ei.m] - x[eo.m]) / sm;
        r[o + 1] = (x[ei.P] - x[eo.P] - n('dp_e0') * (x[ei.m] / n('m_e0')) * Math.pow(Math.max(Math.abs(x[ei.m]) / n('m_e0'), 0.05), 0.85)) / SP;
        r[o + 2] = (n('hold_e') * (x[eo.h] - S.prev[eo.h]) * S.invDt - x[ei.m] * (x[ei.h] - x[eo.h]) + q.Qe) / se;
        r[o + 3] = (x[ci.m] - x[co.m]) / sm;
        r[o + 4] = (x[ci.P] - x[co.P] - n('dp_c0') * (x[ci.m] / n('m_c0')) * Math.pow(Math.max(Math.abs(x[ci.m]) / n('m_c0'), 0.05), 0.85)) / SP;
        r[o + 5] = (n('hold_c') * (x[co.h] - S.prev[co.h]) * S.invDt - x[ci.m] * (x[ci.h] - x[co.h]) - q.Qc) / se;
      },
      tele(x): Telemetry {
        const q = calc(x);
        return { mdot: x[ei.m], mdot_cold: x[ci.m], Q_evap: q.Qe, Q_cond: q.Qc, W_comp: q.W, COP: q.COP, load_pct: q.Qe / n('cap_kw') * 100, T_evap: q.Te, T_cond: q.Tc,
          T_hot_in: fe.T(x[ei.P], x[ei.h]), T_hot_out: fe.T(x[eo.P], x[eo.h]), T_cold_in: fc.T(x[ci.P], x[ci.h]), T_cold_out: fc.T(x[co.P], x[co.h]), P_in: x[ei.P], P_out: x[eo.P], dP: x[ei.P] - x[eo.P],
          T_in: fe.T(x[ei.P], x[ei.h]), T_out: fe.T(x[eo.P], x[eo.h]), T_surf: 0.5 * (fe.T(x[eo.P], x[eo.h]) + fc.T(x[co.P], x[co.h])) };
      },
    };
  },
  init(c) { const e = c.p.m_e0 as number, k = c.p.m_c0 as number; c.set('chw_in', { m: e }); c.set('chw_out', { m: e }); c.set('cw_in', { m: k }); c.set('cw_out', { m: k }); },
};

/* =============================================================================================== */
/*  COOLING TOWER                                                                                  */
/* =============================================================================================== */
const towerSpec: CompSpec = {
  type: 'cooling_tower', label: 'Induced-Draft Cooling Tower', category: 'datacenter', desc: 'Counter-flow wet tower: effectiveness vs wet-bulb (NTU ∝ fan^0.6·flow^-0.4). Basin fixes the loop pressure.', passes: 1, defaultFluids: ['water'],
  footprint: [3.2, 3.6, 3.2],
  params: [fluidParam('water'), num('fan_pct', 'Fan speed', '%', 100, 0, 100, 1, 'Fan'), num('fan_kw', 'Fan power @100 %', 'kW', 15, 0.5, 300, 0.5, 'Fan'),
    num('eps_d', 'Design effectiveness (range/(Twater_in − Twb))', '-', 0.55, 0.2, 0.9, 0.01, 'Thermal'), num('m_d', 'Design water flow', 'kg/s', 12, 0.1, 600, 0.1, 'Hydraulics'),
    num('dp0', 'Spray + fill ΔP @ design', 'kPa', 30, 1, 200, 1, 'Hydraulics'), num('lift', 'Static lift to distribution deck', 'm', 5, 0, 30, 0.1, 'Hydraulics'), num('p_basin', 'Basin outlet pressure (abs)', 'kPa', 125, 101.325, 300, 1, 'Hydraulics'),
    num('hold_kg', 'Basin + fill water inventory', 'kg', 2500, 50, 100000, 50, 'Thermal')],
  ports: () => [port('in', 'Hot water in', 'in', 0, [1.6, 3.0, 0], [1, 0, 0], 125), port('out', 'Cold water out', 'out', 0, [1.6, 0.45, 0.8], [1, 0, 0], 125)],
  build(c) {
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number;
    const calc = (x: Float64Array, S: StepCtx) => {
      const m = 0.5 * (x[a.m] + x[b.m]), fan = Math.max(n('fan_pct') / 100, 0.02);
      const NTU0 = -Math.log(1 - n('eps_d'));
      const NTU = NTU0 * Math.pow(fan, 0.6) * Math.pow(Math.max(Math.abs(m), 1e-3) / n('m_d'), -0.4);
      const eps = 1 - Math.exp(-NTU);
      const Tin = f.T(x[a.P], x[a.h]), cp = f.cp(x[a.P], x[a.h]);
      const Q = eps * m * cp * (Tin - S.amb.Twb);
      const rho = f.rho(x[a.P], x[a.h]);
      const dp = n('dp0') * (m / n('m_d')) * Math.pow(Math.max(Math.abs(m) / n('m_d'), 0.05), 0.85) + rho * G * n('lift') / 1000;
      return { m, eps, Q, dp, Tin, NTU };
    };
    return {
      id: c.comp.id, type: 'cooling_tower', nEq: 4, vars: V(a, b),
      eval(x, S, r, o) {
        const q = calc(x, S);
        r[o] = (x[a.m] - x[b.m]) / sm;
        r[o + 1] = (x[a.P] - x[b.P] - q.dp) / SP;
        r[o + 2] = (x[b.P] - n('p_basin')) / SP;
        r[o + 3] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - q.m * (x[a.h] - x[b.h]) + q.Q) / se;
      },
      tele(x, S): Telemetry {
        const q = calc(x, S); const Tout = f.T(x[b.P], x[b.h]);
        return { mdot: q.m, Q_rej: q.Q, eps: q.eps, NTU: q.NTU, T_in: q.Tin, T_out: Tout, T_wb: S.amb.Twb, approach: Tout - S.amb.Twb, range: q.Tin - Tout, P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P],
          fan_kw: n('fan_kw') * Math.pow(n('fan_pct') / 100, 3), makeup_kgs: q.Q / 2430, T_surf: 0.5 * (q.Tin + Tout) - 2 };
      },
    };
  },
  init(c) { const m = c.p.m_d as number; c.set('in', { m }); c.set('out', { m, P: c.p.p_basin as number }); },
};

/* =============================================================================================== */
/*  BOILER                                                                                         */
/* =============================================================================================== */
const boilerSpec: CompSpec = {
  type: 'boiler', label: 'Boiler / Heat Source', category: 'cycle', desc: 'Fired boiler / superheater with metal wall thermal mass, distributed marching heat transfer, over-temperature fuel trip.', passes: 1, defaultFluids: ['water'],
  footprint: [3.2, 3.2, 2.0],
  params: [fluidParam('water'), num('q_kw', 'Fuel heat input (heat load)', 'kW', 6500, 1, 200000, 50, 'Heat'), num('eff', 'Combustion/boiler efficiency', '-', 0.92, 0.3, 1, 0.01, 'Heat'),
    num('UA', 'Wall-to-fluid UA', 'kW/K', 700, 5, 20000, 5, 'Heat'), num('Cw', 'Metal thermal mass', 'kJ/K', 3000, 10, 200000, 50, 'Thermal'), num('hold_kg', 'Water/steam inventory', 'kg', 300, 1, 20000, 5, 'Thermal'),
    num('m_d', 'Design flow (for ΔP)', 'kg/s', 2, 0.01, 500, 0.05, 'Hydraulics'), num('dp0', 'Gas-water ΔP @ design', 'kPa', 150, 0, 2000, 5, 'Hydraulics'), num('t_trip', 'Wall over-temperature trip', '°C', 700, 100, 1200, 10, 'Protection'),
    num('p_d', 'Initial pressure guess', 'kPa', 6000, 100, 16000, 100, 'Initial guess'), num('t_guess', 'Initial outlet temperature guess', '°C', 480, 20, 800, 5, 'Initial guess')],
  ports: () => [port('in', 'Feedwater in', 'in', 0, [-0.7, 3.2, 0], UP, 80), port('out', 'Steam out', 'out', 0, [0.7, 3.2, 0], UP, 100)],
  build(c) {
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0), w = c.wall(c.initT('out') + 45), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number;
    const calc = (x: Float64Array) => {
      const m = 0.5 * (x[a.m] + x[b.m]), Tw = x[w], Pm = 0.5 * (x[a.P] + x[b.P]);
      const trip = 1 / (1 + Math.exp((Tw - tK(n('t_trip'))) / 6));
      const Qin = n('q_kw') * n('eff') * trip;
      const hX = marchWall(f, Pm, x[a.h], m, Tw, n('UA'), 14);
      return { m, Tw, trip, Qin, hX, Qwf: m * (hX - x[a.h]), dp: n('dp0') * (m / n('m_d')) * Math.abs(m / n('m_d')) };
    };
    return {
      id: c.comp.id, type: 'boiler', nEq: 4, vars: [...V(a, b), w],
      eval(x, S, r, o) {
        const q = calc(x);
        r[o] = (x[a.m] - x[b.m]) / sm;
        r[o + 1] = (x[a.P] - x[b.P] - q.dp) / SP;
        r[o + 2] = (n('Cw') * (x[w] - S.prev[w]) * S.invDt - q.Qin + q.Qwf) / se;
        r[o + 3] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - q.m * (x[a.h] - x[b.h]) - q.Qwf) / se;
      },
      tele(x): Telemetry {
        const q = calc(x); const Tout = f.T(x[b.P], x[b.h]);
        return { mdot: q.m, Q_fluid: q.m * (x[b.h] - x[a.h]), Q_fuel: q.Qin, T_wall: q.Tw, T_in: f.T(x[a.P], x[a.h]), T_out: Tout, P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P], x_out: f.x(x[b.P], x[b.h]),
          superheat: Math.max(0, Tout - f.Tsat(x[b.P])), trip_pct: (1 - q.trip) * 100, T_surf: q.Tw - 40 };
      },
    };
  },
  init(c) {
    const f = c.fluid(0), Pd = c.p.p_d as number, m = c.p.m_d as number;
    c.set('in', { P: Pd + (c.p.dp0 as number), h: f.hPT(Pd, tK(40)), m }); c.set('out', { P: Pd, h: f.hPT(Pd, tK(c.p.t_guess as number)), m });
  },
};

/* =============================================================================================== */
/*  CONDENSER / EVAPORATOR (refrigerant or steam side + boundary secondary)                        */
/* =============================================================================================== */
const condenserSpec: CompSpec = {
  type: 'condenser', label: 'Condenser', category: 'cycle', desc: 'Shell-and-tube/air-cooled condenser: refrigerant/steam side + external sink (T, capacity rate). Closure: exit = saturated/sub-cooled liquid.', passes: 1, defaultFluids: ['r134a'],
  footprint: [3.2, 1.3, 1.1],
  params: [fluidParam('r134a'), num('UA', 'Overall UA', 'kW/K', 45, 0.5, 20000, 0.5, 'Heat transfer'), num('t_sink', 'Sink inlet temperature', '°C', 30, -20, 60, 0.5, 'Sink'), num('C_sink', 'Sink capacity rate (ṁ·cp)', 'kW/K', 30, 0.1, 5000, 0.5, 'Sink'),
    bool('closure', 'Pressure closure: leaves saturated liquid', true, 'Closure'), num('subcool', 'Target sub-cooling', 'K', 2, 0, 20, 0.5, 'Closure'),
    num('m_d', 'Design flow (for ΔP)', 'kg/s', 0.5, 0.01, 500, 0.01, 'Hydraulics'), num('dp0', 'ΔP @ design', 'kPa', 15, 0, 300, 1, 'Hydraulics'), num('hold_kg', 'Refrigerant hold-up', 'kg', 25, 0.5, 5000, 0.5, 'Thermal')],
  ports: () => [port('in', 'Vapour inlet', 'in', 0, [-1.1, 1.3, 0], UP, 50), port('out', 'Liquid outlet', 'out', 0, [1.1, 1.3, 0], UP, 40)],
  build(c) {
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number; const closure = !!c.p.closure;
    const ex = (x: Float64Array) => exchangerFC(f, x[a.P], x[a.h], Math.abs(0.5 * (x[a.m] + x[b.m])), tK(n('t_sink')), n('C_sink'), n('UA'));
    return {
      id: c.comp.id, type: 'condenser', nEq: closure ? 4 : 3, vars: V(a, b),
      eval(x, S, r, o) {
        const e = ex(x), m = 0.5 * (x[a.m] + x[b.m]);
        r[o] = (x[a.m] - x[b.m]) / sm;
        r[o + 1] = (x[a.P] - x[b.P] - n('dp0') * (m / n('m_d')) * Math.abs(m / n('m_d'))) / SP;
        r[o + 2] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - m * (x[a.h] - x[b.h]) - e.Q) / se;
        if (closure) r[o + 3] = (x[b.h] - f.hPT(x[b.P], f.Tsat(x[b.P]) - n('subcool'))) / SH;
      },
      tele(x): Telemetry {
        const e = ex(x); const Ts = f.Tsat(x[b.P]); const Tout = f.T(x[b.P], x[b.h]);
        return { mdot: x[a.m], Q_cond: -e.Q, eps: e.eps, NTU: e.NTU, T_sat: Ts, T_cond: Ts, T_in: f.T(x[a.P], x[a.h]), T_out: Tout, subcooling: Math.max(0, Ts - Tout), x_out: f.x(x[b.P], x[b.h]), P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P],
          T_sink_out: n('t_sink') + 273.15 - e.Q / n('C_sink'), T_surf: 0.5 * (Ts + n('t_sink') + 273.15) };
      },
    };
  },
  init(c) {
    const f = c.fluid(0); const Pc = f.Psat(tK(c.p.t_sink as number) + 12);
    c.set('in', { P: Pc + 5, m: c.p.m_d as number }); c.set('out', { P: Pc, h: f.hf(Pc), m: c.p.m_d as number });
  },
};

const evaporatorSpec: CompSpec = {
  type: 'evaporator', label: 'Evaporator', category: 'cycle', desc: 'Direct-expansion/flooded evaporator with external heat source (T, capacity rate). Superheat is a result of the energy balance.', passes: 1, defaultFluids: ['r134a'],
  footprint: [2.6, 1.1, 0.95],
  params: [fluidParam('r134a'), num('UA', 'Overall UA', 'kW/K', 30, 0.5, 20000, 0.5, 'Heat transfer'), num('t_src', 'Heat-source inlet temperature (load water)', '°C', 12, -20, 60, 0.5, 'Source'),
    num('C_src', 'Source capacity rate (ṁ·cp)', 'kW/K', 10, 0.1, 5000, 0.5, 'Source'), num('m_d', 'Design flow (for ΔP)', 'kg/s', 0.5, 0.01, 500, 0.01, 'Hydraulics'), num('dp0', 'ΔP @ design', 'kPa', 10, 0, 300, 1, 'Hydraulics'),
    num('hold_kg', 'Refrigerant hold-up', 'kg', 10, 0.5, 5000, 0.5, 'Thermal')],
  ports: () => [port('in', 'Two-phase inlet', 'in', 0, [-0.9, 1.1, 0], UP, 40), port('out', 'Vapour outlet', 'out', 0, [0.9, 1.1, 0], UP, 50)],
  build(c) {
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number;
    const ex = (x: Float64Array) => exchangerFC(f, x[a.P], x[a.h], Math.abs(0.5 * (x[a.m] + x[b.m])), tK(n('t_src')), n('C_src'), n('UA'));
    return {
      id: c.comp.id, type: 'evaporator', nEq: 3, vars: V(a, b),
      eval(x, S, r, o) {
        const e = ex(x), m = 0.5 * (x[a.m] + x[b.m]);
        r[o] = (x[a.m] - x[b.m]) / sm;
        r[o + 1] = (x[a.P] - x[b.P] - n('dp0') * (m / n('m_d')) * Math.abs(m / n('m_d'))) / SP;
        r[o + 2] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - m * (x[a.h] - x[b.h]) - e.Q) / se;
      },
      tele(x): Telemetry {
        const e = ex(x); const Ts = f.Tsat(x[b.P]); const Tout = f.T(x[b.P], x[b.h]);
        return { mdot: x[a.m], Q_evap: e.Q, eps: e.eps, NTU: e.NTU, T_sat: Ts, T_evap: Ts, T_in: f.T(x[a.P], x[a.h]), T_out: Tout, superheat: f.phase(x[b.P], x[b.h]) === 'vapor' ? Tout - Ts : 0, x_out: f.x(x[b.P], x[b.h]),
          P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P], T_src_out: n('t_src') + 273.15 - e.Q / n('C_src'), T_surf: 0.5 * (Ts + n('t_src') + 273.15) - 2 };
      },
    };
  },
  init(c) {
    const f = c.fluid(0); const Pe = f.Psat(tK(c.p.t_src as number) - 8);
    c.set('in', { P: Pe + 5, m: c.p.m_d as number }); c.set('out', { P: Pe, h: f.hPT(Pe, f.Tsat(Pe) + 4), m: c.p.m_d as number });
  },
};

/* =============================================================================================== */
/*  COMPRESSORS                                                                                    */
/* =============================================================================================== */
function compressorSpec(kind: 'centrifugal' | 'recip'): CompSpec {
  const cen = kind === 'centrifugal';
  return {
    type: cen ? 'compressor_centrifugal' : 'compressor_recip', label: cen ? 'Centrifugal Compressor' : 'Reciprocating Compressor', category: 'cycle',
    desc: cen ? 'Centrifugal compressor: isentropic-head vs flow curve (affinity), isentropic efficiency, or fixed pressure ratio.' : 'Reciprocating compressor: volumetric flow (displacement, clearance η_v), isentropic efficiency, or fixed pressure ratio.',
    passes: 1, defaultFluids: ['r134a'], footprint: cen ? [1.8, 1.2, 1.0] : [1.5, 1.1, 0.9],
    params: [fluidParam('r134a'), num('speed_pct', 'Speed', '%', 100, 10, 120, 1), sel('mode', 'Pressure law', 'native', [{ value: 'native', label: cen ? 'Head–flow curve' : 'Volumetric displacement' }, { value: 'ratio', label: 'Fixed pressure ratio' }]),
      num('pr', 'Pressure ratio (ratio mode)', '-', 4, 1.05, 40, 0.05), num('eta_is', 'Isentropic efficiency', '-', 0.75, 0.3, 0.95, 0.01),
      ...(cen ? [num('Hs_d', 'Design isentropic head', 'kJ/kg', 25, 1, 600, 0.5, 'Curve'), num('m_d', 'Design mass flow', 'kg/s', 0.5, 0.01, 200, 0.01, 'Curve')]
        : [num('Vdisp', 'Swept volume @100 % speed', 'm³/h', 120, 1, 5000, 1, 'Displacement'), num('clr', 'Clearance volume ratio', '-', 0.05, 0.01, 0.15, 0.005, 'Displacement'), num('npoly', 'Polytropic index', '-', 1.15, 1.0, 1.6, 0.01, 'Displacement')]),
      num('hold_kg', 'Thermal inertia (kg-eq)', 'kg', 3, 0.1, 200, 0.5, 'Thermal'), num('t_evap', 'Initial guess: evaporating T', '°C', 5, -40, 60, 1, 'Initial guess'), num('t_cond', 'Initial guess: condensing T', '°C', 42, 10, 120, 1, 'Initial guess')],
    ports: () => [port('in', 'Suction', 'in', 0, [-0.55, 1.15, 0], UP, 65), port('out', 'Discharge', 'out', 0, [0.55, 1.15, 0], UP, 50)],
    build(c) {
      const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
      const n = (k: string) => c.p[k] as number; const ratio = c.p.mode === 'ratio';
      const eta = () => n('eta_is');
      const calc = (x: Float64Array) => {
        const m = 0.5 * (x[a.m] + x[b.m]), s = n('speed_pct') / 100;
        const W = m * (hCompressed(f, x[a.P], x[a.h], x[b.P], eta()) - x[a.h]);
        return { m, s, W };
      };
      return {
        id: c.comp.id, type: c.comp.type, nEq: 3, vars: V(a, b),
        eval(x, S, r, o) {
          const q = calc(x);
          r[o] = (x[a.m] - x[b.m]) / sm;
          if (ratio) r[o + 1] = (x[b.P] - n('pr') * x[a.P]) / (SP * 5);
          else if (cen) {
            const Hs = 1.3 * n('Hs_d') * q.s * q.s - 0.3 * n('Hs_d') * (q.m / n('m_d')) ** 2;
            r[o + 1] = (f.hPs(x[b.P], f.s(x[a.P], x[a.h])) - x[a.h] - Hs) / SH;
          } else {
            const rho = f.rho(x[a.P], x[a.h]); const PR = Math.max(x[b.P] / x[a.P], 1);
            const ev = Math.max(1 - n('clr') * (Math.pow(PR, 1 / n('npoly')) - 1), 0.1);
            r[o + 1] = (q.m - rho * n('Vdisp') / 3600 * q.s * ev) / sm;
          }
          r[o + 2] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - q.m * (x[a.h] - x[b.h]) - q.W) / se;
        },
        tele(x, S): Telemetry {
          const q = calc(x); const Tin = f.T(x[a.P], x[a.h]), Tout = f.T(x[b.P], x[b.h]);
          return { mdot: q.m, W_shaft: q.W, PR: x[b.P] / x[a.P], eta: eta(), speed: n('speed_pct'), P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P], T_in: Tin, T_out: Tout, T_surf: S.amb.T + 0.55 * (Tout - S.amb.T),
            vol_flow_m3h: q.m / f.rho(x[a.P], x[a.h]) * 3600, T_sat_in: f.Tsat(x[a.P]), T_sat_out: f.Tsat(x[b.P]), discharge_superheat: Tout - f.Tsat(x[b.P]) };
        },
      };
    },
    init(c) {
      const f = c.fluid(0); const Pe = f.Psat(tK(c.p.t_evap as number)), Pc = f.Psat(tK(c.p.t_cond as number));
      const h1 = f.hPT(Pe, f.Tsat(Pe) + 5); const h2 = hCompressed(f, Pe, h1, Pc, c.p.eta_is as number);
      const m = cen ? (c.p.m_d as number) : f.rho(Pe, h1) * (c.p.Vdisp as number) / 3600 * 0.8;
      c.set('in', { P: Pe, h: h1, m }); c.set('out', { P: Pc, h: h2, m });
    },
  };
}

/* =============================================================================================== */
/*  TURBINES                                                                                       */
/* =============================================================================================== */
function turbineSpec(kind: 'steam' | 'gas'): CompSpec {
  const steam = kind === 'steam';
  return {
    type: steam ? 'steam_turbine' : 'gas_turbine', label: steam ? 'Steam Turbine' : 'Gas Turbine', category: 'cycle',
    desc: 'Axial turbine: isentropic expansion with efficiency, speed correction and wetness penalty; Stodola flow law or fixed expansion ratio; generator.', passes: 1, defaultFluids: [steam ? 'water' : 'air'],
    footprint: [2.6, 1.3, 1.1],
    params: [fluidParam(steam ? 'water' : 'air'), num('eta_is', 'Design isentropic efficiency', '-', 0.85, 0.4, 0.95, 0.01), num('rpm', 'Shaft speed', 'RPM', 3000, 500, 20000, 10), num('rpm_d', 'Design speed', 'RPM', 3000, 500, 20000, 10),
      sel('mode', 'Flow law', steam ? 'stodola' : 'ratio', [{ value: 'stodola', label: 'Stodola (swallowing capacity)' }, { value: 'ratio', label: 'Fixed expansion ratio' }]),
      num('pr', 'Expansion ratio (ratio mode)', '-', 4, 1.05, 60, 0.05), num('gen_eff', 'Generator efficiency', '-', 0.97, 0.8, 0.995, 0.005),
      num('m_d', 'Design mass flow', 'kg/s', 2, 0.01, 2000, 0.05, 'Swallowing capacity'), num('p_in_d', 'Design inlet pressure', 'kPa', 6000, 100, 16000, 50, 'Swallowing capacity'), num('p_out_d', 'Design outlet pressure', 'kPa', 8, 1, 3000, 0.5, 'Swallowing capacity'),
      num('T_d', 'Design inlet temperature', '°C', steam ? 480 : 900, 100, 1300, 5, 'Swallowing capacity'), num('hold_kg', 'Thermal inertia (kg-eq)', 'kg', 8, 0.1, 500, 0.5, 'Thermal')],
    ports: () => [port('in', 'Inlet (HP)', 'in', 0, [-0.7, 1.3, 0], UP, 100), port('out', 'Exhaust', 'out', 0, [0.8, 1.3, 0], UP, 250)],
    build(c) {
      const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
      const n = (k: string) => c.p[k] as number; const ratio = c.p.mode === 'ratio';
      const K = n('m_d') / Math.sqrt(n('p_in_d') ** 2 - n('p_out_d') ** 2);
      const calc = (x: Float64Array) => {
        const m = 0.5 * (x[a.m] + x[b.m]);
        const ex = hExpanded(f, x[a.P], x[a.h], x[b.P], 1);
        const nu = n('rpm') / n('rpm_d');
        const speedF = Math.max(0.3, 1 - 1.5 * (nu - 1) ** 2);
        const wet = steam ? 1 - 0.2 * (1 - ex.x2s) : 1;
        const eta = clamp(n('eta_is') * speedF * wet, 0.1, 0.95);
        const h2 = x[a.h] - eta * (x[a.h] - ex.h2s);
        return { m, eta, h2, W: m * (x[a.h] - h2), x2s: ex.x2s };
      };
      return {
        id: c.comp.id, type: c.comp.type, nEq: 3, vars: V(a, b),
        eval(x, S, r, o) {
          const q = calc(x);
          r[o] = (x[a.m] - x[b.m]) / sm;
          if (ratio) r[o + 1] = (x[a.P] - n('pr') * x[b.P]) / (SP * 5);
          else {
            const Ti = f.T(x[a.P], x[a.h]);
            r[o + 1] = (q.m - K * Math.sqrt(Math.max(x[a.P] ** 2 - x[b.P] ** 2, 1) ) * Math.sqrt(tK(n('T_d')) / Ti)) / sm;
          }
          r[o + 2] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - q.m * (x[a.h] - x[b.h]) + q.W) / se;
        },
        tele(x, S): Telemetry {
          const q = calc(x); const Tin = f.T(x[a.P], x[a.h]), Tout = f.T(x[b.P], x[b.h]);
          return { mdot: q.m, W_shaft: q.W, W_elec: q.W * n('gen_eff'), PR: x[a.P] / x[b.P], eta: q.eta, rpm: n('rpm'), freq_Hz: n('rpm') / 60, x_out: f.x(x[b.P], x[b.h]), P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P],
            T_in: Tin, T_out: Tout, T_surf: S.amb.T + 0.6 * (0.5 * (Tin + Tout) - S.amb.T) };
        },
      };
    },
    init(c) {
      const f = c.fluid(0);
      const Pi = c.p.p_in_d as number, Po = c.p.p_out_d as number, h1 = f.hPT(Pi, tK(c.p.T_d as number));
      const h2 = hExpanded(f, Pi, h1, Po, c.p.eta_is as number).h2;
      c.set('in', { P: Pi, h: h1, m: c.p.m_d as number }); c.set('out', { P: Po, h: h2, m: c.p.m_d as number });
    },
  };
}

/* =============================================================================================== */
/*  ADDITIONAL EQUIPMENT                                                                           */
/* =============================================================================================== */
const shellTubeSpec: CompSpec = {
  ...plateSpec, type: 'shell_tube_hx', label: 'מחליף חום מעטפת-צינורות', category: 'hx',
  desc: 'Shell-and-tube heat exchanger (counter-flow ε-NTU). Shell side = hot, tube side = cold.', defaultFluids: ['water', 'water'], footprint: [3.1, 1.3, 1.0],
  params: plateSpec.params.map((p) => (p.key === 'fluid' ? { ...p, def: 'water' } : p.key === 'UA' ? { ...p, def: 80 } : p.key.startsWith('hold') ? { ...p, def: 150 } : p.key.startsWith('dp') ? { ...p, def: 30 } : p)),
  ports: () => [port('hot_in', 'Hot inlet', 'in', 0, [-0.85, 1.3, 0], UP, 100), port('hot_out', 'Hot outlet', 'out', 0, [0.85, 1.3, 0], UP, 100),
    port('cold_in', 'Cold inlet', 'in', 1, [-1.3, 0.75, 0.5], [0, 0, 1], 80), port('cold_out', 'Cold outlet', 'out', 1, [1.3, 0.75, 0.5], [0, 0, 1], 80)],
};

/** finned air coil: dry cooler (rejects to ambient dry-bulb) or CRAH/fan-coil (absorbs room heat) */
function airCoilSpec(kind: 'dry' | 'crah'): CompSpec {
  const dry = kind === 'dry';
  return {
    type: dry ? 'dry_cooler' : 'crah', label: dry ? 'מקרר יבש (Dry Cooler)' : 'יחידת מיזוג חדר מחשבים (CRAH)', category: dry ? 'hx' : 'heat',
    desc: dry ? 'Air-cooled fluid cooler: finned coil + axial fans, ε-NTU against ambient dry-bulb air.' : 'Computer-room air handler: chilled-water coil cools the room return air (sensible load).',
    passes: 1, defaultFluids: [dry ? 'glycol30' : 'water'], footprint: dry ? [4.2, 1.5, 1.5] : [1.8, 2.1, 0.9],
    params: [fluidParam(dry ? 'glycol30' : 'water'), num('fan_pct', 'Fan speed', '%', 100, 5, 110, 1, 'Fan'), num('fan_kw', 'Fan power @100 %', 'kW', dry ? 8 : 4, 0.1, 200, 0.1, 'Fan'),
      num('UA', 'Coil UA @100 % fan', 'kW/K', dry ? 14 : 9, 0.5, 5000, 0.5, 'Heat transfer'), num('C_air', 'Air capacity rate @100 % fan (ṁ·cp)', 'kW/K', dry ? 40 : 10, 0.5, 5000, 0.5, 'Heat transfer'),
      ...(dry ? [] : [num('t_air', 'Room return-air temperature', '°C', 35, 15, 60, 0.5, 'Air side')]),
      num('m_d', 'Design flow (for ΔP)', 'kg/s', dry ? 8 : 3, 0.05, 500, 0.05, 'Hydraulics'), num('dp0', 'ΔP @ design', 'kPa', dry ? 45 : 35, 1, 300, 1, 'Hydraulics'), num('hold_kg', 'Coil hold-up (fluid + fins)', 'kg', dry ? 180 : 60, 1, 5000, 1, 'Thermal')],
    ports: () => dry ? [port('in', 'Inlet', 'in', 0, [-1.9, 1.1, 0.55], [0, 0, 1], 80), port('out', 'Outlet', 'out', 0, [-1.9, 0.45, 0.55], [0, 0, 1], 80)]
      : [port('in', 'Chilled-water inlet', 'in', 0, [-0.5, 2.1, -0.2], UP, 50), port('out', 'Chilled-water outlet', 'out', 0, [-0.2, 2.1, -0.2], UP, 50)],
    build(c) {
      const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
      const n = (k: string) => c.p[k] as number;
      const calc = (x: Float64Array, Tamb: number) => {
        const s = Math.max(n('fan_pct') / 100, 0.03), Tair = dry ? Tamb : tK(n('t_air')), Cair = n('C_air') * s, UA = n('UA') * Math.pow(s, 0.45);
        const e = exchangerFC(f, x[a.P], x[a.h], Math.abs(0.5 * (x[a.m] + x[b.m])), Tair, Cair, UA);
        return { e, Tair, Cair, s };
      };
      return {
        id: c.comp.id, type: c.comp.type, nEq: 3, vars: V(a, b),
        eval(x, S, r, o) {
          const q = calc(x, S.amb.T), m = 0.5 * (x[a.m] + x[b.m]);
          r[o] = (x[a.m] - x[b.m]) / sm;
          r[o + 1] = (x[a.P] - x[b.P] - n('dp0') * (m / n('m_d')) * Math.abs(m / n('m_d'))) / SP;
          r[o + 2] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - m * (x[a.h] - x[b.h]) - q.e.Q) / se;
        },
        tele(x, S): Telemetry {
          const q = calc(x, S.amb.T); const Tin = f.T(x[a.P], x[a.h]), Tout = f.T(x[b.P], x[b.h]);
          const base = { mdot: x[a.m], eps: q.e.eps, NTU: q.e.NTU, T_in: Tin, T_out: Tout, P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P], fan_kw: n('fan_kw') * q.s ** 3, speed: n('fan_pct') };
          return dry ? { ...base, Q_rej: -q.e.Q, approach: Tout - S.amb.T, T_surf: 0.5 * (Tin + Tout) }
            : { ...base, Q: q.e.Q, T_src_out: q.Tair - q.e.Q / q.Cair, T_surf: S.amb.T + 1 };
        },
      };
    },
    init(c) { c.set('in', { m: c.p.m_d as number }); c.set('out', { m: c.p.m_d as number }); },
  };
}

const bufferTankSpec: CompSpec = {
  type: 'buffer_tank', label: 'מיכל אגירה (Buffer Tank)', category: 'piping', desc: 'Stratification-free buffer / thermal-storage tank: large well-mixed volume with heat loss to ambient.', passes: 1, defaultFluids: ['water'],
  footprint: [1.3, 2.3, 1.3],
  params: [fluidParam('water'), num('hold_kg', 'Stored mass (≈ volume in litres)', 'kg', 2000, 50, 200000, 50, 'Thermal'), num('UA_loss', 'Shell heat-loss UA', 'kW/K', 0.04, 0, 5, 0.01, 'Thermal'),
    num('m_d', 'Design flow (for ΔP)', 'kg/s', 10, 0.05, 500, 0.05, 'Hydraulics'), num('dp0', 'ΔP @ design', 'kPa', 4, 0.1, 100, 0.1, 'Hydraulics')],
  ports: () => [port('in', 'Inlet (top)', 'in', 0, [-0.35, 2.3, 0], UP, 80), port('out', 'Outlet (bottom)', 'out', 0, [0.66, 0.35, 0], [1, 0, 0], 80)],
  build(c) {
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0), sm = c.mRef, se = c.mRef * 20;
    const n = (k: string) => c.p[k] as number;
    return {
      id: c.comp.id, type: 'buffer_tank', nEq: 3, vars: V(a, b),
      eval(x, S, r, o) {
        const m = 0.5 * (x[a.m] + x[b.m]);
        r[o] = (x[a.m] - x[b.m]) / sm;
        r[o + 1] = (x[a.P] - x[b.P] - n('dp0') * (m / n('m_d')) * Math.abs(m / n('m_d'))) / SP;
        r[o + 2] = (n('hold_kg') * (x[b.h] - S.prev[b.h]) * S.invDt - m * (x[a.h] - x[b.h]) + n('UA_loss') * (f.T(x[b.P], x[b.h]) - S.amb.T)) / se;
      },
      tele(x, S): Telemetry {
        const Tin = f.T(x[a.P], x[a.h]), Tout = f.T(x[b.P], x[b.h]);
        return { mdot: x[a.m], T_in: Tin, T_out: Tout, P_in: x[a.P], P_out: x[b.P], dP: x[a.P] - x[b.P], Q_loss: n('UA_loss') * (Tout - S.amb.T), T_surf: S.amb.T + 0.85 * (Tout - S.amb.T) };
      },
    };
  },
  init(c) { c.set('in', { m: c.p.m_d as number }); c.set('out', { m: c.p.m_d as number }); },
};

const recip0 = compressorSpec('recip');
const airCompSpec: CompSpec = {
  ...recip0, type: 'air_compressor', label: 'מדחס אוויר', category: 'machines', desc: 'Reciprocating air compressor on a receiver: volumetric displacement or fixed pressure ratio, isentropic efficiency.',
  defaultFluids: ['air'], footprint: [1.9, 1.55, 0.9],
  params: [...recip0.params.filter((p) => p.key !== 't_evap' && p.key !== 't_cond').map((p) => (p.key === 'fluid' ? { ...p, def: 'air' } : p.key === 'Vdisp' ? { ...p, def: 400 } : p.key === 'pr' ? { ...p, def: 8 } : p.key === 'npoly' ? { ...p, def: 1.3 } : p)),
    bool('ac_on', 'Built-in aftercooler', true, 'Aftercooler'), num('ac_app', 'Aftercooler approach to ambient', 'K', 10, 2, 60, 0.5, 'Aftercooler'),
    num('p_suct', 'Initial guess: suction pressure', 'kPa', 101.325, 20, 2000, 1, 'Initial guess')],
  build(c) {
    const el = recip0.build(c); if (!c.p.ac_on) return el;
    const a = c.node('in'), b = c.node('out'), f = c.fluid(0); const app = () => c.p.ac_app as number;
    const ev = el.eval.bind(el), te = el.tele.bind(el);
    return {
      ...el,
      eval(x, S, r, o) { ev(x, S, r, o); r[o + 2] = (x[b.h] - f.hPT(x[b.P], S.amb.T + app())) / SH; },
      tele(x, S) {
        const t = te(x, S); const m = 0.5 * (x[a.m] + x[b.m]); const h2 = hCompressed(f, x[a.P], x[a.h], x[b.P], c.p.eta_is as number);
        return { ...t, W_shaft: m * (h2 - x[a.h]), T_dis: f.T(x[b.P], h2), Q_rej: m * (h2 - x[b.h]), T_surf: S.amb.T + 0.5 * (f.T(x[b.P], h2) - S.amb.T) };
      },
    };
  },
  ports: () => [port('in', 'Air intake', 'in', 0, [-0.45, 1.55, 0], UP, 50), port('out', 'Receiver outlet', 'out', 0, [0.95, 0.45, 0], [1, 0, 0], 40)],
  init(c) {
    const f = c.fluid(0); const Pe = c.p.p_suct as number, Pc = Pe * 6; const h1 = f.hPT(Pe, 298.15), h2 = hCompressed(f, Pe, h1, Pc, c.p.eta_is as number);
    const m = f.rho(Pe, h1) * (c.p.Vdisp as number) / 3600 * 0.8; c.set('in', { P: Pe, h: h1, m }); c.set('out', { P: Pc, h: h2, m });
  },
};

/* ---- architecture (no physics) ---- */
const archSpec = (type: string, label: string, desc: string, params: ParamDef[], fp: (p: Params) => [number, number, number]): CompSpec => ({
  type, label, desc, category: 'room', passes: 0, defaultFluids: [], params, arch: true, fp, ports: () => [],
  footprint: fp(Object.fromEntries(params.map((d) => [d.key, d.def]))), build: () => { throw new Error('architectural element'); },
});
const wallOp = num('op', 'Wall opacity', '%', 100, 10, 100, 5, 'Appearance');
const wallFinish = sel('finish', 'Wall finish', 'paint', [{ value: 'paint', label: 'Painted plaster' }, { value: 'concrete', label: 'Exposed concrete' }, { value: 'block', label: 'Concrete block' }, { value: 'panel', label: 'Insulated panel (clean room)' }, { value: 'glass', label: 'Glass partition' }], 'Appearance');
const autoHide = bool('autohide', 'Auto-fade walls facing the camera', true, 'Appearance');
const ARCH: CompSpec[] = [
  archSpec('room', 'חדר (קירות + דלת)', 'Room shell: four walls, optional door, raised floor and suspended ceiling.', [
    num('W', 'Inner width (X)', 'm', 10, 2, 60, 0.1, 'Dimensions'), num('D', 'Inner depth (Z)', 'm', 7, 2, 60, 0.1, 'Dimensions'), num('H', 'Wall height', 'm', 3.4, 2, 12, 0.1, 'Dimensions'),
    num('t', 'Room wall thickness', 'm', 0.2, 0.05, 0.6, 0.01, 'Dimensions'), bool('door', 'Door', true, 'Openings'), sel('door_side', 'Door wall', 'front', [{ value: 'front', label: 'Front (+Z)' }, { value: 'back', label: 'Back (−Z)' }, { value: 'left', label: 'Left (−X)' }, { value: 'right', label: 'Right (+X)' }], 'Openings'), num('door_w', 'Door width', 'm', 1.2, 0.7, 4, 0.05, 'Openings'), num('door_h', 'Door height', 'm', 2.2, 1.8, 4, 0.05, 'Openings'), num('rf', 'Raised-floor height (0 = none)', 'm', 0, 0, 1.5, 0.05, 'Floor'),
    bool('ceil', 'Suspended ceiling', false, 'Ceiling'), num('ch', 'Ceiling height', 'm', 3.0, 1.8, 12, 0.05, 'Ceiling'), wallFinish, wallOp, autoHide], (p) => [(p.W as number) + 2 * (p.t as number), p.H as number, (p.D as number) + 2 * (p.t as number)]),
  archSpec('wall', 'קיר', 'Free-standing wall segment.', [num('L', 'Length', 'm', 4, 0.2, 60, 0.1, 'Dimensions'), num('H', 'Height', 'm', 3.2, 0.3, 12, 0.1, 'Dimensions'), num('t', 'Thickness', 'm', 0.2, 0.05, 0.8, 0.01, 'Dimensions'), wallFinish, wallOp, autoHide],
    (p) => [p.L as number, p.H as number, p.t as number]),
  archSpec('raised_floor', 'רצפה צפה (מוגבהת)', 'Raised access floor: 600×600 tiles on adjustable pedestals; equipment placed on it sits on the tiles.', [
    num('W', 'Width (X)', 'm', 6, 0.6, 60, 0.6, 'Dimensions'), num('D', 'Depth (Z)', 'm', 4.8, 0.6, 60, 0.6, 'Dimensions'), num('H', 'Floor height', 'm', 0.6, 0.15, 1.5, 0.05, 'Dimensions'),
    bool('perf', 'Perforated cold-aisle tiles', true, 'Appearance')], (p) => [p.W as number, p.H as number, p.D as number]),
  archSpec('ceiling', 'תקרה אקוסטית', 'Suspended T-bar ceiling with 600×600 panels and LED troffers.', [
    num('W', 'Width (X)', 'm', 6, 0.6, 60, 0.6, 'Dimensions'), num('D', 'Depth (Z)', 'm', 4.8, 0.6, 60, 0.6, 'Dimensions'), num('H', 'Ceiling height', 'm', 3.0, 1.8, 12, 0.05, 'Dimensions'), wallOp],
    (p) => [p.W as number, (p.H as number) + 0.06, p.D as number]),
  archSpec('column', 'עמוד', 'Structural column.', [num('W', 'Section size', 'm', 0.5, 0.1, 2, 0.05, 'Dimensions'), num('H', 'Height', 'm', 3.4, 0.5, 15, 0.1, 'Dimensions')], (p) => [p.W as number, p.H as number, p.W as number]),
];

/* =============================================================================================== */
/*  REGISTRY                                                                                       */
/* =============================================================================================== */
const spools = (type: string, label: string, desc: string) => pipeSpec(type, label, desc, 'instrument', 100, [0.5, 0.6, 0.35], [], true);

export const SPECS: Record<string, CompSpec> = {};
const reg = (s: CompSpec) => { SPECS[s.type] = s; };
[
  pipeSpec('pipe', 'Parametric Pipe', 'Darcy-Weisbach pipe with roughness, insulation, wall thermal mass and ambient heat exchange. Flanges + bolts auto-generated.', 'piping', 100, [1, 0.2, 0.2], [
    sel('style', 'Routing style', 'ortho', [{ value: 'ortho', label: 'Orthogonal (90° elbows)' }, { value: 'direct', label: 'Direct (any-angle bends)' }], 'Route'),
    bool('flip', 'Swap horizontal leg order (X↔Z)', false, 'Route'), num('elev', 'Extra route elevation', 'm', 0, -3, 10, 0.05, 'Route')]),
  valveSpec, spools('flow_meter', 'Flow Meter', 'Inline Coriolis/electromagnetic flow meter spool.'), spools('pressure_sensor', 'Pressure Transducer', 'Inline pressure transducer spool with gauge.'), spools('temp_sensor', 'Temperature Sensor', 'Inline RTD thermowell spool.'),
  manifoldSpec(true), manifoldSpec(false), tankSpec, pumpSpec, rackSpec, cduSpec, plateSpec, chillerSpec, towerSpec,
  boilerSpec, turbineSpec('steam'), turbineSpec('gas'), condenserSpec, evaporatorSpec, expValveSpec, compressorSpec('centrifugal'), compressorSpec('recip'),
  pipeSpec('check_valve', 'שסתום אל-חוזר', 'Swing check valve (modelled as a local loss in the flow direction).', 'piping', 100, [0.5, 0.6, 0.35], [], true),
  pipeSpec('strainer', 'מסנן Y', 'Y-strainer with removable screen (local loss).', 'piping', 100, [0.6, 0.6, 0.45], [], true),
  shellTubeSpec, airCoilSpec('dry'), airCoilSpec('crah'), bufferTankSpec, airCompSpec, ...ARCH,
].forEach(reg);
for (const [t, k] of [['check_valve', 2.0], ['strainer', 2.8]] as const) SPECS[t].params = SPECS[t].params.map((p) => (p.key === 'K' ? { ...p, def: k } : p.key === 'L_m' ? { ...p, def: 0.5 } : p));
/** catalogue grouping (by function) */
const CAT_OF: Record<string, CompSpec['category']> = {
  rack: 'heat', boiler: 'heat', crah: 'heat',
  plate_hx: 'hx', shell_tube_hx: 'hx', cdu: 'hx', chiller: 'hx', cooling_tower: 'hx', dry_cooler: 'hx', condenser: 'hx', evaporator: 'hx',
  pump: 'machines', compressor_recip: 'machines', compressor_centrifugal: 'machines', air_compressor: 'machines', steam_turbine: 'machines', gas_turbine: 'machines',
  pipe: 'piping', valve: 'piping', check_valve: 'piping', strainer: 'piping', expansion_valve: 'piping', manifold_split: 'piping', manifold_merge: 'piping', exp_tank: 'piping', buffer_tank: 'piping',
  flow_meter: 'instrument', pressure_sensor: 'instrument', temp_sensor: 'instrument',
};
for (const s of Object.values(SPECS)) if (CAT_OF[s.type]) s.category = CAT_OF[s.type];
/** which working fluids make physical sense for each equipment type (a water pump cannot pump air, a cooling tower only works with water…) */
const LIQ = ['water', 'glycol30', 'pg25'], REF = ['r134a', 'r410a'];
const FLUIDS_OF: Record<string, string[] | [string[], string[]]> = {
  pump: LIQ, rack: LIQ, cdu: [LIQ, ['water', 'glycol30', 'pg25']], plate_hx: [[...LIQ, ...REF], [...LIQ, ...REF]], shell_tube_hx: [[...LIQ, ...REF], LIQ], chiller: [LIQ, LIQ],
  cooling_tower: ['water'], dry_cooler: LIQ, crah: LIQ, buffer_tank: LIQ, exp_tank: LIQ, manifold_split: LIQ, manifold_merge: LIQ,
  boiler: ['water'], steam_turbine: ['water'], gas_turbine: ['air'], condenser: [...REF, 'water'], evaporator: REF, expansion_valve: REF,
  compressor_recip: [...REF, 'air'], compressor_centrifugal: [...REF, 'air'], air_compressor: ['air'],
};
for (const [t, allow] of Object.entries(FLUIDS_OF)) {
  const spec = SPECS[t]; if (!spec) continue; const pair = Array.isArray(allow[0]) ? (allow as [string[], string[]]) : [allow as string[], allow as string[]];
  spec.params = spec.params.map((p) => (p.key === 'fluid' || p.key === 'fluid2') && p.options ? { ...p, options: p.options.filter((o) => pair[p.key === 'fluid' ? 0 : 1].includes(String(o.value))) } : p);
}
export const footprintOf = (c: { type: string; params: Params }): [number, number, number] => { const s = SPECS[c.type]; return s.fp ? s.fp(c.params) : s.footprint; };

export const specOf = (type: string): CompSpec => SPECS[type];
export function defaultParams(type: string): Params {
  const p: Params = {}; for (const d of SPECS[type].params) p[d.key] = d.def; return p;
}
export const CATEGORIES: { id: CompSpec['category']; label: string }[] = [
  { id: 'heat', label: 'Heat sources & loads' }, { id: 'hx', label: 'Heat exchange & rejection' }, { id: 'machines', label: 'Pumps, compressors & turbines' },
  { id: 'piping', label: 'Piping, valves & vessels' }, { id: 'instrument', label: 'Instrumentation' }, { id: 'room', label: 'Room & building' },
];
export type { FluidModel };
