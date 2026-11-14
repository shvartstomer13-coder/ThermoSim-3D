/**
 * Thermodynamic / fluid-mechanics building blocks used by the component models.
 * Units: P [kPa], T [K], h [kJ/kg], m [kg/s], Q [kW], UA [kW/K], lengths [m].
 */
import type { FluidModel } from './fluidProperties';

export const G = 9.80665;
export const smoothPos = (x: number, eps = 1e-3) => 0.5 * (x + Math.sqrt(x * x + eps * eps));
export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const smoothStep = (x: number) => { const t = clamp(x, 0, 1); return t * t * (3 - 2 * t); };

/* ---------------- Darcy-Weisbach ------------------------------------------------------------- */
/** Churchill (1977) friction factor, valid for laminar, transition and turbulent flow (Darcy f). */
export function churchillF(Re: number, relRough: number): number {
  const R = Math.max(Re, 1);
  const A = Math.pow(2.457 * Math.log(1 / (Math.pow(7 / R, 0.9) + 0.27 * relRough)), 16);
  const B = Math.pow(37530 / R, 16);
  const f = 8 * Math.pow(Math.pow(8 / R, 12) + 1 / Math.pow(A + B, 1.5), 1 / 12);
  return Math.min(f, 64);
}
/** Pressure drop [kPa] for mass flow m through a pipe segment (sign follows flow direction). */
export function darcyDp(m: number, rho: number, mu: number, D: number, L: number, rough: number, K: number): { dp: number; v: number; Re: number; f: number } {
  const A = Math.PI * D * D / 4;
  const v = m / (rho * A);
  const Re = rho * Math.abs(v) * D / Math.max(mu, 1e-9);
  const f = churchillF(Re, rough / D);
  const dp = (f * L / D + K) * rho * v * Math.abs(v) / 2 / 1000;
  return { dp, v, Re, f };
}
/** Inside convective coefficient [W/m2K]: Gnielinski-like blend of laminar Nu=3.66 and Dittus-Boelter. */
export function hInside(Re: number, Pr: number, k: number, D: number, heating: boolean): number {
  const nuT = 0.023 * Math.pow(Math.max(Re, 1), 0.8) * Math.pow(Math.max(Pr, 0.3), heating ? 0.4 : 0.3);
  const w = clamp((Re - 2300) / 1700, 0, 1);
  return ((1 - w) * 3.66 + w * Math.max(nuT, 3.66)) * k / D;
}

/* ---------------- effectiveness–NTU ---------------------------------------------------------- */
export function epsCounter(NTU: number, Cr: number): number {
  if (NTU <= 1e-12) return 0;
  if (Cr < 1e-6) return 1 - Math.exp(-NTU);
  if (Math.abs(1 - Cr) < 1e-6) return NTU / (1 + NTU);
  const e = Math.exp(-NTU * (1 - Cr));
  return (1 - e) / (1 - Cr * e);
}
/**
 * Effective (temperature, capacity-rate) of a stream for ε-NTU:
 *  - two-phase stream, or vapour that is cooled below Tsat by the other stream (condensing): isothermal at Tsat, C -> infinity (Cr = 0 limit)
 *  - otherwise single-phase: inlet temperature and C = m·cp.
 */
export interface StreamEff { T: number; C: number; latent: boolean }
export function streamEff(f: FluidModel, P: number, h: number, m: number, Tother: number): StreamEff {
  const mm = Math.max(Math.abs(m), 1e-6);
  if (f.twoPhase) {
    const ph = f.phase(P, h), Ts = f.Tsat(P);
    if (ph === 'two-phase') return { T: Ts, C: 1e5, latent: true };
    if (ph === 'vapor' && Tother < Ts) return { T: Ts, C: 1e5, latent: true };
  }
  return { T: f.T(P, h), C: mm * Math.max(Math.min(f.cp(P, h), 100), 0.05), latent: false };
}
export interface ExResult { Q: number; eps: number; NTU: number; Cmin: number; Cr: number }
/** Heat flow INTO stream c from stream h [kW] (negative if h is colder). Counter-flow ε-NTU. */
export function exchangerFF(fh: FluidModel, Ph: number, hh: number, mh: number, fc: FluidModel, Pc: number, hc: number, mc: number, UA: number): ExResult {
  const Th0 = fh.T(Ph, hh), Tc0 = fc.T(Pc, hc);
  const H = streamEff(fh, Ph, hh, mh, Tc0), C = streamEff(fc, Pc, hc, mc, Th0);
  const Cmin = Math.min(H.C, C.C), Cmax = Math.max(H.C, C.C);
  const NTU = UA / Math.max(Cmin, 1e-9), Cr = Cmin / Math.max(Cmax, 1e-9);
  const eps = epsCounter(NTU, Cr);
  return { Q: eps * Cmin * (H.T - C.T), eps, NTU, Cmin, Cr };
}
/** Heat flow INTO a fluid stream from an external stream of constant capacity rate C at inlet temperature Tother. */
export function exchangerFC(f: FluidModel, P: number, h: number, m: number, Tother: number, C: number, UA: number): ExResult {
  const S = streamEff(f, P, h, m, Tother);
  const Cmin = Math.min(S.C, C), Cmax = Math.max(S.C, C);
  const NTU = UA / Math.max(Cmin, 1e-9), Cr = Cmin / Math.max(Cmax, 1e-9);
  const eps = epsCounter(NTU, Cr);
  return { Q: eps * Cmin * (Tother - S.T), eps, NTU, Cmin, Cr };
}
/**
 * Fluid stream flowing along a wall held at Tw (UA total, distributed): marching integration with N cells using the
 * exact exponential solution per cell on an enthalpy basis (exact for constant cp and for isothermal boiling).
 * Returns outlet enthalpy; optionally fills the temperature profile (N+1 values).
 */
