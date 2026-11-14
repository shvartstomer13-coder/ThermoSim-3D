import { useEffect, useRef, useState, type ReactNode } from 'react';
import { CATEGORIES, SPECS } from '../physics/components';
import type { ParamDef } from '../physics/engineTypes';
import { TEMPLATES } from '../physics/templates';
import { addBend, applyFluidToLoop, commit, duplicate, getComp, loadTemplate, offerSuggestions, pipeRoute, setVia, rebuild, removeComponent, rt, scene, setParam } from '../runtime';
import { useUI } from '../store';
import { CATEGORY_HE, TYPE_DESC, tr } from './he';
import { EXPLAIN } from './explain';
import { Icon } from './icons';
import { Btn, IBtn, NumField, Section, Switch, WarnLine } from './kit';
import { checkComp, type Warn } from './safety';
import { portsOf } from '../physics/geometry';
import { fmtKey, HEADLINE, SERIES_PREF, seriesValue } from './telemetry';
import { TYPE_ICON } from './actions';

/* ------------------------------------------------------------------ dock shell (resizable, collapsible) */
function Dock({ side, title, icon, wKey, openKey, children }: { side: 'start' | 'end'; title: string; icon: string; wKey: 'treeW' | 'propsW'; openKey: 'treeOpen' | 'propsOpen'; children: ReactNode }) {
  const w = useUI((s) => s[wKey]); const open = useUI((s) => s[openKey]);
  const [dragging, setDragging] = useState(false);
  const drag = (e: React.PointerEvent) => {
    e.preventDefault(); const x0 = e.clientX, w0 = w; const dir = side === 'start' ? -1 : 1; setDragging(true); // RTL: start dock sits on the right
    const mv = (ev: PointerEvent) => useUI.setState({ [wKey]: Math.min(520, Math.max(220, w0 + dir * (ev.clientX - x0))) } as never);
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); document.body.style.cursor = ''; setDragging(false); };
    document.body.style.cursor = 'col-resize'; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  return (
    <aside className={`dock relative flex shrink-0 flex-col overflow-hidden bg-panel ${dragging ? 'dragging' : ''} ${side === 'start' ? 'border-e' : 'border-s'} border-line`} style={{ width: open ? w : 28 }}>
      <button onClick={() => useUI.setState({ [openKey]: true } as never)} title={'פתיחת ' + title} tabIndex={open ? -1 : 0}
        className={`dock-tab absolute inset-0 z-20 flex flex-col items-center gap-2 bg-panel py-2 text-fg2 hover:bg-panel3 hover:text-fg ${open ? 'pointer-events-none opacity-0' : 'opacity-100'}`}>
        <Icon n={icon} s={15} /><span className="text-[11px] font-semibold" style={{ writingMode: 'vertical-rl' }}>{title}</span>
      </button>
      <div className="flex min-h-0 flex-1 flex-col" style={{ width: w, minWidth: w }}>
        <div className="flex h-8 shrink-0 items-center gap-2 border-b border-line px-2.5"><Icon n={icon} s={14} className="text-accent" /><span className="flex-1 text-[12px] font-bold">{title}</span>
          <IBtn icon={side === 'start' ? 'chevR' : 'chevL'} title="כיווץ החלונית" s={14} onClick={() => useUI.setState({ [openKey]: false } as never)} /></div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
      {open && <div onPointerDown={drag} className={`rs-x absolute inset-y-0 z-10 w-[3px] ${side === 'start' ? '-end-[2px]' : '-start-[2px]'}`} />}
    </aside>
  );
}
/** tiny math typesetter: _sub and ^sup / ^(group) */
function Eq({ s }: { s: string }) {
  const out: ReactNode[] = []; let i = 0, buf = ''; const flush = () => { if (buf) { out.push(buf); buf = ''; } };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '_' || ch === '^') {
      let j = i + 1, tok = '';
      if (s[j] === '(') { let d = 0; do { if (s[j] === '(') d++; if (s[j] === ')') d--; tok += s[j++]; } while (d > 0 && j < s.length); tok = tok.slice(1, -1); }
      else { while (j < s.length && /[A-Za-z0-9,.\u0590-\u05FF\u2212]/.test(s[j]) && !(ch === '_' && s[j] === '.')) tok += s[j++]; }
      flush(); out.push(ch === '_' ? <sub key={i} className="text-[0.72em]">{tok}</sub> : <sup key={i} className="text-[0.72em]">{tok}</sup>); i = j;
    } else { buf += ch; i++; }
  }
  flush(); return <>{out}</>;
}
const Row = ({ k, v }: { k: ReactNode; v: ReactNode }) => <div className="flex items-baseline justify-between gap-3 border-b border-line/60 py-[5px] text-[12px] last:border-0"><span className="text-fg2">{k}</span><span className="num text-fg">{v}</span></div>;

