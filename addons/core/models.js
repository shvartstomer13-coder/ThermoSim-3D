/* === ThermoSim add-on: procedural 3D models for the new component types === */
function NXM_pbr({ children }) {
  return ye((m) => m.renderMode) === "ir" ? null : children;
}
function NXM_cold_plate({ c: i }) {
  const plate = (px, z, w, key) => [
    x.jsx(st, { s: [w, 0.034, w], pos: [px, 0.059, z], m: { kind: "copper", ch: "chip" } }, key + "a"),
    x.jsx(st, { s: [w * 0.92, 0.008, w * 0.92], pos: [px, 0.08, z], m: { kind: "alu", ch: "chip" } }, key + "b"),
    ...[-0.3, 0, 0.3].map((f, k) =>
      x.jsx(st, { s: [w * 0.8, 0.004, 0.006], pos: [px, 0.086, z + f * w], m: { kind: "darksteel", ch: "chip" } }, key + "f" + k),
    ),
    ...[-1, 1].map((sx, k) =>
      x.jsx(zt, { r: 0.006, h: 0.03, pos: [px + sx * w * 0.42, 0.085, z - w * 0.42], m: { kind: "steel" } }, key + "s" + k),
    ),
  ];
  return x.jsxs("group", {
    children: [
      x.jsx(st, { s: [0.6, 0.03, 0.45], pos: [0, 0.015, 0], m: { kind: "darksteel" } }),
      x.jsx(st, { s: [0.56, 0.012, 0.41], pos: [0, 0.036, 0], m: { kind: "green", ch: "body" } }),
      ...[-0.2, -0.1, 0, 0.1, 0.2].map((xx, k) =>
        x.jsx(st, { s: [0.06, 0.012, 0.03], pos: [xx, 0.048, -0.19], m: { kind: "black" } }, "mem" + k),
      ),
      ...plate(-0.13, -0.05, 0.16, "g1"),
      ...plate(0.13, -0.05, 0.16, "g2"),
      ...plate(0, 0.12, 0.1, "c1"),
      x.jsx(Gn, { r: 0.0075, h: 0.2, pos: [-0.1, 0.07, 0.12], m: { kind: "copper", ch: "fluid", ax: "x", lo: -0.2, hi: 0.1 } }),
      x.jsx(Tf, { r: 0.0075, h: 0.17, pos: [-0.2, 0.07, 0.035], m: { kind: "copper", ch: "fluid" } }),
      x.jsx(Gn, { r: 0.0075, h: 0.1, pos: [-0.2 + 0.05, 0.07, -0.05], m: { kind: "copper", ch: "fluid" } }),
      x.jsx(Gn, { r: 0.0075, h: 0.1, pos: [0, 0.07, -0.05], m: { kind: "copper", ch: "fluid" } }),
      x.jsx(Gn, { r: 0.0075, h: 0.1, pos: [0.2 - 0.05, 0.07, -0.05], m: { kind: "copper", ch: "fluid" } }),
      x.jsx(Tf, { r: 0.0075, h: 0.17, pos: [0.2, 0.07, 0.035], m: { kind: "copper", ch: "fluid" } }),
      x.jsx(Gn, { r: 0.0075, h: 0.15, pos: [0.125, 0.07, 0.12], m: { kind: "copper", ch: "fluid" } }),
      x.jsx(zt, { r: 0.015, h: 0.035, pos: [-0.2, 0.19, 0.12], m: { kind: "blue" } }),
      x.jsx(zt, { r: 0.015, h: 0.035, pos: [0.2, 0.19, 0.12], m: { kind: "red" } }),
      x.jsx(st, { s: [0.04, 0.012, 0.02], pos: [0.26, 0.05, 0.2], m: { kind: "led" }, shadow: !1 }),
    ],
  });
}
function NXM_hybrid_tower({ c: i }) {
  const e = jl(),
    tubes = ne.useMemo(() => {
      const r = [];
      for (let a = 0; a < 9; a++)
        for (let b = 0; b < 7; b++)
          r.push(Cr([0, 0.85 + a * 0.18, -0.6 + b * 0.2 + (a % 2) * 0.1], [0, 0, Math.PI / 2], [1, 1, 1]));
      return r;
    }, []),
    tubeG = ne.useMemo(() => new Wa(0.018, 0.018, 2.75, 10), []),
    louv = ne.useMemo(() => {
      const r = [];
      for (let a = 0; a < 12; a++) {
        const y = 0.82 + a * 0.14;
        (r.push(Cr([0, y, 1.105], [0.55, 0, 0])), r.push(Cr([0, y, -1.105], [-0.55, 0, 0])));
      }
      return r;
    }, []),
    louvG = ne.useMemo(() => new Vs(2.86, 0.01, 0.13), []),
    fins = ne.useMemo(() => {
      const r = [];
      for (let a = 0; a < 40; a++) r.push(Cr([-1.4 + a * 0.072, 0, 0]));
      return r;
    }, []),
    finG = ne.useMemo(() => new Vs(0.004, 0.42, 0.06), []),
    fan = (fx, k) =>
      x.jsxs(
        "group",
        {
          position: [fx, 0, 0],
          children: [
            x.jsx(zt, { r: 0.62, h: 0.5, pos: [0, 3.12, 0], open: !0, m: { kind: "galv", ch: "fan", side: zi } }),
            x.jsx(Vr, { R: 0.62, r: 0.025, rot: [Math.PI / 2, 0, 0], pos: [0, 3.37, 0], m: { kind: "galv", ch: "fan" } }),
            x.jsx(zt, { r: 0.1, h: 0.25, pos: [0, 3.05, 0], m: { kind: "darksteel", ch: "fan" } }),
            x.jsx(E0, {
              axis: "y",
              pos: [0, 3.15, 0],
              rate: () => ((e()?.fan_kw ?? 0) > 0.01 ? 10 * Math.cbrt((e()?.fan_kw ?? 0) / (i.params.fan_kw || 7.5)) : 0),
              children: Array.from({ length: 6 }, (r, s) =>
                x.jsx(
                  st,
                  {
                    s: [0.52, 0.01, 0.13],
                    pos: [Math.cos((s / 6) * 6.283) * 0.3, 0, Math.sin((s / 6) * 6.283) * 0.3],
                    rot: [0.28, -(s / 6) * 6.283, 0],
                    m: { kind: "alu", ch: "fan" },
                  },
                  s,
                ),
              ),
            }),
            ...[0, 1, 2, 3].map((s) =>
              x.jsx(st, { s: [1.2, 0.012, 0.03], pos: [0, 3.38, 0], rot: [0, (s * Math.PI) / 4, 0], m: { kind: "galv", ch: "fan" } }, "g" + s),
            ),
          ],
        },
        k,
      );
  return x.jsxs("group", {
    children: [
      x.jsx(st, { s: [3, 0.72, 2.2], pos: [0, 0.36, 0], m: { kind: "galv", ch: "basin" } }),
      x.jsx(st, { s: [2.9, 0.04, 2.1], pos: [0, 0.73, 0], m: { kind: "frp", ch: "basin" } }),
      ...[
        [-1.46, -1.06],
        [1.46, -1.06],
        [-1.46, 1.06],
        [1.46, 1.06],
      ].map(([a, b], k) => x.jsx(st, { s: [0.08, 2.1, 0.08], pos: [a, 1.8, b], m: { kind: "galv", ch: "body" } }, "p" + k)),
      x.jsx(st, { s: [0.04, 2.1, 2.2], pos: [-1.48, 1.8, 0], m: { kind: "galv", ch: "body" } }),
      x.jsx(da, { geom: louvG, mats: louv, m: { kind: "galv", ch: "body" } }),
      x.jsx(da, { geom: tubeG, mats: tubes, m: { kind: "copper", ch: "coil", ax: "y", lo: 0.85, hi: 2.3 } }),
      [-0.35, 0.35].map((z, k) =>
        x.jsx(Gn, { r: 0.045, h: 2.8, pos: [0, 2.5, z], m: { kind: "frp", ch: "body" } }, "sp" + k),
      ),
      ...Array.from({ length: 10 }, (r, s) =>
        x.jsx(zt, { r: 0.015, h: 0.06, pos: [-1.25 + s * 0.28, 2.44, s % 2 ? 0.35 : -0.35], m: { kind: "black" } }, "nz" + s),
      ),
      x.jsx(st, { s: [2.9, 0.12, 2.1], pos: [0, 2.66, 0], m: { kind: "frp", ch: "body" } }),
      ...[-1, 1].map((sz, k) =>
        x.jsxs(
          "group",
          {
            position: [0, 2.62, sz * 1.0],
            rotation: [sz * -0.35, 0, 0],
            children: [
              x.jsx(st, { s: [2.9, 0.44, 0.03], pos: [0, 0, 0], m: { kind: "alu", ch: "coil" } }),
              x.jsx(da, { geom: finG, mats: fins, m: { kind: "alu", ch: "coil" } }),
            ],
          },
          "dc" + k,
        ),
      ),
      x.jsx(st, { s: [3, 0.1, 2.2], pos: [0, 2.88, 0], m: { kind: "galv", ch: "body" } }),
      fan(-0.72, "f1"),
      fan(0.72, "f2"),
      x.jsx(st, { s: [0.14, 1.8, 0.18], pos: [1.33, 1.55, 0.45], m: { kind: "steel", ch: "coil", ax: "y", lo: 0.75, hi: 2.35 } }),
      x.jsx(Gn, { r: 0.07, h: 0.3, pos: [1.25, 0.45, -0.6], m: { kind: "blue", ch: "basin" } }),
      x.jsx(zt, { r: 0.09, h: 0.3, pos: [1.1, 0.88, -0.6], m: { kind: "blue", ch: "basin" } }),
      x.jsx(zt, { r: 0.03, h: 1.7, pos: [1.1, 1.75, -0.6], m: { kind: "steel", ch: "basin" } }),
      x.jsx(st, { s: [0.32, 0.22, 0.04], pos: [0.4, 1.2, 1.13], m: { kind: "white" } }),
      x.jsx(st, { s: [0.06, 0.03, 0.02], pos: [0.5, 1.25, 1.15], m: { kind: e()?.wet_mode ? "led" : "ledred" }, shadow: !1 }),
    ],
  });
}
function NXM_fine_filter({ c: i }) {
  const t = R0(i.params.D_mm ?? 80) * 1.08,
    gauge = (gx, k) =>
      x.jsxs(
        "group",
        {
          position: [gx, 0, 0],
          children: [
            x.jsx(zt, { r: 0.006, h: 0.09, pos: [0, 0.3 + t + 0.045, 0], m: { kind: "brass" } }),
            x.jsx(Tf, { r: 0.034, h: 0.018, pos: [0, 0.3 + t + 0.11, 0.0], m: { kind: "steel" } }),
            x.jsx(Tf, { r: 0.029, h: 0.02, pos: [0, 0.3 + t + 0.11, 0.002], m: { kind: "white" } }),
          ],
        },
        k,
      );
  return x.jsxs("group", {
    children: [
      x.jsx(zt, { r: 0.155, h: 0.66, pos: [0, 0.5, 0], m: { kind: "steel", ch: "body" } }),
      x.jsx(Si, { r: 0.155, sc: [1, 0.35, 1], pos: [0, 0.17, 0], m: { kind: "steel", ch: "body" } }),
      x.jsx(Vr, { R: 0.158, r: 0.014, rot: [Math.PI / 2, 0, 0], pos: [0, 0.8, 0], m: { kind: "darksteel" } }),
      x.jsx(zt, { r: 0.17, h: 0.03, pos: [0, 0.83, 0], m: { kind: "steel", ch: "body" } }),
      x.jsx(Si, { r: 0.16, sc: [1, 0.38, 1], pos: [0, 0.845, 0], m: { kind: "steel", ch: "body" } }),
      x.jsx(zt, { r: 0.012, h: 0.08, pos: [0, 0.94, 0], m: { kind: "brass" } }),
      x.jsx(Vr, { R: 0.03, r: 0.006, pos: [0, 0.985, 0], m: { kind: "steel" } }),
      x.jsx(Gn, { r: t, h: 0.18, pos: [-0.22, 0.3, 0], m: { kind: "steel", ch: "fluid", ax: "x", lo: -0.31, hi: -0.13 } }),
      x.jsx(Gn, { r: t, h: 0.18, pos: [0.22, 0.3, 0], m: { kind: "steel", ch: "fluid", ax: "x", lo: 0.13, hi: 0.31 } }),
      gauge(-0.22, "g1"),
      gauge(0.22, "g2"),
      ...[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2 + 0.5;
        return x.jsx(st, { s: [0.025, 0.2, 0.025], pos: [Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14], m: { kind: "darksteel" } }, "l" + k);
      }),
      x.jsx(zt, { r: 0.012, h: 0.06, pos: [0, 0.06, 0], m: { kind: "brass" } }),
      x.jsx(st, { s: [0.04, 0.008, 0.012], pos: [0.02, 0.04, 0], m: { kind: "red" } }),
      x.jsx(st, { s: [0.12, 0.07, 0.004], pos: [0, 0.52, 0.157], m: { kind: "white" } }),
    ],
  });
}
function NXM_air_separator({ c: i }) {
  const t = R0(i.params.D_mm ?? 80) * 1.08;
  return x.jsxs("group", {
    children: [
      x.jsx(zt, { r: 0.13, h: 0.62, pos: [0, 0.5, 0], m: { kind: "red", ch: "body" } }),
      x.jsx(Si, { r: 0.13, sc: [1, 0.45, 1], pos: [0, 0.81, 0], m: { kind: "red", ch: "body" } }),
      x.jsx(Si, { r: 0.13, sc: [1, 0.45, 1], pos: [0, 0.19, 0], m: { kind: "red", ch: "body" } }),
      x.jsx(Vr, { R: 0.132, r: 0.008, rot: [Math.PI / 2, 0, 0], pos: [0, 0.66, 0], m: { kind: "darksteel" } }),
      x.jsx(zt, { r: 0.018, h: 0.07, pos: [0, 0.9, 0], m: { kind: "brass" } }),
      x.jsx(zt, { r: 0.035, h: 0.09, pos: [0, 0.97, 0], m: { kind: "brass" } }),
      x.jsx(zt, { r: 0.012, h: 0.03, pos: [0, 1.03, 0], m: { kind: "black" } }),
      x.jsx(zt, { r: 0.015, h: 0.08, pos: [0, 0.1, 0], m: { kind: "brass" } }),
      x.jsx(Gn, { r: 0.012, h: 0.06, pos: [0.03, 0.05, 0], m: { kind: "brass" } }),
      x.jsx(st, { s: [0.05, 0.01, 0.014], pos: [0, 0.075, 0.02], m: { kind: "blue" } }),
      x.jsx(Gn, { r: t, h: 0.2, pos: [-0.2, 0.35, 0], m: { kind: "red", ch: "fluid", ax: "x", lo: -0.3, hi: -0.1 } }),
      x.jsx(Gn, { r: t, h: 0.2, pos: [0.2, 0.35, 0], m: { kind: "red", ch: "fluid", ax: "x", lo: 0.1, hi: 0.3 } }),
      x.jsx(st, { s: [0.1, 0.06, 0.004], pos: [0, 0.55, 0.131], m: { kind: "white" } }),
      ...[0, 1, 2].map((k) => {
        const a = (k / 3) * Math.PI * 2 + 0.5;
        return x.jsx(st, { s: [0.02, 0.12, 0.02], pos: [Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1], m: { kind: "darksteel" } }, "l" + k);
      }),
    ],
  });
}
function NXM_valve3({ c: i }) {
  const t = R0(i.params.D_mm ?? 80),
    pos = (i.params.pos_pct ?? 100) / 100;
  return x.jsxs("group", {
    children: [
      x.jsx(Gn, { r: t * 1.08, h: 0.54, pos: [0, 0.25, 0], m: { kind: "steel", ch: "body", ax: "x", lo: -0.27, hi: 0.27 } }),
      x.jsx(Tf, { r: t * 1.08, h: 0.27, pos: [0, 0.25, 0.155], m: { kind: "steel", ch: "body" } }),
      x.jsx(Si, { r: Math.max(0.09, t * 1.9), pos: [0, 0.25, 0], m: { kind: "darksteel", ch: "body" } }),
      x.jsx(zt, { r: 0.035, h: 0.14, pos: [0, 0.42, 0], m: { kind: "steel", ch: "body" } }),
      x.jsx(zt, { r: 0.06, h: 0.03, pos: [0, 0.5, 0], m: { kind: "darksteel" } }),
      x.jsx(st, { s: [0.22, 0.16, 0.15], pos: [0, 0.6, 0], m: { kind: "grey" } }),
      x.jsx(st, { s: [0.23, 0.03, 0.16], pos: [0, 0.695, 0], m: { kind: "navy" } }),
      x.jsx(Tf, { r: 0.04, h: 0.01, pos: [0, 0.6, 0.077], m: { kind: "white" } }),
      x.jsx(st, { s: [0.006, 0.035, 0.004], pos: [0, 0.6, 0.084], rot: [0, 0, (0.5 - pos) * 2.2], m: { kind: "red" } }),
      x.jsx(zt, { r: 0.012, h: 0.04, pos: [0.08, 0.66, -0.04], rot: [0, 0, -0.6], m: { kind: "black" } }),
      x.jsx(st, { s: [0.025, 0.012, 0.012], pos: [-0.07, 0.66, 0.077], m: { kind: "led" }, shadow: !1 }),
      x.jsx(st, { s: [0.28, 0.012, 0.22], pos: [0, 0.003, 0], m: { kind: "darksteel" } }),
    ],
  });
}
function NXM_balancing_valve({ c: i }) {
  const e = i.params.D_mm ?? 50,
    t = R0(e),
    s = Ol((i.params.turns ?? 8) / Math.max(i.params.turns_max ?? 8, 1), 0, 1);
  return x.jsxs(ep, {
    c: i,
    dn: e,
    len: 0.5,
    children: [
      x.jsx(Si, { r: Math.max(0.07, t * 1.7), sc: [1.35, 1, 1], pos: [0, 0.2, 0], m: { kind: "red", ch: "body" } }),
      x.jsx(zt, { r: 0.03, h: 0.14 + 0.03 * s, pos: [0, 0.3 + t, 0], m: { kind: "red", ch: "body" } }),
      x.jsx(zt, { r: 0.022, h: 0.05, pos: [0, 0.39 + t + 0.03 * s, 0], m: { kind: "white" } }),
      x.jsx(Vr, { R: 0.075, r: 0.012, rot: [Math.PI / 2, 0, 0], pos: [0, 0.43 + t + 0.03 * s, 0], m: { kind: "red" } }),
      ...[0, 1, 2, 3].map((k) =>
        x.jsx(st, { s: [0.15, 0.01, 0.014], pos: [0, 0.43 + t + 0.03 * s, 0], rot: [0, (k * Math.PI) / 4, 0], m: { kind: "red" } }, "sp" + k),
      ),
      ...[-1, 1].map((sx, k) =>
        x.jsxs(
          "group",
          {
            position: [sx * 0.07, 0.2 + t * 1.2, 0.05],
            rotation: [0.6, 0, sx * 0.4],
            children: [
              x.jsx(zt, { r: 0.008, h: 0.06, pos: [0, 0.03, 0], m: { kind: "brass" } }),
              x.jsx(zt, { r: 0.011, h: 0.016, pos: [0, 0.065, 0], m: { kind: sx < 0 ? "red" : "blue" } }),
            ],
          },
          "mn" + k,
        ),
      ),
    ],
  });
}
/* GB200-style rack: 18 compute trays (2 superchips each: 2 GPU + 1 CPU cold plates per superchip),
   9 switch trays, rear supply/return manifolds and one quick-disconnect pair per tray */
