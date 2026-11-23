function NXQ_merge() {
  const scn = Ti((s) => s.scene),
    mode = ye((s) => s.renderMode),
    R = ne.useRef({ merged: [], srcs: [], t: 0, last: null, quiet: 0 });
  const unmerge = () => {
    const k = R.current;
    k.srcs.forEach((o) => { o.m.visible = !0; });
    k.merged.forEach((m) => { scn.remove(m); m.geometry.dispose(); m.material.dispose(); });
    k.merged = []; k.srcs = [];
  };
  ne.useEffect(() => () => unmerge(), [scn]);
  const effVis = (m) => { let v = m.parent; while (v) { if (!v.visible) return !1; v = v.parent; } return !0; };
  const snap = (list) => list.map((m) => { m.updateWorldMatrix(!0, !1); return m.matrixWorld.elements.join(); }).join("|");
  const collect = () => {
    const out = [];
    scn.traverse((m) => {
      if (!m.isMesh || m.isInstancedMesh || m.isSkinnedMesh || m.userData.nxMerged) return;
      const mt = m.material;
      if (!mt || Array.isArray(mt) || mt.type !== "MeshStandardMaterial" || mt.transparent || mt.vertexColors || m.geometry.attributes.color || mt.onBeforeCompile !== undefined && mt.onBeforeCompile.toString().length > 60 || mt.map || mt.roughnessMap || mt.bumpMap || mt.clippingPlanes) return;
      if (!m.geometry || !m.geometry.attributes.position || !m.geometry.attributes.normal) return;
      if (!m.visible || !effVis(m)) return;
      out.push(m);
    });
    return out;
  };
  const sig = (m) => { const t = m.material; return [t.color.getHex(), t.metalness, t.roughness, t.emissive.getHex(), t.emissiveIntensity, t.envMapIntensity, t.side, m.castShadow ? 1 : 0, m.receiveShadow ? 1 : 0, m.renderOrder].join("|"); };
  const doMerge = (list) => {
    const k = R.current, groups = {};
    list.forEach((m) => { (groups[sig(m)] = groups[sig(m)] || []).push(m); });
    Object.keys(groups).forEach((key) => {
      const g = groups[key];
      if (g.length < 2) return;
      let nv = 0, ni = 0;
      g.forEach((m) => { const G = m.geometry; nv += G.attributes.position.count; ni += G.index ? G.index.count : G.attributes.position.count; });
      const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3), I = new Uint32Array(ni);
      let vo = 0, io = 0;
      const v3 = [0, 0, 0];
      g.forEach((m) => {
        const G = m.geometry, e = m.matrixWorld.elements, pa = G.attributes.position, na = G.attributes.normal;
        // normal matrix (inverse transpose of upper 3x3)
        const a = e[0], b = e[4], c = e[8], d = e[1], f = e[5], h = e[9], i2 = e[2], j = e[6], l = e[10];
        const A = f * l - h * j, B = h * i2 - d * l, C = d * j - f * i2;
        const det = a * A + b * B + c * C || 1;
        const n00 = A / det, n01 = B / det, n02 = C / det,
          n10 = (c * j - b * l) / det, n11 = (a * l - c * i2) / det, n12 = (b * i2 - a * j) / det,
          n20 = (b * h - c * f) / det, n21 = (c * d - a * h) / det, n22 = (a * f - b * d) / det;
        const flip = det < 0;
        for (let q = 0; q < pa.count; q++) {
          const x0 = pa.getX(q), y0 = pa.getY(q), z0 = pa.getZ(q);
          P[(vo + q) * 3] = e[0] * x0 + e[4] * y0 + e[8] * z0 + e[12];
          P[(vo + q) * 3 + 1] = e[1] * x0 + e[5] * y0 + e[9] * z0 + e[13];
          P[(vo + q) * 3 + 2] = e[2] * x0 + e[6] * y0 + e[10] * z0 + e[14];
          const nx = na.getX(q), ny = na.getY(q), nz = na.getZ(q);
          let X = n00 * nx + n01 * ny + n02 * nz, Y = n10 * nx + n11 * ny + n12 * nz, Z = n20 * nx + n21 * ny + n22 * nz;
          const L = Math.hypot(X, Y, Z) || 1;
          N[(vo + q) * 3] = X / L; N[(vo + q) * 3 + 1] = Y / L; N[(vo + q) * 3 + 2] = Z / L;
        }
        const cnt = G.index ? G.index.count : pa.count;
        for (let q = 0; q < cnt; q += 3) {
          const i0 = G.index ? G.index.getX(q) : q, i1 = G.index ? G.index.getX(q + 1) : q + 1, i3 = G.index ? G.index.getX(q + 2) : q + 2;
          I[io + q] = vo + i0; I[io + q + 1] = vo + (flip ? i3 : i1); I[io + q + 2] = vo + (flip ? i1 : i3);
        }
        vo += pa.count; io += cnt;
      });
      const geo = new ln(), PA = g[0].geometry.attributes.position.constructor;
      geo.setAttribute("position", new PA(P, 3));
      geo.setAttribute("normal", new PA(N, 3));
      geo.setIndex(Array.from(I));
      geo.computeBoundingSphere();
      const mat = g[0].material.clone(), mesh = new di(geo, mat);
      mesh.castShadow = g[0].castShadow; mesh.receiveShadow = g[0].receiveShadow;
      mesh.renderOrder = g[0].renderOrder; mesh.matrixAutoUpdate = !1; mesh.frustumCulled = !1;
      mesh.userData.nxMerged = !0; mesh.raycast = () => {};
      scn.add(mesh);
      k.merged.push(mesh);
      g.forEach((m) => { k.srcs.push({ m, vis: !0 }); m.visible = !1; });
    });
  };
  Gi((_, dt) => {
    const k = R.current;
    if (document.hidden) return;
    k.t += dt;
    if (k.t < 0.8) return;
    k.t = 0;
    try {
      if (mode !== "pbr" || window.__NOMERGE) { if (k.merged.length) unmerge(); return; }
      if (k.merged.length) {
        // verify sources still valid (unchanged transform, parent chain visible, still attached)
        const cur = snap(k.srcs.map((o) => o.m));
        let bad = cur !== k.snapStr;
        if (!bad) bad = k.srcs.some((o) => !o.m.parent || !effVis(o.m));
        if (!bad) { if (collect().length !== k.restN) bad = !0; }
        if (bad) { unmerge(); k.quiet = 0; k.last = null; }
        return;
      }
      const list = collect(), prev = k.prev || new Map(), dyn = k.dyn || (k.dyn = new Set()), cnt = k.cnt || (k.cnt = new Map());
      const nxt = new Map();
      list.forEach((m) => {
        m.updateWorldMatrix(!0, !1);
        const e = m.matrixWorld.elements.join();
        nxt.set(m, e);
        if (prev.has(m)) { if (prev.get(m) === e) cnt.set(m, (cnt.get(m) || 0) + 1); else { dyn.add(m); cnt.set(m, 0); } }
      });
      k.prev = nxt;
      const stable = list.filter((m) => !dyn.has(m) && (cnt.get(m) || 0) >= 2);
      if (stable.length > 20 && stable.length >= list.length * 0.6) { doMerge(stable); k.snapStr = snap(k.srcs.map((o) => o.m)); k.restN = collect().length; k.prev = null; }
    } catch (e) { console.warn("merge", e); }
  });
  return null;
}