/* ------------------------------------------------------------------ design tree */
export function TreePanel() {
  useUI((s) => s.version); useUI((s) => s.tick); const sel = useUI((s) => s.selected); const tid = useUI((s) => s.templateId);
  const comps = scene().comps; const issues = rt.sim.compiled.issues; const sys = rt.sim.compiled.systems; const bad = new Set(issues.map((i) => i.comp)); const danger = new Set(comps.filter((x) => checkComp(x).length).map((x) => x.id));
  const t = TEMPLATES.find((x) => x.id === tid); const pipes = comps.filter((c) => c.type === 'pipe');
  const Item = ({ id, name, type }: { id: string; name: string; type: string }) => (
    <button onClick={() => useUI.setState({ selected: id, propsOpen: true })} title={tr(SPECS[type].label)} className={`flex h-[26px] w-full items-center gap-2 rounded px-2 text-start text-[12px] ${sel === id ? 'bg-accentsoft font-semibold text-accent' : 'text-fg hover:bg-panel3'}`}>
      <Icon n={TYPE_ICON[type] ?? 'box'} s={14} className={sel === id ? '' : 'text-fg3'} /><span className="flex-1 truncate">{name}</span>
      {danger.has(id) ? <Icon n="warn" s={13} className="text-bad" /> : bad.has(id) ? <Icon n="warn" s={13} className="text-warn" /> : rt.sim.telemetry.has(id) ? <span className="h-1.5 w-1.5 rounded-full bg-ok" /> : <span className="h-1.5 w-1.5 rounded-full bg-fg3/50" />}
    </button>
  );
  return (
    <Dock side="start" title="עץ המערכת" icon="list" wKey="treeW" openKey="treeOpen">
      <Section title="תרחיש" icon="file" open id="t-scn">
        {t ? <><div className="text-[12px] font-semibold">{t.name}</div><div className="mt-1 text-[11px] leading-relaxed text-fg2">{t.desc}</div></> : <div className="text-[11px] text-fg3">סצנה חופשית. טענו תרחיש מוכן או הוסיפו רכיבים מלשונית "רכיבים".</div>}
        <div className="mt-2 flex flex-wrap gap-1">{TEMPLATES.filter((x) => x.id !== tid).map((x) => <Btn key={x.id} onClick={() => loadTemplate(x.id)} className="!px-2 !text-[11px]">{x.name.split(' (')[0].split(' ').slice(0, 3).join(' ')}</Btn>)}</div>
      </Section>
      {CATEGORIES.map((cat) => { const items = comps.filter((c) => c.type !== 'pipe' && SPECS[c.type].category === cat.id); if (!items.length) return null;
        return <Section key={cat.id} id={'t-' + cat.id} title={CATEGORY_HE[cat.id]} icon="layers" open badge={<span className="num rounded-full bg-panel px-1.5 text-[10px] font-normal text-fg3">{items.length}</span>}><div className="-mx-1">{items.map((c) => <Item key={c.id} id={c.id} name={c.name} type={c.type} />)}</div></Section>; })}
      {pipes.length > 0 && <Section id="t-pipes" title="צינורות" icon="pipe" badge={<span className="num rounded-full bg-panel px-1.5 text-[10px] font-normal text-fg3">{pipes.length}</span>}><div className="-mx-1">{pipes.map((c) => <Item key={c.id} id={c.id} name={c.name} type="pipe" />)}</div></Section>}
      <Section id="t-solver" title="רשתות ופותר" icon="chart">
        {sys.length ? sys.map((s) => (
          <div key={s.id} className="mb-1.5 rounded border border-line bg-panel px-2 py-1.5 last:mb-0">
            <div className="flex items-center justify-between text-[12px]"><span>רשת {s.id + 1} · <span className="num">{s.comps.length}</span> רכיבים</span><span className={`flex items-center gap-1 text-[11px] ${s.converged ? 'text-ok' : 'text-warn'}`}><span className={`h-1.5 w-1.5 rounded-full ${s.converged ? 'bg-ok' : 'bg-warn'}`} />{s.converged ? 'התכנס' : 'מחשב…'}</span></div>
            <div className="num mt-0.5 text-start text-[10px] text-fg3" dir="rtl">{s.nVar} נעלמים · שארית {Number.isFinite(s.resid) ? s.resid.toExponential(1) : '—'} · {s.iters} איטרציות</div>
          </div>)) : <div className="text-[11px] text-fg3">אין רשת פעילה.</div>}
      </Section>
      {issues.length > 0 && <Section id="t-issues" title="בעיות חיבור" icon="warn" open badge={<span className="num rounded-full bg-warn/20 px-1.5 text-[10px] text-warn">{issues.length}</span>}>
        {issues.map((i, k) => <button key={k} onClick={() => useUI.setState({ selected: i.comp })} className="mb-1 block w-full rounded border border-warn/30 bg-warn/10 px-2 py-1 text-start text-[11px] leading-snug text-fg last:mb-0"><b>{getComp(i.comp)?.name ?? i.comp}</b> — {i.msg}</button>)}
      </Section>}
    </Dock>
  );
}

