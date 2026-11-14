/** Mutable simulation runtime (kept outside React/zustand). All scene edits go through here. */
import type { CompInstance, PortRef } from './physics/engineTypes';
import { Simulation, type SceneData } from './physics/physicsEngine';
import { emptyScene, TEMPLATES } from './physics/templates';
import { SPECS, defaultParams, footprintOf } from './physics/components';
import { findPort, portsOf, routeOpt, routePipe, updatePipeAuto, worldPort } from './physics/geometry';
import { useUI, type SuggestItem } from './store';
import { tr } from './ui/he';

export const rt = { sim: new Simulation(emptyScene()), acc: 0, lastMs: 0, msPerStep: 0, geoRev: 0 };
export const scene = (): SceneData => rt.sim.scene;
export const compMap = () => new Map(rt.sim.scene.comps.map((c) => [c.id, c]));
export const getComp = (id: string) => rt.sim.scene.comps.find((c) => c.id === id);

/** parameters that change the equation structure => full recompile */
const STRUCT = new Set(['mode', 'closure', 'n', 'fluid', 'fluid2', 'char', 'on']);

export function rebuild(opt: { preserve?: boolean; steady?: boolean } = { preserve: true, steady: false }) {
  const sc = rt.sim.scene; const m = compMap();
  for (const c of sc.comps) if (c.type === 'pipe') updatePipeAuto(c, m);
  rt.geoRev++;
  const t0 = performance.now();
  rt.sim.rebuild(sc, opt);
  rt.msPerStep = performance.now() - t0;
  useUI.getState().bump();
}
export function loadTemplate(id: string, record = true) {
  const t = TEMPLATES.find((x) => x.id === id); if (!t) return;
  if (record && rt.sim.scene.comps.length) commit();
  rt.sim = new Simulation(t.build()); rt.sim.time = 0;
  useUI.setState({ selected: null, pipeStart: null, tool: 'select', placeType: null, templateId: id, suggest: null });
  useUI.getState().bump(); useUI.getState().notify('נטען תרחיש: ' + t.name);
  return t;
}
export function clearScene() { if (rt.sim.scene.comps.length) commit(); rt.sim = new Simulation(emptyScene()); useUI.setState({ selected: null, templateId: null, tool: 'select', suggest: null }); useUI.getState().bump(); }

