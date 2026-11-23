/* === UPS line-up (battery cabinets + modular UPS frame + output distribution) and the room's power distribution === */

/* Live data of the UPS: computed from the loads it feeds (racks, CDU pump, CRAH fan), not from a fluid network. */
function NXU_tele(c, sim) {
  const p = c.params,
    comps = sim.scene.comps;
  let Pit = 0,
    Pmech = 0;
  for (const k of comps) {
    if (k.type === "rack") Pit += ((k.params.tdp_kw ?? 0) * (k.params.util_pct ?? 100)) / 100;
    if (p.mech_on_ups && k.type === "cdu") {
      const t = sim.telemetry.get(k.id);
      t && typeof t.W_shaft == "number" && (Pmech += t.W_shaft / (p.motor_eff_pct / 100));
    }
    if (p.mech_on_ups && k.type === "crah") {
      const t = sim.telemetry.get(k.id);
      t && typeof t.fan_kw == "number" && (Pmech += t.fan_kw);
    }
  }
  const Pout = Pit + Pmech,
    eta = p.eta_pct / 100,
    Pin = Pout / eta,
    nNeed = Math.ceil(Pout / p.module_kw - 1e-9),
    I = (P) => (P * 1e3) / (Math.sqrt(3) * p.V_ll * p.pf);
  return {
    ups_P_it: Pit,
    ups_P_mech: Pmech,
    ups_P_out: Pout,
    ups_load_pct: (100 * Pout) / p.rating_kw,
    ups_mod_need: nNeed,
    ups_redund: p.modules - nNeed,
    ups_eta: p.eta_pct,
    ups_P_in: Pin,
    Q_loss: Pin - Pout,
    ups_autonomy: Pout > 0 ? (60 * p.batt_kwh * (p.batt_eff_pct / 100)) / Pout : 0,
    ups_I_out: I(Pout),
    ups_I_bus: I(Pit) / 2,
    ups_I_bus_fail: I(Pit),
  };
}

