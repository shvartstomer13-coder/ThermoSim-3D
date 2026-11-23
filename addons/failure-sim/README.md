# Failure simulation add-on

Adds the **Failures & state graphs** panel to ThermoSim 3D.

| Scenario | What is modelled |
|---|---|
| Grid loss | UPS takes the IT load instantly, mechanical loads drop, the generator starts and the ATS transfers. Battery SOC, autonomy, fuel and frequency droop are tracked. Optional generator start failure. |
| Pump failure (N+1) | Coast-down of the duty pump, fault detection delay, standby pump ramp-up. Shown in 3D as a duplex skid. |
| Chiller / cooling tower / hybrid tower trip | Loss of heat rejection, restart delays (anti short-cycle), resulting temperature rise. |
| CDU failure | Secondary loop flow and heat transfer loss. |
| Pipe leak | Orifice flow, loop inventory and expansion tank level. |
| Clog | Filter or pipe blockage with an orifice loss coefficient that grows over time. |

Every chart shows its governing equations and a live explanation of why each value moved.

## Files

| File | Purpose |
|---|---|
| `fx_core.js` | Failure engine: electrical model, pump duty/standby skid, fault injection, cause→effect monitors |
| `fx_ui.js` | Panel, charts, equation sheets, 3D standby pump |
| `patch2.py` | Thermal (IR) view upgrade, applied to the compiled bundle |
| `patch3.py` | Pump non-return valve, live leak/clog pipe parameters, injects `fx_core.js` + `fx_ui.js`, startup UI defaults |

```bash
python patch2.py base.html step2.html
python patch3.py step2.html release/ThermoSim3D.html
```

## Key equations

```
Pump          H = 1.2·H_r·(n/n_r)² − 0.2·H_r·(ṁ/ṁ_r)²      (+ non-return valve term for ṁ < 0)
Coast-down    ω(t) = ω₀·e^(−t/τ)
UPS battery   SOC(t) = SOC₀ − ∫P_out dt / (E_batt·η)  autonomy = SOC·E_batt·η / P_out
Generator     f = f₀·(1 − droop·P/P_rated)              fuel = ∫ bsfc·P/η_alt dt
Leak          ṁ_leak = C_d·A·√(2ρΔP)                     C_d = 0.62
Clog          K = (1/(0.62·(1−c)) − 1)²
Chiller       COP = η₂·T_e / (T_c − T_e)
Tower         ε = 1 − e^(−NTU),  Q = ε·ṁ·cp·(T_in − T_wb)
```

## Assumptions

All failure parameters (generator rating and start time, ATS delay, battery energy, fuel, detection delays, ramp times, leak diameter, clog rate) are **defaults editable in the panel**. They are engineering estimates, not manufacturer data.

The pump and CDU pump equations gained a non-return valve term. Without it the original curve allowed reverse flow through a stopped pump.
