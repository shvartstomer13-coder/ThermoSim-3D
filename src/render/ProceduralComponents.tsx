/**
 * Procedural 3D models of every component (no external GLB required): PBR materials, flanges with bolt rings,
 * fins, rotor blades, nozzles, instrumentation, and per-surface temperature channels for the IR shader.
 */
import { createContext, useContext, useLayoutEffect, useMemo, useRef, type MutableRefObject, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useUI } from '../store';
import { rt } from '../runtime';
import type { CompInstance, PortDef, Telemetry } from '../physics/engineTypes';
import { SPECS } from '../physics/components';
import { portsOf } from '../physics/geometry';
import { makeThermalMaterial, syncThermal } from './ThermalShader';

export type Ch = Record<string, [number, number]>;
const ThermalCtx = createContext<MutableRefObject<Ch>>({ current: {} });
const GhostCtx = createContext(false);
const CompCtx = createContext<CompInstance | null>(null);
const useTele = () => { const c = useContext(CompCtx); return () => (c ? rt.sim.telemetry.get(c.id) : undefined) as Telemetry | undefined; };

/* ------------------------------------------------------------------ PBR material table ------------ */
interface Pbr { color: string; metalness: number; roughness: number; emissive?: string; emissiveIntensity?: number; opacity?: number; envMapIntensity?: number }
const PBR: Record<string, Pbr> = {
  steel: { color: '#9aa3ab', metalness: 0.92, roughness: 0.34 },
  darksteel: { color: '#4b5259', metalness: 0.85, roughness: 0.45 },
  galv: { color: '#b7bec4', metalness: 0.75, roughness: 0.5 },
  blue: { color: '#1f5fa8', metalness: 0.35, roughness: 0.42 },
  navy: { color: '#17325c', metalness: 0.4, roughness: 0.4 },
  red: { color: '#b3261e', metalness: 0.3, roughness: 0.45 },
  green: { color: '#2f7d4f', metalness: 0.3, roughness: 0.45 },
  yellow: { color: '#e0b21b', metalness: 0.25, roughness: 0.5 },
  grey: { color: '#c3c9ce', metalness: 0.3, roughness: 0.55 },
  white: { color: '#e8ecee', metalness: 0.15, roughness: 0.6 },
  black: { color: '#15171a', metalness: 0.6, roughness: 0.42 },
  rubber: { color: '#1b1b1b', metalness: 0.0, roughness: 0.85 },
  insul: { color: '#d7dcdf', metalness: 0.05, roughness: 0.82 },
  copper: { color: '#b4693a', metalness: 0.95, roughness: 0.3 },
  brass: { color: '#c9a24a', metalness: 0.95, roughness: 0.3 },
  alu: { color: '#c4cad0', metalness: 0.9, roughness: 0.28 },
  brick: { color: '#8a4b3a', metalness: 0.0, roughness: 0.95 },
  frp: { color: '#9bb3c4', metalness: 0.0, roughness: 0.6 },
  concrete: { color: '#8b8c8a', metalness: 0.0, roughness: 0.95 },
  glass: { color: '#aee3ff', metalness: 0.0, roughness: 0.05, opacity: 0.3 },
  led: { color: '#37ff7a', metalness: 0, roughness: 0.4, emissive: '#37ff7a', emissiveIntensity: 2.2 },
  ledred: { color: '#ff3b30', metalness: 0, roughness: 0.4, emissive: '#ff3b30', emissiveIntensity: 2.2 },
  screen: { color: '#0b2a1e', metalness: 0, roughness: 0.25, emissive: '#2cff9a', emissiveIntensity: 0.9 },
  flame: { color: '#ff9a1f', metalness: 0, roughness: 1, emissive: '#ff7a00', emissiveIntensity: 3.5, opacity: 0.85 },
};
export interface MatProps { kind?: string; ch?: string; ax?: 'x' | 'y' | 'z' | 'uv'; lo?: number; hi?: number; color?: string; opacity?: number; side?: THREE.Side; map?: THREE.Texture | null; roughnessMap?: THREE.Texture | null; bumpMap?: THREE.Texture | null; repeat?: [number, number] }

export function Mat({ kind = 'steel', ch = 'body', ax = 'y', lo = 0, hi = 1, color, opacity, side, map, roughnessMap, bumpMap }: MatProps) {
  const mode = useUI((s) => s.renderMode); const ghost = useContext(GhostCtx); const th = useContext(ThermalCtx);
  const tm = useMemo(() => makeThermalMaterial({ axis: ax, lo, hi }), [ax, lo, hi]);
  useFrame(() => { if (mode === 'ir' && !ghost) { const v = th.current[ch] ?? [300, 300]; syncThermal(tm, v[0], v[1]); } });
  const p = PBR[kind] ?? PBR.steel;
  if (ghost) return <meshStandardMaterial color="#38bdf8" transparent opacity={0.4} depthWrite={false} />;
  if (mode === 'ir') return <primitive object={tm} attach="material" />;
  const op = opacity ?? p.opacity ?? 1;
  return <meshStandardMaterial color={color ?? p.color} metalness={p.metalness} roughness={p.roughness} emissive={p.emissive ?? '#000000'} emissiveIntensity={p.emissiveIntensity ?? 0}
    transparent={op < 1} opacity={op} side={side} map={map ?? null} roughnessMap={roughnessMap ?? null} bumpMap={bumpMap ?? null} bumpScale={0.6} envMapIntensity={p.envMapIntensity ?? 1} />;
}

/* ------------------------------------------------------------------ primitives -------------------- */
type V3 = [number, number, number];
interface PrimProps { pos?: V3; rot?: V3; m?: MatProps; shadow?: boolean }
export function Box({ s, pos, rot, m, shadow = true }: PrimProps & { s: V3 }) {
  return <mesh position={pos} rotation={rot} castShadow={shadow} receiveShadow><boxGeometry args={s} /><Mat {...m} /></mesh>;
}
export function Cyl({ r, h, r2, seg = 32, pos, rot, m, shadow = true, open = false }: PrimProps & { r: number; h: number; r2?: number; seg?: number; open?: boolean }) {
  return <mesh position={pos} rotation={rot} castShadow={shadow} receiveShadow><cylinderGeometry args={[r2 ?? r, r, h, seg, 1, open]} /><Mat {...m} /></mesh>;
}
export function Sph({ r, pos, m, sc, seg = 24 }: PrimProps & { r: number; sc?: V3; seg?: number }) {
  return <mesh position={pos} scale={sc} castShadow receiveShadow><sphereGeometry args={[r, seg, Math.round(seg * 0.75)]} /><Mat {...m} /></mesh>;
}
export function Tor({ R, r, pos, rot, m, seg = 40 }: PrimProps & { R: number; r: number; seg?: number }) {
  return <mesh position={pos} rotation={rot} castShadow receiveShadow><torusGeometry args={[R, r, 12, seg]} /><Mat {...m} /></mesh>;
}
/** horizontal cylinder along X */
export const CylX = (p: Omit<Parameters<typeof Cyl>[0], 'rot'> & { rot?: V3 }) => <Cyl {...p} rot={[0, 0, Math.PI / 2]} />;
/** horizontal cylinder along Z */
export const CylZ = (p: Omit<Parameters<typeof Cyl>[0], 'rot'>) => <Cyl {...p} rot={[Math.PI / 2, 0, 0]} />;

/** continuous rotation about a local axis (rad/s from a callback) */
export function Spin({ axis = 'x', rate, children, pos }: { axis?: 'x' | 'y' | 'z'; rate: () => number; children: ReactNode; pos?: V3 }) {
  const g = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (g.current) g.current.rotation[axis] += rate() * Math.min(dt, 0.05); });
  return <group ref={g} position={pos}>{children}</group>;
}

/** instanced mesh helper with explicit matrices */
function Inst({ geom, mats, m, shadow = true }: { geom: THREE.BufferGeometry; mats: THREE.Matrix4[]; m?: MatProps; shadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => { const im = ref.current; if (!im) return; mats.forEach((mt, i) => im.setMatrixAt(i, mt)); im.instanceMatrix.needsUpdate = true; }, [mats]);
  return <instancedMesh ref={ref} args={[geom, undefined, mats.length]} castShadow={shadow} receiveShadow frustumCulled={false}><Mat {...m} /></instancedMesh>;
}
const matrix = (p: V3, r: V3 = [0, 0, 0], s: V3 = [1, 1, 1], order: THREE.EulerOrder = 'XYZ') => new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(r[0], r[1], r[2], order)), new THREE.Vector3(...s));

/* ------------------------------------------------------------------ flange + bolts ------------------ */
export const flangeDims = (dnMm: number) => {
  const d = dnMm / 1000; const od = Math.max(d * 1.75 + 0.04, d + 0.07); const th = Math.max(0.014, 0.1 * d + 0.006);
  const nb = dnMm <= 40 ? 4 : dnMm <= 150 ? 8 : dnMm <= 300 ? 12 : 16; return { od, th, nb, pcd: (od + d * 1.1) / 2, br: Math.max(0.005, od * 0.032) };
};
const boltGeom = new THREE.CylinderGeometry(1, 1, 1, 6);
export function Flange({ dn, pos = [0, 0, 0], dir = [0, 1, 0], ch = 'body', kind = 'galv', bolts = true }: { dn: number; pos?: V3; dir?: V3; ch?: string; kind?: string; bolts?: boolean }) {
  const { od, th, nb, pcd, br } = flangeDims(dn);
  const q = useMemo(() => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize()), [dir[0], dir[1], dir[2]]);
  const mats = useMemo(() => {
    const a: THREE.Matrix4[] = [];
    for (let i = 0; i < nb; i++) {
      const t = (i / nb) * Math.PI * 2, x = Math.cos(t) * pcd / 2, z = Math.sin(t) * pcd / 2;
      a.push(matrix([x, 0, z], [0, 0, 0], [br * 0.55, th * 2.4, br * 0.55])); // stud
      a.push(matrix([x, th * 0.5 + br * 0.55, z], [0, t, 0], [br, br * 1.1, br])); // nut +
      a.push(matrix([x, -th * 0.5 - br * 0.55, z], [0, t, 0], [br, br * 1.1, br])); // nut -
    }
    return a;
  }, [nb, pcd, th, br]);
  return (
    <group position={pos} quaternion={q}>
      <mesh castShadow receiveShadow><cylinderGeometry args={[od / 2, od / 2, th, 36]} /><Mat kind={kind} ch={ch} ax="y" lo={-1} hi={1} /></mesh>
      {bolts && <Inst geom={boltGeom} mats={mats} m={{ kind: 'darksteel', ch }} />}
    </group>
  );
}

