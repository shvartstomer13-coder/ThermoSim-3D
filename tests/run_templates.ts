import { TEMPLATES } from '../src/physics/templates';
import { Simulation } from '../src/physics/physicsEngine';

const which = process.argv[2];
const f = (v: unknown) => (typeof v === 'number' ? (Math.abs(v) >= 1000 ? v.toFixed(0) : v.toFixed(3)) : String(v));
for (const t of TEMPLATES) {
  if (which && t.id !== which) continue;
  const t0 = performance.now();
  const scene = t.build();
  const sim = new Simulation(scene);
  const t1 = performance.now();
  console.log(`\n=== ${t.name} === build+steady ${(t1 - t0).toFixed(0)} ms  systems=${sim.compiled.systems.length} converged=${sim.converged} resid=${sim.worstResidual.toExponential(1)} iters=${sim.iterations}`);
  for (const i of sim.compiled.issues) console.log('  ISSUE', i.comp, i.port ?? '', i.msg);
  for (const c of scene.comps) {
    if (c.type === 'pipe' && !which) continue;
    const tel = sim.telemetry.get(c.id); if (!tel) continue;
    const pick = Object.entries(tel).filter(([k]) => !['phase'].includes(k)).slice(0, 14).map(([k, v]) => `${k}=${f(v)}`).join(' ');
    console.log(' ', c.id.padEnd(8), pick);
  }
  // transient: 60 s of simulated time at 1 s steps, timing
  const t2 = performance.now();
  for (let i = 0; i < 60; i++) sim.step(1);
  console.log(`  60 transient steps: ${((performance.now() - t2) / 60).toFixed(1)} ms/step, converged=${sim.converged}, resid=${sim.worstResidual.toExponential(1)}, maxIter=${sim.iterations}`);
}