/* ------------------------------------------------------------------ property manager */
function ParamRow({ id, d, value, warn }: { id: string; d: ParamDef; value: number | string | boolean; warn?: Warn }) {
  if (d.kind === 'select') return <><label className="flex items-center justify-between gap-2 py-1 text-[12px]"><span className="text-fg2">{tr(d.label)}</span>
    <select value={String(value)} onChange={(e) => setParam(id, d.key, e.target.value)} className="h-6 max-w-[58%] px-1 text-[12px]">{d.options!.map((o) => <option key={String(o.value)} value={String(o.value)}>{tr(o.label)}</option>)}</select></label>{warn && <WarnLine msg={warn.msg} level={warn.level} />}</>;
  if (d.kind === 'bool') return <div className="flex items-center justify-between py-1 text-[12px]"><span className="text-fg2">{tr(d.label)}</span><Switch checked={!!value} onChange={(v) => setParam(id, d.key, v)} /></div>;
  const v = Number(value);
  return (
    <div className="py-1" title={d.hint ? tr(d.hint) : undefined}>
      <div className="flex items-center justify-between gap-2 text-[12px]"><span className="text-fg2">{tr(d.label)}</span><NumField value={v} min={d.min} max={d.max} step={d.step} unit={d.unit === '-' ? '' : d.unit} onChange={(n) => setParam(id, d.key, n)} /></div>
      <input type="range" dir="ltr" min={d.min} max={d.max} step={d.step} value={v} onChange={(e) => setParam(id, d.key, parseFloat(e.target.value))} className="mt-1 w-full" />
      {warn && <WarnLine msg={warn.msg} level={warn.level} />}
    </div>
  );
}
export function PropsPanel() {
  const sel = useUI((s) => s.selected); useUI((s) => s.version); useUI((s) => s.tick); const unit = useUI((s) => s.unit);
  const c = sel ? getComp(sel) : undefined;
  if (!c) return (
    <Dock side="end" title="מאפיינים" icon="gear" wKey="propsW" openKey="propsOpen">
      <div className="fade-in flex h-full flex-col items-center justify-center gap-3 px-6 text-center"><span className="flex h-12 w-12 items-center justify-center rounded-full bg-panel3 text-fg3"><Icon n="cursor" s={22} /></span>
        <div className="text-[13px] font-semibold">לא נבחר רכיב</div><div className="text-[12px] leading-relaxed text-fg2">לחצו על רכיב בתצוגה או בעץ המערכת כדי לראות איך הוא עובד, את הנתונים החיים שלו ואת הפרמטרים שלו.</div></div>
    </Dock>
  );
  const spec = SPECS[c.type]; const t = rt.sim.telemetry.get(c.id); const ex = EXPLAIN[c.type]; const arch = !!spec.arch;
  const groups = new Map<string, ParamDef[]>(); for (const d of spec.params) { const g = d.group ?? 'Parameters'; if (!groups.has(g)) groups.set(g, []); groups.get(g)!.push(d); }
  const head = t ? HEADLINE.filter((k) => typeof t[k] === 'number').slice(0, 6) : []; const rest = t ? Object.keys(t).filter((k) => !head.includes(k)) : [];
  const issue = rt.sim.compiled.issues.filter((i) => i.comp === c.id); const warns = checkComp(c);
  const wParam = (k: string) => warns.find((w) => w.param === k); const wTele = (k: string) => warns.find((w) => w.tele === k);
  return (
    <Dock side="end" title="מאפיינים" icon="gear" wKey="propsW" openKey="propsOpen">
      <div key={c.id} className="fade-in">
      <div className="border-b border-line bg-panel2 px-2.5 py-2.5">
        <div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-accentsoft text-accent"><Icon n={TYPE_ICON[c.type] ?? 'box'} s={18} /></span>
          <div className="min-w-0 flex-1"><input value={c.name} onChange={(e) => { commit('name:' + c.id); c.name = e.target.value; useUI.getState().bump(); }} className="w-full rounded bg-transparent px-1 text-[13px] font-bold outline-none hover:bg-panel3 focus:bg-bg" />
            <div className="px-1 text-[11px] text-fg3">{tr(spec.label)} · <span className="num">{c.id}</span></div></div></div>
        {warns.length > 0 && <div className="mt-2 rounded border border-bad/40 bg-bad/5 px-2 py-1">{warns.map((w, k) => <WarnLine key={k} msg={w.msg} level={w.level} />)}</div>}
        {issue.map((i, k) => <div key={k} className="mt-2 flex gap-1.5 rounded border border-warn/40 bg-warn/10 px-2 py-1 text-[11px] leading-snug"><Icon n="warn" s={13} className="mt-0.5 text-warn" />{i.msg}</div>)}
      </div>
      {c.type === 'pipe' && <RouteSection id={c.id} />}
      {ex && <Section id="p-explain" title="איך זה עובד" icon="help" open>
        <div className="text-[12px] font-semibold leading-relaxed text-fg">{ex.goal}</div>
        <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accentsoft px-2 py-0.5 text-[11px] text-accent"><Icon n="flow" s={12} />{ex.process}</div>
        <div className="mt-2.5 text-[11px] font-bold text-fg3">אופן הפעולה</div>
        <ol className="mt-1 space-y-1">{ex.how.map((h, i) => <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-fg2"><span className="num mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-panel3 text-[10px] font-bold text-fg">{i + 1}</span><span>{h}</span></li>)}</ol>
        <div className="mt-2.5 text-[11px] font-bold text-fg3">העיקרון הפיזיקלי</div>
        <p className="mt-1 text-[12px] leading-relaxed text-fg2">{ex.principle}</p>
        <div className="mt-2.5 text-[11px] font-bold text-fg3">המשוואות שהסימולטור פותר</div>
        <div className="mt-1 space-y-1">{ex.eq.map(([e, d], i) => <div key={i} className="rounded border border-line bg-bg px-2 py-1"><div className="eq text-fg"><Eq s={e} /></div><div className="text-[10.5px] text-fg3">{d}</div></div>)}</div>
        {ex.tip && <div className="mt-2.5 rounded border-s-2 border-accent bg-accentsoft px-2 py-1.5 text-[11.5px] leading-relaxed text-fg"><b>נסו בעצמכם: </b>{ex.tip}</div>}
      </Section>}
      {!arch && c.type !== 'pipe' && <PortsSection c={c} />}
      {!arch && <Section id="p-live" title="נתונים חיים" icon="chart" open>
        {t ? <>
          <div className="grid grid-cols-2 gap-1.5">{head.map((k) => { const f = fmtKey(k, t[k], unit); return <div key={k} className="rounded border border-line bg-panel px-2 py-1.5"><div className="truncate text-[10.5px] text-fg3">{f.label}</div><div className={`num flex items-center justify-end gap-1 text-[13px] font-semibold ${wTele(k) ? 'text-bad' : 'text-fg'}`} dir="ltr">{wTele(k) && <Icon n="warn" s={12} />}{f.value}</div></div>; })}</div>
          {rest.length > 0 && <div className="mt-2">{rest.map((k) => { const f = fmtKey(k, t[k], unit); return <Row key={k} k={f.label} v={wTele(k) ? <span className="inline-flex items-center gap-1 font-semibold text-bad"><Icon n="warn" s={11} />{f.value}</span> : f.value} />; })}</div>}
        </> : <div className="text-[12px] leading-relaxed text-fg3">אין נתונים: הרכיב עדיין אינו חלק מרשת פתירה. חברו את כל הפתחים שלו.</div>}
      </Section>}
      {c.type !== 'pipe' && <Section id="p-pos" title="מיקום וכיוון" icon="fit">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
          {(['X', 'Y', 'Z'] as const).map((a, i) => <label key={a} className="flex items-center justify-between gap-1 py-0.5 text-[12px] text-fg2"><span className="num">{a}</span><NumField w="w-16" step={0.25} value={+c.pos[i].toFixed(3)} unit="m" onChange={(n) => { commit('pos:' + c.id + i); c.pos[i] = n; rebuild(); }} /></label>)}
          <label className="flex items-center justify-between gap-1 py-0.5 text-[12px] text-fg2"><span>סיבוב</span><NumField w="w-16" step={90} value={Math.round((c.rotY * 180) / Math.PI)} unit="°" onChange={(n) => { commit('rot:' + c.id); c.rotY = (n * Math.PI) / 180; rebuild(); }} /></label>
        </div>
      </Section>}
      {[...groups].filter(([g]) => !(c.type === 'pipe' && g === 'Route')).map(([g, ds]) => (
        <Section key={g} id={'p-g-' + g} title={tr(g)} icon="gear" open={arch && ['Dimensions', 'Appearance', 'Openings'].includes(g)}>
          {ds.map((d) => <ParamRow key={d.key} id={c.id} d={d} value={c.params[d.key] ?? d.def} warn={wParam(d.key)} />)}
          {g === 'Fluid' && c.type !== 'pipe' && <Btn className="mt-1.5 w-full" onClick={() => applyFluidToLoop(c.id, ds[0].key === 'fluid2' ? 1 : 0)}>החלת הנוזל על כל הלולאה</Btn>}
        </Section>
      ))}
      {c.type !== 'pipe' && !arch && <div className="px-2.5 pt-2.5"><Btn className="w-full" onClick={() => offerSuggestions(c.id, true)}><Icon n="pipe" s={13} />הצעות חיבור לרכיב</Btn></div>}
      <div className="flex gap-1.5 p-2.5">
        {c.type !== 'pipe' && <Btn className="flex-1" onClick={() => { commit(); c.rotY += Math.PI / 2; rebuild(); }} title="R"><Icon n="rotate" s={13} />סיבוב</Btn>}
        {c.type !== 'pipe' && <Btn className="flex-1" onClick={() => duplicate(c.id)} title="Ctrl+D"><Icon n="copy" s={13} />שכפול</Btn>}
        <Btn kind="danger" className="flex-1" onClick={() => removeComponent(c.id)} title="Delete"><Icon n="trash" s={13} />מחיקה</Btn>
      </div>
      <div className="px-2.5 pb-3 text-[10.5px] leading-snug text-fg3">{TYPE_DESC[c.type]}</div>
      </div>
    </Dock>
  );
}

/* ------------------------------------------------------------------ ports: which inlet/outlet is which, and what it is connected to */
function PortsSection({ c }: { c: ReturnType<typeof getComp> & object }) {
  const comps = scene().comps; const fl = (pass: number) => tr(({ water: 'Water / Steam', glycol30: 'Water-Glycol 30 %', pg25: 'Propylene-Glycol 25 % (PG25)', r134a: 'R134a', r410a: 'R410A', air: 'Air (ideal gas)' } as Record<string, string>)[(pass === 1 ? c.params.fluid2 : c.params.fluid) as string] ?? '');
  const peer = (port: string) => {
    for (const p of comps) if (p.type === 'pipe') { if (p.from?.comp === c.id && p.from.port === port && p.to) return getComp(p.to.comp)?.name; if (p.to?.comp === c.id && p.to.port === port && p.from) return getComp(p.from.comp)?.name; }
    for (const l of scene().links) { if (l.a.comp === c.id && l.a.port === port) return getComp(l.b.comp)?.name; if (l.b.comp === c.id && l.b.port === port) return getComp(l.a.comp)?.name; }
    return null;
  };
  const ports = portsOf(c); const passes = SPECS[c.type].passes;
  return (
    <Section id="p-ports" title="חיבורים (כניסות ויציאות)" icon="port" open={passes > 1}>
      <div className="space-y-1">{ports.map((d) => { const p = peer(d.id); return (
        <div key={d.id} className="rounded border border-line bg-panel px-2 py-1.5">
          <div className="flex items-center gap-1.5 text-[12px]"><span className={`h-2 w-2 shrink-0 rounded-full ${d.kind === 'in' ? 'bg-[#22d3ee]' : d.kind === 'out' ? 'bg-[#fb923c]' : 'bg-[#c084fc]'}`} />
            <span className="font-semibold text-fg">{/^Branch \d+$/.test(d.name) ? 'ענף ' + d.name.slice(7) : tr(d.name)}</span></div>
          <div className="mt-0.5 flex justify-between gap-2 text-[10.5px] text-fg3"><span>{d.kind === 'in' ? 'כניסה' : d.kind === 'out' ? 'יציאה' : 'נקודת לחץ'}{passes > 1 ? ' · ' + fl(d.pass) : ''} · <span className="num">DN{d.dn}</span></span>
            <span className={p ? 'text-fg2' : 'text-bad'}>{p ? '↔ ' + p : 'לא מחובר'}</span></div>
        </div>); })}</div>
    </Section>
  );
}

/* ------------------------------------------------------------------ pipe route editor */
function RouteSection({ id }: { id: string }) {
  const c = getComp(id)!; const route = pipeRoute(id); const via = c.via; const bends = Math.max(route.length - 2, 0);
  const style = (c.params.style as string) ?? 'ortho';
  const setPt = (i: number, k: number, v: number) => { const n = (via ?? []).map((p) => [...p] as [number, number, number]); n[i][k] = v; setVia(id, n, ':' + i + k); };
  return (
    <Section id="p-route" title="מסלול הצינור" icon="bend" open>
      <div className="mb-2 flex items-center justify-between text-[12px]"><span className="text-fg2">מצב</span><span className="text-fg">{via ? `ידני · ${via.length} נקודות` : 'אוטומטי'} · <span className="num">{bends}</span> ברכיים · <span className="num">{(c.params.L_m as number).toFixed(1)} m</span></span></div>
      <div className="mb-2 grid grid-cols-2 gap-1">
        {[['ortho', 'אורתוגונלי 90°'], ['direct', 'ישיר']].map(([v, l]) => <Btn key={v} active={style === v} onClick={() => setParam(id, 'style', v)}>{l}</Btn>)}
      </div>
      <div className="grid grid-cols-2 gap-1">
        <Btn onClick={() => addBend(id)}><Icon n="plus" s={13} />הוספת ברך</Btn>
        <Btn onClick={() => setParam(id, 'flip', !c.params.flip)}><Icon n="rotate" s={13} />היפוך כיוון L</Btn>
        <Btn onClick={() => setVia(id, undefined)} disabled={!via}><Icon n="fit" s={13} />מסלול אוטומטי</Btn>
        <label className="flex items-center justify-between gap-1 rounded border border-line2 px-2 text-[11px] text-fg2">הגבהה<NumField w="w-12" step={0.1} value={(c.params.elev as number) ?? 0} onChange={(n) => setParam(id, 'elev', n)} unit="m" /></label>
      </div>
      {via && <div className="mt-2 space-y-1">{via.map((p, i) => (
        <div key={i} className="flex items-center gap-1 rounded border border-line bg-panel px-1.5 py-1 text-[11px]">
          <span className="num flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accentsoft text-[9px] font-bold text-accent">{i + 1}</span>
          {(['X', 'Y', 'Z'] as const).map((a, k) => <label key={a} className="flex items-center gap-0.5"><span className="num text-fg3">{a}</span><NumField w="w-[52px]" step={0.25} value={+p[k].toFixed(2)} onChange={(v) => setPt(i, k, v)} /></label>)}
          <button className="ms-auto text-fg3 hover:text-bad" title="מחיקת נקודה" onClick={() => setVia(id, via.filter((_, j) => j !== i))}><Icon n="close" s={13} /></button>
        </div>))}</div>}
      <p className="mt-2 text-[11px] leading-relaxed text-fg3">בתצוגה: גררו נקודה כתומה להזזת פינה (Shift + גרירה – למעלה/למטה), גררו יהלום לבן כדי להוסיף ברך, ולחיצה כפולה על נקודה מוחקת אותה. בכלי הצינור אפשר גם ללחוץ על הרצפה בדרך כדי לקבוע נקודות מסלול.</p>
    </Section>
  );
}

/* ------------------------------------------------------------------ bottom dock: live charts */
const N = 180; const COLORS = ['#e8590c', '#1c7ed6', '#2f9e44', '#ae3ec9', '#e03131', '#0c8599'];
function Spark({ label, unit, data, color, h }: { label: string; unit: string; data: number[]; color: string; h: number }) {
  const ref = useRef<HTMLCanvasElement>(null); const theme = useUI((s) => s.theme);
  useEffect(() => {
    const c = ref.current; if (!c) return; const dpr = window.devicePixelRatio || 1; const W = c.clientWidth, H = c.clientHeight; c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d')!; g.scale(dpr, dpr); g.clearRect(0, 0, W, H); const cs = getComputedStyle(document.documentElement);
    g.strokeStyle = cs.getPropertyValue('--line'); g.lineWidth = 1; for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, Math.round((H * i) / 4) + 0.5); g.lineTo(W, Math.round((H * i) / 4) + 0.5); g.stroke(); }
    if (data.length < 2) return; let lo = Math.min(...data), hi = Math.max(...data); if (hi - lo < 1e-9) { lo -= 0.5; hi += 0.5; } const pad = (hi - lo) * 0.18; lo -= pad; hi += pad;
    const X = (i: number) => (i / (N - 1)) * W, Y = (v: number) => H - ((v - lo) / (hi - lo)) * H;
    g.beginPath(); data.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.strokeStyle = color; g.lineWidth = 1.7; g.lineJoin = 'round'; g.stroke();
    g.lineTo(X(data.length - 1), H); g.lineTo(0, H); g.closePath(); g.globalAlpha = 0.1; g.fillStyle = color; g.fill(); g.globalAlpha = 1;
    g.fillStyle = cs.getPropertyValue('--fg3'); g.font = '10px system-ui'; g.textAlign = 'left'; g.fillText((hi - pad).toFixed(1), 3, 10); g.fillText((lo + pad).toFixed(1), 3, H - 3);
  }, [data, color, theme, h]);
  const last = data[data.length - 1];
  return (
    <div className="flex w-[230px] shrink-0 flex-col rounded border border-line bg-panel2 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2"><span className="flex min-w-0 items-center gap-1.5 text-[11px] text-fg2"><span className="h-2 w-2 shrink-0 rounded-sm" style={{ background: color }} /><span className="truncate">{label}</span></span>
        <span className="num text-[12px] font-semibold text-fg">{last !== undefined ? last.toFixed(Math.abs(last) < 10 ? 2 : 1) : '—'} <span className="text-[10px] font-normal text-fg3">{unit}</span></span></div>
      <canvas ref={ref} dir="ltr" className="mt-1 min-h-0 w-full flex-1" />
    </div>
  );
}
export function BottomDock() {
  const sel = useUI((s) => s.selected); const unit = useUI((s) => s.unit); const open = useUI((s) => s.bottomOpen); const h = useUI((s) => s.bottomH);
  const hist = useRef<{ id: string | null; keys: string[]; data: Record<string, number[]> }>({ id: null, keys: [], data: {} }); const [, force] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => {
      const H = hist.current; const s = useUI.getState().selected; if (H.id !== s) { H.id = s; H.keys = []; H.data = {}; }
      const t = s ? rt.sim.telemetry.get(s) : undefined; if (!t) { force((x) => x + 1); return; }
      if (!H.keys.length) H.keys = SERIES_PREF.filter((k) => typeof t[k] === 'number').slice(0, 6);
      if (useUI.getState().running) for (const k of H.keys) { const a = (H.data[k] ??= []); a.push(seriesValue(k, t[k] as number, useUI.getState().unit)); if (a.length > N) a.shift(); }
      force((x) => x + 1);
    }, 500);
    return () => clearInterval(iv);
  }, []);
  const drag = (e: React.PointerEvent) => {
    e.preventDefault(); const y0 = e.clientY, h0 = h; const mv = (ev: PointerEvent) => useUI.setState({ bottomH: Math.min(420, Math.max(120, h0 - (ev.clientY - y0))) });
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); }; window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
  };
  const c = sel ? getComp(sel) : undefined; const H = hist.current;
  return (
    <div className="relative shrink-0 border-t border-line bg-panel">
      {open && <div onPointerDown={drag} className="rs-y absolute inset-x-0 -top-[2px] z-10 h-[3px]" />}
      <button onClick={() => useUI.setState({ bottomOpen: !open })} className="flex h-7 w-full items-center gap-2 px-2.5 text-[12px] font-semibold hover:bg-panel3" aria-expanded={open}>
        <span className="chev flex" style={{ transform: open ? 'none' : 'rotate(180deg)' }}><Icon n="chevD" s={13} className="text-fg3" /></span><Icon n="chart" s={14} className="text-accent" />גרפים חיים{c && <span className="font-normal text-fg3">— {c.name}</span>}
      </button>
      <div className={`acc ${open ? 'open' : ''}`}><div className="inner"><div className="flex gap-2 overflow-x-auto border-t border-line px-2.5 py-2" style={{ height: h }}>
        {c && H.keys.length > 0 ? H.keys.map((k, i) => <Spark key={c.id + k} h={h} label={fmtKey(k, 0, unit).label} unit={k.startsWith('T_') ? (unit === 'C' ? '°C' : 'K') : fmtKey(k, 0, unit).value.split(' ').slice(1).join(' ')} data={H.data[k] ?? []} color={COLORS[i % COLORS.length]} />)
          : <div className="flex flex-1 items-center justify-center text-[12px] text-fg3">{c ? 'אין סדרות זמן לרכיב זה' : 'בחרו רכיב כדי לראות את הנתונים שלו לאורך זמן'}</div>}
      </div></div></div>
    </div>
  );
}
