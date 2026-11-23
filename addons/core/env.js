/* === Industrial-site surroundings: sky, fog, asphalt yard, concrete plant pad, factory buildings,
   stacks, water tower, pipe rack, containers, light poles. Static, instanced, no shadows cast. === */
function NXE_tex(w, h, draw, rx, ry) {
  const c = document.createElement("canvas");
  ((c.width = w), (c.height = h), draw(c.getContext("2d"), w, h));
  const t = new Hy(c);
  return ((t.wrapS = t.wrapT = ha), t.repeat.set(rx, ry), (t.colorSpace = oi), (t.anisotropy = 4), t);
}
function NXE_rng(s) {
  return () => ((s = (s * 1664525 + 1013904223) >>> 0), s / 4294967296);
}
function NXE_env() {
  const mode = ye((s) => s.renderMode),
    dark = ye((s) => s.theme) === "dark",
    amb = ne.useRef({ amb: [300, 300] });
  Gi(() => {
    const s = wt.sim.amb.T;
    amb.current = { amb: [s, s], wall: [s, s] };
  });
  const T = ne.useMemo(() => {
      const R = NXE_rng(7);
      return {
        asph: NXE_tex(
          512,
          512,
          (g, w, h) => {
            g.fillStyle = "#6a6c6f";
            g.fillRect(0, 0, w, h);
            const im = g.getImageData(0, 0, w, h);
            for (let k = 0; k < im.data.length; k += 4) {
              const v = (R() - 0.5) * 46;
              ((im.data[k] += v), (im.data[k + 1] += v), (im.data[k + 2] += v));
            }
            g.putImageData(im, 0, 0);
            for (let k = 0; k < 40; k++)
              ((g.fillStyle = `rgba(0,0,0,${0.03 + R() * 0.06})`), g.beginPath(), g.arc(R() * w, R() * h, 8 + R() * 40, 0, 6.283), g.fill());
            g.strokeStyle = "rgba(20,20,20,.35)";
            for (let k = 0; k < 6; k++) {
              (g.beginPath(), g.moveTo(R() * w, R() * h));
              for (let j = 0; j < 6; j++) g.lineTo(R() * w, R() * h);
              ((g.lineWidth = 1 + R()), g.stroke());
            }
          },
          60,
          60,
        ),
        conc: NXE_tex(
          256,
          256,
          (g, w, h) => {
            g.fillStyle = "#b9b7b1";
            g.fillRect(0, 0, w, h);
            const im = g.getImageData(0, 0, w, h);
            for (let k = 0; k < im.data.length; k += 4) {
              const v = (R() - 0.5) * 18;
              ((im.data[k] += v), (im.data[k + 1] += v), (im.data[k + 2] += v));
            }
            (g.putImageData(im, 0, 0), (g.strokeStyle = "rgba(60,60,60,.55)"), (g.lineWidth = 2), g.strokeRect(1, 1, w - 2, h - 2));
          },
          10,
          6,
        ),
        corr: NXE_tex(
          256,
          64,
          (g, w, h) => {
            for (let x0 = 0; x0 < w; x0++) {
              const v = 150 + 55 * Math.sin((x0 / w) * Math.PI * 2 * 16);
              ((g.fillStyle = `rgb(${v},${v + 4},${v + 8})`), g.fillRect(x0, 0, 1, h));
            }
          },
          8,
          1,
        ),
      };
    }, []),
    I = ne.useMemo(() => {
      const R = NXE_rng(31),
        rack = [],
        cont = [],
        poles = [],
        lamps = [],
        fence = [],
        win = [];
      for (let x0 = -44; x0 <= 34; x0 += 6) rack.push(Cr([x0, 3, -24]));
      const cc = [],
        cols = ["#b3261e", "#1f5fa8", "#2f7d4f", "#c9761e", "#6b7280"];
      for (let k = 0; k < 14; k++) {
        const st_ = k % 3;
        (cont.push(Cr([30 + (Math.floor(k / 3) % 5) * 2.7, 1.3 + st_ * 2.6, 22 + (k % 2) * 6.4])), cc.push(cols[Math.floor(R() * 5)]));
      }
      for (const [x0, z0] of [
        [-30, -14],
        [-30, 18],
        [14, 18],
        [14, -14],
        [-6, 22],
        [-6, -16],
        [30, 4],
      ])
        (poles.push(Cr([x0, 5, z0])), lamps.push(Cr([x0 + 0.6, 10, z0], [0, 0, 0.2])));
      for (let k = -60; k <= 60; k += 3) (fence.push(Cr([k, 1.1, 40])), fence.push(Cr([-62, 1.1, k * 0.6])));
      for (let k = 0; k < 22; k++) win.push(Cr([-30 + k * 3, 10.5, -31.1]));
      return { rack, cont, cc, poles, lamps, fence, win };
    }, []),
    G = ne.useMemo(
      () => ({
        frame: new Vs(0.3, 6, 0.3),
        cont: new Vs(2.5, 2.6, 6.1),
        pole: new Wa(0.12, 0.16, 10, 8),
        lamp: new Vs(1.2, 0.18, 0.5),
        post: new Wa(0.05, 0.05, 2.2, 6),
        win: new Vs(2.2, 1.2, 0.05),
      }),
      [],
    ),
    sky = ne.useMemo(
      () =>
        new zn({
          side: ar,
          depthWrite: !1,
          fog: !1,
          uniforms: { uTop: { value: new Tt() }, uBot: { value: new Tt() }, uSun: { value: new Tt() } },
          vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
          fragmentShader:
            "uniform vec3 uTop; uniform vec3 uBot; uniform vec3 uSun; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.08,0.0,1.0); vec3 c = mix(uBot,uTop,pow(h,0.7)); float s = pow(max(dot(vP, normalize(vec3(0.5,0.35,-0.8))),0.0),24.0); gl_FragColor = vec4(c + uSun*s, 1.0); }",
        }),
      [],
    ),
    pal = dark
      ? { top: "#0b1424", bot: "#2c3440", sun: "#3a3020", fog: "#262d38", bld: "#4a5260", roof: "#2f343c", gnd: "#4a4c50", pad: "#7a7974", winE: "#ffd27a", lampE: 2.4 }
      : { top: "#6f9fd6", bot: "#dfe6ec", sun: "#ffe8b0", fog: "#d6dde3", bld: "#c3c8cd", roof: "#8a9198", gnd: "#8d8f92", pad: "#c9c7c1", winE: "#000000", lampE: 0.2 };
  ((sky.uniforms.uTop.value.set(pal.top), sky.uniforms.uBot.value.set(pal.bot), sky.uniforms.uSun.value.set(pal.sun)));
  if (mode === "ir")
    return x.jsx(t7, {
      value: amb,
      children: x.jsxs("mesh", {
        "rotation-x": -Math.PI / 2,
        children: [x.jsx("planeGeometry", { args: [300, 300] }), x.jsx(br, { kind: "concrete", ch: "amb" })],
      }),
    });
  const B = (pos, size, color, map, key, rot) =>
    x.jsxs(
      "mesh",
      {
        position: pos,
        rotation: rot,
        receiveShadow: !0,
        children: [x.jsx("boxGeometry", { args: size }), x.jsx("meshStandardMaterial", { color, map: map ?? null, roughness: 0.85, metalness: 0.15 })],
      },
      key,
    );
  const bld = (key, p, w, h, d, rotY = 0) =>
    x.jsxs(
      "group",
      {
        position: p,
        rotation: [0, rotY, 0],
        children: [
          B([0, h / 2, 0], [w, h, d], pal.bld, T.corr, "w"),
          B([0, h + 0.3, 0], [w + 0.6, 0.6, d + 0.6], pal.roof, null, "r"),
          B([0, 0.6, d / 2 + 0.02], [w * 0.95, 1.2, 0.05], "#d6b23a", null, "s"),
          ...[-0.3, 0, 0.3].map((f, k) => B([w * f, 2.6, d / 2 + 0.03], [4, 5, 0.05], "#3a3f46", null, "dk" + k)),
        ],
      },
      key,
    );
  return x.jsxs(t7, {
    value: amb,
    children: [
      x.jsx("fog", { attach: "fog", args: [pal.fog, 70, 260] }),
      x.jsxs("mesh", { material: sky, renderOrder: -10, children: [x.jsx("sphereGeometry", { args: [400, 24, 12] })] }),
      x.jsxs("mesh", {
        "rotation-x": -Math.PI / 2,
        position: [0, -0.01, 0],
        receiveShadow: !0,
        children: [x.jsx("planeGeometry", { args: [800, 800] }), x.jsx("meshStandardMaterial", { color: pal.gnd, map: T.asph, roughness: 0.95 })],
      }),
      x.jsxs("mesh", {
        position: [-5, 0.025, 1.5],
        receiveShadow: !0,
        children: [x.jsx("boxGeometry", { args: [36, 0.05, 24] }), x.jsx("meshStandardMaterial", { color: pal.pad, map: T.conc, roughness: 0.9 })],
      }),
      ...[
        [-5, 14.2, 36, 0.25],
        [-5, -11.2, 36, 0.25],
      ].map(([x0, z0, w, d], k) => B([x0, 0.055, z0], [w, 0.01, d], "#e0b21b", null, "yl" + k)),
      ...[-23.5, 13.5].map((x0, k) => B([x0, 0.055, 1.5], [0.25, 0.01, 25.4], "#e0b21b", null, "yv" + k)),
      ...Array.from({ length: 9 }, (r, k) => B([-14 + k * 3.2, 0.03, 20], [0.15, 0.01, 5], "#e8e8e8", null, "pk" + k)),
      bld("b1", [-4, 0, -36], 72, 14, 18),
      bld("b2", [-52, 0, -6], 40, 11, 26, Math.PI / 2),
      bld("b3", [44, 0, -10], 30, 12, 26, -Math.PI / 2),
      bld("b4", [10, 0, 52], 46, 9, 16, Math.PI),
      x.jsx(da, { geom: G.win, mats: I.win, m: { kind: "glass", color: dark ? "#ffcf6e" : "#9fc3e0", opacity: 0.9 }, shadow: !1, cull: !0 }),
      ...[
        [-26, -40],
        [-18, -40],
      ].flatMap(([x0, z0], k) => [
        x.jsxs("mesh", { position: [x0, 16, z0], children: [x.jsx("cylinderGeometry", { args: [1.1, 1.5, 32, 16] }), x.jsx("meshStandardMaterial", { color: "#b9bcc0", roughness: 0.6 })] }, "s" + k),
        ...[0, 1].map((j) =>
          x.jsxs("mesh", { position: [x0, 27 + j * 3.2, z0], children: [x.jsx("cylinderGeometry", { args: [1.17 - j * 0.04, 1.2 - j * 0.04, 1.4, 16] }), x.jsx("meshStandardMaterial", { color: "#c0392b", roughness: 0.6 })] }, "sb" + k + j),
        ),
      ]),
      x.jsxs("group", {
        position: [32, 0, -24],
        children: [
          ...[
            [-2, -2],
            [2, -2],
            [-2, 2],
            [2, 2],
          ].map(([a, b], k) => x.jsxs("mesh", { position: [a, 7, b], children: [x.jsx("cylinderGeometry", { args: [0.18, 0.22, 14, 8] }), x.jsx("meshStandardMaterial", { color: "#6b7280" })] }, k)),
          x.jsxs("mesh", { position: [0, 17, 0], children: [x.jsx("cylinderGeometry", { args: [4, 4, 6, 24] }), x.jsx("meshStandardMaterial", { color: "#9aa5b1", metalness: 0.4, roughness: 0.5 })] }),
          x.jsxs("mesh", { position: [0, 20.6, 0], children: [x.jsx("coneGeometry", { args: [4.3, 1.6, 24] }), x.jsx("meshStandardMaterial", { color: "#6b7280" })] }),
        ],
      }),
      x.jsx(da, { geom: G.frame, mats: I.rack, m: { kind: "darksteel" }, shadow: !1, cull: !0 }),
      ...[
        [5.6, 0.35, "#2c7a4b"],
        [5.6, -0.35, "#9aa3ab"],
        [6.3, 0, "#c0392b"],
      ].map(([y0, z0, col], k) =>
        x.jsxs("mesh", { position: [-5, y0, -24 + z0], rotation: [0, 0, Math.PI / 2], children: [x.jsx("cylinderGeometry", { args: [0.22, 0.22, 80, 12] }), x.jsx("meshStandardMaterial", { color: col, metalness: 0.5, roughness: 0.45 })] }, "rp" + k),
      ),
      x.jsxs("instancedMesh", {
        args: [G.cont, void 0, I.cont.length],
        ref: (m) => {
          m && !m.userData.done && (I.cont.forEach((mt, k) => (m.setMatrixAt(k, mt), m.setColorAt(k, new Tt(I.cc[k])))), (m.userData.done = !0), (m.instanceMatrix.needsUpdate = !0), m.instanceColor && (m.instanceColor.needsUpdate = !0));
        },
        receiveShadow: !0,
        children: [x.jsx("meshStandardMaterial", { roughness: 0.7, metalness: 0.3 })],
      }),
      x.jsx(da, { geom: G.pole, mats: I.poles, m: { kind: "darksteel" }, shadow: !1, cull: !0 }),
      x.jsxs("instancedMesh", {
        args: [G.lamp, void 0, I.lamps.length],
        ref: (m) => {
          m && !m.userData.done && (I.lamps.forEach((mt, k) => m.setMatrixAt(k, mt)), (m.userData.done = !0), (m.instanceMatrix.needsUpdate = !0));
        },
        children: [x.jsx("meshStandardMaterial", { color: "#fff4d6", emissive: "#ffd89a", emissiveIntensity: pal.lampE })],
      }),
      x.jsx(da, { geom: G.post, mats: I.fence, m: { kind: "galv" }, shadow: !1, cull: !0 }),
      B([-1, 2.1, 40], [122, 0.06, 0.06], "#9aa3ab", null, "fr1"),
      B([-62, 2.1, 0], [0.06, 0.06, 72], "#9aa3ab", null, "fr2"),
      ...[
        [-120, -150, 40, 18, 30],
        [-40, -170, 60, 24, 30],
        [60, -160, 50, 30, 30],
        [150, -60, 30, 20, 60],
        [-160, 40, 30, 14, 50],
      ].map(([x0, z0, w, h, d], k) => B([x0, h / 2, z0], [w, h, d], pal.bld, null, "far" + k)),
    ],
  });
}

