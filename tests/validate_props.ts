import { readFileSync } from 'node:fs';
import { getFluid } from '../src/physics/fluidProperties';
const ref = JSON.parse(readFileSync(new URL('./ref_points.json', import.meta.url), 'utf8'));
let worst: Record<string, number> = {};
const rec = (k: string, e: number) => { worst[k] = Math.max(worst[k] ?? 0, Math.abs(e)); };
const rel = (a: number, b: number) => (a - b) / Math.abs(b);
const W = getFluid('water'), R = getFluid('r134a'), Q = getFluid('r410a');

// 1) PUBLISHED literature points ------------------------------------------------------------
const lit: [string, number, number, string][] = [];
const chk = (name: string, got: number, exp: number, tol: number) => {
  const ok = Math.abs(got - exp) <= tol; lit.push([name, got, exp, ok ? 'OK' : 'FAIL']);
};
// Cengel Table A-4 (IAPWS-95) 100 C
chk('water Psat(100C) kPa [Cengel A-4: 101.42]', W.Psat(373.15), 101.42, 0.02);
chk('water hf(100C) [419.17]', W.hf(W.Psat(373.15)), 419.17, 0.1);
chk('water hg(100C) [2675.6]', W.hg(W.Psat(373.15)), 2675.6, 0.15);
chk('water sf(100C) [1.3072]', W.sf(W.Psat(373.15)), 1.3072, 0.0005);
chk('water sg(100C) [7.3542]', W.sg(W.Psat(373.15)), 7.3542, 0.001);
chk('water Psat(105C) [120.90]', W.Psat(378.15), 120.90, 0.05);
chk('water hg(105C) [2683.4]', W.hg(W.Psat(378.15)), 2683.4, 0.2);
// Cengel A-6: 1 MPa 300 C h=3051.6 s=7.1246
chk('steam h(1MPa,300C) [Cengel A-6: 3051.6]', W.hPT(1000, 573.15), 3051.6, 1.0);
chk('steam s(1MPa,300C) [7.1246]', W.s(1000, W.hPT(1000, 573.15)), 7.1246, 0.004);
// Arkema Forane 134a / 410a (REFPROP 9, IIR reference)
chk('R134a Psat(0C) [292.8]', R.Psat(273.15), 292.8, 0.3);
chk('R134a Psat(40C) [1016.6]', R.Psat(313.15), 1016.6, 1.0);
chk('R134a hf(0C) [200.00]', R.hf(R.Psat(273.15)), 200.0, 0.1);
chk('R134a hg(0C) [398.60]', R.hg(R.Psat(273.15)), 398.6, 0.2);
chk('R134a hf(40C) [256.41]', R.hf(R.Psat(313.15)), 256.41, 0.15);
chk('R134a hg(40C) [419.43]', R.hg(R.Psat(313.15)), 419.43, 0.2);
chk('R134a sg(60C) [1.7024]', R.sg(R.Psat(333.15)), 1.7024, 0.002);
chk('R134a hg(60C) [426.63]', R.hg(R.Psat(333.15)), 426.63, 0.3);
chk('R410A hg(0C) [421.31]', Q.hg(Q.Psat(273.15)), 421.31, 0.5);
chk('R410A hf(40C) [266.33]', Q.hf(Q.Psat(313.15)), 266.33, 0.5);
chk('R410A hg(50C) [421.72]', Q.hg(Q.Psat(323.15)), 421.72, 0.6);
chk('R410A Psat(40C) ~[2418.7..2425.6]', Q.Psat(313.15), 2422.2, 6);
chk('R134a superheat dh (200 kPa, 0C vs sat) [Borgnakke B.5.1: 400.91-392.15=8.76]', R.hPT(200, 273.15) - R.hg(200), 8.76, 0.25);
console.log('--- published-table checks ---');
for (const [n, g, e, s] of lit) console.log(s.padEnd(5), n.padEnd(84), g.toFixed(4), 'vs', e);
const fails = lit.filter((l) => l[3] === 'FAIL').length;

// 2) independent IAPWS-IF97 + CoolProp cross-check over operating range -----------------------
for (const [T, P, hf, hg, sf, sg] of ref.water_sat) {
  rec('water Psat', rel(W.Psat(T), P)); const p = W.Psat(T);
  rec('water hf', (W.hf(p) - hf) / 1000 ); rec('water hg', (W.hg(p) - hg) / 2700); rec('water sf', (W.sf(p) - sf) / 7); rec('water sg', (W.sg(p) - sg) / 7);
}
for (const [P, T, h, s, rho] of ref.water_sh) {
  const hh = W.hPT(P, T);
  rec('water h(P,T) [abs kJ/kg]', hh - h); rec('water T(P,h) [K]', W.T(P, h) - T); rec('water s(P,h) [abs]', W.s(P, h) - s); rec('water rho(P,h) rel', rel(W.rho(P, h), rho));
}
for (const [P, T, h, s, rho] of ref.r134a_sh) {
  rec('R134a h(P,T) [abs kJ/kg]', R.hPT(P, T) - h); rec('R134a T(P,h) [K]', R.T(P, h) - T); rec('R134a s(P,h) [abs]', R.s(P, h) - s); rec('R134a rho rel', rel(R.rho(P, h), rho));
}
for (const [P, T, h, s, rho] of ref.r410a_sh) {
  rec('R410A h(P,T) [abs kJ/kg]', Q.hPT(P, T) - h); rec('R410A T(P,h) [K]', Q.T(P, h) - T); rec('R410A s(P,h) [abs]', Q.s(P, h) - s); rec('R410A rho rel', rel(Q.rho(P, h), rho));
}
for (const [P, s, h] of ref.r134a_isen) rec('R134a h(P,s) [abs kJ/kg]', R.hPs(P, s) - h);
for (const [P, s, h] of ref.water_isen) rec('water h(P,s) [abs kJ/kg]', W.hPs(P, s) - h);
console.log('--- max deviation vs independent references (IAPWS-IF97 / CoolProp) ---');
for (const [k, v] of Object.entries(worst)) console.log(k.padEnd(32), v.toExponential(2));
// 3) self consistency: round trips and continuity at the dew line
let maxRT = 0, maxJump = 0;
for (const F of [W, R, Q]) for (let i = 0; i < 400; i++) {
  const Pmin = F === W ? 5 : 150, Pmax = F === W ? 12000 : 2800;
  const P = Pmin * Math.pow(Pmax / Pmin, Math.random());
  const Ts = F.Tsat(P), T = Ts + 1 + Math.random() * (F === W ? 300 : 60);
  const h = F.hPT(P, T); maxRT = Math.max(maxRT, Math.abs(F.T(P, h) - T));
  const hg = F.hg(P); maxJump = Math.max(maxJump, Math.abs(F.s(P, hg + 1e-6) - F.s(P, hg - 1e-6)), Math.abs(F.T(P, hg + 1e-6) - F.T(P, hg - 1e-6)) );
}
console.log('round-trip T(P,hPT) max error [K]:', maxRT.toExponential(2), '  dew-line s/T jump:', maxJump.toExponential(2));
console.log(fails ? `FAILED ${fails}` : 'ALL PUBLISHED CHECKS PASSED');
process.exit(fails ? 1 : 0);
