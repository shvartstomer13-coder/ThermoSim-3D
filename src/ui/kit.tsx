import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons';

/** collapsible section with a header bar (SolidWorks property-manager style) */
const secMem = new Map<string, boolean>();
export function Section({ title, icon, children, open: o = false, right, badge, id }: { title: string; icon?: string; children: ReactNode; open?: boolean; right?: ReactNode; badge?: ReactNode; id?: string }) {
  const key = id ?? title; const [open, set] = useState(() => secMem.get(key) ?? o); const [mounted, setMounted] = useState(open);
  const setOpen = (v: boolean) => { secMem.set(key, v); if (v) setMounted(true); set(v); };
  return (
    <section className="border-b border-line">
      <button onClick={() => setOpen(!open)} className="flex h-8 w-full items-center gap-2 bg-panel3/60 px-2.5 text-[12px] font-semibold text-fg hover:bg-panel3" aria-expanded={open}>
        <span className="chev flex" style={{ transform: open ? 'none' : 'rotate(90deg)' }}><Icon n="chevD" s={13} className="text-fg3" /></span>
        {icon && <Icon n={icon} s={14} className="text-fg2" />}
        <span className="flex-1 text-start">{title}</span>{badge}{right}
      </button>
      <div className={`acc ${open ? 'open' : ''}`}><div className="inner">{mounted && <div className="bg-panel2 px-2.5 py-2">{children}</div>}</div></div>
    </section>
  );
}

export function Btn({ children, onClick, active, title, disabled, kind = 'ghost', className = '' }: { children: ReactNode; onClick?: () => void; active?: boolean; title?: string; disabled?: boolean; kind?: 'ghost' | 'solid' | 'danger'; className?: string }) {
  const base = 'inline-flex items-center justify-center gap-1.5 rounded px-2.5 py-1 text-[12px] transition-colors select-none';
  const k = kind === 'solid' ? 'bg-accent text-accentfg font-semibold hover:brightness-110' : kind === 'danger' ? 'text-bad hover:bg-bad/10 border border-line2' : active ? 'bg-accentsoft text-accent border border-accent/50' : 'border border-line2 bg-panel2 text-fg hover:bg-panel3';
  return <button title={title} disabled={disabled} onClick={onClick} className={`${base} ${k} ${className}`}>{children}</button>;
}

/** large ribbon button: icon on top, label below */
export function RBtn({ icon, label, onClick, active, title, caret, disabled }: { icon: string; label: string; onClick?: () => void; active?: boolean; title?: string; caret?: boolean; disabled?: boolean }) {
  return (
    <button title={title ?? label} disabled={disabled} onClick={onClick} className={`flex h-[58px] min-w-[54px] flex-col items-center justify-center gap-0.5 rounded px-2 text-[11px] leading-tight transition-colors ${active ? 'bg-accentsoft text-accent ring-1 ring-accent/50' : 'text-fg hover:bg-panel3'}`}>
      <Icon n={icon} s={22} className={active ? '' : 'text-fg2'} />
      <span className="flex items-center gap-0.5 whitespace-nowrap">{label}{caret && <Icon n="chevD" s={10} />}</span>
    </button>
  );
}
export function IBtn({ icon, title, onClick, active, s = 16 }: { icon: string; title: string; onClick?: () => void; active?: boolean; s?: number }) {
  return <button title={title} aria-label={title} onClick={onClick} className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${active ? 'bg-accentsoft text-accent' : 'text-fg2 hover:bg-panel3 hover:text-fg'}`}><Icon n={icon} s={s} /></button>;
}
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return <div className="flex flex-col border-e border-line px-2 first:ps-0"><div className="flex flex-1 items-center gap-0.5">{children}</div><div className="pb-0.5 pt-0.5 text-center text-[10px] text-fg3">{title}</div></div>;
}

/** popover anchored to a trigger; closes on outside click / Esc */
export function Popover({ trigger, children, align = 'start', width = 260 }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'start' | 'end'; width?: number }) {
  const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const d = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', d); document.addEventListener('keydown', k); return () => { document.removeEventListener('mousedown', d); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div ref={ref} className="relative">
      {trigger(open, () => setOpen(!open))}
      {open && <div className={`pop absolute top-full z-50 mt-1 overflow-hidden rounded-lg border border-line2 bg-panel2 shadow-[var(--shadow)] ${align === 'end' ? 'end-0' : 'start-0'}`} style={{ width }}>{children(() => setOpen(false))}</div>}
    </div>
  );
}
export function MenuItem({ children, onClick, shortcut, icon, checked, disabled }: { children: ReactNode; onClick?: () => void; shortcut?: string; icon?: string; checked?: boolean; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className="flex w-full items-center gap-2 px-3 py-1.5 text-start text-[12px] text-fg enabled:hover:bg-accentsoft enabled:hover:text-accent">
      <span className="flex w-4 justify-center">{checked ? <Icon n="check" s={13} /> : icon ? <Icon n={icon} s={14} className="text-fg3" /> : null}</span>
      <span className="flex-1">{children}</span>{shortcut && <kbd className="num rounded bg-panel3 px-1.5 py-0.5 text-[10px] text-fg3">{shortcut}</kbd>}
    </button>
  );
}
export const Sep = () => <div className="my-1 h-px bg-line" />;

export function NumField({ value, onChange, min, max, step = 1, unit, w = 'w-[72px]' }: { value: number; onChange(v: number): void; min?: number; max?: number; step?: number; unit?: string; w?: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <input type="number" className={`num ${w} rounded border border-line2 bg-bg px-1.5 py-0.5 text-end text-[12px] outline-none focus:border-accent`} value={Number.isFinite(value) ? +value.toPrecision(6) : 0} min={min} max={max} step={step}
        onChange={(e) => { const n = parseFloat(e.target.value); if (Number.isFinite(n)) onChange(min !== undefined && max !== undefined ? Math.min(max, Math.max(min, n)) : n); }} />
      {unit && <span className="num w-9 text-[10px] text-fg3">{unit}</span>}
    </span>
  );
}
export function Switch({ checked, onChange, label }: { checked: boolean; onChange(v: boolean): void; label?: string }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-[12px] text-fg">
      <button role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-[18px] w-8 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-line2'}`}>
        <span className={`absolute top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-all ${checked ? 'start-[16px]' : 'start-[2px]'}`} />
      </button>{label}
    </label>
  );
}
/** small red warning line (impossible / dangerous values) */
export const WarnLine = ({ msg, level = 'danger' }: { msg: string; level?: 'warn' | 'danger' }) => (
  <div className={`mt-0.5 flex items-start gap-1 text-[10.5px] leading-snug text-bad ${level === 'danger' ? 'font-semibold' : ''}`}>
    <svg width="12" height="12" viewBox="0 0 24 24" className="mt-[1px] shrink-0" aria-hidden><path d="M12 3l10 18H2z" fill="currentColor" /><path d="M12 10v5M12 18h.01" stroke="var(--panel2)" strokeWidth="2.4" strokeLinecap="round" /></svg>
    <span>{msg}</span>
  </div>
);
export const Kbd = ({ children }: { children: ReactNode }) => <kbd dir="auto" className="rounded border border-line2 bg-panel3 px-1.5 py-0.5 text-[10.5px] text-fg2 shadow-[0_1px_0_var(--line2)]" style={{ fontFamily: 'inherit', unicodeBidi: 'isolate' }}>{children}</kbd>;
