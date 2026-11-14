import { TEMPLATES } from '../src/physics/templates';
import { Simulation } from '../src/physics/physicsEngine';
const t = (id: string) => TEMPLATES.find((x) => x.id === id)!;
// --- DC: load step, pump slow-down, tower fan stop
{
  const scene = t('dc').build(); const sim = new Simulation(scene);
  const rk = (n: number) => sim.telemetry.get('rack' + n)!;
  const log = (tag: string) => console.log(tag.padEnd(26), 't=' + sim.time.toFixed(0).padStart(5), 'chip', ((rk(1).T_chip as number) - 273.15).toFixed(1), 'rackOut', ((rk(1).T_out as number) - 273.15).toFixed(1),
    'CT_in', ((sim.telemetry.get('ct')!.T_in as number) - 273.15).toFixed(1), 'CT_out', ((sim.telemetry.get('ct')!.T_out as number) - 273.15).toFixed(1), 'Qevap', (sim.telemetry.get('chiller')!.Q_evap as number).toFixed(0), 'COP', (sim.telemetry.get('chiller')!.COP as number).toFixed(2),
    'conv', sim.converged, 'it', sim.iterations);
  log('steady');
  let t0 = performance.now(), n = 0;
  for (const c of scene.comps) if (c.type === 'rack') c.params.util_pct = 100;
  for (let i = 0; i < 300; i++) { sim.step(2); n++; if (i % 50 === 49) log('util->100%'); }
  console.log('avg step ms', ((performance.now() - t0) / n).toFixed(2));
  for (const c of scene.comps) if (c.id === 'cdu') c.params.speed_pct = 40;
  for (let i = 0; i < 300; i++) { sim.step(2); if (i % 100 === 99) log('CDU pump 40%'); }
  for (const c of scene.comps) if (c.id === 'ct') c.params.fan_pct = 0;
  for (let i = 0; i < 300; i++) { sim.step(2); if (i % 100 === 99) log('tower fan 0%'); }
  for (const c of scene.comps) if (c.type === 'rack') c.params.tdp_kw = 300;
  for (let i = 0; i < 400; i++) { sim.step(2); if (i % 100 === 99) log('300 kW racks (throttle)'); }
  console.log('throttle %', rk(1).throttle_pct);
}
// --- cold start of Rankine
{
  const scene = t('rankine').build(); const sim = new Simulation(scene); sim.coldStart();
  for (let i = 0; i <= 600; i++) { if (i % 100 === 0) { const b = sim.telemetry.get('boiler')!, tb = sim.telemetry.get('turb')!; console.log('rankine cold t=' + sim.time.toFixed(0), 'Tout', ((b.T_out as number) - 273.15).toFixed(0), 'P', (b.P_out as number).toFixed(0), 'W', (tb.W_shaft as number).toFixed(0), 'conv', sim.converged, 'it', sim.iterations); } sim.step(1); }
}
// --- VCC: TXV settle and load change
{
  const scene = t('vcc').build(); const sim = new Simulation(scene);
  const ev = () => sim.telemetry.get('evap')!, cp = () => sim.telemetry.get('comp')!, cd = () => sim.telemetry.get('cond')!;
  const log = (tag: string) => console.log(tag.padEnd(14), 't=' + sim.time.toFixed(0).padStart(5), 'SH', (ev().superheat as number).toFixed(1), 'x', (ev().x_out as number).toFixed(2), 'Qe', (ev().Q_evap as number).toFixed(1), 'W', (cp().W_shaft as number).toFixed(1), 'Tcond', ((cd().T_cond as number) - 273.15).toFixed(1), 'Tevap', ((ev().T_evap as number) - 273.15).toFixed(1), 'open', (scene.comps.find((c) => c.id === 'txv')!.params.open_pct as number).toFixed(1), 'conv', sim.converged);
  log('steady');
  scene.comps.find((c) => c.id === 'evap')!.params.t_src = 20;
  for (let i = 0; i < 300; i++) { sim.step(1); if (i % 60 === 59) log('src 20C'); }
}