function NXM_rack({ c: i }) {
  jl();
  const lod = ne.useRef(null),
    lodV = ne.useMemo(() => new q(), []);
  Gi(({ camera }) => {
    const g = lod.current;
    g && (g.getWorldPosition(lodV), (g.visible = camera.position.distanceTo(lodV) < 11));
  });
  const slots = ne.useMemo(() => {
      const r = [];
      for (let k = 0; k < 27; k++) r.push({ y: 0.17 + k * 0.068, sw: k >= 8 && k < 17 });
      return r;
    }, []),
    G = ne.useMemo(
      () => ({
        pan: new Vs(0.72, 0.008, 0.9),
        sw: new Vs(0.72, 0.042, 0.9),
        bez: new Vs(0.72, 0.012, 0.02),
        led: new Vs(0.02, 0.01, 0.008),
        gpu: new Vs(0.1, 0.02, 0.1),
        cap: new Vs(0.085, 0.004, 0.085),
        cpu: new Vs(0.07, 0.018, 0.07),
        hdr: new Wa(0.006, 0.006, 0.56, 8),
        tube: new Wa(0.005, 0.005, 0.36, 8),
        hose: new Wa(0.009, 0.009, 0.12, 10),
        qd: new Wa(0.014, 0.014, 0.035, 12),
        brd: new Vs(0.3, 0.004, 0.5),
      }),
      [],
    ),
    M = ne.useMemo(() => {
      const m = { pan: [], sw: [], bez: [], led: [], gpu: [], cap: [], cpu: [], hs: [], hr: [], ts: [], tr: [], hoS: [], hoR: [], qd: [], brd: [] },
        Z = [Math.PI / 2, 0, 0],
        X = [0, 0, Math.PI / 2];
      for (const s of slots) {
        const y = s.y;
        (m.bez.push(Cr([0, y - 0.012, 0.565])), m.led.push(Cr([0.3, y - 0.008, 0.578])));
        if (s.sw) {
          m.sw.push(Cr([0, y + 0.012, 0.08]));
          continue;
        }
        m.pan.push(Cr([0, y - 0.016, 0.08]));
        for (const mx of [-0.17, 0.17]) {
          (m.brd.push(Cr([mx, y - 0.01, 0.1])),
            m.gpu.push(Cr([mx - 0.065, y + 0.002, 0.16]), Cr([mx + 0.065, y + 0.002, 0.16])),
            m.cap.push(Cr([mx - 0.065, y + 0.014, 0.16]), Cr([mx + 0.065, y + 0.014, 0.16])),
            m.cpu.push(Cr([mx, y + 0.001, -0.03])),
            m.ts.push(Cr([mx - 0.02, y + 0.018, -0.04], Z)),
            m.tr.push(Cr([mx + 0.02, y + 0.018, -0.04], Z)));
        }
        (m.hs.push(Cr([0, y + 0.018, -0.24], X)),
          m.hr.push(Cr([0, y + 0.018, -0.29], X)),
          m.hoS.push(Cr([-0.22, y + 0.01, -0.36], Z)),
          m.hoR.push(Cr([0.22, y + 0.01, -0.36], Z)),
          m.qd.push(Cr([-0.22, y + 0.01, -0.43], Z), Cr([0.22, y + 0.01, -0.43], Z)));
      }
      return m;
    }, [slots]),
    I = (g, mats, m, sh = !0) => x.jsx(da, { geom: g, mats, m, shadow: sh });
  return x.jsxs("group", {
    children: [
      x.jsx(st, { s: [0.8, 0.08, 1.25], pos: [0, 0.04, 0], m: { kind: "black" } }),
      [
        [-0.39, -0.6],
        [0.39, -0.6],
        [-0.39, 0.6],
        [0.39, 0.6],
      ].map(([a, c], d) => x.jsx(st, { s: [0.03, 1.96, 0.03], pos: [a, 1.06, c], m: { kind: "darksteel" } }, d)),
      x.jsx(st, { s: [0.8, 0.04, 1.25], pos: [0, 2.02, 0], m: { kind: "black" } }),
      x.jsx(NXM_pbr, { children: x.jsx(st, { s: [0.012, 1.92, 1.2], pos: [-0.395, 1.06, 0], m: { kind: "glass", ch: "body", ax: "y", lo: 0, hi: 2 } }) }),
      x.jsx(NXM_pbr, { children: x.jsx(st, { s: [0.012, 1.92, 1.2], pos: [0.395, 1.06, 0], m: { kind: "glass", ch: "body", ax: "y", lo: 0, hi: 2 } }) }),
      x.jsx(NXM_pbr, { children: x.jsx(st, { s: [0.78, 1.92, 0.012], pos: [0, 1.06, -0.6], m: { kind: "glass", ch: "body", ax: "y", lo: 0, hi: 2 } }) }),
      x.jsx(st, { s: [0.76, 0.02, 1.2], pos: [0, 0.095, 0], m: { kind: "darksteel" } }),
      I(G.pan, M.pan, { kind: "galv" }),
      I(G.sw, M.sw, { kind: "grey", ch: "body" }),
      I(G.bez, M.bez, { kind: "black" }),
      I(G.led, M.led, { kind: "led" }, !1),
      x.jsxs("group", { ref: lod, children: [
      I(G.brd, M.brd, { kind: "green", ch: "body" }),
      I(G.gpu, M.gpu, { kind: "copper", ch: "chip", ax: "y", lo: 0.1, hi: 2 }),
      I(G.cap, M.cap, { kind: "alu", ch: "chip", ax: "y", lo: 0.1, hi: 2 }),
      I(G.cpu, M.cpu, { kind: "copper", ch: "chip", ax: "y", lo: 0.1, hi: 2 }),
      I(G.hdr, M.hs, { kind: "blue", ch: "sup" }),
      I(G.hdr, M.hr, { kind: "red", ch: "ret" }),
      I(G.tube, M.ts, { kind: "copper", ch: "sup" }),
      I(G.tube, M.tr, { kind: "copper", ch: "ret" }),
      I(G.hose, M.hoS, { kind: "blue", ch: "sup" }),
      I(G.hose, M.hoR, { kind: "red", ch: "ret" }),
      I(G.qd, M.qd, { kind: "brass" }),
      ] }),
      x.jsx(zt, { r: 0.026, h: 1.88, pos: [-0.22, 1.06, -0.47], m: { kind: "steel", ch: "sup", ax: "y", lo: 0.1, hi: 2 } }),
      x.jsx(zt, { r: 0.026, h: 1.88, pos: [0.22, 1.06, -0.47], m: { kind: "steel", ch: "ret", ax: "y", lo: 0.1, hi: 2 } }),
      x.jsx(zt, { r: 0.03, h: 0.02, pos: [-0.22, 1.95, -0.47], m: { kind: "blue" } }),
      x.jsx(zt, { r: 0.03, h: 0.02, pos: [0.22, 1.95, -0.47], m: { kind: "red" } }),
      x.jsx(Tf, { r: 0.022, h: 0.47, pos: [-0.22, 2.0, -0.235], m: { kind: "steel", ch: "sup" } }),
      x.jsx(Tf, { r: 0.022, h: 0.47, pos: [0.22, 2.0, -0.235], m: { kind: "steel", ch: "ret" } }),
      x.jsx(Si, { r: 0.024, pos: [-0.22, 2.0, -0.47], m: { kind: "steel", ch: "sup" } }),
      x.jsx(Si, { r: 0.024, pos: [0.22, 2.0, -0.47], m: { kind: "steel", ch: "ret" } }),
      x.jsx(st, { s: [0.1, 0.05, 0.02], pos: [0, 1.95, 0.61], m: { kind: "screen" }, shadow: !1 }),
    ],
  });
}
/* Open induced-draft cooling tower with a cut-away front: spray system, fill, drift eliminator,
   falling water and basin are visible */
