/**
 * Thermophysical property models.
 * Units everywhere: P [kPa], T [K], h [kJ/kg], s [kJ/kg/K], rho [kg/m3], cp [kJ/kg/K], mu [Pa s], k [W/m/K].
 *
 * RealFluid  : saturation table (uniform in T, 2 K) + superheated-vapour grid (nodes in ln P, non-uniform dT above
 *              saturation), both generated from reference Helmholtz EOS (see scripts/gen_tables.py).
 *              Compressed liquid: h = hf(T) + vf(T)(P - Psat(T)).  Vapour grid is anchored to the saturation table so that
 *              h,s,rho are continuous across the dew line.
 * LiquidFluid: incompressible liquid with T-dependent rho, cp, mu, k (Melinder MEG 30 %).
 * IdealGas   : air, cp(T) polynomial (Cengel A-2c), Sutherland transport properties.
 */
import type { RealFluidData, LiquidFluidData } from './types';
import { WATER_DATA } from './data/water';
import { R134A_DATA } from './data/r134a';
import { R410A_DATA } from './data/r410a';
import { GLYCOL30_DATA } from './data/glycol30';
import { PG25_DATA } from './data/pg25';

export type FluidId = 'water' | 'glycol30' | 'pg25' | 'r134a' | 'r410a' | 'air';
export type PhaseName = 'liquid' | 'two-phase' | 'vapor' | 'gas';

export interface FluidModel {
  readonly id: FluidId;
  readonly label: string;
  readonly M: number; // kg/kmol
  readonly twoPhase: boolean;
  readonly Tmin: number;
  readonly Tmax: number;
  readonly Pmax: number; // kPa, validity limit of tables
  T(P: number, h: number): number;
  rho(P: number, h: number): number;
  s(P: number, h: number): number;
  cp(P: number, h: number): number; // single-phase cp; two-phase returns large apparent value
  mu(P: number, h: number): number;
  k(P: number, h: number): number;
  x(P: number, h: number): number; // vapour quality, 0 liquid ... 1 vapour
  phase(P: number, h: number): PhaseName;
  hPT(P: number, T: number): number; // T == Tsat -> saturated liquid
  hPs(P: number, s: number): number;
  Psat(T: number): number;
  Tsat(P: number): number;
  hf(P: number): number;
  hg(P: number): number;
  sf(P: number): number;
  sg(P: number): number;
}

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const BIG_CP = 1e4;

/* ----------------------------------------------------------------------------------------------- */
class RealFluid implements FluidModel {
  readonly id: FluidId;
  readonly label: string;
  readonly M: number;
  readonly twoPhase = true;
  readonly Tmin: number;
  readonly Tmax: number;
  readonly Pmax: number;
  private d: RealFluidData;
  private n: number;
  private lnP: Float64Array;
  private nP: number;
  private nD: number;
  private lnPn: Float64Array;
  private dTs: Float64Array;
  private H: Float64Array; private S: Float64Array; private R: Float64Array; private MU: Float64Array; private K: Float64Array;
  private Tn: Float64Array; // saturation temperature of pressure nodes
  // scratch (module is single-threaded and non-reentrant for these)
  private sc = { T: 0, s: 0, rho: 0, mu: 0, k: 0, h: 0 };
  private si = 0; private sa = 0; // sat location

  constructor(id: FluidId, label: string, d: RealFluidData, Tmax: number) {
    this.id = id; this.label = label; this.d = d; this.M = d.M;
    this.n = d.P.length;
    this.Tmin = d.T0; this.Tmax = Tmax;
    this.lnP = Float64Array.from(d.P, Math.log);
    this.Pmax = d.P[this.n - 1];
    const v = d.vap;
    this.nP = v.Pn.length; this.nD = v.dTs.length;
    this.lnPn = Float64Array.from(v.Pn, Math.log);
    this.dTs = Float64Array.from(v.dTs);
    this.H = Float64Array.from(v.H); this.S = Float64Array.from(v.S); this.R = Float64Array.from(v.R);
    this.MU = Float64Array.from(v.MU); this.K = Float64Array.from(v.K);
    this.Tn = new Float64Array(this.nP);
    for (let k = 0; k < this.nP; k++) this.Tn[k] = d.T0 + 2 * d.dT * k;
  }

