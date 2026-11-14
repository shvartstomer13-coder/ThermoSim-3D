import { fmtT, type TempUnit } from '../render/ThermalShader';

type Meta = [label: string, unit: string, digits: number];
const M: Record<string, Meta> = {
  mdot: ['ספיקת מסה', 'kg/s', 3], mdot_cold: ['ספיקת מסה (צד שני)', 'kg/s', 3], P_in: ['לחץ כניסה', 'kPa', 1], P_out: ['לחץ יציאה', 'kPa', 1], dP: ['מפל לחץ', 'kPa', 2],
  velocity: ['מהירות זרימה', 'm/s', 2], Re: ['מספר ריינולדס', '', 0], f_darcy: ['מקדם חיכוך דארסי', '', 4], Q_loss: ['איבוד חום לסביבה', 'kW', 2], x_out: ['איכות אדים (יציאה)', '', 3],
  rho: ['צפיפות', 'kg/m³', 1], flow_m3h: ['ספיקה נפחית', 'm³/h', 1], Q: ['הספק חום', 'kW', 1], eps: ['אפקטיביות ε', '', 3], NTU: ['NTU', '', 2], W_shaft: ['הספק פיר', 'kW', 1],
  W_hyd: ['הספק הידראולי', 'kW', 2], W_elec: ['הספק חשמלי', 'kW', 1], W_comp: ['הספק מדחס', 'kW', 1], eta: ['נצילות η', '', 3], speed: ['מהירות', '%', 1], head_m: ['גובה הרמה', 'm', 1],
  approach: ['Approach', 'K', 2], range: ['Range', 'K', 2], fan_kw: ['הספק מאוורר', 'kW', 2], makeup_kgs: ['מי השלמה', 'kg/s', 3], Q_rej: ['חום נפלט', 'kW', 1], Q_evap: ['הספק מאייד', 'kW', 1], Q_cond: ['הספק מעבה', 'kW', 1],
  COP: ['COP', '', 2], load_pct: ['עומס צ׳ילר', '%', 0], superheat: ['חימום-יתר', 'K', 2], subcooling: ['קירור-יתר', 'K', 2], throttle_pct: ['הפחתת ביצועים', '%', 0], UA_eff: ['UA אפקטיבי', 'kW/K', 2],
  Q_chip: ['חום שבבים', 'kW', 1], Q_air: ['חום לאוויר החדר', 'kW', 2], Q_liquid: ['חום לנוזל', 'kW', 1], Q_fluid: ['חום לזורם', 'kW', 1], Q_fuel: ['הספק דלק', 'kW', 1], trip_pct: ['ניתוק טמפ׳ יתר', '%', 0],
  PR: ['יחס לחצים', '', 2], rpm: ['מהירות רוטור', 'rpm', 0], freq_Hz: ['תדר רשת', 'Hz', 2], vol_flow_m3h: ['ספיקה נפחית ביניקה', 'm³/h', 1], discharge_superheat: ['חימום-יתר בסניקה', 'K', 1],
  opening: ['פתיחה', '%', 1], Kv_eff: ['Kv אפקטיבי', 'm³/h', 1], phase: ['פאזה', '', 0],
};
const T_LABEL: Record<string, string> = {
  T_in: 'טמפ׳ כניסה', T_out: 'טמפ׳ יציאה', T_surf: 'טמפ׳ פני שטח', T_chip: 'טמפ׳ שבב', T_wall: 'טמפ׳ דופן', T_sat: 'טמפ׳ רוויה', T_cond: 'טמפ׳ עיבוי', T_evap: 'טמפ׳ אידוי',
  T_hot_in: 'צד 1 – כניסה', T_hot_out: 'צד 1 – יציאה', T_cold_in: 'צד 2 – כניסה', T_cold_out: 'צד 2 – יציאה', T_wb: 'טמפ׳ לחה', T_sink_out: 'יציאת מקור קירור', T_src_out: 'יציאת מקור חום', T_sat_in: 'רוויה (יניקה)', T_sat_out: 'רוויה (סניקה)', T_dis: 'טמפ׳ סניקה (לפני מקרר)', T_air_out: 'טמפ׳ אוויר יוצא',
};
const PHASE: Record<string, string> = { liquid: 'נוזל', vapor: 'אדים', vapour: 'אדים', 'two-phase': 'דו-פאזי', twophase: 'דו-פאזי', supercritical: 'על-קריטי', gas: 'גז' };
export function fmtKey(key: string, v: number | string, unit: TempUnit): { label: string; value: string } {
  if (typeof v === 'string') return { label: M[key]?.[0] ?? key, value: PHASE[v.toLowerCase()] ?? v };
  if (key.startsWith('T_') && !(key in M)) {
    if (key.startsWith('T_br')) return { label: 'טמפ׳ ענף ' + key.slice(4), value: fmtT(v, unit, 2) };
    return { label: T_LABEL[key] ?? key, value: fmtT(v, unit, 2) };
  }
  if (key.startsWith('m_br')) return { label: 'ספיקת ענף ' + key.slice(4), value: v.toFixed(3) + ' kg/s' };
  const m = M[key]; if (!m) return { label: key, value: Number.isFinite(v) ? v.toPrecision(4) : '—' };
  const x = key === 'eta' ? v : v; return { label: m[0], value: (Number.isFinite(x) ? x.toFixed(m[2]) : '—') + (m[1] ? ' ' + m[1] : '') };
}
export const HEADLINE = ['T_in', 'T_out', 'P_in', 'P_out', 'velocity', 'Re', 'eta', 'COP', 'Q', 'Q_evap', 'Q_cond', 'Q_chip', 'Q_fluid', 'Q_rej', 'W_shaft', 'mdot'];
export const SERIES_PREF = ['T_in', 'T_out', 'T_chip', 'T_wall', 'T_cond', 'T_evap', 'mdot', 'Q', 'Q_evap', 'Q_cond', 'Q_chip', 'Q_fluid', 'Q_rej', 'W_shaft', 'COP', 'P_in', 'dP', 'eta', 'approach', 'superheat'];
export const seriesValue = (key: string, v: number, unit: TempUnit) => (key.startsWith('T_') ? (unit === 'C' ? v - 273.15 : v) : v);