function uniqueId(type: string) {
  const ids = new Set(rt.sim.scene.comps.map((c) => c.id)); let i = 1; while (ids.has(`${type}_${i}`)) i++; return `${type}_${i}`;
}
export function addComponent(type: string, pos: [number, number, number], rotY = 0, over: Record<string, number | string | boolean> = {}): CompInstance {
  commit();
  const id = uniqueId(type), spec = SPECS[type];
  const n = rt.sim.scene.comps.filter((c) => c.type === type).length + 1;
  const c: CompInstance = { id, type, name: `${tr(spec.label)} ${n}`, pos, rotY, params: { ...defaultParams(type), ...over } };
  rt.sim.scene.comps.push(c);
  rebuild({ preserve: true, steady: false });
  return c;
}
export function removeComponent(id: string) {
  commit();
  const sc = rt.sim.scene;
  const dead = new Set([id]);
  for (const c of sc.comps) if (c.type === 'pipe' && (c.from?.comp === id || c.to?.comp === id)) dead.add(c.id);
  sc.comps = sc.comps.filter((c) => !dead.has(c.id));
  sc.links = sc.links.filter((l) => !dead.has(l.a.comp) && !dead.has(l.b.comp));
  useUI.setState({ selected: null, suggest: null });
  rebuild({ preserve: true, steady: false });
}
export function addPipe(a: PortRef, b: PortRef, via?: [number, number, number][], record = true) {
  const m = compMap(); const ca = m.get(a.comp)!, cb = m.get(b.comp)!;
  const pa = portsOf(ca).find((p) => p.id === a.port)!, pb = portsOf(cb).find((p) => p.id === b.port)!;
  let from = a, to = b, dA = pa, dB = pb;
  if (pa.kind === 'in' && pb.kind === 'out') { from = b; to = a; dA = pb; dB = pa; }
  else if (pa.kind === pb.kind && pa.kind !== 'ref') { useUI.getState().notify('חברו יציאה לכניסה'); return null; }
  if (record) commit();
  const flipped = from !== a;
  const fluidKey = (c: CompInstance, d: typeof dA) => (d.pass === 1 ? 'fluid2' : 'fluid');
  const src = from.comp === a.comp ? ca : cb, srcDef = dA;
  const fluid = (src.params[fluidKey(src, srcDef)] ?? src.params.fluid ?? 'water') as string;
  const id = uniqueId('pipe');
  const dn = Math.max(10, Math.min(dA.dn, dB.dn));
  const pipe: CompInstance = { id, type: 'pipe', name: 'צינור ' + id.replace('pipe_', ''), pos: [0, 0, 0], rotY: 0, params: { ...defaultParams('pipe'), fluid, D_mm: dn }, from, to, via: via?.length ? (flipped ? [...via].reverse() : via) : undefined };
  rt.sim.scene.comps.push(pipe);
  rebuild({ preserve: true, steady: false });
  return pipe;
}
export function setParam(id: string, key: string, v: number | string | boolean) {
  const c = getComp(id); if (!c) return;
  commit('p:' + id + ':' + key);
  c.params[key] = v; rt.geoRev++;
  const def = SPECS[c.type]?.params.find((p) => p.key === key);
  if (STRUCT.has(key) || def?.kind === 'select' || ['D_mm', 'wall_mm', 'ins_mm'].includes(key)) {
    if (key === 'n') { // drop pipes attached to vanished ports
      const ports = new Set(portsOf(c).map((p) => p.id));
      rt.sim.scene.comps = rt.sim.scene.comps.filter((x) => !(x.type === 'pipe' && ((x.from?.comp === id && !ports.has(x.from.port)) || (x.to?.comp === id && !ports.has(x.to.port)))));
    }
    rebuild({ preserve: true, steady: false });
  } else useUI.setState((u) => ({ tick: u.tick + 1 }));
}
/** propagate a fluid choice along the hydraulic loop the component belongs to */
export function applyFluidToLoop(id: string, pass = 0) {
  commit();
  const sc = rt.sim.scene, m = compMap(), fluid = (m.get(id)!.params[pass === 1 ? 'fluid2' : 'fluid']) as string;
  const seen = new Set<string>(); const q: { comp: string; pass: number }[] = [{ comp: id, pass }];
  const adj = (comp: string, pass: number) => {
    const out: { comp: string; pass: number }[] = [];
    for (const c of sc.comps) if (c.type === 'pipe') {
      if (c.from?.comp === comp && portsOf(m.get(comp)!).find((p) => p.id === c.from!.port)?.pass === pass) out.push({ comp: c.id, pass: 0 }), out.push({ comp: c.to!.comp, pass: portsOf(m.get(c.to!.comp)!).find((p) => p.id === c.to!.port)?.pass ?? 0 });
      if (c.to?.comp === comp && portsOf(m.get(comp)!).find((p) => p.id === c.to!.port)?.pass === pass) out.push({ comp: c.id, pass: 0 }), out.push({ comp: c.from!.comp, pass: portsOf(m.get(c.from!.comp)!).find((p) => p.id === c.from!.port)?.pass ?? 0 });
      if (c.id === comp) { out.push({ comp: c.from!.comp, pass: portsOf(m.get(c.from!.comp)!).find((p) => p.id === c.from!.port)?.pass ?? 0 }); out.push({ comp: c.to!.comp, pass: portsOf(m.get(c.to!.comp)!).find((p) => p.id === c.to!.port)?.pass ?? 0 }); }
    }
    return out;
  };
  while (q.length) {
    const cur = q.pop()!, k = cur.comp + '#' + cur.pass; if (seen.has(k)) continue; seen.add(k);
    const c = m.get(cur.comp); if (!c) continue;
    if (c.params[cur.pass === 1 ? 'fluid2' : 'fluid'] !== undefined) c.params[cur.pass === 1 ? 'fluid2' : 'fluid'] = fluid;
    for (const n of adj(cur.comp, cur.pass)) q.push(n);
  }
  rebuild({ preserve: false, steady: true });
}
export function moveComponent(id: string, pos: [number, number, number], rotY?: number) {
  const c = getComp(id); if (!c) return; c.pos = pos; if (rotY !== undefined) c.rotY = rotY; rt.geoRev++;
}
/** nearest compatible foreign port (opposite facing, in<->out) for port-snapping; returns translation delta */
export function snapPorts(c: CompInstance, maxDist = 0.5): { delta: [number, number, number]; a: PortRef; b: PortRef } | null {
  let best: { d: number; delta: [number, number, number]; a: PortRef; b: PortRef } | null = null;
  const mine = portsOf(c).filter((p) => p.kind !== 'ref').map((p) => ({ p, w: worldPort(c, p) }));
  for (const o of rt.sim.scene.comps) {
    if (o.id === c.id || o.type === 'pipe') continue;
    for (const dp of portsOf(o)) {
      if (dp.kind === 'ref') continue; const wo = worldPort(o, dp);
      for (const { p, w } of mine) {
        if (p.kind === dp.kind) continue;
        const dot = w.dir[0] * wo.dir[0] + w.dir[1] * wo.dir[1] + w.dir[2] * wo.dir[2]; if (dot > -0.7) continue;
        const dx = wo.pos[0] - w.pos[0], dy = wo.pos[1] - w.pos[1], dz = wo.pos[2] - w.pos[2], d = Math.hypot(dx, dy, dz);
        if (d < maxDist && (!best || d < best.d)) best = { d, delta: [dx, dy, dz], a: { comp: c.id, port: p.id }, b: { comp: o.id, port: dp.id } };
      }
    }
  }
  return best;
}
export function addLink(a: PortRef, b: PortRef) {
  const sc = rt.sim.scene; const has = sc.links.some((l) => (l.a.comp === a.comp && l.a.port === a.port && l.b.comp === b.comp && l.b.port === b.port) || (l.a.comp === b.comp && l.a.port === b.port && l.b.comp === a.comp && l.b.port === a.port));
  if (!has) sc.links.push({ a, b });
}
/** pause-aware simulation driver; returns number of steps done */
export function advance(elapsedS: number, budgetMs = 10): number {
  const ui = useUI.getState(); if (!ui.running) return 0;
  const dtSim = ui.speed / ui.hz; rt.acc += elapsedS * ui.hz; let n = 0; const t0 = performance.now();
  rt.acc = Math.min(rt.acc, 6);
  while (rt.acc >= 1) {
    rt.sim.step(dtSim); rt.acc -= 1; n++;
    if (performance.now() - t0 > budgetMs) { rt.acc = 0; break; }
  }
  if (n) rt.msPerStep = (performance.now() - t0) / n;
  return n;
}
/* ---------------------------------------------------------------- connection suggestions ---- */
const dismissed = new Set<string>(); const pk = (a: PortRef, b: PortRef) => `${a.comp}:${a.port}>${b.comp}:${b.port}`;
function occupiedPorts() {
  const o = new Set<string>(); const sc = rt.sim.scene;
  for (const c of sc.comps) if (c.type === 'pipe') { if (c.from) o.add(c.from.comp + ':' + c.from.port); if (c.to) o.add(c.to.comp + ':' + c.to.port); }
  for (const l of sc.links) { o.add(l.a.comp + ':' + l.a.port); o.add(l.b.comp + ':' + l.b.port); } return o;
}
/** free ports of `id` matched to the nearest compatible free ports elsewhere (outlet -> inlet, same fluid), each port used once */
export function suggestFor(id: string, max = 4): SuggestItem[] {
  const c = getComp(id); if (!c || c.type === 'pipe') return [];
  const occ = occupiedPorts(); const fl = (x: CompInstance, pass?: number) => (x.params[pass === 1 ? 'fluid2' : 'fluid'] ?? x.params.fluid) as string | undefined;
  const mine = portsOf(c).filter((p) => p.kind !== 'ref' && !occ.has(c.id + ':' + p.id)); const cand: SuggestItem[] = [];
  for (const o of rt.sim.scene.comps) {
    if (o.id === c.id || o.type === 'pipe') continue;
    for (const q of portsOf(o)) {
      if (q.kind === 'ref' || occ.has(o.id + ':' + q.id)) continue; const wq = worldPort(o, q);
      for (const p of mine) {
        if (p.kind === q.kind) continue; const fa = fl(c, p.pass), fb = fl(o, q.pass); if (fa && fb && fa !== fb) continue;
        const wp = worldPort(c, p); const dist = Math.hypot(wq.pos[0] - wp.pos[0], wq.pos[1] - wp.pos[1], wq.pos[2] - wp.pos[2]); if (dist > 30) continue;
        const me = { comp: c.id, port: p.id }, ot = { comp: o.id, port: q.id }; const it = p.kind === 'out' ? { a: me, b: ot, dist } : { a: ot, b: me, dist };
        if (!dismissed.has(pk(it.a, it.b))) cand.push(it);
      }
    }
  }
  // no free port? offer to add a branch to a supply / return header of the same fluid
  for (const o of rt.sim.scene.comps) {
    const split = o.type === 'manifold_split'; if (!split && o.type !== 'manifold_merge') continue; if (o.id === c.id || Math.round(o.params.n as number) >= 8) continue;
    for (const p of mine) {
      if (p.kind !== (split ? 'in' : 'out')) continue; const fa = fl(c, p.pass), fb = fl(o); if (fa && fb && fa !== fb) continue;
      const wp = worldPort(c, p); const dist = Math.hypot(o.pos[0] - wp.pos[0], o.pos[1] + 0.3 - wp.pos[1], o.pos[2] - wp.pos[2]) + 1.5; if (dist > 30) continue;
      const me = { comp: c.id, port: p.id }, ot = { comp: o.id, port: '+' }; const it: SuggestItem = split ? { a: ot, b: me, dist, grow: o.id } : { a: me, b: ot, dist, grow: o.id };
      if (!dismissed.has(pk(it.a, it.b))) cand.push(it);
    }
  }
  cand.sort((x, y) => x.dist - y.dist); const used = new Set<string>(); const out: SuggestItem[] = [];
  for (const it of cand) { const ka = it.a.comp + ':' + it.a.port + (it.grow && it.a.port === '+' ? it.b.comp : ''), kb = it.b.comp + ':' + it.b.port + (it.grow && it.b.port === '+' ? it.a.comp : ''); if (used.has(ka) || used.has(kb)) continue; used.add(ka); used.add(kb); out.push(it); if (out.length >= max) break; }
  return out;
}
/** show the suggestion card for a component (after placing / moving it, or on demand) */
export function offerSuggestions(id: string, force = false) {
  if (force) for (const k of [...dismissed]) if (k.includes(id + ':')) dismissed.delete(k);
  const items = suggestFor(id); useUI.setState({ suggest: items.length ? { comp: id, items } : null });
  if (force && !items.length) useUI.getState().notify('לא נמצאו חיבורים מתאימים לרכיב זה');
}
export function acceptSuggestion(items: SuggestItem[]) {
  const s = useUI.getState().suggest; let n = 0; commit();
  for (const it of items) {
    let { a, b } = it;
    if (it.grow) { // add one branch to the header, then use the new (last) branch port
      const m = getComp(it.grow); if (!m) continue; const k = Math.round(m.params.n as number) + 1; if (k > 8) continue; m.params.n = k;
      if (a.port === '+') a = { comp: m.id, port: 'out' + k }; else b = { comp: m.id, port: 'in' + k };
    }
    if (addPipe(a, b, undefined, false)) n++;
  }
  if (n) useUI.getState().notify(n === 1 ? 'נוסף צינור מחבר' : `נוספו ${n} צינורות מחברים`);
  if (s) offerSuggestions(s.comp);
}
export function declineSuggestions() { const s = useUI.getState().suggest; if (s) for (const it of s.items) dismissed.add(pk(it.a, it.b)); useUI.setState({ suggest: null }); }
export function stepOnce() { const ui = useUI.getState(); rt.sim.step(ui.speed / ui.hz); }
export { findPort };