/* === Raised floor: perforated tiles only in the cold aisle, on the 600 mm grid, in front of the rack fronts === */
function NXR_ca(p) {
  return p && p.ca_rows > 0 ? { x0: p.ca_x0, x1: p.ca_x1, z: p.ca_z, rows: Math.round(p.ca_rows) } : null;
}
function NXR_tiles(W, D, H, ca) {
  const out = [],
    g = 0.6,
    x0 = -W / 2;
  for (let h = x0 + g / 2; h < W / 2; h += g)
    if (h + g / 2 > ca.x0 + 1e-6 && h - g / 2 < ca.x1 - 1e-6)
      for (let r = 0; r < ca.rows; r++) {
        const z = ca.z + g / 2 + r * g;
        Math.abs(z) < D / 2 && out.push([h, H + 0.001, z]);
      }
  return out;
}

/* === Stairs + landing outside a door that sits on the raised floor (rise <= 0.17 m, tread 0.30 m) === */
function NXR_steps({ b, s }) {
  const y0 = b.y0,
    n = b.n,
    u = b.along === "x" ? [1, 0, 0] : [0, 0, 1],
    base = [b.at[0] + n[0] * (s / 2), 0, b.at[2] + n[2] * (s / 2)],
    P = (uu, y, v) => [base[0] + u[0] * uu + n[0] * v, y, base[2] + u[2] * uu + n[2] * v],
    S3 = (su, sy, sv) => (b.along === "x" ? [su, sy, sv] : [sv, sy, su]),
    nS = Math.max(1, Math.ceil(y0 / 0.17 - 1e-6)),
    rise = y0 / nS,
    T = 0.3,
    Ld = 1.2,
    Ws = b.dw + 0.4,
    walk = (m) => {
      m && Cf.add(m);
    },
    out = [];
  out.push(
    x.jsxs(
      "mesh",
      {
        ref: walk,
        position: P(0, y0 / 2, Ld / 2),
        receiveShadow: !0,
        castShadow: !0,
        userData: { walk: !0 },
        children: [x.jsx("boxGeometry", { args: S3(Ws + 0.2, y0, Ld) }), x.jsx(br, { kind: "concrete", ch: "amb" })],
      },
      "land",
    ),
  );
  for (let j = 1; j < nS; j++) {
    const h = y0 - j * rise;
    out.push(
      x.jsxs(
        "mesh",
        {
          ref: walk,
          position: P(0, h / 2, Ld + (j - 0.5) * T),
          receiveShadow: !0,
          castShadow: !0,
          userData: { walk: !0 },
          children: [x.jsx("boxGeometry", { args: S3(Ws, h, T) }), x.jsx(br, { kind: "concrete", ch: "amb" })],
        },
        "st" + j,
      ),
    );
    out.push(x.jsx(st, { s: S3(Ws, 0.012, 0.05), pos: P(0, h + 0.006, Ld + (j - 1) * T + 0.03), m: { kind: "yellow" }, shadow: !1 }, "ns" + j));
  }
  out.push(x.jsx(st, { s: S3(Ws + 0.2, 0.012, 0.05), pos: P(0, y0 + 0.006, Ld - 0.03), m: { kind: "yellow" }, shadow: !1 }, "nsL"));
  // handrails: landing guard + sloped rail, both sides
  const rail = (p, q, key) => {
      const d = [q[0] - p[0], q[1] - p[1], q[2] - p[2]],
        L = Math.hypot(...d),
        dv = d[0] * n[0] + d[2] * n[2],
        rot = b.along === "x" ? [Math.atan2(n[2] * dv, d[1]), 0, 0] : [0, 0, Math.atan2(-n[0] * dv, d[1])];
      return x.jsxs(
        "mesh",
        {
          position: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2],
          rotation: rot,
          castShadow: !0,
          children: [x.jsx("cylinderGeometry", { args: [0.022, 0.022, L, 10] }), x.jsx(br, { kind: "steel", ch: "amb" })],
        },
        key,
      );
    },
    hr = 0.9,
    vEnd = Ld + (nS - 1) * T;
  [-1, 1].forEach((sg) => {
    const uu = sg * (Ws / 2 + 0.05);
    out.push(
      rail(P(uu, y0, 0.05), P(uu, y0 + hr, 0.05), "pa" + sg),
      rail(P(uu, y0, Ld), P(uu, y0 + hr, Ld), "pb" + sg),
      rail(P(uu, y0 + hr, 0.05), P(uu, y0 + hr, Ld), "ga" + sg),
      rail(P(uu, y0 + hr * 0.5, 0.05), P(uu, y0 + hr * 0.5, Ld), "gb" + sg),
    );
    if (nS > 1)
      out.push(
        rail(P(uu, 0, vEnd), P(uu, rise + hr, vEnd), "pc" + sg),
        rail(P(uu, y0 + hr, Ld), P(uu, rise + hr, vEnd), "gs" + sg),
      );
  });
  return x.jsx("group", { children: out });
}

