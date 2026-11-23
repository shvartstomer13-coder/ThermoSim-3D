/* === ThermoSim add-on: technical cutaway illustrations (vector, scalable) === */
const NXI_C = {
    hot: "#f87171",
    hotD: "#dc2626",
    cold: "#38bdf8",
    coldD: "#1d4ed8",
    pg: "#2dd4bf",
    pgD: "#0f766e",
    air: "#cbd5e1",
    ref: "#fbbf24",
    refL: "#fde68a",
    steam: "#e2e8f0",
    txt: "#e5edf7",
    sub: "#93a4bb",
    line: "#64748b",
    acc: "#7dd3fc",
  },
  NXI_DEFS = `<defs>
<linearGradient id="nxSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef2f6"/><stop offset=".35" stop-color="#b7c1cb"/><stop offset=".6" stop-color="#8794a1"/><stop offset="1" stop-color="#4b5663"/></linearGradient>
<linearGradient id="nxSteelH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4b5663"/><stop offset=".3" stop-color="#c9d1d9"/><stop offset=".55" stop-color="#eef2f6"/><stop offset="1" stop-color="#5b6673"/></linearGradient>
<linearGradient id="nxDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5563"/><stop offset="1" stop-color="#1f2733"/></linearGradient>
<linearGradient id="nxCab" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a3442"/><stop offset=".5" stop-color="#3a4656"/><stop offset="1" stop-color="#222b37"/></linearGradient>
<linearGradient id="nxCopper" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6c39a"/><stop offset=".45" stop-color="#c87941"/><stop offset="1" stop-color="#7a3f1d"/></linearGradient>
<linearGradient id="nxBrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbe7a1"/><stop offset=".5" stop-color="#c9a24a"/><stop offset="1" stop-color="#7c5d1c"/></linearGradient>
<linearGradient id="nxBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#60a5fa"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient>
<linearGradient id="nxRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#7f1d1d"/></linearGradient>
<linearGradient id="nxGreen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4ade80"/><stop offset="1" stop-color="#14532d"/></linearGradient>
<linearGradient id="nxGalv" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d6dde3"/><stop offset=".5" stop-color="#9aa6b1"/><stop offset="1" stop-color="#6b7783"/></linearGradient>
<linearGradient id="nxHotCold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
<linearGradient id="nxColdHot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#38bdf8"/><stop offset="1" stop-color="#f87171"/></linearGradient>
<linearGradient id="nxHotColdH" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f87171"/><stop offset="1" stop-color="#38bdf8"/></linearGradient>
<linearGradient id="nxWater" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc" stop-opacity=".85"/><stop offset="1" stop-color="#1d4ed8" stop-opacity=".9"/></linearGradient>
<linearGradient id="nxInsul" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1f5f9"/><stop offset="1" stop-color="#9aa6b2"/></linearGradient>
<radialGradient id="nxFlame" cx=".5" cy=".7" r=".6"><stop offset="0" stop-color="#fff7c2"/><stop offset=".35" stop-color="#fbbf24"/><stop offset=".75" stop-color="#ea580c"/><stop offset="1" stop-color="#7c2d12" stop-opacity="0"/></radialGradient>
<radialGradient id="nxGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fca5a5" stop-opacity=".9"/><stop offset="1" stop-color="#ef4444" stop-opacity="0"/></radialGradient>
<radialGradient id="nxBg" cx=".5" cy=".35" r=".8"><stop offset="0" stop-color="#16243a"/><stop offset="1" stop-color="#0a121f"/></radialGradient>
<pattern id="nxGrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#1d2d45" stroke-width=".6"/></pattern>
<pattern id="nxHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#5b6673"/><path d="M0 0V6" stroke="#2b333d" stroke-width="2"/></pattern>
<pattern id="nxFins" width="5" height="10" patternUnits="userSpaceOnUse"><rect width="5" height="10" fill="#9aa6b1"/><path d="M0 0V10" stroke="#e2e8f0" stroke-width="1.4"/></pattern>
<pattern id="nxFill" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="14" height="14" fill="#5d7287"/><path d="M0 14L14 0M-4 4L4 -4M10 18L18 10" stroke="#9fb4c8" stroke-width="2"/></pattern>
<pattern id="nxPleat" width="8" height="10" patternUnits="userSpaceOnUse"><path d="M0 0L4 10L8 0" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1"/></pattern>
<filter id="nxSh" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="3" stdDeviation="3" flood-color="#000" flood-opacity=".45"/></filter>
<marker id="nxArr" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="context-stroke"/></marker>
</defs>`,
  NXI_R = (x, y, w, h, f, o = {}) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 0}" fill="${f}"${o.st ? ` stroke="${o.st}" stroke-width="${o.sw ?? 1.5}"` : ""}${o.op ? ` opacity="${o.op}"` : ""}${o.sh ? ' filter="url(#nxSh)"' : ""}/>`,
  NXI_P = (d, f, o = {}) =>
    `<path d="${d}" fill="${f}"${o.st ? ` stroke="${o.st}" stroke-width="${o.sw ?? 1.5}"` : ""}${o.op ? ` opacity="${o.op}"` : ""}${o.lj ? ' stroke-linejoin="round" stroke-linecap="round"' : ""}${o.sh ? ' filter="url(#nxSh)"' : ""}/>`,
  NXI_O = (cx, cy, r, f, o = {}) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}"${o.st ? ` stroke="${o.st}" stroke-width="${o.sw ?? 1.5}"` : ""}${o.op ? ` opacity="${o.op}"` : ""}${o.sh ? ' filter="url(#nxSh)"' : ""}/>`,
  NXI_F = (d, col, w = 10, o = {}) =>
    `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${o.op ?? 0.95}"/>` +
    `<path d="${d}" class="nxf${o.slow ? " nxs" : ""}" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="${Math.max(w * 0.28, 1.4)}" stroke-dasharray="5 13" stroke-linecap="round"/>`,
  NXI_A = (x, y, deg, col, s = 1) =>
    `<path d="M-9,-7L9,0L-9,7Z" transform="translate(${x},${y}) rotate(${deg}) scale(${s})" fill="${col}" stroke="#0b1220" stroke-width=".8"/>`,
  NXI_T = (x, y, t, o = {}) =>
    `<text x="${x}" y="${y}" text-anchor="${o.ltr ? (o.a ?? "middle") : o.a === "start" ? "end" : o.a === "end" ? "start" : "middle"}" font-size="${o.s ?? 13}" font-weight="${o.b ? 700 : 500}" fill="${o.c ?? NXI_C.txt}" direction="${o.ltr ? "ltr" : "rtl"}" paint-order="stroke" stroke="#0a121f" stroke-width="3.5" stroke-linejoin="round">${t}</text>`,
  NXI_L = (x, y, tx, ty, t, o = {}) => {
    const w = String(t).length * (o.s ?? 13) * 0.52;
    o.a === "end" ? (x = Math.max(x, w + 14)) : o.a === "start" ? (x = Math.min(x, 626 - w)) : (x = Math.min(Math.max(x, w / 2 + 8), 632 - w / 2));
    return NXI_Lr(x, y, tx, ty, t, o);
  },
  NXI_Lr = (x, y, tx, ty, t, o = {}) =>
    `<path d="M${tx},${ty}L${x},${y}" stroke="${NXI_C.acc}" stroke-width="1.1" fill="none" opacity=".85"/>` +
    NXI_O(tx, ty, 2.6, NXI_C.acc) +
    NXI_T(x + (o.a === "start" ? 4 : o.a === "end" ? -4 : 0), y + (ty > y ? -5 : 13), t, o),
  NXI_N = (x, y, n) => NXI_O(x, y, 10, "#0ea5e9", { st: "#e0f2fe", sw: 1.5 }) + NXI_T(x, y + 4.5, String(n), { s: 12, b: 1, c: "#fff" }),
  NXI_EQ = (x, y, t) =>
    NXI_R(x - 4, y - 16, t.length * 7.4 + 14, 24, "#0b1626", { rx: 6, st: "#2b4466", sw: 1 }) +
    `<text x="${x + 3}" y="${y}" font-size="13" fill="#bae6fd" font-family="ui-monospace,Consolas,monospace" direction="ltr">${t}</text>`,
  NXI_FL = (x, y, w, h) => NXI_R(x, y, w, h, "url(#nxSteel)", { st: "#334155", sw: 1 }),
  NXI_FAN = (cx, cy, r) =>
    `<ellipse class="nxfan" cx="${cx}" cy="${cy}" rx="${r}" ry="5" fill="#cbd5e1" stroke="#64748b" stroke-width="1"/>` +
    `<ellipse class="nxfan" style="animation-delay:-.45s" cx="${cx}" cy="${cy}" rx="${r}" ry="5" fill="#94a3b8" stroke="#64748b" stroke-width="1"/>` +
    NXI_R(cx - 4, cy, 8, 22, "url(#nxDark)") +
    NXI_O(cx, cy, 8, "#334155", { st: "#94a3b8" }),
  NXI_wrap = (body, cap) =>
    `<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" font-family="Heebo,Rubik,Assistant,Segoe UI,Arial,sans-serif" style="width:100%;height:auto;display:block"><style>.nxf{animation:nxfl 1.1s linear infinite}.nxs{animation-duration:2.4s}@keyframes nxfl{to{stroke-dashoffset:-36}}.nxspin{animation:nxsp 3s linear infinite;transform-box:fill-box;transform-origin:center}@keyframes nxsp{to{transform:rotate(360deg)}}.nxfan{animation:nxfa .9s linear infinite;transform-box:fill-box;transform-origin:center}@keyframes nxfa{0%{transform:scaleX(1)}25%{transform:scaleX(.08)}50%{transform:scaleX(-1)}75%{transform:scaleX(-.08)}100%{transform:scaleX(1)}}.nxbub{animation:nxbu 2.6s ease-in infinite}@keyframes nxbu{0%{transform:translateY(0);opacity:0}15%{opacity:1}100%{transform:translateY(-60px);opacity:0}}.nxdrop{animation:nxdr 1.6s linear infinite}@keyframes nxdr{0%{transform:translateY(-10px);opacity:0}20%{opacity:1}100%{transform:translateY(40px);opacity:0}}</style>${NXI_DEFS}<rect width="640" height="400" rx="14" fill="url(#nxBg)"/><rect width="640" height="400" rx="14" fill="url(#nxGrid)"/>${body}<text x="626" y="390" text-anchor="end" font-size="10.5" fill="#5f7390" direction="rtl">${cap ?? "חתך סכמטי · לא בקנה מידה"}</text></svg>`,
  NXI_LEG = (items, x = 18, y = 22) =>
    items
      .map(
        ([col, t], k) =>
          NXI_R(x, y + k * 20 - 9, 22, 8, col, { rx: 4 }) + NXI_T(x + 28, y + k * 20, t, { a: "start", s: 11.5, c: NXI_C.sub, ltr: 0 }),
      )
      .join("");