export function marchWall(f: FluidModel, P: number, hIn: number, m: number, Tw: number, UA: number, N = 12, prof?: number[]): number {
  let h = hIn;
  const hw = f.hPT(P, Tw);
  const mm = Math.max(Math.abs(m), 1e-6);
  if (prof) prof[0] = f.T(P, h);
  for (let i = 0; i < N; i++) {
    const T = f.T(P, h);
    const dT = Tw - T, dh = hw - h;
    let cEff = Math.abs(dT) > 1e-4 ? dh / dT : f.cp(P, h);
    cEff = Math.max(Math.min(cEff, 1e5), 0.05);
    h += (1 - Math.exp(-(UA / N) / (mm * cEff))) * dh;
    if (prof) prof[i + 1] = f.T(P, h);
  }
  return h;
}

/* ---------------- turbomachinery -------------------------------------------------------------- */
export function hCompressed(f: FluidModel, P1: number, h1: number, P2: number, eta: number): number {
  const hs = f.hPs(P2, f.s(P1, h1));
  return h1 + (hs - h1) / Math.max(eta, 0.05);
}
export function hExpanded(f: FluidModel, P1: number, h1: number, P2: number, eta: number): { h2: number; h2s: number; x2s: number } {
  const hs = f.hPs(P2, f.s(P1, h1));
  return { h2: h1 - eta * (h1 - hs), h2s: hs, x2s: f.x(P2, hs) };
}

/* ---------------- psychrometrics (for the cooling tower) -------------------------------------- */
const pws = (Tc: number) => 0.61094 * Math.exp(17.625 * Tc / (Tc + 243.04)); // kPa (Magnus / Alduchov-Eskridge)
export function humidityRatio(Tc: number, RH: number, P: number) { const pv = RH * pws(Tc); return 0.62198 * pv / (P - pv); }
export function wetBulb(TdbK: number, RH: number, P = 101.325): number {
  const Td = TdbK - 273.15;
  const W = humidityRatio(Td, RH, P);
  let lo = -20, hi = Td;
  for (let i = 0; i < 50; i++) {
    const Tw = 0.5 * (lo + hi);
    const Ws = 0.62198 * pws(Tw) / (P - pws(Tw));
    const Wc = ((2501 - 2.326 * Tw) * Ws - 1.006 * (Td - Tw)) / (2501 + 1.86 * Td - 4.186 * Tw);
    if (Wc > W) hi = Tw; else lo = Tw;
  }
  return 0.5 * (lo + hi) + 273.15;
}
/** moist air enthalpy at saturation [kJ/kg dry air] */
export function hSatAir(TwbK: number, P = 101.325) { const T = TwbK - 273.15; const Ws = 0.62198 * pws(T) / (P - pws(T)); return 1.006 * T + Ws * (2501 + 1.86 * T); }

/* ---------------- materials --------------------------------------------------------------------- */
export const MATERIALS: Record<string, { label: string; rough: number; k: number; rhoCp: number }> = {
  carbon: { label: 'Carbon steel', rough: 0.045e-3, k: 50, rhoCp: 7850 * 0.49 },
  stainless: { label: 'Stainless 316', rough: 0.015e-3, k: 16, rhoCp: 8000 * 0.5 },
  copper: { label: 'Copper', rough: 0.0015e-3, k: 390, rhoCp: 8960 * 0.385 },
  pvc: { label: 'PVC / PP-R', rough: 0.0015e-3, k: 0.19, rhoCp: 1400 * 1.0 },
};
