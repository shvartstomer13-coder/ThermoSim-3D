/* === ThermoSim add-on: failure engine (power / pumps N+1 / chiller / towers / leak / clog) ===
   Every effect is applied to the real solver parameters (speed_pct, on, fan_pct, util_pct, leak_mm, clog_pct)
   and the solver then produces the thermal-hydraulic response. Electrical state (UPS battery, generator,
   ATS) is a small lumped model with the equations listed in FX_EQ. All assumptions live in FX.cfg. */
const FX = {
  cfg: {
    gen_kw: 1000, gen_start_s: 10, ats_s: 2, detect_s: 1, gen_alt_eta: 0.95, gen_droop: 0.04, gen_tau_s: 1.5,
    bsfc_L_kwh: 0.215, fuel_L: 4000, chg_kw: 20, chg_delay_s: 5, retransfer_s: 30, cooldown_s: 60,
    pump_tau_s: 3, pump_delay_s: 5, soft_start_s: 10, fan_delay_s: 20, fan_ramp_s: 10, chiller_delay_s: 240,
    it_restart_s: 60, det_s: 2, standby_ramp_s: 6, motor_eff: 0.9, cd: 0.62,
    redund_fws: true, redund_cw: true, redund_cdu: true, gen_enabled: true, gen_fail: false,
    tank_m3: 0.5, leak_mm: 5, leak_pipe: "pSup2", clog_final_pct: 90, clog_tau_s: 300, clog_target: "flt",
  },
  S: null, t0: {}, log: [], series: {}, tS: [], lastSample: -1e9, scene: null, base: {}, marks: [], listeners: new Set(),
  FAULTS: { pump: {}, chiller: 0, ct: 0, ht: 0, cdu: {} },
};
const FX_P = { fws: "p_fws", cw: "p_cw", cdu: "cdu" };
function fxComp(id) { return wt.sim.scene.comps.find((c) => c.id === id); }
function fxTel(id) { return wt.sim.telemetry.get(id) || {}; }
function fxBaseOf(id, key) {
  const k = id + "." + key;
  if (!(k in FX.base)) { const c = fxComp(id); FX.base[k] = c ? c.params[key] : undefined; }
  return FX.base[k];
}
function fxSet(id, key, val) {
  const c = fxComp(id);
  if (!c || c.params[key] === val || val === undefined || Number.isNaN(val)) return;
  fxBaseOf(id, key);
  c.params[key] = val;
}
function fxRestoreAll() {
  for (const k of Object.keys(FX.base)) {
    const [id, key] = k.split(".");
    const c = fxComp(id);
    if (c && FX.base[k] !== undefined) c.params[key] = FX.base[k];
  }
  FX.base = {};
}
function fxNewState() {
  const c = FX.cfg;
  const mk = (ratio) => ({ A: { st: "run", w: 1, bad: false }, B: { st: "standby", w: 0, bad: false }, trouble: 0, failoverAt: null, redund: ratio });
  return {
    grid: true, upsOut: true, upsIn: true, soc: 1, genState: "off", genT: 0, ats: "util", busFac: true, busT: 1e9, f: 50, fuel: c.fuel_L,
    gridT: 0, upsOutT: 1e9, Pgen: 0, Pfac: 0, Pbatt: 0, Pchg: 0, genTrip: 0, retT: 0, coolT: 0,
    units: { fws: mk(), cw: mk(), cdu: mk() }, chiller: { fault: 0, w: 1, t: 1e9 }, fans: { ct: { w: 1, t: 1e9 }, ht: { w: 1, t: 1e9 } },
    leaks: {}, clogs: {}, tnk: 1,
  };
}
function fxEvent(sev, he, eq) {
  const t = wt.sim.time;
  FX.log.push({ t, sev, he, eq: eq || "" });
  FX.marks.push({ t, sev });
  if (FX.log.length > 400) FX.log.shift();
  FX.listeners.forEach((f) => f("log"));
}
function fxReset(keepLog) {
  fxRestoreAll();
  FX.S = fxNewState();
  FX.FAULTS = { pump: {}, chiller: 0, ct: 0, ht: 0, cdu: {} };
  FX.series = {}; FX.tS = []; FX.lastSample = -1e9; FX.marks = [];
  if (!keepLog) FX.log = [];
  FX.scene = wt.sim.scene;
  for (const id of Object.keys(FX.clogPipes || {})) delete FX.clogPipes[id];
  FX.listeners.forEach((f) => f("reset"));
}
/* ---------- scenario triggers ---------- */
function fxTrigger(name, opt = {}) {
  if (!FX.S || FX.scene !== wt.sim.scene) fxReset(true);
  const S = FX.S, c = FX.cfg, t = wt.sim.time;
  FX.t0[name] = t;
  if (name === "grid") {
    S.grid = false; S.gridT = 0;
    const u = fxTel("ups1");
    fxEvent("crit", "אובדן רשת חשמל. ה-UPS עובר לסוללה, ועומסים שאינם על UPS (משאבות מי מתקן ומעבה, צ'ילר, מאווררי מגדלים) נופלים מיד.",
      `t_gb = E·η_b / P_out = ${fxUpsE().toFixed(0)} kWh × ${fxUpsEta().toFixed(2)} / ${(u.ups_P_out || 0).toFixed(0)} kW = ${(fxAutonomy() * 60).toFixed(0)} s`);
  } else if (name === "gridRestore") {
    S.grid = true; S.retT = 0;
    fxEvent("ok", "הרשת חזרה. מעבר ATS חזרה לרשת אחרי יציבות של " + c.retransfer_s + " שניות.");
  } else if (name === "pump") {
    const k = opt.skid || "fws";
    S.units[k].A.bad = true; S.units[k].trouble = 0;
    FX.FAULTS.pump[k] = true;
    const redund = c["redund_" + k];
    fxEvent("crit", `כשל במשאבה הראשית של ${FX_NAMES[k]} (A). ${redund ? "משאבת הגיבוי B תתנע אוטומטית (N+1) אחרי זיהוי של " + c.det_s + " שניות." : "אין משאבת גיבוי: הזרימה תרד לאפס."}`,
      "ω(t) = ω₀·e^(−t/τ),  H = 1.2·H_r·(n/n_r)² − 0.2·H_r·(ṁ/ṁ_r)²");
  } else if (name === "chiller") {
    FX.FAULTS.chiller = opt.cap === undefined ? 1 : opt.cap;
    fxEvent("crit", FX.FAULTS.chiller >= 1 ? "הצ'ילר CH-01 נפל (טריפ מדחס). המגדל ההיברידי נשאר היחיד שמפיל חום מהמים." : "הצ'ילר הפסיד חלק מהקיבולת.",
      "Q_e = min(Q_load, cap_kw) ,  COP = η₂·T_e/(T_c − T_e)");
  } else if (name === "ct") {
    FX.FAULTS.ct = 1;
    fxEvent("crit", "מאוורר מגדל הקירור CT-02 נפל. ללא אוויר מאולץ יורדת יעילות המגדל וטמפרטורת מי המעבה עולה.", "NTU = NTU₀·n^0.6·(ṁ/ṁ_d)^−0.4 ,  ε = 1 − e^−NTU");
  } else if (name === "ht") {
    FX.FAULTS.ht = 1;
    fxEvent("crit", "מאוורר המגדל ההיברידי HT-01 נפל. פליטת החום של מעגל מי המתקן יורדת.", "Q = ε·ṁ·cp·(T_in − T_wb)");
  } else if (name === "leak") {
    const id = opt.pipe || c.leak_pipe;
    S.leaks[id] = { d: opt.d ?? c.leak_mm, t0: t };
    fxEvent("crit", `נזילה בצינור ${id}: חור בקוטר ${opt.d ?? c.leak_mm} מ"מ. מסה אובדת מהמעגל ולחץ המעגל יורד עד שמיכל ההתפשטות מספק מילוי.`,
      "ṁ_leak = C_d·A·√(2·ρ·ΔP) ,  A = π·d²/4");
  } else if (name === "clog") {
    const id = opt.target || c.clog_target;
    S.clogs[id] = { t0: t, final: opt.final ?? c.clog_final_pct, tau: opt.tau ?? c.clog_tau_s };
    fxEvent("warn", `סתימה הדרגתית ב-${id}: חסימת שטח הזרימה עד ${opt.final ?? c.clog_final_pct}% בקבוע זמן ${opt.tau ?? c.clog_tau_s} שניות.`,
      "K_clog = (1/(C_c·(1−c)) − 1)² ,  ΔP = K·ρ·v²/2");
  } else if (name === "genFail") {
    c.gen_fail = true;
  }
}
const FX_NAMES = { fws: "משאבת מי מתקן", cw: "משאבת מי מעבה", cdu: "משאבת CDU" };
function fxClear(name) {
  const S = FX.S; if (!S) return;
  delete FX.t0[name];
  if (name === "grid") { S.grid = true; S.retT = 0; }
  if (name === "pump") { FX.FAULTS.pump = {}; for (const k of ["fws", "cw", "cdu"]) { S.units[k].A.bad = false; S.units[k].trouble = 0; S.units[k].failoverAt = null; } fxEvent("ok", "המשאבה הראשית תוקנה. המערכת חוזרת לעבוד עם משאבה A כראשית ו-B כגיבוי."); }
  if (name === "chiller") { FX.FAULTS.chiller = 0; S.chiller.t = 0; fxEvent("ok", "הצ'ילר תוקן. הפעלה מחדש תתבצע אחרי השהיית אנטי-מחזור של " + FX.cfg.chiller_delay_s + " שניות."); }
  if (name === "ct") { FX.FAULTS.ct = 0; S.fans.ct.t = 0; }
  if (name === "ht") { FX.FAULTS.ht = 0; S.fans.ht.t = 0; }
  if (name === "leak") { S.leaks = {}; for (const c of wt.sim.scene.comps) if (c.type === "pipe") c.params.leak_mm = 0; fxEvent("ok", "הנזילה נאטמה. המילוי מהמיכל ממשיך עד שהמפלס חוזר ליעד."); }
  if (name === "clog") { S.clogs = {}; for (const c of wt.sim.scene.comps) { if (c.type === "pipe") c.params.clog_pct = 0; if (c.type === "fine_filter") fxSet(c.id, "clog_pct", fxBaseOf(c.id, "clog_pct") ?? 0); } fxEvent("ok", "הסתימה נוקתה (החלפת אלמנט / שטיפה)."); }
}
/* ---------- electrical helpers ---------- */
function fxUpsP() { const c = fxComp("ups1"); return c ? c.params : { batt_kwh: 80, batt_eff_pct: 95, eta_pct: 96.5, rating_kw: 600 }; }
function fxUpsE() { return fxUpsP().batt_kwh; }
function fxUpsEta() { return fxUpsP().batt_eff_pct / 100; }
function fxAutonomy() { const P = fxTel("ups1").ups_P_out || 1; return (FX.S.soc * fxUpsE() * fxUpsEta()) / P; }
/* ---------- per-step control (runs before the solver step) ---------- */
function fxControl(dt) {
  const S = FX.S, c = FX.cfg, t = wt.sim.time;
  if (!S) return;
  const ups = fxTel("ups1");
  /* grid / generator / ATS */
  if (!S.grid) {
    S.gridT += dt;
    if (c.gen_enabled && S.genState === "off" && S.gridT >= c.detect_s) {
      if (c.gen_fail) { S.genState = "fault"; fxEvent("crit", "הגנרטור נכשל בהתנעה. הסוללה היא מקור החשמל היחיד עד שהיא מתרוקנת.", "SOC(t) = SOC₀ − ∫P_out dt / (E·η_b)"); }
      else { S.genState = "starting"; S.genT = 0; fxEvent("warn", `פקודת התנעה לגנרטור. אחרי ${c.gen_start_s} שניות (מנוע, מהירות, מתח) ו-${c.ats_s} שניות העברה ב-ATS הוא נושא את המערכת.`, "NFPA 110 Type 10: הגנרטור חייב לקבל עומס תוך ≤ 10 שניות"); }
    }
  }
  if (S.genState === "starting" && S.grid) { S.genState = "off"; }
  if (S.genState === "starting") {
    S.genT += dt;
    if (S.genT >= c.gen_start_s + c.ats_s) { S.genState = "running"; S.ats = "gen"; S.genT = 0; S.busFac = true; fxEvent("ok", "הגנרטור נושא את הפסים. ה-ATS עבר לגנרטור וה-sequencer מפעיל מחדש משאבות, מאווררים וצ'ילר בהדרגה.", "P_gen = P_UPS,in + P_facility ≤ P_rated"); }
  } else if (S.genState === "running") {
    S.genT += dt;
    if (S.grid && S.ats === "gen") { S.retT += dt; if (S.retT >= c.retransfer_s) { S.ats = "util"; S.genState = "cooldown"; S.coolT = 0; fxEvent("ok", "ATS חזר לרשת. הגנרטור ממשיך לעבוד " + c.cooldown_s + " שניות בקירור."); } }
  } else if (S.genState === "cooldown") { S.coolT += dt; if (S.coolT >= c.cooldown_s) S.genState = "off"; }
  const busWas = S.busFac;
  if (S.ats === "util" && S.grid === false && S.genState === "running") S.ats = "gen";
  if (S.ats === "gen" && S.grid && S.genState !== "running") S.ats = "util";
  S.busFac = S.ats === "util" ? S.grid : S.genState === "running";
  if (S.busFac && !busWas) S.busT = 0; else if (S.busFac) S.busT += dt; else S.busT = 0;
  /* UPS battery */
  const Pout = ups.ups_P_out || 0;
  const Euse = fxUpsE() * fxUpsEta();
  if (S.busFac) {
    S.upsIn = true;
    if (S.busT > c.chg_delay_s && S.soc < 1) { S.Pchg = Math.min(c.chg_kw, (1 - S.soc) * Euse * 3600 / dt); S.soc = Math.min(1, S.soc + (S.Pchg * dt) / 3600 / Euse); }
    else S.Pchg = 0;
    S.Pbatt = 0;
  } else {
    S.upsIn = false; S.Pchg = 0;
    if (S.upsOut) { S.Pbatt = Pout; S.soc = Math.max(0, S.soc - (Pout * dt) / 3600 / Euse); }
    else S.Pbatt = 0;
  }
  if (S.upsOut && S.soc <= 0 && !S.busFac) { S.upsOut = false; S.upsOutT = 0; fxEvent("crit", "הסוללה התרוקנה: פלט ה-UPS נעלם. עומס ה-IT, משאבת ה-CDU ומאוורר ה-CRAH נכבים.", "SOC = 0 → P_IT = 0 → Q_rack = 0"); }
  if (!S.upsOut) { S.upsOutT += dt; if (S.busFac && S.upsOutT >= c.it_restart_s) { S.upsOut = true; fxEvent("ok", "ה-UPS חזר לפלט. העומסים מותנעים מחדש."); } }
  /* pumps: duty A + standby B (N+1) */
  for (const k of ["fws", "cw", "cdu"]) {
    const U = S.units[k], id = FX_P[k];
    const bus = k === "cdu" ? S.upsOut : S.busFac && S.busT >= c.pump_delay_s;
    const base = fxBaseOf(id, "speed_pct");
    const redund = c["redund_" + k];
    const aBad = U.A.bad || !bus;
    const stepW = (u, cmd) => {
      if (cmd) u.w = Math.min(1, u.w + dt / (k === "cdu" || u === U.B ? c.standby_ramp_s : c.soft_start_s));
      else u.w = u.w * Math.exp(-dt / c.pump_tau_s);
      if (u.w < 1e-3) u.w = 0;
    };
    const flowNow = fxTel(id).mdot || 0, flowBase = fxBaseOf(id, "m_rated") * (base / 100) * 0.9;
    if (aBad && bus && redund && !U.B.bad) { U.trouble += dt; if (U.trouble >= c.det_s && U.failoverAt === null) { U.failoverAt = t; U.B.st = "run"; fxEvent("warn", `זוהה זרימה נמוכה (${flowNow.toFixed(1)} kg/s). משאבת הגיבוי B של ${FX_NAMES[k]} מותנעת. העלאת מהירות בשיפוע ${c.standby_ramp_s} שניות.`, "ṁ ∝ n   (חוק הזיקה) ,  H ∝ n²"); } }
    else if (!aBad) { U.trouble = 0; if (U.failoverAt !== null && !FX.FAULTS.pump[k]) { U.failoverAt = null; U.B.st = "standby"; } }
    stepW(U.A, !aBad);
    stepW(U.B, U.B.st === "run" && bus && !U.B.bad);
    U.A.st = U.A.w > 0.02 ? (U.A.bad ? "coast" : "run") : (U.A.bad ? "tripped" : "stopped");
    const w = Math.min(1, U.A.w + U.B.w);
    fxSet(id, "speed_pct", base * w);
    U.w = w;
  }
  /* chiller */
  {
    const base = fxBaseOf("chiller", "cap_kw"), R = S.chiller;
    const can = S.busFac && S.busT >= c.chiller_delay_s && !(FX.FAULTS.chiller >= 1);
    const running = can;
    if (running !== R.on) { R.on = running; }
    fxSet("chiller", "on", !!running);
    fxSet("chiller", "cap_kw", base * Math.max(0.05, 1 - (FX.FAULTS.chiller < 1 ? FX.FAULTS.chiller : 0)));
  }
  /* tower fans */
  for (const [k, id, fault] of [["ct", "ct", FX.FAULTS.ct], ["ht", "htw", FX.FAULTS.ht]]) {
    const F = S.fans[k], base = fxBaseOf(id, "fan_pct");
    const on = S.busFac && S.busT >= c.fan_delay_s && !fault;
    F.w = on ? Math.min(1, F.w + dt / c.fan_ramp_s) : Math.max(0, F.w - dt / 3);
    fxSet(id, "fan_pct", Math.max(F.w * base, 0.01));
  }
  /* IT load (UPS output) */
  for (const r of wt.sim.scene.comps) if (r.type === "rack") fxSet(r.id, "util_pct", S.upsOut ? fxBaseOf(r.id, "util_pct") : 0);
  fxSet("crah1", "fan_pct", S.upsOut ? fxBaseOf("crah1", "fan_pct") : 0.01);
  /* leaks and clogging */
  for (const p of wt.sim.scene.comps) {
    if (p.type !== "pipe") continue;
    const L = S.leaks[p.id], C = S.clogs[p.id];
    p.params.leak_mm = L ? L.d : 0;
    p.params.clog_pct = C ? C.final * (1 - Math.exp(-(t - C.t0) / C.tau)) : 0;
  }
  for (const [id, C] of Object.entries(S.clogs)) {
    const cc = fxComp(id);
    if (cc && cc.type === "fine_filter") fxSet(id, "clog_pct", Math.min(99, C.final * (1 - Math.exp(-(t - C.t0) / C.tau))));
  }
  /* generator electrical state */
  const Wmot = (id) => (fxTel(id).W_shaft || 0) / c.motor_eff;
  const fan = (id, w) => (fxComp(id) ? fxComp(id).params.fan_kw || 0 : 0) * Math.pow(Math.max(w, 0), 3);
  S.Pfac = Wmot("p_fws") + Wmot("p_cw") + (fxTel("chiller").W_comp || 0) + fan("ct", S.fans.ct.w) + fan("htw", S.fans.ht.w) + ((fxTel("htw").spray_kw || 0) * S.fans.ht.w);
  const Pload = S.Pfac + (ups.ups_P_in || 0) + S.Pchg;
  const gen = S.genState === "running" && S.ats === "gen";
  S.Pgen = gen ? Pload : 0;
  const L = S.Pgen / c.gen_kw;
  const fss = gen ? 50 * (1 - c.gen_droop * L) : S.genState === "starting" ? 50 * Math.min(1, S.genT / c.gen_start_s) : 50;
  S.f += (fss - S.f) * (1 - Math.exp(-dt / c.gen_tau_s));
  if (gen) { S.fuel = Math.max(0, S.fuel - (c.bsfc_L_kwh * (S.Pgen / c.gen_alt_eta) * dt) / 3600); S.genTrip = L > 1.0 ? S.genTrip + dt : 0; }
  if (gen && S.genTrip > 10) { S.genState = "fault"; S.ats = "util"; S.busFac = false; fxEvent("crit", `הגנרטור עמוס מדי (${(L * 100).toFixed(0)}% מהדירוג) ונפל בהגנת עומס יתר.`, "P_gen ≤ P_rated"); }
  if (gen && S.fuel <= 0) { S.genState = "fault"; fxEvent("crit", "מיכל הדלק התרוקן. הגנרטור נעצר."); }
  /* pipe leak: tank level (expansion tank refills the loop) */
  let leak = 0;
  for (const p of wt.sim.scene.comps) if (p.type === "pipe") leak += fxTel(p.id).leak_kgs || 0;
  S.mLeak = leak;
  S.leakKg = (S.leakKg || 0) + leak * dt;
}
/* ---------- sampling ---------- */
function fxSig() {
  const T = fxTel, K = (x) => (x === undefined ? NaN : x - 273.15), S = FX.S;
  const cdu = T("cdu"), rk = T("rack1"), ch = T("chiller"), ct = T("ct"), ht = T("htw"), up = T("ups1"), pf = T("p_fws"), pc = T("p_cw");
  let leakPipeP = NaN;
  return {
    grid: S.grid ? 1 : 0, ups_out: S.upsOut ? 1 : 0, soc: S.soc * 100, P_it: up.ups_P_it, P_ups: up.ups_P_out, P_fac: S.Pfac, P_gen: S.Pgen, P_batt: S.Pbatt,
    f_gen: S.f, fuel: S.fuel, auton_min: fxAutonomy(), gen_load: (S.Pgen / FX.cfg.gen_kw) * 100,
    m_fws: pf.mdot, m_cw: pc.mdot, m_tcs: cdu.mdot, m_rack: rk.mdot, dP_fws: pf.dP, dP_cw: pc.dP, dP_rack: rk.dP,
    n_fwsA: S.units.fws.A.w * 100, n_fwsB: S.units.fws.B.w * 100, n_cwA: S.units.cw.A.w * 100, n_cwB: S.units.cw.B.w * 100, n_cduA: S.units.cdu.A.w * 100, n_cduB: S.units.cdu.B.w * 100,
    W_fws: pf.W_shaft, W_cw: pc.W_shaft,
    T_chip: K(rk.T_chip), T_sup: K(cdu.T_hot_out), T_ret: K(cdu.T_hot_in), T_fwsIn: K(cdu.T_cold_in), T_fwsOut: K(cdu.T_cold_out), T_ct: K(ct.T_out), T_cdin: K(ct.T_in),
    Q_cdu: cdu.Q, Q_chil: ch.Q_evap, W_comp: ch.W_comp, COP: ch.COP, Q_ct: ct.Q_rej, Q_ht: ht.Q_rej, T_ht: K(ht.T_out), Q_rack: (rk.Q_liquid || 0) * 4, throttle: rk.throttle_pct,
    eps_cdu: cdu.eps, flt_dP: T("flt").dP, m_leak: S.mLeak, leak_L: (S.leakKg || 0) / 1000 * 1, tank: 100 - ((S.leakKg || 0) / 1000) / (FX.cfg.tank_m3 || 0.5) * 100,
    T_air: K(T("crah1").T_in),
  };
}
function fxSample() {
  const t = wt.sim.time, sg = fxSig();
  if (!FX.tS.length) FX.t_first = t;
  FX.tS.push(t);
  for (const k of Object.keys(sg)) (FX.series[k] ??= []).push(sg[k]);
  if (FX.tS.length > 5000) { FX.tS.shift(); for (const k in FX.series) FX.series[k].shift(); }
  FX.listeners.forEach((f) => f("sample"));
}
/* ---------- hook into the solver loop ---------- */
(function fxHook() {
  const orig = K3.prototype.step;
  K3.prototype.step = function (e) {
    if (FX.hookOn) {
      if (!FX.S || FX.scene !== this.scene) { try { fxReset(true); } catch {} }
      try { fxControl(e); } catch (err) { console.warn("fx control", err); }
    }
    orig.call(this, e);
    if (FX.hookOn && FX.S) {
      try {
        const t = this.time;
        if (t - FX.lastSample >= FX.cfg.sample_s) { FX.lastSample = t; fxSample(); }
        fxMonitors();
      } catch (err) { console.warn("fx post", err); }
    }
  };
  FX.cfg.sample_s = 1;
  FX.hookOn = true;
})();
