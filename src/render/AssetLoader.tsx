/**
 * Custom GLB/GLTF pipeline: per-component-type assets (IndexedDB-persisted), port mapping (picked points in the
 * model's own coordinates are aligned to the simulator's inlet/outlet ports), IR material swapping.
 */
import { useEffect, useMemo, useRef } from 'react';
import { create } from 'zustand';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { CompInstance } from '../physics/engineTypes';
import { SPECS } from '../physics/components';
import { portsOf } from '../physics/geometry';
import { useUI } from '../store';
import { rt } from '../runtime';
import { channelsOf, PortNozzles, ThermalProvider, type Ch } from './ProceduralComponents';
import { makeThermalMaterial, syncThermal } from './ThermalShader';

export interface AssetMeta {
  type: string; fileName: string; bytes: number;
  scale: number; rotY: number; offset: [number, number, number]; picks: Record<string, [number, number, number]>; nozzles: boolean; enabled: boolean;
}
interface AssetStore {
  meta: Record<string, AssetMeta>; data: Record<string, ArrayBuffer>; rev: number; ready: boolean;
  load(): Promise<void>; put(type: string, file: File): Promise<void>; update(type: string, p: Partial<AssetMeta>): void; remove(type: string): Promise<void>;
}

/* ---- IndexedDB (wrapped: storage may be unavailable in sandboxed iframes) ---- */
const DB = 'thermosim-assets';
function idb(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => { rq.result.createObjectStore('glb'); rq.result.createObjectStore('meta'); };
      rq.onsuccess = () => res(rq.result); rq.onerror = () => res(null); rq.onblocked = () => res(null);
    } catch { res(null); }
  });
}
async function idbPut(store: 'glb' | 'meta', key: string, val: unknown) { const db = await idb(); if (!db) return; await new Promise<void>((r) => { try { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); tx.oncomplete = () => r(); tx.onerror = () => r(); } catch { r(); } }); }
async function idbDel(key: string) { const db = await idb(); if (!db) return; await new Promise<void>((r) => { try { const tx = db.transaction(['glb', 'meta'], 'readwrite'); tx.objectStore('glb').delete(key); tx.objectStore('meta').delete(key); tx.oncomplete = () => r(); tx.onerror = () => r(); } catch { r(); } }); }
async function idbAll<T>(store: 'glb' | 'meta'): Promise<Record<string, T>> {
  const db = await idb(); if (!db) return {};
  return new Promise((r) => {
    try {
      const out: Record<string, T> = {}; const tx = db.transaction(store, 'readonly'); const rq = tx.objectStore(store).openCursor();
      rq.onsuccess = () => { const c = rq.result; if (c) { out[String(c.key)] = c.value as T; c.continue(); } else r(out); }; rq.onerror = () => r(out);
    } catch { r({}); }
  });
}

export const useAssets = create<AssetStore>((set, get) => ({
  meta: {}, data: {}, rev: 0, ready: false,
  async load() {
    const [meta, data] = await Promise.all([idbAll<AssetMeta>('meta'), idbAll<ArrayBuffer>('glb')]);
    set({ meta, data, ready: true, rev: get().rev + 1 });
  },
  async put(type, file) {
    const buf = await file.arrayBuffer();
    const meta: AssetMeta = { type, fileName: file.name, bytes: buf.byteLength, scale: 1, rotY: 0, offset: [0, 0, 0], picks: {}, nozzles: true, enabled: true };
    set((s) => ({ meta: { ...s.meta, [type]: meta }, data: { ...s.data, [type]: buf }, rev: s.rev + 1 }));
    await idbPut('glb', type, buf); await idbPut('meta', type, meta);
  },
  update(type, p) {
    const m = get().meta[type]; if (!m) return; const nm = { ...m, ...p };
    set((s) => ({ meta: { ...s.meta, [type]: nm }, rev: s.rev + 1 })); void idbPut('meta', type, nm);
  },
  async remove(type) {
    set((s) => { const meta = { ...s.meta }, data = { ...s.data }; delete meta[type]; delete data[type]; return { meta, data, rev: s.rev + 1 }; }); await idbDel(type);
  },
}));

/* ---- parsing (cached per type + bytes) ---- */
const parsed = new Map<string, Promise<THREE.Group>>();
export function parseGlb(type: string, buf: ArrayBuffer): Promise<THREE.Group> {
  const k = type + ':' + buf.byteLength; const hit = parsed.get(k); if (hit) return hit;
  const p = new Promise<THREE.Group>((res, rej) => new GLTFLoader().parse(buf.slice(0), '', (g) => res(g.scene), rej));
  parsed.set(k, p); return p;
}
export function invalidateParsed(type: string) { for (const k of [...parsed.keys()]) if (k.startsWith(type + ':')) parsed.delete(k); }