function NXM_ct({ c: i }) {
  const e = jl(),
    N = 180,
    drops = ne.useMemo(
      () => Array.from({ length: N }, (r, k) => ({ x: Math.sin(k * 12.9898) * 1.3, z: Math.cos(k * 78.233) * 1.3, ph: (k * 0.6180339) % 1 })),
      [],
    ),
    dref = ne.useRef(null),
    clk = ne.useRef(0),
    mtx = ne.useMemo(() => new kt(), []),
    dG = ne.useMemo(() => new Wa(0.012, 0.012, 0.07, 6), []),
    louv = ne.useMemo(() => {
      const r = [];
      for (let s = 0; s < 18; s++) {
        const o = 0.95 + s * 0.1;
        (r.push(Cr([0, o, -1.505], [-0.5, 0, 0])),
          r.push(Cr([1.505, o, 0], [0.5, Math.PI / 2, 0], [1, 1, 1], "YXZ")),
          r.push(Cr([-1.505, o, 0], [-0.5, Math.PI / 2, 0], [1, 1, 1], "YXZ")));
      }
      return r;
    }, []),
    louvG = ne.useMemo(() => new Vs(2.9, 0.012, 0.16), []),
    fill = ne.useMemo(() => Array.from({ length: 28 }, (r, k) => Cr([-1.35 + k * 0.1, 1.5, 0], [0, 0, (k % 2 ? 1 : -1) * 0.06])), []),
    fillG = ne.useMemo(() => new Vs(0.012, 0.95, 2.8), []),
    drift = ne.useMemo(() => Array.from({ length: 26 }, (r, k) => Cr([-1.35 + k * 0.108, 2.62, 0], [0, 0, 0.6])), []),
    driftG = ne.useMemo(() => new Vs(0.01, 0.14, 2.8), []),
    noz = ne.useMemo(() => {
      const r = [];
      for (const z of [-1.0, -0.5, 0, 0.5, 1.0]) for (const xx of [-1.1, -0.55, 0, 0.55, 1.1]) r.push(Cr([xx, 2.2, z]));
      return r;
    }, []),
    nozG = ne.useMemo(() => new Wa(0.03, 0.012, 0.06, 10), []),
    sprayG = ne.useMemo(() => new Wa(0.02, 0.2, 0.22, 14, 1, !0), []),
    spray = ne.useMemo(() => noz.map((m) => m.clone().premultiply(Cr([0, -0.14, 0]))), [noz]);
  Gi((r, dt) => {
    const M = dref.current;
    if (!M) return;
    const on = Math.abs(e()?.mdot ?? 0) > 0.05 ? 1 : 0;
    clk.current += Math.min(dt, 0.05) * 0.9 * on;
    for (let k = 0; k < N; k++) {
      const d = drops[k],
        y = 2.12 - ((clk.current + d.ph) % 1) * 1.3;
      (mtx.makeTranslation(d.x, y, d.z), M.setMatrixAt(k, mtx));
    }
    M.instanceMatrix.needsUpdate = !0;
  });
  return x.jsxs("group", {
    children: [
      x.jsx(st, { s: [3.1, 0.06, 3.1], pos: [0, 0.03, 0], m: { kind: "concrete", ch: "basin" } }),
      x.jsx(st, { s: [3.1, 0.85, 0.1], pos: [0, 0.425, -1.5], m: { kind: "concrete", ch: "basin" } }),
      x.jsx(st, { s: [0.1, 0.85, 3.1], pos: [-1.5, 0.425, 0], m: { kind: "concrete", ch: "basin" } }),
      x.jsx(st, { s: [0.1, 0.85, 3.1], pos: [1.5, 0.425, 0], m: { kind: "concrete", ch: "basin" } }),
      x.jsx(st, { s: [3.1, 0.55, 0.1], pos: [0, 0.275, 1.5], m: { kind: "concrete", ch: "basin" } }),
      x.jsx(NXM_pbr, { children: x.jsx(st, { s: [2.9, 0.62, 2.9], pos: [0, 0.37, 0], m: { kind: "glass", ch: "basin", color: "#3b82c4", opacity: 0.7 } }) }),
      [
        [-1.45, -1.45],
        [1.45, -1.45],
        [-1.45, 1.45],
        [1.45, 1.45],
      ].map(([r, s], o) => x.jsx(st, { s: [0.1, 2.0, 0.1], pos: [r, 1.85, s], m: { kind: "frp", ch: "upper", ax: "y", lo: 0.9, hi: 2.8 } }, "p" + o)),
      x.jsx(st, { s: [3.0, 0.06, 0.06], pos: [0, 0.88, 1.47], m: { kind: "frp" } }),
      x.jsx(da, { geom: louvG, mats: louv, m: { kind: "frp", ch: "upper", ax: "y", lo: 0.9, hi: 2.8 } }),
      x.jsx(da, { geom: fillG, mats: fill, m: { kind: "white", ch: "upper", ax: "y", lo: 1.0, hi: 2.0 } }),
      x.jsx(st, { s: [2.8, 0.03, 2.8], pos: [0, 1.0, 0], m: { kind: "darksteel" } }),
      x.jsx(Gn, { r: 0.07, h: 2.9, pos: [0, 2.3, 0], m: { kind: "frp", ch: "upper" } }),
      [-1.0, -0.5, 0, 0.5, 1.0].map((z, k) => x.jsx(Gn, { r: 0.035, h: 2.6, pos: [0, 2.26, z], m: { kind: "frp", ch: "upper" } }, "lat" + k)),
      x.jsx(Tf, { r: 0.05, h: 2.2, pos: [0, 2.3, 0], m: { kind: "frp", ch: "upper" } }),
      x.jsx(da, { geom: nozG, mats: noz, m: { kind: "black" } }),
      x.jsx(NXM_pbr, { children: x.jsx(da, { geom: sprayG, mats: spray, m: { kind: "glass", color: "#9fd3ff", opacity: 0.35 }, shadow: !1 }) }),
      x.jsx("instancedMesh", {
        ref: dref,
        args: [dG, void 0, N],
        frustumCulled: !1,
        children: x.jsx(br, { kind: "glass", color: "#5aa9f0", opacity: 0.85 }),
      }),
      x.jsx(da, { geom: driftG, mats: drift, m: { kind: "frp", ch: "upper" } }),
      x.jsx(st, { s: [3.1, 0.16, 3.1], pos: [0, 2.88, 0], m: { kind: "frp", ch: "upper", ax: "y", lo: 0.9, hi: 2.8 } }),
      x.jsx(zt, { r: 0.95, h: 0.5, pos: [0, 3.2, 0], open: !0, m: { kind: "frp", ch: "fan", side: zi } }),
      x.jsx(Vr, { R: 0.95, r: 0.03, rot: [Math.PI / 2, 0, 0], pos: [0, 3.45, 0], m: { kind: "galv", ch: "fan" } }),
      x.jsx(zt, { r: 0.12, h: 0.3, pos: [0, 3.1, 0], m: { kind: "darksteel", ch: "fan" } }),
      x.jsx(E0, {
        axis: "y",
        pos: [0, 3.2, 0],
        rate: () => ((e()?.fan_kw ?? 0) > 0.01 ? 11 * Math.cbrt((e()?.fan_kw ?? 0) / (i.params.fan_kw || 15)) : 0),
        children: Array.from({ length: 8 }, (r, s) =>
          x.jsx(
            st,
            {
              s: [0.8, 0.012, 0.16],
              pos: [Math.cos((s / 8) * 6.283) * 0.5, 0, Math.sin((s / 8) * 6.283) * 0.5],
              rot: [0.25, -(s / 8) * 6.283, 0],
              m: { kind: "alu", ch: "fan" },
            },
            s,
          ),
        ),
      }),
      x.jsx(zt, { r: 0.06, h: 1.3, pos: [1.52, 1.7, 0], m: { kind: "steel", ch: "p:in", ax: "y", lo: 0.9, hi: 3 } }),
      x.jsx(Gn, { r: 0.06, h: 1.5, pos: [0.8, 2.36, 0], m: { kind: "steel", ch: "p:in" } }),
      x.jsx(st, { s: [0.1, 0.25, 0.1], pos: [1.45, 0.75, 0.8], m: { kind: "steel", ch: "p:out" } }),
    ],
  });
}

