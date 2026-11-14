/** Pre-built industrial scenes. Pipes are routed automatically; length/elevation/minor-loss are derived from the route. */
import type { CompInstance, Link, Params, PortRef } from './engineTypes';
import { defaultParams, SPECS } from './components';
import { updatePipeAuto } from './geometry';
import type { SceneData } from './physicsEngine';

export interface Template { id: string; name: string; desc: string; build(): SceneData; camera: [number, number, number]; target: [number, number, number] }

class Builder {
  comps: CompInstance[] = []; links: Link[] = [];
  add(type: string, id: string, name: string, pos: [number, number, number], rotY = 0, over: Params = {}): CompInstance {
    const c: CompInstance = { id, type, name, pos, rotY, params: { ...defaultParams(type), ...over } };
    this.comps.push(c); return c;
  }
  pipe(id: string, from: [string, string], to: [string, string], over: Params = {}) {
    const c: CompInstance = { id, type: 'pipe', name: 'צינור ' + id, pos: [0, 0, 0], rotY: 0, params: { ...defaultParams('pipe'), ...over },
      from: { comp: from[0], port: from[1] } as PortRef, to: { comp: to[0], port: to[1] } as PortRef };
    this.comps.push(c); return c;
  }
  refLine(id: string, a: [string, string], b: [string, string], D = 40) {
    this.comps.push({ id, type: 'pipe', name: 'קו מיכל', pos: [0, 0, 0], rotY: 0, params: { ...defaultParams('pipe'), D_mm: D }, from: { comp: a[0], port: a[1] }, to: { comp: b[0], port: b[1] } });
  }
  finish(amb = { T_C: 25, RH: 50, P: 101.325 }): SceneData {
    const map = new Map(this.comps.map((c) => [c.id, c]));
    for (const c of this.comps) if (c.type === 'pipe') updatePipeAuto(c, map);
    return { comps: this.comps, links: this.links, ambient: amb };
  }
}
void SPECS;

/* ---------- 1. AI data-center liquid cooling loop --------------------------------------------- */
/* Values from Tomer's final project (cooling-project/config/params.yaml):
 *  coolant PG25; 4 racks NVL72, rack_power_kW 120; 36 GB200 superchips × 2700 W per rack (97.2 kW through the cold plates);
 *  1.8 L/min per chip -> 36 × 1.8 = 64.8 L/min per rack (≈ 1.10 kg/s PG25 @ 25 °C); cold-plate R = 0.02 K/W per chip -> rack UA = 36/0.02 = 1.8 kW/K;
 *  chip inlet 25 °C; CDU temperature loss 2 K -> facility water supply 23 °C; external loop 574 L/min (≈ 9.53 kg/s water) in 4" Sch 40 (102.3 mm). */
const PRJ = { rackKW: 120, chipsPerRack: 36, chipW: 2700, Lmin_chip: 1.8, R_cp: 0.02, rhoPG25: 1017.2, chipIn_C: 25, cduLoss_K: 2, extLmin: 574, rhoW: 997, extD: 102.3 };
/* Standard design values used instead of two project inputs that made the chips overheat (87 °C, throttling):
 *  - coolant flow: rule of thumb ≈ 1.5 L/min per kW of liquid-cooled heat (ΔT ≈ 10 K for PG25) -> 1.5 × 97.2 ≈ 146 L/min per rack (project: 64.8);
 *  - cold-plate resistance per GB200 superchip ≈ 0.01 K/W (each superchip = 2 GPUs + 1 CPU, each with its own cold plate) (project: 0.02).
 *  All other values stay as in the project. */
/* Vendor data for GB200 NVL72 (HPE QuickSpecs / QCT): ~115 kW to liquid + ~17 kW to air at 132 kW full load -> 87 % liquid
 *  (cold plates on the superchips AND the NVLink-switch trays); coolant flow ≈ 130 L/min per rack. */
