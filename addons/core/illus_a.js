const NXI_DRAW = {};
/* ---------- Cold plate (die-level cross-section) ---------- */
NXI_DRAW.cold_plate = () => {
  const C = NXI_C;
  let b = "";
  b += NXI_R(70, 300, 500, 26, "url(#nxGreen)", { rx: 3, sh: 1 }); // substrate / PCB
  for (let k = 0; k < 14; k++) b += NXI_R(82 + k * 35, 326, 10, 7, "url(#nxBrass)");
  b += NXI_R(170, 276, 300, 24, "#1f2937", { rx: 2 }); // die package
  b += NXI_R(200, 262, 240, 16, "url(#nxGlow)"); // hot die
  b += NXI_R(200, 266, 240, 12, "#7f1d1d", { op: 0.9 });
  b += NXI_R(196, 254, 248, 8, "#cbd5e1", { op: 0.95 }); // TIM
  b += NXI_R(130, 186, 380, 68, "url(#nxCopper)", { rx: 6, st: "#5b2d12", sw: 1.5, sh: 1 }); // base
  for (let k = 0; k < 26; k++) b += NXI_R(150 + k * 13.6, 196, 7, 48, "#e8a06c", { op: 0.95 });
  b += NXI_R(150, 200, 350, 40, "url(#nxColdHot)", { op: 0.28 });
  b += NXI_R(122, 160, 396, 28, "url(#nxSteel)", { rx: 6, st: "#334155", sw: 1.2 }); // cover
  b += NXI_FL(150, 108, 30, 54) + NXI_FL(460, 108, 30, 54);
  b += NXI_F("M165,70 L165,150", C.cold, 12) + NXI_F("M475,150 L475,70", C.hot, 12);
  b += NXI_F("M178,222 L462,222", "url(#nxColdHot)", 8, { op: 0.8 });
  b += NXI_A(165, 78, 90, C.cold) + NXI_A(475, 74, -90, C.hot);
  for (let k = 0; k < 7; k++) {
    const xx = 225 + k * 32;
    b += `<path d="M${xx},262 C${xx - 5},250 ${xx + 5},240 ${xx},228" stroke="#fb923c" stroke-width="2.4" fill="none" marker-end="url(#nxArr)" opacity=".9"/>`;
  }
  b += NXI_L(78, 120, 165, 92, "נוזל קר נכנס", { a: "end", s: 12.5 });
  b += NXI_L(560, 120, 475, 92, "נוזל חם יוצא", { a: "start", s: 12.5 });
  b += NXI_L(600, 178, 515, 172, "מכסה אטום", { a: "start", s: 12 });
  b += NXI_L(600, 220, 502, 220, "מיקרו־תעלות נחושת", { a: "start", s: 12 });
  b += NXI_L(600, 262, 446, 258, "משחה תרמית TIM", { a: "start", s: 12 });
  b += NXI_L(600, 292, 440, 272, "שבב GPU / CPU", { a: "start", s: 12 });
  b += NXI_L(40, 250, 130, 230, "בסיס נחושת", { a: "end", s: 12 });
  b += NXI_L(40, 318, 72, 312, "מצע", { a: "end", s: 12 });
  b += NXI_EQ(196, 372, "T_die = T_out + P_die·R_plate") + NXI_EQ(26, 40, "Q = ṁ·cp·(T_out − T_in)");
  b += NXI_T(470, 38, "פלטת קירור ישירה לשבב", { b: 1, s: 16 });
  return NXI_wrap(b);
};
/* ---------- AI rack (D2C) ---------- */
NXI_DRAW.rack = () => {
  const C = NXI_C;
  let b = NXI_R(150, 40, 300, 330, "url(#nxCab)", { rx: 8, st: "#475569", sw: 2, sh: 1 });
  for (let k = 0; k < 9; k++) {
    const y = 62 + k * 33;
    b += NXI_R(170, y, 230, 26, "#111827", { rx: 3, st: "#334155", sw: 1 });
    b += NXI_R(250, y + 6, 46, 14, "url(#nxCopper)", { rx: 2 }) + NXI_R(310, y + 6, 46, 14, "url(#nxCopper)", { rx: 2 });
    b += NXI_O(182, y + 13, 2.6, k % 3 ? "#22c55e" : "#38bdf8");
    b += `<path d="M408,${y + 9}H362M362,${y + 9}" stroke="${C.cold}" stroke-width="3"/><path d="M296,${y + 17}H250" stroke="${C.cold}" stroke-width="2.5" opacity=".7"/><path d="M362,${y + 17}H418" stroke="${C.hot}" stroke-width="3"/>`;
  }
  b += NXI_R(404, 50, 14, 310, "url(#nxBlue)", { rx: 6 }) + NXI_R(424, 50, 14, 310, "url(#nxRed)", { rx: 6 });
  b += NXI_F("M411,20 L411,52", C.cold, 10) + NXI_F("M431,52 L431,20", C.hot, 10);
  b += NXI_A(411, 34, 90, C.cold) + NXI_A(431, 28, -90, C.hot);
  for (let k = 0; k < 4; k++) b += `<path d="M460,${110 + k * 60} q30,-10 60,0" stroke="#fca5a5" stroke-width="3" fill="none" marker-end="url(#nxArr)" opacity=".75"/>`;
  b += NXI_L(560, 70, 418, 120, "סעפת אספקה (קר)", { a: "start", s: 12 });
  b += NXI_L(560, 100, 438, 170, "סעפת חזרה (חם)", { a: "start", s: 12 });
  b += NXI_L(560, 260, 520, 230, "חום שנותר לאוויר", { a: "start", s: 12 });
  b += NXI_L(80, 90, 273, 75, "פלטות קירור על השבבים", { a: "end", s: 12 });
  b += NXI_L(80, 160, 200, 140, "מגש מחשוב", { a: "end", s: 12 });
  b += NXI_L(80, 230, 300, 245, "מחברים מהירים", { a: "end", s: 12 });
  b += NXI_EQ(20, 330, "Q_liquid = f_D2C · P_rack") + NXI_EQ(20, 362, "Q_air = (1 − f_D2C) · P_rack");
  b += NXI_T(560, 380, "ארון GPU בקירור ישיר לשבב", { b: 1, s: 14 });
  return NXI_wrap(b);
};
/* ---------- CDU ---------- */
NXI_DRAW.cdu = () => {
  const C = NXI_C;
  let b = NXI_R(110, 34, 420, 336, "url(#nxCab)", { rx: 10, st: "#475569", sw: 2, sh: 1 });
  b += NXI_R(130, 60, 120, 190, "url(#nxSteelH)", { rx: 6, st: "#334155" }); // plate HX
  for (let k = 0; k < 18; k++) b += NXI_R(138 + k * 6, 70, 3, 170, k % 2 ? "#f87171" : "#38bdf8", { op: 0.75 });
  b += NXI_R(300, 210, 110, 110, "url(#nxBlue)", { rx: 55, st: "#1e3a8a" }); // pump volute
  b += NXI_O(355, 265, 28, "url(#nxSteel)");
  b += `<g class="nxspin">${[0, 60, 120, 180, 240, 300].map((a) => `<path d="M355,265 q14,-6 22,-22" stroke="#334155" stroke-width="4" fill="none" transform="rotate(${a} 355 265)"/>`).join("")}</g>`;
  b += NXI_R(300, 70, 90, 110, "url(#nxSteel)", { rx: 18, st: "#334155" }); // reservoir
  b += NXI_R(306, 120, 78, 54, "url(#nxWater)", { rx: 12 });
  b += NXI_R(430, 70, 80, 60, "#0b2a1e", { rx: 6, st: "#22c55e", sw: 1 }) + NXI_T(470, 98, "25.0°C", { s: 13, c: "#4ade80", ltr: 1 });
  b += NXI_R(440, 230, 50, 90, "url(#nxSteel)", { rx: 10, st: "#334155" });
  b += NXI_F("M160,20 L160,62", C.hot, 10) + NXI_F("M160,250 L160,300 L300,265", C.pg, 9);
  b += NXI_F("M410,265 L465,265 L465,232", C.pg, 9) + NXI_F("M465,230 L465,20", C.pg, 9);
  b += NXI_F("M230,20 L230,62", C.cold, 10) + NXI_F("M215,250 L215,390", C.coldD, 10);
  b += NXI_F("M140,250 L140,276", C.hot, 8, { op: 0.6 });
  b += NXI_A(160, 30, 90, C.hot) + NXI_A(465, 28, -90, C.pg) + NXI_A(230, 30, 90, C.cold) + NXI_A(215, 380, 90, C.coldD);
  b += NXI_L(40, 40, 160, 26, "חזרה חמה מהארונות", { a: "end", s: 12 });
  b += NXI_L(600, 40, 465, 24, "אספקה לארונות", { a: "start", s: 12 });
  b += NXI_L(40, 140, 130, 150, "מחליף חום לוחות", { a: "end", s: 12 });
  b += NXI_L(600, 160, 390, 140, "מאגר + מיכל התפשטות", { a: "start", s: 12 });
  b += NXI_L(600, 290, 410, 280, "משאבה משנית", { a: "start", s: 12 });
  b += NXI_L(600, 250, 490, 270, "מסנן", { a: "start", s: 12 });
  b += NXI_L(40, 330, 215, 330, "מי מתקן (ראשוני)", { a: "end", s: 12 });
  b += NXI_L(40, 210, 230, 40, "מי מתקן קרים נכנסים", { a: "end", s: 12 });
  b += NXI_EQ(250, 362, "Q = ε·C_min·(T_hot,in − T_cold,in)");
  return NXI_wrap(b);
};
/* ---------- Centrifugal pump ---------- */
NXI_DRAW.pump = () => {
  const C = NXI_C;
  let b = "";
  b += NXI_P("M250,330 C150,330 120,230 150,170 C180,100 270,80 330,100 L330,60 L380,60 L380,140 C420,180 420,260 380,300 C350,325 300,330 250,330Z", "url(#nxBlue)", { st: "#1e3a8a", sw: 2, sh: 1 });
  b += NXI_O(270, 215, 92, "#0f2547", { st: "#1e40af", sw: 2 });
  b += `<g class="nxspin">${NXI_O(270, 215, 78, "url(#nxSteel)") + [0, 51, 103, 154, 206, 257, 309].map((a) => `<path d="M270,215 C285,200 312,170 330,150" stroke="#334155" stroke-width="7" fill="none" stroke-linecap="round" transform="rotate(${a} 270 215)"/>`).join("") + NXI_O(270, 215, 24, "#1e293b", { st: "#94a3b8" })}</g>`;
  b += NXI_O(270, 215, 10, "#38bdf8", { op: 0.9 });
  b += NXI_FL(322, 48, 66, 14);
  b += NXI_F("M355,175 C360,140 356,110 355,30", C.cold, 13) + NXI_A(355, 40, -90, C.cold);
  b += `<path d="M270,215 m-120,0 a120,120 0 0 1 60,-104" stroke="#7dd3fc" stroke-width="2.5" fill="none" marker-end="url(#nxArr)" stroke-dasharray="6 5"/>`;
  b += NXI_R(450, 160, 140, 110, "url(#nxBlue)", { rx: 10, st: "#1e3a8a", sh: 1 });
  for (let k = 0; k < 8; k++) b += NXI_R(456, 168 + k * 12, 128, 5, "#1e3a8a", { op: 0.7 });
  b += NXI_R(410, 205, 42, 20, "url(#nxSteel)");
  b += NXI_O(270, 215, 4, "#fff");
  b += NXI_L(80, 60, 230, 140, "אימפלר (מסתובב)", { a: "end", s: 12.5 });
  b += NXI_L(80, 300, 180, 290, "ספירלה (וולוטה)", { a: "end", s: 12.5 });
  b += NXI_L(80, 215, 260, 215, "יניקה – עין האימפלר", { a: "end", s: 12.5 });
  b += NXI_L(560, 40, 365, 40, "סניקה", { a: "start", s: 12.5 });
  b += NXI_L(560, 300, 520, 270, "מנוע חשמלי", { a: "start", s: 12.5 });
  b += NXI_EQ(360, 340, "H ∝ N²   ·   V̇ ∝ N   ·   P ∝ N³") + NXI_EQ(360, 372, "W_shaft = V̇·ΔP / η");
  return NXI_wrap(b);
};
/* ---------- Plate heat exchanger ---------- */
NXI_DRAW.plate_hx = () => {
  const C = NXI_C;
  let b = NXI_R(110, 60, 40, 280, "url(#nxBlue)", { rx: 4, sh: 1 }) + NXI_R(490, 60, 40, 280, "url(#nxBlue)", { rx: 4, sh: 1 });
  b += NXI_R(120, 52, 400, 10, "url(#nxSteel)", { rx: 4 }) + NXI_R(120, 338, 400, 10, "url(#nxSteel)", { rx: 4 });
  for (let k = 0; k < 16; k++) {
    const xx = 165 + k * 20;
    b += NXI_P(`M${xx},80 l12,-6 0,264 -12,6z`, "url(#nxSteelH)", { st: "#475569", sw: 0.8 });
    b += NXI_R(xx + 2, 90, 9, 250, k % 2 ? C.hot : C.cold, { op: 0.45 });
  }
  b += NXI_F("M60,110 L470,110", C.hot, 9) + NXI_F("M470,300 L60,300", C.hot, 6, { op: 0.6 });
  b += NXI_F("M580,300 L170,300", C.cold, 9) + NXI_F("M170,110 L580,110", C.cold, 6, { op: 0.6 });
  b += NXI_A(80, 110, 0, C.hot) + NXI_A(560, 300, 180, C.cold);
  for (let k = 0; k < 4; k++) b += `<path d="M${190 + k * 80},120 V285" stroke="#fca5a5" stroke-width="2" marker-end="url(#nxArr)" opacity=".7"/><path d="M${210 + k * 80},290 V125" stroke="#7dd3fc" stroke-width="2" marker-end="url(#nxArr)" opacity=".7"/>`;
  b += NXI_L(60, 160, 130, 170, "לוח קבוע", { a: "end", s: 12 });
  b += NXI_L(600, 160, 510, 170, "לוח לחיצה", { a: "start", s: 12 });
  b += NXI_L(320, 30, 300, 80, "לוחות גליים עם אטמים", { s: 12 });
  b += NXI_T(90, 96, "חם נכנס", { s: 11.5 }) + NXI_T(560, 96, "קר יוצא", { s: 11.5 }) + NXI_T(560, 326, "קר נכנס", { s: 11.5 }) + NXI_T(90, 326, "חם יוצא", { s: 11.5 });
  b += NXI_EQ(170, 378, "ε = f(NTU, C_r)   NTU = UA / C_min");
  return NXI_wrap(b);
};
/* ---------- Hybrid closed-circuit cooling tower ---------- */
NXI_DRAW.hybrid_tower = () => {
  const C = NXI_C;
  let b = NXI_R(110, 70, 420, 290, "url(#nxGalv)", { rx: 6, st: "#475569", sw: 2, sh: 1 });
  b += NXI_R(122, 84, 396, 264, "#122033", { rx: 4 });
  for (let k = 0; k < 2; k++) {
    const cx = 230 + k * 180;
    b += NXI_R(cx - 70, 36, 140, 36, "url(#nxGalv)", { rx: 8, st: "#475569" });
    b += NXI_FAN(cx, 50, 58);
    b += `<path d="M${cx - 20},30 q0,-20 -8,-26 M${cx + 20},30 q0,-20 8,-26" stroke="#e2e8f0" stroke-width="3" fill="none" marker-end="url(#nxArr)" opacity=".7"/>`;
  }
  b += NXI_R(140, 96, 360, 16, "url(#nxFins)", { op: 0.95 });
  b += NXI_T(320, 124, "סוללה יבשה מצולעת", { s: 11 });
  b += NXI_R(140, 136, 360, 8, "#94a3b8");
  for (let k = 0; k < 9; k++) b += NXI_P(`M${160 + k * 40},144 l-8,14 h16z`, "#7dd3fc", { op: 0.8 });
  for (let r = 0; r < 5; r++)
    for (let k = 0; k < 11; k++) b += NXI_O(165 + k * 31 + (r % 2) * 15, 186 + r * 26, 9, "url(#nxCopper)", { st: "#7a3f1d", sw: 1 });
  b += NXI_R(150, 170, 340, 136, "url(#nxHotCold)", { op: 0.25, rx: 6 });
  for (let k = 0; k < 14; k++) b += `<circle class="nxdrop" style="animation-delay:${(k % 5) * 0.3}s" cx="${170 + k * 24}" cy="${168 + (k % 3) * 40}" r="2.6" fill="#bae6fd"/>`;
  b += NXI_R(122, 312, 396, 36, "url(#nxWater)", { rx: 4 });
  b += NXI_F("M560,190 L505,190", C.hot, 10) + NXI_F("M505,290 L560,290", C.cold, 10);
  b += NXI_A(548, 190, 180, C.hot) + NXI_A(552, 290, 0, C.cold);
  b += NXI_F("M140,330 L90,330 L90,140 L140,140", "#7dd3fc", 6, { slow: 1 });
  b += NXI_R(70, 300, 40, 40, "url(#nxBlue)", { rx: 20 });
  for (let k = 0; k < 3; k++) b += `<path d="M30,${180 + k * 40} H112" stroke="#e2e8f0" stroke-width="3" marker-end="url(#nxArr)" opacity=".7"/>`;
  b += NXI_L(600, 160, 505, 190, "מים חמים מה־CDU", { a: "start", s: 12 });
  b += NXI_L(600, 330, 505, 290, "מים מקוררים", { a: "start", s: 12 });
  b += NXI_L(620, 240, 470, 240, "סליל סגור (המים לא נוגעים באוויר)", { a: "start", s: 11.5 });
  b += NXI_L(40, 100, 150, 140, "התזת מים", { a: "end", s: 12 });
  b += NXI_L(40, 290, 80, 310, "משאבת התזה", { a: "end", s: 12 });
  b += NXI_T(54, 168, "אוויר", { s: 11.5, c: C.air });
  b += NXI_T(66, 386, "רטוב", { s: 11.5, a: "end" }) + NXI_EQ(72, 386, "T_out = T_wb + approach") + NXI_T(320, 386, "יבש", { s: 11.5, a: "end" }) + NXI_EQ(326, 386, "T_out = T_db + approach");
  return NXI_wrap(b, "חתך סכמטי");
};
/* ---------- Open induced-draft cooling tower ---------- */
NXI_DRAW.cooling_tower = () => {
  const C = NXI_C;
  let b = NXI_P("M150,350 L180,80 L460,80 L490,350Z", "url(#nxGalv)", { st: "#475569", sw: 2, sh: 1 });
  b += NXI_P("M165,345 L192,90 L448,90 L475,345Z", "#122033");
  b += NXI_R(240, 40, 160, 42, "url(#nxGalv)", { rx: 10, st: "#475569" });
  b += NXI_FAN(320, 58, 66);
  b += NXI_R(200, 100, 240, 18, "url(#nxFins)", { op: 0.8 });
  b += NXI_R(200, 130, 240, 8, "#94a3b8");
  b += NXI_R(205, 160, 230, 110, "url(#nxFill)", { op: 0.95, rx: 4 });
  for (let k = 0; k < 16; k++) b += `<circle class="nxdrop" style="animation-delay:${(k % 6) * 0.25}s" cx="${212 + k * 14}" cy="${146 + (k % 4) * 30}" r="2.4" fill="#93c5fd"/>`;
  b += NXI_R(170, 300, 300, 45, "url(#nxWater)", { rx: 4 });
  for (let k = 0; k < 3; k++) b += `<path d="M120,${290 - k * 26} q40,0 70,-30" stroke="#e2e8f0" stroke-width="3" fill="none" marker-end="url(#nxArr)" opacity=".75"/><path d="M520,${290 - k * 26} q-40,0 -70,-30" stroke="#e2e8f0" stroke-width="3" fill="none" marker-end="url(#nxArr)" opacity=".75"/>`;
  b += `<path d="M300,36 q0,-20 -10,-30 M340,36 q0,-20 10,-30" stroke="#e2e8f0" stroke-width="3" fill="none" marker-end="url(#nxArr)" opacity=".75"/>`;
  b += NXI_F("M590,134 L440,134", C.hot, 10) + NXI_F("M470,330 L590,330", C.cold, 10);
  b += NXI_A(560, 134, 180, C.hot) + NXI_A(578, 330, 0, C.cold);
  b += NXI_L(600, 100, 440, 110, "מפריד טיפות", { a: "start", s: 12 });
  b += NXI_L(600, 200, 435, 210, "מילוי (שטח מגע)", { a: "start", s: 12 });
  b += NXI_L(40, 60, 256, 58, "מאוורר יניקה", { a: "end", s: 12 });
  b += NXI_L(40, 330, 175, 325, "אגן", { a: "end", s: 12 });
  b += NXI_T(90, 240, "אוויר נכנס", { s: 11.5, c: C.air });
  b += NXI_EQ(60, 388, "Q = ε·ṁ·cp·(T_in − T_wb)") + NXI_T(470, 388, "חלק קטן מהמים מתאדה", { s: 12 });
  return NXI_wrap(b);
};
/* ---------- Chiller ---------- */
NXI_DRAW.chiller = () => {
  const C = NXI_C;
  let b = NXI_R(110, 70, 420, 70, "url(#nxSteel)", { rx: 35, st: "#334155", sw: 2, sh: 1 });
  b += NXI_R(110, 250, 420, 70, "url(#nxSteel)", { rx: 35, st: "#334155", sw: 2, sh: 1 });
  for (let k = 0; k < 5; k++) b += NXI_R(140, 82 + k * 10, 360, 4, "#fca5a5", { op: 0.7 }) + NXI_R(140, 262 + k * 10, 360, 4, "#7dd3fc", { op: 0.7 });
  b += NXI_P("M380,165 l70,0 l20,50 l-110,0z", "url(#nxBlue)", { st: "#1e3a8a", sh: 1 });
  b += NXI_R(395, 215, 60, 30, "url(#nxDark)", { rx: 6 });
  b += NXI_F("M425,250 L425,215", C.refL, 8) + NXI_F("M425,165 L425,140", C.ref, 8);
  b += NXI_F("M180,140 L180,190", C.ref, 7) + NXI_F("M180,210 L180,250", C.refL, 7);
  b += NXI_P("M165,190 h30 l-15,20z", "url(#nxBrass)") + NXI_P("M165,210 h30 l-15,-20z", "url(#nxBrass)");
  b += NXI_F("M40,285 L112,285", C.hot, 10) + NXI_F("M530,285 L600,285", C.cold, 10);
  b += NXI_F("M600,105 L530,105", C.cold, 10, { op: 0.8 }) + NXI_F("M112,105 L40,105", C.hot, 10);
  b += NXI_A(90, 285, 0, C.hot) + NXI_A(584, 285, 0, C.cold) + NXI_A(560, 105, 180, C.cold) + NXI_A(56, 105, 180, C.hot);
  b += NXI_T(320, 112, "מעבה – הקרר מתעבה ופולט חום", { s: 12.5 });
  b += NXI_T(320, 292, "מאייד – הקרר מתאדה וקולט חום", { s: 12.5 });
  b += NXI_L(560, 190, 450, 190, "מדחס", { a: "start", s: 12 });
  b += NXI_L(70, 200, 165, 200, "שסתום התפשטות", { a: "end", s: 12 });
  b += NXI_T(76, 272, "מים חוזרים", { s: 11 }) + NXI_T(566, 272, "מים מקוררים", { s: 11 }) + NXI_T(566, 92, "מי מעבה", { s: 11 }) + NXI_T(76, 92, "למגדל", { s: 11 });
  b += NXI_EQ(130, 370, "COP = Q_e / W   ≈ η₂·T_e/(T_c − T_e)    Q_c = Q_e + W");
  return NXI_wrap(b);
};
/* ---------- Expansion tank ---------- */
NXI_DRAW.exp_tank = () => {
  const C = NXI_C;
  let b = NXI_R(230, 50, 180, 280, "url(#nxRed)", { rx: 80, st: "#7f1d1d", sw: 2, sh: 1 });
  b += NXI_R(244, 64, 152, 252, "#1a2333", { rx: 70 });
  b += NXI_P("M246,190 C290,170 350,215 394,190 L394,250 C394,300 360,314 320,314 C280,314 246,300 246,250Z", "url(#nxWater)");
  b += NXI_P("M246,190 C290,170 350,215 394,190", "none", { st: "#0f172a", sw: 5 });
  b += NXI_P("M246,64 h148 v120 C350,210 290,165 246,186Z", "#a5b4fc", { op: 0.18 });
  for (let k = 0; k < 10; k++) b += NXI_O(270 + (k % 5) * 25, 100 + Math.floor(k / 5) * 40, 3, "#c7d2fe", { op: 0.7 });
  b += NXI_FL(300, 330, 40, 22) + NXI_F("M320,350 L320,385 L560,385", C.pg, 9, { slow: 1 });
  b += NXI_R(312, 32, 16, 20, "url(#nxBrass)", { rx: 2 });
  b += NXI_O(470, 120, 34, "#f8fafc", { st: "#64748b", sw: 4 }) + `<path d="M470,120 L488,100" stroke="#dc2626" stroke-width="3"/>` + NXI_R(466, 154, 8, 40, "url(#nxSteel)");
  b += NXI_L(80, 110, 260, 110, "גז (חנקן) בלחץ טעינה", { a: "end", s: 12.5 });
  b += NXI_L(80, 190, 250, 190, "ממברנה", { a: "end", s: 12.5 });
  b += NXI_L(80, 270, 260, 270, "נוזל המערכת", { a: "end", s: 12.5 });
  b += NXI_L(80, 40, 312, 40, "שסתום מילוי גז", { a: "end", s: 12.5 });
  b += NXI_L(600, 80, 500, 110, "מד לחץ", { a: "start", s: 12.5 });
  b += NXI_T(470, 372, "חיבור ללולאה", { s: 12 });
  b += NXI_EQ(440, 250, "P·V = const");
  return NXI_wrap(b);
};
/* ---------- Supply / return headers ---------- */
const NXI_man = (split) => {
  const C = NXI_C,
    col = split ? C.cold : C.hot;
  let b = NXI_R(80, 220, 480, 50, "url(#nxSteel)", { rx: 25, st: "#334155", sw: 2, sh: 1 });
  b += NXI_R(90, 232, 460, 26, split ? "url(#nxWater)" : "url(#nxRed)", { rx: 13, op: 0.6 });
  for (let k = 0; k < 4; k++) {
    const xx = 170 + k * 100;
    b += NXI_R(xx - 13, 120, 26, 102, "url(#nxSteelH)", { st: "#334155" }) + NXI_FL(xx - 22, 112, 44, 12);
    b += split
      ? NXI_F(`M${xx},236 L${xx},70`, col, 8) + NXI_A(xx, 84, -90, col)
      : NXI_F(`M${xx},70 L${xx},236`, k % 2 ? "#fb923c" : C.hot, 8) + NXI_A(xx, 220, 90, C.hot);
  }
  b += split
    ? NXI_F("M20,245 L540,245", col, 12) + NXI_A(50, 245, 0, col)
    : NXI_F("M120,245 L620,245", col, 12) + NXI_A(600, 245, 0, col);
  b += NXI_T(320, 320, split ? "לחץ כמעט אחיד לאורך המחלק ← ספיקה דומה לכל ענף" : "ערבוב אדיאבטי של הענפים", { s: 13 });
  b += NXI_EQ(split ? 200 : 160, 360, split ? "ṁ_in = Σ ṁ_i   ·   ΔP_i = K_b·ρv²/2" : "ṁ_out·h_out = Σ ṁ_i·h_i");
  b += NXI_T(320, 40, split ? "מחלק אספקה" : "מאסף חזרה", { b: 1, s: 15 });
  return NXI_wrap(b);
};
NXI_DRAW.manifold_split = () => NXI_man(!0);
NXI_DRAW.manifold_merge = () => NXI_man(!1);
/* ---------- Pipe ---------- */
NXI_DRAW.pipe = () => {
  const C = NXI_C;
  let b = NXI_R(60, 120, 470, 160, "url(#nxInsul)", { rx: 20, sh: 1 });
  b += NXI_R(60, 140, 470, 120, "url(#nxSteel)", { rx: 10 });
  b += NXI_R(60, 154, 470, 92, "url(#nxWater)");
  b += NXI_R(530, 100, 22, 200, "url(#nxSteelH)", { rx: 3, st: "#334155" });
  for (let k = 0; k < 4; k++) b += NXI_R(533, 110 + k * 52, 16, 14, "url(#nxDark)", { rx: 2 });
  b += NXI_P("M150,154 Q260,200 150,246", "none", { st: "#fde68a", sw: 2 });
  for (let k = 0; k < 7; k++) {
    const y = 162 + k * 12.5,
      L = 110 * (1 - ((y - 200) / 46) ** 2);
    b += `<path d="M150,${y} h${L.toFixed(1)}" stroke="#fde68a" stroke-width="2" marker-end="url(#nxArr)"/>`;
  }
  b += NXI_F("M330,200 L500,200", C.cold, 10);
  for (let k = 0; k < 4; k++) b += `<path d="M${330 + k * 50},118 v-40" stroke="#fca5a5" stroke-width="2.5" marker-end="url(#nxArr)" opacity=".8"/>`;
  b += NXI_L(50, 70, 140, 130, "בידוד", { a: "end", s: 12.5 });
  b += NXI_L(50, 330, 140, 252, "דופן (חספוס ε)", { a: "end", s: 12.5 });
  b += NXI_L(600, 60, 540, 104, "אוגן + ברגים", { a: "start", s: 12.5 });
  b += NXI_L(300, 330, 240, 230, "פרופיל מהירות", { s: 12.5 });
  b += NXI_T(410, 66, "איבוד חום לסביבה", { s: 12 });
  b += NXI_EQ(150, 372, "ΔP = f·(L/D)·ρv²/2 + ΣK·ρv²/2 + ρgΔz");
  return NXI_wrap(b);
};
