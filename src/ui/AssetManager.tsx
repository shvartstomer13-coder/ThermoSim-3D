import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { SPECS, defaultParams } from '../physics/components';
import { useUI } from '../store';
import { invalidateParsed, parseGlb, useAssets } from '../render/AssetLoader';
import { assetChecklist } from './checklist';
import { tr } from './he';

function Model({ type, arm, onPick }: { type: string; arm: string | null; onPick(p: [number, number, number]): void }) {
  const data = useAssets((s) => s.data[type]); const meta = useAssets((s) => s.meta[type]);
  const [obj, setObj] = useState<THREE.Group | null>(null); const { camera } = useThree();
  useEffect(() => {
    let dead = false; setObj(null); if (!data) return;
    parseGlb(type, data).then((g) => {
      if (dead) return; const c = g.clone(true); setObj(c);
      const b = new THREE.Box3().setFromObject(c), s = b.getSize(new THREE.Vector3()), ctr = b.getCenter(new THREE.Vector3()), d = Math.max(s.x, s.y, s.z) * 1.9 + 0.1;
      camera.position.set(ctr.x + d * 0.8, ctr.y + d * 0.6, ctr.z + d); camera.lookAt(ctr);
    }).catch(() => undefined);
    return () => { dead = true; };
  }, [data, type, camera]);
  const r = useMemo(() => { if (!obj) return 0.02; const b = new THREE.Box3().setFromObject(obj); return Math.max(b.getSize(new THREE.Vector3()).length() * 0.012, 1e-3); }, [obj]);
  if (!obj) return null;
  return (
    <>
      <primitive object={obj} onPointerDown={(e: ThreeEvent<PointerEvent>) => { if (arm) { e.stopPropagation(); onPick(e.point.toArray() as [number, number, number]); } }} />
      {Object.entries(meta?.picks ?? {}).map(([k, p]) => <mesh key={k} position={p} renderOrder={9}><sphereGeometry args={[r, 12, 10]} /><meshBasicMaterial color={k.includes('out') ? '#fb923c' : '#22d3ee'} depthTest={false} /></mesh>)}
    </>
  );
}

function Num({ label, value, onChange, step = 0.05 }: { label: string; value: number; onChange(v: number): void; step?: number }) {
  return <label className="text-[10px] text-fg2">{label}<input type="number" step={step} value={+value.toFixed(4)} onChange={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) onChange(n); }} className="mt-0.5 w-full rounded border border-line bg-bg px-1 py-0.5 num text-xs text-fg" /></label>;
}