/* ------------------------------------------------------------------ nozzles at every port ------------ */
function portChannel(c: CompInstance, t: Telemetry | undefined, d: PortDef, Tamb: number): [number, number] {
  const g = (k: string) => (t && typeof t[k] === 'number' ? (t[k] as number) : undefined);
  let T: number | undefined;
  if (SPECS[c.type].passes === 2) T = d.pass === 0 ? g(d.kind === 'in' ? 'T_hot_in' : 'T_hot_out') : g(d.kind === 'in' ? 'T_cold_in' : 'T_cold_out');
  else if (c.type === 'manifold_merge' && d.kind === 'in') T = g('T_' + d.id.replace('in', 'br'));
  else T = g(d.kind === 'in' ? 'T_in' : 'T_out');
  T = T ?? g('T_surf') ?? Tamb; return [T, T];
}
export function PortNozzles({ comp, len = {} }: { comp: CompInstance; len?: Record<string, number> }) {
  const ports = portsOf(comp);
  return <>{ports.map((d) => {
    const L = len[d.id] ?? 0.16 + d.dn / 1600, r = (d.dn / 2000) * 1.08, { th } = flangeDims(d.dn);
    const dir = new THREE.Vector3(...d.dir), mid = new THREE.Vector3(...d.pos).addScaledVector(dir, -L / 2 - th * 0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return (
      <group key={d.id}>
        <mesh position={mid} quaternion={q} castShadow receiveShadow><cylinderGeometry args={[r, r, L, 20]} /><Mat kind="steel" ch={'p:' + d.id} ax="y" lo={-1} hi={1} /></mesh>
        <Flange dn={d.dn} pos={[d.pos[0] - d.dir[0] * th * 0.5, d.pos[1] - d.dir[1] * th * 0.5, d.pos[2] - d.dir[2] * th * 0.5]} dir={d.dir} ch={'p:' + d.id} />
      </group>
    );
  })}</>;
}

/* ------------------------------------------------------------------ thermal channels ---------------- */
export function channelsOf(c: CompInstance, t: Telemetry | undefined, Tamb: number): Ch {
  const g = (k: string, d: number) => (t && typeof t[k] === 'number' ? (t[k] as number) : d);
  const Tin = g('T_in', Tamb), Tout = g('T_out', Tin), Ts = g('T_surf', (Tin + Tout) / 2);
  const ch: Ch = { body: [Ts, Ts], fluid: [Tin, Tout], amb: [Tamb, Tamb], dark: [Tamb + 2, Tamb + 2] };
  const warm = (T: number, f: number) => Tamb + f * (T - Tamb);
  switch (c.type) {
    case 'rack': { const Tc = g('T_chip', Ts); const cab = warm(Tc, 0.22); Object.assign(ch, { body: [cab - 1, cab + 3], chip: [Tc - 3, Tc + 3], sup: [Tin, Tin], ret: [Tout, Tout], door: [warm(Tc, 0.3), warm(Tc, 0.3)] }); break; }
    case 'cdu': { const hi = g('T_hot_in', Tin), ho = g('T_hot_out', Tout), ci = g('T_cold_in', Tamb), co = g('T_cold_out', Tamb); const b = warm((hi + ho) / 2, 0.12); Object.assign(ch, { hot: [hi, ho], cold: [ci, co], body: [b, b], pump: [ho, ho], tank: [ho, hi] }); break; }
    case 'shell_tube_hx': case 'plate_hx': { const hi = g('T_hot_in', Tin), ho = g('T_hot_out', Tout), ci = g('T_cold_in', Tamb), co = g('T_cold_out', Tamb); const b = (hi + ho + ci + co) / 4; Object.assign(ch, { hot: [hi, ho], cold: [ci, co], body: [b, b] }); break; }
    case 'chiller': {
      const Te = g('T_evap', 280), Tc = g('T_cond', 310), hi = g('T_hot_in', Tin), ho = g('T_hot_out', Tout), ci = g('T_cold_in', Tamb), co = g('T_cold_out', Tamb);
      Object.assign(ch, { evap: [warm(Te, 0.85), warm(Te, 0.85)], cond: [Tc - 2, Tc - 2], chw: [hi, ho], cw: [ci, co], motor: [warm(Tc, 0.5), warm(Tc, 0.55)], body: [Tamb + 1, Tamb + 1] }); break;
    }
    case 'cooling_tower': { const Tw = g('T_wb', Tamb); Object.assign(ch, { upper: [Tout, Tin], basin: [Tout, Tout], fan: [Tamb + 6, Tamb + 6], body: [warm(Tout, 0.9), warm(Tin, 0.9)], wb: [Tw, Tw] }); break; }
    case 'boiler': { const Tw = g('T_wall', Ts); const f = warm(Tw, 0.35); Object.assign(ch, { furnace: [f - 15, f + 25], drum: [Tin, Tout], stack: [warm(Tw, 0.5), warm(Tw, 0.3)], flame: [Tw + 400, Tw + 600] }); break; }
    case 'steam_turbine': case 'gas_turbine': Object.assign(ch, { casing: [Tin, Tout], shaft: [warm(Tin, 0.8), warm(Tout, 0.8)], gen: [Tamb + 25, Tamb + 25] }); break;
    case 'condenser': { const Tc = g('T_cond', Ts), s0 = (c.params.t_sink as number) + 273.15, s1 = g('T_sink_out', s0); Object.assign(ch, { shell: [Tc, Tc], sink: [s0, s1], box: [s0, s1] }); break; }
    case 'evaporator': { const Te = g('T_evap', Ts), s0 = (c.params.t_src as number) + 273.15, s1 = g('T_src_out', s0); Object.assign(ch, { shell: [Te, Te], src: [s0, s1], box: [s0, s1], insul: [warm(Te, 0.35), warm(Te, 0.35)] }); break; }
    case 'dry_cooler': case 'crah': case 'buffer_tank': Object.assign(ch, { body: [Ts, Ts], coil: [Tin, Tout], fan: [Tamb + 4, Tamb + 4] }); break;
    case 'air_compressor': case 'compressor_centrifugal': case 'compressor_recip': { const m = warm(Tout, 0.45); Object.assign(ch, { casing: [Tin, Tout], motor: [m, m + 8], head: [Tout, Tout] }); break; }
    case 'manifold_split': case 'manifold_merge': Object.assign(ch, { body: [Tin, Tout] }); break;
    default: break;
  }
  for (const d of portsOf(c)) ch['p:' + d.id] = portChannel(c, t, d, Tamb);
  return ch;
}

/* ------------------------------------------------------------------ individual models --------------- */
const R = (dn: number) => dn / 2000;

function Rack({ c }: { c: CompInstance }) {
  const tele = useTele();
  const servers = useMemo(() => Array.from({ length: 16 }, (_, i) => matrix([0, 0.2 + i * 0.105, 0.52], [0, 0, 0], [1, 1, 1])), []);
  const leds = useMemo(() => Array.from({ length: 16 }, (_, i) => matrix([0.3, 0.2 + i * 0.105, 0.6])), []);
  const hoses = useMemo(() => Array.from({ length: 16 }, (_, i) => [matrix([-0.115, 0.2 + i * 0.105, 0.0], [0, 0, 0], [1, 1, 1]), matrix([0.115, 0.2 + i * 0.105, 0.0])]).flat(), []);
  const bx = useMemo(() => new THREE.BoxGeometry(0.66, 0.088, 0.1), []), lg = useMemo(() => new THREE.BoxGeometry(0.03, 0.02, 0.01), []);
  const hg = useMemo(() => new THREE.CylinderGeometry(0.011, 0.011, 0.2, 10), []);
  void tele;
  return (
    <group>
      <Box s={[0.8, 0.08, 1.25]} pos={[0, 0.04, 0]} m={{ kind: 'black' }} />
      {[[-0.39, -0.6], [0.39, -0.6], [-0.39, 0.6], [0.39, 0.6]].map(([x, z], i) => <Box key={i} s={[0.03, 1.96, 0.03]} pos={[x, 1.06, z]} m={{ kind: 'darksteel' }} />)}
      <Box s={[0.8, 0.04, 1.25]} pos={[0, 2.02, 0]} m={{ kind: 'black' }} />
      <Box s={[0.012, 1.92, 1.2]} pos={[-0.395, 1.06, 0]} m={{ kind: 'black', ch: 'body', ax: 'y', lo: 0, hi: 2 }} />
      <Box s={[0.012, 1.92, 1.2]} pos={[0.395, 1.06, 0]} m={{ kind: 'black', ch: 'body', ax: 'y', lo: 0, hi: 2 }} />
      <Box s={[0.78, 1.92, 0.012]} pos={[0, 1.06, -0.6]} m={{ kind: 'black', ch: 'body', ax: 'y', lo: 0, hi: 2 }} />
      <Box s={[0.76, 0.02, 1.2]} pos={[0, 0.095, 0]} m={{ kind: 'darksteel' }} />
      <Inst geom={bx} mats={servers} m={{ kind: 'darksteel', ch: 'chip', ax: 'y', lo: 0.2, hi: 1.8 }} />
      <Inst geom={lg} mats={leds} m={{ kind: 'led', ch: 'chip' }} shadow={false} />
      <Box s={[0.74, 0.1, 0.02]} pos={[0, 0.07, 0.6]} m={{ kind: 'darksteel' }} />
      {/* coolant rails (supply left / return right) */}
      <Cyl r={0.022} h={1.9} pos={[-0.22, 1.05, -0.05]} m={{ kind: 'copper', ch: 'sup', ax: 'y', lo: 0.1, hi: 2 }} />
      <Cyl r={0.022} h={1.9} pos={[0.22, 1.05, -0.05]} m={{ kind: 'copper', ch: 'ret', ax: 'y', lo: 0.1, hi: 2 }} />
      <Inst geom={hg} mats={hoses.map((mm, i) => { const q = mm.clone(); q.premultiply(matrix([i % 2 ? 0.105 - 0.22 + 0.22 : 0, 0, 0])); return q; })} m={{ kind: 'rubber', ch: 'chip' }} />
      <Cyl r={0.022} h={0.18} pos={[-0.22, 2.1, 0]} m={{ kind: 'copper', ch: 'sup' }} />
      <Cyl r={0.022} h={0.18} pos={[0.22, 2.1, 0]} m={{ kind: 'copper', ch: 'ret' }} />
      <Box s={[0.1, 0.05, 0.02]} pos={[0, 1.95, 0.61]} m={{ kind: 'screen' }} shadow={false} />
    </group>
  );
}

function Pump({ c }: { c: CompInstance }) {
  const tele = useTele(); const dn = 80, r = R(dn);
  const fins = useMemo(() => Array.from({ length: 9 }, (_, i) => matrix([0.18 + i * 0.03, 0.35, 0], [0, 0, Math.PI / 2])), []);
  const fg = useMemo(() => new THREE.CylinderGeometry(0.168, 0.168, 0.008, 28), []);
  return (
    <group>
      <Box s={[0.95, 0.05, 0.4]} pos={[0, 0.025, 0]} m={{ kind: 'darksteel' }} />
      <CylX r={r * 1.1} h={0.3} pos={[-0.37, 0.35, 0]} m={{ kind: 'blue', ch: 'body', ax: 'x', lo: -0.5, hi: 0 }} />
      <Cyl r={0.23} h={0.16} rot={[Math.PI / 2, 0, 0]} pos={[-0.12, 0.35, 0]} m={{ kind: 'blue', ch: 'body' }} />
      <Sph r={0.24} pos={[-0.12, 0.35, 0]} sc={[1, 1, 0.6]} m={{ kind: 'blue', ch: 'body' }} />
      <Cyl r={r * 1.25} h={0.45} pos={[0.12, 0.55, 0]} m={{ kind: 'blue', ch: 'body', ax: 'y', lo: 0.3, hi: 0.8 }} />
      <Box s={[0.14, 0.2, 0.3]} pos={[0.0, 0.14, 0]} m={{ kind: 'blue' }} />
      <CylX r={0.165} h={0.34} pos={[0.33, 0.35, 0]} m={{ kind: 'navy', ch: 'dark' }} />
      <Inst geom={fg} mats={fins.map((m4) => m4)} m={{ kind: 'navy', ch: 'dark' }} />
      <Box s={[0.1, 0.1, 0.12]} pos={[0.33, 0.55, 0]} m={{ kind: 'black' }} />
      <CylX r={0.02} h={0.14} pos={[0.52, 0.35, 0]} m={{ kind: 'darksteel', ch: 'dark' }} />
      <Spin axis="x" pos={[0.5, 0.35, 0]} rate={() => (((tele()?.speed as number) ?? 0) / 100) * 18}>
        {Array.from({ length: 6 }, (_, i) => <Box key={i} s={[0.02, 0.15, 0.015]} pos={[0, 0, 0]} rot={[(i * Math.PI) / 3, 0, 0]} m={{ kind: 'darksteel', ch: 'dark' }} />)}
      </Spin>
      <Box s={[0.12, 0.05, 0.1]} pos={[0.4, 0.58, 0.06]} m={{ kind: 'led' }} shadow={false} />
    </group>
  );
}

function SpoolBody({ c, dn, len = 0.5, children }: { c: CompInstance; dn: number; len?: number; children?: ReactNode }) {
  const r = R(dn) * 1.08;
  return (
    <group>
      <CylX r={r} h={len - 0.04} pos={[0, 0.2, 0]} m={{ kind: 'steel', ch: 'body', ax: 'x', lo: -len / 2, hi: len / 2 }} />
      <Box s={[len * 0.5, 0.012, 0.2]} pos={[0, 0.003, 0]} m={{ kind: 'darksteel' }} />
      {children}
    </group>
  );
}
function Valve({ c }: { c: CompInstance }) {
  const dn = (c.params.D_mm as number) ?? 100, r = R(dn); const open = ((c.params.open_pct as number) ?? 100) / 100;
  return (
    <group>
      <CylX r={r * 1.1} h={0.46} pos={[0, 0.2, 0]} m={{ kind: 'steel', ch: 'body', ax: 'x', lo: -0.25, hi: 0.25 }} />
      <Sph r={Math.max(0.1, r * 1.9)} pos={[0, 0.2, 0]} m={{ kind: 'blue', ch: 'body' }} />
      <Cyl r={0.045} h={0.2} pos={[0, 0.42, 0]} m={{ kind: 'blue', ch: 'body' }} />
      <Cyl r={0.12} h={0.07} pos={[0, 0.56, 0]} m={{ kind: 'navy', ch: 'dark' }} />
      <Sph r={0.12} pos={[0, 0.59, 0]} sc={[1, 0.5, 1]} m={{ kind: 'navy', ch: 'dark' }} />
      <Cyl r={0.008} h={0.18} pos={[0, 0.7 - 0.05 * (1 - open), 0]} m={{ kind: 'alu', ch: 'dark' }} />
      <Box s={[0.03, 0.025, 0.012]} pos={[0.09, 0.45 + 0.1 * open, 0.05]} m={{ kind: 'yellow', ch: 'dark' }} />
      <Box s={[0.24, 0.012, 0.2]} pos={[0, 0.003, 0]} m={{ kind: 'darksteel' }} />
    </group>
  );
}
function ExpValve({ c }: { c: CompInstance }) {
  const tele = useTele(); void tele; void c;
  return (
    <group>
      <CylX r={0.03} h={0.44} pos={[0, 0.2, 0]} m={{ kind: 'brass', ch: 'body', ax: 'x', lo: -0.25, hi: 0.25 }} />
      <Box s={[0.12, 0.12, 0.12]} pos={[0, 0.2, 0]} m={{ kind: 'brass', ch: 'body' }} />
      <Cyl r={0.05} h={0.12} pos={[0, 0.32, 0]} m={{ kind: 'brass', ch: 'body' }} />
      <Sph r={0.085} pos={[0, 0.42, 0]} sc={[1, 0.55, 1]} m={{ kind: 'alu', ch: 'body' }} />
      <Cyl r={0.004} h={0.5} pos={[0.1, 0.45, 0.05]} rot={[0.3, 0, 0.9]} m={{ kind: 'copper', ch: 'body' }} />
      <Cyl r={0.014} h={0.12} pos={[0.2, 0.6, 0.12]} m={{ kind: 'copper', ch: 'body' }} />
      <Box s={[0.24, 0.012, 0.18]} pos={[0, 0.003, 0]} m={{ kind: 'darksteel' }} />
    </group>
  );
}
function FlowMeter({ c }: { c: CompInstance }) {
  const dn = (c.params.D_mm as number) ?? 100;
  return (
    <SpoolBody c={c} dn={dn}>
      <Cyl r={R(dn) * 1.6} h={0.2} rot={[0, 0, Math.PI / 2]} pos={[0, 0.2, 0]} m={{ kind: 'yellow', ch: 'body' }} />
      <Cyl r={0.04} h={0.2} pos={[0, 0.36, 0]} m={{ kind: 'alu', ch: 'body' }} />
      <Box s={[0.18, 0.12, 0.1]} pos={[0, 0.52, 0]} m={{ kind: 'grey', ch: 'body' }} />
      <Box s={[0.12, 0.06, 0.012]} pos={[0, 0.53, 0.056]} m={{ kind: 'screen' }} shadow={false} />
    </SpoolBody>
  );
}
function PressureSensor({ c }: { c: CompInstance }) {
  const dn = (c.params.D_mm as number) ?? 100;
  return (
    <SpoolBody c={c} dn={dn}>
      <Cyl r={0.018} h={0.2} pos={[0, 0.3, 0]} m={{ kind: 'steel', ch: 'body' }} />
      <Box s={[0.05, 0.025, 0.05]} pos={[0, 0.4, 0]} m={{ kind: 'steel', ch: 'body' }} />
      <Cyl r={0.07} h={0.05} rot={[Math.PI / 2, 0, 0]} pos={[0, 0.5, 0]} m={{ kind: 'steel', ch: 'body' }} />
      <Cyl r={0.062} h={0.012} rot={[Math.PI / 2, 0, 0]} pos={[0, 0.5, 0.028]} m={{ kind: 'white', ch: 'body' }} />
      <Box s={[0.005, 0.05, 0.004]} pos={[0.012, 0.51, 0.036]} rot={[0, 0, -0.7]} m={{ kind: 'red', ch: 'body' }} />
    </SpoolBody>
  );
}
function TempSensor({ c }: { c: CompInstance }) {
  const dn = (c.params.D_mm as number) ?? 100;
  return (
    <SpoolBody c={c} dn={dn}>
      <Cyl r={0.022} h={0.14} pos={[0, 0.32, 0]} m={{ kind: 'steel', ch: 'body' }} />
      <Cyl r={0.04} h={0.1} pos={[0, 0.44, 0]} m={{ kind: 'alu', ch: 'body' }} />
      <Cyl r={0.044} h={0.025} pos={[0, 0.51, 0]} m={{ kind: 'black', ch: 'body' }} />
      <Box s={[0.07, 0.03, 0.02]} pos={[0.06, 0.45, 0]} m={{ kind: 'grey', ch: 'body' }} />
    </SpoolBody>
  );
}
function Manifold({ c }: { c: CompInstance }) {
  const ports = portsOf(c); const xs = ports.map((p) => p.pos[0]); const x0 = Math.min(...xs), x1 = Math.max(...xs), dn = (c.params.D_mm as number) ?? 150, r = R(dn) * 1.05;
  const hy = 0.12;
  return (
    <group>
      <CylX r={r} h={x1 - x0 - 0.2} pos={[(x0 + x1) / 2, hy, 0]} m={{ kind: 'steel', ch: 'body', ax: 'x', lo: x0, hi: x1 }} />
      {ports.filter((p) => p.dir[1] === 0).map((p) => <group key={p.id}><Cyl r={r * 0.8} h={0.3 - hy} pos={[p.pos[0] * 0.9, (0.3 + hy) / 2, 0]} m={{ kind: 'steel', ch: 'body' }} /><Sph r={r * 1.05} pos={[p.pos[0] * 0.9, hy, 0]} m={{ kind: 'steel', ch: 'body' }} /></group>)}
      {[x0 + 0.5, (x0 + x1) / 2, x1 - 0.5].map((x, i) => <group key={i}><Box s={[0.06, hy - r, 0.18]} pos={[x, (hy - r) / 2, 0]} m={{ kind: 'darksteel' }} /></group>)}
      {ports.filter((p) => p.dir[1] === 1).map((p) => <Sph key={p.id} r={r * 0.9} pos={[p.pos[0], hy, 0]} m={{ kind: 'steel', ch: 'body' }} />)}
    </group>
  );
}
function ExpTank() {
  return (
    <group>
      {[0, 1, 2].map((i) => { const a = (i / 3) * Math.PI * 2 + 0.5; return <Box key={i} s={[0.05, 0.3, 0.05]} pos={[Math.cos(a) * 0.24, 0.15, Math.sin(a) * 0.24]} m={{ kind: 'darksteel' }} />; })}
      <Cyl r={0.3} h={0.9} pos={[0, 0.75, 0]} m={{ kind: 'blue', ch: 'body', ax: 'y', lo: 0.3, hi: 1.2 }} />
      <Sph r={0.3} pos={[0, 1.2, 0]} sc={[1, 0.5, 1]} m={{ kind: 'blue', ch: 'body' }} />
      <Sph r={0.3} pos={[0, 0.3, 0]} sc={[1, 0.5, 1]} m={{ kind: 'blue', ch: 'body' }} />
      <Tor R={0.3} r={0.012} rot={[Math.PI / 2, 0, 0]} pos={[0, 0.3, 0]} m={{ kind: 'navy' }} />
      <Tor R={0.3} r={0.012} rot={[Math.PI / 2, 0, 0]} pos={[0, 1.2, 0]} m={{ kind: 'navy' }} />
      <Cyl r={0.022} h={0.2} pos={[0, 1.42, 0]} m={{ kind: 'steel', ch: 'body' }} />
      <Cyl r={0.045} h={0.025} rot={[Math.PI / 2, 0, 0]} pos={[0, 1.5, 0.02]} m={{ kind: 'white', ch: 'body' }} />
      <CylX r={0.022} h={0.12} pos={[0.34, 0.3, 0]} m={{ kind: 'steel', ch: 'p:ref' }} />
    </group>
  );
}
function PlateHX() {
  const plates = useMemo(() => { const a: THREE.Matrix4[] = [], b: THREE.Matrix4[] = []; for (let i = 0; i < 28; i++) (i % 2 ? a : b).push(matrix([0, 0.7, -0.135 + i * 0.0097])); return { a, b }; }, []);
  const g = useMemo(() => new THREE.BoxGeometry(0.56, 1.1, 0.0075), []);
  return (
    <group>
      <Box s={[0.66, 0.06, 0.4]} pos={[0, 0.03, 0]} m={{ kind: 'darksteel' }} />
      <Box s={[0.64, 1.2, 0.035]} pos={[0, 0.7, -0.17]} m={{ kind: 'blue', ch: 'body' }} />
      <Box s={[0.64, 1.2, 0.035]} pos={[0, 0.7, 0.17]} m={{ kind: 'blue', ch: 'body' }} />
      <Inst geom={g} mats={plates.a} m={{ kind: 'alu', ch: 'hot', ax: 'y', lo: 0.15, hi: 1.25 }} />
      <Inst geom={g} mats={plates.b} m={{ kind: 'alu', ch: 'cold', ax: 'y', lo: 0.15, hi: 1.25 }} />
      {[[-0.29, 0.15], [0.29, 0.15], [-0.29, 1.28], [0.29, 1.28]].map(([x, y], i) => <CylZ key={i} r={0.012} h={0.5} pos={[x, y, 0]} m={{ kind: 'darksteel' }} />)}
      <CylX r={0.025} h={0.8} pos={[0, 1.32, 0]} m={{ kind: 'darksteel' }} />
      <Box s={[0.5, 0.08, 0.2]} pos={[0, 1.27, 0]} m={{ kind: 'blue', ch: 'body' }} />
      <Box s={[0.2, 0.012, 0.03]} pos={[0, 1.2, 0.18]} m={{ kind: 'yellow' }} />
    </group>
  );
}
function CDU() {
  return (
    <group>
      <Box s={[1.3, 0.08, 0.9]} pos={[0, 0.04, 0]} m={{ kind: 'black' }} />
      {[[-0.64, -0.44], [0.64, -0.44], [-0.64, 0.44], [0.64, 0.44]].map(([x, z], i) => <Box key={i} s={[0.04, 1.9, 0.04]} pos={[x, 1.03, z]} m={{ kind: 'darksteel' }} />)}
      <Box s={[1.3, 0.05, 0.9]} pos={[0, 1.975, 0]} m={{ kind: 'navy', ch: 'body' }} />
      <Box s={[0.02, 1.9, 0.86]} pos={[-0.65, 1.03, 0]} m={{ kind: 'navy', ch: 'body', ax: 'y', lo: 0, hi: 2 }} />
      <Box s={[0.02, 1.9, 0.86]} pos={[0.65, 1.03, 0]} m={{ kind: 'navy', ch: 'body', ax: 'y', lo: 0, hi: 2 }} />
      <Box s={[1.26, 1.9, 0.02]} pos={[0, 1.03, -0.45]} m={{ kind: 'navy', ch: 'body', ax: 'y', lo: 0, hi: 2 }} />
      {/* internals: plate HX, pump, reservoir, piping */}
      <Box s={[0.34, 0.9, 0.22]} pos={[0.32, 1.1, 0.12]} m={{ kind: 'alu', ch: 'hot', ax: 'y', lo: 0.6, hi: 1.6 }} />
      <Box s={[0.34, 0.9, 0.05]} pos={[0.32, 1.1, 0.26]} m={{ kind: 'blue', ch: 'cold', ax: 'y', lo: 0.6, hi: 1.6 }} />
      <Cyl r={0.17} h={0.9} pos={[-0.4, 0.55, -0.1]} m={{ kind: 'steel', ch: 'tank', ax: 'y', lo: 0.1, hi: 1.0 }} />
      <Sph r={0.17} pos={[-0.4, 1.0, -0.1]} sc={[1, 0.5, 1]} m={{ kind: 'steel', ch: 'tank' }} />
      <CylX r={0.12} h={0.3} pos={[0.0, 0.3, 0.1]} m={{ kind: 'blue', ch: 'pump' }} />
      <CylX r={0.09} h={0.28} pos={[0.28, 0.3, 0.1]} m={{ kind: 'navy', ch: 'dark' }} />
      {[-0.5, -0.17, 0.17, 0.5].map((x, i) => <Cyl key={i} r={0.04} h={0.85} pos={[x, 1.55, 0.15]} m={{ kind: 'steel', ch: i < 2 ? 'hot' : 'cold', ax: 'y', lo: 1.1, hi: 2 }} />)}
      <Cyl r={0.04} h={0.4} pos={[0.17, 0.5, 0.15]} m={{ kind: 'steel', ch: 'cold' }} /><Cyl r={0.04} h={0.4} pos={[-0.17, 0.5, 0.15]} m={{ kind: 'steel', ch: 'hot' }} />
      <Box s={[0.5, 0.28, 0.03]} pos={[0, 1.75, 0.46]} m={{ kind: 'black' }} />
      <Box s={[0.4, 0.18, 0.01]} pos={[0, 1.75, 0.48]} m={{ kind: 'screen' }} shadow={false} />
      <Box s={[0.03, 0.03, 0.01]} pos={[0.28, 1.84, 0.48]} m={{ kind: 'led' }} shadow={false} />
    </group>
  );
}
function Chiller({ c }: { c: CompInstance }) {
  const tele = useTele(); void c;
  return (
    <group>
      <Box s={[3.6, 0.12, 1.5]} pos={[0, 0.06, 0]} m={{ kind: 'yellow' }} />
      <CylX r={0.38} h={2.1} pos={[-0.65, 0.7, 0.45]} m={{ kind: 'insul', ch: 'evap', ax: 'x', lo: -1.7, hi: 0.4 }} />
      <CylX r={0.31} h={2.1} pos={[0.65, 1.45, 0.45]} m={{ kind: 'blue', ch: 'cond', ax: 'x', lo: -0.4, hi: 1.7 }} />
      {[-1.7, 0.4].map((x, i) => <group key={i}><Sph r={0.38} pos={[x, 0.7, 0.45]} sc={[0.3, 1, 1]} m={{ kind: 'galv', ch: 'chw', ax: 'x', lo: -1.7, hi: 0.4 }} /><Tor R={0.38} r={0.02} rot={[0, Math.PI / 2, 0]} pos={[x + (i ? -0.05 : 0.05), 0.7, 0.45]} m={{ kind: 'darksteel' }} /></group>)}
      {[-0.4, 1.7].map((x, i) => <group key={i}><Sph r={0.31} pos={[x, 1.45, 0.45]} sc={[0.3, 1, 1]} m={{ kind: 'galv', ch: 'cw', ax: 'x', lo: -0.4, hi: 1.7 }} /><Tor R={0.31} r={0.018} rot={[0, Math.PI / 2, 0]} pos={[x + (i ? -0.05 : 0.05), 1.45, 0.45]} m={{ kind: 'darksteel' }} /></group>)}
      {[-1.4, -0.9].map((x) => <Cyl key={x} r={0.065} h={0.95} pos={[x, 1.6, 0.45]} m={{ kind: 'steel', ch: 'chw', ax: 'y', lo: 1.1, hi: 2.1 }} />)}
      {[0.9, 1.4].map((x) => <Cyl key={x} r={0.08} h={0.55} pos={[x, 1.85, 0.45]} m={{ kind: 'steel', ch: 'cw', ax: 'y', lo: 1.7, hi: 2.1 }} />)}
      {/* compressor + motor */}
      <CylX r={0.3} h={1.1} pos={[0.0, 1.0, -0.38]} m={{ kind: 'green', ch: 'motor', ax: 'x', lo: -0.6, hi: 0.6 }} />
      {Array.from({ length: 10 }, (_, i) => <Tor key={i} R={0.3} r={0.006} rot={[0, Math.PI / 2, 0]} pos={[-0.45 + i * 0.1, 1.0, -0.38]} m={{ kind: 'green', ch: 'motor' }} />)}
      <Sph r={0.3} pos={[0.58, 1.0, -0.38]} sc={[0.55, 1, 1]} m={{ kind: 'green', ch: 'motor' }} />
      <Box s={[0.45, 0.6, 0.5]} pos={[-0.7, 1.15, -0.38]} m={{ kind: 'steel', ch: 'motor' }} />
      <Cyl r={0.05} h={0.5} pos={[0.2, 0.9, 0.05]} rot={[0.8, 0, 0]} m={{ kind: 'copper', ch: 'evap' }} />
      {/* control panel */}
      <Box s={[0.7, 1.5, 0.35]} pos={[-1.35, 0.87, -0.55]} m={{ kind: 'grey', ch: 'body' }} />
      <Box s={[0.5, 0.3, 0.02]} pos={[-1.35, 1.35, -0.37]} m={{ kind: 'screen' }} shadow={false} />
      <Box s={[0.04, 0.04, 0.02]} pos={[-1.15, 1.1, -0.37]} m={{ kind: tele() && (tele()!.load_pct as number) > 1 ? 'led' : 'ledred' }} shadow={false} />
      {[-1.7, -1.2, 1.2, 1.7].map((x, i) => <Box key={i} s={[0.1, 0.22, 0.9]} pos={[x, 0.23, 0.45]} m={{ kind: 'darksteel' }} />)}
    </group>
  );
}
function CoolingTower({ c }: { c: CompInstance }) {
  const tele = useTele(); void c;
  const slats = useMemo(() => { const a: THREE.Matrix4[] = []; for (let i = 0; i < 18; i++) { const y = 0.95 + i * 0.1; a.push(matrix([0, y, 1.505], [0.5, 0, 0]), matrix([0, y, -1.505], [-0.5, 0, 0])); a.push(matrix([1.505, y, 0], [0.5, Math.PI / 2, 0], [1, 1, 1], 'YXZ'), matrix([-1.505, y, 0], [-0.5, Math.PI / 2, 0], [1, 1, 1], 'YXZ')); } return a; }, []);
  const sg = useMemo(() => new THREE.BoxGeometry(2.9, 0.012, 0.16), []);
  return (
    <group>
      <Box s={[3.1, 0.85, 3.1]} pos={[0, 0.425, 0]} m={{ kind: 'concrete', ch: 'basin' }} />
      <Box s={[3.0, 0.08, 3.0]} pos={[0, 0.89, 0]} m={{ kind: 'frp', ch: 'basin' }} />
      {[[-1.45, -1.45], [1.45, -1.45], [-1.45, 1.45], [1.45, 1.45]].map(([x, z], i) => <Box key={i} s={[0.1, 1.9, 0.1]} pos={[x, 1.85, z]} m={{ kind: 'frp', ch: 'upper', ax: 'y', lo: 0.9, hi: 2.8 }} />)}
      <Inst geom={sg} mats={slats} m={{ kind: 'frp', ch: 'upper', ax: 'y', lo: 0.9, hi: 2.8 }} />
      <Box s={[3.1, 0.16, 3.1]} pos={[0, 2.88, 0]} m={{ kind: 'frp', ch: 'upper', ax: 'y', lo: 0.9, hi: 2.8 }} />
      <Cyl r={0.95} h={0.5} pos={[0, 3.2, 0]} open m={{ kind: 'frp', ch: 'fan', side: THREE.DoubleSide } as MatProps} />
      <Tor R={0.95} r={0.03} rot={[Math.PI / 2, 0, 0]} pos={[0, 3.45, 0]} m={{ kind: 'galv', ch: 'fan' }} />
      <Cyl r={0.12} h={0.3} pos={[0, 3.1, 0]} m={{ kind: 'darksteel', ch: 'fan' }} />
      <Spin axis="y" pos={[0, 3.2, 0]} rate={() => (((tele()?.fan_kw as number) ?? 0) > 0.01 ? 11 * Math.cbrt(((tele()?.fan_kw as number) ?? 0) / ((c.params.fan_kw as number) || 15)) : 0)}>
        {Array.from({ length: 8 }, (_, i) => <Box key={i} s={[0.8, 0.012, 0.16]} pos={[Math.cos((i / 8) * 6.283) * 0.5, 0, Math.sin((i / 8) * 6.283) * 0.5]} rot={[0.25, -(i / 8) * 6.283, 0]} m={{ kind: 'alu', ch: 'fan' }} />)}
      </Spin>
      <Box s={[0.15, 0.4, 0.15]} pos={[0.0, 0.0 + 3.0, 0]} m={{ kind: 'darksteel', ch: 'fan' }} shadow={false} />
      <Cyl r={0.06} h={1.3} pos={[1.52, 1.7, 0]} m={{ kind: 'steel', ch: 'p:in', ax: 'y', lo: 0.9, hi: 3 }} />
      <Box s={[0.1, 0.25, 0.1]} pos={[1.45, 0.75, 0.8]} m={{ kind: 'steel', ch: 'p:out' }} />
    </group>
  );
}
function Boiler({ c }: { c: CompInstance }) {
  const tele = useTele(); void c;
  return (
    <group>
      <Box s={[3.0, 0.15, 1.9]} pos={[0, 0.075, 0]} m={{ kind: 'darksteel' }} />
      <Box s={[2.8, 1.5, 1.6]} pos={[0, 0.9, 0]} m={{ kind: 'brick', ch: 'furnace', ax: 'y', lo: 0.15, hi: 1.65 }} />
      {[-1.1, -0.35, 0.35, 1.1].map((x, i) => <Box key={i} s={[0.08, 1.52, 1.64]} pos={[x, 0.9, 0]} m={{ kind: 'darksteel', ch: 'furnace', ax: 'y', lo: 0.15, hi: 1.65 }} />)}
      <CylX r={0.38} h={2.5} pos={[0, 2.15, 0]} m={{ kind: 'insul', ch: 'drum', ax: 'x', lo: -1.25, hi: 1.25 }} />
      {[-1.25, 1.25].map((x, i) => <Sph key={i} r={0.38} pos={[x, 2.15, 0]} sc={[0.4, 1, 1]} m={{ kind: 'galv', ch: 'drum' }} />)}
      {[-0.9, 0, 0.9].map((x, i) => <Cyl key={i} r={0.07} h={0.75} pos={[x, 1.65 + 0.0, 0.0]} m={{ kind: 'steel', ch: 'drum' }} />)}
      <Cyl r={0.06} h={0.85} pos={[-0.7, 2.8, 0]} m={{ kind: 'steel', ch: 'p:in', ax: 'y', lo: 2.4, hi: 3.2 }} />
      <Cyl r={0.07} h={0.85} pos={[0.7, 2.8, 0]} m={{ kind: 'steel', ch: 'p:out', ax: 'y', lo: 2.4, hi: 3.2 }} />
      <Cyl r={0.26} h={2.4} pos={[1.15, 2.0, -0.55]} m={{ kind: 'galv', ch: 'stack', ax: 'y', lo: 0.9, hi: 3.2 }} />
      <Tor R={0.26} r={0.015} rot={[Math.PI / 2, 0, 0]} pos={[1.15, 3.2, -0.55]} m={{ kind: 'darksteel', ch: 'stack' }} />
      {/* burner */}
      <CylZ r={0.3} h={0.5} pos={[0, 0.7, 0.9]} m={{ kind: 'red', ch: 'furnace' }} />
      <CylZ r={0.2} h={0.1} pos={[0, 0.7, 1.18]} m={{ kind: 'flame', ch: 'flame' }} />
      <Sph r={0.15} pos={[0, 0.7, 1.27]} sc={[1, 1, 1.6 + 0.6 * Math.sin(performance.now() / 120)]} m={{ kind: 'flame', ch: 'flame' }} />
      <Box s={[0.4, 0.4, 0.3]} pos={[0.55, 0.9, 0.95]} m={{ kind: 'navy', ch: 'furnace' }} />
      <Box s={[0.3, 0.15, 0.01]} pos={[0.55, 0.95, 1.11]} m={{ kind: 'screen' }} shadow={false} />
      {tele() && (tele()!.trip_pct as number) > 5 && <Box s={[0.05, 0.05, 0.02]} pos={[0.7, 1.1, 1.1]} m={{ kind: 'ledred' }} shadow={false} />}
      {[[-1.3, 0.75], [1.3, 0.75], [-1.3, -0.75], [1.3, -0.75]].map(([x, z], i) => <Box key={i} s={[0.1, 0.24, 0.1]} pos={[x, 0.27, z]} m={{ kind: 'darksteel' }} />)}
    </group>
  );
}
function Turbine({ c, gas }: { c: CompInstance; gas: boolean }) {
  const tele = useTele();
  const rpmF = () => Math.min(((tele()?.rpm as number) ?? (tele()?.W_shaft ? 3000 : 0)) / 60, 6) * 6.283 * 0.1;
  return (
    <group>
      <Box s={[2.9, 0.1, 1.0]} pos={[0.1, 0.05, 0]} m={{ kind: 'darksteel' }} />
      {[-0.9, 0.5].map((x, i) => <Box key={i} s={[0.16, 0.5, 0.7]} pos={[x, 0.35, 0]} m={{ kind: 'darksteel' }} />)}
      {/* casing: inlet -> exhaust (conical) */}
      <Cyl r={gas ? 0.34 : 0.5} r2={gas ? 0.5 : 0.28} h={1.5} rot={[0, 0, Math.PI / 2]} pos={[-0.35, 0.75, 0]} m={{ kind: gas ? 'grey' : 'insul', ch: 'casing', ax: 'x', lo: -1.1, hi: 0.4 }} />
      <Cyl r={0.5} h={0.8} rot={[0, 0, Math.PI / 2]} pos={[0.7, 0.8, 0]} m={{ kind: gas ? 'grey' : 'galv', ch: 'casing', ax: 'x', lo: 0.3, hi: 1.1 }} />
      <Box s={[0.8, 0.5, 0.9]} pos={[0.8, 1.0, 0]} m={{ kind: 'galv', ch: 'casing', ax: 'x', lo: 0.4, hi: 1.2 }} />
      <Box s={[0.5, 0.45, 0.5]} pos={[-0.7, 1.05, 0]} m={{ kind: 'red', ch: 'casing', ax: 'x', lo: -1, hi: 0 }} />
      {gas && <CylZ r={0.2} h={0.9} pos={[-0.75, 1.1, 0]} m={{ kind: 'darksteel', ch: 'casing' }} />}
      {Array.from({ length: 6 }, (_, i) => <Tor key={i} R={0.5 - i * 0.03} r={0.012} rot={[0, Math.PI / 2, 0]} pos={[-1.0 + i * 0.28, 0.75, 0]} m={{ kind: 'darksteel', ch: 'casing', ax: 'x', lo: -1.1, hi: 0.4 }} />)}
      {/* shaft and coupling */}
      <CylX r={0.045} h={2.4} pos={[-0.3, 0.75, 0]} m={{ kind: 'steel', ch: 'shaft', ax: 'x', lo: -1.5, hi: 0.9 }} />
      <Spin axis="x" pos={[-1.45, 0.75, 0]} rate={rpmF}>
        <CylX r={0.13} h={0.05} m={{ kind: 'darksteel', ch: 'shaft' }} />
        {[0, 1, 2, 3, 4, 5].map((i) => <Box key={i} s={[0.06, 0.03, 0.03]} pos={[0, Math.cos((i * 6.283) / 6) * 0.1, Math.sin((i * 6.283) / 6) * 0.1]} m={{ kind: 'brass', ch: 'shaft' }} />)}
      </Spin>
      {/* generator */}
      <CylX r={0.38} h={0.85} pos={[-1.95, 0.75, 0]} m={{ kind: 'green', ch: 'gen' }} />
      {Array.from({ length: 6 }, (_, i) => <Tor key={i} R={0.38} r={0.006} rot={[0, Math.PI / 2, 0]} pos={[-2.25 + i * 0.12, 0.75, 0]} m={{ kind: 'green', ch: 'gen' }} />)}
      <Box s={[0.9, 0.12, 0.8]} pos={[-1.95, 0.06, 0]} m={{ kind: 'darksteel' }} />
      <Box s={[0.5, 0.35, 0.2]} pos={[-1.95, 1.1, 0]} m={{ kind: 'black', ch: 'gen' }} />
      <Box s={[0.35, 0.18, 0.4]} pos={[0.0, 1.0, 0.55]} m={{ kind: 'grey' }} />
    </group>
  );
}
function Condenser() {
  const tubes = useMemo(() => { const a: THREE.Matrix4[] = []; for (let i = 0; i < 3; i++) a.push(matrix([0, 0.25 + i * 0.4, 0.55], [0, 0, Math.PI / 2])); return a; }, []);
  void tubes;
  return (
    <group>
      <CylX r={0.46} h={2.4} pos={[0, 0.68, 0]} m={{ kind: 'blue', ch: 'shell', ax: 'x', lo: -1.2, hi: 1.2 }} />
      {[-1.2, 1.2].map((x, i) => <group key={i}>
        <CylX r={0.49} h={0.34} pos={[x + (i ? 0.12 : -0.12), 0.68, 0]} m={{ kind: 'galv', ch: 'box', ax: 'x', lo: -1.5, hi: 1.5 }} />
        <Sph r={0.49} pos={[x + (i ? 0.29 : -0.29), 0.68, 0]} sc={[0.45, 1, 1]} m={{ kind: 'galv', ch: 'box' }} />
        <Tor R={0.49} r={0.025} rot={[0, Math.PI / 2, 0]} pos={[x + (i ? -0.05 : 0.05), 0.68, 0]} m={{ kind: 'darksteel' }} />
      </group>)}
      {[-0.75, 0.75].map((x, i) => <Box key={i} s={[0.1, 0.4, 0.9]} pos={[x, 0.2, 0]} m={{ kind: 'darksteel' }} />)}
      <Cyl r={0.07} h={0.3} pos={[-1.5, 0.5, 0.3]} m={{ kind: 'steel', ch: 'sink', ax: 'x', lo: -1.6, hi: 1.6 }} />
      <Cyl r={0.07} h={0.3} pos={[1.5, 0.5, 0.3]} m={{ kind: 'steel', ch: 'sink' }} />
      <Cyl r={0.025} h={0.3} pos={[0, 1.2, 0.35]} m={{ kind: 'steel', ch: 'shell' }} />
      <Cyl r={0.045} h={0.025} rot={[Math.PI / 2, 0, 0]} pos={[0, 1.37, 0.35]} m={{ kind: 'white' }} />
      <Box s={[0.14, 0.14, 0.014]} pos={[0.5, 0.82, 0.455]} m={{ kind: 'glass' }} shadow={false} />
    </group>
  );
}
function Evaporator() {
  return (
    <group>
      <CylX r={0.4} h={2.2} pos={[0, 0.55, 0]} m={{ kind: 'insul', ch: 'insul', ax: 'x', lo: -1.1, hi: 1.1 }} />
      {[-1.1, 1.1].map((x, i) => <group key={i}>
        <CylX r={0.42} h={0.28} pos={[x + (i ? 0.1 : -0.1), 0.55, 0]} m={{ kind: 'galv', ch: 'box' }} />
        <Sph r={0.42} pos={[x + (i ? 0.23 : -0.23), 0.55, 0]} sc={[0.4, 1, 1]} m={{ kind: 'galv', ch: 'box' }} />
        <Tor R={0.42} r={0.02} rot={[0, Math.PI / 2, 0]} pos={[x + (i ? -0.05 : 0.05), 0.55, 0]} m={{ kind: 'darksteel' }} />
      </group>)}
      {[-0.7, 0.7].map((x, i) => <Box key={i} s={[0.1, 0.3, 0.8]} pos={[x, 0.15, 0]} m={{ kind: 'darksteel' }} />)}
      <Cyl r={0.05} h={0.28} pos={[-1.3, 0.45, 0.25]} m={{ kind: 'steel', ch: 'src' }} />
      <Cyl r={0.05} h={0.28} pos={[1.3, 0.45, 0.25]} m={{ kind: 'steel', ch: 'src' }} />
      <Cyl r={0.04} h={0.3} pos={[0, 0.98, 0.2]} m={{ kind: 'steel', ch: 'shell' }} />
      <Cyl r={0.045} h={0.025} rot={[Math.PI / 2, 0, 0]} pos={[0, 1.15, 0.2]} m={{ kind: 'white' }} />
    </group>
  );
}
function Compressor({ c, centrifugal }: { c: CompInstance; centrifugal: boolean }) {
  const tele = useTele(); void c;
  const w = () => Math.min(((tele()?.speed as number) ?? 1) * 8, 25);
  if (centrifugal) return (
    <group>
      <Box s={[1.8, 0.1, 1.0]} pos={[0, 0.05, 0]} m={{ kind: 'darksteel' }} />
      <CylX r={0.42} h={1.5} pos={[0, 0.55, 0.05]} m={{ kind: 'alu', ch: 'casing', ax: 'x', lo: -0.8, hi: 0.8 }} />
      <Sph r={0.42} pos={[0.8, 0.55, 0.05]} sc={[0.5, 1, 1]} m={{ kind: 'alu', ch: 'casing' }} />
      <Sph r={0.42} pos={[-0.8, 0.55, 0.05]} sc={[0.5, 1, 1]} m={{ kind: 'alu', ch: 'casing' }} />
      <Cyl r={0.12} h={0.3} pos={[-0.55, 0.98, 0.05]} m={{ kind: 'alu', ch: 'casing' }} /><Cyl r={0.1} h={0.3} pos={[0.55, 0.98, 0.05]} m={{ kind: 'alu', ch: 'head' }} />
      <CylX r={0.3} h={1.5} pos={[-0.05, 0.62, -0.5]} m={{ kind: 'blue', ch: 'motor', ax: 'x', lo: -0.8, hi: 0.7 }} />
      {Array.from({ length: 11 }, (_, i) => <Tor key={i} R={0.3} r={0.006} rot={[0, Math.PI / 2, 0]} pos={[-0.7 + i * 0.13, 0.62, -0.5]} m={{ kind: 'blue', ch: 'motor' }} />)}
      <Box s={[0.5, 0.3, 0.8]} pos={[0.45, 0.35, -0.2]} m={{ kind: 'grey', ch: 'casing' }} />
      <Spin axis="x" pos={[0.9, 0.55, 0.05]} rate={w}><CylX r={0.06} h={0.05} m={{ kind: 'darksteel', ch: 'casing' }} /><Box s={[0.02, 0.2, 0.02]} m={{ kind: 'darksteel', ch: 'casing' }} /></Spin>
      <Box s={[0.15, 0.15, 0.2]} pos={[-0.4, 0.45, -0.2]} m={{ kind: 'black' }} />
    </group>
  );
  return (
    <group>
      <Box s={[1.5, 0.1, 0.9]} pos={[0, 0.05, 0]} m={{ kind: 'darksteel' }} />
      <Box s={[1.0, 0.5, 0.55]} pos={[0, 0.4, 0.05]} m={{ kind: 'blue', ch: 'casing', ax: 'x', lo: -0.5, hi: 0.5 }} />
      {[-0.27, 0.27].map((x, i) => <group key={i}><Cyl r={0.15} h={0.35} pos={[x, 0.82, 0.05]} m={{ kind: 'blue', ch: i ? 'head' : 'casing' }} /><Cyl r={0.17} h={0.05} pos={[x, 1.0, 0.05]} m={{ kind: 'darksteel', ch: i ? 'head' : 'casing' }} />
        {Array.from({ length: 6 }, (_, k) => <Tor key={k} R={0.15} r={0.007} rot={[Math.PI / 2, 0, 0]} pos={[x, 0.68 + k * 0.045, 0.05]} m={{ kind: 'blue', ch: i ? 'head' : 'casing' }} />)}</group>)}
      <CylX r={0.06} h={0.95} pos={[0, 1.07, 0.05]} m={{ kind: 'steel', ch: 'casing', ax: 'x', lo: -0.55, hi: 0.55 }} />
      <Cyl r={0.07} h={0.14} pos={[-0.55, 1.1, 0.05]} m={{ kind: 'steel', ch: 'casing' }} /><Cyl r={0.06} h={0.14} pos={[0.55, 1.1, 0.05]} m={{ kind: 'steel', ch: 'head' }} />
      <Spin axis="z" pos={[0.52, 0.42, 0.37]} rate={w}><Cyl r={0.22} h={0.05} rot={[Math.PI / 2, 0, 0]} m={{ kind: 'darksteel', ch: 'casing' }} />{[0, 1, 2, 3].map((i) => <Box key={i} s={[0.4, 0.03, 0.03]} rot={[0, 0, (i * Math.PI) / 4]} m={{ kind: 'darksteel', ch: 'casing' }} />)}</Spin>
      <CylX r={0.26} h={0.8} pos={[0.0, 0.42, -0.32]} m={{ kind: 'green', ch: 'motor', ax: 'x', lo: -0.4, hi: 0.4 }} />
      {Array.from({ length: 7 }, (_, i) => <Tor key={i} R={0.26} r={0.006} rot={[0, Math.PI / 2, 0]} pos={[-0.36 + i * 0.12, 0.42, -0.32]} m={{ kind: 'green', ch: 'motor' }} />)}
      <Box s={[0.15, 0.12, 0.2]} pos={[-0.1, 0.72, -0.32]} m={{ kind: 'black' }} />
    </group>
  );
}

export 
/* ------------------------------------------------------------------ additional equipment ---------- */
function ShellTubeHX() {
  const baffles = useMemo(() => Array.from({ length: 7 }, (_, i) => matrix([-0.9 + i * 0.3, 0.75, 0], [0, 0, Math.PI / 2])), []);
  const ring = useMemo(() => new THREE.TorusGeometry(0.42, 0.012, 8, 40), []);
  return (
    <group>
      <CylX r={0.4} h={2.3} pos={[0, 0.75, 0]} m={{ kind: 'navy', ch: 'hot', ax: 'x', lo: -1.15, hi: 1.15 }} />
      <Inst geom={ring} mats={baffles} m={{ kind: 'darksteel', ch: 'hot' }} />
      {[-1, 1].map((k) => <group key={k}>
        <CylX r={0.46} h={0.06} pos={[k * 1.18, 0.75, 0]} m={{ kind: 'darksteel', ch: 'cold' }} />
        <CylX r={0.41} h={0.32} pos={[k * 1.36, 0.75, 0]} m={{ kind: 'blue', ch: 'cold' }} />
        <Sph r={0.41} sc={[0.35, 1, 1]} pos={[k * 1.52, 0.75, 0]} m={{ kind: 'blue', ch: 'cold' }} />
        <Box s={[0.18, 0.35, 0.86]} pos={[k * 0.85, 0.18, 0]} m={{ kind: 'darksteel' }} />
        <Box s={[0.5, 0.04, 0.95]} pos={[k * 0.85, 0.02, 0]} m={{ kind: 'darksteel' }} />
        <Cyl r={0.06} h={0.18} pos={[k * 0.85, 1.17, 0]} m={{ kind: 'navy', ch: 'hot' }} />
        <CylZ r={0.05} h={0.12} pos={[k * 1.3, 0.75, 0.42]} m={{ kind: 'blue', ch: 'cold' }} />
      </group>)}
      <Box s={[0.3, 0.16, 0.012]} pos={[0, 0.8, 0.405]} m={{ kind: 'alu' }} />
    </group>
  );
}
function AxialFan({ pos, r, ch = 'fan' }: { pos: V3; r: number; ch?: string }) {
  const s = useUI((st) => st.running); const tele = useTele();
  return (
    <group position={pos}>
      <Cyl r={r * 1.06} h={0.12} open m={{ kind: 'darksteel', ch: 'amb', side: THREE.DoubleSide }} />
      <Spin axis="y" rate={() => (s ? ((tele()?.speed as number) ?? 100) / 100 * 9 : 0)}>
        {[0, 1, 2, 3, 4].map((i) => <Box key={i} s={[r * 0.9, 0.01, r * 0.28]} pos={[Math.cos(i * 1.2566) * r * 0.5, 0, -Math.sin(i * 1.2566) * r * 0.5]} rot={[0.35, i * 1.2566, 0]} m={{ kind: 'black', ch }} />)}
        <Cyl r={r * 0.16} h={0.08} m={{ kind: 'darksteel', ch }} />
      </Spin>
      <Tor R={r * 0.7} r={0.006} rot={[Math.PI / 2, 0, 0]} pos={[0, 0.07, 0]} m={{ kind: 'galv', ch: 'amb' }} />
      <Tor R={r * 1.0} r={0.008} rot={[Math.PI / 2, 0, 0]} pos={[0, 0.07, 0]} m={{ kind: 'galv', ch: 'amb' }} />
    </group>
  );
}
function DryCooler() {
  const fins = useMemo(() => Array.from({ length: 60 }, (_, i) => matrix([-1.9 + i * 0.0645, 0.85, 0])), []);
  const fg = useMemo(() => new THREE.BoxGeometry(0.012, 0.75, 1.3), []);
  return (
    <group>
      {[-1.9, -0.6, 0.6, 1.9].map((x) => <Box key={x} s={[0.08, 0.5, 1.3]} pos={[x, 0.25, 0]} m={{ kind: 'galv' }} />)}
      <Box s={[4.0, 0.05, 1.4]} pos={[0, 0.5, 0]} m={{ kind: 'galv' }} />
      <Inst geom={fg} mats={fins} m={{ kind: 'alu', ch: 'coil', ax: 'x', lo: -2, hi: 2 }} />
      <Box s={[4.1, 0.25, 1.45]} pos={[0, 1.33, 0]} m={{ kind: 'white', ch: 'body' }} />
      {[-1.4, 0, 1.4].map((x) => <AxialFan key={x} pos={[x, 1.48, 0]} r={0.55} />)}
      <Box s={[0.2, 0.9, 0.3]} pos={[-1.9, 0.8, 0.5]} m={{ kind: 'copper', ch: 'coil' }} />
    </group>
  );
}
function Crah() {
  return (
    <group>
      <Box s={[1.8, 2.0, 0.88]} pos={[0, 1.0, 0]} m={{ kind: 'white', ch: 'body' }} />
      <Box s={[1.6, 0.9, 0.01]} pos={[0, 1.45, 0.445]} m={{ kind: 'darksteel', ch: 'coil' }} />
      {Array.from({ length: 14 }, (_, i) => <Box key={i} s={[1.55, 0.02, 0.012]} pos={[0, 1.05 + i * 0.058, 0.452]} m={{ kind: 'grey', ch: 'coil' }} shadow={false} />)}
      <Box s={[0.32, 0.2, 0.012]} pos={[0.55, 0.65, 0.447]} m={{ kind: 'screen' }} shadow={false} />
      <Box s={[1.7, 0.08, 0.85]} pos={[0, 2.04, 0]} m={{ kind: 'grey', ch: 'body' }} />
      {[-0.5, 0.4].map((x) => <Box key={x} s={[0.5, 0.3, 0.01]} pos={[x, 0.2, 0.445]} m={{ kind: 'black', ch: 'fan' }} />)}
    </group>
  );
}
function BufferTank() {
  return (
    <group>
      <Cyl r={0.6} h={1.8} pos={[0, 1.15, 0]} m={{ kind: 'insul', ch: 'body', ax: 'y', lo: 0.25, hi: 2.05 }} />
      <Sph r={0.6} sc={[1, 0.3, 1]} pos={[0, 2.05, 0]} m={{ kind: 'insul', ch: 'body' }} />
      <Sph r={0.6} sc={[1, 0.3, 1]} pos={[0, 0.25, 0]} m={{ kind: 'insul', ch: 'body' }} />
      {[0, 1, 2, 3].map((i) => <Box key={i} s={[0.06, 0.3, 0.06]} pos={[Math.cos(i * 1.5708 + 0.785) * 0.45, 0.15, Math.sin(i * 1.5708 + 0.785) * 0.45]} m={{ kind: 'darksteel' }} />)}
      {[0.6, 1.15, 1.7].map((y) => <Tor key={y} R={0.605} r={0.012} rot={[Math.PI / 2, 0, 0]} pos={[0, y, 0]} m={{ kind: 'alu', ch: 'body' }} />)}
      <Box s={[0.2, 0.28, 0.012]} pos={[0, 1.4, 0.6]} m={{ kind: 'alu' }} />
      <Cyl r={0.05} h={0.3} pos={[-0.35, 2.15, 0]} m={{ kind: 'steel', ch: 'fluid' }} />
      <CylX r={0.05} h={0.12} pos={[0.6, 0.35, 0]} m={{ kind: 'steel', ch: 'fluid' }} />
    </group>
  );
}
function AirCompressor() {
  const s = useUI((st) => st.running);
  return (
    <group>
      <CylX r={0.33} h={1.5} pos={[0, 0.45, 0]} m={{ kind: 'red', ch: 'casing', ax: 'x', lo: -0.8, hi: 0.8 }} />
      <Sph r={0.33} sc={[0.4, 1, 1]} pos={[-0.75, 0.45, 0]} m={{ kind: 'red', ch: 'casing' }} /><Sph r={0.33} sc={[0.4, 1, 1]} pos={[0.75, 0.45, 0]} m={{ kind: 'red', ch: 'casing' }} />
      {[-0.5, 0.5].map((x) => <Box key={x} s={[0.08, 0.14, 0.5]} pos={[x, 0.07, 0]} m={{ kind: 'darksteel' }} />)}
      <Box s={[1.3, 0.04, 0.6]} pos={[0, 0.8, 0]} m={{ kind: 'darksteel' }} />
      <CylX r={0.15} h={0.42} pos={[0.35, 1.0, 0]} m={{ kind: 'blue', ch: 'motor' }} />
      <Box s={[0.36, 0.34, 0.34]} pos={[-0.35, 1.0, 0]} m={{ kind: 'darksteel', ch: 'head' }} />
      {[0, 1, 2, 3, 4, 5].map((i) => <Box key={i} s={[0.4, 0.012, 0.4]} pos={[-0.35, 1.2 + i * 0.03, 0]} m={{ kind: 'alu', ch: 'head' }} shadow={false} />)}
      <Spin axis="x" pos={[0.1, 1.0, 0]} rate={() => (s ? 25 : 0)}><Cyl r={0.17} h={0.04} rot={[0, 0, Math.PI / 2]} m={{ kind: 'black' }} />{[0, 1, 2].map((i) => <Box key={i} s={[0.03, 0.3, 0.03]} rot={[i * 1.047, 0, 0]} m={{ kind: 'grey' }} />)}</Spin>
      <Cyl r={0.09} h={0.16} pos={[-0.45, 1.4, 0]} m={{ kind: 'black' }} />
      <Cyl r={0.05} h={0.04} rot={[Math.PI / 2, 0, 0]} pos={[0.55, 0.45, 0.34]} m={{ kind: 'white' }} />
    </group>
  );
}
function CheckValve({ c }: { c: CompInstance }) {
  const dn = (c.params.D_mm as number) ?? 100, r = R(dn);
  return (
    <SpoolBody c={c} dn={dn}>
      <Sph r={r * 2.1} sc={[1.3, 1, 1]} pos={[0, 0.2, 0]} m={{ kind: 'darksteel', ch: 'body' }} />
      <Cyl r={r * 1.6} h={0.05} pos={[0, 0.2 + r * 2.0, 0]} m={{ kind: 'darksteel', ch: 'body' }} />
      <Box s={[0.08, 0.008, 0.03]} pos={[0, 0.2 + r * 2.1, 0.02]} m={{ kind: 'alu' }} />
    </SpoolBody>
  );
}
function Strainer({ c }: { c: CompInstance }) {
  const dn = (c.params.D_mm as number) ?? 100, r = R(dn);
  return (
    <SpoolBody c={c} dn={dn} len={0.6}>
      <Sph r={r * 1.7} sc={[1.4, 1, 1]} pos={[0, 0.2, 0]} m={{ kind: 'darksteel', ch: 'body' }} />
      <Cyl r={r * 1.1} h={0.22} pos={[0.07, 0.11, 0]} rot={[0, 0, 0.75]} m={{ kind: 'darksteel', ch: 'body' }} />
      <Cyl r={r * 1.35} h={0.03} pos={[0.13, 0.04, 0]} rot={[0, 0, 0.75]} m={{ kind: 'steel', ch: 'body' }} />
    </SpoolBody>
  );
}

/* ------------------------------------------------------------------ architecture -------------------- */
/** registry of walkable surfaces (consumed by the scene's placement raycasts) */
export const walkSet = new Set<THREE.Object3D>();
export function pruneWalk() { for (const o of walkSet) { let r: THREE.Object3D | null = o; while (r?.parent) r = r.parent; if (!(r as THREE.Scene)?.isScene) walkSet.delete(o); } }
const tileGrid = (W: number, D: number) => { const pts: number[] = []; for (let x = -W / 2; x <= W / 2 + 1e-6; x += 0.6) pts.push(x, 0, -D / 2, x, 0, D / 2); for (let z = -D / 2; z <= D / 2 + 1e-6; z += 0.6) pts.push(-W / 2, 0, z, W / 2, 0, z); return new Float32Array(pts); };
function Lines({ pts, y, color }: { pts: Float32Array; y: number; color: string }) {
  const g = useMemo(() => { const b = new THREE.BufferGeometry(); b.setAttribute('position', new THREE.BufferAttribute(pts, 3)); return b; }, [pts]);
  return <lineSegments geometry={g} position={[0, y, 0]}><lineBasicMaterial color={color} transparent opacity={0.6} /></lineSegments>;
}
const pedGeom = new THREE.CylinderGeometry(0.02, 0.02, 1, 6);
function RaisedFloorBody({ W, D, H, perf = false }: { W: number; D: number; H: number; perf?: boolean }) {
  const mode = useUI((s) => s.renderMode); const ghost = useContext(GhostCtx);
  const peds = useMemo(() => { const a: THREE.Matrix4[] = []; for (let x = -W / 2 + 0.3; x < W / 2; x += 0.6) for (let z = -D / 2 + 0.3; z < D / 2; z += 0.6) if (Math.abs(x) > W / 2 - 1.3 || Math.abs(z) > D / 2 - 1.3) a.push(matrix([x, (H - 0.04) / 2, z], [0, 0, 0], [1, H - 0.04, 1])); return a; }, [W, D, H]);
  const grid = useMemo(() => tileGrid(W, D), [W, D]);
  const perfTiles = useMemo(() => { const a: V3[] = []; if (!perf) return a; for (let x = -W / 2 + 0.3; x < W / 2; x += 0.6) if (Math.round((x + W / 2 - 0.3) / 0.6) % 4 === 1) for (let z = -D / 2 + 0.9; z < D / 2 - 0.6; z += 0.6) a.push([x, H + 0.001, z]); return a; }, [W, D, H, perf]);
  return (
    <group>
      <mesh position={[0, H - 0.02, 0]} receiveShadow castShadow userData={{ walk: true }} ref={(m) => { if (m && !ghost) walkSet.add(m); }}><boxGeometry args={[W, 0.04, D]} /><Mat kind="grey" ch="amb" color="#d9dbdc" /></mesh>
      <Inst geom={pedGeom} mats={peds} m={{ kind: 'galv', ch: 'amb' }} shadow={false} />
      {perfTiles.map((p, i) => <mesh key={i} position={p} rotation-x={-Math.PI / 2}><planeGeometry args={[0.58, 0.58]} /><Mat kind="darksteel" ch="amb" color="#8f9599" /></mesh>)}
      {mode === 'pbr' && <Lines pts={grid} y={H + 0.002} color="#7b8086" />}
      {[[0, -D / 2], [0, D / 2]].map(([x, z], i) => <Box key={i} s={[W, H, 0.02]} pos={[x, H / 2, z]} m={{ kind: 'darksteel', ch: 'amb', opacity: 0.35 }} shadow={false} />)}
    </group>
  );
}
function CeilingBody({ W, D, H, op = 1 }: { W: number; D: number; H: number; op?: number }) {
  const mode = useUI((s) => s.renderMode); const grid = useMemo(() => tileGrid(W, D), [W, D]);
  const lights = useMemo(() => { const a: V3[] = []; for (let x = -W / 2 + 1.5; x < W / 2 - 0.5; x += 2.4) for (let z = -D / 2 + 1.5; z < D / 2 - 0.5; z += 2.4) a.push([x, H - 0.01, z]); return a; }, [W, D, H]);
  return (
    <group>
      <mesh position={[0, H + 0.01, 0]} receiveShadow><boxGeometry args={[W, 0.02, D]} /><Mat kind="white" ch="amb" color="#eeeeec" opacity={op} side={THREE.DoubleSide} /></mesh>
      {mode === 'pbr' && <Lines pts={grid} y={H - 0.002} color="#a7aaad" />}
      {lights.map((p, i) => <mesh key={i} position={p} rotation-x={Math.PI / 2}><planeGeometry args={[0.58, 1.18]} /><meshStandardMaterial color="#ffffff" emissive="#fff8ec" emissiveIntensity={mode === 'pbr' ? 1.4 : 0} side={THREE.DoubleSide} /></mesh>)}
      {[[-W / 2 + 0.6, -D / 2 + 0.6], [W / 2 - 0.6, -D / 2 + 0.6], [-W / 2 + 0.6, D / 2 - 0.6], [W / 2 - 0.6, D / 2 - 0.6]].map(([x, z], i) => <Box key={i} s={[0.01, 0.6, 0.01]} pos={[x, H + 0.3, z]} m={{ kind: 'galv', ch: 'amb' }} shadow={false} />)}
    </group>
  );
}
const FINISH: Record<string, { color: string; rough: number; metal: number; op?: number }> = {
  paint: { color: '#e6e4df', rough: 0.9, metal: 0 }, concrete: { color: '#a9a8a3', rough: 0.95, metal: 0 }, block: { color: '#c4bdb0', rough: 0.97, metal: 0 },
  panel: { color: '#f1f3f4', rough: 0.45, metal: 0.25 }, glass: { color: '#cfe8f5', rough: 0.05, metal: 0, op: 0.3 },
};
const noRay = () => { /* not pickable while faded */ };
const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _q = new THREE.Quaternion(), _a = new THREE.Vector3(), _b = new THREE.Vector3();
/** wall panel that fades out when it stands between the camera and the room ("face": outward normal toward the camera; "between": crosses the line of sight) */
function FadeWall({ size, pos, n, finish, base, auto, rule, center }: { size: V3; pos: V3; n: V3; finish: string; base: number; auto: boolean; rule: 'face' | 'between'; center?: V3 }) {
  const ref = useRef<THREE.Mesh>(null); const mref = useRef<THREE.MeshStandardMaterial>(null); const ghost = useContext(GhostCtx); const cur = useRef(-1); const hid = useRef(false);
  const f = FINISH[finish] ?? FINISH.paint; const b0 = Math.min(base, f.op ?? 1);
  useFrame(({ camera }, dt) => {
    const m = ref.current, mat = mref.current; if (!m || !mat || !m.parent) return;
    let hide = false;
    if (auto) {
      if (rule === 'face') {
        m.parent.getWorldQuaternion(_q); _v.set(...n).applyQuaternion(_q); _w.set(...(center ?? [0, 0, 0])); m.parent.localToWorld(_w);
        const d = _a.copy(camera.position).sub(_w); d.y = 0; const L = d.length(); if (L > 1e-3) hide = _v.x * d.x / L + _v.z * d.z / L > 0.38;
      } else {
        // line of sight camera -> orbit target crosses the wall slab (in the wall's local frame)
        const tg = camera.userData.target as THREE.Vector3 | undefined;
        if (tg) { m.worldToLocal(_a.copy(camera.position)); m.worldToLocal(_b.copy(tg)); const za = _a.z, zb = _b.z;
          if (za * zb < 0 || Math.abs(zb) < size[2]) { const t = za / (za - zb || 1e-9); const x = _a.x + (_b.x - _a.x) * t; const y = _a.y + (_b.y - _a.y) * t; hide = Math.abs(x) < size[0] / 2 + 0.4 && y < size[1] / 2 + 0.6; } }
      }
    }
    const tgt = hide ? Math.min(b0, 0.1) : b0; cur.current = cur.current < 0 ? tgt : cur.current + (tgt - cur.current) * Math.min(1, dt * 9);
    mat.opacity = cur.current; const tr = cur.current < 0.995; if (mat.transparent !== tr) { mat.transparent = tr; mat.needsUpdate = true; } mat.depthWrite = cur.current > 0.6;
    if (hid.current !== hide) { hid.current = hide; m.raycast = hide ? noRay : THREE.Mesh.prototype.raycast; m.castShadow = !hide; rt.geoRev++; }
  });
  if (ghost) return <Box s={size} pos={pos} />;
  return <mesh ref={ref} position={pos} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial ref={mref} color={f.color} roughness={f.rough} metalness={f.metal} /></mesh>;
}
type Side = 'front' | 'back' | 'left' | 'right';
function Room({ c }: { c: CompInstance }) {
  const n = (k: string) => c.params[k] as number; const W = n('W'), D = n('D'), H = n('H'), t = n('t'), op = n('op') / 100, rf = n('rf');
  const fin = (c.params.finish as string) ?? 'paint', auto = c.params.autohide !== false;
  const mode = useUI((st) => st.renderMode);
  if (mode === 'ir') return rf > 0 ? <RaisedFloorBody W={W} D={D} H={rf} perf /> : null; // thermal view: walls/ceiling hidden so the equipment stays visible
  const side = ((c.params.door_side as string) ?? 'front') as Side, door = !!c.params.door;
  const sides: { s: Side; n: V3; along: 'x' | 'z'; len: number; at: V3 }[] = [
    { s: 'back', n: [0, 0, -1], along: 'x', len: W + 2 * t, at: [0, H / 2, -D / 2 - t / 2] }, { s: 'front', n: [0, 0, 1], along: 'x', len: W + 2 * t, at: [0, H / 2, D / 2 + t / 2] },
    { s: 'left', n: [-1, 0, 0], along: 'z', len: D, at: [-W / 2 - t / 2, H / 2, 0] }, { s: 'right', n: [1, 0, 0], along: 'z', len: D, at: [W / 2 + t / 2, H / 2, 0] },
  ];
  const ctr: V3 = [0, H / 2, 0];
  const panels: { size: V3; pos: V3; n: V3; k: string }[] = [];
  const dims = (along: 'x' | 'z', l: number, h: number): V3 => (along === 'x' ? [l, h, t] : [t, h, l]);
  const at = (base: V3, along: 'x' | 'z', off: number, y: number): V3 => (along === 'x' ? [base[0] + off, y, base[2]] : [base[0], y, base[2] + off]);
  let doorGeo: { pos: V3; size: V3; along: 'x' | 'z'; dw: number; dh: number } | null = null;
  for (const w of sides) {
    if (!(door && w.s === side)) { panels.push({ size: dims(w.along, w.len, H), pos: w.at, n: w.n, k: w.s }); continue; }
    const dw = Math.min(n('door_w') || 1.2, w.len - 0.4), dh = Math.min(n('door_h') || 2.2, H - 0.15), sw = (w.len - dw) / 2;
    panels.push({ size: dims(w.along, sw, H), pos: at(w.at, w.along, -(dw / 2 + sw / 2), H / 2), n: w.n, k: w.s + 'a' });
    panels.push({ size: dims(w.along, sw, H), pos: at(w.at, w.along, dw / 2 + sw / 2, H / 2), n: w.n, k: w.s + 'b' });
    panels.push({ size: dims(w.along, dw, H - dh), pos: at(w.at, w.along, 0, dh + (H - dh) / 2), n: w.n, k: w.s + 'c' });
    doorGeo = { pos: at(w.at, w.along, 0, dh / 2), size: w.along === 'x' ? [dw * 0.96, dh - 0.02, 0.05] : [0.05, dh - 0.02, dw * 0.96], along: w.along, dw, dh };
  }
  return (
    <group>
      {panels.map((p) => <FadeWall key={p.k} size={p.size} pos={p.pos} n={p.n} finish={fin} base={op} auto={auto} rule="face" center={ctr} />)}
      {doorGeo && <>
        <Box s={doorGeo.size} pos={doorGeo.pos} m={{ kind: 'glass', ch: 'amb' }} shadow={false} />
        {[-1, 1].map((k) => <Box key={k} s={doorGeo!.along === 'x' ? [0.05, doorGeo!.dh, t + 0.02] : [t + 0.02, doorGeo!.dh, 0.05]} pos={at(doorGeo!.pos, doorGeo!.along, k * doorGeo!.dw / 2, doorGeo!.dh / 2)} m={{ kind: 'darksteel', ch: 'amb' }} />)}
      </>}
      {rf > 0 && <RaisedFloorBody W={W} D={D} H={rf} perf />}
      {!!c.params.ceil && <CeilingBody W={W} D={D} H={Math.min(n('ch'), H - 0.05)} op={op} />}
    </group>
  );
}
function Wall({ c }: { c: CompInstance }) {
  const n = (k: string) => c.params[k] as number; const ir = useUI((st) => st.renderMode) === 'ir';
  if (ir) return <lineSegments position={[0, n('H') / 2, 0]}><edgesGeometry args={[new THREE.BoxGeometry(n('L'), n('H'), n('t'))]} /><lineBasicMaterial color="#6b5aa8" /></lineSegments>;
  return <FadeWall size={[n('L'), n('H'), n('t')]} pos={[0, n('H') / 2, 0]} n={[0, 0, 1]} finish={(c.params.finish as string) ?? 'paint'} base={n('op') / 100} auto={c.params.autohide !== false} rule="between" />;
}
function RaisedFloor({ c }: { c: CompInstance }) { const n = (k: string) => c.params[k] as number; return <RaisedFloorBody W={n('W')} D={n('D')} H={n('H')} perf={!!c.params.perf} />; }
function Ceiling({ c }: { c: CompInstance }) { const n = (k: string) => c.params[k] as number; const ir = useUI((st) => st.renderMode) === 'ir'; return ir ? null : <CeilingBody W={n('W')} D={n('D')} H={n('H')} op={n('op') / 100} />; }
function Column({ c }: { c: CompInstance }) { const n = (k: string) => c.params[k] as number; return <Box s={[n('W'), n('H'), n('W')]} pos={[0, n('H') / 2, 0]} m={{ kind: 'concrete', ch: 'amb', color: '#b9b8b3' }} />; }

const MODELS: Record<string, (p: { c: CompInstance }) => JSX.Element | null> = {
  rack: Rack, pump: Pump, valve: Valve, expansion_valve: ExpValve, flow_meter: FlowMeter, pressure_sensor: PressureSensor, temp_sensor: TempSensor,
  manifold_split: Manifold, manifold_merge: Manifold, exp_tank: ExpTank, plate_hx: PlateHX, cdu: CDU, chiller: Chiller, cooling_tower: CoolingTower, boiler: Boiler,
  steam_turbine: (p) => <Turbine {...p} gas={false} />, gas_turbine: (p) => <Turbine {...p} gas />, condenser: Condenser, evaporator: Evaporator,
  compressor_centrifugal: (p) => <Compressor {...p} centrifugal />, compressor_recip: (p) => <Compressor {...p} centrifugal={false} />,
  shell_tube_hx: ShellTubeHX, dry_cooler: DryCooler, crah: Crah, buffer_tank: BufferTank, air_compressor: AirCompressor, check_valve: CheckValve, strainer: Strainer,
  room: Room, wall: Wall, raised_floor: RaisedFloor, ceiling: Ceiling, column: Column,
};
const NOZ_LEN: Record<string, Record<string, number>> = {
  manifold_split: { out1: 0.18, out2: 0.18, out3: 0.18, out4: 0.18, in: 0.2 }, manifold_merge: { in1: 0.18, in2: 0.18, in3: 0.18, in4: 0.18, out: 0.2 },
  rack: { in: 0.2, out: 0.2 }, cooling_tower: { in: 0.14, out: 0.14 }, exp_tank: { ref: 0.12 },
};

/** Complete model of a component (procedural body + nozzles/flanges), driven by live telemetry. */
export function ProceduralBody({ comp, ghost = false }: { comp: CompInstance; ghost?: boolean }) {
  const th = useRef<Ch>({});
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    const g = group.current; if (g) { g.position.set(comp.pos[0], comp.pos[1], comp.pos[2]); g.rotation.y = comp.rotY; }
    if (useUI.getState().renderMode === 'ir' || !th.current.amb) th.current = channelsOf(comp, rt.sim.telemetry.get(comp.id), rt.sim.amb.T);
  });
  const Model = MODELS[comp.type];
  return (
    <GhostCtx.Provider value={ghost}><CompCtx.Provider value={comp}><ThermalCtx.Provider value={th}>
      <group ref={group} position={comp.pos} rotation-y={comp.rotY} userData={{ comp: comp.id }}>
        {Model && <Model c={comp} />}
        <PortNozzles comp={comp} len={NOZ_LEN[comp.type]} />
      </group>
    </ThermalCtx.Provider></CompCtx.Provider></GhostCtx.Provider>
  );
}
/** channel provider for arbitrary subtrees (pipes, GLB wrappers) */
export const ThermalProvider = ThermalCtx.Provider;
export const GhostProvider = GhostCtx.Provider;
