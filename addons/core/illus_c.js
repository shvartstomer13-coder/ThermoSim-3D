/* ---------- Shell & tube HX ---------- */
NXI_DRAW.shell_tube_hx = () => {
  const C = NXI_C;
  let b = NXI_R(110, 120, 420, 160, "url(#nxSteel)", { rx: 30, st: "#334155", sw: 2, sh: 1 });
  b += NXI_R(124, 134, 392, 132, "#16263b", { rx: 20 });
  b += NXI_R(70, 130, 50, 140, "url(#nxBlue)", { rx: 18 }) + NXI_R(520, 130, 50, 140, "url(#nxBlue)", { rx: 18 });
  for (let k = 0; k < 7; k++) b += NXI_R(120, 146 + k * 17, 400, 6, "#7dd3fc", { op: 0.85 });
  for (let k = 0; k < 5; k++) b += NXI_R(170 + k * 70, k % 2 ? 160 : 134, 8, 106, "url(#nxSteelH)");
  b += NXI_F("M180,40 L180,128", C.hot, 10) + NXI_F("M460,270 L460,360", C.hot, 10, { op: 0.75 });
  b += NXI_F("M150,145 Q210,260 245,150 Q285,260 315,150 Q355,260 385,150 Q425,260 455,265", "#fca5a5", 4, { op: 0.6 });
  b += NXI_F("M20,200 L70,200", C.cold, 10) + NXI_F("M570,200 L620,200", "#a78bfa", 10);
  b += NXI_A(180, 60, 90, C.hot) + NXI_A(40, 200, 0, C.cold) + NXI_A(600, 200, 0, "#a78bfa");
  b += NXI_L(600, 100, 300, 140, "צרור צינורות (צד קר)", { a: "start", s: 12 });
  b += NXI_L(60, 330, 240, 270, "מחיצות מכוונות זרימה", { a: "end", s: 12 });
  b += NXI_L(60, 90, 95, 140, "ראש מפזר", { a: "end", s: 12 });
  b += NXI_T(260, 60, "צד חם – במעטפת", { s: 12 });
  b += NXI_EQ(170, 385, "Q = ε·C_min·(T_h,in − T_c,in)");
  return NXI_wrap(b);
};
/* ---------- Condenser / evaporator ---------- */
const NXI_shell = (cond) => {
  const C = NXI_C;
  let b = NXI_R(100, 110, 440, 180, "url(#nxSteel)", { rx: 40, st: "#334155", sw: 2, sh: 1 }) + NXI_R(114, 124, 412, 152, "#16263b", { rx: 30 });
  for (let r = 0; r < 4; r++) for (let k = 0; k < 12; k++) b += NXI_O(150 + k * 31, 150 + r * 26, 7, "url(#nxCopper)");
  if (cond) {
    b += NXI_F("M320,30 L320,112", C.steam, 14) + NXI_A(320, 50, 90, C.steam);
    for (let k = 0; k < 12; k++) b += `<circle class="nxdrop" style="animation-delay:${(k % 5) * 0.3}s" cx="${150 + k * 31}" cy="${170 + (k % 3) * 20}" r="2.6" fill="#93c5fd"/>`;
    b += NXI_R(116, 256, 408, 20, "url(#nxWater)") + NXI_F("M320,290 L320,380", C.cold, 10);
  } else {
    b += NXI_R(116, 200, 408, 76, "url(#nxWater)", { op: 0.6 });
    for (let k = 0; k < 14; k++) b += `<circle class="nxbub" style="animation-delay:${(k % 6) * 0.35}s" cx="${140 + k * 28}" cy="${262}" r="3" fill="#fde68a"/>`;
    b += NXI_F("M320,380 L320,290", C.refL, 10) + NXI_F("M320,112 L320,30", C.ref, 12);
  }
  b += NXI_F("M20,200 L102,200", cond ? C.cold : C.hot, 9) + NXI_F("M538,200 L620,200", cond ? C.hot : C.cold, 9) + NXI_A(50, 200, 0, cond ? C.cold : C.hot) + NXI_A(600, 200, 0, cond ? C.hot : C.cold);
  b += NXI_T(320, 360, "", {});
  b += NXI_L(600, 80, 460, 150, cond ? "צינורות מי קירור" : "צינורות נוזל מקור החום", { a: "start", s: 12 });
  b += cond
    ? NXI_L(60, 80, 320, 60, "אדים נכנסים", { a: "end", s: 12 }) + NXI_L(60, 250, 200, 266, "נוזל מעובה (בור חם)", { a: "end", s: 12 })
    : NXI_L(60, 80, 320, 60, "אדים יוצאים (חימום יתר)", { a: "end", s: 12 }) + NXI_L(60, 250, 200, 262, "קרר רותח", { a: "end", s: 12 });
  b += NXI_EQ(140, 385, cond ? "Q = ṁ·(h_in − h_out)   T = T_sat(P)" : "Q = ṁ·(h_out − h_in)   T = T_sat(P)");
  return NXI_wrap(b);
};
NXI_DRAW.condenser = () => NXI_shell(!0);
NXI_DRAW.evaporator = () => NXI_shell(!1);
/* ---------- Expansion valve (TXV) ---------- */
NXI_DRAW.expansion_valve = () => {
  const C = NXI_C;
  let b = NXI_F("M20,270 L280,270", C.ref, 12) + NXI_F("M360,270 L620,270", C.refL, 12);
  b += NXI_R(250, 220, 140, 110, "url(#nxBrass)", { rx: 10, st: "#7c5d1c", sw: 2, sh: 1 }) + NXI_R(262, 240, 116, 60, "#2b220f", { rx: 6, op: 0.6 });
  b += NXI_P("M310,300 l10,-36 l10,36z", "url(#nxSteel)") + NXI_R(316, 140, 8, 128, "url(#nxSteelH)");
  b += NXI_P("M250,140 h140 a70,40 0 0 0 -140,0z", "url(#nxSteel)", { st: "#334155", sh: 1 }) + NXI_P("M258,134 q62,-28 124,0", "none", { st: "#f59e0b", sw: 3 });
  b += `<path d="M390,110 C470,80 520,120 540,190" stroke="#b4693a" stroke-width="3" fill="none"/>` + NXI_R(528, 190, 26, 60, "url(#nxCopper)", { rx: 10 });
  for (let k = 0; k < 8; k++) b += NXI_O(380 + k * 28, 262 + (k % 2) * 14, 3, "#fff7cc", { op: 0.7 });
  b += NXI_L(60, 120, 260, 130, "ראש ממברנה", { a: "end", s: 12 });
  b += NXI_L(600, 330, 540, 240, "בולב חישה על יציאת המאייד", { a: "start", s: 12 });
  b += NXI_L(60, 340, 320, 290, "מחט וחריר", { a: "end", s: 12 });
  b += NXI_T(140, 250, "נוזל בלחץ גבוה", { s: 11.5 }) + NXI_T(500, 300, "תערובת דו־פאזית קרה", { s: 11.5 });
  b += NXI_EQ(150, 385, "h_out = h_in   ṁ = C_d·A·√(2ρΔP)");
  return NXI_wrap(b);
};
/* ---------- Compressors ---------- */
NXI_DRAW.compressor_centrifugal = () => {
  const C = NXI_C;
  let b = NXI_P("M320,330 C190,330 150,220 190,150 C230,80 330,60 400,90 L400,50 L450,50 L450,130 C490,180 480,280 420,310Z", "url(#nxSteel)", { st: "#334155", sw: 2, sh: 1 });
  b += NXI_O(320, 205, 82, "#16263b") + NXI_O(320, 205, 62, "#0f2547");
  b += `<g class="nxspin">${[0, 40, 80, 120, 160, 200, 240, 280, 320].map((a) => `<path d="M320,205 C335,190 350,175 372,160" stroke="#cbd5e1" stroke-width="5" fill="none" stroke-linecap="round" transform="rotate(${a} 320 205)"/>`).join("")}</g>`;
  b += NXI_O(320, 205, 14, C.ref) + NXI_F("M425,170 C432,130 430,90 425,30", C.ref, 12) + NXI_A(425, 40, -90, C.ref);
  b += NXI_L(60, 70, 270, 160, "אימפלר", { a: "end", s: 12 }) + NXI_L(60, 300, 255, 270, "מפזר (דיפיוזר)", { a: "end", s: 12 }) + NXI_L(60, 205, 316, 205, "יניקת אדים", { a: "end", s: 12 }) + NXI_L(600, 40, 440, 40, "סניקה בלחץ גבוה", { a: "start", s: 12 });
  b += NXI_EQ(160, 375, "Δh_s ∝ N²·(1 − (V̇/V̇max)²)   W = ṁ·Δh_s/η_s");
  return NXI_wrap(b);
};
NXI_DRAW.compressor_recip = () => {
  const C = NXI_C;
  let b = NXI_R(240, 70, 160, 180, "url(#nxSteel)", { rx: 6, st: "#334155", sw: 2, sh: 1 }) + NXI_R(260, 90, 120, 150, "#16263b");
  b += NXI_R(262, 160, 116, 50, "url(#nxSteelH)", { rx: 4 }) + NXI_R(262, 92, 116, 66, C.ref, { op: 0.3 });
  b += NXI_P("M320,185 L360,300", "none", { st: "#94a3b8", sw: 12, lj: 1 }) + NXI_O(320, 300, 50, "url(#nxDark)", { st: "#64748b", sw: 2 }) + NXI_O(360, 300, 9, "url(#nxBrass)");
  b += NXI_R(230, 50, 180, 22, "url(#nxSteel)") + NXI_R(268, 72, 28, 8, "#f59e0b") + NXI_R(344, 72, 28, 8, "#f59e0b");
  b += NXI_F("M120,40 L282,40 L282,70", C.refL, 10) + NXI_F("M358,70 L358,40 L520,40", C.ref, 10) + NXI_A(150, 40, 0, C.refL) + NXI_A(500, 40, 0, C.ref);
  b += NXI_L(60, 160, 262, 185, "בוכנה", { a: "end", s: 12 }) + NXI_L(60, 300, 290, 300, "גל ארכובה", { a: "end", s: 12 }) + NXI_L(600, 100, 372, 76, "שסתומי יניקה וסניקה", { a: "start", s: 12 }) + NXI_L(600, 230, 342, 240, "טלטל", { a: "start", s: 12 });
  b += NXI_EQ(150, 380, "ṁ = ρ₁·V_d·N·η_v   W = ṁ·(h₂ − h₁)");
  return NXI_wrap(b);
};
NXI_DRAW.air_compressor = () => {
  const C = NXI_C;
  let b = NXI_R(90, 220, 460, 110, "url(#nxRed)", { rx: 55, st: "#7f1d1d", sw: 2, sh: 1 });
  b += NXI_R(170, 110, 120, 110, "url(#nxSteel)", { rx: 8, sh: 1 });
  for (let k = 0; k < 6; k++) b += NXI_R(160, 116 + k * 15, 140, 5, "url(#nxDark)");
  b += NXI_R(350, 140, 140, 80, "url(#nxBlue)", { rx: 10, sh: 1 }) + NXI_P("M290,150 L350,170 L350,200 L290,210z", "#facc15", { op: 0.8 });
  b += NXI_F("M230,108 L230,60 L80,60", C.air, 9) + NXI_A(110, 60, 180, C.air);
  b += NXI_O(520, 200, 22, "#f8fafc", { st: "#64748b", sw: 3 }) + `<path d="M520,200 l10,-10" stroke="#dc2626" stroke-width="2.5"/>`;
  b += NXI_L(600, 280, 450, 280, "מיכל אוויר דחוס", { a: "start", s: 12 }) + NXI_L(60, 160, 170, 160, "ראש דחיסה מצולע", { a: "end", s: 12 }) + NXI_L(600, 120, 430, 150, "מנוע", { a: "start", s: 12 }) + NXI_L(60, 30, 150, 60, "יניקת אוויר", { a: "end", s: 12 });
  b += NXI_EQ(160, 375, "W = ṁ·cp·T₁·[(P₂/P₁)^((k−1)/k) − 1]/η_s");
  return NXI_wrap(b);
};
/* ---------- Turbines & boiler ---------- */
const NXI_turb = (gas) => {
  const C = NXI_C;
  let b = "";
  if (gas) {
    b += NXI_P("M60,140 L230,170 L230,240 L60,270z", "url(#nxSteel)", { st: "#334155", sh: 1 }) + NXI_R(230, 150, 90, 110, "url(#nxDark)", { rx: 12 }) + NXI_O(275, 205, 30, "url(#nxFlame)");
    b += NXI_P("M320,170 L480,120 L480,290 L320,240z", "url(#nxSteel)", { st: "#334155", sh: 1 });
    b += NXI_F("M20,205 L60,205", C.air, 10) + NXI_F("M480,205 L620,205", "#fb923c", 12);
    b += NXI_L(60, 100, 140, 150, "מדחס", { a: "end", s: 12 }) + NXI_L(300, 60, 275, 180, "תא בעירה", { s: 12 }) + NXI_L(600, 100, 420, 140, "טורבינה", { a: "start", s: 12 });
  } else {
    b += NXI_P("M80,160 L440,100 L440,310 L80,250z", "url(#nxSteel)", { st: "#334155", sw: 2, sh: 1 });
    for (let k = 0; k < 7; k++) {
      const xx = 110 + k * 46,
        h = 34 + k * 14;
      b += NXI_R(xx, 205 - h, 10, 2 * h, k % 2 ? "url(#nxBrass)" : "url(#nxSteelH)", { rx: 3 });
    }
    b += NXI_F("M20,205 L90,205", C.steam, 12) + NXI_F("M440,205 L470,205 L470,380", "#cbd5e1", 14, { op: 0.7 });
    b += NXI_L(60, 100, 160, 180, "להבי סטטור ורוטור", { a: "end", s: 12 }) + NXI_L(600, 360, 470, 340, "אדים למעבה", { a: "start", s: 12 }) + NXI_T(50, 190, "קיטור", { s: 11.5 });
  }
  b += NXI_R(70, 200, 440, 10, "url(#nxSteelH)") + NXI_R(510, 160, 100, 90, "url(#nxGreen)", { rx: 10, sh: 1 }) + NXI_T(560, 152, "גנרטור", { s: 12 });
  b += NXI_EQ(140, 385, "W = ṁ·(h₁ − h₂)   η_s = (h₁ − h₂)/(h₁ − h₂ₛ)");
  return NXI_wrap(b);
};
NXI_DRAW.steam_turbine = () => NXI_turb(!1);
NXI_DRAW.gas_turbine = () => NXI_turb(!0);
NXI_DRAW.boiler = () => {
  const C = NXI_C;
  let b = NXI_R(140, 150, 300, 200, "#7c2d12", { rx: 10, st: "#431407", sw: 2, sh: 1 }) + NXI_R(160, 170, 260, 160, "#1c0d06", { rx: 6 });
  b += NXI_P("M220,330 C200,280 240,250 230,210 C270,240 260,280 300,240 C300,280 340,260 330,215 C370,260 360,300 360,330z", "url(#nxFlame)");
  for (let k = 0; k < 7; k++) b += NXI_R(170 + k * 36, 170, 10, 160, "url(#nxSteelH)", { op: 0.9 });
  b += NXI_R(150, 90, 280, 60, "url(#nxSteel)", { rx: 30, st: "#334155", sh: 1 }) + NXI_R(164, 120, 252, 24, "url(#nxWater)", { rx: 10 });
  b += NXI_R(460, 60, 40, 290, "url(#nxGalv)", { rx: 6 });
  b += NXI_F("M290,90 L290,30 L620,30", C.steam, 11) + NXI_F("M20,300 L140,300", C.cold, 10);
  b += NXI_L(60, 120, 160, 120, "תוף קיטור", { a: "end", s: 12 }) + NXI_L(600, 200, 500, 200, "ארובה", { a: "start", s: 12 }) + NXI_L(60, 220, 230, 280, "מוקד בעירה", { a: "end", s: 12 }) + NXI_T(540, 18, "קיטור לצרכן", { s: 11.5 }) + NXI_T(70, 286, "מי הזנה", { s: 11.5 });
  b += NXI_EQ(160, 385, "Q = ṁ·(h_out − h_in) = η_b·ṁ_fuel·LHV");
  return NXI_wrap(b);
};
/* ---------- Air-side: dry cooler, CRAH, buffer tank ---------- */
NXI_DRAW.dry_cooler = () => {
  const C = NXI_C;
  let b = NXI_R(90, 90, 460, 40, "url(#nxGalv)", { rx: 8, sh: 1 });
  for (let k = 0; k < 3; k++) {
    const cx = 170 + k * 150;
    b += NXI_O(cx, 110, 18, "#334155") + `<path d="M${cx},88 q0,-30 -6,-50" stroke="#fca5a5" stroke-width="3" fill="none" marker-end="url(#nxArr)"/>`;
  }
  b += NXI_P("M110,130 L300,330 L320,330 L130,130z", "url(#nxFins)", { op: 0.95 }) + NXI_P("M530,130 L340,330 L320,330 L510,130z", "url(#nxFins)", { op: 0.95 });
  b += NXI_F("M120,140 L305,325", "url(#nxHotCold)", 6, { op: 0.8 }) + NXI_F("M520,140 L335,325", "url(#nxHotCold)", 6, { op: 0.8 });
  for (let k = 0; k < 3; k++) b += `<path d="M30,${220 + k * 40} H190" stroke="#e2e8f0" stroke-width="3" marker-end="url(#nxArr)" opacity=".7"/><path d="M610,${220 + k * 40} H450" stroke="#e2e8f0" stroke-width="3" marker-end="url(#nxArr)" opacity=".7"/>`;
  b += NXI_L(600, 70, 470, 110, "מאווררים צירים", { a: "start", s: 12 }) + NXI_L(60, 160, 170, 190, "סוללת צלעות V", { a: "end", s: 12 });
  b += NXI_EQ(170, 385, "Q = ε·C_min·(T_in − T_air)");
  return NXI_wrap(b);
};
NXI_DRAW.crah = () => {
  const C = NXI_C;
  let b = NXI_R(220, 50, 200, 300, "url(#nxCab)", { rx: 8, st: "#475569", sw: 2, sh: 1 });
  b += NXI_R(240, 70, 160, 40, "url(#nxFins)", { op: 0.5 });
  b += NXI_P("M240,140 L400,200 L400,230 L240,170z", "url(#nxFins)");
  b += NXI_F("M430,180 L405,180", C.cold, 8) + NXI_F("M405,220 L430,220", C.hot, 8);
  for (let k = 0; k < 2; k++) b += NXI_O(280 + k * 80, 290, 26, "#334155", { st: "#94a3b8" });
  b += NXI_R(60, 350, 520, 20, "url(#nxHatch)");
  b += `<path d="M120,60 C180,40 230,60 250,80" stroke="#fca5a5" stroke-width="4" fill="none" marker-end="url(#nxArr)"/><path d="M320,345 L320,372 L520,372 L540,330" stroke="#93c5fd" stroke-width="4" fill="none" marker-end="url(#nxArr)"/>`;
  b += NXI_L(600, 160, 400, 190, "סוללת מים קרים", { a: "start", s: 12 }) + NXI_L(60, 290, 260, 290, "מאווררי EC", { a: "end", s: 12 }) + NXI_T(110, 40, "אוויר חם מהחדר", { s: 12 }) + NXI_T(470, 395, "אוויר קר מתחת לרצפה", { s: 11.5 });
  b += NXI_EQ(440, 120, "Q = ṁ_a·cp·ΔT");
  return NXI_wrap(b);
};
NXI_DRAW.buffer_tank = () => {
  const C = NXI_C;
  let b = NXI_R(220, 50, 200, 310, "url(#nxInsul)", { rx: 40, sh: 1 }) + NXI_R(236, 64, 168, 282, "url(#nxHotCold)", { rx: 30, op: 0.75 });
  for (let k = 0; k < 6; k++) b += `<path d="M240,${90 + k * 45} h160" stroke="#0f172a" stroke-width="1" opacity=".35" stroke-dasharray="4 6"/>`;
  b += NXI_F("M20,90 L240,90", C.hot, 10) + NXI_F("M400,320 L620,320", C.cold, 10) + NXI_A(60, 90, 0, C.hot) + NXI_A(590, 320, 0, C.cold);
  b += NXI_L(600, 120, 410, 130, "שכבה חמה למעלה", { a: "start", s: 12 }) + NXI_L(60, 300, 240, 300, "שכבה קרה למטה", { a: "end", s: 12 }) + NXI_L(600, 230, 418, 230, "בידוד", { a: "start", s: 12 });
  b += NXI_EQ(140, 385, "M·cp·dT/dt = ṁ·cp·(T_in − T) − UA·(T − T_amb)");
  return NXI_wrap(b);
};
NXI_DRAW.ups = () => {
  const C = NXI_C,
    ac = "#facc15",
    dc = "#a78bfa";
  let b = "";
  // blocks: grid -> rectifier -> DC bus -> inverter -> output distribution A/B ; battery on DC bus ; static bypass
  b += NXI_R(18, 150, 70, 70, "url(#nxCab)", { rx: 8, st: "#475569", sh: 1 }) + NXI_T(53, 182, "רשת", { s: 12, b: 1 }) + NXI_T(53, 200, "400 V", { s: 11, ltr: 1, c: C.sub });
  b += NXI_R(130, 140, 100, 90, "url(#nxCab)", { rx: 10, st: "#64748b", sh: 1 }) + NXI_P("M150,200 L210,170", "none", { st: ac, sw: 2 }) + NXI_T(180, 222, "מיישר", { s: 12, b: 1 });
  b += NXI_R(340, 140, 100, 90, "url(#nxCab)", { rx: 10, st: "#64748b", sh: 1 }) + NXI_P("M355,190 q15,-25 30,0 t30,0", "none", { st: ac, sw: 2 }) + NXI_T(390, 222, "מהפך", { s: 12, b: 1 });
  b += NXI_R(250, 280, 70, 95, "url(#nxDark)", { rx: 6, st: "#334155", sh: 1 });
  for (let k = 0; k < 4; k++) b += NXI_R(260, 290 + k * 21, 50, 15, "url(#nxGreen)", { rx: 3, op: 0.9 });
  b += NXI_R(500, 120, 120, 130, "url(#nxCab)", { rx: 10, st: "#64748b", sh: 1 }) + NXI_R(515, 150, 40, 70, "url(#nxRed)", { rx: 4 }) + NXI_R(565, 150, 40, 70, "url(#nxBlue)", { rx: 4 });
  b += NXI_T(535, 192, "A", { s: 16, b: 1, ltr: 1 }) + NXI_T(585, 192, "B", { s: 16, b: 1, ltr: 1 });
  // flows
  b += NXI_F("M88,185 L130,185", ac, 7) + NXI_F("M230,185 L340,185", dc, 7) + NXI_F("M285,185 L285,280", dc, 5, { slow: 1 }) + NXI_F("M440,185 L500,185", ac, 7);
  b += NXI_F("M53,150 L53,92 L560,92 L560,120", "#94a3b8", 4, { op: 0.55, slow: 1 });
  b += NXI_F("M535,250 L535,330 L470,330", C.hot, 5) + NXI_F("M585,250 L585,355 L470,355", C.cold, 5);
  // labels
  b += NXI_L(300, 72, 300, 92, "מעקף סטטי (בתקלה או בתחזוקה)", { s: 12 });
  b += NXI_L(150, 270, 270, 185, "פס DC", { a: "end", s: 12 });
  b += NXI_L(150, 330, 250, 330, "סוללות ליתיום", { a: "end", s: 12 });
  b += NXI_L(455, 300, 535, 300, "פס צבירה A לארונות", { a: "end", s: 11 });
  b += NXI_L(455, 380, 585, 355, "פס צבירה B לארונות", { a: "end", s: 11 });
  b += NXI_L(560, 40, 560, 120, "לוח יציאה: ארונות, CDU, CRAH", { s: 12 });
  b += NXI_EQ(330, 268, "P_in = P_out / η");
  return NXI_wrap(b);
};
