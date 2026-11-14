import { Simulation } from '../src/physics/physicsEngine';
import { emptyScene } from '../src/physics/templates';
import { defaultParams } from '../src/physics/components';
import type { CompInstance } from '../src/physics/engineTypes';
const C = (type: string, id: string, over: Record<string, unknown> = {}): CompInstance => ({ id, type, name: id, pos: [0, 0, 0], rotY: 0, params: { ...defaultParams(type), ...over } as never });
const L = (a: string, pa: string, b: string, pb: string) => ({ a: { comp: a, port: pa }, b: { comp: b, port: pb } });
function run(name: string, comps: CompInstance[], links: ReturnType<typeof L>[], keys: string[]) {
  const sc = emptyScene(); sc.comps = comps; sc.links = links;
  const sim = new Simulation(sc); for (let i = 0; i < 600; i++) sim.step(1);
  const out: string[] = [];
  for (const k of keys) { const [id, f] = k.split('.'); const v = sim.telemetry.get(id)?.[f]; out.push(`${k}=${typeof v === 'number' ? (f.startsWith('T_') ? (v - 273.15).toFixed(2) + 'C' : v.toFixed(3)) : v}`); }
  console.log(name, sim.converged ? 'CONVERGED' : 'NOT', 'issues', sim.compiled.issues.length, sim.compiled.issues.map((i) => i.msg).join(';'), '\n   ', out.join('  '));
}
// 1: rack -> dry cooler -> buffer -> strainer -> check valve -> pump -> rack
run('dry cooler loop', [C('rack', 'r', { tdp_kw: 80 }), C('dry_cooler', 'dc', { fluid: 'glycol30' }), C('buffer_tank', 'bt', { fluid: 'glycol30' }), C('strainer', 'st'), C('check_valve', 'cv'), C('pump', 'p'), C('exp_tank', 'x')],
  [L('r', 'out', 'dc', 'in'), L('dc', 'out', 'bt', 'in'), L('bt', 'out', 'st', 'in'), L('st', 'out', 'cv', 'in'), L('cv', 'out', 'p', 'in'), L('p', 'out', 'r', 'in'), L('x', 'ref', 'p', 'in')],
  ['r.T_chip', 'r.mdot', 'dc.Q_rej', 'dc.T_out', 'dc.approach', 'bt.T_out', 'st.dP', 'cv.dP']);
// 2: CRAH -> shell&tube (hot) ; tube side with dry cooler
run('crah + shell-tube', [C('crah', 'ah'), C('shell_tube_hx', 'hx'), C('pump', 'p1', { fluid: 'water' }), C('exp_tank', 'x1', { fluid: 'water' }), C('dry_cooler', 'dc', { fluid: 'water' }), C('pump', 'p2', { fluid: 'water' }), C('exp_tank', 'x2', { fluid: 'water' })],
  [L('ah', 'out', 'hx', 'hot_in'), L('hx', 'hot_out', 'p1', 'in'), L('p1', 'out', 'ah', 'in'), L('x1', 'ref', 'p1', 'in'),
   L('hx', 'cold_out', 'dc', 'in'), L('dc', 'out', 'p2', 'in'), L('p2', 'out', 'hx', 'cold_in'), L('x2', 'ref', 'p2', 'in')],
  ['ah.Q', 'ah.T_src_out', 'hx.Q', 'hx.T_hot_in', 'hx.T_cold_out', 'dc.Q_rej']);
// 3: air compressor -> valve -> back (suction held at 101 kPa)
run('air compressor', [C('air_compressor', 'ac'), C('valve', 'v', { fluid: 'air', open_pct: 40, Kv: 10 }), C('exp_tank', 'x', { fluid: 'air', p_set: 101.325 })],
  [L('ac', 'out', 'v', 'in'), L('v', 'out', 'ac', 'in'), L('x', 'ref', 'ac', 'in')], ['ac.mdot', 'ac.P_out', 'ac.T_out', 'ac.T_dis', 'ac.W_shaft', 'ac.Q_rej', 'ac.PR']);
