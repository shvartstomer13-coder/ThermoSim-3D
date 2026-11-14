/** Physical-validity and safety checks: values that are impossible, or that would mean boiling, freezing, over-pressure (burst),
 *  cavitation, over-temperature (fire / burn-out) in a real plant. Shown in red with a warning sign. */
import { FLUIDS } from '../physics/fluidProperties';
import { GLYCOL30_DATA } from '../physics/data/glycol30';
import { PG25_DATA } from '../physics/data/pg25';
import { SPECS } from '../physics/components';
import type { CompInstance } from '../physics/engineTypes';
import { rt } from '../runtime';

export interface Warn { level: 'warn' | 'danger'; msg: string; param?: string; tele?: string }
const C = (K: number) => (K - 273.15).toFixed(1) + '°C';
const LIQ = new Set(['water', 'glycol30', 'pg25']);
const FREEZE: Record<string, number> = { water: 273.15, glycol30: GLYCOL30_DATA.Tfreeze, pg25: PG25_DATA.Tfreeze };
const STEAM_TYPES = new Set(['boiler', 'steam_turbine']);

/** design-pressure class [kPa abs] used for the burst / over-pressure check */
function pLimit(type: string, fluid: string, steamPlant: boolean): [number, string] {
  if (type === 'rack') return [650, 'דירוג הלוחות הקרים (~5.5 bar g)'];
  if (fluid === 'r134a') return [2600, 'לחץ התכן של מעגל R134a'];
  if (fluid === 'r410a') return [4600, 'לחץ התכן של מעגל R410A'];
  if (fluid === 'water' && steamPlant) return [16500, 'דירוג מעגל הקיטור'];
  return [1700, 'דירוג PN16'];
}
/** boiling point of a water-based coolant at pressure P [kPa] (glycol mixtures boil ~2–4 K higher; conservative) */
const tBoil = (P: number) => FLUIDS.water.Tsat(Math.max(P, 1));

