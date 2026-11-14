import { useMemo, useState } from 'react';
import { CATEGORIES, SPECS } from '../physics/components';
import { TEMPLATES } from '../physics/templates';
import { PALETTES, fmtT } from '../render/ThermalShader';
import { view } from '../render/SceneView';
import { useAssets } from '../render/AssetLoader';
import { clearScene, commit, duplicate, loadTemplate, rebuild, redo, removeComponent, rt, undo } from '../runtime';
import { exportJson, newProject, openProject, saveProject } from './project';
import { useUI, type RibbonTab } from '../store';
import { CATEGORY_HE, CATEGORY_SHORT, TYPE_DESC, tr } from './he';
import { Icon } from './icons';
import { Group, IBtn, MenuItem, NumField, Popover, RBtn, Sep, Switch } from './kit';
import { arm, CAT_ICON, pipeTool, screenshot, selectTool, setQuality, setTheme, step, toggleRun, toggleTheme, TYPE_ICON, VIEWS } from './actions';

const TABS: { id: RibbonTab; label: string }[] = [{ id: 'sim', label: 'סימולציה' }, { id: 'parts', label: 'רכיבים' }, { id: 'view', label: 'תצוגה' }, { id: 'tools', label: 'כלים' }];
const PAL_HE: Record<string, string> = { ironbow: 'Ironbow (ברזל)', rainbow: 'קשת', gray: 'לבן-חם' };
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <label className="flex items-center justify-between gap-2 text-[11px] text-fg2"><span className="whitespace-nowrap">{label}</span>{children}</label>;
const Sel = <T extends string | number>({ value, onChange, options, w = 'w-[84px]' }: { value: T; onChange(v: string): void; options: [T, string][]; w?: string }) => (
  <select value={value} onChange={(e) => onChange(e.target.value)} className={`${w} h-[22px] px-1 text-[11px] outline-none focus:border-accent`}>{options.map(([v, l]) => <option key={String(v)} value={v}>{l}</option>)}</select>
);

