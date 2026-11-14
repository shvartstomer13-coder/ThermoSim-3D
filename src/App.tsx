import { useEffect } from 'react';
import { SceneView, view } from './render/SceneView';
import { AssetManager } from './ui/AssetManager';
import { useAssets } from './render/AssetLoader';
import { duplicate, loadTemplate, redo, resetHistory, undo } from './runtime';
import { applyProject, embeddedProject, openProject, saveProject } from './ui/project';
import { useUI } from './store';
import { Ribbon } from './ui/Ribbon';
import { BottomDock, PropsPanel, TreePanel } from './ui/Panels';
import { ContextMenu, Help, Hint, Legend, OrientPopup, StatusBar, SuggestCard, Triad, ViewToolbar } from './ui/Hud';
import { deleteSel, pipeTool, rotateSel, selectTool, step, toggleIR, toggleRun, VIEWS } from './ui/actions';

export default function App() {
  const toast = useUI((s) => s.toast); const theme = useUI((s) => s.theme); const tool = useUI((s) => s.tool);
  useEffect(() => { document.documentElement.dataset.theme = theme; document.documentElement.dir = 'rtl'; document.documentElement.lang = 'he'; }, [theme]);
  useEffect(() => { void useAssets.getState().load(); const p = embeddedProject(); if (p) { try { applyProject(p); return; } catch { /* fall back */ } } if (!useUI.getState().templateId) { loadTemplate(new URLSearchParams(location.search).get('t') ?? 'dc', false); resetHistory(); } }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; const k = e.code; const ui = useUI.getState();
      if (k === 'F1') { e.preventDefault(); useUI.setState({ helpOpen: !ui.helpOpen }); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'KeyS') { e.preventDefault(); void saveProject(e.shiftKey); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'KeyO') { e.preventDefault(); openProject(); return; }
      if (el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) && k !== 'Escape') return;
      if ((e.ctrlKey || e.metaKey) && k === 'KeyZ') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'KeyY') { e.preventDefault(); redo(); return; }
      if ((e.ctrlKey || e.metaKey) && k === 'KeyD') { e.preventDefault(); if (ui.selected) duplicate(ui.selected); return; }
      const A = Math.PI / 12, Q = Math.PI / 2;
      if (k === 'Backspace' && ui.tool === 'pipe' && ui.pipeVia.length) { e.preventDefault(); useUI.setState({ pipeVia: ui.pipeVia.slice(0, -1) }); return; }
      if (k === 'Escape' && ui.tool === 'place' && ui.placeType === 'wall' && view.wallStart) { view.wallStart = null; return; }
      if (k === 'Escape') useUI.setState({ pipeVia: [], tool: 'select', placeType: null, pipeStart: null, assetOpen: false, helpOpen: false, ctxMenu: null, orientOpen: false, suggest: null });
      else if ((k === 'Delete' || k === 'Backspace') && ui.selected) { e.preventDefault(); deleteSel(); }
      else if (e.ctrlKey && /^(Digit|Numpad)[1-7]$/.test(k)) { e.preventDefault(); const v = VIEWS.find((x) => x.key === 'Ctrl+' + k.slice(-1)); if (v) view.preset(v.id); }
      else if (k.startsWith('Arrow')) {
        e.preventDefault(); const dx = k === 'ArrowLeft' ? -1 : k === 'ArrowRight' ? 1 : 0, dy = k === 'ArrowUp' ? -1 : k === 'ArrowDown' ? 1 : 0;
        if (e.ctrlKey) view.pan(dx, -dy); else view.orbit(dx * (e.shiftKey ? Q : A), dy * (e.shiftKey ? Q : A));
      }
      else if (e.ctrlKey || e.metaKey || e.altKey) return;
      else if (k === 'Space') { e.preventDefault(); if (e.shiftKey) toggleRun(); else useUI.setState({ orientOpen: !ui.orientOpen }); }
      else if (k === 'KeyF') view.fit();
      else if (k === 'KeyZ') view.zoom(e.shiftKey ? 0.8 : 1.25);
      else if (k === 'KeyR') rotateSel(e.shiftKey ? -1 : 1);
      else if (k === 'KeyN') step();
      else if (k === 'KeyP') pipeTool();
      else if (k === 'KeyV') selectTool();
      else if (k === 'KeyI') toggleIR();
    };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <div dir="rtl" className="flex h-full w-full flex-col bg-bg text-fg">
      <Ribbon />
      <div className="flex min-h-0 flex-1">
        <TreePanel />
        <div className="flex min-w-0 flex-1 flex-col">
          <main id="viewport" className={`relative min-h-0 flex-1 overflow-hidden ${tool === 'place' ? 'cursor-crosshair' : tool === 'pipe' ? 'cursor-cell' : ''}`}
            onContextMenu={(e) => { e.preventDefault(); useUI.setState({ ctxMenu: { x: e.clientX, y: e.clientY } }); }}>
            <SceneView /><ViewToolbar /><Hint /><Legend /><Triad /><OrientPopup /><SuggestCard />
            {toast && <div className="toast pointer-events-none absolute top-24 left-1/2 z-10 rounded-md border border-line2 bg-panel2 px-4 py-2 text-[12px] text-fg shadow-[var(--shadow)]">{toast}</div>}
            <AssetManager />
          </main>
          <BottomDock />
        </div>
        <PropsPanel />
      </div>
      <StatusBar />
      <ContextMenu /><Help />
    </div>
  );
}