export function AssetManager() {
  const open = useUI((s) => s.assetOpen); const { meta, data, put, update, remove } = useAssets();
  const types = useMemo(() => Object.values(SPECS).filter((s) => s.type !== 'pipe' && !s.arch).map((s) => s.type), []);
  const [type, setType] = useState(types[0]); const [tab, setTab] = useState<'assets' | 'check'>('assets'); const [arm, setArm] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null); const [err, setErr] = useState('');
  if (!open) return null;
  const spec = SPECS[type], m = meta[type], ports = spec.ports(defaultParams(type));
  const upload = async (f: File | undefined) => {
    if (!f) return; setErr('');
    if (!/\.(glb|gltf)$/i.test(f.name)) { setErr('יש לבחור קובץ ‎.glb או ‎.gltf'); return; }
    try { invalidateParsed(type); await put(type, f); setArm(null); useUI.getState().bump(); useUI.getState().notify(`${tr(spec.label)}: ${f.name} נטען`); } catch (e) { setErr(String(e)); }
  };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/45 p-6 backdrop-blur-sm" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex h-full max-h-[760px] w-full max-w-[1100px] flex-col overflow-hidden rounded-2xl border border-line2 bg-panel2 shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-4 py-3"><div><div className="text-sm font-semibold text-fg">מנהל מודלים</div><div className="text-[11px] text-fg2">העלו קובץ ‎.glb/.gltf לכל סוג רכיב ומפו את פתחי הכניסה והיציאה – המודל יחליף את המודל הפרוצדורלי בכל הסצנה.</div></div>
          <div className="flex items-center gap-2"><div className="flex overflow-hidden rounded-md border border-line">{(['assets', 'check'] as const).map((k) => <button key={k} onClick={() => setTab(k)} className={`px-3 py-1.5 text-xs ${tab === k ? 'bg-accent font-semibold text-accentfg' : 'bg-panel3 text-fg2'}`}>{k === 'assets' ? 'מודלים' : 'רשימת דרישות'}</button>)}</div>
            <button onClick={() => useUI.setState({ assetOpen: false })} className="rounded-md bg-panel3 px-3 py-1.5 text-xs hover:brightness-110">סגירה</button></div></div>
        {tab === 'check' ? (
          <div className="min-h-0 flex-1 overflow-auto p-4"><pre dir="ltr" className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-fg2">{assetChecklist()}</pre></div>
        ) : (
          <div className="flex min-h-0 flex-1">
            <div className="w-60 shrink-0 space-y-1 overflow-y-auto border-e border-line p-2">
              {types.map((t) => <button key={t} onClick={() => { setType(t); setArm(null); }} className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-start text-xs ${t === type ? 'bg-accentsoft text-accent font-semibold' : 'text-fg2 hover:bg-panel3'}`}><span>{tr(SPECS[t].label)}</span>{meta[t] && <span className="rounded bg-ok/15 px-1 text-[9px] text-ok">GLB</span>}</button>)}
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
                <input ref={file} type="file" accept=".glb,.gltf,model/gltf-binary,model/gltf+json" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
                <button onClick={() => file.current?.click()} className="rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-accentfg hover:brightness-110">{m ? 'החלפת מודל…' : 'העלאת ‎.glb / .gltf…'}</button>
                {m && <><span className="text-xs text-fg2">{m.fileName} · {(m.bytes / 1024).toFixed(0)} kB</span>
                  <label className="flex items-center gap-1 text-xs text-fg2"><input type="checkbox" checked={m.enabled} onChange={(e) => { update(type, { enabled: e.target.checked }); useUI.getState().bump(); }} className="" />שימוש בסצנה</label>
                  <label className="flex items-center gap-1 text-xs text-fg2"><input type="checkbox" checked={m.nozzles} onChange={(e) => update(type, { nozzles: e.target.checked })} className="" />הוספת אוגני פתחים פרוצדורליים</label>
                  <button onClick={() => { void remove(type); invalidateParsed(type); useUI.getState().bump(); }} className="ms-auto rounded-md bg-bad/10 px-2.5 py-1.5 text-xs text-bad hover:bg-bad/20">הסרה</button></>}
                {err && <span className="text-xs text-bad">{err}</span>}
              </div>
              <div className="flex min-h-0 flex-1">
                <div className="relative min-w-0 flex-1 bg-[var(--viewport)]">
                  {data[type] ? (
                    <Canvas camera={{ fov: 40, near: 0.001, far: 1000 }} gl={{ antialias: true }}>
                      <hemisphereLight args={['#ffffff', '#445', 1.2]} /><directionalLight position={[3, 5, 2]} intensity={1.6} />
                      <Environment resolution={64} frames={1}><Lightformer form="rect" intensity={3} position={[0, 4, 0]} rotation-x={Math.PI / 2} scale={[8, 8, 1]} /></Environment>
                      <Model type={type} arm={arm} onPick={(p) => { update(type, { picks: { ...(m?.picks ?? {}), [arm!]: p } }); setArm(null); }} />
                      <gridHelper args={[10, 20, '#334', '#223']} /><axesHelper args={[0.5]} />
                      <OrbitControls makeDefault />
                    </Canvas>
                  ) : <div className="flex h-full items-center justify-center p-8 text-center text-sm text-fg3">אין מודל מותאם עבור ״{tr(spec.label)}״.<br />נעשה שימוש במודל הפרוצדורלי המפורט.</div>}
                  {arm && <div className="pointer-events-none absolute right-3 top-3 rounded bg-accent px-2 py-1 text-xs font-semibold text-accentfg">לחצו על המודל במקום שבו ״{tr(ports.find((p) => p.id === arm)?.name ?? '')}״ אמור להתחבר</div>}
                </div>
                <div className="w-72 shrink-0 space-y-3 overflow-y-auto border-s border-line p-3">
                  <div className="text-[11px] font-semibold text-fg3">מיפוי פתחים</div>
                  <div className="space-y-1">
                    {ports.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded border border-line bg-panel px-2 py-1.5 text-xs">
                        <div><div className="text-fg">{tr(p.name)} <span className="text-[10px] text-fg3">({p.kind}, DN{p.dn})</span></div><div className="num text-[10px] text-fg3">{m?.picks[p.id] ? m.picks[p.id].map((x) => x.toFixed(2)).join(', ') : `מקומי ${p.pos.map((x) => x.toFixed(2)).join(', ')}`}</div></div>
                        <div className="flex gap-1"><button disabled={!m} onClick={() => setArm(arm === p.id ? null : p.id)} className={`rounded px-2 py-1 text-[11px] ${arm === p.id ? 'bg-accent text-accentfg' : 'bg-panel3 hover:brightness-110 disabled:opacity-30'}`}>בחירה</button>
                          {m?.picks[p.id] && <button onClick={() => { const pk = { ...m.picks }; delete pk[p.id]; update(type, { picks: pk }); }} className="rounded bg-panel3 px-1.5 text-[11px] hover:brightness-110">×</button>}</div>
                      </div>
                    ))}
                  </div>
                  <div className="text-[10px] leading-snug text-fg3">כאשר ממופים שני פתחים ומעלה, המודל מותאם בקנה מידה, בסיבוב ובהזזה כך שהנקודות שנבחרו יושבות בדיוק על פתחי הסימולטור. אחרת הוא מותאם אוטומטית למידות הרכיב (<span className="num">{spec.footprint.join(' × ')} m</span>) בעזרת הבקרות שלמטה.</div>
                  {m && Object.keys(m.picks).length < 2 && (
                    <div className="grid grid-cols-2 gap-2">
                      <Num label="קנה מידה ×" value={m.scale} step={0.05} onChange={(v) => update(type, { scale: v })} />
                      <Num label="סיבוב (rad)" value={m.rotY} step={0.1} onChange={(v) => update(type, { rotY: v })} />
                      {(['X', 'Y', 'Z'] as const).map((a, i) => <Num key={a} label={`היסט ${a} (m)`} value={m.offset[i]} onChange={(v) => { const o = [...m.offset] as [number, number, number]; o[i] = v; update(type, { offset: o }); }} />)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
