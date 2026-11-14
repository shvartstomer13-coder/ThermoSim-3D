/**
 * FLIR-style infrared rendering: palette LUTs (Ironbow / Rainbow / Grayscale), GLSL thermal material with a
 * temperature gradient along a local axis (or along UV.x for pipes), a translucent animated flow-indicator
 * material, and legend helpers (°C / K).
 */
import * as THREE from 'three';

export type PaletteId = 'ironbow' | 'rainbow' | 'gray';
export const PALETTES: { id: PaletteId; label: string }[] = [
  { id: 'ironbow', label: 'Ironbow' }, { id: 'rainbow', label: 'Rainbow' }, { id: 'gray', label: 'White-hot' },
];

/** colour stops in sRGB [0..255] */
const STOPS: Record<PaletteId, [number, number, number][]> = {
  ironbow: [[0, 0, 0], [20, 0, 60], [60, 0, 120], [120, 0, 150], [180, 20, 110], [225, 60, 40], [248, 120, 10], [255, 185, 20], [255, 235, 110], [255, 255, 235]],
  rainbow: [[20, 0, 90], [0, 0, 220], [0, 140, 255], [0, 220, 190], [40, 220, 40], [200, 240, 0], [255, 200, 0], [255, 100, 0], [230, 0, 0], [255, 255, 255]],
  gray: [[8, 8, 8], [255, 255, 255]],
};
const COOLWARM: [number, number, number][] = [[40, 90, 255], [60, 190, 255], [90, 230, 200], [255, 220, 90], [255, 130, 40], [235, 40, 30]];

const srgb2lin = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
function sample(stops: [number, number, number][], t: number): [number, number, number] {
  const x = Math.min(Math.max(t, 0), 1) * (stops.length - 1), i = Math.min(Math.floor(x), stops.length - 2), f = x - i;
  return [0, 1, 2].map((k) => stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f) as [number, number, number];
}
/** CSS gradient for the legend (top = hot) */
export function legendCss(id: PaletteId): string {
  const n = 16, parts: string[] = [];
  for (let i = 0; i <= n; i++) { const c = sample(STOPS[id], 1 - i / n); parts.push(`rgb(${c.map(Math.round).join(',')}) ${(i / n) * 100}%`); }
  return `linear-gradient(to bottom, ${parts.join(',')})`;
}
export function paletteColor(id: PaletteId, t01: number): string { const c = sample(STOPS[id], t01); return `rgb(${c.map(Math.round).join(',')})`; }