  /* ---- saturation location --------------------------------------------------------------- */
  private locT(T: number) {
    let u = (T - this.d.T0) / this.d.dT;
    let i = Math.floor(u);
    if (i < 0) { i = 0; u = 0; } else if (i > this.n - 2) { i = this.n - 2; u = this.n - 1; }
    this.si = i; this.sa = u - i;
  }
  private locP(P: number) {
    const lp = Math.log(clamp(P, this.d.P[0], this.Pmax));
    let lo = 0, hi = this.n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.lnP[mid] <= lp) lo = mid; else hi = mid; }
    this.si = lo; this.sa = (lp - this.lnP[lo]) / (this.lnP[lo + 1] - this.lnP[lo]);
  }
  private lerp(col: number[]) { return col[this.si] + this.sa * (col[this.si + 1] - col[this.si]); }

  Psat(T: number) { this.locT(T); const a = this.lnP[this.si], b = this.lnP[this.si + 1]; return Math.exp(a + this.sa * (b - a)); }
  Tsat(P: number) { this.locP(P); return this.d.T0 + (this.si + this.sa) * this.d.dT; }
  hf(P: number) { this.locP(P); return this.lerp(this.d.hf); }
  hg(P: number) { this.locP(P); return this.lerp(this.d.hg); }
  sf(P: number) { this.locP(P); return this.lerp(this.d.sf); }
  sg(P: number) { this.locP(P); return this.lerp(this.d.sg); }

  /* ---- liquid ------------------------------------------------------------------------------ */
  /** invert a monotone increasing column (hf or sf) -> T, linear extrapolation below the table */
  private invCol(col: number[], v: number): number {
    const n = this.n;
    if (v <= col[0]) { const sl = (col[1] - col[0]) / this.d.dT; return this.d.T0 + (v - col[0]) / sl; }
    if (v >= col[n - 1]) return this.d.T0 + (n - 1) * this.d.dT;
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (col[mid] <= v) lo = mid; else hi = mid; }
    return this.d.T0 + (lo + (v - col[lo]) / (col[lo + 1] - col[lo])) * this.d.dT;
  }
  private liqT(P: number, h: number): number {
    let T = this.invCol(this.d.hf, h);
    for (let it = 0; it < 3; it++) {
      this.locT(clamp(T, this.d.T0, this.d.T0 + (this.n - 1) * this.d.dT));
      const corr = this.lerp(this.d.vf) * (P - Math.exp(this.lnP[this.si] + this.sa * (this.lnP[this.si + 1] - this.lnP[this.si])));
      T = this.invCol(this.d.hf, h - corr);
    }
    return T;
  }

  /* ---- vapour grid ------------------------------------------------------------------------- */
  private vk = 0; private va = 0;
  private locV(P: number) {
    const lp = clamp(Math.log(P), this.lnPn[0], this.lnPn[this.nP - 1] - 1e-12);
    let lo = 0, hi = this.nP - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (this.lnPn[mid] <= lp) lo = mid; else hi = mid; }
    this.vk = lo; this.va = (lp - this.lnPn[lo]) / (this.lnPn[lo + 1] - this.lnPn[lo]);
  }
  /** Find segment j and fraction f in node row k where col(k, ·) brackets value (extrapolates linearly below). */
  private jj = 0; private ff = 0;
  private seg(col: Float64Array, k: number, v: number) {
    const nD = this.nD, o = k * nD;
    if (v <= col[o]) { this.jj = 0; this.ff = (v - col[o]) / (col[o + 1] - col[o]); return; }
    let lo = 0, hi = nD - 1;
    if (v >= col[o + hi]) { this.jj = nD - 2; this.ff = (v - col[o + nD - 2]) / (col[o + nD - 1] - col[o + nD - 2]); return; }
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (col[o + mid] <= v) lo = mid; else hi = mid; }
    this.jj = lo; this.ff = (v - col[o + lo]) / (col[o + lo + 1] - col[o + lo]);
  }
  private at(col: Float64Array, k: number, j: number, f: number) { const o = k * this.nD + j; return col[o] + f * (col[o + 1] - col[o]); }
  /** vapour state at (P, key column value). byS=true: key is entropy. Fills scratch. */
  private vapour(P: number, key: number, byS: boolean) {
    P = clamp(P, this.d.vap.Pn[0], this.d.vap.Pn[this.nP - 1] * 0.999999);
    this.locV(P);
    const k = this.vk, a = this.va;
    const Ps = Math.exp(this.lnPn[k] + a * (this.lnPn[k + 1] - this.lnPn[k]));
    // anchors to saturation table
    this.locP(Ps);
    const hgT = this.lerp(this.d.hg), sgT = this.lerp(this.d.sg), vgT = this.lerp(this.d.vg);
    const eT = this.d.T0 + (this.si + this.sa) * this.d.dT - ((1 - a) * this.Tn[k] + a * this.Tn[k + 1]);
    const nD = this.nD;
    const eh = hgT - ((1 - a) * this.H[k * nD] + a * this.H[(k + 1) * nD]);
    const es = sgT - ((1 - a) * this.S[k * nD] + a * this.S[(k + 1) * nD]);
    const rg = (1 / vgT) / ((1 - a) * this.R[k * nD] + a * this.R[(k + 1) * nD]);
    const keyc = byS ? this.S : this.H;
    const kv = key - (byS ? es : eh);
    const out = this.sc;
    // node k
    this.seg(keyc, k, kv);
    let j = this.jj, f = this.ff;
    const T0 = this.Tn[k] + this.dTs[j] + f * (this.dTs[j + 1] - this.dTs[j]);
    const h0 = this.at(this.H, k, j, f), s0 = this.at(this.S, k, j, f), r0 = this.at(this.R, k, j, f);
    const m0 = this.at(this.MU, k, j, f), k0 = this.at(this.K, k, j, f);
    this.seg(keyc, k + 1, kv);
    j = this.jj; f = this.ff;
    const T1 = this.Tn[k + 1] + this.dTs[j] + f * (this.dTs[j + 1] - this.dTs[j]);
    const h1 = this.at(this.H, k + 1, j, f), s1 = this.at(this.S, k + 1, j, f), r1 = this.at(this.R, k + 1, j, f);
    const m1 = this.at(this.MU, k + 1, j, f), k1 = this.at(this.K, k + 1, j, f);
    out.T = (1 - a) * T0 + a * T1 + eT;
    out.h = (1 - a) * h0 + a * h1 + eh;
    out.s = (1 - a) * s0 + a * s1 + es;
    out.rho = Math.max(1e-4, ((1 - a) * r0 + a * r1) * rg);
    out.mu = (1 - a) * m0 + a * m1;
    out.k = (1 - a) * k0 + a * k1;
  }

  /* ---- public state functions -------------------------------------------------------------- */
  private region(P: number, h: number): 0 | 1 | 2 {
    this.locP(P);
    if (h <= this.lerp(this.d.hf)) return 0;
    if (h >= this.lerp(this.d.hg)) return 2;
    return 1;
  }
  phase(P: number, h: number): PhaseName { const r = this.region(P, h); return r === 0 ? 'liquid' : r === 1 ? 'two-phase' : 'vapor'; }
  x(P: number, h: number) {
    this.locP(P);
    const hf = this.lerp(this.d.hf), hg = this.lerp(this.d.hg);
    return clamp((h - hf) / (hg - hf), 0, 1);
  }
  T(P: number, h: number): number {
    const r = this.region(P, h);
    if (r === 1) return this.d.T0 + (this.si + this.sa) * this.d.dT;
    if (r === 0) return this.liqT(P, h);
    this.vapour(P, h, false); return this.sc.T;
  }
  rho(P: number, h: number): number {
    const r = this.region(P, h);
    if (r === 0) { const T = this.liqT(P, h); this.locT(clamp(T, this.d.T0, this.d.T0 + (this.n - 1) * this.d.dT)); return 1 / this.lerp(this.d.vf); }
    if (r === 1) { const x = (h - this.lerp(this.d.hf)) / (this.lerp(this.d.hg) - this.lerp(this.d.hf)); return 1 / (this.lerp(this.d.vf) + x * (this.lerp(this.d.vg) - this.lerp(this.d.vf))); }
    this.vapour(P, h, false); return this.sc.rho;
  }
  s(P: number, h: number): number {
    const r = this.region(P, h);
    if (r === 0) { const T = this.liqT(P, h); this.locT(clamp(T, this.d.T0, this.d.T0 + (this.n - 1) * this.d.dT)); return this.lerp(this.d.sf); }
    if (r === 1) { const x = (h - this.lerp(this.d.hf)) / (this.lerp(this.d.hg) - this.lerp(this.d.hf)); return this.lerp(this.d.sf) + x * (this.lerp(this.d.sg) - this.lerp(this.d.sf)); }
    this.vapour(P, h, false); return this.sc.s;
  }
  mu(P: number, h: number): number {
    const r = this.region(P, h);
    if (r === 0) { const T = this.liqT(P, h); this.locT(clamp(T, this.d.T0, this.d.T0 + (this.n - 1) * this.d.dT)); return this.lerp(this.d.muf); }
    if (r === 1) { const x = (h - this.lerp(this.d.hf)) / (this.lerp(this.d.hg) - this.lerp(this.d.hf)); return 1 / (x / this.lerp(this.d.mug) + (1 - x) / this.lerp(this.d.muf)); }
    this.vapour(P, h, false); return this.sc.mu;
  }
  k(P: number, h: number): number {
    const r = this.region(P, h);
    if (r === 0) { const T = this.liqT(P, h); this.locT(clamp(T, this.d.T0, this.d.T0 + (this.n - 1) * this.d.dT)); return this.lerp(this.d.kf); }
    if (r === 1) { const x = (h - this.lerp(this.d.hf)) / (this.lerp(this.d.hg) - this.lerp(this.d.hf)); return (1 - x) * this.lerp(this.d.kf) + x * this.lerp(this.d.kg); }
    this.vapour(P, h, false); return this.sc.k;
  }
  cp(P: number, h: number): number {
    const r = this.region(P, h);
    if (r === 1) return BIG_CP;
    const dh = 0.5; // kJ/kg
    const T1 = this.T(P, h + dh), T0 = this.T(P, h - dh);
    const d = T1 - T0;
    return d > 1e-9 ? (2 * dh) / d : BIG_CP;
  }
  hPT(P: number, T: number): number {
    this.locP(P);
    const Ts = this.d.T0 + (this.si + this.sa) * this.d.dT;
    if (T <= Ts) {
      // compressed / saturated liquid
      const Tc = clamp(T, this.d.T0, this.d.T0 + (this.n - 1) * this.d.dT);
      this.locT(Tc);
      const hf = this.lerp(this.d.hf), vf = this.lerp(this.d.vf);
      const Ps = Math.exp(this.lnP[this.si] + this.sa * (this.lnP[this.si + 1] - this.lnP[this.si]));
      if (T < Tc) return hf + (T - Tc) * this.lerp(this.d.cpf);
      return hf + vf * (P - Ps);
    }
    // superheated vapour: Newton on T(P,h)
    const hg = this.hg(P);
    let h = hg + 1.0 * (T - Ts);
    for (let it = 0; it < 12; it++) {
      const Tn = this.T(P, h);
      const err = T - Tn;
      if (Math.abs(err) < 1e-10) break;
      h += err * Math.max(0.4, this.cp(P, h + 0 * err));
    }
    return h;
  }
  hPs(P: number, s: number): number {
    this.locP(P);
    const sf = this.lerp(this.d.sf), sg = this.lerp(this.d.sg);
    if (s <= sf) {
      const T = this.invCol(this.d.sf, s);
      return this.hPT(P, Math.min(T, this.Tsat(P)));
    }
    if (s < sg) {
      const x = (s - sf) / (sg - sf);
      const hf = this.lerp(this.d.hf), hg = this.lerp(this.d.hg);
      return hf + x * (hg - hf);
    }
    this.vapour(P, s, true);
    return this.sc.h;
  }
}

