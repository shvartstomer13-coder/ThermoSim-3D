import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { SPECS } from '../physics/components';
import { IR, legendCss } from '../render/ThermalShader';
import { view } from '../render/SceneView';
import { acceptSuggestion, addBend, declineSuggestions, duplicate, getComp, offerSuggestions, redo, rt, setVia, undo } from '../runtime';
import { portsOf } from '../physics/geometry';
import { useUI } from '../store';
import { tr } from './he';
import { Icon } from './icons';
import { Btn, IBtn, Kbd, MenuItem, Sep } from './kit';
import { warnCounts } from './safety';
import { deleteSel, pipeTool, rotateSel, toggleIR, VIEWS } from './actions';

const glass = 'border border-line2 bg-panel2/90 shadow-[var(--shadow)] backdrop-blur';

/** heads-up view toolbar (top centre of the viewport, like the SolidWorks HUD) */
export function ViewToolbar() {
  const u = useUI();
  return (
    <div className={`absolute left-1/2 top-2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-md px-1 py-0.5 ${glass}`} onPointerDown={(e) => e.stopPropagation()}>
      <IBtn icon="fit" title="התאם למסך (F)" onClick={() => view.fit()} />
      <span className="mx-0.5 h-4 w-px bg-line2" />
      {VIEWS.filter((v) => ['front', 'right', 'top', 'iso'].includes(v.id)).map((v) => <IBtn key={v.id} icon={v.icon} title={`${v.label} (${v.key})`} onClick={() => view.preset(v.id)} />)}
      <span className="mx-0.5 h-4 w-px bg-line2" />
      <IBtn icon="cube" title="תצוגה ריאליסטית" active={u.renderMode === 'pbr'} onClick={() => u.set({ renderMode: 'pbr' })} />
      <IBtn icon="thermal" title="מצלמה תרמית (I)" active={u.renderMode === 'ir'} onClick={() => u.set({ renderMode: 'ir' })} />
      <span className="mx-0.5 h-4 w-px bg-line2" />
      <IBtn icon="tag" title="תוויות" active={u.showLabels} onClick={() => u.set({ showLabels: !u.showLabels })} />
      <IBtn icon="flow" title="חיווי זרימה" active={u.showFlow} onClick={() => u.set({ showFlow: !u.showFlow })} />
    </div>
  );
}

export function Hint() {
  const tool = useUI((s) => s.tool); const start = useUI((s) => s.pipeStart); const place = useUI((s) => s.placeType); const via = useUI((s) => s.pipeVia); const sel = useUI((s) => s.selected);
  const selPipe = (tool === 'select' || (tool === 'pipe' && !start)) && sel && getComp(sel)?.type === 'pipe';
  const txt = tool === 'place' && place === 'wall' ? <>ציור קיר — לחצו נקודת התחלה ואז נקודת סיום; הקיר הבא ממשיך מהסוף · נצמד לקצוות קירות ופינות חדר, ובזוויות של 15° <Kbd>Ctrl</Kbd> זווית חופשית <Kbd>Esc</Kbd> סיום</>
    : tool === 'place' && place ? <>ממקם <b>{tr(SPECS[place].label)}</b> — לחצו על הרצפה <Kbd>Shift</Kbd> רציף <Kbd>R</Kbd> סיבוב <Kbd>Esc</Kbd> ביטול</>
    : tool === 'pipe' && (start || !selPipe) ? (start ? <>לחצו על הרצפה להוספת נקודות מסלול{via.length ? ` (${via.length})` : ''}, ואז על פתח ברכיב אחר <Kbd>Backspace</Kbd> נקודה אחורה <Kbd>Esc</Kbd> ביטול</> : <>כלי צינור — לחצו על פתח יציאה (כתום) או כניסה (תכלת)</>)
    : selPipe ? <>עריכת מסלול: גררו נקודה <Kbd>Shift</Kbd> גובה · גררו ◆ להוספת ברך · לחיצה כפולה מוחקת</> : null;
  if (!txt) return null;
  return <div className={`pop pointer-events-none absolute left-1/2 top-12 z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[12px] text-fg ${glass}`}><span className="h-1.5 w-1.5 rounded-full bg-accent" />{txt}</div>;
}

