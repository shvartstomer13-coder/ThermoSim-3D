import re, sys
src = open('app.pretty.js', encoding='utf-8').read()
R = lambda p: open(p, encoding='utf-8').read()

def rep(old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        sys.exit(f'pattern count {n} != {count}: {old[:80]!r}')
    src = src.replace(old, new)

# 1. new types before the registry array, then register
types = R('src/types.js')
rep('  UM = (i) => {\n    tn[i.type] = i;\n  };\n[\n  Y2(\n    "pipe",',
    '  UM = (i) => {\n    tn[i.type] = i;\n  };\n' + types + '\n[\n  Y2(\n    "pipe",')
rep('  ...OM,\n].forEach(UM);', '  ...OM,\n  ...NEWT,\n].forEach(UM);')

# 2. categories and fluids
rep('const Z7 = {\n  rack: "heat",',
    'const Z7 = {\n  cold_plate: "heat",\n  hybrid_tower: "hx",\n  fine_filter: "piping",\n  air_separator: "piping",\n  valve3: "piping",\n  balancing_valve: "piping",\n  rack: "heat",')
rep('  zM = {\n    pump: gs,',
    '  zM = {\n    cold_plate: gs,\n    hybrid_tower: gs,\n    fine_filter: gs,\n    air_separator: gs,\n    valve3: gs,\n    balancing_valve: gs,\n    pump: gs,')

# 3. PP-R pipe material (params.yaml A11: roughness 0.007 mm)
rep('    pvc: { label: "PVC / PP-R", rough: 15e-7, k: 0.19, rhoCp: 1400 * 1 },',
    '    pvc: { label: "PVC / PP-R", rough: 15e-7, k: 0.19, rhoCp: 1400 * 1 },\n    ppr: { label: "PP-R SDR11 (ε 0.007 mm)", rough: 7e-6, k: 0.24, rhoCp: 905 * 1.8 },')

# 4. open cooling tower: optional fixed design wet-bulb
rep('''      ze(
        "hold_kg",
        "Basin + fill water inventory",''',
    '''      Hl(
        "wb_src",
        "Wet-bulb source",
        "ambient",
        [
          { value: "ambient", label: "Scene ambient" },
          { value: "fixed", label: "Fixed design wet-bulb" },
        ],
        "Climate",
      ),
      ze("t_wb", "Design wet-bulb (if fixed)", "°C", 27, -5, 35, 0.5, "Climate"),
      ze(
        "hold_kg",
        "Basin + fill water inventory",''')
rep('            S = w * h * M * (_ - d.amb.Twb),',
    '            S = w * h * M * (_ - (o("wb_src") === "fixed" ? Hs(o("t_wb")) : d.amb.Twb)),')
rep('''            T_wb: d.amb.Twb,
            approach: p - d.amb.Twb,''',
    '''            T_wb: o("wb_src") === "fixed" ? Hs(o("t_wb")) : d.amb.Twb,
            approach: p - (o("wb_src") === "fixed" ? Hs(o("t_wb")) : d.amb.Twb),''')

# 5. Hebrew descriptions, icons, explanations, telemetry labels
rep('  Q2 = {\n    pipe:', '  Q2 = {\n' + R('src/q2.js') + '\n    pipe:')
rep('  Y3 = {\n    pipe: "pipe",',
    '  Y3 = {\n    cold_plate: "cpu",\n    hybrid_tower: "fan",\n    fine_filter: "gauge",\n    air_separator: "gauge",\n    valve3: "gauge",\n    balancing_valve: "gauge",\n    pipe: "pipe",')
rep('  UB = {\n    pipe: {', '  UB = {\n' + R('src/ub.js') + '\n    pipe: {')
rep('  X5 = {\n    mdot: ["ספיקת מסה", "kg/s", 3],',
    '''  X5 = {
    dT: ["עליית טמפרטורה בנוזל", "K", 2],
    flow_lpm: ["ספיקה נפחית", "L/min", 2],
    wet_mode: ["מצב רטוב (1) / יבש (0)", "", 0],
    spray_kw: ["הספק משאבת התזה", "kW", 2],
    clog: ["העמסת המסנן", "%", 0],
    dp_alarm: ["סף התראה להחלפה", "kPa", 0],
    rating_um: ["דרגת סינון", "µm", 0],
    v_max: ["מהירות מרבית מומלצת", "m/s", 2],
    v_ratio: ["יחס מהירות למרבית", "", 2],
    setting: ["כיוון ידית", "סיבובים", 1],
    m_A: ["ספיקה ממבוא A", "kg/s", 3],
    m_B: ["ספיקה ממבוא B (מעקף)", "kg/s", 3],
    frac_A: ["חלק הספיקה מ־A", "", 3],
    Kv_A: ["Kv מסלול A", "m³/h", 1],
    Kv_B: ["Kv מסלול B", "m³/h", 1],
    mdot: ["ספיקת מסה", "kg/s", 3],''')
rep('  zB = {\n    T_in: "טמפ׳ כניסה",',
    '  zB = {\n    T_gpu: "טמפ׳ שבב GPU (החם ביותר)",\n    T_cpu: "טמפ׳ שבב CPU",\n    T_A: "טמפ׳ מבוא A",\n    T_B: "טמפ׳ מבוא B",\n    T_db: "טמפ׳ יבשה (חוץ)",\n    T_in: "טמפ׳ כניסה",')

# 6. 3D models
rep('const tF = {\n    rack: Ak,',
    'const tF = {\n    cold_plate: NXM_cold_plate,\n    hybrid_tower: NXM_hybrid_tower,\n    fine_filter: NXM_fine_filter,\n    air_separator: NXM_air_separator,\n    valve3: NXM_valve3,\n    balancing_valve: NXM_balancing_valve,\n    rack: NXM_rack,')
rep('''    case "manifold_split":
    case "manifold_merge":
      Object.assign(a, { body: [r, s] });
      break;''',
    '''    case "manifold_split":
    case "manifold_merge":
      Object.assign(a, { body: [r, s] });
      break;
    case "cold_plate": {
      const d = n("T_chip", o);
      Object.assign(a, { chip: [d - 1, d + 1], body: [c(d, 0.4), c(d, 0.4)] });
      break;
    }
    case "hybrid_tower":
      Object.assign(a, { coil: [s, r], basin: [s, s], fan: [t + 6, t + 6], body: [t + 2, t + 2] });
      break;''')

# 7. safety checks for new components
rep('''  ) {
    case "rack": {
      const w = c("T_chip");''',
    '''  ) {
    case "cold_plate": {
      const w = c("T_gpu"),
        lim = s("t_limit");
      (w !== void 0 &&
        w > 273.15 + lim &&
        r("danger", `שבב GPU ${ro(w)} מעל גבול ${lim}°C – הגדילו ספיקה או הקטינו R`, { tele: "T_gpu", param: "R_gpu" }),
        g !== void 0 &&
          g < 0.5 * s("m_rated") &&
          r("warn", "ספיקה נמוכה מחצי מהספיקה הנקובה לפלטה", { tele: "mdot", param: "m_rated" }));
      break;
    }
    case "fine_filter": {
      const w = c("dP");
      w !== void 0 && w > s("dp_alarm") && r("warn", `מפל לחץ ${w.toFixed(1)} kPa – יש להחליף את מחסנית המסנן`, { tele: "dP", param: "clog_pct" });
      break;
    }
    case "air_separator": {
      const w = c("v_ratio");
      w !== void 0 && w > 1 && r("warn", "מהירות הכניסה גבוהה מהמומלץ – יעילות הפרדת הבועות יורדת", { tele: "velocity", param: "D_mm" });
      break;
    }
    case "hybrid_tower": {
      const w = c("T_out"),
        q = c("Q_rej");
      w !== void 0 && q !== void 0 && q < 1 && r("warn", "המגדל כמעט לא מקרר: טמפ׳ המים קרובה לטמפ׳ האוויר", { tele: "T_out" });
      break;
    }
    case "rack": {
      const w = c("T_chip");''')

# 8. illustration in the properties panel
rep('''          t.type === "pipe" && x.jsx(ZB, { id: t.id }),
          s &&
            x.jsxs(la, {
              id: "p-explain",''',
    '''          x.jsx(NXI_Panel, { type: t.type }, "nxi-" + t.type),
          t.type === "pipe" && x.jsx(ZB, { id: t.id }),
          s &&
            x.jsxs(la, {
              id: "p-explain",''')

# 9. default scene from params.yaml
m = re.search(r'\nconst Da = \{.*?\n\}\nfunction JM\(\) \{', src, re.S)
if not m: sys.exit('ZM block not found')
src = src[:m.start()] + '\n' + R('src/layout.js') + '\n' + R('src/scene.js') + '\nfunction JM() {' + src[m.end():]
rep('''      desc: "4 ארונות GB200 NVL72 (120 kW, ‏87% לנוזל, 130 L/min, PG25, 25°C) ← CDU ← צ׳ילר ← מגדל קירור. נתוני פרויקט הגמר + ספיקה והתנגדות פלטה סטנדרטיות.",''',
    '''      desc: "לפי config/params.yaml: ‏4 ארונות GB200 (120 kW, ‏97.2 kW לנוזל, 64.8 L/min, PG25 ב־25°C) ← מסנן ומפריד אוויר ← CDU ‏(הפסד 2 K) ← מגדל היברידי סגור (27+4 = 31°C) ← צ׳ילר עזר בטור (23°C). חדר שרתים עם רצפה צפה 0.6 m ו־CRAH על מי המתקן לחום שנשאר באוויר (91.2 kW).",''')

rep('''      build: ZM,
      camera: [13, 11, 24],
      target: [-2, 1.2, 4],''','''      build: ZM,
      camera: [7, 13, 21],
      target: [-7.5, 1.2, 0.5],''')
rep('''      return a;
    }, [i, e, t]);
  return x.jsxs("group", {
    children: [
      x.jsxs("mesh", {
        position: [0, t + 0.01, 0],''','''      return a;
    }, [i, e, t]),
    gref = ne.useRef(null),
    wp = ne.useMemo(() => new q(), []);
  Gi(({ camera: cam }) => {
    const G = gref.current;
    if (!G) return;
    G.getWorldPosition(wp);
    const above = cam.position.y > wp.y + t + 0.05;
    G.visible === above &&
      ((G.visible = !above),
      G.traverse((m) => {
        m.isMesh &&
          (m.userData.__rc === void 0 && (m.userData.__rc = m.raycast),
          (m.raycast = above ? () => {} : m.userData.__rc),
          (m.castShadow = !1));
      }),
      wt.geoRev++);
  });
  return x.jsxs("group", {
    ref: gref,
    children: [
      x.jsxs("mesh", {
        position: [0, t + 0.01, 0],''')
rep('''                maxPolarAngle: Math.PI / 2.04,
                minDistance: 2,''','''                maxPolarAngle: Math.PI * 0.94,
                minDistance: 0.25,''')
rep('''          b = Math.min(90, Math.max(2, S.length() * M));''','''          b = Math.min(90, Math.max(0.25, S.length() * M));''')
rep('''      i && (e.userData.target = i.target);
      const p = s.current;''','''      i && (e.userData.target = i.target);
      i && e.position.y < 0.2 && ((e.position.y = 0.2), i.update());
      const p = s.current;
      p.size || (e.userData.nxV = null);''')
rep('''            ((i.zoomSpeed = 1.1),''','''            ((i.zoomSpeed = 0.85),''')
rep('''                i.zoomSpeed = ye.getState().wheelReverse ? -1.1 : 1.1;''','''                i.zoomSpeed = ye.getState().wheelReverse ? -0.85 : 0.85;''')
rep('''          ((C.theta -= _ * 0.0024),''','''          ((C.theta -= _ * 0.0019),''')
rep('''              Math.max(0.05, C.phi + M * 0.0024),''','''              Math.max(0.05, C.phi + M * 0.0019),''')
rep('''                dampingFactor: 0.18,''','''                dampingFactor: 0.1,
                panSpeed: 0.8,''')
rep('''                zoomSpeed: t ? -1.1 : 1.1,
                rotateSpeed: 0.9,''','''                zoomSpeed: t ? -0.85 : 0.85,
                rotateSpeed: 0.7,''')
rep('''        (c.normalize().multiplyScalar(H * h),''','''        (c.normalize().multiplyScalar(H * 0.75),
          (e.userData.nxV = (e.userData.nxV ?? new q()).lerp(c, Math.min(1, h * 9))),
          c.copy(e.userData.nxV).multiplyScalar(h),''')
rep('''    o = ne.useMemo(() => Sk(), []),
    a = ne.useRef(0),
    c = ye((S) => S.selected === i.id),''','''    o = ne.useMemo(() => Sk(), []),
    nxm = ne.useMemo(() => NXP_mat(), []),
    a = ne.useRef(0),
    c = ye((S) => S.selected === i.id),''')
rep('''    r.current = { body: [B, se], fl0: [H, H], fl1: [k, k], amb: [R, R] };''','''    r.current = { body: [B, se], fl0: [H, H], fl1: [k, k], amb: [R, R] };
    (NXP_tick(H, k),
      (nxm.userData.u.uTa.value = H),
      (nxm.userData.u.uTb.value = k),
      (nxm.userData.u.uLo.value = NXP.lo),
      (nxm.userData.u.uHi.value = NXP.hi));''')
rep('''          geometry: e.tube,
          castShadow: !0,''','''          geometry: NXP_geo(e.tube),
          castShadow: !0,''')
rep('''          children:
            e.ins > 0
              ? x.jsx(br, { kind: "insul", ch: "body", ax: "uv" })''','''          children:
            d !== "ir" && !ye.getState().nxFluidColor
              ? x.jsx("primitive", { object: nxm, attach: "material" })
              : e.ins > 0
              ? x.jsx(br, { kind: "insul", ch: "body", ax: "uv" })''')
rep('''    cooling_tower: kk,''','''    cooling_tower: NXM_ct,''')
rep('''    footprint: [3, 0.6, 0.5],
    params: [
      $i("pg25"),
      ze("n", "Branches", "", 4, 2, 8, 1, "Geometry"),''','''    footprint: [3, 0.6, 0.5],
    fp: (t) => [Math.round(t.n) * 0.9 + 0.1, 0.6, 0.5],
    params: [
      $i("pg25"),
      ze("n", "Branches", "", 4, 2, 8, 1, "Geometry"),''')
rep('''              x.jsx(JF, {}),''','''              x.jsx(NXE_env, {}),''')
rep("Math.floor(o.length * 0.93)", "Math.floor(o.length * 0.985)")
rep("""      x.jsx(zt, {
        r: 0.05,
        h: 0.5,
        pos: [0.2, 0.9, 0.05],
        rot: [0.8, 0, 0],
        m: { kind: "copper", ch: "evap" },
      }),""", "      x.jsx(NXM_chSup, {}),")
rep("""      [-1.7, -1.2, 1.2, 1.7].map((t, n) =>
        x.jsx(
          st,
          {
            s: [0.1, 0.22, 0.9],
            pos: [t, 0.23, 0.45],
            m: { kind: "darksteel" },
          },
          n,
        ),
      ),""", "      null,")
rep("""      ze(
        "t_throttle",
        "Throttle onset (chip)",
        "°C",
        85,
        50,
        110,
        1,
        "Protection",
      ),
    ],
    ports: () => [
      Zt("in", "Coolant supply", "in", 0, [-0.22, 2.2, 0], Vn, 50),""", """      ze(
        "t_throttle",
        "Throttle onset (chip)",
        "°C",
        85,
        50,
        110,
        1,
        "Protection",
      ),
      ze("n_trays", "Compute trays per rack", "", 18, 1, 60, 1, "Flow split"),
      ze("chips_per_tray", "Superchips per tray", "", 2, 1, 8, 1, "Flow split"),
      ze("gpu_n", "GPU plates per superchip", "", 2, 1, 8, 1, "Flow split"),
      ze("gpu_w", "GPU power", "W", 1200, 50, 5000, 10, "Flow split"),
      ze("cpu_w", "CPU power", "W", 300, 20, 2000, 10, "Flow split"),
    ],
    ports: () => [
      Zt("in", "Coolant supply", "in", 0, [-0.22, 2.2, 0], Vn, 50),""")
rep("""            flow_m3h: (p.m / g) * 3600,
            UA_eff: p.UA,
          };""", """            flow_m3h: (p.m / g) * 3600,
            UA_eff: p.UA,
            ...(() => {
              // parallel plates, flow split in proportion to heat (equal outlet temperature on every plate, assumption A19)
              const V = (p.m / g) * 6e4,
                nc = a("n_trays") * a("chips_per_tray"),
                Wc = a("gpu_n") * a("gpu_w") + a("cpu_w"),
                vc = V / nc;
              return {
                rk_total_lpm: V,
                rk_tray_lpm: V / a("n_trays"),
                rk_chip_lpm: vc,
                rk_gpu_lpm: (vc * a("gpu_w")) / Wc,
                rk_cpu_lpm: (vc * a("cpu_w")) / Wc,
              };
            })(),
          };""")
rep('    clog: ["העמסת המסנן", "%", 0],', """    rk_total_lpm: ["ספיקה כוללת במסד (כל המגירות)", "L/min", 1],
    rk_tray_lpm: ["ספיקה למגירת חישוב אחת", "L/min", 2],
    rk_chip_lpm: ["ספיקה לשבב-על אחד", "L/min", 2],
    rk_gpu_lpm: ["ספיקה ללוחית GPU אחת", "L/min", 2],
    rk_cpu_lpm: ["ספיקה ללוחית CPU", "L/min", 2],
    clog: ["העמסת המסנן", "%", 0],""")
rep("x.jsx(E6, { W: t, D: n, H: a, perf: !0 })", "x.jsx(E6, { W: t, D: n, H: a, perf: !0, ca: NXR_ca(i.params) })", 2)
rep("""function E6({ W: i, D: e, H: t, perf: n = !1 }) {""", """function E6({ W: i, D: e, H: t, perf: n = !1, ca: nxCa = null }) {""")
rep("""      if (!n) return d;
      for (let h = -i / 2 + 0.3; h < i / 2; h += 0.6)""", """      if (!n) return d;
      if (nxCa) return NXR_tiles(i, e, t, nxCa);
      for (let h = -i / 2 + 0.3; h < i / 2; h += 0.6)""")
rep("""    }, [i, e, t, n]);
  return x.jsxs("group", {
    children: [
      x.jsxs("mesh", {
        position: [0, t - 0.02, 0],""", """    }, [i, e, t, n, nxCa?.x0, nxCa?.x1, nxCa?.z, nxCa?.rows]);
  return x.jsxs("group", {
    children: [
      x.jsxs("mesh", {
        position: [0, t - 0.02, 0],""")
rep("""        O1("ceil", "Suspended ceiling", !1, "Ceiling"),""", """        ze("ca_rows", "Perforated cold-aisle rows (0 = default pattern)", "", 0, 0, 4, 1, "Floor"),
        ze("ca_x0", "Cold aisle start X (room local)", "m", 0, -30, 30, 0.05, "Floor"),
        ze("ca_x1", "Cold aisle end X (room local)", "m", 0, -30, 30, 0.05, "Floor"),
        ze("ca_z", "Cold aisle near edge Z (room local, rack fronts)", "m", 0, -30, 30, 0.05, "Floor"),
        O1("ceil", "Suspended ceiling", !1, "Ceiling"),""")
# --- door on the raised floor + outside stairs; live re-render while dragging a slider
rep("""    const R = Math.min(e("door_w") || 1.2, C.len - 0.4),
      H = Math.min(e("door_h") || 2.2, r - 0.15),
      k = (C.len - R) / 2;""", """    const R = Math.min(e("door_w") || 1.2, C.len - 0.4),
      y0 = Math.max(0, a || 0),
      H = Math.min(e("door_h") || 2.2, r - y0 - 0.15),
      k = (C.len - R) / 2;""")
rep("""      _.push({
        size: M(C.along, R, r - H),
        pos: S(C.at, C.along, 0, H + (r - H) / 2),
        n: C.n,
        k: C.s + "c",
      }),
      (b = {
        pos: S(C.at, C.along, 0, H / 2),""", """      _.push({
        size: M(C.along, R, r - y0 - H),
        pos: S(C.at, C.along, 0, y0 + H + (r - y0 - H) / 2),
        n: C.n,
        k: C.s + "c",
      }),
      y0 > 0 &&
        _.push({
          size: M(C.along, R, y0),
          pos: S(C.at, C.along, 0, y0 / 2),
          n: C.n,
          k: C.s + "d",
        }),
      (b = {
        y0,
        at: C.at,
        n: C.n,
        pos: S(C.at, C.along, 0, y0 + H / 2),""")
rep("""                  pos: S(b.pos, b.along, (C * b.dw) / 2, b.dh / 2),""", """                  pos: S(b.pos, b.along, (C * b.dw) / 2, b.y0 + b.dh / 2),""")
rep("""      a > 0 && x.jsx(E6, { W: t, D: n, H: a, perf: !0, ca: NXR_ca(i.params) }),
      !!i.params.ceil &&""", """      b && b.y0 > 0.05 && x.jsx(NXR_steps, { b, s }),
      a > 0 && x.jsx(E6, { W: t, D: n, H: a, perf: !0, ca: NXR_ca(i.params) }),
      !!i.params.ceil &&""")
rep("""  (Pr("p:" + i + ":" + e), (n.params[e] = t), wt.geoRev++);""", """  (Pr("p:" + i + ":" + e), (n.params[e] = t), wt.geoRev++, (wt.nxLast = i));""")
rep("""  const r = tF[i.type];
  return x.jsx($f.Provider, {""", """  const r = tF[i.type];
  ye(() => (wt.nxLast === i.id ? wt.geoRev : -1));
  return x.jsx($f.Provider, {""")
# --- UPS: live data without a fluid network, model, power distribution
rep("""        try {
          this.telemetry.set(n.id, n.tele(e.x, t));
        } catch {}
      });
    }""", """        try {
          this.telemetry.set(n.id, n.tele(e.x, t));
        } catch {}
      });
    }
    for (const c of this.scene.comps) {
      const d = tn[c.type];
      if (d && d.nxTele)
        try {
          this.telemetry.set(c.id, d.nxTele(c, this));
        } catch {}
    }""")
rep("""    o = !!n.arch,
    a = new Map();""", """    o = !!n.arch && !n.nxLive,
    a = new Map();""")
rep("""              x.jsx(NXE_env, {}),""", """              x.jsx(NXE_env, {}),
              x.jsx(NXE_power, {}),""")
rep('const tF = {\n', 'const tF = {\n    ups: NXM_ups,\n')
rep('  Y3 = {\n', '  Y3 = {\n    ups: "bolt",\n')
rep('    clog: ["העמסת המסנן", "%", 0],', """    ups_P_it: ["עומס IT (כל הארונות)", "kW", 1],
    ups_P_mech: ["עומס קירור קריטי (משאבת CDU + מאווררי CRAH)", "kW", 1],
    ups_P_out: ["הספק יציאה כולל", "kW", 1],
    ups_load_pct: ["עומס מתוך דירוג ה־UPS", "%", 0],
    ups_mod_need: ["מודולים נדרשים (N)", "", 0],
    ups_redund: ["מודולי גיבוי (+X)", "", 0],
    ups_eta: ["נצילות", "%", 1],
    ups_P_in: ["הספק כניסה מהרשת", "kW", 1],
    ups_autonomy: ["זמן גיבוי בסוללות בעומס הנוכחי", "min", 1],
    ups_I_out: ["זרם יציאה כולל", "A", 0],
    ups_I_bus: ["זרם בכל פס צבירה (A/B, חלוקה שווה)", "A", 0],
    ups_I_bus_fail: ["זרם בפס אחד כשהשני מנותק", "A", 0],
    clog: ["העמסת המסנן", "%", 0],""")
rep("""              x.jsx(QF, {}),
              x.jsx(KF, {}),""", """              x.jsx(QF, {}),
              x.jsx(NXQ_auto, {}),
              x.jsx(NXQ_merge, {}),
              x.jsx(KF, {}),""")
rep("""    _ = Math.min(480, Math.max(24, Math.round(w * 18))),
    M = (S) => new Yf(y, _, S, 20, !1);""", """    _ = Math.min(220, Math.max(16, Math.round(w * 8))),
    M = (S) => new Yf(y, _, S, 12, !1);""")
rep("""function da({ geom: i, mats: e, m: t, shadow: n = !0 }) {""", """function da({ geom: i, mats: e, m: t, shadow: n = !0, cull: nxC = !1 }) {""")
rep("""      castShadow: n,
      receiveShadow: !0,
      frustumCulled: !1,
      children: x.jsx(br, { ...t }),""", """      castShadow: n,
      receiveShadow: !0,
      frustumCulled: nxC,
      children: x.jsx(br, { ...t }),""")
# 10. add-on functions (models, illustrations, panel) at module end
addon = '\n'.join(R(p) for p in ['src/models.js', 'src/illus_core.js', 'src/illus_a.js', 'src/illus_b.js', 'src/illus_c.js', 'src/pipecolor.js', 'src/env.js', 'src/panel.js', 'src/ups.js','src/merge.js'])
src = src.rstrip() + '\n' + addon + '\n'
open('app.mod.js', 'w', encoding='utf-8').write(src)
print('ok', len(src))