function TitleBar() {
  const theme = useUI((s) => s.theme); const tid = useUI((s) => s.templateId); const u = useUI();
  const t = TEMPLATES.find((x) => x.id === tid); const title = u.projectName ?? t?.name ?? 'סצנה ללא שם';
  const Menu = ({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) => (
    <Popover width={250} trigger={(open, toggle) => <button onClick={toggle} className={`h-7 rounded px-2.5 text-[12px] ${open ? 'bg-panel3 text-fg' : 'text-fg2 hover:bg-panel3 hover:text-fg'}`}>{label}</button>}>{(close) => <div className="py-1" onClick={close}>{children(close)}</div>}</Popover>
  );
  return (
    <div className="flex h-9 shrink-0 items-center gap-1 border-b border-line bg-panel px-2">
      <div className="flex items-center gap-2 pe-3">
        <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><rect width="24" height="24" rx="5" fill="var(--accent)" /><path d="M6 15c2.500 0 2.500-6 6-6s3.500 6 6 6" fill="none" stroke="var(--accent-fg)" strokeWidth="2.200" strokeLinecap="round" /></svg>
        <span className="text-[13px] font-bold tracking-tight">ThermoSim <span className="text-accent">3D</span></span>
      </div>
      <Menu label="קובץ">{() => <>
        <MenuItem icon="plus" onClick={() => { clearScene(); newProject(); }}>פרויקט חדש (ריק)</MenuItem>
        <MenuItem icon="open" shortcut="Ctrl+O" onClick={openProject}>פתיחת פרויקט…</MenuItem>
        <MenuItem icon="save" shortcut="Ctrl+S" onClick={() => void saveProject(false)}>שמירה</MenuItem>
        <MenuItem icon="save" shortcut="Ctrl+Shift+S" onClick={() => void saveProject(true)}>שמירה בשם…</MenuItem>
        <MenuItem icon="file" onClick={() => void exportJson()}>ייצוא נתונים (JSON)</MenuItem>
        <Sep /><div className="px-3 pb-0.5 pt-1 text-[10px] font-bold text-fg3">תרחישים לדוגמה</div>
        {TEMPLATES.map((x) => <MenuItem key={x.id} icon="file" checked={x.id === tid && !u.projectName} onClick={() => { loadTemplate(x.id); newProject(); }}>{x.name}</MenuItem>)}
        <Sep />
        <MenuItem icon="camera" onClick={screenshot}>שמירת צילום מסך (PNG)</MenuItem>
        <MenuItem icon="folder" onClick={() => u.set({ assetOpen: true })}>מנהל מודלים (GLB)…</MenuItem>
      </>}</Menu>
      <Menu label="עריכה">{() => <>
        <MenuItem icon="undo" shortcut="Ctrl+Z" disabled={!u.canUndo} onClick={undo}>ביטול</MenuItem>
        <MenuItem icon="redo" shortcut="Ctrl+Y" disabled={!u.canRedo} onClick={redo}>ביצוע חוזר</MenuItem>
        <Sep /><MenuItem icon="copy" shortcut="Ctrl+D" disabled={!u.selected} onClick={() => u.selected && duplicate(u.selected)}>שכפול הרכיב הנבחר</MenuItem>
        <MenuItem icon="trash" shortcut="Del" disabled={!u.selected} onClick={() => u.selected && removeComponent(u.selected)}>מחיקה</MenuItem>
      </>}</Menu>
      <Menu label="תצוגה">{() => <>
        <MenuItem checked={u.treeOpen} onClick={() => u.set({ treeOpen: !u.treeOpen })}>עץ המערכת</MenuItem>
        <MenuItem checked={u.propsOpen} onClick={() => u.set({ propsOpen: !u.propsOpen })}>מאפיינים</MenuItem>
        <MenuItem checked={u.bottomOpen} onClick={() => u.set({ bottomOpen: !u.bottomOpen })}>גרפים חיים</MenuItem>
        <MenuItem checked={u.ribbonOpen} onClick={() => u.set({ ribbonOpen: !u.ribbonOpen })}>סרגל פקודות</MenuItem>
        <Sep /><MenuItem icon="thermal" checked={u.renderMode === 'ir'} shortcut="I" onClick={() => u.set({ renderMode: u.renderMode === 'ir' ? 'pbr' : 'ir' })}>מצלמה תרמית (IR)</MenuItem>
        <MenuItem icon="fit" shortcut="F" onClick={() => view.fit()}>התאם למסך</MenuItem>
        <Sep /><MenuItem icon="sun" checked={theme === 'light'} onClick={() => setTheme('light')}>מצב בהיר</MenuItem><MenuItem icon="moon" checked={theme === 'dark'} onClick={() => setTheme('dark')}>מצב כהה</MenuItem>
      </>}</Menu>
      <Menu label="עזרה">{() => <><MenuItem icon="keyboard" shortcut="F1" onClick={() => u.set({ helpOpen: true })}>ניווט בעכבר וקיצורי מקשים</MenuItem></>}</Menu>
      <span className="mx-1 h-4 w-px bg-line2" />
      <IBtn icon="save" title="שמירה (Ctrl+S)" onClick={() => void saveProject(false)} />
      <IBtn icon="undo" title="ביטול (Ctrl+Z)" onClick={undo} />
      <IBtn icon="redo" title="ביצוע חוזר (Ctrl+Y)" onClick={redo} />
      <div className="pointer-events-none absolute inset-x-0 flex justify-center"><span className="max-w-[40vw] truncate text-[12px] text-fg3">{title}{u.fileName && <span className="num text-fg3/70"> — {u.fileName}</span>}</span></div>
      <div className="ms-auto flex items-center gap-0.5">
        <IBtn icon={theme === 'dark' ? 'sun' : 'moon'} title={theme === 'dark' ? 'מעבר למצב בהיר' : 'מעבר למצב כהה'} onClick={toggleTheme} />
        <IBtn icon="help" title="עזרה (F1)" onClick={() => u.set({ helpOpen: true })} />
      </div>
    </div>
  );
}

function SimTab() {
  const u = useUI(); useUI((s) => s.tick); const t = rt.sim.time; const amb = rt.sim.scene.ambient;
  const clock = [Math.floor(t / 3600), Math.floor((t % 3600) / 60), Math.floor(t % 60)].map((x) => String(x).padStart(2, '0')).join(':');
  const setAmb = (k: 'T_C' | 'RH' | 'P', v: number) => { commit('amb:' + k); rt.sim.scene.ambient = { ...rt.sim.scene.ambient, [k]: v }; rebuild(); };
  return (<>
    <Group title="הרצה">
      <RBtn icon={u.running ? 'pause' : 'play'} label={u.running ? 'השהה' : 'הפעל'} active={u.running} onClick={toggleRun} title="הפעלה / השהיה (Shift+Space)" />
      <RBtn icon="step" label="צעד בודד" onClick={step} title="צעד זמן אחד (N)" />
      <RBtn icon="rotate" label="אתחול" onClick={() => u.templateId && loadTemplate(u.templateId)} disabled={!u.templateId} title="טעינה מחדש של התרחיש" />
    </Group>
    <Group title="זמן">
      <div className="flex flex-col gap-1 px-1">
        <Field label="מהירות"><Sel value={u.speed} onChange={(v) => u.set({ speed: +v })} options={[0.25, 1, 5, 10, 30, 100, 300, 1000].map((s) => [s, '×' + s])} /></Field>
        <Field label="קצב פותר"><Sel value={u.hz} onChange={(v) => u.set({ hz: +v })} options={[10, 15, 20, 30, 45, 60].map((s) => [s, s + ' Hz'])} /></Field>
      </div>
      <div className="flex flex-col items-center px-2"><span className="num text-[17px] font-semibold tabular-nums text-fg">{clock}</span><span className="num text-[10px] text-fg3">dt = {(u.speed / u.hz).toFixed(3)} s</span></div>
    </Group>
    <Group title="תרחיש">
      <Popover width={340} trigger={(_, toggle) => <RBtn icon="file" label="תרחישים" caret onClick={toggle} />}>{(close) => (
        <div className="p-1.5">{TEMPLATES.map((x) => (
          <button key={x.id} onClick={() => { loadTemplate(x.id); close(); }} className={`mb-1 block w-full rounded-md border px-3 py-2 text-start last:mb-0 ${u.templateId === x.id ? 'border-accent/60 bg-accentsoft' : 'border-transparent hover:bg-panel3'}`}>
            <div className="text-[12px] font-semibold text-fg">{x.name}</div><div className="mt-0.5 text-[11px] leading-snug text-fg2">{x.desc}</div>
          </button>))}
          <Sep /><MenuItem icon="plus" onClick={() => { clearScene(); close(); }}>סצנה ריקה חדשה</MenuItem>
        </div>)}</Popover>
    </Group>
    <Group title="תנאי סביבה">
      <div className="flex flex-col gap-1 px-1">
        <Field label="טמפ׳ אוויר"><NumField value={amb.T_C} onChange={(v) => setAmb('T_C', v)} unit="°C" w="w-16" /></Field>
        <Field label="לחות יחסית"><NumField value={amb.RH} min={5} max={100} step={5} onChange={(v) => setAmb('RH', v)} unit="%" w="w-16" /></Field>
      </div>
      <div className="flex flex-col gap-1 px-1">
        <Field label="לחץ"><NumField value={amb.P} onChange={(v) => setAmb('P', v)} unit="kPa" w="w-[68px]" /></Field>
        <div className="text-[11px] text-fg3">טמפ׳ לחה: <span className="num text-fg2">{fmtT(rt.sim.amb.Twb, u.unit, 1)}</span></div>
      </div>
    </Group>
  </>);
}

function PartsTab() {
  const tool = useUI((s) => s.tool); const placeType = useUI((s) => s.placeType); const assets = useAssets((s) => s.meta); const [q, setQ] = useState('');
  const groups = useMemo(() => CATEGORIES.filter((c) => c.id !== 'room').map((c) => ({ id: c.id, items: Object.values(SPECS).filter((s) => s.category === c.id && s.type !== 'pipe') })), []);
  const room = useMemo(() => Object.values(SPECS).filter((s) => s.category === 'room'), []);
  const Item = ({ type, close }: { type: string; close(): void }) => (
    <button draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', type); e.dataTransfer.effectAllowed = 'copy'; }} onClick={() => { arm(type); close(); }}
      className={`flex w-full cursor-grab items-start gap-2.5 rounded-md px-2.5 py-2 text-start active:cursor-grabbing ${placeType === type ? 'bg-accentsoft' : 'hover:bg-panel3'}`}>
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded bg-panel3 text-fg2"><Icon n={TYPE_ICON[type] ?? 'box'} s={16} /></span>
      <span className="min-w-0 flex-1"><span className="flex items-center gap-1.5 text-[12px] font-semibold text-fg">{tr(SPECS[type].label)}{assets[type] && <span className="rounded bg-ok/15 px-1 text-[9px] font-normal text-ok">GLB</span>}</span>
        <span className="line-clamp-2 block text-[11px] leading-snug text-fg3">{TYPE_DESC[type]}</span></span>
    </button>
  );
  const all = Object.values(SPECS).filter((s) => s.type !== 'pipe' && (tr(s.label) + (TYPE_DESC[s.type] ?? '') + s.label).toLowerCase().includes(q.toLowerCase()));
  return (<>
    <Group title="כלים">
      <RBtn icon="cursor" label="בחירה" active={tool === 'select'} onClick={selectTool} title="בחירה והזזה (V)" />
      <RBtn icon="pipe" label="צינור" active={tool === 'pipe'} onClick={pipeTool} title="חיבור צינור בין פתחים (P)" />
    </Group>
    <Group title="ספריית רכיבים">
      {groups.map((g) => (
        <Popover key={g.id} width={330} trigger={(_, toggle) => <RBtn icon={CAT_ICON[g.id]} label={CATEGORY_SHORT[g.id] ?? CATEGORY_HE[g.id]} caret onClick={toggle} active={!!placeType && SPECS[placeType]?.category === g.id} title={CATEGORY_HE[g.id]} />}>{(close) => (
          <div className="max-h-[62vh] overflow-y-auto p-1.5"><div className="px-2.5 pb-1 pt-1 text-[10px] font-semibold text-fg3">{CATEGORY_HE[g.id]}</div>{g.items.map((s) => <Item key={s.type} type={s.type} close={close} />)}</div>)}</Popover>
      ))}
    </Group>
    <Group title="חדר ומבנה">
      {room.map((s) => <RBtn key={s.type} icon={TYPE_ICON[s.type] ?? 'box'} label={tr(s.label).split(' (')[0]} active={placeType === s.type} onClick={() => arm(s.type)} title={TYPE_DESC[s.type]} />)}
    </Group>
    <Group title="חיפוש">
      <Popover width={330} trigger={(open, toggle) => (
        <div className="flex h-7 w-52 items-center gap-1.5 rounded border border-line2 bg-bg px-2 focus-within:border-accent"><Icon n="search" s={13} className="text-fg3" />
          <input value={q} onChange={(e) => { setQ(e.target.value); if (!open) toggle(); }} onFocus={() => { if (!open) toggle(); }} placeholder="חיפוש רכיב…" className="w-full bg-transparent text-[12px] outline-none placeholder:text-fg3" /></div>)}>{(close) => (
        <div className="max-h-[62vh] overflow-y-auto p-1.5">{all.length ? all.map((s) => <Item key={s.type} type={s.type} close={close} />) : <div className="p-3 text-center text-[12px] text-fg3">לא נמצאו רכיבים</div>}</div>)}</Popover>
    </Group>
    <div className="flex max-w-[260px] items-center px-3 text-[11px] leading-snug text-fg3">בחרו רכיב ולחצו על הרצפה, או גררו אותו אל התצוגה. Shift – מיקום רציף · R – סיבוב · Ctrl+D – שכפול.</div>
  </>);
}

function ViewTab() {
  const u = useUI(); const C = u.unit === 'C';
  return (<>
    <Group title="מצב תצוגה">
      <RBtn icon="cube" label="ריאליסטי" active={u.renderMode === 'pbr'} onClick={() => u.set({ renderMode: 'pbr' })} />
      <RBtn icon="thermal" label="תרמי IR" active={u.renderMode === 'ir'} onClick={() => u.set({ renderMode: 'ir' })} title="מצלמה תרמית בסגנון FLIR (I)" />
    </Group>
    <Group title="הדמיה תרמית">
      <div className="flex flex-col gap-1 px-1">
        <Field label="פלטה"><Sel w="w-[118px]" value={u.palette} onChange={(v) => u.set({ palette: v as never })} options={PALETTES.map((p) => [p.id, PAL_HE[p.id] ?? p.label])} /></Field>
        <Field label="יחידות"><Sel w="w-[118px]" value={u.unit} onChange={(v) => u.set({ unit: v as never })} options={[['C', '°C צלזיוס'], ['K', 'K קלווין']]} /></Field>
      </div>
      <div className="flex flex-col gap-1 px-1">
        <Switch checked={u.irAuto} onChange={(v) => u.set({ irAuto: v, irMin: Math.round(u.irMin), irMax: Math.round(u.irMax) })} label="טווח אוטומטי" />
        <div className={`flex items-center gap-1 ${u.irAuto ? 'pointer-events-none opacity-40' : ''}`}>
          <NumField w="w-12" value={Math.round(C ? u.irMin - 273.15 : u.irMin)} onChange={(v) => u.set({ irMin: v + (C ? 273.15 : 0) })} /><span className="text-fg3">–</span>
          <NumField w="w-12" value={Math.round(C ? u.irMax - 273.15 : u.irMax)} onChange={(v) => u.set({ irMax: v + (C ? 273.15 : 0) })} unit={C ? '°C' : 'K'} />
        </div>
      </div>
    </Group>
    <Group title="הצגה">
      <RBtn icon="tag" label="תוויות" active={u.showLabels} onClick={() => u.set({ showLabels: !u.showLabels })} />
      <RBtn icon="port" label="פתחים" active={u.showPorts} onClick={() => u.set({ showPorts: !u.showPorts })} />
      <RBtn icon="flow" label="זרימה" active={u.showFlow} onClick={() => u.set({ showFlow: !u.showFlow })} />
    </Group>
    <Group title="מבט">
      <RBtn icon="fit" label="התאם" onClick={() => view.fit()} title="התאם למסך (F / לחיצה כפולה על הגלגלת)" />
      <Popover width={210} trigger={(_, toggle) => <RBtn icon="iso" label="כיוון מבט" caret onClick={toggle} title="כיוון מבט (Space)" />}>{(close) => <div className="py-1">{VIEWS.map((v) => <MenuItem key={v.id} icon={v.icon} shortcut={v.key} onClick={() => { view.preset(v.id); close(); }}>{v.label}</MenuItem>)}</div>}</Popover>
    </Group>
    <Group title="ביצועים">
      <div className="flex flex-col gap-1 px-1">
        <Field label="איכות גרפיקה"><Sel w="w-[104px]" value={u.quality} onChange={(v) => setQuality(v as never)} options={[['high', 'גבוהה'], ['balanced', 'מאוזנת'], ['fast', 'מהירה']]} /></Field>
        <div className="max-w-[170px] text-[10.5px] leading-snug text-fg3">מהירה – ללא צללים והצללה; מתאים למחשבים חלשים.</div>
      </div>
    </Group>
    <Group title="ערכת נושא">
      <RBtn icon="sun" label="בהיר" active={u.theme === 'light'} onClick={() => setTheme('light')} />
      <RBtn icon="moon" label="כהה" active={u.theme === 'dark'} onClick={() => setTheme('dark')} />
    </Group>
  </>);
}

function ToolsTab() {
  const u = useUI();
  return (<>
    <Group title="דיוק">
      <div className="flex flex-col gap-1 px-1">
        <Field label="הצמדה לרשת"><Sel value={u.snap} onChange={(v) => u.set({ snap: +v })} options={[[0, 'כבוי'], [0.1, '0.1 m'], [0.25, '0.25 m'], [0.5, '0.5 m'], [1, '1 m']]} /></Field>
        <Switch checked={u.wheelReverse} onChange={(v) => u.set({ wheelReverse: v })} label="היפוך כיוון גלגלת" />
      </div>
    </Group>
    <Group title="מודלים">
      <RBtn icon="folder" label="מנהל מודלים" onClick={() => u.set({ assetOpen: true })} title="העלאת קובצי GLB ומיפוי פתחים" />
    </Group>
    <Group title="פלט">
      <RBtn icon="camera" label="צילום מסך" onClick={screenshot} />
    </Group>
    <Group title="סצנה">
      <RBtn icon="plus" label="סצנה חדשה" onClick={clearScene} />
    </Group>
    <Group title="עזרה">
      <RBtn icon="keyboard" label="קיצורים" onClick={() => u.set({ helpOpen: true })} title="ניווט בעכבר וקיצורי מקשים (F1)" />
    </Group>
  </>);
}

export function Ribbon() {
  const tab = useUI((s) => s.ribbonTab); const open = useUI((s) => s.ribbonOpen);
  return (
    <header className="relative z-30 shrink-0 select-none">
      <TitleBar />
      <div className="flex h-8 items-end gap-0.5 border-b border-line bg-panel px-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => useUI.setState(tab === t.id ? { ribbonOpen: !open } : { ribbonTab: t.id, ribbonOpen: true })} onDoubleClick={() => useUI.setState({ ribbonOpen: !open })}
            className={`relative -mb-px h-7 rounded-t px-4 text-[12px] transition-colors ${tab === t.id && open ? 'border border-b-0 border-line bg-panel2 font-semibold text-fg' : tab === t.id ? 'font-semibold text-accent' : 'text-fg2 hover:text-fg'}`}>
            {t.label}{tab === t.id && open && <span className="absolute inset-x-2 top-0 h-[2px] rounded-full bg-accent" />}
          </button>
        ))}
        <div className="ms-auto pb-0.5"><IBtn icon={open ? 'chevU' : 'chevD'} title={open ? 'כיווץ סרגל הפקודות' : 'הרחבת סרגל הפקודות'} onClick={() => useUI.setState({ ribbonOpen: !open })} s={14} /></div>
      </div>
      <div className={`acc ${open ? 'open' : ''}`} style={open ? { overflow: 'visible' } : undefined}><div className="inner" style={open ? { overflow: 'visible' } : undefined}>
        <div key={tab} className="fade flex h-[84px] items-stretch gap-0 border-b border-line bg-panel2 px-2 py-1">
          {tab === 'sim' ? <SimTab /> : tab === 'parts' ? <PartsTab /> : tab === 'view' ? <ViewTab /> : <ToolsTab />}
        </div>
      </div></div>
    </header>
  );
}
