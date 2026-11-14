/** Industrial factory scene: PBR hall + concrete floor, lights/env/AO, IR mode, drag/drop placement, snapping, pipe tool. */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Grid, Html, Lightformer, OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { EffectComposer, N8AO, SMAA, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import * as THREE from 'three';
import { useUI } from '../store';
import { addComponent, addLink, addPipe, advance, commit, compMap, fpOf, getComp, moveComponent, offerSuggestions, pipeRoute, rebuild, rt, scene, setVia, snapPorts, snapV } from '../runtime';
import { SPECS, defaultParams, footprintOf } from '../physics/components';
import { portsOf, worldPort } from '../physics/geometry';
import type { CompInstance } from '../physics/engineTypes';
import { TEMPLATES } from '../physics/templates';
import { ProceduralBody, Mat, ThermalProvider, channelsOf, pruneWalk, walkSet, type Ch } from './ProceduralComponents';
import { PipeView } from './Pipes';
import { GlbBody, hasAsset, useAssets } from './AssetLoader';
import { IR, fmtT } from './ThermalShader';
import { checkComp } from '../ui/safety';

/* ---------------------------------------------------------------- shared interaction state ----- */
export const view = {
  pick: (_cx: number, _cy: number): [number, number] | null => null,
  toScreen: (_x: number, _y: number, _z: number): [number, number] => [0, 0],
  reset: () => { /* set by CameraRig */ },
  fit: () => { /* set by CameraRig */ },
  preset: (_n: 'iso' | 'front' | 'back' | 'left' | 'right' | 'top') => { /* set by CameraRig */ },
  orbit: (_az: number, _pol: number) => { /* set by CameraRig */ },
  pan: (_dx: number, _dy: number) => { /* set by CameraRig */ },
  zoom: (_k: number) => { /* set by CameraRig */ },
  camera: null as THREE.Camera | null, fps: 0,
  controls: null as null | { enabled: boolean; target: THREE.Vector3 },
  getCam: (): { pos: [number, number, number]; target: [number, number, number] } | undefined => undefined,
  pendingCam: null as null | { pos: [number, number, number]; target: [number, number, number] },
  pickWalk: (_cx: number, _cy: number): [number, number, number] | null => null,
  rayPlaneY: (_cx: number, _cy: number, _y: number): [number, number, number] | null => null,
  downHit: false,
  walkHit: (_cx: number, _cy: number, _skip?: string): THREE.Vector3 | null => null,
  wallStart: null as null | [number, number, number],
  hdrag: null as null | { pipe: string; idx: number; y0: number; cy0: number; vert: boolean; moved: boolean },
  setCam: (_p: [number, number, number], _t: [number, number, number]) => { /* set by CameraRig */ },
  cursor: new THREE.Vector3(),
  drag: null as null | { id: string; off: [number, number] | null; moved: boolean },
  ghost: null as CompInstance | null,
  snapRes: null as ReturnType<typeof snapPorts>,
};
const snapG = (v: number) => { const s = useUI.getState().snap; return s > 0 ? Math.round(v / s) * s : v; };

function ViewBridge() {
  const { gl, camera, scene: sc3 } = useThree();
  useEffect(() => {
    view.camera = camera;
    const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), p = new THREE.Vector3();
    view.toScreen = (x, y, z) => { const r = gl.domElement.getBoundingClientRect(); const v = new THREE.Vector3(x, y, z).project(camera); return [r.left + ((v.x + 1) / 2) * r.width, r.top + ((1 - v.y) / 2) * r.height]; };
    view.pick = (cx, cy) => {
      const r = gl.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
      return ray.ray.intersectPlane(plane, p) ? [p.x, p.z] : null;
    };
    const setRay = (cx: number, cy: number) => { const r = gl.domElement.getBoundingClientRect(); ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera); };
    view.pickWalk = (cx, cy) => {
      const w = view.walkHit(cx, cy); if (w) return [w.x, w.y, w.z]; setRay(cx, cy); void sc3;
      return ray.ray.intersectPlane(plane, p) ? [p.x, 0, p.z] : null;
    };
    view.walkHit = (cx, cy, skip) => {
      pruneWalk(); if (!walkSet.size) return null; setRay(cx, cy);
      const hit = ray.intersectObjects([...walkSet], false).find((i) => !skip || !isChildOf(i.object, skip)); return hit ? hit.point.clone() : null;
    };
    view.rayPlaneY = (cx, cy, y) => { setRay(cx, cy); const pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -y); return ray.ray.intersectPlane(pl, p) ? [p.x, p.y, p.z] : null; };
    const reset = () => { view.downHit = false; }; window.addEventListener('pointerdown', reset, true);
    return () => window.removeEventListener('pointerdown', reset, true);
  }, [gl, camera]);
  return null;
}

function SimDriver() {
  const acc = useRef(0); const fr = useRef({ n: 0, t: 0 });
  useFrame((_, dt) => {
    fr.current.n++; fr.current.t += dt; if (fr.current.t > 0.5) { view.fps = fr.current.n / fr.current.t; fr.current = { n: 0, t: 0 }; }
    const ui = useUI.getState();
    advance(Math.min(dt, 0.1));
    IR.palette = ui.palette;
    acc.current += dt;
    if (acc.current > 0.25) {
      acc.current = 0;
      if (ui.renderMode !== 'ir') { /* nothing to range */ } else if (ui.irAuto) {
        // robust range from visible *surface* temperatures (insulated pipes stay cool, bare flanges / casings are hot)
        const amb = rt.sim.amb.T; const vals: number[] = [amb];
        for (const c of rt.sim.scene.comps) {
          const t = rt.sim.telemetry.get(c.id); if (!t) continue;
          if (c.type === 'pipe') { if (typeof t.T_surf === 'number') vals.push(t.T_surf); continue; }
          const ch = channelsOf(c, t, amb); for (const [k, v] of Object.entries(ch)) { if (k.startsWith('p:') || k === 'amb' || k === 'dark' || k === 'flame') continue; vals.push(v[0], v[1]); }
        }
        vals.sort((x, y) => x - y); const lo0 = vals[0], hi0 = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.93))];
        const lo = lo0 - 3, hi = Math.max(hi0 + 4, lo + 20);
        IR.tMin += (lo - IR.tMin) * 0.25; IR.tMax += (hi - IR.tMax) * 0.25;
      } else { IR.tMin = ui.irMin; IR.tMax = ui.irMax; }
      useUI.setState({ tick: ui.tick + 1 });
    }
  });
  return null;
}

