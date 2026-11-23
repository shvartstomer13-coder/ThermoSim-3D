/* Opening scene built from config/params.yaml (cooling-project). Every number below
   is either a params.yaml value (key in the comment) or derived from them in code. */
const PRJ = {
  chip_power_W: 2700, // chip.power_W
  gpu_count: 2, // chip.gpu_count
  gpu_power_W: 1200, // chip.gpu_power_W
  cpu_power_W: 300, // chip.cpu_power_W
  R_plate_K_W: 0.02, // cold_plate.gpu_thermal_resistance_K_W (= cpu)
  chip_flow_L_min: 1.8, // pipe_to_chip.flow.V_dot(L_min)
  chip_inlet_C: 25, // temperatures.chip_inlet_C
  cdu_loss_K: 2, // cdu.temp_loss_K
  cdu_dP_kPa: 140, // cdu.primary_dP_kPa
  cdu_dP_at_L_min: 574, // cdu.primary_dP_at_L_min
  ext_flow_L_min: 574, // external_loop.flow_L_min
  wet_bulb_C: 27, // external_loop.design_wet_bulb_C
  dry_bulb_C: 37, // comment of A16 (Tamar summer peak)
  tower_approach_K: 4, // external_loop.tower_approach_K
  tower_dP_kPa: 80, // external_loop.tower_dP_kPa
  ext_pipe_ID_mm: 90, // external_loop.pipe_diameter_mm
  ext_pipe_wall_mm: 10, // DN100 PP-R SDR11: 110/11
  room_T_C: 25, // room_air.T_C
  room_RH: 0.6, // room_air.max_relative_humidity
  rack_count: 4, // rack_count
  rack_power_kW: 120, // rack_power_kW
  trays_per_rack: 18, // rack_layout.compute_trays_per_rack (A19)
  chips_per_tray: 2, // rack_layout.superchips_per_tray (A19)
  chips_per_rack: 36, // 72 GPUs / 2 per superchip (rack_count comment)
  pump_efficiency: 0.65, // pump_efficiency
  raised_floor_m: 0.6, // room.raised_floor_m (A18)
  hot_aisle_C: 40, // room.crah_return_air_C (A18)
  // UPS – added to params.yaml on 2026-11-21 (assumptions A20)
  ups_rating_kW: 600, // ups.rating_kW
  ups_module_kW: 150, // ups.module_kW
  ups_modules: 5, // ups.modules_installed (N+1)
  ups_eta_pct: 96.5, // ups.efficiency_pct
  ups_batt_kWh: 80, // ups.battery_usable_kWh
  // trim chiller – added to params.yaml on 2026-11-21 (assumptions A17)
  chiller_capacity_kW: 400, // trim_chiller.capacity_kW
  chiller_evap_dP_kPa: 50, // trim_chiller.evap_dP_kPa
  chiller_eta2: 0.55, // trim_chiller.carnot_fraction
  cond_flow_kg_s: 17.4, // trim_chiller.condenser_flow_kg_s
};
const NXL = R1_LAYOUT;
function ZM() {
  const i = new O6(),
    P0 = 300,
    pg = e9("pg25"),
    wa = e9("water"),
    rhoPG = pg.rho(P0, pg.hPT(P0, Hs(PRJ.chip_inlet_C))),
    rhoW = wa.rho(P0, wa.hPT(P0, Hs(PRJ.wet_bulb_C + PRJ.tower_approach_K))),
    Qliq = (PRJ.chips_per_rack * PRJ.chip_power_W) / 1e3, // 97.2 kW per rack to liquid
    mRack = (PRJ.chips_per_rack * PRJ.chip_flow_L_min * rhoPG) / 6e4, // kg/s
    cpPG = pg.cp(P0, pg.hPT(P0, Hs(PRJ.chip_inlet_C + 11))),
    cpW = wa.cp(P0, wa.hPT(P0, Hs(28))),
    dTr = Qliq / (mRack * cpPG),
    dTdie = PRJ.gpu_power_W * PRJ.R_plate_K_W,
    UArack = Math.log((dTr + dTdie) / dTdie) * mRack * cpPG, // lumped wall reproduces T_die = T_out + P·R
    mSec = PRJ.rack_count * mRack,
    mFac = (PRJ.ext_flow_L_min * rhoW) / 6e4,
    Qair = PRJ.rack_count * (PRJ.rack_power_kW - Qliq), // 91.2 kW left in the room air
    mCdu = (mFac * PRJ.rack_count * Qliq) / (PRJ.rack_count * PRJ.rack_power_kW), // equal ΔT in both branches
    mCrah = mFac - mCdu,
    Cs = mSec * cpPG,
    Cp = mCdu * cpW,
    Cmin = Math.min(Cs, Cp),
    Cr = Cmin / Math.max(Cs, Cp),
    Qtot = PRJ.rack_count * Qliq,
    eps = Qtot / (Cmin * (PRJ.chip_inlet_C + Qtot / Cs - (PRJ.chip_inlet_C - PRJ.cdu_loss_K))),
    NTU = Math.log((1 - eps * Cr) / (1 - eps)) / (1 - Cr),
    UAcdu = NTU * Cmin,
    Ca = Qair / (PRJ.hot_aisle_C - PRJ.room_T_C), // air capacity rate: hot aisle -> room supply
    Cw2 = mCrah * cpW,
    Cmn2 = Math.min(Ca, Cw2),
    Cr2 = Cmn2 / Math.max(Ca, Cw2),
    eps2 = Qair / (Cmn2 * (PRJ.hot_aisle_C - (PRJ.chip_inlet_C - PRJ.cdu_loss_K))),
    UAcrah = (Math.log((1 - eps2 * Cr2) / (1 - eps2)) / (1 - Cr2)) * Cmn2,
    F = PRJ.raised_floor_m,
    xs = [-1.35, -0.45, 0.45, 1.35],
    fac = { D_mm: PRJ.ext_pipe_ID_mm, wall_mm: PRJ.ext_pipe_wall_mm, material: "ppr", fluid: "water" };
  return (
    xs.forEach((t, n) =>
      i.add("rack", `rack${n + 1}`, `ארון GPU ‏A${n + 1}`, [t, F, NXL.rackZ], 0, {
        fluid: "pg25",
        tdp_kw: PRJ.rack_power_kW,
        util_pct: 100,
        d2c_frac: +(Qliq / PRJ.rack_power_kW).toFixed(3),
        m_rated: +mRack.toFixed(4),
        UA: +UArack.toFixed(3),
        n_trays: PRJ.trays_per_rack,
        chips_per_tray: PRJ.chips_per_tray,
        gpu_n: PRJ.gpu_count,
        gpu_w: PRJ.gpu_power_W,
        cpu_w: PRJ.cpu_power_W,
      }),
    ),
    i.add("manifold_split", "sh", "מחלק אספקה (TCS)", NXL.sh[0], NXL.sh[1], { n: 4, D_mm: 100, fluid: "pg25" }),
    i.add("manifold_merge", "rh", "מאסף חזרה (TCS)", NXL.rh[0], NXL.rh[1], { n: 4, D_mm: 100, fluid: "pg25" }),
    i.add("fine_filter", "flt", "מסנן 50 מיקרון", NXL.flt[0], NXL.flt[1], {
      fluid: "pg25",
      D_mm: 80,
      m_rated: +mSec.toFixed(3),
    }),
    i.add("air_separator", "asep", "מפריד אוויר", NXL.asep[0], NXL.asep[1], {
      fluid: "pg25",
      D_mm: 80,
      m_rated: +mSec.toFixed(3),
    }),
    i.add("cdu", "cdu", "CDU-01 ‏(Vertiv CoolChip 600)", NXL.cdu[0], NXL.cdu[1], {
      fluid: "pg25",
      fluid2: "water",
      m_rated: +mSec.toFixed(3),
      speed_pct: 72.3, // tuned so the secondary flow = 4 × 36 × 1.8 L/min
      H_rated: 30,
      UA: +UAcdu.toFixed(2),
      m_p0: +((PRJ.cdu_dP_at_L_min * rhoW) / 6e4).toFixed(3),
      dp_p0: PRJ.cdu_dP_kPa, // read at 574 L/min; the model rescales it to the branch flow
    }),
    i.add("hybrid_tower", "htw", "מגדל היברידי סגור HT-01", NXL.htw[0], NXL.htw[1], {
      fluid: "water",
      mode: "wet",
      wb_src: "fixed",
      t_wb: PRJ.wet_bulb_C,
      t_db: PRJ.dry_bulb_C,
      thermal: "approach",
      approach_wet: PRJ.tower_approach_K,
      m_d: +mFac.toFixed(3),
      dp0: PRJ.tower_dP_kPa,
    }),
    i.add("ups", "ups1", "UPS-01 ‏(N+1, 600 kW)", NXL.ups[0], NXL.ups[1], {
      rating_kw: PRJ.ups_rating_kW,
      module_kw: PRJ.ups_module_kW,
      modules: PRJ.ups_modules,
      eta_pct: PRJ.ups_eta_pct,
      batt_kwh: PRJ.ups_batt_kWh,
    }),
    i.add("room", "room1", "חדר שרתים AI", NXL.room[0], NXL.room[1], {
      W: 13.6,
      D: 8.4,
      H: 4.8,
      rf: F,
      ceil: !0,
      ch: 4.4,
      door_side: "front",
      // cold aisle: two rows of perforated tiles in front of the rack fronts (rack span in room-local X)
      ca_rows: 2,
      ca_x0: -1.75 - NXL.room[0][0],
      ca_x1: 1.75 - NXL.room[0][0],
      ca_z: 0.625 - NXL.room[0][2],
      door_w: 1.6,
    }),
    i.add("crah", "crah1", "CRAH-01 (מים חמים)", NXL.crah1[0], NXL.crah1[1], {
      fluid: "water",
      t_air: PRJ.hot_aisle_C,
      C_air: +Ca.toFixed(3),
      UA: +UAcrah.toFixed(2),
      fan_kw: 5.5,
      m_d: +mCrah.toFixed(3),
      dp0: 35,
    }),
    i.add("balancing_valve", "bv_crah", "שסתום איזון CRAH", NXL.bv_crah[0], NXL.bv_crah[1], {
      fluid: "water",
      D_mm: 50,
      Kvs: 16,
      turns: 4.4,
    }),
    i.add("manifold_split", "fsp", "מחלק מי מתקן", NXL.fsp[0], NXL.fsp[1], { n: 2, D_mm: 100, fluid: "water" }),
    i.add("manifold_merge", "fmg", "מאסף מי מתקן", NXL.fmg[0], NXL.fmg[1], { n: 2, D_mm: 100, fluid: "water" }),
    i.add("chiller", "chiller", "צ׳ילר עזר CH-01 (בטור)", NXL.chiller[0], NXL.chiller[1], {
      cap_kw: PRJ.chiller_capacity_kW,
      t_set: PRJ.chip_inlet_C - PRJ.cdu_loss_K,
      eta2: PRJ.chiller_eta2,
      m_e0: +mFac.toFixed(3),
      dp_e0: PRJ.chiller_evap_dP_kPa,
      m_c0: PRJ.cond_flow_kg_s,
    }),
    i.add("pump", "p_fws", "משאבת מי מתקן", NXL.p_fws[0], NXL.p_fws[1], {
      fluid: "water",
      m_rated: +mFac.toFixed(3),
      speed_pct: 94.6, // tuned so the facility flow = 574 L/min
      H_rated: 32,
      eta_peak: PRJ.pump_efficiency,
      hold_kg: 20,
    }),
    i.add("exp_tank", "tank1", "מיכל התפשטות", NXL.tank1[0], NXL.tank1[1], { fluid: "water", p_set: 300 }),
    i.add("pump", "p_cw", "משאבת מי מעבה", NXL.p_cw[0], NXL.p_cw[1], {
      fluid: "water",
      m_rated: PRJ.cond_flow_kg_s,
      speed_pct: 91,
      H_rated: 20,
      hold_kg: 25,
    }),
    i.add("cooling_tower", "ct", "מגדל קירור למי המעבה CT-02", NXL.ct[0], NXL.ct[1], {
      fan_kw: 7.5,
      m_d: PRJ.cond_flow_kg_s,
      wb_src: "fixed",
      t_wb: PRJ.wet_bulb_C,
    }),
    xs.forEach((t, n) => {
      (i.pipe(`pS${n + 1}`, ["sh", `out${n + 1}`], [`rack${n + 1}`, "in"], { D_mm: 50, fluid: "pg25" }),
        i.pipe(`pR${n + 1}`, [`rack${n + 1}`, "out"], ["rh", `in${4 - n}`], { D_mm: 50, fluid: "pg25" }));
    }),
    i.pipe("pRet", ["rh", "out"], ["asep", "in"], { D_mm: 100, fluid: "pg25" }),
    i.pipe("pRet2", ["asep", "out"], ["cdu", "sec_in"], { D_mm: 100, fluid: "pg25" }),
    i.pipe("pSup", ["cdu", "sec_out"], ["flt", "in"], { D_mm: 100, fluid: "pg25" }),
    i.pipe("pSup2", ["flt", "out"], ["sh", "in"], { D_mm: 100, fluid: "pg25" }),
    i.pipe("pF1", ["cdu", "pri_out"], ["fmg", "in1"], fac),
    i.pipe("pF1b", ["fmg", "out"], ["htw", "in"], fac),
    i.pipe("pA1", ["fsp", "out2"], ["bv_crah", "in"], { ...fac, D_mm: 50, wall_mm: 4.6 }),
    i.pipe("pA2", ["bv_crah", "out"], ["crah1", "in"], { ...fac, D_mm: 50, wall_mm: 4.6 }),
    i.pipe("pA3", ["crah1", "out"], ["fmg", "in2"], { ...fac, D_mm: 50, wall_mm: 4.6 }),
    i.pipe("pF2", ["htw", "out"], ["chiller", "chw_in"], fac),
    i.pipe("pF3", ["chiller", "chw_out"], ["p_fws", "in"], fac),
    i.pipe("pF4", ["p_fws", "out"], ["fsp", "in"], fac),
    i.pipe("pF5", ["fsp", "out1"], ["cdu", "pri_in"], fac),
    i.refLine("tankLine", ["tank1", "ref"], ["p_fws", "in"]),
    i.pipe("pC1", ["chiller", "cw_out"], ["ct", "in"], { D_mm: 125, fluid: "water" }),
    i.pipe("pC2", ["ct", "out"], ["p_cw", "in"], { D_mm: 125, fluid: "water" }),
    i.pipe("pC3", ["p_cw", "out"], ["chiller", "cw_in"], { D_mm: 125, fluid: "water" }),
    i.comps.forEach((c) => {
      const o = c.type === "pipe" && R1_PIPE[c.id];
      o && (o.via && (c.via = o.via), Object.assign(c.params, o.p ?? {}));
    }),
    i.finish({ T_C: PRJ.room_T_C, RH: PRJ.room_RH * 100, P: 101.325 })
  );
}