/* ----------------------------------------------------------------------------------------------- */
class LiquidFluid implements FluidModel {
  readonly id: FluidId; readonly label: string; readonly M: number; readonly twoPhase = false;
  readonly Tmin: number; readonly Tmax: number; readonly Pmax = 1e5;
  private d: LiquidFluidData; private n: number; private hc: Float64Array; private sc: Float64Array;
  constructor(id: FluidId, label: string, d: LiquidFluidData) {
    this.id = id; this.label = label; this.d = d; this.M = d.M; this.n = d.rho.length;
    this.Tmin = d.T0 + 2; this.Tmax = d.T0 + (this.n - 1) * d.dT;
    this.hc = new Float64Array(this.n); this.sc = new Float64Array(this.n);
    for (let i = 1; i < this.n; i++) {
      this.hc[i] = this.hc[i - 1] + 0.5 * (d.cp[i - 1] + d.cp[i]) * d.dT;
      const Tm = d.T0 + (i - 0.5) * d.dT;
      this.sc[i] = this.sc[i - 1] + 0.5 * (d.cp[i - 1] + d.cp[i]) * d.dT / Tm;
    }
  }
  private col(c: number[], T: number) {
    let u = (T - this.d.T0) / this.d.dT; u = clamp(u, 0, this.n - 1 - 1e-9);
    const i = Math.floor(u), a = u - i; return c[i] + a * (c[i + 1] - c[i]);
  }
  private hT(T: number) {
    const dT = this.d.dT;
    const u = (T - this.d.T0) / dT;
    const i = clamp(Math.floor(u), 0, this.n - 2);
    const del = T - (this.d.T0 + i * dT);
    const c0 = this.d.cp[i], sl = (this.d.cp[i + 1] - c0) / dT;
    return this.hc[i] + c0 * del + 0.5 * sl * del * del;
  }
  private Th(hh: number) {
    let T = this.d.T0 + hh / this.d.cp[0];
    for (let it = 0; it < 6; it++) { const e = hh - this.hT(T); T += e / this.col(this.d.cp, T); if (Math.abs(e) < 1e-9) break; }
    return T;
  }
  private hBase(P: number, h: number) { // remove pressure term using rho at ~T
    return h - (P - 100) / 1040;
  }
  T(P: number, h: number) { return this.Th(this.hBase(P, h)); }
  rho(P: number, h: number) { return this.col(this.d.rho, this.T(P, h)); }
  s(P: number, h: number) { const T = this.T(P, h); const i = clamp(Math.floor((T - this.d.T0) / this.d.dT), 0, this.n - 2); return this.sc[i] + this.col(this.d.cp, T) * Math.log(T / (this.d.T0 + i * this.d.dT)); }
  cp(P: number, h: number) { return this.col(this.d.cp, this.T(P, h)); }
  mu(P: number, h: number) { return this.col(this.d.mu, this.T(P, h)); }
  k(P: number, h: number) { return this.col(this.d.k, this.T(P, h)); }
  x() { return 0; }
  phase(): PhaseName { return 'liquid'; }
  hPT(P: number, T: number) { return this.hT(T) + (P - 100) / 1040; }
  hPs(P: number, s: number) {
    let T = this.d.T0 + 30;
    for (let it = 0; it < 30; it++) { const h = this.hT(T); const e = s - this.s(100, h); T += e * T / this.col(this.d.cp, T); if (Math.abs(e) < 1e-10) break; }
    return this.hT(T) + (P - 100) / 1040;
  }
  Psat(T: number) { return 101.325 * Math.exp(0.0005 * (T - 373) + 0.00002 * (T - 373) ** 2) ; }
  Tsat() { return 378; }
  hf() { return this.hT(378); } hg() { return this.hT(378) + 2000; } sf() { return 0; } sg() { return 0; }
}