/* ---------------------------------------------------------------- undo / redo -------------------- */
interface Snap { json: string; sel: string | null }
const undoStack: Snap[] = [], redoStack: Snap[] = []; let lastTag = '', lastT = 0;
const snap = (): Snap => ({ json: JSON.stringify({ comps: rt.sim.scene.comps, links: rt.sim.scene.links, ambient: rt.sim.scene.ambient }), sel: useUI.getState().selected });
/** record the current scene before a change. Repeated changes with the same tag within 1 s merge into one step (slider drags, typing). */
export function commit(tag = '') {
  const now = performance.now(); if (tag && tag === lastTag && now - lastT < 1000) { lastT = now; return; }
  lastTag = tag; lastT = now; undoStack.push(snap()); if (undoStack.length > 150) undoStack.shift(); redoStack.length = 0; useUI.setState({ canUndo: true, canRedo: false });
}
function restore(sn: Snap) {
  const d = JSON.parse(sn.json); const sc = rt.sim.scene; sc.comps = d.comps; sc.links = d.links; sc.ambient = d.ambient;
  useUI.setState({ selected: sn.sel && sc.comps.some((c) => c.id === sn.sel) ? sn.sel : null, suggest: null, pipeStart: null, pipeVia: [] });
  rebuild({ preserve: true, steady: false });
}
export function undo() { const p = undoStack.pop(); if (!p) { useUI.getState().notify('אין פעולה לביטול'); return; } redoStack.push(snap()); lastTag = ''; restore(p); useUI.setState({ canUndo: undoStack.length > 0, canRedo: true }); useUI.getState().notify('בוטל צעד אחד'); }
export function redo() { const p = redoStack.pop(); if (!p) return; undoStack.push(snap()); lastTag = ''; restore(p); useUI.setState({ canUndo: true, canRedo: redoStack.length > 0 }); useUI.getState().notify('בוצע שוב'); }
export function resetHistory() { undoStack.length = 0; redoStack.length = 0; useUI.setState({ canUndo: false, canRedo: false }); }