export function Legend() {
  const mode = useUI((s) => s.renderMode); const palette = useUI((s) => s.palette); const unit = useUI((s) => s.unit); useUI((s) => s.tick);
  if (mode !== 'ir') return null;
  const n = 6, ticks = Array.from({ length: n + 1 }, (_, i) => IR.tMax - ((IR.tMax - IR.tMin) * i) / n);
  return (
    <div dir="ltr" className={`pointer-events-none absolute left-3 top-14 z-10 flex h-[min(46vh,360px)] select-none gap-2 rounded-md p-2.5 ${glass}`}>
      <div className="w-3.5 rounded-sm ring-1 ring-line2" style={{ background: legendCss(palette) }} />
      <div className="num flex flex-col justify-between text-[11px] text-fg">{ticks.map((t, i) => <div key={i}>{(unit === 'C' ? t - 273.15 : t).toFixed(1)}</div>)}</div>
      <div className="self-start text-[10px] font-semibold text-fg3">{unit === 'C' ? '°C' : 'K'}</div>
    </div>
  );
}

/** orientation triad (bottom corner), follows the camera every frame */
export function Triad() {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    let raf = 0; const v = new THREE.Vector3(); const AX: [string, [number, number, number], string][] = [['X', [1, 0, 0], '#e03131'], ['Y', [0, 1, 0], '#2f9e44'], ['Z', [0, 0, 1], '#1c7ed6']];
    const loop = () => {
      raf = requestAnimationFrame(loop); const cam = view.camera, el = ref.current; if (!cam || !el) return; const inv = cam.quaternion.clone().invert();
      const pts = AX.map(([n, d, c]) => { v.set(...d).applyQuaternion(inv); return { n, c, x: 30 + v.x * 20, y: 30 - v.y * 20, z: v.z }; }).sort((a, b) => a.z - b.z);
      el.innerHTML = pts.map((p) => `<line x1="30" y1="30" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="${p.c}" stroke-width="2" stroke-linecap="round" opacity="${p.z < -0.2 ? 0.45 : 1}"/><text x="${(30 + (p.x - 30) * 1.32).toFixed(1)}" y="${(30 + (p.y - 30) * 1.32 + 3.5).toFixed(1)}" font-size="10" font-weight="700" text-anchor="middle" fill="${p.c}">${p.n}</text>`).join('') + '<circle cx="30" cy="30" r="2" fill="var(--fg3)"/>';
    };
    loop(); return () => cancelAnimationFrame(raf);
  }, []);
  return <svg ref={ref} width="60" height="60" viewBox="0 0 60 60" className="pointer-events-none absolute bottom-2 left-2 z-10" aria-hidden />;
}