/* ----------------------------------------------------------------------------------------------- */
class IdealGas implements FluidModel {
  readonly id: FluidId = 'air'; readonly label = 'Air (ideal gas)'; readonly M = 28.97; readonly twoPhase = false;
  readonly Tmin = 150; readonly Tmax = 2000; readonly Pmax = 1e5;
  private R = 8.314462618 / 28.97;
  // Cengel Table A-2c, cp [kJ/kmol K] = a + bT + cT^2 + dT^3 (T in K), valid 273-1800 K
  private a = 28.11; private b = 0.1967e-2; private c = 0.4802e-5; private d = -1.966e-9;
  private cp0(T: number) { return (this.a + this.b * T + this.c * T * T + this.d * T * T * T) / this.M; }
  private h0(T: number) { return (this.a * T + this.b * T * T / 2 + this.c * T ** 3 / 3 + this.d * T ** 4 / 4) / this.M - 273.15 * 1.005; }
  private s0(T: number) { return (this.a * Math.log(T) + this.b * T + this.c * T * T / 2 + this.d * T ** 3 / 3) / this.M; }
  T(_P: number, h: number) {
    let T = 273.15 + (h) / 1.005;
    for (let it = 0; it < 8; it++) { const e = h - this.h0(T); T += e / this.cp0(T); if (Math.abs(e) < 1e-9) break; }
    return clamp(T, 100, 3000);
  }
  rho(P: number, h: number) { return P / (this.R * this.T(P, h)); }
  s(P: number, h: number) { return this.s0(this.T(P, h)) - this.R * Math.log(P / 100); }
  cp(P: number, h: number) { return this.cp0(this.T(P, h)); }
  mu(P: number, h: number) { const T = this.T(P, h); return 1.716e-5 * (T / 273.15) ** 1.5 * (273.15 + 110.4) / (T + 110.4); }
  k(P: number, h: number) { const T = this.T(P, h); return 0.0241 * (T / 273.15) ** 1.5 * (273.15 + 194) / (T + 194); }
  x() { return 1; }
  phase(): PhaseName { return 'gas'; }
  hPT(_P: number, T: number) { return this.h0(T); }
  hPs(P: number, s: number) {
    let T = 300;
    const target = s + this.R * Math.log(P / 100);
    for (let it = 0; it < 20; it++) { const e = target - this.s0(T); T += e * T / (this.cp0(T) * 1.0); if (Math.abs(e) < 1e-10) break; T = clamp(T, 100, 3000); }
    return this.h0(T);
  }
  Psat() { return 1e9; } Tsat() { return 0; } hf() { return -1e9; } hg() { return 1e9; } sf() { return -1e9; } sg() { return 1e9; }
}

/* ----------------------------------------------------------------------------------------------- */
const REG: Record<FluidId, FluidModel> = {
  water: new RealFluid('water', 'Water / Steam (IAPWS-95)', WATER_DATA, 1073),
  glycol30: new LiquidFluid('glycol30', 'Water-Glycol 30 % (MEG)', GLYCOL30_DATA),
  pg25: new LiquidFluid('pg25', 'Propylene-Glycol 25 % (PG25)', PG25_DATA),
  r134a: new RealFluid('r134a', 'R134a', R134A_DATA, 423),
  r410a: new RealFluid('r410a', 'R410A', R410A_DATA, 423),
  air: new IdealGas(),
};
export const FLUIDS = REG;
export const FLUID_IDS = Object.keys(REG) as FluidId[];
export const getFluid = (id: FluidId): FluidModel => REG[id];
export const fluidLabel = (id: FluidId) => REG[id].label;
