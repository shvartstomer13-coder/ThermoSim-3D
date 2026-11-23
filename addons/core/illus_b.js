/* ---------- Generic inline body helper ---------- */
const NXI_line = (col, y = 230, x1 = 20, x2 = 620) => NXI_F(`M${x1},${y} L${x2},${y}`, col, 12);
/* ---------- Fine filter ---------- */
NXI_DRAW.fine_filter = () => {
  const C = NXI_C;
  let b = NXI_R(220, 70, 200, 280, "url(#nxSteelH)", { rx: 30, st: "#334155", sw: 2, sh: 1 });
  b += NXI_R(234, 92, 172, 244, "#16263b", { rx: 22 });
  b += NXI_R(280, 110, 80, 210, "url(#nxPleat)", { rx: 6 });
  b += NXI_R(306, 110, 28, 210, "#0f2547", { rx: 4, op: 0.9 });
  b += NXI_R(212, 60, 216, 22, "url(#nxSteel)", { rx: 8 }) + NXI_R(316, 36, 8, 26, "url(#nxBrass)");
  b += NXI_F("M20,300 L240,300 L262,300", C.pg, 11) + NXI_A(70, 300, 0, C.pg);
  for (let k = 0; k < 5; k++) b += `<path d="M256,${140 + k * 36} h26" stroke="${C.pg}" stroke-width="3" marker-end="url(#nxArr)"/><path d="M384,${140 + k * 36} h-26" stroke="${C.pg}" stroke-width="3" marker-end="url(#nxArr)"/>`;
  b += NXI_F("M320,320 L320,120", "#5eead4", 7, { slow: 1 });
  b += NXI_F("M320,100 L320,90 L440,90 L440,160 L620,160", C.pg, 11) + NXI_A(580, 160, 0, C.pg);
  for (let k = 0; k < 14; k++) b += NXI_O(244 + (k % 4) * 8, 150 + k * 12, 2, "#a16207");
  b += NXI_O(150, 230, 26, "#f8fafc", { st: "#64748b", sw: 3 }) + `<path d="M150,230 l12,-14" stroke="#dc2626" stroke-width="2.5"/>` + NXI_R(147, 256, 6, 40, "url(#nxSteel)");
  b += NXI_O(520, 100, 26, "#f8fafc", { st: "#64748b", sw: 3 }) + `<path d="M520,100 l14,-8" stroke="#dc2626" stroke-width="2.5"/>` + NXI_R(517, 126, 6, 30, "url(#nxSteel)");
  b += NXI_L(50, 130, 290, 150, "מחסנית קפלים 50 מיקרון", { a: "end", s: 12 });
  b += NXI_L(50, 190, 248, 200, "חלקיקים שנלכדו", { a: "end", s: 12 });
  b += NXI_L(600, 260, 330, 250, "ליבה – זרימה מבחוץ פנימה", { a: "start", s: 12 });
  b += NXI_T(150, 330, "לחץ כניסה", { s: 11 }) + NXI_T(575, 104, "לחץ יציאה", { s: 11, a: "start" });
  b += NXI_L(600, 22, 324, 40, "פקק ניקוז אוויר", { a: "start", s: 12 });
  b += NXI_EQ(130, 380, "ΔP = ΔP_clean·[0.6·x/(1−c) + 0.4·x²]");
  return NXI_wrap(b);
};
/* ---------- Air & dirt separator ---------- */
NXI_DRAW.air_separator = () => {
  const C = NXI_C;
  let b = NXI_R(240, 70, 160, 290, "url(#nxRed)", { rx: 70, st: "#7f1d1d", sw: 2, sh: 1 });
  b += NXI_R(254, 86, 132, 258, "#16263b", { rx: 60 });
  b += NXI_R(264, 140, 112, 150, "url(#nxFins)", { op: 0.35, rx: 8 });
  b += NXI_F("M20,215 L260,215", C.pg, 11) + NXI_F("M380,215 L620,215", C.pg, 11) + NXI_A(60, 215, 0, C.pg) + NXI_A(590, 215, 0, C.pg);
  b += NXI_F("M262,215 L378,215", C.pg, 5, { slow: 1, op: 0.6 });
  for (let k = 0; k < 12; k++) b += `<circle class="nxbub" style="animation-delay:${(k % 6) * 0.4}s" cx="${280 + (k % 6) * 16}" cy="${190 + (k % 3) * 12}" r="${2 + (k % 3)}" fill="#e0f2fe" opacity=".9"/>`;
  b += NXI_R(298, 96, 44, 18, "#e0f2fe", { rx: 9, op: 0.35 });
  b += NXI_R(306, 36, 28, 36, "url(#nxBrass)", { rx: 4 }) + NXI_R(314, 20, 12, 18, "#111827", { rx: 2 });
  b += `<path d="M320,18 q-6,-10 0,-16" stroke="#e2e8f0" stroke-width="2" fill="none" marker-end="url(#nxArr)"/>`;
  for (let k = 0; k < 10; k++) b += NXI_O(282 + (k % 5) * 18, 318 + Math.floor(k / 5) * 9, 3, "#a16207");
  b += NXI_R(308, 358, 24, 22, "url(#nxBrass)", { rx: 3 });
  b += NXI_L(600, 60, 330, 40, "שסתום אוויר אוטומטי (מצוף)", { a: "start", s: 12 });
  b += NXI_L(50, 150, 290, 170, "רשת ליכוד בועות", { a: "end", s: 12 });
  b += NXI_L(600, 300, 360, 320, "משקעים שוקעים", { a: "start", s: 12 });
  b += NXI_L(600, 370, 332, 370, "ברז ניקוז", { a: "start", s: 12 });
  b += NXI_T(320, 140, "בועות עולות", { s: 11.5 });
  b += NXI_T(140, 260, "מהירות נמוכה בגוף ← הבועות מספיקות לעלות", { s: 12 });
  b += NXI_EQ(70, 380, "ΔP = ΔP_rated·(ṁ/ṁ_r)²");
  return NXI_wrap(b);
};
/* ---------- 3-way mixing valve ---------- */
NXI_DRAW.valve3 = () => {
  const C = NXI_C;
  let b = NXI_P("M150,190 h120 a60,60 0 0 1 100,0 h120 v80 h-120 v90 h-100 v-90 h-120z", "url(#nxDark)", { st: "#64748b", sw: 2, sh: 1 });
  b += NXI_F("M20,230 L300,230", C.hot, 12) + NXI_F("M320,390 L320,290", C.cold, 12) + NXI_F("M340,230 L620,230", "url(#nxHotColdH)", 12);
  b += NXI_A(60, 230, 0, C.hot) + NXI_A(320, 330, -90, C.cold) + NXI_A(590, 230, 0, "#c084fc");
  b += NXI_R(296, 200, 48, 60, "url(#nxSteel)", { rx: 6 }) + NXI_R(316, 90, 8, 112, "url(#nxSteelH)");
  b += NXI_R(250, 40, 140, 60, "url(#nxGalv)", { rx: 8, st: "#475569", sh: 1 }) + NXI_O(320, 70, 16, "#f8fafc", { st: "#334155" }) + `<path d="M320,70 l10,-10" stroke="#dc2626" stroke-width="3"/>`;
  b += NXI_T(60, 214, "A", { s: 15, b: 1, ltr: 1 }) + NXI_T(340, 372, "B", { s: 15, b: 1, ltr: 1 }) + NXI_T(580, 214, "AB", { s: 15, b: 1, ltr: 1 });
  b += NXI_L(600, 70, 390, 70, "מפעיל חשמלי 0–10V", { a: "start", s: 12 });
  b += NXI_L(600, 140, 344, 225, "פקק כפול – פותח A וסוגר B", { a: "start", s: 12 });
  b += NXI_L(50, 300, 150, 240, "זרם ראשי (חם)", { a: "end", s: 12 });
  b += NXI_L(170, 360, 320, 360, "מעקף (קר)", { a: "end", s: 12 });
  b += NXI_EQ(380, 300, "ṁ_AB = ṁ_A + ṁ_B") + NXI_EQ(380, 330, "h_AB = (ṁ_A·h_A + ṁ_B·h_B)/ṁ_AB") + NXI_EQ(380, 360, "ΔP_i = (ρ/1000)·(V̇/Kv_i)²");
  return NXI_wrap(b);
};
/* ---------- Balancing valve ---------- */
NXI_DRAW.balancing_valve = () => {
  const C = NXI_C;
  let b = NXI_line(C.pg, 260);
  b += NXI_P("M160,200 h320 v120 h-320z", "url(#nxRed)", { st: "#7f1d1d", sw: 2, sh: 1 });
  b += NXI_P("M180,250 h120 v-30 h40 v100 h-40 v-40 h-120z", "#16263b", { op: 0.75 });
  b += NXI_R(300, 210, 40, 46, "url(#nxSteel)", { rx: 5 }) + NXI_R(314, 110, 12, 102, "url(#nxSteelH)");
  b += NXI_R(240, 80, 160, 30, "url(#nxRed)", { rx: 15, sh: 1 }) + NXI_R(300, 88, 40, 14, "#f8fafc", { rx: 3 }) + NXI_T(320, 99, "4.5", { s: 12, b: 1, c: "#0f172a", ltr: 1 });
  b += NXI_F("M188,260 L452,260", C.pg, 6, { op: 0.7 });
  for (const [xx, col] of [
    [210, "#ef4444"],
    [430, "#3b82f6"],
  ])
    b += NXI_R(xx - 6, 160, 12, 42, "url(#nxBrass)") + NXI_R(xx - 9, 150, 18, 12, col, { rx: 3 });
  b += `<path d="M210,150 C210,90 120,80 110,120" stroke="#94a3b8" stroke-width="2" fill="none"/><path d="M430,150 C430,90 520,80 530,120" stroke="#94a3b8" stroke-width="2" fill="none"/>`;
  b += NXI_R(470, 116, 110, 54, "#0b2a1e", { rx: 8, st: "#22c55e", sw: 1 }) + NXI_T(525, 150, "ΔP 12.4 kPa", { s: 13, c: "#4ade80", ltr: 1 });
  b += NXI_L(60, 90, 250, 95, "ידית כיול עם סקאלה", { a: "end", s: 12 });
  b += NXI_L(60, 180, 204, 160, "נקודות מדידה", { a: "end", s: 12 });
  b += NXI_L(600, 220, 525, 170, "מד ספיקה נייד", { a: "start", s: 12 });
  b += NXI_L(600, 330, 330, 250, "פקק מווסת", { a: "start", s: 12 });
  b += NXI_EQ(120, 370, "V̇ = Kv(n)·√(ΔP/100 · 1000/ρ)   [m³/h]");
  return NXI_wrap(b);
};
/* ---------- Control valve ---------- */
NXI_DRAW.valve = () => {
  const C = NXI_C;
  let b = NXI_line(C.pg, 270);
  b += NXI_P("M150,215 h340 v110 h-340z", "url(#nxBlue)", { st: "#1e3a8a", sw: 2, sh: 1 });
  b += NXI_P("M170,250 h120 v-20 h60 v40 h-60z", "#16263b", { op: 0.7 }) + NXI_P("M350,270 h120 v30 h-180 v-30z", "#16263b", { op: 0.7 });
  b += NXI_R(280, 268, 80, 10, "url(#nxSteel)");
  b += NXI_P("M296,236 h48 l-8,32 h-32z", "url(#nxSteel)", { st: "#334155" }) + NXI_R(314, 110, 12, 128, "url(#nxSteelH)");
  b += NXI_P("M230,110 h180 a90,40 0 0 0 -180,0z", "url(#nxBlue)", { st: "#1e3a8a", sh: 1 }) + NXI_R(230, 108, 180, 8, "#0f172a");
  b += NXI_P("M238,104 q82,-40 164,0", "none", { st: "#f59e0b", sw: 3 });
  b += NXI_F("M190,255 L300,255 L320,282 L350,290 L460,290", "#5eead4", 5, { op: 0.8 });
  b += NXI_L(600, 70, 360, 80, "מפעיל ממברנה", { a: "start", s: 12 });
  b += NXI_L(600, 160, 326, 160, "גל", { a: "start", s: 12 });
  b += NXI_L(60, 160, 300, 245, "פקק", { a: "end", s: 12 });
  b += NXI_L(60, 340, 290, 278, "מושב", { a: "end", s: 12 });
  b += NXI_EQ(150, 375, "ΔP = (ρ/1000)·(V̇/Kv)²·100   Kv = Kvs·R^(x−1)");
  return NXI_wrap(b);
};
/* ---------- Instruments ---------- */
NXI_DRAW.flow_meter = () => {
  const C = NXI_C;
  let b = NXI_line(C.pg, 250);
  b += NXI_R(180, 190, 280, 120, "url(#nxSteel)", { rx: 12, st: "#334155", sw: 2, sh: 1 }) + NXI_R(170, 180, 16, 140, "url(#nxSteelH)") + NXI_R(454, 180, 16, 140, "url(#nxSteelH)");
  b += NXI_R(240, 160, 160, 26, "url(#nxCopper)", { rx: 8 }) + NXI_R(240, 314, 160, 26, "url(#nxCopper)", { rx: 8 });
  for (let k = 0; k < 4; k++) b += `<path d="M${260 + k * 40},186 V314" stroke="#a78bfa" stroke-width="2" stroke-dasharray="4 4" marker-end="url(#nxArr)"/>`;
  b += NXI_O(320, 205, 7, "url(#nxBrass)") + NXI_O(320, 295, 7, "url(#nxBrass)");
  b += NXI_R(260, 60, 120, 80, "url(#nxBlue)", { rx: 10, sh: 1 }) + NXI_R(276, 74, 88, 34, "#0b2a1e", { rx: 4 }) + NXI_T(320, 97, "15.6 m³/h", { s: 13, c: "#4ade80", ltr: 1 }) + NXI_R(312, 140, 16, 22, "url(#nxSteel)");
  b += NXI_L(60, 160, 245, 172, "סלילי שדה מגנטי", { a: "end", s: 12 });
  b += NXI_L(600, 210, 327, 205, "אלקטרודות", { a: "start", s: 12 });
  b += NXI_L(600, 90, 380, 90, "משדר", { a: "start", s: 12 });
  b += NXI_EQ(200, 375, "U = B·D·v   →   V̇ = (π·D/4B)·U");
  return NXI_wrap(b);
};
NXI_DRAW.pressure_sensor = () => {
  const C = NXI_C;
  let b = NXI_R(40, 240, 560, 70, "url(#nxSteel)", { rx: 10, sh: 1 }) + NXI_R(40, 254, 560, 42, "url(#nxWater)");
  b += NXI_F("M60,275 L590,275", C.pg, 6);
  b += NXI_R(300, 170, 40, 72, "url(#nxSteelH)") + NXI_R(306, 180, 28, 62, "url(#nxWater)", { op: 0.8 });
  b += NXI_R(286, 150, 68, 22, "url(#nxSteel)", { rx: 4 }) + NXI_P("M290,160 q30,-10 60,0", "none", { st: "#f59e0b", sw: 3 });
  b += NXI_R(270, 60, 100, 90, "url(#nxBlue)", { rx: 12, sh: 1 }) + NXI_R(286, 78, 68, 30, "#0b2a1e", { rx: 4 }) + NXI_T(320, 99, "312 kPa", { s: 12.5, c: "#4ade80", ltr: 1 });
  b += NXI_L(60, 160, 290, 160, "ממברנה + מתמר עיבור", { a: "end", s: 12 });
  b += NXI_L(600, 200, 335, 200, "קידוח לחץ", { a: "start", s: 12 });
  b += NXI_L(600, 90, 370, 90, "משדר 4–20mA", { a: "start", s: 12 });
  b += NXI_EQ(220, 370, "ΔR/R ∝ ε ∝ P");
  return NXI_wrap(b);
};
NXI_DRAW.temp_sensor = () => {
  const C = NXI_C;
  let b = NXI_R(40, 230, 560, 100, "url(#nxSteel)", { rx: 10, sh: 1 }) + NXI_R(40, 244, 560, 72, "url(#nxRed)", { op: 0.55 });
  b += NXI_F("M60,300 L590,300", C.hot, 6);
  b += NXI_P("M306,150 h28 v130 a14,14 0 0 1 -28,0z", "url(#nxSteelH)", { st: "#334155" }) + NXI_R(314, 250, 12, 34, "#f59e0b", { rx: 4 });
  b += NXI_R(286, 128, 68, 26, "url(#nxSteel)", { rx: 4 }) + NXI_R(270, 60, 100, 70, "url(#nxGalv)", { rx: 30, sh: 1 }) + NXI_T(320, 100, "Pt100", { s: 13, c: "#0f172a", b: 1, ltr: 1 });
  b += NXI_L(600, 260, 326, 266, "אלמנט התנגדות Pt100", { a: "start", s: 12 });
  b += NXI_L(60, 180, 306, 200, "כיס תרמי (מגן)", { a: "end", s: 12 });
  b += NXI_L(600, 90, 370, 90, "ראש חיבור", { a: "start", s: 12 });
  b += NXI_EQ(190, 375, "R(T) = R₀·(1 + α·(T − T₀))   α ≈ 0.00385");
  return NXI_wrap(b);
};
/* ---------- Check valve & strainer ---------- */
NXI_DRAW.check_valve = () => {
  const C = NXI_C;
  let b = NXI_line(C.pg, 250);
  b += NXI_P("M160,180 h320 v140 h-320z", "url(#nxDark)", { st: "#64748b", sw: 2, sh: 1 }) + NXI_R(176, 196, 288, 108, "#16263b", { rx: 30 });
  b += NXI_R(286, 200, 10, 100, "url(#nxSteel)");
  b += `<g transform="rotate(-38 300 202)">${NXI_R(296, 202, 14, 92, "url(#nxSteelH)", { rx: 6 })}</g>` + NXI_O(300, 202, 7, "url(#nxBrass)");
  b += NXI_F("M190,265 L280,265 Q330,280 450,262", "#5eead4", 6);
  b += `<path d="M560,130 h-90" stroke="#f87171" stroke-width="4" marker-end="url(#nxArr)"/><path d="M455,118 l14,24 M469,118 l-14,24" stroke="#f87171" stroke-width="4"/>`;
  b += NXI_T(520, 112, "זרימה הפוכה נחסמת", { s: 12 });
  b += NXI_L(60, 120, 300, 202, "ציר", { a: "end", s: 12 });
  b += NXI_L(60, 340, 340, 240, "דסקית מתנדנדת", { a: "end", s: 12 });
  b += NXI_EQ(220, 375, "ΔP = K·ρv²/2");
  return NXI_wrap(b);
};
NXI_DRAW.strainer = () => {
  const C = NXI_C;
  let b = NXI_line(C.pg, 170);
  b += NXI_R(150, 120, 340, 100, "url(#nxDark)", { rx: 20, st: "#64748b", sw: 2, sh: 1 });
  b += `<g transform="rotate(40 330 200)">${NXI_R(300, 180, 70, 170, "url(#nxDark)", { rx: 12, st: "#64748b", sw: 2 }) + NXI_R(314, 200, 42, 130, "url(#nxFins)", { op: 0.8 }) + NXI_R(294, 344, 82, 20, "url(#nxSteel)", { rx: 4 })}</g>`;
  b += NXI_F("M170,170 L300,170 L330,215 L360,170 L470,170", "#5eead4", 6, { op: 0.85 });
  for (let k = 0; k < 8; k++) b += NXI_O(260 + k * 6, 260 + k * 7, 2.6, "#a16207");
  b += NXI_L(60, 300, 260, 270, "רשת סינון", { a: "end", s: 12 });
  b += NXI_L(600, 330, 330, 340, "פקק ניקוי", { a: "start", s: 12 });
  b += NXI_EQ(220, 375, "ΔP = K·ρv²/2");
  return NXI_wrap(b);
};