/** Placement transform of the raw model so that it fits the footprint (or aligns picked ports to the simulator's ports). */
export function modelTransform(raw: THREE.Object3D, type: string, meta: AssetMeta, c: CompInstance) {
  const box = new THREE.Box3().setFromObject(raw), size = box.getSize(new THREE.Vector3()), ctr = box.getCenter(new THREE.Vector3());
  const ports = portsOf({ ...c, type } as CompInstance), picked = ports.filter((p) => meta.picks[p.id]);
  if (picked.length >= 2) {
    // farthest pair -> scale, yaw, translation
    let best: [number, number] = [0, 1], bd = -1;
    for (let i = 0; i < picked.length; i++) for (let j = i + 1; j < picked.length; j++) { const d = new THREE.Vector3(...picked[i].pos).distanceTo(new THREE.Vector3(...picked[j].pos)); if (d > bd) { bd = d; best = [i, j]; } }
    const [A, B] = best.map((i) => picked[i]); const pa = new THREE.Vector3(...meta.picks[A.id]), pb = new THREE.Vector3(...meta.picks[B.id]);
    const qa = new THREE.Vector3(...A.pos), qb = new THREE.Vector3(...B.pos);
    const s = Math.max(1e-4, qa.distanceTo(qb) / Math.max(pa.distanceTo(pb), 1e-6));
    const ang = Math.atan2(-(qb.z - qa.z), qb.x - qa.x) - Math.atan2(-(pb.z - pa.z), pb.x - pa.x);
    const hasXZ = Math.hypot(qb.x - qa.x, qb.z - qa.z) > 1e-3 && Math.hypot(pb.x - pa.x, pb.z - pa.z) > 1e-3;
    const yaw = hasXZ ? ang : 0;
    const rot = new THREE.Matrix4().makeRotationY(yaw), pm = pa.clone().applyMatrix4(rot).multiplyScalar(s);
    const t = qa.clone().sub(pm);
    return { scale: s, rotY: yaw, pos: t.toArray() as [number, number, number], inner: [0, 0, 0] as [number, number, number] };
  }
  const fp = SPECS[type].footprint, k = Math.min(fp[0] / Math.max(size.x, 1e-6), fp[1] / Math.max(size.y, 1e-6), fp[2] / Math.max(size.z, 1e-6)) * meta.scale;
  return { scale: k, rotY: meta.rotY, pos: [meta.offset[0], meta.offset[1], meta.offset[2]] as [number, number, number], inner: [-ctr.x, -box.min.y, -ctr.z] as [number, number, number] };
}

/** GLB-backed component body: replaces the procedural model, keeps live IR colouring + port flanges */
export function GlbBody({ comp }: { comp: CompInstance }) {
  const meta = useAssets((s) => s.meta[comp.type]); const data = useAssets((s) => s.data[comp.type]); const rev = useAssets((s) => s.rev);
  const mode = useUI((s) => s.renderMode);
  const group = useRef<THREE.Group>(null); const th = useRef<Ch>({}); const holder = useRef<THREE.Group>(null);
  const model = useRef<THREE.Object3D | null>(null); const thermal = useMemo(() => makeThermalMaterial({ axis: 'y', lo: 0, hi: 1 }), []);
  useEffect(() => {
    let dead = false;
    if (!data || !holder.current) return;
    parseGlb(comp.type, data).then((g) => {
      if (dead || !holder.current) return;
      const clone = g.clone(true); clone.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = m.receiveShadow = true; (m as unknown as { _orig: THREE.Material | THREE.Material[] })._orig = m.material; } });
      const t = modelTransform(clone, comp.type, meta, comp);
      clone.position.set(...t.inner);
      const pivot = new THREE.Group(); pivot.add(clone); pivot.scale.setScalar(t.scale); pivot.rotation.y = t.rotY; pivot.position.set(...t.pos);
      holder.current.clear(); holder.current.add(pivot); model.current = clone;
    }).catch(() => { /* corrupt file: ignore */ });
    return () => { dead = true; };
  }, [data, rev, comp.type, comp, meta]);
  useEffect(() => { // IR: swap in thermal material, PBR: restore original
    const m = model.current; if (!m) return;
    m.traverse((o) => { const me = o as THREE.Mesh & { _orig?: THREE.Material | THREE.Material[] }; if (me.isMesh && me._orig) me.material = mode === 'ir' ? thermal : me._orig; });
  }, [mode, rev, thermal, data]);
  useFrame(() => {
    const g = group.current; if (g) { g.position.set(comp.pos[0], comp.pos[1], comp.pos[2]); g.rotation.y = comp.rotY; }
    th.current = channelsOf(comp, rt.sim.telemetry.get(comp.id), rt.sim.amb.T);
    const bb = th.current.casing ?? th.current.body; const fp = SPECS[comp.type].footprint;
    void fp; const mean = 0.5 * (bb[0] + bb[1]);
    syncThermal(thermal, mean, mean);
  });
  if (!meta) return null;
  return (
    <ThermalProvider value={th}>
      <group ref={group} position={comp.pos} rotation-y={comp.rotY}>
        <group ref={holder} />
        {meta.nozzles && <PortNozzles comp={comp} />}
      </group>
    </ThermalProvider>
  );
}
export const hasAsset = (type: string) => { const s = useAssets.getState(); return !!(s.meta[type] && s.meta[type].enabled && s.data[type]); };
