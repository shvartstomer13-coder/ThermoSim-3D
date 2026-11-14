/** Save / open projects. "Save" writes a self-contained copy of the app (the single-file build) with the project embedded,
 *  so double-clicking the saved .html re-opens the simulator exactly where you left it. */
import { loadProject, projectData, resetHistory, rt, type Project } from '../runtime';
import { TEMPLATES } from '../physics/templates';
import { useUI } from '../store';
import { view } from '../render/SceneView';

// snapshot of the page as delivered (before React touches the DOM)
const APP_SRC = (() => {
  try {
    const d = document.documentElement.cloneNode(true) as HTMLElement;
    d.querySelector('#ts-project')?.remove(); const root = d.querySelector('#root'); if (root) root.innerHTML = '';
    d.removeAttribute('data-theme'); return '<!DOCTYPE html>\n' + d.outerHTML;
  } catch { return ''; }
})();
/** the single-file build inlines its script; the multi-file build references /assets (cannot be saved standalone) */
const STANDALONE = !document.querySelector('script[type="module"][src]');
const EMBED = document.getElementById('ts-project')?.textContent ?? null;
let handle: { createWritable(): Promise<{ write(d: string): Promise<void>; close(): Promise<void> }>; name: string } | null = null;

export function embeddedProject(): Project | null { try { return EMBED ? (JSON.parse(EMBED) as Project) : null; } catch { return null; } }

const defaultName = () => { const u = useUI.getState(); return u.projectName ?? TEMPLATES.find((t) => t.id === u.templateId)?.name ?? 'פרויקט ThermoSim'; };
const safe = (s: string) => s.replace(new RegExp('[\\\\/:*?"<>|]+', 'g'), '-').trim() || 'project';
const esc = (s: string) => s.split('<').join('\\u003c').split('\u2028').join('\\u2028').split('\u2029').join('\\u2029');

function buildHtml(p: Project): string {
  const SO = '<scr' + 'ipt id="ts-project" type="application/json">', SC = '</scr' + 'ipt>'; // split so the bundle never contains a literal closing tag
  const tag = SO + esc(JSON.stringify(p)) + SC;
  let html = APP_SRC;
  // title: only in the markup before the first script (the bundle may contain the same text)
  const t0 = html.indexOf('<title>'), sc = html.indexOf('<scr' + 'ipt');
  if (t0 >= 0 && (sc < 0 || t0 < sc)) { const t1 = html.indexOf('</title>', t0); html = html.slice(0, t0) + '<title>' + p.name.replace(/[<&]/g, '') + ' — ThermoSim 3D' + html.slice(t1); }
  // the project goes right before the real </head> (the last one; the inlined code may contain the string too)
  const h = html.lastIndexOf('</head>');
  return h >= 0 ? html.slice(0, h) + tag + '\n' + html.slice(h) : tag + html;
}

async function writeFile(name: string, content: string, mime: string, ext: string, reuse: boolean): Promise<string | null> {
  const w = window as unknown as { showSaveFilePicker?: (o: unknown) => Promise<typeof handle> };
  if (reuse && handle) { const s = await handle.createWritable(); await s.write(content); await s.close(); return handle.name; }
  if (w.showSaveFilePicker) {
    try {
      const h = await w.showSaveFilePicker({ suggestedName: name + ext, types: [{ description: ext === '.html' ? 'פרויקט ThermoSim (נפתח בדפדפן)' : 'נתוני פרויקט ThermoSim', accept: { [mime]: [ext] } }] });
      if (!h) return null; const s = await h.createWritable(); await s.write(content); await s.close(); if (ext === '.html') handle = h; return h.name;
    } catch (e) { if ((e as DOMException)?.name === 'AbortError') return null; /* not allowed here (e.g. inside a sandboxed frame): fall through */ }
  }
  const cl = (window as unknown as { claude?: { use(n: string): Promise<{ save(o: { filename: string; data: string }): Promise<unknown> } | null> } }).claude;
  if (cl?.use) { try { const dl = await cl.use('downloads'); if (dl) { await dl.save({ filename: name + ext, data: content }); return name + ext; } } catch { return null; } }
  const a = document.createElement('a'); a.download = name + ext; a.href = URL.createObjectURL(new Blob([content], { type: mime })); a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return name + ext;
}

export async function saveProject(as = false) {
  const ui = useUI.getState(); let name = ui.projectName ?? defaultName();
  if (as) handle = null; // the file name chosen in the save dialog becomes the project name
  const p = projectData(name, view.getCam());
  try {
    const f = STANDALONE && APP_SRC ? await writeFile(safe(name), buildHtml(p), 'text/html', '.html', !as)
      : await writeFile(safe(name), JSON.stringify(p, null, 1), 'application/json', '.json', false);
    if (f) { name = f.replace(/\.(html?|json)$/i, ''); useUI.setState({ fileName: f, projectName: name }); ui.notify(STANDALONE ? `הפרויקט נשמר: ${f} — פתיחת הקובץ תמשיך מאותה נקודה` : `הפרויקט נשמר כ-JSON: ${f}`); }
  } catch (e) { ui.notify('השמירה נכשלה: ' + String((e as Error).message ?? e)); }
}
export async function exportJson() { const p = projectData(defaultName(), view.getCam()); const f = await writeFile(safe(p.name), JSON.stringify(p, null, 1), 'application/json', '.json', false); if (f) useUI.getState().notify('יוצא: ' + f); }

export function openProject() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.html,.htm,.json,application/json,text/html';
  inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return; const txt = await f.text(); let p: Project | null = null;
    try {
      if (/^\s*\{/.test(txt)) p = JSON.parse(txt);
      else { const key = 'id="ts-project" type="application/json">'; const i = txt.lastIndexOf(key); if (i >= 0) { const j = txt.indexOf('</scr' + 'ipt>', i); p = JSON.parse(txt.slice(i + key.length, j)); } }
      if (!p) throw new Error('no project');
      applyProject(p); handle = null; useUI.setState({ fileName: f.name }); useUI.getState().notify('נפתח: ' + (p.name || f.name));
    } catch { useUI.getState().notify('הקובץ אינו פרויקט ThermoSim תקין'); }
  };
  inp.click();
}
export function applyProject(p: Project) {
  if (p.cam) view.pendingCam = p.cam;
  loadProject(p);
  if (p.cam) { view.setCam(p.cam.pos, p.cam.target); view.pendingCam = null; }
}
export function newProject() { resetHistory(); handle = null; useUI.setState({ projectName: null, fileName: null }); void rt; }
export const canStandalone = () => STANDALONE;