/* === First run with no saved graphics choice: drop to "fast" on software rendering or when the measured frame rate is low === */
function NXQ_auto() {
  const gl = Ti((s) => s.gl),
    scn = Ti((s) => s.scene),
    st8 = ne.useRef({ t: 0, n: 0, done: !1 });
  ne.useEffect(() => {
    ct.gl = gl;
    ct.scene = scn;
    try {
      if (localStorage.getItem("ts-quality")) st8.current.done = !0;
    } catch {}
    try {
      const d = gl.getContext().getExtension("WEBGL_debug_renderer_info"),
        r = d ? String(gl.getContext().getParameter(d.UNMASKED_RENDERER_WEBGL)) : "";
      if (!st8.current.done && /swiftshader|software|llvmpipe|basic render/i.test(r)) {
        ye.setState({ quality: "fast" });
        st8.current.done = !0;
      }
    } catch {}
  }, [gl]);
  Gi((_, dt) => {
    const k = st8.current;
    if (k.done || document.hidden) return;
    k.t += dt;
    if (k.t < 2.5) return;
    if (dt > 0.25) return;
    k.n++;
    k.sum = (k.sum || 0) + dt;
    if (k.sum >= 3) {
      k.done = !0;
      k.n / k.sum < 28 && ye.setState({ quality: "fast" });
    }
  });
  return null;
}
