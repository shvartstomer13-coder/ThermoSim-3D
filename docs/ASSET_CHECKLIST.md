# GLB asset checklist

```text
GLB SOURCING CHECKLIST — one optional file per component type
Conventions: metres, +Y up, origin at the centre of the floor footprint (X right, Z toward the viewer), glTF 2.0 binary (.glb),
PBR metal/rough materials, ≤ 60k triangles each, baked pivots (no rotated parents), no cameras/lights/animations required.
Ports are mapped in the Asset Manager by clicking the model, or name empty nodes “PORT_<id>” in your DCC tool as a reminder.

[01] valve.glb — Control Valve
     footprint W×H×D: 0.5 × 0.7 × 0.3 m
     PORT_in       in   DN100  at (-0.25, 0.20, 0.00)  normal (-1, 0, 0)
     PORT_out      out  DN100  at (0.25, 0.20, 0.00)  normal (1, 0, 0)
     note: Kv-based globe/ball control valve with equal-percentage or linear trim.

[02] flow_meter.glb — Flow Meter
     footprint W×H×D: 0.5 × 0.6 × 0.35 m
     PORT_in       in   DN100  at (-0.25, 0.20, 0.00)  normal (-1, 0, 0)
     PORT_out      out  DN100  at (0.25, 0.20, 0.00)  normal (1, 0, 0)
     note: Inline Coriolis/electromagnetic flow meter spool.

[03] pressure_sensor.glb — Pressure Transducer
     footprint W×H×D: 0.5 × 0.6 × 0.35 m
     PORT_in       in   DN100  at (-0.25, 0.20, 0.00)  normal (-1, 0, 0)
     PORT_out      out  DN100  at (0.25, 0.20, 0.00)  normal (1, 0, 0)
     note: Inline pressure transducer spool with gauge.

[04] temp_sensor.glb — Temperature Sensor
     footprint W×H×D: 0.5 × 0.6 × 0.35 m
     PORT_in       in   DN100  at (-0.25, 0.20, 0.00)  normal (-1, 0, 0)
     PORT_out      out  DN100  at (0.25, 0.20, 0.00)  normal (1, 0, 0)
     note: Inline RTD thermowell spool.

[05] manifold_split.glb — Supply Header (split)
     footprint W×H×D: 3 × 0.6 × 0.5 m
     PORT_in       in   DN150  at (-1.80, 0.30, 0.00)  normal (-1, 0, 0)
     PORT_out1     out  DN50   at (-1.35, 0.30, 0.00)  normal (0, 1, 0)
     PORT_out2     out  DN50   at (-0.45, 0.30, 0.00)  normal (0, 1, 0)
     PORT_out3     out  DN50   at (0.45, 0.30, 0.00)  normal (0, 1, 0)
     PORT_out4     out  DN50   at (1.35, 0.30, 0.00)  normal (0, 1, 0)
     note: Distributes flow to N parallel branches (equal pressure at the header).

[06] manifold_merge.glb — Return Header (merge)
     footprint W×H×D: 3 × 0.6 × 0.5 m
     PORT_in1      in   DN50   at (-1.35, 0.30, 0.00)  normal (0, 1, 0)
     PORT_in2      in   DN50   at (-0.45, 0.30, 0.00)  normal (0, 1, 0)
     PORT_in3      in   DN50   at (0.45, 0.30, 0.00)  normal (0, 1, 0)
     PORT_in4      in   DN50   at (1.35, 0.30, 0.00)  normal (0, 1, 0)
     PORT_out      out  DN150  at (1.80, 0.30, 0.00)  normal (1, 0, 0)
     note: Collects N parallel branches (adiabatic mixing).

[07] exp_tank.glb — Expansion Tank (pressure ref.)
     footprint W×H×D: 0.8 × 1.5 × 0.8 m
     PORT_ref      ref  DN40   at (0.40, 0.30, 0.00)  normal (1, 0, 0)
     note: Fixes the absolute pressure of the circuit node it is connected to (closes the pressure level of a closed loop).

[08] pump.glb — Centrifugal Pump
     footprint W×H×D: 0.95 × 0.75 × 0.5 m
     PORT_in       in   DN80   at (-0.50, 0.35, 0.00)  normal (-1, 0, 0)
     PORT_out      out  DN80   at (0.12, 0.75, 0.00)  normal (0, 1, 0)
     note: Variable-speed centrifugal pump (affinity laws, quadratic H-Q curve) or fixed-mass-flow feed pump.

[09] rack.glb — AI Server Rack (D2C)
     footprint W×H×D: 0.8 × 2.2 × 1.25 m
     PORT_in       in   DN50   at (-0.22, 2.20, 0.00)  normal (0, 1, 0)
     PORT_out      out  DN50   at (0.22, 2.20, 0.00)  normal (0, 1, 0)
     note: High-density GPU rack with direct-to-chip liquid cold plates. Lumped chip/cold-plate thermal mass, flow-dependent UA, thermal throttling.

[10] cdu.glb — Coolant Distribution Unit (CDU)
     footprint W×H×D: 1.3 × 2 × 0.9 m
     PORT_sec_in   in   DN80   at (-0.50, 2.00, 0.15)  normal (0, 1, 0)
     PORT_sec_out  out  DN80   at (-0.17, 2.00, 0.15)  normal (0, 1, 0)
     PORT_pri_in   in   DN80   at (0.17, 2.00, 0.15)  normal (0, 1, 0)  [pass 2]
     PORT_pri_out  out  DN80   at (0.50, 2.00, 0.15)  normal (0, 1, 0)  [pass 2]
     note: Liquid-to-liquid CDU: secondary (TCS) pump + reservoir/expansion tank + plate HX to facility water (primary).

[11] plate_hx.glb — Plate Heat Exchanger
     footprint W×H×D: 0.7 × 1.3 × 0.45 m
     PORT_hot_in   in   DN80   at (-0.24, 1.30, 0.00)  normal (0, 1, 0)
     PORT_hot_out  out  DN80   at (-0.08, 1.30, 0.00)  normal (0, 1, 0)
     PORT_cold_in  in   DN80   at (0.08, 1.30, 0.00)  normal (0, 1, 0)  [pass 2]
     PORT_cold_out out  DN80   at (0.24, 1.30, 0.00)  normal (0, 1, 0)  [pass 2]
     note: Counter-flow gasketed plate HX, enthalpy-based ε-NTU with phase-change capable capacity rates.

[12] chiller.glb — Industrial Chiller
     footprint W×H×D: 3.6 × 2.1 × 1.5 m
     PORT_chw_in   in   DN100  at (-1.40, 2.10, 0.45)  normal (0, 1, 0)
     PORT_chw_out  out  DN100  at (-0.90, 2.10, 0.45)  normal (0, 1, 0)
     PORT_cw_in    in   DN125  at (0.90, 2.10, 0.45)  normal (0, 1, 0)  [pass 2]
     PORT_cw_out   out  DN125  at (1.40, 2.10, 0.45)  normal (0, 1, 0)  [pass 2]
     note: Packaged water chiller: capacity-limited leaving-water control, Carnot-fraction COP, condenser heat rejection = Qe + W.

[13] cooling_tower.glb — Induced-Draft Cooling Tower
     footprint W×H×D: 3.2 × 3.6 × 3.2 m
     PORT_in       in   DN125  at (1.60, 3.00, 0.00)  normal (1, 0, 0)
     PORT_out      out  DN125  at (1.60, 0.45, 0.80)  normal (1, 0, 0)
     note: Counter-flow wet tower: effectiveness vs wet-bulb (NTU ∝ fan^0.6·flow^-0.4). Basin fixes the loop pressure.

[14] boiler.glb — Boiler / Heat Source
     footprint W×H×D: 3.2 × 3.2 × 2 m
     PORT_in       in   DN80   at (-0.70, 3.20, 0.00)  normal (0, 1, 0)
     PORT_out      out  DN100  at (0.70, 3.20, 0.00)  normal (0, 1, 0)
     note: Fired boiler / superheater with metal wall thermal mass, distributed marching heat transfer, over-temperature fuel trip.

[15] steam_turbine.glb — Steam Turbine
     footprint W×H×D: 2.6 × 1.3 × 1.1 m
     PORT_in       in   DN100  at (-0.70, 1.30, 0.00)  normal (0, 1, 0)
     PORT_out      out  DN250  at (0.80, 1.30, 0.00)  normal (0, 1, 0)
     note: Axial turbine: isentropic expansion with efficiency, speed correction and wetness penalty; Stodola flow law or fixed expansion ratio; generator.

[16] gas_turbine.glb — Gas Turbine
     footprint W×H×D: 2.6 × 1.3 × 1.1 m
     PORT_in       in   DN100  at (-0.70, 1.30, 0.00)  normal (0, 1, 0)
     PORT_out      out  DN250  at (0.80, 1.30, 0.00)  normal (0, 1, 0)
     note: Axial turbine: isentropic expansion with efficiency, speed correction and wetness penalty; Stodola flow law or fixed expansion ratio; generator.

[17] condenser.glb — Condenser
     footprint W×H×D: 3.2 × 1.3 × 1.1 m
     PORT_in       in   DN50   at (-1.10, 1.30, 0.00)  normal (0, 1, 0)
     PORT_out      out  DN40   at (1.10, 1.30, 0.00)  normal (0, 1, 0)
     note: Shell-and-tube/air-cooled condenser: refrigerant/steam side + external sink (T, capacity rate). Closure: exit = saturated/sub-cooled liquid.

[18] evaporator.glb — Evaporator
     footprint W×H×D: 2.6 × 1.1 × 0.95 m
     PORT_in       in   DN40   at (-0.90, 1.10, 0.00)  normal (0, 1, 0)
     PORT_out      out  DN50   at (0.90, 1.10, 0.00)  normal (0, 1, 0)
     note: Direct-expansion/flooded evaporator with external heat source (T, capacity rate). Superheat is a result of the energy balance.

[19] expansion_valve.glb — Expansion / Throttling Valve
     footprint W×H×D: 0.5 × 0.6 × 0.35 m
     PORT_in       in   DN20   at (-0.25, 0.20, 0.00)  normal (-1, 0, 0)
     PORT_out      out  DN25   at (0.25, 0.20, 0.00)  normal (1, 0, 0)
     note: Isenthalpic throttling orifice (ṁ = Cd·A·√(2ρΔP)). TXV mode holds evaporator superheat.

[20] compressor_centrifugal.glb — Centrifugal Compressor
     footprint W×H×D: 1.8 × 1.2 × 1 m
     PORT_in       in   DN65   at (-0.55, 1.15, 0.00)  normal (0, 1, 0)
     PORT_out      out  DN50   at (0.55, 1.15, 0.00)  normal (0, 1, 0)
     note: Centrifugal compressor: isentropic-head vs flow curve (affinity), isentropic efficiency, or fixed pressure ratio.

[21] compressor_recip.glb — Reciprocating Compressor
     footprint W×H×D: 1.5 × 1.1 × 0.9 m
     PORT_in       in   DN65   at (-0.55, 1.15, 0.00)  normal (0, 1, 0)
     PORT_out      out  DN50   at (0.55, 1.15, 0.00)  normal (0, 1, 0)
     note: Reciprocating compressor: volumetric flow (displacement, clearance η_v), isentropic efficiency, or fixed pressure ratio.

Pipes, flanges, bolt rings and flow indicators are always generated procedurally (parametric), so no GLB is needed for them.
```