export function checkComp(c: CompInstance): Warn[] {
  const t = rt.sim.telemetry.get(c.id); const spec = SPECS[c.type]; if (!spec || spec.arch) return [];
  const out: Warn[] = []; const add = (level: Warn['level'], msg: string, extra: Partial<Warn> = {}) => out.push({ level, msg, ...extra });
  const n = (k: string) => c.params[k] as number;
  const steamPlant = rt.sim.scene.comps.some((x) => STEAM_TYPES.has(x.type));
  const fluid = (c.params.fluid as string) ?? spec.defaultFluids[0];
  if (!t) return out;
  const g = (k: string) => (typeof t[k] === 'number' && Number.isFinite(t[k] as number) ? (t[k] as number) : undefined);

  // --- pressures: negative = not physical; above the design class = burst risk
  const [Plim, Pname] = pLimit(c.type, fluid, steamPlant);
  for (const k of ['P_in', 'P_out']) {
    const P = g(k); if (P === undefined) continue;
    if (P <= 0) { add('danger', `לחץ שלילי (${P.toFixed(0)} kPa) – ערך לא פיזיקלי`, { tele: k }); break; }
    if (P > Plim) { add('danger', `לחץ ${P.toFixed(0)} kPa מעל ${Pname} (${Plim} kPa) – סכנת פיצוץ`, { tele: k, param: c.type === 'exp_tank' ? 'p_set' : c.type === 'pump' ? 'H_rated' : undefined }); break; }
  }
  // --- liquid coolant: boiling / freezing
  const liquidService = LIQ.has(fluid) && !(fluid === 'water' && steamPlant);
  if (liquidService) {
    for (const [k, pk] of [['T_out', 'P_out'], ['T_in', 'P_in']] as const) {
      const T = g(k), P = g(pk) ?? g('P_in'); if (T === undefined || P === undefined) continue;
      const Tb = tBoil(P);
      if (T >= Tb - 0.5) { add('danger', `הנוזל רותח: ${C(T)} מעל נקודת הרתיחה (${C(Tb)} בלחץ ${P.toFixed(0)} kPa) – סכנת הבזקת אדים ולחץ יתר`, { tele: k }); break; }
      if (T > Tb - 8) { add('warn', `קרוב לרתיחה: ${C(T)} (רתיחה ב-${C(Tb)})`, { tele: k }); break; }
    }
    for (const k of ['T_in', 'T_out']) { const T = g(k); if (T !== undefined && T < (FREEZE[fluid] ?? 273.15) + 1) { add('danger', `סכנת קפיאה: ${C(T)} (נקודת קפאון ${C(FREEZE[fluid] ?? 273.15)})`, { tele: k }); break; } }
  }
  // --- cavitation at pump suction
  if ((c.type === 'pump' || c.type === 'cdu') && liquidService) {
    const P = g('P_in'), T = g('T_in') ?? g('T_hot_in');
    if (P !== undefined && T !== undefined) { const Pv = FLUIDS.water.Psat(T); if (P < Pv + 20) add('danger', `סכנת קוויטציה: לחץ היניקה ${P.toFixed(0)} kPa קרוב ללחץ האדים (${Pv.toFixed(1)} kPa)`, { tele: 'P_in' }); }
  }
  // --- flow
  const m = g('mdot'); if (m !== undefined && m < -1e-3) add('warn', 'זרימה הפוכה ברכיב', { tele: 'mdot' });
  const v = g('velocity');
  if (v !== undefined && LIQ.has(fluid) && c.type === 'pipe') {
    if (Math.abs(v) > 5) add('danger', `מהירות ${Math.abs(v).toFixed(1)} m/s – סכנת הלם מים ושחיקה; הגדילו קוטר`, { tele: 'velocity', param: 'D_mm' });
    else if (Math.abs(v) > 3) add('warn', `מהירות ${Math.abs(v).toFixed(1)} m/s גבוהה (מומלץ עד 3 m/s)`, { tele: 'velocity', param: 'D_mm' });
  }
  // --- component-specific limits
  switch (c.type) {
    case 'rack': {
      const Tc = g('T_chip'); if (Tc !== undefined) {
        if (Tc > 273.15 + 100) add('danger', `טמפ׳ שבב ${C(Tc)} – התחממות יתר, סכנת נזק לשבב`, { tele: 'T_chip' });
        else if (Tc > 273.15 + n('t_throttle')) add('warn', `השבב (${C(Tc)}) מעל סף הפחתת הביצועים (${n('t_throttle')}°C)`, { tele: 'T_chip', param: 'UA' });
      }
      if (m !== undefined && m < 0.25 * n('m_rated')) add('danger', 'ספיקת נוזל נמוכה מאוד לארון – סכנת התחממות יתר', { tele: 'mdot', param: 'm_rated' });
      break;
    }
    case 'boiler': {
      const Tw = g('T_wall'); if (Tw !== undefined && Tw > 273.15 + 600) add('danger', `טמפ׳ דופן ${C(Tw)} מעל גבול הפלדה – סכנת כשל צינורות ושריפה`, { tele: 'T_wall', param: 'q_kw' });
      if ((g('trip_pct') ?? 0) > 1) add('danger', 'הגנת טמפ׳ יתר הופעלה – הדוד מנתק דלק', { tele: 'trip_pct' });
      if (m !== undefined && m < 0.05 * n('m_d')) add('danger', 'חימום ללא זרימת מים – סכנת פיצוץ דוד', { param: 'q_kw' });
      break;
    }
    case 'air_compressor': {
      const Td = g('T_dis'); if (Td !== undefined) {
        if (Td > 273.15 + 200) add('danger', `טמפ׳ סניקה ${C(Td)} – מעל 200°C: סכנת הצתת אדי שמן ופיצוץ`, { tele: 'T_dis', param: 'pr' });
        else if (Td > 273.15 + 160) add('warn', `טמפ׳ סניקה ${C(Td)} גבוהה – שקלו דחיסה דו-דרגתית`, { tele: 'T_dis', param: 'pr' });
      }
      break;
    }
    case 'compressor_recip': case 'compressor_centrifugal': {
      const To = g('T_out'); if (To !== undefined) {
        if (To > 273.15 + 140) add('danger', `טמפ׳ סניקה ${C(To)} – פירוק שמן וקרר, סכנת שריפה`, { tele: 'T_out' });
        else if (To > 273.15 + 115) add('warn', `טמפ׳ סניקה ${C(To)} גבוהה`, { tele: 'T_out' });
      }
      const Ti = g('T_in'), Ts = g('T_sat_in'); if (Ti !== undefined && Ts !== undefined && Ts > 0 && Ti - Ts < 0.5) add('danger', 'נוזל נכנס למדחס (אין חימום-יתר) – סכנת פטיש נוזל', { tele: 'T_in' });
      break;
    }
    case 'steam_turbine': case 'gas_turbine': {
      const x = g('x_out'); if (c.type === 'steam_turbine' && x !== undefined && x < 0.88) add('warn', `לחות ${((1 - x) * 100).toFixed(0)}% ביציאה – שחיקת להבים (מומלץ x ≥ 0.88)`, { tele: 'x_out' });
      if (n('rpm') > 1.1 * n('rpm_d')) add('danger', 'מהירות יתר של הטורבינה – סכנת התפרקות', { param: 'rpm' });
      break;
    }
    case 'cooling_tower': { const a = g('approach'); if (a !== undefined && a < 1.5) add('warn', `Approach של ${a.toFixed(1)} K – כמעט לא אפשרי פיזיקלית`, { tele: 'approach' }); break; }
    case 'chiller': { const L = g('load_pct'); if (L !== undefined && L > 98) add('warn', 'הצ׳ילר בקיבולת מלאה – לא מגיע לטמפ׳ היעד', { tele: 'load_pct', param: 'cap_kw' }); break; }
    case 'cdu': {
      const Th = g('T_hot_in'); if (Th !== undefined && Th > tBoil(g('P_in') ?? 101)) add('danger', 'נוזל השרתים רותח בכניסה ל-CDU', { tele: 'T_hot_in' });
      break;
    }
    default: break;
  }
  return out;
}
export function warnCounts() {
  let d = 0, w = 0; for (const c of rt.sim.scene.comps) for (const x of checkComp(c)) x.level === 'danger' ? d++ : w++;
  return { d, w };
}