/* ---------------------------------------------------------------- duplicate ----------------------- */
export function duplicate(id: string) {
  const c = getComp(id); if (!c || c.type === 'pipe') return null;
  commit();
  const fp = footprintOf(c), off = Math.max(1, Math.ceil((Math.min(fp[0], fp[2]) + 0.5) * 2) / 2); // step sideways (local X) by its width
  const dx = Math.cos(c.rotY) * (fp[0] + 0.5), dz = -Math.sin(c.rotY) * (fp[0] + 0.5); void off;
  const id2 = uniqueId(c.type); const base = c.name.replace(/ \(העתק( \d+)?\)$/, '');
  let k = 1; const names = new Set(rt.sim.scene.comps.map((x) => x.name)); let name = `${base} (העתק)`; while (names.has(name)) name = `${base} (העתק ${++k})`;
  const d: CompInstance = { ...JSON.parse(JSON.stringify(c)), id: id2, name, pos: [c.pos[0] + dx, c.pos[1], c.pos[2] + dz] };
  rt.sim.scene.comps.push(d); rebuild({ preserve: true, steady: false });
  useUI.setState({ selected: id2 }); useUI.getState().notify('הרכיב שוכפל'); return d;
}

/* ---------------------------------------------------------------- pipe route editing --------------- */
export function setVia(id: string, via: [number, number, number][] | undefined, tag = '') {
  const c = getComp(id); if (!c || c.type !== 'pipe') return; commit(tag ? 'via:' + id + tag : '');
  c.via = via && via.length ? via : undefined; rebuild({ preserve: true, steady: false });
}
/** current geometric route of a pipe (world points) */
export function pipeRoute(id: string): [number, number, number][] {
  const c = getComp(id); if (!c || !c.from || !c.to) return []; const m = compMap(); const a = findPort(m, c.from), b = findPort(m, c.to); if (!a || !b) return [];
  const Do = ((c.params.D_mm as number) + 2 * (c.params.wall_mm as number)) / 1000; return routePipe(a, b, Do, c.id, routeOpt(c));
}
/** insert a waypoint at the middle of the longest segment (or after the given index) */
export function addBend(id: string) {
  const c = getComp(id); if (!c) return; const r = pipeRoute(id); if (r.length < 2) return;
  let best = 1, L = -1; for (let i = 2; i < r.length - 1; i++) { const l = Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1], r[i][2] - r[i - 1][2]); if (l > L) { L = l; best = i; } }
  const mid: [number, number, number] = r.length > 3 ? [(r[best][0] + r[best - 1][0]) / 2, Math.max(r[best][1], r[best - 1][1]), (r[best][2] + r[best - 1][2]) / 2] : [(r[0][0] + r[r.length - 1][0]) / 2, Math.max(r[0][1], r[r.length - 1][1]) + 0.5, (r[0][2] + r[r.length - 1][2]) / 2];
  const via = c.via ? [...c.via] : r.slice(2, -2).map((p) => [...p] as [number, number, number]); // freeze the auto corners first
  // place the new point in route order: find the via index whose position along the route precedes the midpoint
  const along = (p: [number, number, number]) => { let s = 0, bestS = 0, bd = 1e9; for (let i = 1; i < r.length; i++) { const a = r[i - 1], b = r[i]; const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2 || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / l2)); const q = [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t]; const d = Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]); const l = Math.sqrt(l2); if (d < bd) { bd = d; bestS = s + t * l; } s += l; } return bestS; };
  via.push(mid); via.sort((p, q) => along(p) - along(q)); setVia(id, via);
}
export const snapV = (v: number) => { const s = useUI.getState().snap; return s > 0 ? Math.round(v / s) * s : v; };
export const fpOf = footprintOf;