type Ctl = { enabled: boolean; target: THREE.Vector3; update(): void; getAzimuthalAngle(): number; getPolarAngle(): number; setAzimuthalAngle(a: number): void; setPolarAngle(a: number): void; mouseButtons: Record<string, number>; maxPolarAngle: number };
const DIRS: Record<string, [number, number, number]> = { iso: [1, 0.85, 1], front: [0, 0.02, 1], back: [0, 0.02, -1], right: [1, 0.02, 0], left: [-1, 0.02, 0], top: [0, 1, 0.001] };
function sceneBounds() {
  const b = new THREE.Box3(); let any = false;
  for (const c of scene().comps) { if (c.type === 'pipe') continue; const f = footprintOf(c), r = Math.max(f[0], f[2]) / 2; b.expandByPoint(new THREE.Vector3(c.pos[0] - r, c.pos[1], c.pos[2] - r)); b.expandByPoint(new THREE.Vector3(c.pos[0] + r, c.pos[1] + f[1], c.pos[2] + r)); any = true; }
  if (!any) b.set(new THREE.Vector3(-4, 0, -4), new THREE.Vector3(4, 3, 4));
  return b;
}
/** SolidWorks-style camera: MMB rotate, Ctrl+MMB pan, Shift+MMB zoom, wheel zoom-to-cursor, MMB double-click = zoom to fit, animated standard views */
function CameraRig() {
  const controls = useThree((s) => s.controls) as unknown as Ctl | null;
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera; const gl = useThree((s) => s.gl);
  const tid = useUI((s) => s.templateId);
  const anim = useRef<null | { p0: THREE.Vector3; t0: THREE.Vector3; p1: THREE.Vector3; t1: THREE.Vector3; k: number }>(null);
  useEffect(() => {
    if (!controls) return;
    const fly = (p: THREE.Vector3, t: THREE.Vector3, instant = false) => {
      if (instant) { camera.position.copy(p); controls.target.copy(t); controls.update(); anim.current = null; }
      else anim.current = { p0: camera.position.clone(), t0: controls.target.clone(), p1: p, t1: t, k: 0 };
    };
    const fitDist = (b: THREE.Box3) => { const r = b.getSize(new THREE.Vector3()).length() / 2; return Math.min(88, Math.max(3, (r / Math.sin((camera.fov * Math.PI) / 360)) * 1.05)); };
    const home = (instant = false) => { const t = TEMPLATES.find((x) => x.id === useUI.getState().templateId); fly(new THREE.Vector3(...(t?.camera ?? [10, 8, 14])), new THREE.Vector3(...(t?.target ?? [0, 1, 0])), instant); };
    view.controls = controls; view.getCam = () => ({ pos: camera.position.toArray() as [number, number, number], target: controls.target.toArray() as [number, number, number] });
    view.reset = () => home(); view.setCam = (p, t) => fly(new THREE.Vector3(...p), new THREE.Vector3(...t), true);
    view.fit = () => { const b = sceneBounds(), c = b.getCenter(new THREE.Vector3()); const dir = camera.position.clone().sub(controls.target).normalize(); fly(c.clone().addScaledVector(dir, fitDist(b)), c); };
    view.preset = (n) => { const b = sceneBounds(), c = b.getCenter(new THREE.Vector3()); fly(c.clone().addScaledVector(new THREE.Vector3(...DIRS[n]).normalize(), fitDist(b)), c); };
    view.orbit = (az, pol) => { anim.current = null; controls.setAzimuthalAngle(controls.getAzimuthalAngle() + az); controls.setPolarAngle(Math.min(controls.maxPolarAngle, Math.max(0.02, controls.getPolarAngle() + pol))); controls.update(); };
    view.pan = (dx, dy) => { anim.current = null; const d = camera.position.distanceTo(controls.target) * 0.08; const r = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0), u = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1); const off = r.multiplyScalar(dx * d).add(u.multiplyScalar(dy * d)); camera.position.add(off); controls.target.add(off); controls.update(); };
    view.zoom = (k) => { anim.current = null; const off = camera.position.clone().sub(controls.target); const d = Math.min(90, Math.max(2, off.length() * k)); camera.position.copy(controls.target).addScaledVector(off.normalize(), d); controls.update(); };
    if (view.pendingCam) { fly(new THREE.Vector3(...view.pendingCam.pos), new THREE.Vector3(...view.pendingCam.target), true); view.pendingCam = null; } else home(true);
    // SolidWorks mouse mapping (resolved before OrbitControls sees the event)
    const el = gl.domElement.parentElement ?? gl.domElement; let lastMid = 0;
    const down = (e: PointerEvent) => {
      if (e.button !== 1) return; e.preventDefault(); anim.current = null;
      const dolly = e.shiftKey && !e.ctrlKey;
      controls.mouseButtons.MIDDLE = dolly ? THREE.MOUSE.DOLLY : THREE.MOUSE.ROTATE; // Ctrl+ROTATE => pan inside OrbitControls
      if (dolly) { (controls as unknown as { zoomSpeed: number }).zoomSpeed = 1.1; window.addEventListener('pointerup', () => { (controls as unknown as { zoomSpeed: number }).zoomSpeed = useUI.getState().wheelReverse ? -1.1 : 1.1; }, { once: true }); } // drag up = zoom in (as in SolidWorks)
      const now = performance.now(); if (now - lastMid < 320) view.fit(); lastMid = now;
    };
    const noAuto = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    el.addEventListener('pointerdown', down, true); el.addEventListener('mousedown', noAuto); el.addEventListener('auxclick', noAuto);
    return () => { el.removeEventListener('pointerdown', down, true); el.removeEventListener('mousedown', noAuto); el.removeEventListener('auxclick', noAuto); };
  }, [camera, controls, gl, tid]);
  // game-style fly: W/S along the view direction, A/D sideways, Q/E down/up, Shift = faster
  const keys = useRef(new Set<string>());
  useEffect(() => {
    const typing = (e: KeyboardEvent) => { const el = e.target as HTMLElement; return !!el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName); };
    const dn = (e: KeyboardEvent) => { if (typing(e) || e.ctrlKey || e.metaKey || e.altKey) return; if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE'].includes(e.code)) { keys.current.add(e.code); e.preventDefault(); } if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.current.add('Shift'); };
    const up = (e: KeyboardEvent) => { keys.current.delete(e.code); if (e.key === 'Shift') keys.current.delete('Shift'); };
    const clr = () => keys.current.clear();
    window.addEventListener('keydown', dn); window.addEventListener('keyup', up); window.addEventListener('blur', clr);
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up); window.removeEventListener('blur', clr); };
  }, []);
  // mouse-look: hold the left button on empty space and drag to turn the view (first-person)
  useEffect(() => {
    if (!controls) return; const host = gl.domElement.parentElement ?? gl.domElement;
    const look = (dx: number, dy: number) => {
      const dir = controls.target.clone().sub(camera.position); const d = Math.max(dir.length(), 2); const sp = new THREE.Spherical().setFromVector3(dir);
      sp.theta -= dx * 0.0024; sp.phi = Math.min(Math.PI - 0.05, Math.max(0.05, sp.phi + dy * 0.0024)); sp.radius = d;
      controls.target.copy(camera.position).add(new THREE.Vector3().setFromSpherical(sp)); controls.update(); anim.current = null;
    };
    let dragLook = false;
    const move = (e: MouseEvent) => { if (dragLook) look(e.movementX, e.movementY); };
    // runs after the 3D scene handled the press (bubble phase on window): only empty space starts a look-drag
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || !host.contains(e.target as Node) || view.downHit || view.drag || view.hdrag) return;
      dragLook = true; document.body.style.cursor = 'grabbing';
    };
    const up = () => { if (dragLook) { dragLook = false; document.body.style.cursor = ''; } };
    document.addEventListener('mousemove', move); window.addEventListener('pointerdown', down); window.addEventListener('pointerup', up);
    return () => { document.removeEventListener('mousemove', move); window.removeEventListener('pointerdown', down); window.removeEventListener('pointerup', up); };
  }, [controls, camera, gl]);
  const fwd = useMemo(() => new THREE.Vector3(), []), right = useMemo(() => new THREE.Vector3(), []), mv = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    if (controls) camera.userData.target = controls.target;
    const k = keys.current;
    if (controls && k.size && [...k].some((x) => x !== 'Shift')) {
      anim.current = null; dt = Math.min(dt, 0.05);
      camera.getWorldDirection(fwd).normalize(); right.crossVectors(fwd, camera.up); if (right.lengthSq() < 1e-6) right.set(1, 0, 0); right.normalize(); // W/S along the true view direction (fly camera)
      mv.set(0, 0, 0);
      if (k.has('KeyW')) mv.add(fwd); if (k.has('KeyS')) mv.sub(fwd); if (k.has('KeyD')) mv.add(right); if (k.has('KeyA')) mv.sub(right);
      if (k.has('KeyE')) mv.y += 1; if (k.has('KeyQ')) mv.y -= 1;
      if (mv.lengthSq() > 0) {
        const dist = camera.position.distanceTo(controls.target); const speed = Math.max(2.5, dist * 0.8) * (k.has('Shift') ? 2.5 : 1);
        mv.normalize().multiplyScalar(speed * dt);
        if (camera.position.y + mv.y < 0.3) mv.y = 0.3 - camera.position.y; // don't fly through the floor
        camera.position.add(mv); controls.target.add(mv); controls.update();
      }
    }
    const a = anim.current; if (!a || !controls) return;
    a.k = Math.min(1, a.k + dt / 0.38); const e = 1 - Math.pow(1 - a.k, 3);
    // interpolate on a sphere around the moving target so the view "turns" like a CAD orientation change
    const o0 = a.p0.clone().sub(a.t0), o1 = a.p1.clone().sub(a.t1); const s0 = new THREE.Spherical().setFromVector3(o0), s1 = new THREE.Spherical().setFromVector3(o1);
    let dth = s1.theta - s0.theta; if (dth > Math.PI) dth -= 2 * Math.PI; if (dth < -Math.PI) dth += 2 * Math.PI;
    const sp = new THREE.Spherical(s0.radius + (s1.radius - s0.radius) * e, s0.phi + (s1.phi - s0.phi) * e, s0.theta + dth * e);
    controls.target.lerpVectors(a.t0, a.t1, e); camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(sp)); controls.update();
    if (a.k >= 1) anim.current = null;
  });
  return null;
}