export function ContextMenu() {
  const m = useUI((s) => s.ctxMenu); const sel = useUI((s) => s.selected);
  useEffect(() => { if (!m) return; const close = () => useUI.setState({ ctxMenu: null }); window.addEventListener('pointerdown', close); window.addEventListener('wheel', close); return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('wheel', close); }; }, [m]);
  if (!m) return null; const c = sel ? getComp(sel) : undefined;
  return (
    <div className={`pop fixed z-[60] w-56 overflow-hidden rounded-lg py-1 ${glass}`} style={{ left: Math.min(m.x, innerWidth - 232), top: Math.min(m.y, innerHeight - 300) }} onPointerDown={(e) => e.stopPropagation()} onClick={() => useUI.setState({ ctxMenu: null })}>
      {c && <><div className="truncate px-3 py-1 text-[11px] font-bold text-fg3">{c.name}</div>
        <MenuItem icon="help" onClick={() => useUI.setState({ propsOpen: true })}>איך זה עובד / מאפיינים</MenuItem>
        {c.type !== 'pipe' && <MenuItem icon="rotate" shortcut="R" onClick={() => rotateSel()}>סיבוב 90°</MenuItem>}
        {c.type !== 'pipe' && <MenuItem icon="copy" shortcut="Ctrl+D" onClick={() => duplicate(c.id)}>שכפול</MenuItem>}
        {c.type === 'pipe' && <><MenuItem icon="bend" onClick={() => addBend(c.id)}>הוספת ברך</MenuItem><MenuItem icon="fit" disabled={!c.via} onClick={() => setVia(c.id, undefined)}>מסלול אוטומטי</MenuItem></>}
        {c.type !== 'pipe' && !SPECS[c.type].arch && <MenuItem icon="pipe" onClick={() => offerSuggestions(c.id, true)}>הצעות חיבור</MenuItem>}
        <MenuItem icon="trash" shortcut="Del" onClick={deleteSel}>מחיקה</MenuItem><Sep /></>}
      <MenuItem icon="undo" shortcut="Ctrl+Z" onClick={undo}>ביטול</MenuItem><MenuItem icon="redo" shortcut="Ctrl+Y" onClick={redo}>ביצוע חוזר</MenuItem><Sep />
      <MenuItem icon="fit" shortcut="F" onClick={() => view.fit()}>התאם למסך</MenuItem>
      {VIEWS.filter((v) => ['front', 'top', 'iso'].includes(v.id)).map((v) => <MenuItem key={v.id} icon={v.icon} shortcut={v.key} onClick={() => view.preset(v.id)}>{v.label}</MenuItem>)}
      <Sep /><MenuItem icon="pipe" shortcut="P" onClick={pipeTool}>כלי צינור</MenuItem>
      <MenuItem icon="thermal" shortcut="I" onClick={toggleIR}>מצלמה תרמית</MenuItem>
    </div>
  );
}

/** SolidWorks "View Orientation" pop-up (Space) */
export function OrientPopup() {
  const open = useUI((s) => s.orientOpen); if (!open) return null; const close = () => useUI.setState({ orientOpen: false });
  return (
    <div className="absolute inset-0 z-20" onPointerDown={close}>
      <div className={`pop absolute left-1/2 top-1/2 w-[264px] -translate-x-1/2 -translate-y-1/2 rounded-lg p-2 ${glass}`} onPointerDown={(e) => e.stopPropagation()}>
        <div className="px-1 pb-1.5 text-[12px] font-bold">כיוון מבט</div>
        <div className="grid grid-cols-3 gap-1">{VIEWS.map((v) => <button key={v.id} onClick={() => { view.preset(v.id); close(); }} className="flex flex-col items-center gap-1 rounded border border-line bg-panel px-1 py-2 text-[11px] hover:border-accent hover:text-accent"><Icon n={v.icon} s={22} />{v.label}<span className="num text-[9px] text-fg3">{v.key}</span></button>)}</div>
      </div>
    </div>
  );
}

export function StatusBar() {
  useUI((s) => s.tick); useUI((s) => s.version); const u = useUI();
  const sys = rt.sim.compiled.systems, issues = rt.sim.compiled.issues; const ok = sys.every((s) => s.converged); const t = rt.sim.time;
  const clock = [Math.floor(t / 3600), Math.floor((t % 3600) / 60), Math.floor(t % 60)].map((x) => String(x).padStart(2, '0')).join(':');
  const Cell = ({ children, title }: { children: React.ReactNode; title?: string }) => <span title={title} className="flex h-full items-center gap-1.5 border-s border-line px-2.5">{children}</span>;
  const state = !sys.length ? ['ממתין', 'bg-fg3'] : !u.running ? ['מושהה', 'bg-warn'] : ok ? ['התכנס', 'bg-ok'] : ['מחשב', 'bg-warn'];
  return (
    <footer className="flex h-6 shrink-0 select-none items-center border-t border-line bg-panel text-[11px] text-fg2">
      <span className="flex items-center gap-1.5 px-2.5"><span className={`h-2 w-2 rounded-full ${state[1]}`} />{u.tool === 'place' ? 'מיקום רכיב' : u.tool === 'pipe' ? 'חיבור צינור' : 'מוכן'}</span>
      {issues.length > 0 && <Cell><Icon n="warn" s={12} className="text-warn" /><span className="num">{issues.length}</span> בעיות חיבור</Cell>}
      {(() => { const w = warnCounts(); return w.d + w.w > 0 ? <Cell title="ערכים לא תקינים פיזיקלית או מסוכנים – פרטים בחלונית המאפיינים"><Icon n="warn" s={12} className="text-bad" /><span className="font-semibold text-bad"><span className="num">{w.d + w.w}</span> אזהרות בטיחות</span></Cell> : null; })()}
      <span className="flex-1" />
      <Cell title="מצב הפותר">פותר: <b className="font-semibold text-fg">{state[0]}</b></Cell>
      <Cell title="מספר נעלמים · שארית מרבית"><span className="num">{sys.reduce((a, s) => a + s.nVar, 0)}</span> נעלמים · שארית <span className="num">{Number.isFinite(rt.sim.worstResidual) ? rt.sim.worstResidual.toExponential(1) : '—'}</span></Cell>
      <Cell title="זמן חישוב לצעד"><span className="num">{rt.msPerStep.toFixed(1)} ms</span></Cell>
      <Cell title="מיקום הסמן על הרצפה"><span className="num">X {view.cursor.x.toFixed(2)}  Z {view.cursor.z.toFixed(2)} m</span></Cell>
      <Cell title="פריימים לשנייה"><span className="num">{view.fps.toFixed(0)} FPS</span></Cell>
      <Cell title="יחידות"><span className="num">SI · {u.unit === 'C' ? '°C' : 'K'} · kPa · kW</span></Cell>
      <Cell title="זמן סימולציה"><span className="num font-semibold text-fg">{clock}</span></Cell>
    </footer>
  );
}