/* === Trim chiller: supports so nothing floats (skid, saddles, frame, compressor stand, refrigerant lines) === */
function NXM_chSup() {
  const zc = 0.45,
    out = [];
  // evaporator saddles (shell bottom at y=0.32, skid top at y=0.12)
  [-1.25, 0.0].forEach((px, k) =>
    out.push(x.jsx(st, { s: [0.12, 0.2, 0.8], pos: [px, 0.22, zc], m: { kind: "darksteel" } }, "es" + k)),
  );
  // condenser frame: 2 columns + cross-beams (condenser bottom at y=1.14)
  [0.11, 0.79].forEach((pz, k) =>
    out.push(x.jsx(st, { s: [0.08, 0.96, 0.08], pos: [1.45, 0.6, pz], m: { kind: "steel" } }, "cc" + k)),
  );
  out.push(x.jsx(st, { s: [0.12, 0.06, 0.9], pos: [1.45, 1.11, zc], m: { kind: "steel" } }, "cb1"));
  out.push(x.jsx(st, { s: [0.12, 0.06, 0.9], pos: [-0.1, 1.11, zc], m: { kind: "steel" } }, "cb2"));
  // compressor stand (motor bottom at y=0.70)
  [-0.3, 0.3].forEach((px, k) =>
    out.push(x.jsx(st, { s: [0.14, 0.58, 0.5], pos: [px, 0.41, -0.38], m: { kind: "darksteel" } }, "cp" + k)),
  );
  // suction line: evaporator -> compressor (along z at y=0.78)
  out.push(x.jsx(zt, { r: 0.05, h: 0.28, pos: [0.0, 0.78, -0.05], rot: [Math.PI / 2, 0, 0], m: { kind: "copper", ch: "evap" } }, "suc"));
  // discharge line: compressor -> condenser (along z at y=1.18)
  out.push(x.jsx(zt, { r: 0.045, h: 0.5, pos: [0.35, 1.18, 0.08], rot: [Math.PI / 2, 0, 0], m: { kind: "copper", ch: "cond" } }, "dis"));
  return out;
}
