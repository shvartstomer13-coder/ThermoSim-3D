/* === failure engine: monitors (cause → effect explanations), equation sheets, UI panel === */
FX.nom = null;
FX.mon = {};
function fxF(x, n = 1) { if (!Number.isFinite(x)) return "–"; const s = x.toFixed(n); return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s; }
function fxMonitors() {
  const S = FX.S, sg = fxSig(), c = FX.cfg;
  if (!FX.nom) { if (wt.sim.time > 2) FX.nom = { ...sg }; return; }
  const N = FX.nom;
  const M = [
    ["flowFws", sg.m_fws < 0.5 * N.m_fws, "crit", () => `זרימת מי המתקן ירדה ל-${fxF(sg.m_fws)} kg/s (מתוך ${fxF(N.m_fws)}). מהירות המשאבות היעילה n = ${fxF(S.units.fws.A.w * 100 + S.units.fws.B.w * 100, 0)}% והזרימה פרופורציונית לה (חוק הזיקה). ללא זרימה אין ל-CDU עם מה להעביר חום.`, "ṁ ∝ n ,  Q_CDU = ε·C_min·(T_h,in − T_c,in) ,  C_min = ṁ_c·cp → 0 ⇒ Q_CDU → 0"],
    ["flowFwsBack", FX.mon.flowFws && sg.m_fws > 0.9 * N.m_fws, "ok", () => `זרימת מי המתקן התאוששה ל-${fxF(sg.m_fws)} kg/s.`, ""],
    ["flowCw", sg.m_cw < 0.5 * N.m_cw, "crit", () => `זרימת מי המעבה ירדה ל-${fxF(sg.m_cw)} kg/s (מתוך ${fxF(N.m_cw)}). הצ'ילר לא יכול להפיל חום מהמעבה ולכן פוסק.`, "Q_c = Q_e + W ,  ṁ_c ↓ ⇒ T_c ↑ ⇒ COP = η₂·T_e/(T_c − T_e) ↓"],
    ["flowTcs", sg.m_tcs < 0.5 * N.m_tcs, "crit", () => `זרימת נוזל הקירור למעגל הארונות (TCS) ירדה ל-${fxF(sg.m_tcs)} kg/s. כל ארון מקבל פחות נוזל ולכן ΔT שלו גדל.`, "Q = ṁ·cp·ΔT  ⇒  ΔT_rack = Q/(ṁ·cp)"],
    ["tcsHot", sg.T_sup > N.T_sup + 3, "warn", () => `טמפרטורת האספקה לארונות עלתה ל-${fxF(sg.T_sup)}°C (מתוך ${fxF(N.T_sup)}). ה-CDU מעביר ${fxF(sg.Q_cdu, 0)} kW בעוד הארונות פולטים ${fxF(sg.Q_rack, 0)} kW, וההפרש מחמם את הנוזל במעגל.`, "C·dT/dt = Q_rack − Q_CDU ,  Q_CDU = ε·C_min·(T_h,in − T_c,in)"],
    ["chipHot", sg.T_chip > 80, "warn", () => `טמפרטורת השבב הגיעה ל-${fxF(sg.T_chip)}°C. T_chip = T_נוזל,out + P·R_plate ולכן עליית נוזל מעלה אותה אחד לאחד.`, "T_chip = T_liq,out + P_chip·R_plate"],
    ["throttle", sg.throttle < 99.5, "crit", () => `ה-GPU מצמצם עומס: מצערת ${fxF(sg.throttle, 0)}% מההספק. כך נמנע נזק בשבב, והמחיר הוא ירידה בתפוקת חישוב.`, "P_chip = P_max·throttle% , כאשר T_chip ≥ 85°C"],
    ["chillerOff", N.W_comp > 5 && sg.W_comp < 0.5, "crit", () => `מדחס הצ'ילר לא צורך הספק (W_comp = ${fxF(sg.W_comp)} kW) ולכן Q_evap = ${fxF(sg.Q_chil, 0)} kW. מעגל מי המתקן נשען על המגדל ההיברידי בלבד.`, "Q_e = g·min(Q_load, cap) , g = 0 כשהצ'ילר כבוי"],
    ["fwsHot", sg.T_fwsIn > N.T_fwsIn + 3, "warn", () => `טמפרטורת מי המתקן לכניסת ה-CDU עלתה ל-${fxF(sg.T_fwsIn)}°C (מתוך ${fxF(N.T_fwsIn)}). אין צ'ילר או מגדל שמפיל את החום, ולכן ה-ΔT על ה-CDU קטן ו-Q_CDU יורד.`, "Q_CDU = ε·C_min·(T_h,in − T_c,in) ,  T_c,in ↑ ⇒ Q ↓"],
    ["ctHot", sg.T_ct > N.T_ct + 3, "warn", () => `מי המעבה יוצאים מהמגדל ב-${fxF(sg.T_ct)}°C (מתוך ${fxF(N.T_ct)}). יעילות המגדל ε ירדה (${fxF(fxTel("ct").eps, 2)}) כי מאוורר החלש מקטין NTU.`, "NTU = NTU₀·n^0.6·(ṁ/ṁ_d)^−0.4 ,  ε = 1 − e^−NTU ,  Q = ε·ṁ·cp·(T_in − T_wb)"],
    ["socLow", !S.busFac && S.soc < 0.25 && S.upsOut, "warn", () => `הסוללה ירדה ל-${fxF(S.soc * 100, 0)}%. נשארו ${fxF(fxAutonomy() * 60, 0)} שניות בעומס ${fxF(sg.P_ups, 0)} kW.`, "t_left = SOC·E·η_b / P_out"],
    ["fltAlarm", sg.flt_dP > (fxComp("flt")?.params.dp_alarm || 35), "crit", () => `ΔP של מסנן ה-50 מיקרון עלה ל-${fxF(sg.flt_dP)} kPa, מעל סף ההתראה. הזרימה במעגל TCS יורדת בהתאם.`, "ΔP = ΔP_clean·f(clog) + K·ρ·v²/2"],
    ["tankLow", sg.tank < 80 && (S.leakKg || 0) > 0, "warn", () => `מפלס מיכל ההתפשטות ירד ל-${fxF(sg.tank, 0)}%. נאבדו ${fxF((S.leakKg || 0), 0)} ק"ג נוזל בנזילה בקצב ${fxF(S.mLeak, 2)} kg/s.`, "dV/dt = −ṁ_leak/ρ"],
    ["genHigh", sg.gen_load > 90, "warn", () => `עומס הגנרטור ${fxF(sg.gen_load, 0)}% מהדירוג (${fxF(sg.P_gen, 0)} kW).`, "P_gen = P_facility + P_UPS,in + P_chg"],
  ];
  for (const [id, on, sev, he, eq] of M) {
    if (on && !FX.mon[id]) { FX.mon[id] = true; fxEvent(sev, he(), eq); }
    else if (!on && FX.mon[id] && !id.endsWith("Back")) { FX.mon[id] = false; }
    if (id.endsWith("Back") && on) { FX.mon[id.replace("Back", "")] = false; fxEvent("ok", he(), eq); }
  }
}
/* ---------- equation sheets ---------- */
const FX_EQ = {
  pump: ["H = 1.2·H_r·(n/n_r)² − 0.2·H_r·(ṁ/ṁ_r)²", "ΔP = ρ·g·H", "ṁ ∝ n (חוק הזיקה)", "P_shaft = ṁ·ΔP/(ρ·η)", "NRV: מהירות 0 וזרימה חוזרת אסורה, H += 40·H_r·|ṁ|/ṁ_r"],
  cdu: ["ε = (1−e^(−NTU(1−Cr)))/(1−Cr·e^(−NTU(1−Cr)))", "Q = ε·C_min·(T_h,in − T_c,in)", "C = ṁ·cp", "משאבת משני: אותה עקומה כמו משאבה"],
  chiller: ["Q_e = min(Q_load, cap_kw)", "COP = η₂·T_e/(T_c − T_e)", "W = Q_e/COP", "Q_c = Q_e + W"],
  cooling_tower: ["NTU = −ln(1−ε_d)·n^0.6·(ṁ/ṁ_d)^−0.4", "ε = 1 − e^−NTU", "Q = ε·ṁ·cp·(T_in − T_wb)", "ΔP = dp0·(ṁ/ṁ_d)^1.85 + ρ·g·lift"],
  hybrid_tower: ["Q = ε·ṁ·cp·(T_in − T_wb)  (רטוב)", "Q = ε·ṁ·cp·(T_in − T_db)  (יבש)", "P_fan ∝ n³"],
  rack: ["Q_liq = d2c·P_rack·util", "T_chip = T_liq,out + P_chip·R_plate", "throttle כש-T_chip ≥ 85°C"],
  pipe: ["ΔP = (f·L/D + K)·ρ·v²/2", "דליפה: ṁ_leak = C_d·A·√(2ρ·ΔP)", "סתימה: K_clog = (1/(C_c(1−c)) − 1)²"],
  fine_filter: ["ΔP = ΔP_clean·(ṁ/ṁ_r)·g(clog) + housing", "התראה ב-ΔP ≥ dp_alarm"],
  ups: ["P_out = P_IT + P_mech", "P_in = P_out/η_UPS", "t_batt = E·η_b/P_out", "I = P/(√3·V·pf)"],
  crah: ["Q = ε·C_min·(T_air − T_w,in)"],
  manifold_split: ["Σṁ_branch = ṁ_in , ΔP_branch = K_b·ρ·v²/2"],
  exp_tank: ["הלחץ מקובע ל-p_set: משמש כאזור לחץ ייחוס ומילוי"],
};
/* ---------- charts ---------- */
const FX_C = {
  green: "#34d399", orange: "#fb923c", blue: "#60a5fa", red: "#f87171", purple: "#a78bfa", yellow: "#fbbf24", pink: "#f472b6", gray: "#9ca3af", cyan: "#22d3ee",
};
const FX_CHARTS = [
  { id: "elec", g: "חשמל", title: "הספקים חשמליים", unit: "kW", s: [["P_it", "עומס IT", FX_C.blue], ["P_ups", "פלט UPS", FX_C.cyan], ["P_fac", "מערכת מכנית (לא UPS)", FX_C.orange], ["P_gen", "גנרטור", FX_C.red], ["P_batt", "סוללה", FX_C.purple]], eq: ["P_UPS,out = P_IT + P_mech(UPS)", "P_gen = P_facility + P_UPS,in + P_chg", "P_batt = P_out כשאין רשת"], why: (g) => [`עומס IT ${fxF(g.P_it, 0)} kW, מערכות מכניות (משאבות/צ'ילר/מאווררים) ${fxF(g.P_fac, 0)} kW.`, FX.S.busFac ? `המקור: ${FX.S.ats === "gen" ? "הגנרטור" : "הרשת"}.` : "אין מקור: UPS על סוללה והעומס המכני כבוי."] },
  { id: "soc", g: "חשמל", title: "סוללת UPS ועומס גנרטור", unit: "%", s: [["soc", "מצב טעינה (SOC)", FX_C.green], ["gen_load", "עומס גנרטור", FX_C.red]], eq: ["SOC(t) = SOC₀ − ∫P_out·dt/(E·η_b)", "t_זמן גיבוי = E·η_b/P_out"], why: (g) => [`P_out = ${fxF(g.P_ups, 0)} kW, E·η_b = ${fxF(fxUpsE() * fxUpsEta(), 0)} kWh ⇒ זמן גיבוי מלא ${fxF((fxUpsE() * fxUpsEta() * 60) / Math.max(g.P_ups, 1), 1)} דקות.`, `נותר ${fxF(g.soc, 0)}%.`] },
  { id: "freq", g: "חשמל", title: "תדר הגנרטור", unit: "Hz", s: [["f_gen", "f", FX_C.yellow]], eq: ["f_ss = 50·(1 − R·P_gen/P_rated)", "df/dt = (f_ss − f)/τ_g"], why: (g) => [`נפילת תדר בעומס: R=${FX.cfg.gen_droop * 100}% ⇒ ב-${fxF(g.gen_load, 0)}% עומס התדר הוא ${fxF(g.f_gen, 2)} Hz.`] },
  { id: "fuel", g: "חשמל", title: "דלק בגנרטור", unit: "L", s: [["fuel", "מפלס", FX_C.orange]], eq: ["V̇ = bsfc·P_gen/η_alt", "bsfc = " + FX.cfg.bsfc_L_kwh + " L/kWh (הנחה)"], why: (g) => [`צריכה נוכחית ${fxF(FX.cfg.bsfc_L_kwh * (g.P_gen / FX.cfg.gen_alt_eta), 0)} L/h. נותרו ${fxF(g.fuel / Math.max(FX.cfg.bsfc_L_kwh * g.P_gen / FX.cfg.gen_alt_eta, 1e-6), 1)} שעות.`] },
  { id: "pumpspd", g: "הידראוליקה", title: "מהירות משאבות (ראשית A / גיבוי B)", unit: "%", s: [["n_fwsA", "מי מתקן A", FX_C.blue], ["n_fwsB", "מי מתקן B", FX_C.cyan], ["n_cwA", "מי מעבה A", FX_C.orange], ["n_cwB", "מי מעבה B", FX_C.yellow], ["n_cduA", "CDU A", FX_C.green], ["n_cduB", "CDU B", FX_C.pink]], eq: ["ω(t) = ω₀·e^(−t/τ)  (האטה חופשית)", "dω/dt = 1/t_ramp  (עלייה בתחילת עבודה)"], why: () => [`τ = ${FX.cfg.pump_tau_s} s, זיהוי ${FX.cfg.det_s} s, שיפוע התנעה לגיבוי ${FX.cfg.standby_ramp_s} s.`] },
  { id: "flows", g: "הידראוליקה", title: "ספיקות", unit: "kg/s", s: [["m_fws", "מי מתקן", FX_C.blue], ["m_cw", "מי מעבה", FX_C.orange], ["m_tcs", "TCS (CDU משני)", FX_C.green], ["m_rack", "ארון A1", FX_C.pink]], eq: ["ṁ ∝ n", "ΔP_pump(ṁ) = ΔP_system(ṁ)", "נקודת עבודה: חיתוך עקומת משאבה ועקומת מערכת"], why: (g) => [`מי מתקן ${fxF(g.m_fws)} kg/s, מי מעבה ${fxF(g.m_cw)} kg/s, TCS ${fxF(g.m_tcs)} kg/s.`] },
  { id: "dp", g: "הידראוליקה", title: "הפרשי לחץ", unit: "kPa", s: [["dP_fws", "משאבת מי מתקן", FX_C.blue], ["dP_cw", "משאבת מי מעבה", FX_C.orange], ["dP_rack", "ארון A1", FX_C.green], ["flt_dP", "מסנן", FX_C.red]], eq: ["ΔP = (f·L/D + K)·ρ·v²/2", "סתימה: K_clog = (1/(C_c(1−c)) − 1)²"], why: (g) => [`ΔP מסנן ${fxF(g.flt_dP)} kPa.`] },
  { id: "tcs", g: "תרמי", title: "טמפרטורות מעגל הארונות (TCS)", unit: "°C", s: [["T_sup", "אספקה לארונות", FX_C.cyan], ["T_ret", "חזרה מהארונות", FX_C.orange], ["T_chip", "שבב (A1)", FX_C.red]], eq: ["C·dT/dt = Q_rack − Q_CDU", "T_chip = T_liq,out + P·R_plate", "C_eff = Σ m·cp (מסת הנוזל במעגל)"], why: (g) => { const n = FX.tS.length; const dt = n > 5 ? FX.tS[n - 1] - FX.tS[n - 6] : 0; const dT = n > 5 ? FX.series.T_ret[n - 1] - FX.series.T_ret[n - 6] : 0; const rate = dt > 0 ? dT / dt : 0; const dQ = g.Q_rack - g.Q_cdu; const C = Math.abs(rate) > 0.005 ? dQ / rate : NaN; return [`Q_rack − Q_CDU = ${fxF(g.Q_rack, 0)} − ${fxF(g.Q_cdu, 0)} = ${fxF(dQ, 0)} kW.`, `קצב חימום ${fxF(rate * 60, 1)} °C/דקה${Number.isFinite(C) ? ` ⇒ קיבול תרמי יעיל C ≈ ${fxF(C / 1000, 1)} MJ/K` : ""}.`]; } },
  { id: "fws", g: "תרמי", title: "טמפרטורות מי המתקן והמעבה", unit: "°C", s: [["T_fwsIn", "כניסה ל-CDU", FX_C.cyan], ["T_fwsOut", "יציאה מ-CDU", FX_C.orange], ["T_ht", "יציאת מגדל HT-01", FX_C.green], ["T_ct", "יציאת מגדל CT-02", FX_C.yellow]], eq: ["Q = ε·ṁ·cp·(T_in − T_wb)", "ε = 1 − e^−NTU"], why: (g) => [`T_wb עיצוב 27°C, יציאת HT-01 ${fxF(g.T_ht)}°C, CT-02 ${fxF(g.T_ct)}°C.`] },
  { id: "heat", g: "תרמי", title: "העברת חום", unit: "kW", s: [["Q_rack", "ארונות (נוזל)", FX_C.red], ["Q_cdu", "CDU", FX_C.blue], ["Q_chil", "צ'ילר (מאייד)", FX_C.cyan], ["Q_ct", "מגדל CT-02", FX_C.yellow], ["Q_ht", "מגדל HT-01", FX_C.green]], eq: ["Q_CDU = ε·C_min·ΔT_in", "Q_c = Q_e + W", "Q_ct ≈ Q_c"], why: (g) => [`ε_CDU = ${fxF(g.eps_cdu, 2)}.`] },
  { id: "chiller", g: "תרמי", title: "צ'ילר: הספק מדחס ו-COP", unit: "kW / –", s: [["W_comp", "W_comp [kW]", FX_C.orange], ["COP", "COP", FX_C.green]], eq: ["COP = η₂·T_e/(T_c − T_e)", "W = Q_e/COP"], why: (g) => [`W = ${fxF(g.W_comp, 1)} kW, COP ${fxF(g.COP, 1)}.`] },
  { id: "throttle", g: "תרמי", title: "מצערת GPU", unit: "%", s: [["throttle", "הספק מותר", FX_C.red]], eq: ["P_chip = P_max·throttle% (כש-T_chip ≥ 85°C)"], why: (g) => [`T_chip = ${fxF(g.T_chip)}°C.`] },
  { id: "leak", g: "דליפה", title: "נזילה ומפלס מיכל", unit: "kg/s / %", s: [["m_leak", "ṁ_leak [kg/s]", FX_C.red], ["tank", "מפלס מיכל [%]", FX_C.blue]], eq: ["ṁ_leak = C_d·A·√(2ρ·(P−P_atm))", "V(t) = V₀ − ∫ṁ_leak/ρ·dt"], why: (g) => [`קצב נזילה ${fxF(g.m_leak, 2)} kg/s, נאבדו ${fxF(FX.S.leakKg || 0, 0)} ק"ג.`] },
];
/* ---------- chart drawing ---------- */
function fxDraw(cv, ch, xr) {
  const dpr = window.devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
  if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
  const g = cv.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
  const st = getComputedStyle(document.documentElement);
  const fg3 = (st.getPropertyValue("--fg3") || "#888").trim(), line = (st.getPropertyValue("--line") || "#333").trim(), fg2 = (st.getPropertyValue("--fg2") || "#bbb").trim();
  const L = 44, R = 8, T = 8, B = 20, w = W - L - R, h = H - T - B;
  const ts = FX.tS; if (ts.length < 2) { g.fillStyle = fg3; g.font = "11px sans-serif"; g.fillText("ממתין לנתונים (הפעל סימולציה)", L + 6, H / 2); return; }
  const t0 = xr ? xr[0] : ts[0], t1 = xr ? xr[1] : ts[ts.length - 1];
  let lo = 1e30, hi = -1e30;
  for (const [k] of ch.s) { const a = FX.series[k]; if (!a) continue; for (let i = 0; i < a.length; i++) { const v = a[i]; if (!Number.isFinite(v)) continue; if (ts[i] < t0) continue; lo = Math.min(lo, v); hi = Math.max(hi, v); } }
  if (lo > hi) { lo = 0; hi = 1; }
  if (hi - lo < 1e-6) { hi = lo + 1; }
  const pad = (hi - lo) * 0.08; lo -= pad; hi += pad; if (ch.unit === "%" ) { lo = Math.min(lo, 0); }
  const X = (t) => L + ((t - t0) / Math.max(t1 - t0, 1e-6)) * w, Y = (v) => T + (1 - (v - lo) / (hi - lo)) * h;
  g.direction = "ltr"; g.strokeStyle = line; g.lineWidth = 1; g.fillStyle = fg3; g.font = "10px sans-serif"; g.textAlign = "right";
  for (let i = 0; i <= 4; i++) { const v = lo + ((hi - lo) * i) / 4, y = Y(v); g.beginPath(); g.moveTo(L, y); g.lineTo(L + w, y); g.stroke(); g.fillText(Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1), L - 4, y + 3); }
  g.textAlign = "center";
  for (let i = 0; i <= 4; i++) { const t = t0 + ((t1 - t0) * i) / 4; g.fillText(t >= 120 ? (t / 60).toFixed(1) + "m" : t.toFixed(0) + "s", L + (w * i) / 4, H - 6); }
  for (const m of FX.marks) { if (m.t < t0 || m.t > t1) continue; g.strokeStyle = m.sev === "crit" ? "#f8717188" : m.sev === "ok" ? "#4ade8088" : "#fbbf2488"; g.setLineDash([3, 3]); g.beginPath(); g.moveTo(X(m.t), T); g.lineTo(X(m.t), T + h); g.stroke(); g.setLineDash([]); }
  for (const [k, , col] of ch.s) {
    const a = FX.series[k]; if (!a) continue; g.strokeStyle = col; g.lineWidth = 1.8; g.beginPath(); let st0 = false;
    for (let i = 0; i < a.length; i++) { if (!Number.isFinite(a[i]) || ts[i] < t0) continue; const x = X(ts[i]), y = Y(a[i]); if (!st0) { g.moveTo(x, y); st0 = true; } else g.lineTo(x, y); } g.stroke();
  }
}
/* ---------- panel ---------- */
(function fxPanel() {
  const css = `
  #fxbtn{position:fixed;left:16px;bottom:44px;z-index:60;background:var(--panel2);color:var(--fg);border:1px solid var(--line2);border-radius:10px;padding:8px 14px;font:600 13px/1 sans-serif;cursor:pointer;box-shadow:0 4px 14px #0006;display:flex;gap:8px;align-items:center}
  #fxbtn:hover{border-color:var(--accent)} #fxbtn b{color:var(--accent)}
  #fxp{position:fixed;left:16px;bottom:84px;z-index:61;width:min(760px,94vw);height:min(720px,78vh);min-width:420px;min-height:320px;background:var(--panel);color:var(--fg);border:1px solid var(--line2);border-radius:12px;box-shadow:0 10px 40px #000a;display:none;flex-direction:column;overflow:hidden;resize:both;font:13px/1.5 sans-serif;direction:rtl}
  #fxp.open{display:flex} #fxp *{box-sizing:border-box}
  #fxh{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--line);cursor:move;background:var(--panel2)}
  #fxh .t{font-weight:700;flex:1} #fxh button{background:var(--panel3);color:var(--fg);border:1px solid var(--line2);border-radius:6px;padding:3px 9px;cursor:pointer;font:600 12px sans-serif}
  #fxtabs{display:flex;gap:2px;padding:6px 8px 0;border-bottom:1px solid var(--line);background:var(--panel)}
  #fxtabs button{background:none;border:none;color:var(--fg2);padding:7px 14px;cursor:pointer;font:600 13px sans-serif;border-bottom:2px solid transparent}
  #fxtabs button.on{color:var(--accent);border-color:var(--accent)}
  #fxb{flex:1;overflow:auto;padding:10px 12px}
  .fxc{background:var(--panel2);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:10px}
  .fxc h4{margin:0 0 4px;font-size:14px} .fxc p{margin:0 0 8px;color:var(--fg2)}
  .fxr{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .fxr button{background:var(--panel3);color:var(--fg);border:1px solid var(--line2);border-radius:7px;padding:5px 12px;cursor:pointer;font:600 12px sans-serif}
  .fxr button.go{background:var(--accent);color:var(--accent-fg);border-color:var(--accent)} .fxr button:hover{filter:brightness(1.15)}
  .fxr label{color:var(--fg2);font-size:12px;display:flex;gap:5px;align-items:center}
  .fxr input[type=number]{width:70px;background:var(--bg);color:var(--fg);border:1px solid var(--line2);border-radius:5px;padding:2px 5px}
  .fxlog{border-top:1px solid var(--line);padding:6px 2px} .fxlog .tm{font:600 11px monospace;color:var(--fg3);direction:ltr;display:inline-block;min-width:54px}
  .fxlog .crit{color:#f87171} .fxlog .warn{color:#fbbf24} .fxlog .ok{color:#4ade80}
  .fxeq{direction:ltr;text-align:left;font:12px monospace;color:var(--fg2);background:var(--bg);border-radius:6px;padding:4px 8px;margin-top:4px;white-space:pre-wrap}
  .fxch canvas{width:100%;height:170px;display:block}
  .fxleg{display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--fg2);margin:4px 0}
  .fxleg i{display:inline-block;width:10px;height:3px;border-radius:2px;margin-left:4px;vertical-align:middle}
  .fxwhy summary{cursor:pointer;color:var(--accent);font-weight:600;font-size:12px}
  .fxwhy ul{margin:6px 0;padding:0 18px;color:var(--fg2)}
  .fxsel{background:var(--bg);color:var(--fg);border:1px solid var(--line2);border-radius:6px;padding:4px 8px}
  .fxtab{width:100%;border-collapse:collapse;font-size:12px} .fxtab td{padding:3px 6px;border-bottom:1px solid var(--line)} .fxtab td:last-child{direction:ltr;text-align:left;font-family:monospace}
  .fxpill{display:inline-block;border-radius:99px;padding:1px 9px;font-size:11px;font-weight:700;margin-inline-start:6px}
  .fxpill.on{background:#f8717133;color:#f87171} .fxpill.off{background:var(--panel3);color:var(--fg3)}
  .fxstat{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:6px;margin-bottom:10px}
  .fxstat div{background:var(--panel2);border:1px solid var(--line);border-radius:8px;padding:6px 9px} .fxstat small{display:block;color:var(--fg3);font-size:11px} .fxstat b{font-size:15px;direction:ltr;display:inline-block}
  `;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);
  const btn = document.createElement("div"); btn.id = "fxbtn"; btn.innerHTML = "⚡ <span>כשלים וגרפי מצב</span>"; document.body.appendChild(btn);
  const p = document.createElement("div"); p.id = "fxp"; document.body.appendChild(p);
  p.innerHTML = `<div id="fxh"><span class="t">כשלים וגרפי מצב</span><span id="fxtime" style="font:12px monospace;direction:ltr;color:var(--fg2)"></span><button id="fxrun"></button><select id="fxspd" class="fxsel"><option value="1">×1</option><option value="10">×10</option><option value="30">×30</option><option value="60">×60</option><option value="120">×120</option></select><button id="fxx">✕</button></div><div id="fxtabs"></div><div id="fxb"></div>`;
  const TABS = [["sc", "תרחישים"], ["gr", "גרפים"], ["cp", "רכיב"], ["as", "הנחות"]];
  let tab = "sc", selComp = "p_fws";
  const tabs = p.querySelector("#fxtabs"), body = p.querySelector("#fxb");
  TABS.forEach(([k, n]) => { const b = document.createElement("button"); b.textContent = n; b.dataset.k = k; b.onclick = () => { tab = k; render(); }; tabs.appendChild(b); });
  btn.onclick = () => { p.classList.toggle("open"); render(); };
  p.querySelector("#fxx").onclick = () => p.classList.remove("open");
  p.querySelector("#fxrun").onclick = () => { const u = ye.getState(); ye.setState({ running: !u.running }); upd(); };
  p.querySelector("#fxspd").onchange = (e) => { ye.setState({ speed: +e.target.value }); };
  (function drag() { const h = p.querySelector("#fxh"); let ox, oy, sx, sy; h.addEventListener("pointerdown", (e) => { if (e.target.tagName === "BUTTON" || e.target.tagName === "SELECT") return; const r = p.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top; p.style.bottom = "auto"; p.style.top = oy + "px"; const mv = (ev) => { p.style.left = ox + ev.clientX - sx + "px"; p.style.top = oy + ev.clientY - sy + "px"; }; const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); }; window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up); }); })();
  const SC = [
    { k: "grid", n: "אובדן חשמל (רשת)", d: "הרשת נופלת. ה-UPS עובר לסוללה, משאבות המתקן והצ'ילר והמאווררים נופלים עד שהגנרטור מתניע ו-ATS מעביר אליו. אחר כך ה-sequencer מפעיל הכל בהדרגה.", opts: [["gen_enabled", "גנרטור קיים", "chk"], ["gen_fail", "הגנרטור נכשל בהתנעה", "chk"], ["gen_kw", "דירוג גנרטור [kW]", "num"]], restore: "gridRestore" },
    { k: "pump", n: "כשל משאבה (N+1)", d: "המשאבה הראשית A נופלת. עם N+1 הגיבוי B מתניעה אוטומטית אחרי זיהוי; בלי N+1 הזרימה יורדת לאפס.", opts: [["skid", "משאבה", "sel", [["fws", "מי מתקן"], ["cw", "מי מעבה"], ["cdu", "CDU משני"]]], ["redund_fws", "N+1 מי מתקן", "chk"], ["redund_cw", "N+1 מי מעבה", "chk"], ["redund_cdu", "N+1 CDU", "chk"]] },
    { k: "chiller", n: "כשל צ'ילר", d: "טריפ מדחס. החום נפלט רק במגדל ההיברידי HT-01, טמפרטורת מי המתקן עולה.", opts: [] },
    { k: "ct", n: "כשל מגדל קירור CT-02 (מאוורר)", d: "מאוורר המגדל של מי המעבה נעצר. יעילות המגדל יורדת, המעבה מתחמם והצ'ילר מאבד COP.", opts: [] },
    { k: "ht", n: "כשל מגדל היברידי HT-01 (מאוורר)", d: "מאוורר המגדל ההיברידי נעצר. מי המתקן מתחממים.", opts: [] },
    { k: "leak", n: "נזילה בצינור", d: "חור בצינור: ṁ_leak = C_d·A·√(2ρΔP). המיכל ממלא עד שהמפלס יורד.", opts: [["leak_pipe", "צינור", "sel", [["pSup2", "אספקת TCS (pSup2)"], ["pSup", "יציאת CDU (pSup)"], ["pF4", "דחיסה מי מתקן (pF4)"], ["pF5", "כניסת CDU (pF5)"], ["pC3", "מי מעבה (pC3)"]]], ["leak_mm", "קוטר חור [מ\"מ]", "num"]] },
    { k: "clog", n: "סתימה (מסנן / צינור)", d: "סתימה הדרגתית: ΔP עולה והזרימה יורדת לפי עקומת המשאבה.", opts: [["clog_target", "יעד", "sel", [["flt", "מסנן 50µm"], ["pSup2", "צינור pSup2"], ["pF5", "צינור pF5"]]], ["clog_final_pct", "סתימה סופית [%]", "num"], ["clog_tau_s", "קבוע זמן [s]", "num"]] },
  ];
  function optHTML(o) { const c = FX.cfg; if (o[2] === "chk") return `<label><input type="checkbox" data-o="${o[0]}" ${c[o[0]] ? "checked" : ""}>${o[1]}</label>`; if (o[2] === "num") return `<label>${o[1]}<input type="number" data-o="${o[0]}" value="${c[o[0]]}"></label>`; return `<label>${o[1]}<select class="fxsel" data-o="${o[0]}">${o[3].map((x) => `<option value="${x[0]}" ${c[o[0]] === x[0] || FX.skidSel === x[0] && o[0] === "skid" ? "selected" : ""}>${x[1]}</option>`).join("")}</select></label>`; }
  function renderSc() {
    const S = FX.S; const t = wt.sim.time;
    let h = "";
    if (S) {
      const g = { off: "כבוי", starting: "בהתנעה", running: "פועל", fault: "תקלה", cooldown: "קירור" }[S.genState], u = S.upsOut ? (S.busFac ? "רגיל" : "סוללה") : "כבוי";
      h += `<div class="fxstat"><div><small>מקור חשמל</small><b>${S.busFac ? (S.ats === "gen" ? "גנרטור" : "רשת") : "אין"}</b></div><div><small>UPS</small><b>${u}</b></div><div><small>SOC</small><b>${fxF(S.soc * 100, 0)}%</b></div><div><small>גנרטור</small><b>${g}</b></div><div><small>טמפ' שבב A1</small><b>${fxF(fxTel("rack1").T_chip - 273.15)}°C</b></div><div><small>זרימת מי מתקן</small><b>${fxF(fxTel("p_fws").mdot)} kg/s</b></div></div>`;
    }
    h += `<div class="fxc"><div class="fxr"><button id="fxall">אפס הכל לתנאי עבודה תקינים</button><span style="color:var(--fg3)">לפני הפעלה לחץ הפעל בכותרת וקבע מהירות סימולציה.</span></div></div>`;
    SC.forEach((s) => { const on = FX.t0[s.k] !== undefined; h += `<div class="fxc" data-sc="${s.k}"><h4>${s.n}<span class="fxpill ${on ? "on" : "off"}">${on ? "פעיל · <bdi dir=ltr>" + fxF(FX.t0[s.k], 0) + "s</bdi>" : "כבוי"}</span></h4><p>${s.d}</p><div class="fxr">${s.opts.map(optHTML).join("")}<button class="go" data-go="${s.k}">הפעל כשל</button><button data-clr="${s.k}">${s.restore ? "החזר רשת" : "תקן / נקה"}</button></div></div>`; });
    h += `<div class="fxc"><h4>יומן אירועים וסיבות</h4>${FX.log.length ? "" : '<p>אין אירועים עדיין. הפעל כשל והרץ סימולציה.</p>'}${FX.log.slice().reverse().map((e) => `<div class="fxlog"><span class="tm">${fxF(e.t, 0)}s</span> <span class="${e.sev}">${e.he}</span>${e.eq ? `<div class="fxeq">${e.eq}</div>` : ""}</div>`).join("")}</div>`;
    body.innerHTML = h;
    body.querySelectorAll("[data-o]").forEach((el) => { el.onchange = () => { const k = el.dataset.o, c = FX.cfg; if (k === "skid") { FX.skidSel = el.value; return; } c[k] = el.type === "checkbox" ? el.checked : el.tagName === "SELECT" ? el.value : +el.value; }; });
    body.querySelector("#fxall").onclick = () => { fxReset(false); render(); };
    body.querySelectorAll("[data-go]").forEach((b) => { b.onclick = () => { const k = b.dataset.go; fxTrigger(k, { skid: FX.skidSel || "fws" }); const stt = ye.getState(); if (!stt.running) ye.setState({ running: true }); render(); }; });
    body.querySelectorAll("[data-clr]").forEach((b) => { b.onclick = () => { const k = b.dataset.clr, s = SC.find((x) => x.k === k); if (s && s.restore) fxTrigger(s.restore); else fxClear(k); delete FX.t0[k]; if (s && s.restore) delete FX.t0[k]; render(); }; });
  }
  let chartRefs = [];
  function renderGr() {
    let h = ""; ["חשמל", "הידראוליקה", "תרמי", "דליפה"].forEach((gname) => { h += `<h4 style="margin:6px 0">${gname}</h4>`; FX_CHARTS.filter((c) => c.g === gname).forEach((c) => { h += `<div class="fxc fxch" data-ch="${c.id}"><div style="font-weight:700">${c.title} <span style="color:var(--fg3);font-weight:400">[${c.unit}]</span></div><canvas></canvas><div class="fxleg">${c.s.map((s) => `<span><i style="background:${s[2]}"></i>${s[1]}</span>`).join("")}</div><details class="fxwhy"><summary>למה זה קורה? משוואות והסבר</summary><div class="fxeq">${c.eq.join("\n")}</div><ul class="why"></ul></details></div>`; }); });
    body.innerHTML = h; chartRefs = [...body.querySelectorAll("[data-ch]")].map((el) => ({ el, ch: FX_CHARTS.find((c) => c.id === el.dataset.ch), cv: el.querySelector("canvas"), ul: el.querySelector("ul") }));
    drawCharts();
  }
  function drawCharts() { if (!FX.S) return; const sg = fxSig(); chartRefs.forEach((r) => { fxDraw(r.cv, r.ch); if (r.el.querySelector("details").open) { try { r.ul.innerHTML = r.ch.why(sg).map((x) => `<li>${x}</li>`).join(""); } catch {} } }); }
  function renderCp() {
    const comps = wt.sim.scene.comps.filter((c) => c.type !== "pipe" || true);
    const sel = ye.getState().selected && fxComp(ye.getState().selected) ? ye.getState().selected : selComp; selComp = sel;
    const c = fxComp(sel), tel = fxTel(sel);
    let h = `<div class="fxr" style="margin-bottom:8px"><label>רכיב <select class="fxsel" id="fxcs">${comps.map((x) => `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${x.name} (${x.id})</option>`).join("")}</select></label></div>`;
    h += `<div class="fxc"><h4>${c ? c.name : ""}</h4><div class="fxeq">${(FX_EQ[c?.type] || ["אין משוואות רשומות"]).join("\n")}</div></div>`;
    h += `<div class="fxc"><h4>נתונים חיים</h4><table class="fxtab">${Object.entries(tel).filter(([, v]) => typeof v === "number").map(([k, v]) => `<tr><td>${k}</td><td>${Math.abs(v) > 1e3 ? v.toFixed(0) : v.toFixed(3)}</td></tr>`).join("")}</table></div>`;
    body.innerHTML = h; body.querySelector("#fxcs").onchange = (e) => { selComp = e.target.value; ye.setState({ selected: selComp }); renderCp(); };
  }
  function renderAs() {
    const c = FX.cfg; const rows = [["gen_kw", "דירוג גנרטור [kW]"], ["gen_start_s", "זמן התנעה [s]"], ["ats_s", "העברת ATS [s]"], ["gen_droop", "נפילת תדר R (pu)"], ["gen_tau_s", "קבוע זמן ממשל [s]"], ["bsfc_L_kwh", "צריכת דלק [L/kWh]"], ["fuel_L", "מיכל דלק [L]"], ["chg_kw", "הספק טעינת סוללה [kW]"], ["pump_tau_s", "האטת משאבה τ [s]"], ["det_s", "זמן זיהוי כשל משאבה [s]"], ["standby_ramp_s", "שיפוע התנעת גיבוי [s]"], ["pump_delay_s", "השהיית sequencer למשאבות [s]"], ["soft_start_s", "התנעה רכה למשאבה ראשית [s]"], ["fan_delay_s", "השהיית מאווררים [s]"], ["chiller_delay_s", "השהיית צ'ילר (אנטי-מחזור) [s]"], ["it_restart_s", "השהיית חזרת IT [s]"], ["tank_m3", "נפח מילוי במיכל התפשטות [m³]"], ["cd", "מקדם ספיקה C_d של חור נזילה"]];
    body.innerHTML = `<div class="fxc"><h4>הנחות המודל (ניתנות לעריכה)</h4><p>כל הנחה כאן ולא בתוך הקוד. שינוי נכנס לתוקף בהפעלת התרחיש הבא. הערכים הם הנחות תכנון טיפוסיות ולא נתוני יצרן.</p><table class="fxtab">${rows.map(([k, n]) => `<tr><td>${n}</td><td><input type="number" step="any" data-a="${k}" value="${c[k]}" style="width:90px"></td></tr>`).join("")}</table></div>`;
    body.querySelectorAll("[data-a]").forEach((el) => (el.onchange = () => { c[el.dataset.a] = +el.value; }));
  }
  function render() { tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.k === tab)); if (!p.classList.contains("open")) return; ({ sc: renderSc, gr: renderGr, cp: renderCp, as: renderAs })[tab](); upd(); }
  function upd() { const u = ye.getState(); p.querySelector("#fxrun").textContent = u.running ? "⏸ עצור" : "▶ הפעל"; p.querySelector("#fxspd").value = String(u.speed); p.querySelector("#fxtime").textContent = "t = " + fxF(wt.sim.time, 0) + " s"; }
  FX.listeners.add((what) => { if (!p.classList.contains("open")) return; if (what === "sample" && tab === "gr") drawCharts(); if (what === "log" && tab === "sc") renderSc(); if (what === "reset") render(); });
  setInterval(() => { if (p.classList.contains("open")) { upd(); if (tab === "cp") { const sel = ye.getState().selected; if (sel && sel !== selComp) renderCp(); } if (tab === "sc" && !body.contains(document.activeElement)) renderSc(); } }, 1000);
  FX.panelRender = render;
})();
window.__ts.fx = { FX, trigger: fxTrigger, clear: fxClear, reset: fxReset, sig: fxSig, control: fxControl };