const MOUSE: [string, string][] = [
  ['לחיצה על הגלגלת + גרירה', 'סיבוב המבט'], ['Ctrl + גלגלת + גרירה', 'הזזה (Pan)'], ['Shift + גלגלת + גרירה', 'זום'], ['גלגול הגלגלת קדימה', 'זום אין אל מיקום הסמן'],
  ['גרירה שמאלית בשטח ריק', 'הסטת המבט'], ['לחיצה כפולה על הגלגלת', 'התאם למסך'],  ['לחיצה שמאלית', 'בחירת רכיב'], ['גרירה שמאלית על רכיב', 'הזזת הרכיב'], ['לחיצה ימנית', 'תפריט הקשר'],
];
const KEYS: [string, string][] = [
['W / S', 'תנועה קדימה / אחורה בכיוון ההסתכלות'], ['A / D', 'תנועה שמאלה / ימינה'], ['Q / E', 'ירידה / עלייה'], ['Shift + W A S D', 'תנועה מהירה'],
  ['חיצים', 'סיבוב המבט ב-15°'], ['Shift + חיצים', 'סיבוב ב-90°'], ['Ctrl + חיצים', 'הזזת המבט'], ['Z / Shift+Z', 'זום החוצה / פנימה'], ['F', 'התאם למסך'], ['Space', 'חלון כיוון מבט'],
  ['Ctrl + 1…5, 7', 'חזית, אחור, שמאל, ימין, על, איזומטרי'], ['Shift + Space', 'הפעלה / השהיה'], ['N', 'צעד בודד'], ['V', 'כלי בחירה'], ['P', 'כלי צינור'], ['R / Shift+R', 'סיבוב רכיב 90°'],
  ['Ctrl + Z', 'ביטול צעד'], ['Ctrl + Y', 'ביצוע חוזר'], ['Ctrl + D', 'שכפול רכיב'], ['Ctrl + S', 'שמירת פרויקט'], ['Ctrl + O', 'פתיחת פרויקט'], ['Backspace', 'בכלי צינור: מחיקת נקודת המסלול האחרונה'],
  ['Delete', 'מחיקת הרכיב הנבחר'], ['I', 'מצלמה תרמית'], ['Esc', 'ביטול פעולה'], ['F1', 'חלון זה'],
];
export function Help() {
  const open = useUI((s) => s.helpOpen); if (!open) return null; const close = () => useUI.setState({ helpOpen: false });
  const T = ({ rows }: { rows: [string, string][] }) => <div>{rows.map(([k, v]) => <div key={k} className="flex items-center justify-between gap-4 border-b border-line/60 py-1.5 text-[12px] last:border-0"><span className="text-fg2">{v}</span><span className="flex shrink-0 items-center gap-1">{k.split(' + ').map((x, i) => <span key={i} className="flex items-center gap-1">{i > 0 && <span className="text-fg3">+</span>}<Kbd>{x}</Kbd></span>)}</span></div>)}</div>;
  return (
    <div className="fade fixed inset-0 z-[70] flex items-center justify-center bg-black/45 p-6 backdrop-blur-[2px]" onPointerDown={close}>
      <div className="pop w-full max-w-[760px] overflow-hidden rounded-xl border border-line2 bg-panel2 shadow-[var(--shadow)]" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-line px-4 py-2.5"><Icon n="keyboard" s={16} className="text-accent" /><span className="flex-1 text-[13px] font-bold">ניווט וקיצורי מקשים</span><IBtn icon="close" title="סגירה" onClick={close} /></div>
        <div className="grid max-h-[70vh] grid-cols-2 gap-6 overflow-y-auto p-4">
          <div><div className="mb-1 text-[11px] font-bold text-fg3">עכבר — כמו ב-SolidWorks</div><T rows={MOUSE} />
            <p className="mt-3 text-[11px] leading-relaxed text-fg3">גלגול קדימה מקרב (זום אין). ניתן להפוך את הכיוון בלשונית "כלים" ← "היפוך כיוון גלגלת".</p></div>
          <div><div className="mb-1 text-[11px] font-bold text-fg3">מקלדת</div><T rows={KEYS} /></div>
        </div>
      </div>
    </div>
  );
}