const lutCache = new Map<string, THREE.DataTexture>();
export function paletteTexture(id: PaletteId | 'coolwarm'): THREE.DataTexture {
  const hit = lutCache.get(id); if (hit) return hit;
  const stops = id === 'coolwarm' ? COOLWARM : STOPS[id], N = 256, data = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { const c = sample(stops, i / (N - 1)); data[i * 4] = srgb2lin(c[0]); data[i * 4 + 1] = srgb2lin(c[1]); data[i * 4 + 2] = srgb2lin(c[2]); data[i * 4 + 3] = 1; }
  const tex = new THREE.DataTexture(data, N, 1, THREE.RGBAFormat, THREE.FloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true;
  lutCache.set(id, tex); return tex;
}

/** shared IR state (mutated by the app, read by all thermal materials every frame) */
export const IR = { palette: 'ironbow' as PaletteId, tMin: 290, tMax: 340 };

export const THERMAL_VERT = /* glsl */ `
  varying vec3 vObj; varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying vec3 vWN;
  void main() {
    vObj = position; vUv = uv; vWN = normalize(mat3(modelMatrix) * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vView = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;

export const THERMAL_FRAG = /* glsl */ `
  uniform sampler2D uLut; uniform float uTa; uniform float uTb; uniform float uTmin; uniform float uTmax;
  uniform vec3 uAxis; uniform float uLo; uniform float uHi; uniform float uUseUv; uniform float uShade;
  varying vec3 vObj; varying vec3 vN; varying vec3 vView; varying vec2 vUv; varying vec3 vWN;
  void main() {
    float s = uUseUv > 0.5 ? vUv.x : clamp((dot(vObj, uAxis) - uLo) / max(uHi - uLo, 1e-4), 0.0, 1.0);
    float T = mix(uTa, uTb, s);
    float t = clamp((T - uTmin) / max(uTmax - uTmin, 1e-3), 0.0, 1.0);
    vec3 col = texture2D(uLut, vec2(t * 0.998 + 0.001, 0.5)).rgb;
    // mild facing-ratio shading so geometry stays readable in the IR image
    float ndv = abs(dot(normalize(vN), normalize(vView)));
    float sky = 0.5 + 0.5 * normalize(vWN).y;
    col *= mix(1.0, (0.5 + 0.5 * ndv) * (0.62 + 0.38 * sky), uShade);
    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }`;

export type ThermalMat = THREE.ShaderMaterial;
export function makeThermalMaterial(opts: { axis?: 'x' | 'y' | 'z' | 'uv'; lo?: number; hi?: number } = {}): ThermalMat {
  const ax = opts.axis ?? 'y';
  return new THREE.ShaderMaterial({
    vertexShader: THERMAL_VERT, fragmentShader: THERMAL_FRAG,
    uniforms: {
      uLut: { value: paletteTexture(IR.palette) }, uTa: { value: 300 }, uTb: { value: 300 }, uTmin: { value: IR.tMin }, uTmax: { value: IR.tMax },
      uAxis: { value: new THREE.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0) }, uLo: { value: opts.lo ?? -0.5 }, uHi: { value: opts.hi ?? 0.5 },
      uUseUv: { value: ax === 'uv' ? 1 : 0 }, uShade: { value: 0.8 },
    },
  });
}
/** push global IR range / palette into a material (cheap; called per frame) */
export function syncThermal(m: ThermalMat, ta: number, tb: number) {
  const u = m.uniforms; u.uTa.value = ta; u.uTb.value = tb; u.uTmin.value = IR.tMin; u.uTmax.value = IR.tMax;
  const lut = paletteTexture(IR.palette); if (u.uLut.value !== lut) u.uLut.value = lut;
}

/** translucent animated flow indicator (stripes travelling with the flow, coloured by fluid temperature) */
export function makeFlowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.FrontSide,
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vView; void main(){ vUv=uv; vec4 mv=modelViewMatrix*vec4(position,1.0); vN=normalize(normalMatrix*normal); vView=-mv.xyz; gl_Position=projectionMatrix*mv; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uLut; uniform float uTa; uniform float uTb; uniform float uTmin; uniform float uTmax; uniform float uPhase; uniform float uLen; uniform float uSpeed; uniform float uAlpha; uniform float uMode;
      varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main(){
        float T = mix(uTa, uTb, vUv.x);
        float t = clamp((T - uTmin) / max(uTmax - uTmin, 1e-3), 0.0, 1.0);
        vec3 col = texture2D(uLut, vec2(t * 0.998 + 0.001, 0.5)).rgb;
        float stripe = 0.5 + 0.5 * sin(6.2831853 * (vUv.x * uLen * 1.6 - uPhase));
        float rim = 1.0 - abs(dot(normalize(vN), normalize(vView)));
        float a = uAlpha * (0.35 + 0.65 * smoothstep(0.2, 0.95, stripe) * min(uSpeed, 1.0)) * (0.55 + 0.6 * rim);
        gl_FragColor = vec4(col, a);
        #include <colorspace_fragment>
      }`,
    uniforms: { uLut: { value: paletteTexture('coolwarm') }, uTa: { value: 300 }, uTb: { value: 300 }, uTmin: { value: 280 }, uTmax: { value: 340 }, uPhase: { value: 0 }, uLen: { value: 1 }, uSpeed: { value: 0 }, uAlpha: { value: 0.55 }, uMode: { value: 0 } },
  });
}

/** temperature formatting */
export type TempUnit = 'C' | 'K';
export const fmtT = (K: number, unit: TempUnit, d = 1) => (unit === 'C' ? (K - 273.15).toFixed(d) + ' °C' : K.toFixed(d) + ' K');
