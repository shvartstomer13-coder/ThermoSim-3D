/** Parametric pipes: routed orthogonal path with rounded elbows, insulation jacket, flanges + bolt rings, supports,
 *  thermal gradient (uv.x) and a translucent animated flow indicator. */
import { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CompInstance } from '../physics/engineTypes';
import { findPort, polyLen, routeOpt, routePipe, type V3 } from '../physics/geometry';
import { rt, compMap } from '../runtime';
import { view } from './SceneView';
import { useUI } from '../store';
import { Box, Flange, flangeDims, Mat, ThermalProvider, type Ch } from './ProceduralComponents';
import { IR, makeFlowMaterial, paletteTexture } from './ThermalShader';

const FLUID_COLOR: Record<string, string> = { water: '#2c7a4b', glycol30: '#2a63b0', pg25: '#1e8a9a', r134a: '#d9a21b', r410a: '#d2601f', air: '#9aa4ad' };

export function roundedPath(pts: V3[], R: number): THREE.CurvePath<THREE.Vector3> {
  const path = new THREE.CurvePath<THREE.Vector3>(); const v = (p: V3) => new THREE.Vector3(...p);
  let cur = v(pts[0]);
  for (let i = 1; i < pts.length - 1; i++) {
    const p = v(pts[i]), a = v(pts[i - 1]), b = v(pts[i + 1]);
    const la = p.distanceTo(a), lb = p.distanceTo(b); const r = Math.min(R, la * 0.45, lb * 0.45);
    const p0 = p.clone().addScaledVector(a.clone().sub(p).normalize(), r), p1 = p.clone().addScaledVector(b.clone().sub(p).normalize(), r);
    if (cur.distanceTo(p0) > 1e-5) path.add(new THREE.LineCurve3(cur.clone(), p0));
    path.add(new THREE.QuadraticBezierCurve3(p0, p, p1)); cur = p1;
  }
  const last = v(pts[pts.length - 1]); if (cur.distanceTo(last) > 1e-5) path.add(new THREE.LineCurve3(cur.clone(), last));
  return path;
}

interface Built { pts: V3[]; len: number; tube: THREE.TubeGeometry; sleeve: THREE.TubeGeometry; hl: THREE.TubeGeometry; Ro: number; Ri: number; a: { pos: V3; dir: V3 }; b: { pos: V3; dir: V3 }; dnMm: number; ins: number }
function build(pipe: CompInstance): Built | null {
  const m = compMap(); if (!pipe.from || !pipe.to) return null;
  const a = findPort(m, pipe.from), b = findPort(m, pipe.to); if (!a || !b) return null;
  const D = pipe.params.D_mm as number, wall = pipe.params.wall_mm as number, ins = (pipe.params.ins_mm as number) / 1000;
  const Ro = (D / 2 + wall) / 1000, Do = 2 * Ro;
  const pts = routePipe(a, b, Do + 2 * ins, pipe.id, routeOpt(pipe)); const th = flangeDims(D).th;
  const off = (p: { pos: V3; dir: V3 }): V3 => [p.pos[0] + p.dir[0] * th, p.pos[1] + p.dir[1] * th, p.pos[2] + p.dir[2] * th];
  const pp: V3[] = pts.map((p) => p); pp[0] = off(a); pp[pp.length - 1] = off(b);
  const path = roundedPath(pp, Math.max(1.5 * (Do + 2 * ins), 0.12)); const len = Math.max(polyLen(pp), 0.1);
  const segs = Math.min(480, Math.max(24, Math.round(len * 18)));
  const mk = (r: number) => new THREE.TubeGeometry(path, segs, r, 20, false);
  return { pts: pp, len, tube: mk(Ro + ins), sleeve: mk((Ro + ins) * 1.14 + 0.004), hl: mk((Ro + ins) * 1.4 + 0.012), Ro, Ri: D / 2000, a, b, dnMm: D, ins };
}
const sigOf = (pipe: CompInstance) => {
  const m = compMap(); const a = pipe.from && findPort(m, pipe.from), b = pipe.to && findPort(m, pipe.to); if (!a || !b) return '';
  return [...a.pos, ...a.dir, ...b.pos, ...b.dir, pipe.params.D_mm, pipe.params.wall_mm, pipe.params.ins_mm, pipe.params.style, pipe.params.flip, pipe.params.elev, JSON.stringify(pipe.via ?? null)].map((x) => (typeof x === 'number' ? x.toFixed(3) : x)).join('|');
};