/** connection assistant: proposes pipes between free compatible ports; the user accepts one, all, or declines */
export function SuggestCard() {
  const sg = useUI((s) => s.suggest); useUI((s) => s.version);
  if (!sg) return null; const c = getComp(sg.comp); if (!c) return null;
  const pn = (r: { comp: string; port: string }) => { const x = getComp(r.comp); const nm = r.port === '+' ? 'ענף חדש – יתווסף' : x ? portsOf(x).find((p) => p.id === r.port)?.name ?? r.port : r.port; return { comp: x?.name ?? r.comp, port: /^Branch \d+$/.test(nm) ? 'ענף ' + nm.slice(7) : tr(nm) }; };
  return (
    <div className={`pop absolute bottom-3 left-1/2 z-10 w-[440px] max-w-[92%] -translate-x-1/2 overflow-hidden rounded-lg ${glass}`} onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 border-b border-line px-3 py-2"><Icon n="pipe" s={15} className="text-accent" /><span className="flex-1 truncate text-[12px] font-bold">הצעות חיבור עבור {c.name}</span><IBtn icon="close" title="לא תודה" s={14} onClick={declineSuggestions} /></div>
      <div className="max-h-[190px] overflow-y-auto px-2 py-1.5">
        {sg.items.map((it, i) => { const a = pn(it.a), b = pn(it.b); return (
          <div key={i} className="flex items-center gap-2 rounded px-1.5 py-1.5 hover:bg-panel3">
            <span className="num flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accentsoft text-[10px] font-bold text-accent">{i + 1}</span>
            <div className="min-w-0 flex-1 text-[12px] leading-snug"><div className="truncate"><b>{a.comp}</b> <span className="text-fg3">({a.port})</span></div>
              <div className="truncate text-fg2"><Icon n="chevL" s={11} className="inline text-accent" /> <b className="text-fg">{b.comp}</b> <span className="text-fg3">({b.port})</span></div></div>
            <span className="num shrink-0 text-[10.5px] text-fg3">{it.dist.toFixed(1)} m</span>
            <Btn onClick={() => acceptSuggestion([it])} className="shrink-0">חבר</Btn>
          </div>); })}
      </div>
      <div className="flex items-center gap-2 border-t border-line bg-panel px-3 py-2"><span className="flex-1 text-[11px] text-fg3">הקווים המקווקווים בתצוגה מציגים את החיבורים המוצעים.</span>
        <Btn onClick={declineSuggestions}>לא תודה</Btn>{sg.items.length > 1 && <Btn kind="solid" onClick={() => acceptSuggestion(sg.items)}>חבר הכול</Btn>}</div>
    </div>
  );
}

