import type { FluidId, FluidModel } from './fluidProperties';

export type PortKind = 'in' | 'out' | 'ref';
export interface PortDef { id: string; name: string; kind: PortKind; pass: number; pos: [number, number, number]; dir: [number, number, number]; dn: number }
export interface ParamOption { value: string | number; label: string }
export interface ParamDef {
  key: string; label: string; unit: string; min: number; max: number; step: number; def: number | string | boolean;
  group?: string; kind?: 'number' | 'select' | 'bool'; options?: ParamOption[]; hint?: string;
}
export type ParamValue = number | string | boolean;
export type Params = Record<string, ParamValue>;
export interface PortRef { comp: string; port: string }
export interface Link { a: PortRef; b: PortRef }
export interface CompInstance {
  id: string; type: string; name: string; pos: [number, number, number]; rotY: number; params: Params;
  from?: PortRef | null; to?: PortRef | null; // pipes: the two component ports it connects
  asset?: string; // custom GLB asset id (optional)
  via?: [number, number, number][]; // pipes: user route waypoints (world, m)
}
export interface Ambient { T: number; RH: number; P: number; Twb: number }
export interface StepCtx { dt: number; invDt: number; amb: Ambient; prev: Float64Array }
export interface NodeIdx { P: number; h: number; m: number }
export type Telemetry = Record<string, number | string>;
export interface Elem {
  id: string; type: string; nEq: number; vars: number[];
  eval(x: Float64Array, S: StepCtx, r: Float64Array, o: number): void;
  tele(x: Float64Array, S: StepCtx): Telemetry;
}
export interface BuildCtx {
  comp: CompInstance; p: Params; mRef: number;
  node(portId: string): NodeIdx;
  has(portId: string): boolean;
  fluid(pass: number): FluidModel;
  fluidId(pass: number): FluidId;
  wall(Tinit?: number): number; // allocate a wall-temperature variable
  initT(portId: string): number; // initial-guess fluid temperature at a port [K]
}
export interface InitCtx {
  comp: CompInstance; p: Params; amb: Ambient;
  fluid(pass: number): FluidModel;
  /** set initial guess for the node at a port (only P/h/m given are applied) */
  set(portId: string, v: { P?: number; h?: number; m?: number }): void;
  get(portId: string): { P?: number; h?: number; m?: number };
}
export interface CompSpec {
  type: string; label: string; category: 'cycle' | 'datacenter' | 'piping' | 'instrument' | 'misc' | 'heat' | 'hx' | 'machines' | 'room';
  desc: string; passes: number; defaultFluids: FluidId[];
  params: ParamDef[]; footprint: [number, number, number]; // w, h, d [m]
  ports(p: Params): PortDef[];
  build(c: BuildCtx): Elem;
  init?(c: InitCtx): void;
  passThrough?: boolean;
  /** architectural element (room, wall...): no ports, ignored by the solver */
  arch?: boolean;
  /** parametric footprint (w, h, d) [m] */
  fp?(p: Params): [number, number, number]; // pure series element: copy neighbour states during initialisation
  /** state/wall variable count (informational) */
}
