import { commit, getComp, rebuild, removeComponent, stepOnce } from '../runtime';
import { useUI } from '../store';
import { view } from '../render/SceneView';

export const TYPE_ICON: Record<string, string> = {
  pipe: 'pipe', valve: 'gauge', expansion_valve: 'gauge', flow_meter: 'gauge', pressure_sensor: 'gauge', temp_sensor: 'thermal', manifold_split: 'layers', manifold_merge: 'layers', exp_tank: 'box',
  shell_tube_hx: 'layers', dry_cooler: 'fan', crah: 'fan', buffer_tank: 'box', air_compressor: 'pump', check_valve: 'gauge', strainer: 'gauge',
  room: 'home', wall: 'wall', raised_floor: 'grid', ceiling: 'layers', column: 'box',
  pump: 'pump', rack: 'cpu', cdu: 'box', plate_hx: 'layers', chiller: 'snow', cooling_tower: 'fan', boiler: 'flame', steam_turbine: 'fan', gas_turbine: 'fan', condenser: 'snow', evaporator: 'snow', compressor_centrifugal: 'pump', compressor_recip: 'pump',
};
export const CAT_ICON: Record<string, string> = { heat: 'flame', hx: 'snow', machines: 'pump', piping: 'pipe', instrument: 'gauge', room: 'home', cycle: 'flame', datacenter: 'cpu' };

export const arm = (type: string) => { view.ghost = null; useUI.setState({ tool: 'place', placeType: type, pipeStart: null }); };
export const selectTool = () => useUI.setState({ tool: 'select', placeType: null, pipeStart: null });
export const pipeTool = () => useUI.setState({ tool: 'pipe', placeType: null });
export const toggleRun = () => useUI.setState((u) => ({ running: !u.running }));
export const step = () => { useUI.setState({ running: false }); stepOnce(); useUI.setState((u) => ({ tick: u.tick + 1 })); };
export const rotateSel = (dir = 1) => {
  const ui = useUI.getState();
  if (ui.tool === 'place' && view.ghost) view.ghost.rotY += (dir * Math.PI) / 2;
  else if (ui.selected) { const c = getComp(ui.selected); if (c && c.type !== 'pipe') { commit(); c.rotY += (dir * Math.PI) / 2; rebuild(); } }
};
export const deleteSel = () => { const s = useUI.getState().selected; if (s) removeComponent(s); };
export const setTheme = (t: 'dark' | 'light') => { try { localStorage.setItem('ts-theme', t); } catch { /* ignore */ } useUI.setState({ theme: t }); };
export const toggleTheme = () => setTheme(useUI.getState().theme === 'dark' ? 'light' : 'dark');
export const toggleIR = () => useUI.setState((u) => ({ renderMode: u.renderMode === 'ir' ? 'pbr' : 'ir' }));
export function screenshot() {
  const c = document.querySelector('#viewport canvas') as HTMLCanvasElement | null; if (!c) return;
  const a = document.createElement('a'); a.download = `thermosim-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`; a.href = c.toDataURL('image/png'); a.click();
  useUI.getState().notify('צילום המסך נשמר');
}
export const VIEWS: { id: 'front' | 'back' | 'left' | 'right' | 'top' | 'iso'; label: string; icon: string; key: string }[] = [
  { id: 'front', label: 'חזית', icon: 'front', key: 'Ctrl+1' }, { id: 'back', label: 'אחור', icon: 'front', key: 'Ctrl+2' }, { id: 'left', label: 'שמאל', icon: 'right', key: 'Ctrl+3' },
  { id: 'right', label: 'ימין', icon: 'right', key: 'Ctrl+4' }, { id: 'top', label: 'מבט על', icon: 'top', key: 'Ctrl+5' }, { id: 'iso', label: 'איזומטרי', icon: 'iso', key: 'Ctrl+7' },
];
export const setQuality = (q: 'high' | 'balanced' | 'fast') => { try { localStorage.setItem('ts-quality', q); } catch { /* ignore */ } useUI.setState({ quality: q }); };