/* ---------------------------------------------------------------- project save / load -------------- */
export interface Project { app: 'thermosim'; v: 1; name: string; scene: { comps: CompInstance[]; links: SceneData['links']; ambient: SceneData['ambient'] }; templateId: string | null; time: number;
  cam?: { pos: [number, number, number]; target: [number, number, number] }; ui?: Record<string, unknown> }
export function projectData(name: string, cam?: Project['cam']): Project {
  const u = useUI.getState();
  return { app: 'thermosim', v: 1, name, scene: JSON.parse(JSON.stringify({ comps: rt.sim.scene.comps, links: rt.sim.scene.links, ambient: rt.sim.scene.ambient })), templateId: u.templateId, time: rt.sim.time, cam,
    ui: { renderMode: u.renderMode, palette: u.palette, unit: u.unit, showLabels: u.showLabels, showPorts: u.showPorts, showFlow: u.showFlow, snap: u.snap, speed: u.speed, hz: u.hz, irAuto: u.irAuto, irMin: u.irMin, irMax: u.irMax } };
}
export function loadProject(p: Project) {
  if (!p || p.app !== 'thermosim' || !p.scene) throw new Error('bad project');
  const sc = { ...emptyScene(), ...p.scene } as SceneData;
  rt.sim = new Simulation(sc); rt.sim.time = p.time || 0; rt.geoRev++;
  useUI.setState({ ...(p.ui ?? {}), selected: null, pipeStart: null, pipeVia: [], tool: 'select', placeType: null, templateId: p.templateId ?? null, suggest: null, projectName: p.name || null } as never);
  resetHistory(); useUI.getState().bump();
}
