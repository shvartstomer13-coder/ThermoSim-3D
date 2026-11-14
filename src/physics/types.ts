export interface RealFluidData {
  id: string; M: number; Tc: number; Pc: number; T0: number; dT: number;
  P: number[]; hf: number[]; hg: number[]; sf: number[]; sg: number[]; vf: number[]; vg: number[];
  cpf: number[]; cpg: number[]; muf: number[]; mug: number[]; kf: number[]; kg: number[];
  vap: { Pn: number[]; dTs: number[]; H: number[]; S: number[]; R: number[]; MU: number[]; K: number[] };
}
export interface LiquidFluidData {
  id: string; M: number; T0: number; dT: number; Tfreeze: number;
  rho: number[]; cp: number[]; mu: number[]; k: number[];
}