function NXM_ups({ c: i }) {
  jl();
  const D = 0.9,
    Hc = 2.0,
    pl = 0.08,
    cab = [
      { x: -1.6, w: 0.8, k: "bat" },
      { x: -0.8, w: 0.8, k: "bat" },
      { x: 0.4, w: 1.6, k: "ups" },
      { x: 1.6, w: 0.8, k: "pdu" },
    ],
    G = ne.useMemo(
      () => ({
        louv: new Vs(0.6, 0.012, 0.01),
        mod: new Vs(0.07, 0.035, 0.012),
        brk: new Vs(0.05, 0.09, 0.03),
        led: new Vs(0.016, 0.016, 0.01),
        fan: new Wa(0.055, 0.055, 0.012, 20),
      }),
      [],
    ),
    M = ne.useMemo(() => {
      const m = { louv: [], mod: [], brk: [], ledg: [], fan: [] },
        zf = D / 2 + 0.008,
        R = [Math.PI / 2, 0, 0];
      // battery cabinets: 9 Li-ion module shelves with status windows + louvres
      for (const cb of cab.filter((q) => q.k === "bat")) {
        for (let s = 0; s < 9; s++) {
          const y = 0.25 + s * 0.17;
          (m.mod.push(Cr([cb.x - 0.2, y, zf])), m.ledg.push(Cr([cb.x + 0.22, y, zf])));
        }
        for (let s = 0; s < 6; s++) m.louv.push(Cr([cb.x, 1.72 + s * 0.035, zf]));
      }
      // UPS frame: 5 hot-swap power modules, each with 2 fans and a status LED
      for (let s = 0; s < 5; s++) {
        const y = 0.3 + s * 0.24;
        for (const fx of [-0.3, 0.3]) m.fan.push(Cr([0.4 + fx, y, zf], R));
        m.ledg.push(Cr([0.4 + 0.62, y, zf]));
      }
      // output distribution: breaker rows (A feeders left, B feeders right)
      for (let r = 0; r < 4; r++)
        for (let s = 0; s < 5; s++) m.brk.push(Cr([1.6 - 0.27 + s * 0.065 + (s > 1 ? 0.08 : 0), 0.55 + r * 0.22, zf]));
      return m;
    }, []),
    I = (g, mats, m) => x.jsx(da, { geom: g, mats, m, shadow: !1 });
  return x.jsxs("group", {
    children: [
      x.jsx(st, { s: [4.0, pl, D], pos: [0, pl / 2, 0], m: { kind: "black" } }),
      cab.map((q) =>
        x.jsxs(
          "group",
          {
            children: [
              x.jsx(st, { s: [q.w - 0.012, Hc - pl, D], pos: [q.x, pl + (Hc - pl) / 2, 0], m: { kind: q.k === "bat" ? "darksteel" : "black", ch: "body" } }),
              x.jsx(st, { s: [q.w - 0.06, 0.06, 0.012], pos: [q.x, Hc - 0.09, D / 2 + 0.004], m: { kind: q.k === "pdu" ? "red" : q.k === "ups" ? "white" : "steel" }, shadow: !1 }),
              x.jsx(st, { s: [0.025, 0.25, 0.03], pos: [q.x + q.w / 2 - 0.07, 1.05, D / 2 + 0.015], m: { kind: "steel" }, shadow: !1 }),
            ],
          },
          q.x,
        ),
      ),
      // UPS: HMI touch screen + bypass static switch panel
      x.jsx(st, { s: [0.42, 0.26, 0.012], pos: [0.4, 1.66, D / 2 + 0.006], m: { kind: "screen" }, shadow: !1 }),
      x.jsx(st, { s: [1.4, 0.2, 0.012], pos: [0.4, 1.38, D / 2 + 0.006], m: { kind: "darksteel" }, shadow: !1 }),
      [0, 1, 2, 3, 4].map((s) => x.jsx(st, { s: [1.46, 0.2, 0.01], pos: [0.4, 0.3 + s * 0.24, D / 2 + 0.003], m: { kind: "grey" }, shadow: !1 }, "m" + s)),
      // PDU: meter + A/B label strips
      x.jsx(st, { s: [0.22, 0.13, 0.012], pos: [1.6, 1.62, D / 2 + 0.006], m: { kind: "screen" }, shadow: !1 }),
      x.jsx(st, { s: [0.24, 0.025, 0.012], pos: [1.44, 1.42, D / 2 + 0.006], m: { kind: "red" }, shadow: !1 }),
      x.jsx(st, { s: [0.24, 0.025, 0.012], pos: [1.76, 1.42, D / 2 + 0.006], m: { kind: "blue" }, shadow: !1 }),
      // top cable glands (input, DC from batteries, outputs A/B/mech)
      [[-1.6, 0.0], [-0.8, 0.0], [0.2, -0.2], [0.6, -0.2], [1.6, -0.15], [1.6, 0.15], [1.6, 0.32]].map(([gx, gz], k) =>
        x.jsx(st, { s: [0.16, 0.06, 0.12], pos: [gx, Hc + 0.03, gz], m: { kind: "darksteel" } }, "g" + k),
      ),
      I(G.louv, M.louv, { kind: "black" }),
      I(G.mod, M.mod, { kind: "screen" }),
      I(G.brk, M.brk, { kind: "black" }),
      I(G.led, M.ledg, { kind: "led" }),
      I(G.fan, M.fan, { kind: "darksteel" }),
    ],
  });
}

/* Room power distribution drawn from the live scene: busways A/B over the rack row with a tap-off per rack and feed,
   ladder tray at high level to the CDU and CRAH (critical cooling on UPS), utility input and battery DC cables. */
