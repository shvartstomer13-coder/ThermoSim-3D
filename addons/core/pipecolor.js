/* === Pipe colour by fluid temperature (PBR view) === */
const NXP = { lo: 293, hi: 323, mn: 1e9, mx: -1e9, t: 0, leg: null };
function NXP_tick(Ta, Tb) {
  (Ta < NXP.mn && (NXP.mn = Ta), Tb < NXP.mn && (NXP.mn = Tb), Ta > NXP.mx && (NXP.mx = Ta), Tb > NXP.mx && (NXP.mx = Tb));
  const now = performance.now();
  if (now - NXP.t < 400) return;
  if (((NXP.t = now), NXP.mx > NXP.mn)) {
    const lo = Math.floor(NXP.mn - 0.5),
      hi = Math.max(Math.ceil(NXP.mx + 0.5), lo + 8);
    ((NXP.lo += (lo - NXP.lo) * 0.5), (NXP.hi += (hi - NXP.hi) * 0.5));
  }
  ((NXP.mn = 1e9), (NXP.mx = -1e9), NXP_legend());
}
function NXP_mat(baseColor, rough) {
  const u = {
      uTa: { value: 300 },
      uTb: { value: 300 },
      uLo: { value: NXP.lo },
      uHi: { value: NXP.hi },
      uLut: { value: Ef("coolwarm") },
    },
    m = new Qf({ color: "#ffffff", metalness: 0.25, roughness: rough ?? 0.45 });
  return (
    (m.userData.u = u),
    (m.onBeforeCompile = (sh) => {
      (Object.assign(sh.uniforms, u),
        (sh.vertexShader = sh.vertexShader
          .replace("#include <common>", "#include <common>\nattribute float nxu;\nvarying float vNxU;")
          .replace("#include <begin_vertex>", "#include <begin_vertex>\nvNxU = nxu;")),
        (sh.fragmentShader = sh.fragmentShader
          .replace(
            "#include <common>",
            "#include <common>\nvarying float vNxU;\nuniform float uTa; uniform float uTb; uniform float uLo; uniform float uHi; uniform sampler2D uLut;",
          )
          .replace(
            "vec4 diffuseColor = vec4( diffuse, opacity );",
            "float nxT = mix(uTa, uTb, clamp(vNxU, 0.0, 1.0));\nfloat nxK = clamp((nxT - uLo) / max(uHi - uLo, 0.001), 0.0, 1.0);\nvec4 diffuseColor = vec4( texture2D(uLut, vec2(nxK * 0.996 + 0.002, 0.5)).rgb, opacity );",
          )));
    }),
    (m.customProgramCacheKey = () => "nxpipeT"),
    m
  );
}
function NXP_geo(g) {
  if (g && !g.attributes.nxu && g.attributes.uv) {
    const uv = g.attributes.uv,
      a = new Float32Array(uv.count);
    for (let k = 0; k < uv.count; k++) a[k] = uv.getX(k);
    g.setAttribute("nxu", new (g.attributes.uv.constructor)(a, 1));
  }
  return g;
}
function NXP_legend() {
  try {
    const cv = document.querySelector("canvas"),
      host = cv?.parentElement?.parentElement;
    if (!host) return;
    const show = ye.getState().renderMode === "pbr";
    let d = NXP.leg;
    if (!d || !d.isConnected) {
      ((d = document.createElement("div")),
        (d.style.cssText =
          "position:absolute;left:72px;bottom:14px;z-index:5;padding:6px 8px;border-radius:8px;background:rgba(15,23,42,.72);color:#e2e8f0;font:11px Heebo,Arial,sans-serif;pointer-events:none;direction:rtl;min-width:150px"));
      const stops = [];
      for (let k = 0; k <= 10; k++) {
        const c = uS(vk, k / 10);
        stops.push(`rgb(${c.map(Math.round).join(",")}) ${k * 10}%`);
      }
      ((d.innerHTML =
        '<div style="margin-bottom:3px">טמפ׳ הנוזל בצנרת</div><div style="height:8px;border-radius:4px;background:linear-gradient(to right,' +
        stops.join(",") +
        ')"></div><div style="display:flex;justify-content:space-between;direction:ltr;margin-top:2px"><span class="nxlo"></span><span class="nxhi"></span></div>'),
        getComputedStyle(host).position === "static" && (host.style.position = "relative"),
        host.appendChild(d),
        (NXP.leg = d));
    }
    ((d.style.display = show ? "block" : "none"),
      (d.querySelector(".nxlo").textContent = (NXP.lo - 273.15).toFixed(0) + " °C"),
      (d.querySelector(".nxhi").textContent = (NXP.hi - 273.15).toFixed(0) + " °C"));
  } catch (e) {}
}