/* ---------- 3D: duty + standby pump set (N+1) ---------- */
function fxRate(c, unit, sp) {
  const S = FX.S, k = c.id === "p_fws" ? "fws" : c.id === "p_cw" ? "cw" : null;
  if (!unit || !k || !S) return ((sp ?? 0) / 100) * 18;
  const base = fxBaseOf(c.id, "speed_pct") || 100;
  return ((S.units[k][unit].w * base) / 100) * 18;
}
function NXM_pumpSet({ c: i }) {
  const red = i.id === "p_fws" || i.id === "p_cw";
  const [, tick] = ne.useState(0);
  ne.useEffect(() => { const h = setInterval(() => tick((v) => v + 1), 500); return () => clearInterval(h); }, []);
  if (!red) return x.jsx(Ek, { c: i });
  const k = i.id === "p_fws" ? "fws" : "cw", U = FX.S ? FX.S.units[k] : null;
  const col = (u) => { if (!U) return "#22c55e"; const q = U[u]; return q.bad ? "#ef4444" : q.w > 0.5 ? "#22c55e" : q.w > 0.02 ? "#fbbf24" : "#6b7280"; };
  const lamp = (u, z) => x.jsx(st, { s: [0.12, 0.05, 0.1], pos: [0.4, 0.66, z + 0.06], m: { kind: "led", color: col(u) }, shadow: !1 });
  return x.jsxs("group", { children: [
    x.jsx(Ek, { c: i, unit: "A" }),
    x.jsx("group", { position: [0, 0, -1.0], children: x.jsx(Ek, { c: i, unit: "B" }) }),
    x.jsx(zt, { r: 0.04, h: 1.0, rot: [Math.PI / 2, 0, 0], pos: [-0.5, 0.35, -0.5], m: { kind: "steel", ch: "cold" } }),
    x.jsx(zt, { r: 0.04, h: 1.0, rot: [Math.PI / 2, 0, 0], pos: [0.12, 0.75, -0.5], m: { kind: "steel", ch: "hot" } }),
  ] });
}
