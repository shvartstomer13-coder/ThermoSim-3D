/** Placement geometry: world-space ports and orthogonal pipe routing (shared by physics auto-parameters and the renderer). */
import type { CompInstance, PortDef } from './engineTypes';
import { SPECS } from './components';

export type V3 = [number, number, number];
export interface WPort { pos: V3; dir: V3; def: PortDef }

export function rotY(v: V3, a: number): V3 { const c = Math.cos(a), s = Math.sin(a); return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c]; }
export function portsOf(comp: CompInstance): PortDef[] { return SPECS[comp.type].ports(comp.params); }
export function worldPort(comp: CompInstance, def: PortDef): WPort {
  const p = rotY(def.pos, comp.rotY), d = rotY(def.dir, comp.rotY);
  return { pos: [comp.pos[0] + p[0], comp.pos[1] + p[1], comp.pos[2] + p[2]], dir: d, def };
}
export function findPort(comps: Map<string, CompInstance> | CompInstance[], ref: { comp: string; port: string }): WPort | null {
  const c = Array.isArray(comps) ? comps.find((x) => x.id === ref.comp) : comps.get(ref.comp);
  if (!c) return null; const d = portsOf(c).find((p) => p.id === ref.port); return d ? worldPort(c, d) : null;
}
const add = (a: V3, b: V3, k = 1): V3 => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const eq = (a: V3, b: V3) => Math.abs(a[0] - b[0]) < 1e-4 && Math.abs(a[1] - b[1]) < 1e-4 && Math.abs(a[2] - b[2]) < 1e-4;
function hashN(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

/** Orthogonal route with stubs along port normals. `seed` de-conflicts parallel pipes. */
export interface RouteOpt { via?: V3[]; style?: string; flip?: boolean; elev?: number }
/** orthogonal connection P -> Q: climb to the higher level, run horizontally (X then Z, or Z then X), then drop */
function ortho(P: V3, Q: V3, out: V3[], zFirst: boolean) {
  const y = Math.max(P[1], Q[1]);
  out.push([P[0], y, P[2]]);
  out.push(zFirst ? [P[0], y, Q[2]] : [Q[0], y, P[2]]);
  out.push([Q[0], y, Q[2]], Q);
}
function clean(pts: V3[]): V3[] {
  const out: V3[] = [];
  for (const p of pts) if (!out.length || !eq(out[out.length - 1], p)) out.push(p);
  const res: V3[] = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const p = res[res.length - 1], q = out[i], r = out[i + 1];
    const d1: V3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], d2: V3 = [r[0] - q[0], r[1] - q[1], r[2] - q[2]];
    const cr = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]];
    if (Math.hypot(cr[0], cr[1], cr[2]) > 1e-6) res.push(q);
  }
  if (out.length > 1) res.push(out[out.length - 1]);
  return res;
}
export function routePipe(a: WPort, b: WPort, Do: number, seed = '', opt: RouteOpt = {}): V3[] {
  const stub = Math.max(0.35, 3.2 * Do), hs = hashN(seed);
  const A1 = add(a.pos, a.dir, stub), B1 = add(b.pos, b.dir, stub);
  const elev = opt.elev ?? 0;
  if (opt.via && opt.via.length) {
    const ctrl: V3[] = [A1, ...opt.via, B1];
    if (opt.style === 'direct') return clean([a.pos, ...ctrl, b.pos]);
    const pts: V3[] = [a.pos, A1];
    for (let i = 0; i < ctrl.length - 1; i++) ortho(ctrl[i], ctrl[i + 1], pts, !!opt.flip);
    pts.push(b.pos); return clean(pts);
  }
  if (opt.style === 'direct') return clean([a.pos, A1, B1, b.pos]);
  const anyUp = a.dir[1] > 0.5 || b.dir[1] > 0.5;
  let yL = Math.max(A1[1], B1[1]) + (anyUp ? 0.25 + 0.18 * (hs % 4) : 0);
  if (!anyUp && Math.abs(A1[1] - B1[1]) < 0.05) yL = A1[1];
  yL += elev;
  const xFirst = ((hs & 4) === 0) !== !!opt.flip;
  const pts: V3[] = [a.pos, A1];
  pts.push([A1[0], yL, A1[2]]);
  if (xFirst) { pts.push([B1[0], yL, A1[2]]); } else { pts.push([A1[0], yL, B1[2]]); }
  pts.push([B1[0], yL, B1[2]], B1, b.pos);
  const out: V3[] = [];
  for (const p of pts) if (!out.length || !eq(out[out.length - 1], p)) out.push(p);
  // drop collinear points
  const res: V3[] = [out[0]];
  for (let i = 1; i < out.length - 1; i++) {
    const p = res[res.length - 1], q = out[i], r = out[i + 1];
    const d1: V3 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]], d2: V3 = [r[0] - q[0], r[1] - q[1], r[2] - q[2]];
    const cr = [d1[1] * d2[2] - d1[2] * d2[1], d1[2] * d2[0] - d1[0] * d2[2], d1[0] * d2[1] - d1[1] * d2[0]];
    if (Math.hypot(cr[0], cr[1], cr[2]) > 1e-6) res.push(q);
  }
  res.push(out[out.length - 1]);
  return res;
}
export function polyLen(p: V3[]) { let L = 0; for (let i = 1; i < p.length; i++) L += Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1], p[i][2] - p[i - 1][2]); return L; }

/** Recompute auto parameters (length, elevation, minor loss) of a pipe from its route. */
export function updatePipeAuto(pipe: CompInstance, comps: Map<string, CompInstance>) {
  if (pipe.type !== 'pipe' || !pipe.from || !pipe.to) return;
  const a = findPort(comps, pipe.from), b = findPort(comps, pipe.to);
  if (!a || !b) return;
  const Do = ((pipe.params.D_mm as number) + 2 * (pipe.params.wall_mm as number)) / 1000;
  const pts = routePipe(a, b, Do, pipe.id, routeOpt(pipe));
  const L = polyLen(pts) + 0.0;
  pipe.params.L_m = Math.max(0.2, +L.toFixed(2));
  pipe.params.dz = +(b.pos[1] - a.pos[1]).toFixed(2);
  pipe.params.K = +(0.3 * Math.max(pts.length - 2, 0) + 0.5).toFixed(2);
}
export const routeOpt = (pipe: CompInstance): RouteOpt => ({ via: pipe.via ?? undefined, style: (pipe.params.style as string) ?? 'ortho', flip: !!pipe.params.flip, elev: (pipe.params.elev as number) ?? 0 });