function NXE_power() {
  ye((s) => s.version);
  ye(() => wt.geoRev);
  const mode = ye((s) => s.renderMode),
    comps = Oa().comps,
    ups = comps.find((c) => c.type === "ups"),
    racks = comps.filter((c) => c.type === "rack").sort((a, b) => a.pos[0] - b.pos[0]),
    cdu = comps.find((c) => c.type === "cdu"),
    crah = comps.find((c) => c.type === "crah"),
    room = comps.find((c) => c.type === "room"),
    W = (c, lx, ly, lz) => {
      const s = Math.sin(c.rotY || 0),
        k = Math.cos(c.rotY || 0);
      return [c.pos[0] + lx * k + lz * s, c.pos[1] + ly, c.pos[2] - lx * s + lz * k];
    },
    key = ups && racks.length ? JSON.stringify([ups.pos, ups.rotY, racks.map((r) => r.pos), cdu?.pos, cdu?.rotY, crah?.pos, crah?.rotY, room?.pos, room?.params.W, room?.params.ch]) : "",
    geo = ne.useMemo(() => {
      if (!key) return null;
      const out = { bus: [], tap: [], cords: [], hang: [], tray: [], cables: [], boxes: [] },
        rTop = racks[0].pos[1] + 2.2,
        yB = rTop + 0.45,
        x0 = racks[0].pos[0] - 0.55,
        pdu = W(ups, 1.6, 2.0, 0),
        ceil = room ? room.pos[1] + (room.params.ch ?? 4.4) : yB + 1.2,
        feeds = [
          { z: racks[0].pos[2] + 0.25, kind: "red", dx: -0.18 },
          { z: racks[0].pos[2] + 0.45, kind: "blue", dx: 0.18 },
        ];
      for (const f of feeds) {
        const L = pdu[0] - x0;
        out.bus.push({ pos: [x0 + L / 2, yB, f.z], s: [L, 0.16, 0.11], kind: "steel" });
        out.bus.push({ pos: [x0 + L / 2, yB, f.z + (f.kind === "red" ? -0.057 : 0.057)], s: [L, 0.03, 0.006], kind: f.kind });
        out.bus.push({ pos: [pdu[0], (yB + pdu[1]) / 2, f.z], s: [0.16, yB - pdu[1], 0.11], kind: "steel" });
        out.bus.push({ pos: [x0 - 0.02, yB, f.z], s: [0.04, 0.18, 0.13], kind: "darksteel" });
        for (let xh = x0 + 0.3; xh < pdu[0] - 0.2; xh += 1.5) out.hang.push([xh, f.z]);
        for (const r of racks) {
          const tx = r.pos[0] + f.dx,
            yb = yB - 0.08 - 0.11;
          out.tap.push({ pos: [tx, yb, f.z], kind: f.kind });
          out.cords.push({ pts: [[tx, yb - 0.11, f.z], [tx, rTop + 0.06, f.z]], r: 0.016, kind: f.kind });
          out.boxes.push({ pos: [tx, rTop + 0.03, f.z], s: [0.1, 0.06, 0.09], kind: "darksteel" });
        }
      }
      // ladder tray for the critical-cooling feeders (CDU pump, CRAH fans)
      const yT = Math.min(ceil - 0.3, 4.12),
        zT = pdu[2] + 0.32,
        drops = [];
      cdu && drops.push(W(cdu, 0.55, 2.0, 0.35));
      crah && drops.push(W(crah, 0.4, 2.1, 0.35));
      if (drops.length) {
        const xc = drops[0][0],
          zEnd = Math.min(...drops.map((d) => d[2])) - 0.25;
        out.tray.push({ a: [pdu[0], yT, zT], b: [xc - 0.0, yT, zT] }, { a: [xc, yT, zT], b: [xc, yT, zEnd] });
        drops.forEach((d, k) => {
          const off = k ? 0.07 : -0.07,
            yc = yT + 0.03;
          out.cables.push({
            pts: [[pdu[0], pdu[1], zT], [pdu[0], yc, zT], [xc + off, yc, zT], [xc + off, yc, d[2]], [d[0], yc, d[2]], [d[0], d[1] + 0.12, d[2]]],
            r: 0.02,
            kind: "black",
          });
          out.boxes.push({ pos: [d[0], d[1] + 0.07, d[2]], s: [0.16, 0.14, 0.12], kind: "grey" });
        });
        for (const t of out.tray) {
          const L = Math.hypot(t.b[0] - t.a[0], t.b[2] - t.a[2]),
            ax = Math.abs(t.b[0] - t.a[0]) > 1e-3;
          for (let s = 0.4; s < L; s += 1.5) out.hang.push(ax ? [t.a[0] + Math.sign(t.b[0] - t.a[0]) * s, t.a[2], yT] : [t.a[0], t.a[2] + Math.sign(t.b[2] - t.a[2]) * s, yT]);
        }
      }
      // utility input from the main LV switchboard (through the wall) and battery DC links on top of the line-up
      const inp = W(ups, 0.2, 2.0, -0.2),
        wx = room ? room.pos[0] + room.params.W / 2 : inp[0] + 0.4,
        yI = Math.min(ceil - 0.45, 3.9);
      out.cables.push({ pts: [[wx, yI, inp[2]], [inp[0], yI, inp[2]], [inp[0], inp[1] + 0.06, inp[2]]], r: 0.035, kind: "black" });
      out.boxes.push({ pos: [wx - 0.04, yI, inp[2]], s: [0.08, 0.3, 0.3], kind: "darksteel" });
      for (const bx of [-1.6, -0.8]) {
        const a = W(ups, bx, 2.06, 0),
          b = W(ups, 0.6, 2.06, -0.2),
          m1 = W(ups, bx, 2.2, 0),
          m2 = W(ups, 0.6, 2.2, 0);
        out.cables.push({ pts: [a, m1, m2, [b[0], m2[1], b[2]], b], r: 0.018, kind: bx < -1 ? "red" : "black" });
      }
      for (const c of [...out.cords, ...out.cables]) c.g = new Yf(rF(c.pts, 0.12), Math.max(8, c.pts.length * 12), c.r, 8, !1);
      return { ...out, yB, ceil };
    }, [key]);
  if (!geo || mode === "ir") return null;
  const tube = (c, k) =>
    x.jsxs(
      "mesh",
      {
        castShadow: !0,
        children: [x.jsx("primitive", { object: c.g, attach: "geometry" }), x.jsx(br, { kind: c.kind })],
      },
      k,
    );
  return x.jsx(t7, {
    value: { current: {} },
    children: x.jsxs("group", {
      children: [
        geo.bus.map((b, k) => x.jsx(st, { s: b.s, pos: b.pos, m: { kind: b.kind } }, "b" + k)),
        geo.tap.map((t, k) =>
          x.jsxs(
            "group",
            {
              children: [
                x.jsx(st, { s: [0.2, 0.22, 0.15], pos: t.pos, m: { kind: "grey" } }),
                x.jsx(st, { s: [0.21, 0.03, 0.155], pos: [t.pos[0], t.pos[1] + 0.06, t.pos[2]], m: { kind: t.kind }, shadow: !1 }),
              ],
            },
            "t" + k,
          ),
        ),
        geo.boxes.map((b, k) => x.jsx(st, { s: b.s, pos: b.pos, m: { kind: b.kind } }, "x" + k)),
        geo.tray.map((t, k) => {
          const L = Math.hypot(t.b[0] - t.a[0], t.b[2] - t.a[2]) + 0.3,
            ax = Math.abs(t.b[0] - t.a[0]) > 1e-3,
            c = [(t.a[0] + t.b[0]) / 2, t.a[1], (t.a[2] + t.b[2]) / 2],
            sz = (l, w, h) => (ax ? [l, h, w] : [w, h, l]),
            off = (o) => (ax ? [c[0], c[1] + 0.03, c[2] + o] : [c[0] + o, c[1] + 0.03, c[2]]);
          return x.jsxs(
            "group",
            {
              children: [
                x.jsx(st, { s: sz(L, 0.3, 0.006), pos: c, m: { kind: "galv" }, shadow: !1 }),
                x.jsx(st, { s: sz(L, 0.012, 0.07), pos: off(-0.15), m: { kind: "galv" } }),
                x.jsx(st, { s: sz(L, 0.012, 0.07), pos: off(0.15), m: { kind: "galv" } }),
              ],
            },
            "tr" + k,
          );
        }),
        geo.cords.map((c, k) => tube(c, "c" + k)),
        geo.cables.map((c, k) => tube(c, "k" + k)),
        geo.hang.map((h, k) => {
          const yb = h.length === 3 ? h[2] + 0.04 : geo.yB + 0.08,
            L = Math.max(0.05, geo.ceil - yb);
          return x.jsxs(
            "mesh",
            {
              position: [h[0], yb + L / 2, h[1]],
              children: [x.jsx("cylinderGeometry", { args: [0.006, 0.006, L, 6] }), x.jsx(br, { kind: "steel" })],
            },
            "h" + k,
          );
        }),
      ],
    }),
  });
}
