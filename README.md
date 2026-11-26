<div align="center">

# ThermoSim 3D

**A browser-based 3D simulator for thermodynamic and liquid-cooling systems**

Build a plant from real components, connect them with pipes, and watch a fully coupled solver compute pressures, flows and temperatures live. Inject failures (grid loss, pump trip, leaks) and watch every parameter respond, with the equation behind each change.

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)
![Three.js](https://img.shields.io/badge/Three.js-r169-000000?logo=threedotjs&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white)
![Units](https://img.shields.io/badge/units-SI-ff8a3d)
![UI](https://img.shields.io/badge/UI-Hebrew%20%2F%20RTL-ff8a3d)
![Install](https://img.shields.io/badge/install-none%20(single%20HTML)-success)

<img src="docs/screenshots/main-dark.jpg" alt="AI data-center liquid-cooling plant: cooling towers, chiller, pumps, CDU and four GPU racks" width="100%">

[**Download**](release/ThermoSim3D.html) · [Promo video](docs/video/ThermoSim3D_promo.mp4) · [Features](#highlights) · [Failure simulation](#failure-simulation) · [Screenshots](#screenshots) · [Controls](#controls) · [Build](#run-from-source)

</div>

---

<div align="center">

[<img src="docs/screenshots/promo-poster.jpg" alt="ThermoSim 3D promo video, 60 s" width="80%">](docs/video/ThermoSim3D_promo.mp4)

<sub>60-second overview: real thermodynamic equations, flow simulation, grid loss and N+1 pump failure. Click to play.</sub>

</div>

## Try it in 10 seconds

Download **[`release/ThermoSim3D.html`](release/ThermoSim3D.html)** (use **Download raw file** on its GitHub page) and double-click it.
The whole app (3D engine, physics, fluid tables, scenarios) is inside that single file. No install, no internet needed. Works best in Chrome or Edge.

> On older PCs without a graphics card, choose **View → Graphics quality → Fast**.

---

## Highlights

| | |
|---|---|
| **Coupled network solver** | Every loop is solved simultaneously (Levenberg–Marquardt on a sparse Jacobian) with implicit-Euler thermal inertia. Pressure, mass flow and enthalpy at every node. |
| **Real fluid properties** | Tables generated with CoolProp: water/steam (IAPWS-95), R134a, R410A, MEG 30 %, **PG25**, ideal-gas air. Full two-phase model. |
| **35 components** | Pumps, compressors, turbines, boiler, condenser, evaporator, chiller, open and hybrid cooling towers, dry cooler, CRAH, CDU, cold plates, plate and shell-and-tube heat exchangers, AI racks, UPS, filters, air separator, 3-way and balancing valves, sensors, tanks, and more. |
| **Failure simulation** | Grid loss with UPS → generator transfer, N+1 standby pump, chiller and cooling-tower trips, CDU failure, pipe leak and clog. See [below](#failure-simulation). |
| **State graphs with equations** | 13 live charts (electrical, hydraulic, thermal, leak). Each shows its governing equations and explains in words why every value rose or fell. |
| **"How it works" for each part** | Click any component to see its purpose, operating steps, the governing thermodynamic process and the exact equations the solver uses. |
| **Safety warnings** | Boiling, freezing, over-pressure, cavitation, chip over-temperature, compressor discharge temperature and more show in red with a ⚠ sign. |
| **Thermal camera** | FLIR-style IR rendering (Ironbow / Rainbow / White-hot) with auto-ranging legend and shading that keeps geometry readable. |
| **CAD-style workflow** | SolidWorks-like ribbon and docks, undo/redo, duplicate, port snapping, connection suggestions, editable pipe routes with elbows. |
| **Room builder** | Rooms, walls (click-to-draw), raised floors and ceilings. The wall nearest the camera fades out so you can always see inside. |
| **Save and share** | `Ctrl+S` saves a self-contained `.html`: opening it resumes exactly where you stopped, including the camera. |
| **Light / dark theme** | Full Hebrew RTL interface. |

---

## Failure simulation

Open the orange **⚡ כשלים וגרפי מצב** (Failures & state graphs) button at the bottom left, start the simulation and trigger a fault.

<table>
<tr>
<td width="50%"><img src="docs/screenshots/failure-charts.jpg" alt="Electrical state graphs during a grid loss"><br><sub><b>Grid loss</b>: IT load stays on UPS, the generator picks up the plant. Hover any chart for exact values.</sub></td>
<td width="50%"><img src="docs/screenshots/failure-scenarios.jpg" alt="Failure scenarios and N+1 pump skid"><br><sub><b>N+1 pump skid</b>: duty pump A trips, standby pump B starts after detection and ramp-up.</sub></td>
</tr>
</table>

| Event | Sequence and physics |
|---|---|
| **Grid loss** | UPS carries the IT load from battery (SOC and autonomy tracked) → mechanical loads stop → generator starts (≈10 s) → ATS transfers → pumps, then fans, then chiller restart in sequence. Optional generator failure. |
| **Pump failure (N+1)** | Coast-down ω = ω₀·e^(−t/τ) → flow drops → fault detected → standby pump ramps up. Without N+1 the loop flow is lost and temperatures rise. |
| **Chiller / tower trip** | Heat rejection lost, supply temperature rises, anti short-cycle delay before restart. COP = η₂·T_e/(T_c − T_e). |
| **Pipe leak** | ṁ = C_d·A·√(2ρΔP), loop inventory and expansion-tank level fall. |
| **Clog** | Filter or pipe loss coefficient K = (1/(0.62(1−c)) − 1)² grows over time, flow drops, ΔP rises. |

All failure assumptions are editable in the panel's **Assumptions** tab. Details: [`addons/failure-sim`](addons/failure-sim).

---

## Screenshots

<table>
<tr>
<td width="50%"><img src="docs/screenshots/thermal-ir.jpg" alt="Thermal IR view of GPU racks"><br><sub><b>Thermal camera</b>: live surface temperatures of the GB200 racks and supply/return piping</sub></td>
<td width="50%"><img src="docs/screenshots/main-light.jpg" alt="Light theme with system tree and properties"><br><sub><b>Light theme</b>: system tree, properties and "how it works" for the selected rack</sub></td>
</tr>
<tr>
<td width="50%"><img src="docs/screenshots/rankine.jpg" alt="Steam Rankine cycle"><br><sub><b>Steam Rankine cycle</b>: boiler, turbine, condenser and feed pump</sub></td>
<td width="50%"><img src="docs/screenshots/chiller.jpg" alt="Vapour-compression chiller"><br><sub><b>Vapour-compression chiller</b>: compressor, condenser, TXV and evaporator with R134a</sub></td>
</tr>
</table>

---

## Built-in scenarios

| Scenario | What it shows |
|---|---|
| **AI data-center liquid cooling** | 4 × NVIDIA GB200 NVL72 racks (120 kW each, 87 % to liquid, 130 L/min PG25 at 25 °C) → CDU → chiller → cooling tower. Three coupled loops. |
| **Steam Rankine power cycle** | Boiler → steam turbine → surface condenser → feed pump, with IAPWS-95 steam. |
| **Vapour-compression chiller** | Compressor → condenser → TXV → evaporator with R134a, superheat control. |

---

## Controls

| Action | Mouse / key |
|---|---|
| Look around | Left-drag on empty space |
| Move through the scene | `W` `A` `S` `D` (along the view direction), `Q` / `E` down / up, `Shift` faster |
| Rotate / pan / zoom (SolidWorks style) | Middle-drag / `Ctrl` + middle-drag / wheel |
| Fit to screen · standard views | `F` or double-click the wheel · `Ctrl+1…7`, `Space` for the view cube |
| Select · move component | Click · drag |
| Rotate · duplicate · delete | `R` · `Ctrl+D` · `Del` |
| Pipe tool | `P`: click an outlet, click the floor to add bends, click an inlet |
| Undo · redo | `Ctrl+Z` · `Ctrl+Y` |
| Save · open project | `Ctrl+S` · `Ctrl+O` |
| Thermal view | `I` |
| Failures & state graphs | ⚡ button, bottom left |
| Run / pause · single step | `Shift+Space` · `N` |
| All shortcuts | `F1` |

---

## Run from source

```bash
npm install
npm run dev              # http://localhost:5173  (?t=dc | rankine | vcc to choose the start scenario)
npm run build:single     # builds the one-file app into dist-single/index.html
```

The published [`release/ThermoSim3D.html`](release/ThermoSim3D.html) also contains the add-ons in [`addons/`](addons), which are patched into the compiled bundle. Build order is described in [`addons/README.md`](addons/README.md).

**Checks**

```bash
npm run typecheck
npm run test:props       # fluid properties vs. published reference points
npm run test:templates   # headless solve of the three scenarios
npm run test:components  # convergence of the newer components
```

To regenerate the fluid tables (needs Python with CoolProp): `python scripts/gen_tables.py`.

---

## How it is built

```
src/
├── physics/              pure TypeScript, no rendering
│   ├── fluidProperties.ts    property lookup (CoolProp tables in data/)
│   ├── thermodynamics.ts     Churchill friction, ε-NTU, isentropic work, psychrometrics
│   ├── components.ts         equation set of every component
│   ├── physicsEngine.ts      network compiler + simultaneous solver
│   └── templates.ts          the three scenarios
├── render/               React Three Fiber scene
│   ├── ProceduralComponents.tsx  detailed procedural 3D models
│   ├── Pipes.tsx                 routed pipes, elbows, insulation, flow indicator
│   ├── ThermalShader.ts          FLIR-style GLSL
│   └── SceneView.tsx             camera, placement, dragging, pipe routing
├── ui/                   Hebrew RTL interface (ribbon, docks, panels, safety checks, save/load)
└── runtime.ts            simulation state, undo/redo, project files

addons/                   patches applied to the compiled bundle (see addons/README.md)
├── core/                 D2C data-center scene, extra components, UPS, illustrations
├── tools/                integration scripts
└── failure-sim/          failure engine, state graphs, N+1 pump, IR upgrade
```

The physics layer has no UI dependencies, so it can be tested and run headless.

**Units:** SI throughout (kPa, K / °C, kg/s, kW, kJ/kg).

**Custom 3D models:** every part is procedural by default. You can load your own `.glb` per component type from **Tools → Model manager**. See [`docs/ASSET_CHECKLIST.md`](docs/ASSET_CHECKLIST.md).

---

## Sources

* Fluid properties: [CoolProp](http://www.coolprop.org/) (IAPWS-95 for water; Melinder correlations for glycol mixtures).
* GB200 NVL72 rack data: HPE QuickSpecs and QCT (≈ 115 kW to liquid + 17 kW to air at full load, ≈ 130 L/min per rack).
* Failure-model parameters (generator, UPS, delays, leak size) are engineering defaults, not manufacturer data. They are editable in the app.

---

<div align="center">
<sub>Developed by Tomer Schwartz, Mechanical Engineering (renewable &amp; alternative energy), SCE, with Claude.</sub>
</div>