const STD = { liquidFrac: 0.87, rackLmin: 130, R_cp: 0.01 };
const liquidKW = PRJ.rackKW * STD.liquidFrac;
const rackFlow = (STD.rackLmin / 60000) * PRJ.rhoPG25; // kg/s
const extFlow = (PRJ.extLmin / 60000) * PRJ.rhoW; // kg/s
function dataCenter(): SceneData {
  const b = new Builder();
  const xs = [-1.35, -0.45, 0.45, 1.35];
  xs.forEach((x, i) => b.add('rack', `rack${i + 1}`, `ארון GPU ‏A${i + 1}`, [x, 0, 0], 0, { fluid: 'pg25', tdp_kw: PRJ.rackKW, util_pct: 100, d2c_frac: STD.liquidFrac, m_rated: +rackFlow.toFixed(3), UA: +(PRJ.chipsPerRack / STD.R_cp / 1000).toFixed(2) }));
  b.add('manifold_split', 'sh', 'מחלק אספקה (TCS)', [0, 3.2, -1.3], 0, { n: 4, D_mm: 100, fluid: 'pg25' });
  b.add('manifold_merge', 'rh', 'מאסף חזרה (TCS)', [0, 3.2, 1.3], Math.PI, { n: 4, D_mm: 100, fluid: 'pg25' });
  b.add('cdu', 'cdu', 'CDU-01', [-6.5, 0, 0], 0, { fluid: 'pg25', fluid2: 'water', m_rated: +(4 * rackFlow).toFixed(2), speed_pct: 71.0, H_rated: 30, UA: 190, m_p0: +extFlow.toFixed(2) });
  b.add('pump', 'p_fws', 'משאבת מים מתקניים', [-9, 0, 4.5], 0, { fluid: 'water', m_rated: +extFlow.toFixed(2), speed_pct: 80.6, H_rated: 20, hold_kg: 20 }); // speed tuned -> 574 L/min
  b.add('exp_tank', 'tank1', 'מיכל התפשטות', [-11, 0, 4.5], 0, { fluid: 'water', p_set: 300 });
  b.add('chiller', 'chiller', 'צ׳ילר CH-01', [-4, 0, 8], 0, { cap_kw: 600, t_set: PRJ.chipIn_C - PRJ.cduLoss_K, m_e0: +extFlow.toFixed(2) });
  b.add('pump', 'p_cw', 'משאבת מי מעבה', [1, 0, 10.5], 0, { fluid: 'water', m_rated: 12, H_rated: 20, hold_kg: 25 });
  b.add('cooling_tower', 'ct', 'מגדל קירור CT-01', [7, 0, 8], 0, { fan_kw: 7.5 }); // ≈ 1.5–2 % of the rejected heat
  xs.forEach((_, i) => {
    b.pipe(`pS${i + 1}`, ['sh', `out${i + 1}`], [`rack${i + 1}`, 'in'], { D_mm: 50, fluid: 'pg25' });
    b.pipe(`pR${i + 1}`, [`rack${i + 1}`, 'out'], ['rh', `in${4 - i}`], { D_mm: 50, fluid: 'pg25' });
  });
  b.pipe('pRet', ['rh', 'out'], ['cdu', 'sec_in'], { D_mm: 100, fluid: 'pg25' });
  b.pipe('pSup', ['cdu', 'sec_out'], ['sh', 'in'], { D_mm: 100, fluid: 'pg25' });
  b.pipe('pF1', ['cdu', 'pri_out'], ['chiller', 'chw_in'], { D_mm: PRJ.extD, fluid: 'water', ins_mm: 25 });
  b.pipe('pF2', ['chiller', 'chw_out'], ['p_fws', 'in'], { D_mm: PRJ.extD, fluid: 'water', ins_mm: 25 });
  b.pipe('pF3', ['p_fws', 'out'], ['cdu', 'pri_in'], { D_mm: PRJ.extD, fluid: 'water', ins_mm: 25 });
  b.refLine('tankLine', ['tank1', 'ref'], ['p_fws', 'in']);
  b.pipe('pC1', ['chiller', 'cw_out'], ['ct', 'in'], { D_mm: 125, fluid: 'water' });
  b.pipe('pC2', ['ct', 'out'], ['p_cw', 'in'], { D_mm: 125, fluid: 'water' });
  b.pipe('pC3', ['p_cw', 'out'], ['chiller', 'cw_in'], { D_mm: 125, fluid: 'water' });
  return b.finish();
}

