# usage: python patch2.py <input.html> <output.html>
import sys
s = open(sys.argv[1], encoding='utf8').read()
def rep(old, new, cnt=1):
    global s
    c = s.count(old)
    assert c == cnt, (c, old[:90])
    s = s.replace(old, new)

irlib = r"""
const IR_EMIS = { alu: 0.32, steel: 0.42, galv: 0.45, darksteel: 0.55, copper: 0.28, brass: 0.34, rubber: 0.95, insul: 0.95, concrete: 0.93, brick: 0.93, glass: 0.9, frp: 0.9, white: 0.9, grey: 0.86, black: 0.92, yellow: 0.9, green: 0.9, red: 0.9 };
const IR_DECL = `uniform sampler2D uLut; uniform float uTa; uniform float uTb; uniform float uTmin; uniform float uTmax; uniform vec3 uAxis; uniform float uLo; uniform float uHi; uniform float uUseUv; uniform float uTamb; uniform float uEmis; varying vec3 vObjP;`;
const IR_FRAG = `{
  float irAlb = max(dot(diffuseColor.rgb, vec3(0.3333)), 0.06);
  float irSh = clamp(dot(outgoingLight, vec3(0.3333)) / irAlb, 0.0, 2.2);
  vec3 irN = inverseTransformDirection(normalize(normal), viewMatrix);
  float irNdv = abs(dot(normalize(normal), normalize(vViewPosition)));
  float irS = uUseUv > 0.5 ? 0.5 : clamp((dot(vObjP, uAxis) - uLo) / max(uHi - uLo, 1e-4), 0.0, 1.0);
  float T = mix(uTa, uTb, irS);
  float Trefl = uTamb - 4.0 * clamp(irN.y, 0.0, 1.0) + 1.5 * clamp(-irN.y, 0.0, 1.0);
  float graz = pow(1.0 - irNdv, 3.0);
  float em = clamp(uEmis - 0.30 * graz, 0.05, 1.0);
  float Tapp = em * T + (1.0 - em) * Trefl;
  float rng = max(uTmax - uTmin, 1e-3);
  float nz = sin(vObjP.x * 6.1 + vObjP.y * 2.3) * sin(vObjP.y * 8.7 + vObjP.z * 4.1) * sin(vObjP.z * 5.3 - vObjP.x * 1.7);
  Tapp += nz * 0.010 * rng;
  float t = clamp((Tapp - uTmin) / rng, 0.0, 1.0);
  t = clamp(pow(t, 0.68) * 1.05 + 0.05, 0.12, 1.0);
  vec3 th = texture2D(uLut, vec2(t * 0.998 + 0.001, 0.5)).rgb;
  float shade = clamp(0.45 + 0.95 * irSh, 0.35, 1.9);
  float det = (irAlb - 0.35) * 0.30;
  vec3 col = th * (shade + det);
  col *= mix(0.46, 1.0, smoothstep(uTamb + 0.5, uTamb + 9.0, T));
  col *= 1.0 - 0.55 * graz;
  col += vec3(0.012, 0.006, 0.02);
  gl_FragColor = vec4(col, diffuseColor.a);
}`;
function irPatch(sh, U, emis) {
  for (const k in U) sh.uniforms[k] = U[k];
  sh.uniforms.uEmis = { value: emis };
  sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying vec3 vObjP;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvObjP = position;");
  sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\n" + IR_DECL).replace("#include <opaque_fragment>", IR_FRAG);
}
function irClone(o, U) {
  if (Array.isArray(o)) return o.map((m) => irClone(m, U));
  const m = o.clone();
  m.toneMapped = false;
  m.emissive && m.emissive.setScalar(0);
  m.emissiveMap = null;
  const em = 0.93 - 0.6 * Math.min(1, m.metalness ?? 0);
  m.metalness = Math.min(m.metalness ?? 0, 0.25);
  m.onBeforeCompile = (sh) => irPatch(sh, U, em);
  m.customProgramCacheKey = () => "irt";
  m.needsUpdate = true;
  return m;
}
let IR_AMB = null;
function irAmb() { return (IR_AMB ??= dS({ axis: "y", lo: 0, hi: 1 })); }
"""
rep('function br({\n  kind: i = "steel",', irlib + 'function br({\n  kind: i = "steel",')

rep('  if (p === "ir") return x.jsx("primitive", { object: w, attach: "material" });\n  const M = o ?? _.opacity ?? 1;',
'''  const M = o ?? _.opacity ?? 1;
  if (p === "ir")
    return x.jsx("meshStandardMaterial", {
      key: "ir",
      color: "#c9cacc",
      metalness: 0,
      roughness: 0.82,
      map: c ?? null,
      roughnessMap: d ?? null,
      bumpMap: h ?? null,
      bumpScale: 0.6,
      toneMapped: !1,
      transparent: M < 1,
      opacity: M,
      side: a,
      onBeforeCompile: (sh) => irPatch(sh, w.uniforms, IR_EMIS[i] ?? 0.9),
      customProgramCacheKey: () => "irt",
    });''')

rep('g.isMesh && g._orig && (g.material = r === "ir" ? d : g._orig);',
    'g.isMesh && g._orig && (g.material = r === "ir" ? (g._ir ??= irClone(g._orig, d.uniforms)) : g._orig);')

rep('  return i === "ir"\n    ? null\n    : x.jsxs(x.Fragment, {\n        children: [\n          x.jsx("hemisphereLight", {',
    '  return !1\n    ? null\n    : x.jsxs(x.Fragment, {\n        children: [\n          x.jsx("hemisphereLight", {')

rep('return ye((n) => n.renderMode) === "ir"\n    ? x.jsxs("lineSegments", {',
    'return (ye((n) => n.renderMode), !1)\n    ? x.jsxs("lineSegments", {')

rep('  if (ye((C) => C.renderMode) === "ir")\n    return a > 0 ? x.jsx(E6, { W: t, D: n, H: a, perf: !0, ca: NXR_ca(i.params) }) : null;',
    '  const irm_q = ye((C) => C.renderMode) === "ir";')
rep('x.jsx(vS, { W: t, D: n, H: Math.min(e("ch"), r - 0.05), op: o }),',
    '!irm_q && x.jsx(vS, { W: t, D: n, H: Math.min(e("ch"), r - 0.05), op: o }),')

rep('    y = zv[n] ?? zv.paint,\n    w = Math.min(r, y.op ?? 1);\n  return (\n    Gi(({ camera: _ }, M) => {\n      const S = c.current,',
    '    y = zv[n] ?? zv.paint,\n    w = Math.min(r, y.op ?? 1),\n    irm = ye((q_) => q_.renderMode) === "ir";\n  return (\n    Gi(({ camera: _ }, M) => {\n      irm && hS(irAmb(), wt.sim.amb.T, wt.sim.amb.T);\n      const S = c.current,')
rep('''            x.jsx("meshStandardMaterial", {
              ref: d,
              color: y.color,
              roughness: y.rough,
              metalness: y.metal,
            }),''','''            x.jsx("meshStandardMaterial", {
              ref: d,
              key: irm ? "ir" : "pbr",
              color: irm ? "#c9cacc" : y.color,
              roughness: irm ? 0.82 : y.rough,
              metalness: irm ? 0 : y.metal,
              toneMapped: !irm,
              onBeforeCompile: irm ? (sh) => irPatch(sh, irAmb().uniforms, 0.93) : void 0,
              customProgramCacheKey: irm ? () => "irt" : void 0,
            }),''')
open(sys.argv[2], 'w', encoding='utf8').write(s)
print('ok', len(s))