export const BG = { dark: '#1a1a1c', light: '#e4e5e7', ir: '#030308' };
/* ---------------------------------------------------------------- environment / hall ----------- */
function noiseTexture(seed: number, base: number, amp: number, size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d')!;
  const img = g.createImageData(size, size); let s = seed;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < size * size; i++) { const v = base + (rnd() - 0.5) * amp; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(0,0,0,${0.006 + rnd() * 0.012})`; g.beginPath(); g.arc(rnd() * size, rnd() * size, 4 + rnd() * 22, 0, 6.283); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(40, 40); t.anisotropy = 8; return t;
}
function Hall() {
  const th = useRef<Ch>({ amb: [300, 300] });
  const mode = useUI((s) => s.renderMode); const dark = useUI((s) => s.theme) === 'dark';
  const tex = useMemo(() => ({ map: noiseTexture(7, 138, 40), rough: noiseTexture(11, 215, 40), bump: noiseTexture(23, 128, 90) }), []);
  useFrame(() => { const T = rt.sim.amb.T; th.current = { amb: [T, T], wall: [T, T] }; });
  const cols = [-36, -24, -12, 0, 12, 24, 36];
  return (
    <ThermalProvider value={th}>
      <mesh rotation-x={-Math.PI / 2} receiveShadow><planeGeometry args={[160, 160]} />
        <Mat key={dark ? "d" : "l"} kind="concrete" ch="amb" color={dark ? "#4a4a4d" : "#c9cacb"} map={tex.map} roughnessMap={tex.rough} bumpMap={tex.bump} />
      </mesh>
      {mode === 'pbr' && <Grid position={[0, 0.003, 0]} args={[160, 160]} cellSize={1} cellThickness={0.5} cellColor={dark ? "#3a3a3d" : "#a9aaad"} sectionSize={6} sectionThickness={1.1} sectionColor={dark ? "#5a5a5f" : "#7d7e82"} fadeDistance={55} fadeStrength={1.4} infiniteGrid={false} />}
      <mesh position={[0, 7, -40]} receiveShadow><boxGeometry args={[160, 14, 0.4]} /><Mat key={dark ? "d" : "l"} kind="galv" ch="wall" color={dark ? "#3b3c3f" : "#d4d5d7"} /></mesh>
      <mesh position={[-60, 7, 0]} receiveShadow><boxGeometry args={[0.4, 14, 160]} /><Mat key={dark ? "d" : "l"} kind="galv" ch="wall" color={dark ? "#3b3c3f" : "#d4d5d7"} /></mesh>
      {cols.map((x) => <group key={x} position={[x, 0, -38]}>
        <mesh position={[0, 6, 0]} castShadow receiveShadow><boxGeometry args={[0.6, 12, 0.6]} /><Mat kind="yellow" ch="wall" /></mesh>
        <mesh position={[0, 0.15, 0]} receiveShadow><boxGeometry args={[1.0, 0.3, 1.0]} /><Mat kind="concrete" ch="wall" /></mesh>
      </group>)}
      <mesh position={[0, 12.2, -38]} castShadow><boxGeometry args={[160, 0.5, 0.5]} /><Mat kind="darksteel" ch="wall" /></mesh>
    </ThermalProvider>
  );
}
function Lights() {
  const mode = useUI((s) => s.renderMode); const q = useUI((s) => s.quality); const dark = useUI((s) => s.theme) === 'dark';
  if (mode === 'ir') return null;
  return (
    <>
      <hemisphereLight args={['#f2f2f2', '#5e5e60', dark ? 0.4 : 0.6]} />
      <directionalLight position={[14, 22, 10]} intensity={2.1} castShadow shadow-mapSize={q === 'high' ? [2048, 2048] : [1024, 1024]} shadow-camera-left={-32} shadow-camera-right={32} shadow-camera-top={32} shadow-camera-bottom={-32} shadow-camera-near={1} shadow-camera-far={90} shadow-bias={-0.0004} shadow-normalBias={0.04} />
      <directionalLight position={[-12, 9, -6]} intensity={0.4} color="#ffffff" />
      <Environment resolution={256} frames={1} environmentIntensity={0.75}>
        <color attach="background" args={['#2c2c2e']} />
        <Lightformer form="rect" intensity={4} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={[24, 14, 1]} color="#fff6e8" />
        <Lightformer form="rect" intensity={2} position={[-14, 5, 0]} rotation-y={Math.PI / 2} scale={[14, 5, 1]} color="#ffffff" />
        <Lightformer form="rect" intensity={1.6} position={[14, 5, 6]} rotation-y={-Math.PI / 2} scale={[14, 4, 1]} color="#ffffff" />
        <Lightformer form="ring" intensity={1.2} position={[0, 3, -14]} scale={8} color="#ffe2b8" />
      </Environment>
      <fog attach="fog" args={[BG[dark ? 'dark' : 'light'], 38, 115]} />
    </>
  );
}

/* ---------------------------------------------------------------- selection / ports / labels -- */
function SelectionBox() {
  const sel = useUI((s) => s.selected); const ver = useUI((s) => s.version);
  const g = useRef<THREE.Group>(null);
  const c = sel ? getComp(sel) : undefined; void ver;
  const fk = c && c.type !== 'pipe' ? footprintOf(c).join(',') : '';
  const geom = useMemo(() => { if (!c || c.type === 'pipe') return null; const f = footprintOf(c); return new THREE.EdgesGeometry(new THREE.BoxGeometry(f[0] + 0.1, f[1] + 0.1, f[2] + 0.1)); }, [c?.id, c?.type, fk]);
  const mat = useRef<THREE.LineBasicMaterial>(null); const fade = useRef(0); useEffect(() => { fade.current = 0; }, [sel]);
  useFrame((_, dt) => { if (g.current && c) { g.current.position.set(c.pos[0], c.pos[1], c.pos[2]); g.current.rotation.y = c.rotY; const k = Math.min(1, fade.current + dt * 6); fade.current = k; g.current.scale.setScalar(1.04 - 0.04 * k); if (mat.current) mat.current.opacity = k; } });
  if (!c || !geom) return null;
  return <group ref={g}><lineSegments geometry={geom} position={[0, footprintOf(c)[1] / 2, 0]}><lineBasicMaterial ref={mat} color="#ff8a3d" transparent /></lineSegments></group>;
}

function PortMarkers() {
  const ver = useUI((s) => s.version); const tool = useUI((s) => s.tool); const sel = useUI((s) => s.selected); const start = useUI((s) => s.pipeStart); const show = useUI((s) => s.showPorts);
  const occupied = useMemo(() => {
    const o = new Set<string>(); for (const c of scene().comps) if (c.type === 'pipe') { if (c.from) o.add(c.from.comp + ':' + c.from.port); if (c.to) o.add(c.to.comp + ':' + c.to.port); }
    for (const l of scene().links) { o.add(l.a.comp + ':' + l.a.port); o.add(l.b.comp + ':' + l.b.port); } return o;
  }, [ver]);
  const comps = scene().comps.filter((c) => c.type !== 'pipe' && (tool === 'pipe' || (show && (c.id === sel || tool === 'place'))));
  return <>{comps.map((c) => portsOf(c).map((d) => <PortMarker key={c.id + d.id + ver} comp={c} def={d} occupied={occupied.has(c.id + ':' + d.id)} active={start?.comp === c.id && start.port === d.id} />))}</>;
}
function PortMarker({ comp, def, occupied, active }: { comp: CompInstance; def: ReturnType<typeof portsOf>[number]; occupied: boolean; active: boolean }) {
  const g = useRef<THREE.Group>(null); const tool = useUI((s) => s.tool);
  useFrame(() => { const w = worldPort(comp, def); g.current?.position.set(...w.pos); });
  const col = active ? '#facc15' : occupied ? '#64748b' : def.kind === 'in' ? '#22d3ee' : def.kind === 'out' ? '#fb923c' : '#c084fc';
  return (
    <group ref={g}>
      <mesh renderOrder={20} onPointerDown={(e: ThreeEvent<PointerEvent>) => { if (tool !== 'pipe') return; e.stopPropagation(); view.downHit = true; }} onClick={(e: ThreeEvent<MouseEvent>) => { if (tool !== 'pipe' || e.delta > 6) return; e.stopPropagation(); portClick(comp.id, def.id, occupied); }}>
        <sphereGeometry args={[Math.max(0.07, def.dn / 1600), 14, 10]} /><meshBasicMaterial color={col} transparent opacity={occupied ? 0.35 : 0.95} depthTest={false} />
      </mesh>
      {!occupied && <mesh renderOrder={19}><sphereGeometry args={[Math.max(0.13, def.dn / 800), 14, 10]} /><meshBasicMaterial color={col} transparent opacity={0.18} depthTest={false} /></mesh>}
    </group>
  );
}
export function portClick(comp: string, port: string, occupied: boolean) {
  const ui = useUI.getState();
  if (occupied) { ui.notify('הפתח הזה כבר מחובר'); return; }
  if (!ui.pipeStart) { useUI.setState({ pipeStart: { comp, port }, pipeVia: [] }); return; }
  if (ui.pipeStart.comp === comp && ui.pipeStart.port === port) { useUI.setState({ pipeStart: null, pipeVia: [] }); return; }
  if (ui.pipeStart.comp === comp) { ui.notify('בחרו פתח ברכיב אחר'); return; }
  const p = addPipe(ui.pipeStart, { comp, port }, ui.pipeVia);
  useUI.setState({ pipeStart: null, pipeVia: [] }); if (p) useUI.setState({ selected: p.id });
}
/** dashed preview of the currently suggested connections */
function SuggestLines() {
  const sg = useUI((s) => s.suggest); useUI((s) => s.version);
  const lines = useMemo(() => (sg?.items ?? []).map((it) => {
    const ca = getComp(it.a.comp), cb = getComp(it.b.comp); if (!ca || !cb) return null; const da = portsOf(ca).find((p) => p.id === it.a.port), db = portsOf(cb).find((p) => p.id === it.b.port);
    const hdr = (c: CompInstance) => ({ pos: [c.pos[0], c.pos[1] + 0.3, c.pos[2]] as [number, number, number], dir: [0, 1, 0] as [number, number, number] });
    const A = da ? worldPort(ca, da) : hdr(ca), B = db ? worldPort(cb, db) : hdr(cb); const pa = new THREE.Vector3(...A.pos), pb = new THREE.Vector3(...B.pos); const k = Math.min(1.2, pa.distanceTo(pb) / 3);
    const curve = new THREE.CubicBezierCurve3(pa, pa.clone().addScaledVector(new THREE.Vector3(...A.dir), k), pb.clone().addScaledVector(new THREE.Vector3(...B.dir), k), pb);
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(40)), new THREE.LineDashedMaterial({ color: '#ff8a3d', dashSize: 0.22, gapSize: 0.12, depthTest: false, transparent: true })); l.computeLineDistances(); l.renderOrder = 22; return l;
  }).filter(Boolean) as THREE.Line[], [sg]);
  return <>{lines.map((l, i) => <primitive key={i} object={l} />)}</>;
}
function PipePreview() {
  const start = useUI((s) => s.pipeStart); const line = useMemo(() => new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineDashedMaterial({ color: '#facc15', dashSize: 0.2, gapSize: 0.1, depthTest: false })), []);
  useFrame(() => {
    if (!start) return; const c = getComp(start.comp); if (!c) return; const d = portsOf(c).find((p) => p.id === start.port); if (!d) return;
    const w = worldPort(c, d); const via = useUI.getState().pipeVia; const y = via.length ? via[via.length - 1][1] : Math.max(w.pos[1], 0.2);
    line.geometry.setFromPoints([new THREE.Vector3(...w.pos), ...via.map((v) => new THREE.Vector3(...v)), view.cursor.clone().setY(y)]); line.computeLineDistances();
  });
  const via = useUI((s) => s.pipeVia);
  return start ? <><primitive object={line} renderOrder={21} />{via.map((v, i) => <mesh key={i} position={v} renderOrder={22}><sphereGeometry args={[0.07, 12, 8]} /><meshBasicMaterial color="#facc15" depthTest={false} /></mesh>)}</> : null;
}

const KEY_LABEL: Record<string, (t: Record<string, number | string>, u: 'C' | 'K') => string> = {
  rack: (t, u) => `${fmtT(t.T_chip as number, u, 0)} שבב · ${(t.Q_liquid as number).toFixed(0)} kW`,
  pump: (t) => `${(t.mdot as number).toFixed(1)} kg/s · ${(t.dP as number).toFixed(0)} kPa`,
  cdu: (t) => `${(t.Q as number).toFixed(0)} kW`, chiller: (t) => `COP ${(t.COP as number).toFixed(1)} · ${(t.Q_evap as number).toFixed(0)} kW`,
  cooling_tower: (t, u) => `${fmtT(t.T_out as number, u, 1)} · Approach ${(t.approach as number).toFixed(1)} K`, boiler: (t, u) => `${(t.Q_fluid as number).toFixed(0)} kW · ${fmtT(t.T_out as number, u, 0)}`,
  steam_turbine: (t) => `${(t.W_shaft as number).toFixed(0)} kW · η ${((t.eta as number) * 100).toFixed(0)}%`, gas_turbine: (t) => `${(t.W_shaft as number).toFixed(0)} kW`,
  condenser: (t, u) => `${(t.Q_cond as number).toFixed(0)} kW · ${fmtT(t.T_cond as number, u, 1)}`, evaporator: (t, u) => `${(t.Q_evap as number).toFixed(0)} kW · SH ${(t.superheat as number).toFixed(1)} K · ${fmtT(t.T_evap as number, u, 1)}`,
  compressor_recip: (t) => `${(t.W_shaft as number).toFixed(1)} kW · PR ${(t.PR as number).toFixed(1)}`, compressor_centrifugal: (t) => `${(t.W_shaft as number).toFixed(1)} kW · PR ${(t.PR as number).toFixed(1)}`,
  expansion_valve: (t) => `פתיחה ${(t.opening as number).toFixed(0)}%`,
};
function Label({ comp }: { comp: CompInstance }) {
  const g = useRef<THREE.Group>(null); const a = useRef<HTMLDivElement>(null); const b = useRef<HTMLDivElement>(null); const wr = useRef<HTMLDivElement>(null); const last = useRef(0);
  useFrame((st) => {
    if (g.current) g.current.position.set(comp.pos[0], comp.pos[1] + footprintOf(comp)[1] + 0.55, comp.pos[2]);
    if (st.clock.elapsedTime - last.current < 0.3) return; last.current = st.clock.elapsedTime;
    const t = rt.sim.telemetry.get(comp.id); const u = useUI.getState().unit;
    if (a.current) a.current.textContent = comp.name;
    if (wr.current) { const w = checkComp(comp)[0]; wr.current.textContent = w ? '⚠ ' + (w.msg.length > 46 ? w.msg.slice(0, 44) + '…' : w.msg) : ''; wr.current.style.display = w ? '' : 'none'; }
    if (b.current) { try { b.current.textContent = t ? (KEY_LABEL[comp.type]?.(t as Record<string, number | string>, u) ?? (typeof t.T_out === 'number' ? fmtT(t.T_out as number, u, 1) : '')) : ''; } catch { b.current.textContent = ''; } }
  });
  return (
    <group ref={g}><Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
      <div dir="rtl" className="scene-label whitespace-nowrap rounded border px-2 py-[3px] text-center text-[11px] leading-tight">
        <div ref={a} className="font-semibold" /><div ref={b} className="num text-[10px] opacity-80" /><div ref={wr} className="text-[10px] font-semibold text-[#e5484d]" style={{ display: 'none' }} />
      </div>
    </Html></group>
  );
}

/* ---------------------------------------------------------------- scene content --------------- */
function CompView({ comp }: { comp: CompInstance }) {
  const asset = useAssets((s) => !!(s.meta[comp.type]?.enabled && s.data[comp.type]));
  const arch = !!SPECS[comp.type].arch;
  const startDrag = () => { view.drag = { id: comp.id, off: null, moved: false }; if (view.controls) view.controls.enabled = false; };
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    const ui = useUI.getState(); if (ui.tool !== 'select' || e.button !== 0) return;
    if (arch) { if (ui.selected === comp.id) { e.stopPropagation(); view.downHit = true; startDrag(); } return; } // rooms: first click selects, then drag moves
    e.stopPropagation(); view.downHit = true; useUI.setState({ selected: comp.id }); startDrag();
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (useUI.getState().tool !== 'select') return;
    if (!arch) { e.stopPropagation(); return; }
    if (e.delta > 6 || view.downHit) return; e.stopPropagation(); useUI.setState({ selected: comp.id });
  };
  return <group onPointerDown={onDown} onClick={onClick} onContextMenu={(e) => { if (arch && view.downHit) return; e.stopPropagation(); useUI.setState({ selected: comp.id }); }}>{asset && !arch ? <GlbBody comp={comp} /> : <ProceduralBody comp={comp} />}</group>;
}
function Ghost() {
  const type = useUI((s) => s.placeType); const tool = useUI((s) => s.tool);
  const ghost = useMemo<CompInstance | null>(() => (type ? { id: '__ghost', type, name: 'ghost', pos: [0, 0, 0], rotY: view.ghost?.rotY ?? 0, params: defaultParams(type) } : null), [type]);
  useEffect(() => { view.ghost = ghost; }, [ghost]);
  if (!ghost || tool !== 'place' || ghost.type === 'wall') return null;
  return <ProceduralBody comp={ghost} ghost />;
}
function Content() {
  const ver = useUI((s) => s.version); const labels = useUI((s) => s.showLabels); void useAssets((s) => s.rev);
  const comps = scene().comps; void ver;
  return (
    <>
      {comps.filter((c) => c.type !== 'pipe').map((c) => <CompView key={c.id} comp={c} />)}
      {comps.filter((c) => c.type === 'pipe').map((c) => <PipeView key={c.id} pipe={c} />)}
      {labels && comps.filter((c) => c.type !== 'pipe' && !SPECS[c.type].arch).map((c) => <Label key={'l' + c.id} comp={c} />)}
      <Ghost /><WallPreview /><SelectionBox /><PortMarkers /><PipePreview /><SuggestLines /><RouteHandles /><HandleScaler />
    </>
  );
}

/** height of the walkable surface under a pointer event (raised floors), else the hall floor */
function walkPoint(e: ThreeEvent<PointerEvent | MouseEvent>): THREE.Vector3 {
  return view.walkHit(e.nativeEvent.clientX, e.nativeEvent.clientY) ?? e.point.clone().setY(0);
}
/** wall end-point snapping: existing wall ends / room corners (0.35 m), grid, and 15° angle steps from the start point (Ctrl = free) */
function wallSnap(w: THREE.Vector3, free: boolean): [number, number, number] {
  let p: [number, number, number] = [snapG(w.x), 0, snapG(w.z)];
  const pts: [number, number][] = [];
  for (const c of scene().comps) {
    if (c.type === 'wall') { const L = c.params.L as number, cx = Math.cos(c.rotY), sz = -Math.sin(c.rotY); pts.push([c.pos[0] + cx * L / 2, c.pos[2] + sz * L / 2], [c.pos[0] - cx * L / 2, c.pos[2] - sz * L / 2]); }
    if (c.type === 'room') { const W = (c.params.W as number) / 2 + (c.params.t as number), D = (c.params.D as number) / 2 + (c.params.t as number); for (const [x, z] of [[-W, -D], [W, -D], [W, D], [-W, D]]) { const cs = Math.cos(c.rotY), sn = Math.sin(c.rotY); pts.push([c.pos[0] + x * cs + z * sn, c.pos[2] - x * sn + z * cs]); } }
  }
  let best = 0.35; for (const [x, z] of pts) { const d = Math.hypot(x - w.x, z - w.z); if (d < best) { best = d; p = [x, 0, z]; } }
  const s0 = view.wallStart;
  if (s0 && best >= 0.35 && !free) { const dx = p[0] - s0[0], dz = p[2] - s0[2], L = Math.hypot(dx, dz), a = Math.round(Math.atan2(dz, dx) / (Math.PI / 12)) * (Math.PI / 12); const Ls = useUI.getState().snap > 0 ? snapG(L) : L; p = [s0[0] + Math.cos(a) * Ls, 0, s0[2] + Math.sin(a) * Ls]; }
  return p;
}
/** live preview while drawing a wall */
function WallPreview() {
  const type = useUI((s) => s.placeType); const tool = useUI((s) => s.tool); const box = useRef<THREE.Mesh>(null); const dot = useRef<THREE.Mesh>(null); const txt = useRef<HTMLDivElement>(null); const lab = useRef<THREE.Group>(null);
  const H = (defaultParams('wall').H as number), T = (defaultParams('wall').t as number);
  useEffect(() => { view.wallStart = null; }, [type, tool]);
  useFrame(() => {
    const on = tool === 'place' && type === 'wall'; if (!box.current || !dot.current || !lab.current) return;
    const p = on ? wallSnap(view.cursor, false) : [0, 0, 0]; dot.current.visible = on; dot.current.position.set(p[0], 0.05, p[2]);
    const s0 = view.wallStart; box.current.visible = on && !!s0; lab.current.visible = on && !!s0; if (txt.current) txt.current.style.display = on && s0 ? '' : 'none';
    if (on && s0) { const dx = p[0] - s0[0], dz = p[2] - s0[2], L = Math.max(Math.hypot(dx, dz), 0.01); box.current.position.set((s0[0] + p[0]) / 2, H / 2, (s0[2] + p[2]) / 2); box.current.rotation.y = Math.atan2(-dz, dx); box.current.scale.set(L, 1, 1); lab.current.position.set((s0[0] + p[0]) / 2, H + 0.4, (s0[2] + p[2]) / 2); if (txt.current) txt.current.textContent = L.toFixed(2) + ' m'; }
  });
  return (<>
    <mesh ref={box} visible={false} renderOrder={15}><boxGeometry args={[1, H, T]} /><meshStandardMaterial color="#ff8a3d" transparent opacity={0.45} depthWrite={false} /></mesh>
    <mesh ref={dot} visible={false} renderOrder={16}><cylinderGeometry args={[0.12, 0.12, 0.04, 20]} /><meshBasicMaterial color="#ff8a3d" depthTest={false} /></mesh>
    <group ref={lab} visible={false}><Html center style={{ pointerEvents: 'none' }}><div ref={txt} className="num rounded bg-[#ff8a3d] px-1.5 py-0.5 text-[11px] font-semibold text-white shadow" /></Html></group>
  </>);
}
/** invisible floor catcher: placement, dragging, deselection, pipe waypoints, pipe-preview cursor */
function FloorEvents() {
  useEffect(() => {
    const up = () => {
      const d = view.drag; view.drag = null; if (view.controls) view.controls.enabled = true;
      if (d && d.moved) { // finalize move: port snapping -> link
        const c = getComp(d.id); if (c && !SPECS[c.type].arch) { const sn = snapPorts(c, 0.5); if (sn) { moveComponent(c.id, [c.pos[0] + sn.delta[0], c.pos[1] + sn.delta[1], c.pos[2] + sn.delta[2]]); addLink(sn.a, sn.b); } }
        rebuild({ preserve: true, steady: false }); if (c && !SPECS[c.type].arch) offerSuggestions(d.id, true);
      }
    };
    window.addEventListener('pointerup', up); return () => window.removeEventListener('pointerup', up);
  }, []);
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    const ui = useUI.getState(); const w = walkPoint(e); view.cursor.copy(w);
    if (ui.tool === 'place' && view.ghost) {
      const arch = !!SPECS[view.ghost.type].arch;
      view.ghost.pos = [snapG(w.x), arch ? 0 : w.y, snapG(w.z)];
      const sn = arch ? null : snapPorts(view.ghost, 0.55); view.snapRes = sn; if (sn) view.ghost.pos = [view.ghost.pos[0] + sn.delta[0], view.ghost.pos[1] + sn.delta[1], view.ghost.pos[2] + sn.delta[2]];
      rt.geoRev++;
    }
    const d = view.drag; if (d) {
      const c = getComp(d.id); if (!c) return; const arch = !!SPECS[c.type].arch; const p = arch ? e.point : w;
      if (!d.off) d.off = [c.pos[0] - p.x, c.pos[2] - p.z];
      const nx = snapG(p.x + d.off[0]), nz = snapG(p.z + d.off[1]); const ny = arch ? c.pos[1] : (view.walkHit(e.nativeEvent.clientX, e.nativeEvent.clientY, c.id)?.y ?? 0);
      if (nx !== c.pos[0] || nz !== c.pos[2] || ny !== c.pos[1]) { if (!d.moved) commit(); d.moved = true; moveComponent(c.id, [nx, ny, nz]); }
    }
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const ui = useUI.getState(); if (e.delta > 6 || e.button !== 0) return; const w = walkPoint(e);
    if (ui.tool === 'place' && ui.placeType === 'wall') {
      const p = wallSnap(w, e.nativeEvent.ctrlKey);
      if (!view.wallStart) { view.wallStart = p; useUI.setState({ tick: ui.tick + 1 }); return; }
      const s0 = view.wallStart, dx = p[0] - s0[0], dz = p[2] - s0[2], L = Math.hypot(dx, dz); if (L < 0.2) return;
      const c = addComponent('wall', [(s0[0] + p[0]) / 2, 0, (s0[2] + p[2]) / 2], Math.atan2(-dz, dx), { L: +L.toFixed(3) });
      useUI.setState({ selected: c.id }); view.wallStart = p; // keep drawing from the end point (Esc to finish)
      return;
    }
    if (ui.tool === 'place' && ui.placeType && view.ghost) {
      const g = view.ghost, sn = view.snapRes; const c = addComponent(ui.placeType, [g.pos[0], g.pos[1], g.pos[2]], g.rotY);
      if (sn) addLink({ comp: c.id, port: sn.a.port }, sn.b);
      if (sn) rebuild({ preserve: true, steady: false });
      useUI.setState({ selected: c.id }); if (!e.nativeEvent.shiftKey) useUI.setState({ tool: 'select', placeType: null }); if (!SPECS[c.type].arch) offerSuggestions(c.id);
    } else if (ui.tool === 'pipe') {
      if (!ui.pipeStart) return;
      const sc = getComp(ui.pipeStart.comp); const d = sc && portsOf(sc).find((q) => q.id === ui.pipeStart!.port); if (!sc || !d) return;
      const wp = worldPort(sc, d); const prev = ui.pipeVia[ui.pipeVia.length - 1]; const y = prev ? prev[1] : Math.max(wp.pos[1] + wp.dir[1] * 0.45, 0.35);
      useUI.setState({ pipeVia: [...ui.pipeVia, [snapG(w.x), y, snapG(w.z)]] });
    } else if (!view.downHit) useUI.setState({ selected: null });
  };
  return <mesh rotation-x={-Math.PI / 2} position={[0, 0.001, 0]} onPointerMove={onMove} onClick={onClick} visible={false}><planeGeometry args={[400, 400]} /><meshBasicMaterial /></mesh>;
}
function isChildOf(o: THREE.Object3D, compId: string): boolean { let x: THREE.Object3D | null = o; while (x) { if (x.userData.comp === compId) return true; x = x.parent; } return false; }

/** keeps a handle roughly constant on screen */
const scaled = new Set<THREE.Object3D>();
const autoScale = (o: THREE.Object3D) => { scaled.add(o); };
function HandleScaler() { useFrame(({ camera }) => { for (const o of scaled) { if (!o.parent) { scaled.delete(o); continue; } const d = camera.position.distanceTo(o.getWorldPosition(new THREE.Vector3())); o.scale.setScalar(Math.max(0.6, d * 0.1)); } }); return null; }
/** editable route of the selected pipe: drag corner points (Shift = vertical), click a "+" to add a bend, double-click a point to remove it */
function RouteHandles() {
  const sel = useUI((s) => s.selected); const tool = useUI((s) => s.tool); const drawing = useUI((s) => !!s.pipeStart); useUI((s) => s.version); const [, force] = useState(0);
  const c = sel ? getComp(sel) : undefined; const isPipe = c?.type === 'pipe' && (tool === 'select' || (tool === 'pipe' && !drawing));
  useEffect(() => {
    if (!isPipe) return;
    const mv = (ev: PointerEvent) => {
      const h = view.hdrag; if (!h) return; const p = getComp(h.pipe); if (!p?.via) return; const v = p.via[h.idx]; if (!v) return;
      if (h.vert) v[1] = Math.max(0.05, +(h.y0 - (ev.clientY - h.cy0) * 0.012).toFixed(2));
      else { const q = view.rayPlaneY(ev.clientX, ev.clientY, v[1]); if (q) { v[0] = snapV(q[0]); v[2] = snapV(q[2]); } }
      h.moved = true; rt.geoRev++; force((x) => x + 1);
    };
    const up = () => { const h = view.hdrag; view.hdrag = null; if (view.controls) view.controls.enabled = true; if (h?.moved) rebuild({ preserve: true, steady: false }); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  }, [isPipe]);
  if (!isPipe || !c) return null;
  const route = pipeRoute(c.id); if (route.length < 2) return null;
  const via = c.via ?? route.slice(2, -2);
  const grab = (e: ThreeEvent<PointerEvent>, idx: number, insert?: [number, number, number]) => {
    e.stopPropagation(); view.downHit = true; if (view.controls) view.controls.enabled = false;
    let v = c.via ? c.via.map((p) => [...p] as [number, number, number]) : route.slice(2, -2).map((p) => [...p] as [number, number, number]);
    if (insert) { v = [...v.slice(0, idx), insert, ...v.slice(idx)]; }
    setVia(c.id, v); const p = getComp(c.id)!; view.hdrag = { pipe: c.id, idx, y0: p.via![idx][1], cy0: e.nativeEvent.clientY, vert: e.nativeEvent.shiftKey, moved: !!insert };
  };
  const remove = (idx: number) => { const v = (c.via ?? route.slice(2, -2)).filter((_, i) => i !== idx); setVia(c.id, v.length ? v.map((p) => [...p] as [number, number, number]) : undefined); };
  // "+" markers: midpoints of the segments between consecutive control points [A1, ...via, B1]
  const ctrl = [route[1], ...via, route[route.length - 2]];
  const mids = ctrl.slice(1).map((q, i) => { const p = ctrl[i]; return { i, p: [(p[0] + q[0]) / 2, Math.max(p[1], q[1]), (p[2] + q[2]) / 2] as [number, number, number] }; }).filter((m, k) => Math.hypot(ctrl[k + 1][0] - ctrl[k][0], ctrl[k + 1][2] - ctrl[k][2], ctrl[k + 1][1] - ctrl[k][1]) > 0.5 || m.i < 0);
  return (
    <group>
      {via.map((v, i) => (
        <mesh key={'v' + i} position={v} renderOrder={30} onUpdate={autoScale} onPointerDown={(e) => { if (e.button === 0) grab(e, i); }} onDoubleClick={(e) => { e.stopPropagation(); remove(i); }} onClick={(e) => e.stopPropagation()}
          onPointerOver={() => { document.body.style.cursor = 'grab'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
          <sphereGeometry args={[0.1, 16, 12]} /><meshBasicMaterial color={c.via ? '#ff8a3d' : '#9ca3af'} depthTest={false} transparent opacity={0.95} />
        </mesh>
      ))}
      {mids.map((m) => (
        <mesh key={'m' + m.i} position={m.p} renderOrder={29} onUpdate={autoScale} onPointerDown={(e) => { if (e.button === 0) grab(e, m.i, [snapV(m.p[0]), m.p[1], snapV(m.p[2])]); }} onClick={(e) => e.stopPropagation()}
          onPointerOver={() => { document.body.style.cursor = 'copy'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
          <octahedronGeometry args={[0.07]} /><meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

function Post() {
  const mode = useUI((s) => s.renderMode); const q = useUI((s) => s.quality);
  if (mode === 'ir' || q === 'fast') return null;
  return q === 'high' ? (
    <EffectComposer multisampling={4} enableNormalPass={false}>
      <N8AO aoRadius={0.9} distanceFalloff={1.2} intensity={2.2} quality="medium" halfRes />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <N8AO aoRadius={0.8} distanceFalloff={1.2} intensity={1.8} quality="performance" halfRes />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
    </EffectComposer>
  );
}
/** shadows are re-rendered only when geometry changes (not every frame) */
function ShadowCache() {
  const gl = useThree((s) => s.gl); const last = useRef(-1); const n = useRef(0); const mode = useUI((s) => s.renderMode); const theme = useUI((s) => s.theme);
  useEffect(() => { gl.shadowMap.autoUpdate = false; n.current = 0; }, [gl, mode, theme]);
  useFrame(() => { if (rt.geoRev !== last.current || n.current < 20 || view.drag) { last.current = rt.geoRev; n.current++; gl.shadowMap.needsUpdate = true; } });
  return null;
}
/** adaptive resolution: drops the pixel ratio when the frame rate falls */
function AdaptiveDpr() {
  const setDpr = useThree((s) => s.setDpr); const q = useUI((s) => s.quality);
  const [lo, hi] = q === 'high' ? [1, Math.min(2, window.devicePixelRatio)] : q === 'balanced' ? [0.75, Math.min(1.5, window.devicePixelRatio)] : [0.6, 1];
  useEffect(() => { setDpr(hi); }, [hi, setDpr]);
  return <PerformanceMonitor ms={250} iterations={6} bounds={() => [42, 58]} flipflops={6} onChange={({ factor }) => setDpr(lo + (hi - lo) * factor)} />;
}

export function SceneView() {
  const mode = useUI((s) => s.renderMode); const theme = useUI((s) => s.theme); const rev = useUI((s) => s.wheelReverse); const q = useUI((s) => s.quality);
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); const type = e.dataTransfer.getData('text/plain'); if (!SPECS[type]) return;
    const p = view.pickWalk(e.clientX, e.clientY); if (!p) return; const arch = !!SPECS[type].arch;
    const c = addComponent(type, [snapG(p[0]), arch ? 0 : p[1], snapG(p[2])], 0);
    const sn = arch ? null : snapPorts(c, 0.55); if (sn) { moveComponent(c.id, [c.pos[0] + sn.delta[0], c.pos[1] + sn.delta[1], c.pos[2] + sn.delta[2]]); addLink(sn.a, sn.b); rebuild({ preserve: true, steady: false }); }
    useUI.setState({ selected: c.id, tool: 'select', placeType: null }); if (!arch) offerSuggestions(c.id);
  };
  void compMap;
  return (
    <div className="absolute inset-0" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }} onDrop={onDrop}>
      <Canvas key={q === 'fast' ? 'f' : 's'} shadows={q !== 'fast'} dpr={1} camera={{ fov: 42, near: 0.1, far: 400, position: [10, 8, 14] }}
        gl={{ antialias: true, preserveDrawingBuffer: true, toneMapping: mode === 'ir' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0 }}
        onCreated={({ gl }) => { gl.outputColorSpace = THREE.SRGBColorSpace; }}>
        <color attach="background" args={[mode === 'ir' ? BG.ir : BG[theme]]} />
        <Suspense fallback={null}>
          <ViewBridge /><SimDriver />
          <OrbitControls makeDefault enableDamping dampingFactor={0.18} maxPolarAngle={Math.PI / 2.04} minDistance={2} maxDistance={90} zoomToCursor zoomSpeed={rev ? -1.1 : 1.1} rotateSpeed={0.9}
            mouseButtons={{ LEFT: -1 as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: -1 as unknown as THREE.MOUSE }} screenSpacePanning />
          <CameraRig /><Lights /><Hall /><Content /><FloorEvents /><Post /><ShadowCache /><AdaptiveDpr />
        </Suspense>
      </Canvas>
    </div>
  );
}