/* ---------- 2. Steam Rankine power cycle -------------------------------------------------------- */
function rankine(): SceneData {
  const b = new Builder();
  b.add('boiler', 'boiler', 'דוד קיטור B-01', [-6, 0, 0], 0, { fluid: 'water', q_kw: 7000 });
  b.add('steam_turbine', 'turb', 'טורבינת קיטור ST-01', [-0.5, 0, 0], 0);
  b.add('condenser', 'cond', 'מעבה משטחי', [5, 0, 0], 0, { fluid: 'water', UA: 500, t_sink: 25, C_sink: 420, subcool: 0, m_d: 2, dp0: 1, hold_kg: 400 });
  b.add('pump', 'pump', 'משאבת הזנה לדוד', [5, 0, 4.5], 0, { fluid: 'water', mode: 'massflow', m_set: 2, eta_peak: 0.8, hold_kg: 5 });
  b.pipe('pSteam', ['boiler', 'out'], ['turb', 'in'], { D_mm: 100, fluid: 'water', ins_mm: 60 });
  b.pipe('pExh', ['turb', 'out'], ['cond', 'in'], { D_mm: 900, wall_mm: 10, fluid: 'water', K: 0.5 });
  b.pipe('pCond', ['cond', 'out'], ['pump', 'in'], { D_mm: 50, fluid: 'water' });
  b.pipe('pFeed', ['pump', 'out'], ['boiler', 'in'], { D_mm: 40, fluid: 'water', ins_mm: 30 });
  return b.finish();
}

/* ---------- 3. Industrial vapour-compression chiller loop (R134a) ------------------------------- */
function vcc(): SceneData {
  const b = new Builder();
  b.add('compressor_recip', 'comp', 'מדחס בוכנה', [-3, 0, 0], 0, { fluid: 'r134a', Vdisp: 170, eta_is: 0.72 });
  b.add('condenser', 'cond', 'מעבה', [3, 0, -3], 0, { fluid: 'r134a', UA: 15, t_sink: 30, C_sink: 8, m_d: 0.7, dp0: 10 });
  b.add('expansion_valve', 'txv', 'שסתום התפשטות תרמוסטטי', [7, 0, 0.5], 0, { fluid: 'r134a', d_mm: 9, open_pct: 50, mode: 'txv', sh_target: 6 });
  b.add('evaporator', 'evap', 'מאייד (מים מקוררים)', [3, 0, 4], 0, { fluid: 'r134a', UA: 25, t_src: 12, C_src: 10, m_d: 0.7, dp0: 10 });
  b.pipe('pDis', ['comp', 'out'], ['cond', 'in'], { D_mm: 40, fluid: 'r134a', ins_mm: 0 });
  b.pipe('pLiq', ['cond', 'out'], ['txv', 'in'], { D_mm: 25, fluid: 'r134a' });
  b.pipe('pTwo', ['txv', 'out'], ['evap', 'in'], { D_mm: 32, fluid: 'r134a', ins_mm: 20 });
  b.pipe('pSuc', ['evap', 'out'], ['comp', 'in'], { D_mm: 50, fluid: 'r134a', ins_mm: 20 });
  return b.finish();
}

export const TEMPLATES: Template[] = [
  { id: 'dc', name: 'לולאת קירור נוזלי למרכז נתונים AI', desc: '4 ארונות GB200 NVL72 (120 kW, ‏87% לנוזל, 130 L/min, PG25, 25°C) ← CDU ← צ׳ילר ← מגדל קירור. נתוני פרויקט הגמר + ספיקה והתנגדות פלטה סטנדרטיות.', build: dataCenter, camera: [13, 11, 24], target: [-2, 1.2, 4] },
  { id: 'rankine', name: 'מחזור כוח קיטורי (רנקין)', desc: 'דוד ← טורבינת קיטור ← מעבה ← משאבת הזנה (תכונות קיטור IAPWS-95).', build: rankine, camera: [5, 9, 16], target: [0, 1.5, 1.5] },
  { id: 'vcc', name: 'צ׳ילר תעשייתי בדחיסת אדים', desc: 'מדחס בוכנה ← מעבה ← TXV ← מאייד (R134a).', build: vcc, camera: [9, 8, 15], target: [2, 0.8, 1.2] },
];
export const emptyScene = (): SceneData => ({ comps: [], links: [], ambient: { T_C: 25, RH: 50, P: 101.325 } });
