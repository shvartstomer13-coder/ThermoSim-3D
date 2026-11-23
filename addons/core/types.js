/* === ThermoSim add-on: new component types (cold plate, hybrid closed-circuit tower,
   fine filter, air separator, 3-way mixing valve, balancing valve) === */
const NX_dpKv = (rho, m, Kv) => {
    const V = (m / rho) * 3600;
    return (100 * (rho / 1e3) * V * Math.abs(V)) / Math.max(Kv * Kv, 1e-9);
  },
  NX_cold_plate = {
    type: "cold_plate",
    label: "פלטת קירור לשבב (Cold Plate)",
    category: "heat",
    desc: "Direct-to-chip cold plate for one superchip module. Each GPU/CPU die has its own plate: T_die = T_coolant,out + P_die·R (conservative, same method as the project code). Laminar micro-channel ΔP ∝ ṁ.",
    passes: 1,
    defaultFluids: ["pg25"],
    footprint: [0.6, 0.22, 0.45],
    params: [
      $i("pg25"),
      ze("n_gpu", "GPU dies per module", "", 2, 0, 8, 1, "Heat load"),
      ze("P_gpu", "Power per GPU die", "W", 1200, 0, 3e3, 10, "Heat load"),
      ze("n_cpu", "CPU dies per module", "", 1, 0, 4, 1, "Heat load"),
      ze("P_cpu", "Power per CPU die", "W", 300, 0, 1500, 10, "Heat load"),
      ze("util_pct", "Compute utilisation", "%", 100, 0, 100, 1, "Heat load"),
      ze("R_gpu", "GPU plate thermal resistance", "K/W", 0.02, 0.002, 0.2, 0.001, "Thermal"),
      ze("R_cpu", "CPU plate thermal resistance", "K/W", 0.02, 0.002, 0.2, 0.001, "Thermal"),
      ze("Cw", "Plate + die thermal mass", "kJ/K", 0.6, 0.05, 20, 0.05, "Thermal"),
      ze("hold_kg", "Coolant hold-up", "kg", 0.15, 0.01, 5, 0.01, "Thermal"),
      ze("t_limit", "Die temperature limit", "°C", 85, 50, 110, 1, "Protection"),
      ze("m_rated", "Rated coolant flow", "kg/s", 0.0305, 0.002, 0.5, 0.0005, "Hydraulics"),
      ze("dp_rated", "Plate ΔP @ rated flow", "kPa", 25, 1, 200, 1, "Hydraulics"),
      ze("D_mm", "Supply tube inner diameter", "mm", 12, 4, 40, 0.5, "Hydraulics"),
    ],
    ports: (p) => [
      Zt("in", "Coolant supply", "in", 0, [-0.2, 0.22, 0.12], Vn, p.D_mm ?? 12),
      Zt("out", "Coolant return", "out", 0, [0.2, 0.22, 0.12], Vn, p.D_mm ?? 12),
    ],
    build(i) {
      const e = i.node("in"),
        t = i.node("out"),
        n = i.fluid(0),
        r = i.mRef,
        s = i.mRef * 20,
        o = (k) => i.p[k],
        u = () => o("util_pct") / 100,
        Q = () => ((o("n_gpu") * o("P_gpu") + o("n_cpu") * o("P_cpu")) * u()) / 1e3,
        dp = (m) => (o("dp_rated") * m) / Math.max(o("m_rated"), 1e-6);
      return {
        id: i.comp.id,
        type: "cold_plate",
        nEq: 3,
        vars: Wr(e, t),
        eval(c, d, h, p) {
          const m = 0.5 * (c[e.m] + c[t.m]),
            cp = Math.max(Math.min(n.cp(c[t.P], c[t.h]), 100), 0.3);
          ((h[p] = (c[e.m] - c[t.m]) / r),
            (h[p + 1] = (c[e.P] - c[t.P] - dp(m)) / bi),
            (h[p + 2] =
              ((o("hold_kg") + o("Cw") / cp) * (c[t.h] - d.prev[t.h]) * d.invDt -
                m * (c[e.h] - c[t.h]) -
                Q()) /
              s));
        },
        tele(c) {
          const m = 0.5 * (c[e.m] + c[t.m]),
            Ti = n.T(c[e.P], c[e.h]),
            To = n.T(c[t.P], c[t.h]),
            rho = n.rho(c[e.P], c[e.h]),
            D = o("D_mm") / 1e3,
            A = (Ia * D * D) / 4,
            v = m / (rho * A),
            Tg = To + o("P_gpu") * u() * o("R_gpu"),
            Tc = To + o("P_cpu") * u() * o("R_cpu"),
            Tch = Math.max(o("n_gpu") > 0 ? Tg : 0, o("n_cpu") > 0 ? Tc : 0, To);
          return {
            mdot: m,
            P_in: c[e.P],
            P_out: c[t.P],
            dP: c[e.P] - c[t.P],
            T_in: Ti,
            T_out: To,
            dT: To - Ti,
            T_gpu: Tg,
            T_cpu: Tc,
            T_chip: Tch,
            Q_chip: Q(),
            Q_liquid: m * (c[t.h] - c[e.h]),
            velocity: v,
            Re: (rho * Math.abs(v) * D) / n.mu(c[e.P], c[e.h]),
            flow_lpm: (m / rho) * 6e4,
            flow_m3h: (m / rho) * 3600,
            T_surf: 0.5 * (To + Tch),
          };
        },
      };
    },
    init(i) {
      (i.set("in", { m: i.p.m_rated }), i.set("out", { m: i.p.m_rated }));
    },
  },
  NX_hybrid_tower = {
    type: "hybrid_tower",
    label: "מגדל קירור היברידי סגור (Closed-Circuit)",
    category: "hx",
    desc: "Closed-circuit hybrid cooler: process water stays inside a coil (no contact with air, needs an expansion tank). Wet mode sprays water on the coil (approach to wet-bulb), dry mode uses fans only (approach to dry-bulb).",
    passes: 1,
    defaultFluids: ["water"],
    footprint: [3, 3.4, 2.2],
    params: [
      $i("water"),
      Hl("mode", "Operating mode", "wet", [
        { value: "wet", label: "Wet – spray on coil (evaporative)" },
        { value: "dry", label: "Dry – fans only" },
        { value: "auto", label: "Auto – dry below switch-over dry-bulb" },
      ]),
      Hl(
        "wb_src",
        "Outdoor air condition",
        "fixed",
        [
          { value: "fixed", label: "Design values below" },
          { value: "ambient", label: "Scene ambient (room air)" },
        ],
        "Climate",
      ),
      ze("t_wb", "Design wet-bulb", "°C", 27, -5, 35, 0.5, "Climate"),
      ze("t_db", "Design dry-bulb", "°C", 37, -10, 50, 0.5, "Climate"),
      ze("t_switch", "Dry-mode switch-over (dry-bulb)", "°C", 18, -10, 40, 0.5, "Climate"),
      Hl(
        "thermal",
        "Thermal model",
        "approach",
        [
          { value: "approach", label: "Fixed approach (project method)" },
          { value: "ntu", label: "ε-NTU from the design point" },
        ],
        "Thermal",
      ),
      ze("approach_wet", "Wet approach to wet-bulb @100% fan", "K", 4, 0.5, 15, 0.1, "Thermal"),
      ze("approach_dry", "Dry approach to dry-bulb @100% fan", "K", 8, 1, 25, 0.5, "Thermal"),
      ze("range_d", "Design range (ε-NTU model)", "K", 12, 1, 30, 0.5, "Thermal"),
      ze("hold_kg", "Coil water inventory", "kg", 600, 20, 2e4, 10, "Thermal"),
      ze("fan_pct", "Fan speed", "%", 100, 5, 100, 1, "Fans & spray"),
      ze("fan_kw", "Fan power @100 %", "kW", 7.5, 0.5, 200, 0.5, "Fans & spray"),
      ze("spray_kw", "Spray pump power (wet mode)", "kW", 1.5, 0, 30, 0.1, "Fans & spray"),
      ze("m_d", "Design water flow", "kg/s", 9.54, 0.1, 600, 0.01, "Hydraulics"),
      ze("dp0", "Coil ΔP @ design flow", "kPa", 80, 1, 300, 1, "Hydraulics"),
    ],
    ports: () => [
      Zt("in", "Hot water in (coil top)", "in", 0, [1.5, 2.35, 0.45], [1, 0, 0], 100),
      Zt("out", "Cooled water out (coil bottom)", "out", 0, [1.5, 0.75, 0.45], [1, 0, 0], 100),
    ],
    build(i) {
      const e = i.node("in"),
        t = i.node("out"),
        n = i.fluid(0),
        r = i.mRef,
        s = i.mRef * 20,
        o = (k) => i.p[k],
        air = (d) => {
          const fx_ = o("wb_src") === "fixed",
            Tdb = fx_ ? Hs(o("t_db")) : d.amb.T,
            Twb = fx_ ? Hs(o("t_wb")) : d.amb.Twb,
            wet =
              o("mode") === "wet" || (o("mode") === "auto" && Tdb > Hs(o("t_switch")));
          return { Tdb, Twb, wet, Tair: wet ? Twb : Tdb, appr: wet ? o("approach_wet") : o("approach_dry") };
        },
        a = (c, d) => {
          const m = 0.5 * (c[e.m] + c[t.m]),
            A = air(d),
            fan = Math.max(o("fan_pct") / 100, 0.05),
            Tin = n.T(c[e.P], c[e.h]);
          let Tt, eps;
          if (o("thermal") === "ntu") {
            const ed = o("range_d") / (o("range_d") + A.appr),
              N =
                -Math.log(1 - Math.min(ed, 0.995)) *
                Math.pow(fan, 0.6) *
                Math.pow(Math.max(Math.abs(m), 0.001) / o("m_d"), -0.4);
            eps = 1 - Math.exp(-N);
            Tt = Tin - eps * (Tin - A.Tair);
          } else {
            const ap = A.appr / Math.pow(fan, 0.6);
            Tt = Tin - m4(Tin - (A.Tair + ap), 0.05);
            eps = (Tin - Tt) / Math.max(Tin - A.Tair, 1e-3);
          }
          const Q = m * (c[e.h] - n.hPT(c[t.P], Tt)),
            dp = o("dp0") * (m / o("m_d")) * Math.abs(m / o("m_d"));
          return { m, A, Tin, Tt, eps, Q, dp, fan };
        };
      return {
        id: i.comp.id,
        type: "hybrid_tower",
        nEq: 3,
        vars: Wr(e, t),
        eval(c, d, h, p) {
          const g = a(c, d);
          ((h[p] = (c[e.m] - c[t.m]) / r),
            (h[p + 1] = (c[e.P] - c[t.P] - g.dp) / bi),
            (h[p + 2] =
              (o("hold_kg") * (c[t.h] - d.prev[t.h]) * d.invDt -
                g.m * (c[e.h] - c[t.h]) +
                g.Q) /
              s));
        },
        tele(c, d) {
          const g = a(c, d),
            To = n.T(c[t.P], c[t.h]);
          return {
            mdot: g.m,
            Q_rej: g.Q,
            eps: g.eps,
            T_in: g.Tin,
            T_out: To,
            T_wb: g.A.Twb,
            T_db: g.A.Tdb,
            approach: To - g.A.Tair,
            range: g.Tin - To,
            wet_mode: g.A.wet ? 1 : 0,
            P_in: c[e.P],
            P_out: c[t.P],
            dP: c[e.P] - c[t.P],
            fan_kw: o("fan_kw") * Math.pow(g.fan, 3),
            spray_kw: g.A.wet ? o("spray_kw") : 0,
            makeup_kgs: g.A.wet ? Math.max(g.Q, 0) / 2430 : 0,
            flow_m3h: (g.m / n.rho(c[e.P], c[e.h])) * 3600,
            T_surf: 0.5 * (g.Tin + To) - 1,
          };
        },
      };
    },
    init(i) {
      (i.set("in", { m: i.p.m_d }), i.set("out", { m: i.p.m_d }));
    },
  },
  NX_inline = (type, label, desc, footprint, portY, params, dpf, extraTele) => ({
    type,
    label,
    category: "piping",
    desc,
    passes: 1,
    defaultFluids: ["pg25"],
    footprint,
    passThrough: !0,
    params,
    ports: (p) => [
      Zt("in", "Inlet", "in", 0, [-footprint[0] / 2, portY, 0], [-1, 0, 0], p.D_mm),
      Zt("out", "Outlet", "out", 0, [footprint[0] / 2, portY, 0], [1, 0, 0], p.D_mm),
    ],
    build(i) {
      const e = i.node("in"),
        t = i.node("out"),
        n = i.fluid(0),
        r = i.mRef,
        o = (k) => i.p[k],
        f = (c) => {
          const m = 0.5 * (c[e.m] + c[t.m]),
            rho = n.rho(c[e.P], c[e.h]);
          return { m, rho, dp: dpf(o, m, rho) };
        };
      return {
        id: i.comp.id,
        type,
        nEq: 3,
        vars: Wr(e, t),
        eval(c, d, h, p) {
          const g = f(c);
          ((h[p] = (c[e.m] - c[t.m]) / r),
            (h[p + 1] = (c[e.P] - c[t.P] - g.dp) / bi),
            (h[p + 2] = (c[t.h] - c[e.h]) / yd));
        },
        tele(c) {
          const g = f(c),
            D = o("D_mm") / 1e3,
            v = g.m / (g.rho * ((Ia * D * D) / 4));
          return {
            mdot: g.m,
            P_in: c[e.P],
            P_out: c[t.P],
            dP: c[e.P] - c[t.P],
            T_in: n.T(c[e.P], c[e.h]),
            T_out: n.T(c[t.P], c[t.h]),
            T_surf: n.T(c[e.P], c[e.h]),
            velocity: v,
            flow_m3h: (g.m / g.rho) * 3600,
            flow_lpm: (g.m / g.rho) * 6e4,
            ...(extraTele ? extraTele(o, g, v) : {}),
          };
        },
      };
    },
  }),
  NX_fine_filter = NX_inline(
    "fine_filter",
    "מסנן עדין (Fine Filter)",
    "Cartridge / bag fine filter (e.g. 50 µm) protecting the cold-plate micro-channels. Media ΔP is Darcy-like (∝ ṁ) and grows as the element loads; housing ΔP ∝ ṁ².",
    [0.62, 1, 0.42],
    0.3,
    [
      $i("pg25"),
      ze("D_mm", "Connection diameter", "mm", 80, 10, 300, 1, "Geometry"),
      ze("rating_um", "Filtration rating", "µm", 50, 1, 500, 1, "Filter"),
      ze("m_rated", "Rated flow", "kg/s", 4.4, 0.05, 200, 0.05, "Filter"),
      ze("dp_clean", "Clean ΔP @ rated flow", "kPa", 10, 0.5, 100, 0.5, "Filter"),
      ze("clog_pct", "Element loading (clogging)", "%", 0, 0, 90, 1, "Filter"),
      ze("dp_alarm", "Change-element alarm ΔP", "kPa", 35, 2, 200, 1, "Filter"),
    ],
    (o, m, rho) => {
      const x_ = m / Math.max(o("m_rated"), 1e-6),
        c = Ol(o("clog_pct") / 100, 0, 0.95);
      return o("dp_clean") * ((0.6 * x_) / (1 - c) + 0.4 * x_ * Math.abs(x_));
    },
    (o) => ({ clog: o("clog_pct"), dp_alarm: o("dp_alarm"), rating_um: o("rating_um") }),
  ),
  NX_air_separator = NX_inline(
    "air_separator",
    "מפריד אוויר ומשקעים (Air Separator)",
    "Coalescing micro-bubble air & dirt separator with automatic float vent. Low body velocity lets bubbles coalesce and rise to the vent; ΔP ∝ ṁ².",
    [0.6, 1.05, 0.36],
    0.35,
    [
      $i("pg25"),
      ze("D_mm", "Connection diameter", "mm", 80, 10, 300, 1, "Geometry"),
      ze("m_rated", "Rated flow", "kg/s", 4.4, 0.05, 200, 0.05, "Hydraulics"),
      ze("dp_rated", "ΔP @ rated flow", "kPa", 3, 0.2, 50, 0.1, "Hydraulics"),
      ze("v_max", "Recommended max. inlet velocity", "m/s", 1.5, 0.3, 3, 0.1, "Hydraulics"),
    ],
    (o, m) => {
      const x_ = m / Math.max(o("m_rated"), 1e-6);
      return o("dp_rated") * x_ * Math.abs(x_);
    },
    (o, g, v) => ({ v_max: o("v_max"), v_ratio: Math.abs(v) / o("v_max") }),
  ),
  NX_balancing_valve = NX_inline(
    "balancing_valve",
    "שסתום איזון (Balancing Valve)",
    "Manual balancing valve with presetting handwheel and two measuring nipples. Kv follows the handwheel setting; ΔP = (ρ/1000)·(V̇/Kv)²·100 kPa.",
    [0.5, 0.6, 0.3],
    0.2,
    [
      $i("pg25"),
      ze("D_mm", "Nominal diameter", "mm", 50, 10, 300, 1, "Geometry"),
      ze("Kvs", "Kv fully open", "m³/h", 40, 0.5, 2e3, 0.5),
      ze("turns_max", "Handwheel turns (full open)", "", 8, 2, 16, 1),
      ze("turns", "Handwheel setting", "turns", 8, 0, 16, 0.1),
    ],
    (o, m, rho) => NX_dpKv(rho, m, NX_bvKv(o)),
    (o) => ({ Kv_eff: NX_bvKv(o), setting: o("turns") }),
  ),
  NX_bvKv = (o) => {
    const s = Ol(o("turns") / Math.max(o("turns_max"), 1), 0, 1);
    return o("Kvs") * (0.03 + 0.97 * Math.pow(s, 1.3));
  },
  NX_valve3 = {
    type: "valve3",
    label: "שסתום תלת־דרכי מערבל (3-Way Valve)",
    category: "piping",
    desc: "Motorised 3-way mixing valve: ports A (main) and B (bypass) mix into AB. Position 100 % = all from A. Each path has its own Kv(x); adiabatic mixing.",
    passes: 1,
    defaultFluids: ["pg25"],
    footprint: [0.62, 0.75, 0.62],
    params: [
      $i("pg25"),
      ze("D_mm", "Nominal diameter", "mm", 80, 10, 300, 1, "Geometry"),
      ze("Kvs", "Kvs (each path, fully open)", "m³/h", 100, 1, 3e3, 1),
      ze("pos_pct", "Position (A→AB)", "%", 100, 0, 100, 1),
      Hl("char", "Trim characteristic", "linear", [
        { value: "linear", label: "Linear (A-AB) / linear (B-AB)" },
        { value: "eqpct", label: "Equal-percentage (A-AB) / linear (B-AB)" },
      ]),
      ze("leak_pct", "Leakage (closed path)", "%", 0.5, 0, 5, 0.1),
      ze("hold_kg", "Hold-up mass", "kg", 3, 0.2, 100, 0.1, "Thermal"),
    ],
    ports: (p) => [
      Zt("A", "Port A – main", "in", 0, [-0.31, 0.25, 0], [-1, 0, 0], p.D_mm),
      Zt("B", "Port B – bypass", "in", 0, [0, 0.25, 0.31], [0, 0, 1], p.D_mm),
      Zt("AB", "Port AB – mixed outlet", "out", 0, [0.31, 0.25, 0], [1, 0, 0], p.D_mm),
    ],
    build(i) {
      const A = i.node("A"),
        B = i.node("B"),
        C = i.node("AB"),
        n = i.fluid(0),
        r = i.mRef,
        s = i.mRef * 20,
        o = (k) => i.p[k],
        kv = () => {
          const x_ = Ol(o("pos_pct") / 100, 0, 1),
            lk = o("leak_pct") / 100,
            ka = o("char") === "eqpct" ? o("Kvs") * Math.pow(50, x_ - 1) : o("Kvs") * x_;
          return { a: Math.max(ka, lk * o("Kvs")), b: Math.max(o("Kvs") * (1 - x_), lk * o("Kvs")) };
        };
      return {
        id: i.comp.id,
        type: "valve3",
        nEq: 4,
        vars: Wr(A, B, C),
        eval(c, d, h, p) {
          const k = kv(),
            ra = n.rho(c[A.P], c[A.h]),
            rb = n.rho(c[B.P], c[B.h]);
          ((h[p] = (c[A.m] + c[B.m] - c[C.m]) / r),
            (h[p + 1] = (c[A.P] - c[C.P] - NX_dpKv(ra, c[A.m], k.a)) / bi),
            (h[p + 2] = (c[B.P] - c[C.P] - NX_dpKv(rb, c[B.m], k.b)) / bi),
            (h[p + 3] =
              (o("hold_kg") * (c[C.h] - d.prev[C.h]) * d.invDt -
                c[A.m] * (c[A.h] - c[C.h]) -
                c[B.m] * (c[B.h] - c[C.h])) /
              s));
        },
        tele(c) {
          const k = kv(),
            mt = c[C.m],
            rho = n.rho(c[C.P], c[C.h]);
          return {
            mdot: mt,
            m_A: c[A.m],
            m_B: c[B.m],
            frac_A: c[A.m] / (Math.abs(mt) > 1e-9 ? mt : 1e-9),
            T_A: n.T(c[A.P], c[A.h]),
            T_B: n.T(c[B.P], c[B.h]),
            T_in: n.T(c[A.P], c[A.h]),
            T_out: n.T(c[C.P], c[C.h]),
            P_in: c[A.P],
            P_out: c[C.P],
            dP: c[A.P] - c[C.P],
            Kv_A: k.a,
            Kv_B: k.b,
            opening: o("pos_pct"),
            flow_m3h: (mt / rho) * 3600,
            T_surf: n.T(c[C.P], c[C.h]),
          };
        },
      };
    },
    init(i) {
      const g = i.get("AB"),
        x_ = Ol(i.p.pos_pct / 100, 0.02, 0.98);
      g.m !== void 0 &&
        (i.set("A", { m: g.m * x_ }), i.set("B", { m: g.m * (1 - x_) }));
    },
  },
  NX_ups = {
    ...wh(
      "ups",
      "UPS מודולרי (אל־פסק)",
      "Modular double-conversion UPS line-up for the server room: 2 Li-ion battery cabinets, UPS frame with hot-swap power modules (N+1) and an output distribution section feeding busways A and B and the critical-cooling loads.",
      [
        ze("rating_kw", "UPS rating (N)", "kW", 600, 10, 5e3, 10, "Rating"),
        ze("module_kw", "Power module size", "kW", 150, 10, 500, 5, "Rating"),
        ze("modules", "Installed power modules", "", 5, 1, 20, 1, "Rating"),
        ze("eta_pct", "Double-conversion efficiency", "%", 96.5, 85, 99.5, 0.1, "Rating"),
        ze("V_ll", "Output voltage (line-line)", "V", 400, 200, 690, 5, "Electrical"),
        ze("pf", "Load power factor", "-", 0.98, 0.7, 1, 0.01, "Electrical"),
        O1("mech_on_ups", "CDU pump + CRAH fans on UPS (critical cooling)", !0, "Electrical"),
        ze("motor_eff_pct", "Pump motor + drive efficiency", "%", 90, 50, 99, 1, "Electrical"),
        ze("batt_kwh", "Usable battery energy", "kWh", 80, 5, 2e3, 5, "Battery"),
        ze("batt_eff_pct", "Battery discharge efficiency (DC to AC)", "%", 95, 70, 100, 1, "Battery"),
      ],
      () => [4.0, 2.0, 0.9],
    ),
    category: "room",
    nxLive: !0,
    nxTele: (c, sim) => NXU_tele(c, sim),
  },
  NEWT = [
    NX_cold_plate,
    NX_hybrid_tower,
    NX_fine_filter,
    NX_air_separator,
    NX_valve3,
    NX_balancing_valve,
    NX_ups,
  ];