export function PipeView({ pipe }: { pipe: CompInstance }) {
  const [built, setBuilt] = useState<Built | null>(() => build(pipe));
  const sig = useRef(sigOf(pipe)); const th = useRef<Ch>({}); const rev = useRef(rt.geoRev);
  const flow = useMemo(() => makeFlowMaterial(), []); const phase = useRef(0);
  const sel = useUI((s) => s.selected === pipe.id); const mode = useUI((s) => s.renderMode); const showFlow = useUI((s) => s.showFlow); const tool = useUI((s) => s.tool);
  const [hover, setHover] = useState(false);
  useFrame((_, dt) => {
    if (rev.current !== rt.geoRev) { rev.current = rt.geoRev; const s = sigOf(pipe); if (s !== sig.current) { sig.current = s; setBuilt(build(pipe)); } }
    const t = rt.sim.telemetry.get(pipe.id), Tamb = rt.sim.amb.T;
    const Tin = (t?.T_in as number) ?? Tamb, Tout = (t?.T_out as number) ?? Tin, Ts = (t?.T_surf as number) ?? Tin;
    const mean = 0.5 * (Tin + Tout), fr = Math.abs(mean - Tamb) > 0.05 ? Math.min(1, Math.max(0, (Ts - Tamb) / (mean - Tamb))) : 1;
    const ins = (pipe.params.ins_mm as number) > 0;
    const a = ins ? Tamb + fr * (Tin - Tamb) : Tin + (Ts - mean) * 0.0, b = ins ? Tamb + fr * (Tout - Tamb) : Tout;
    th.current = { body: [a, b], fl0: [Tin, Tin], fl1: [Tout, Tout], amb: [Tamb, Tamb] };
    const u = flow.uniforms; u.uTa.value = Tin; u.uTb.value = Tout; u.uTmin.value = IR.tMin; u.uTmax.value = IR.tMax;
    if (u.uLut.value !== paletteTexture('coolwarm')) u.uLut.value = paletteTexture('coolwarm');
    const v = (t?.velocity as number) ?? 0, mdot = (t?.mdot as number) ?? 0; const dir = mdot >= 0 ? 1 : -1;
    phase.current += dt * Math.min(Math.abs(v), 6) * 0.35 * dir; u.uPhase.value = phase.current; u.uSpeed.value = Math.min(Math.abs(v) / 0.2, 1);
    u.uLen.value = Math.max(built?.len ?? 1, 0.5) / Math.max(((built?.Ro ?? 0.05) * 14), 0.35);
  });
  const supports = useMemo(() => {
    if (!built) return [] as { p: V3; h: number }[];
    const out: { p: V3; h: number }[] = [];
    for (let i = 1; i < built.pts.length; i++) {
      const p = built.pts[i - 1], q = built.pts[i], horiz = Math.abs(p[1] - q[1]) < 1e-3, L = Math.hypot(q[0] - p[0], q[2] - p[2]);
      if (horiz && L > 1.4 && p[1] > 0.35) { const n = Math.floor(L / 4.5) + 1; for (let k = 1; k <= n; k++) { const f = k / (n + 1); out.push({ p: [p[0] + (q[0] - p[0]) * f, 0, p[2] + (q[2] - p[2]) * f], h: p[1] - built.Ro - built.ins }); } }
    }
    return out;
  }, [built]);
  if (!built) return null;
  const fluid = (pipe.params.fluid as string) ?? 'water';
  const click = (e: { stopPropagation(): void }) => { if (useUI.getState().tool === 'select') { e.stopPropagation(); view.downHit = true; useUI.setState({ selected: pipe.id }); } };
  return (
    <ThermalProvider value={th}>
      <group>
        <mesh geometry={built.tube} castShadow receiveShadow onPointerDown={click} onClick={(e) => { if (useUI.getState().tool === 'select') e.stopPropagation(); }} onPointerOver={() => tool === 'select' && setHover(true)} onPointerOut={() => setHover(false)}>
          {built.ins > 0 ? <Mat kind="insul" ch="body" ax="uv" /> : <Mat kind="steel" ch="body" ax="uv" color={FLUID_COLOR[fluid] ?? '#7d8790'} />}
        </mesh>
        {showFlow && mode === 'pbr' && <mesh geometry={built.sleeve} material={flow} renderOrder={5} />}
        {(sel || hover) && <mesh geometry={built.hl}><meshBasicMaterial color={sel ? '#ff8a3d' : '#94a3b8'} transparent opacity={sel ? 0.28 : 0.16} depthWrite={false} /></mesh>}
        <Flange dn={built.dnMm} pos={built.a.pos.map((x, i) => x + built.a.dir[i] * flangeDims(built.dnMm).th * 0.5) as V3} dir={built.a.dir} ch="fl0" />
        <Flange dn={built.dnMm} pos={built.b.pos.map((x, i) => x + built.b.dir[i] * flangeDims(built.dnMm).th * 0.5) as V3} dir={built.b.dir} ch="fl1" />
        {supports.map((s, i) => (
          <group key={i} position={s.p}>
            <Box s={[0.05, s.h, 0.05]} pos={[0, s.h / 2, 0]} m={{ kind: 'darksteel', ch: 'amb' }} />
            <Box s={[0.24, 0.015, 0.24]} pos={[0, 0.0075, 0]} m={{ kind: 'darksteel', ch: 'amb' }} />
            <Box s={[0.16, 0.03, 0.1]} pos={[0, s.h + 0.0, 0]} m={{ kind: 'darksteel', ch: 'amb' }} />
          </group>
        ))}
      </group>
    </ThermalProvider>
  );
}
