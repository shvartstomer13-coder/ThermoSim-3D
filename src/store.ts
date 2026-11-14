import { create } from 'zustand';
import type { PaletteId, TempUnit } from './render/ThermalShader';

export type Tool = 'select' | 'place' | 'pipe';
export type RenderMode = 'pbr' | 'ir';
export type Theme = 'dark' | 'light';
export type Quality = 'high' | 'balanced' | 'fast';
const savedQ = (): Quality => { try { const v = localStorage.getItem('ts-quality'); if (v === 'high' || v === 'balanced' || v === 'fast') return v; } catch { /* ignore */ } return 'balanced'; };
export type RibbonTab = 'sim' | 'parts' | 'view' | 'tools';
const savedTheme = (): Theme => { try { const v = localStorage.getItem('ts-theme'); if (v === 'light' || v === 'dark') return v; } catch { /* ignore */ } return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; };
export interface SuggestItem { a: { comp: string; port: string }; b: { comp: string; port: string }; dist: number; grow?: string }
export interface Suggest { comp: string; items: SuggestItem[] }
export interface UIState {
  tool: Tool; placeType: string | null; selected: string | null; pipeStart: { comp: string; port: string } | null;
  renderMode: RenderMode; palette: PaletteId; unit: TempUnit; irAuto: boolean; irMin: number; irMax: number;
  hz: number; speed: number; running: boolean;
  showPorts: boolean; showFlow: boolean; showLabels: boolean; snap: number;
  theme: Theme; ribbonTab: RibbonTab; ribbonOpen: boolean; treeOpen: boolean; propsOpen: boolean; bottomOpen: boolean; treeW: number; propsW: number; bottomH: number; helpOpen: boolean; wheelReverse: boolean; ctxMenu: { x: number; y: number } | null; orientOpen: boolean; suggest: Suggest | null; canUndo: boolean; canRedo: boolean; pipeVia: [number, number, number][]; quality: Quality; projectName: string | null; fileName: string | null;
  assetOpen: boolean; version: number; tick: number; toast: string | null; templateId: string | null;
  set: (p: Partial<UIState>) => void; bump: () => void; notify: (m: string) => void;
}
export const useUI = create<UIState>((set, get) => ({
  tool: 'select', placeType: null, selected: null, pipeStart: null,
  renderMode: 'pbr', palette: 'ironbow', unit: 'C', irAuto: true, irMin: 290, irMax: 340,
  hz: 30, speed: 1, running: true,
  showPorts: true, showFlow: true, showLabels: true, snap: 0.25,
  theme: savedTheme(), ribbonTab: 'sim', ribbonOpen: true, treeOpen: true, propsOpen: true, bottomOpen: false, treeW: 272, propsW: 316, bottomH: 190, helpOpen: false, wheelReverse: false, ctxMenu: null, orientOpen: false, suggest: null, canUndo: false, canRedo: false, pipeVia: [], quality: savedQ(), projectName: null, fileName: null,
  assetOpen: false, version: 0, tick: 0, toast: null, templateId: null,
  set: (p) => set(p),
  bump: () => set((s) => ({ version: s.version + 1 })),
  notify: (m) => { set({ toast: m }); setTimeout(() => { if (get().toast === m) set({ toast: null }); }, 3500); },
}));
