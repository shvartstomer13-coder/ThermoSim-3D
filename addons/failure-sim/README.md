# Failure simulation add-on (experimental)

Adds a failure and state-graph panel to ThermoSim 3D: grid loss, UPS then generator,
N+1 standby pump, chiller / cooling tower / CDU faults, pipe leak and clog.
Every graph shows its governing equation and a live explanation of why each parameter moved.

## Files
- `fx_core.js`: failure engine (electrical model, pump duty/standby skid, fault injection, monitors)
- `fx_ui.js`: panel, charts, equation sheets, 3D standby pump
- `patch2.py`: IR (thermal) view patch, applied to the compiled bundle
- `patch3.py`: pump non-return valve, live leak/clog pipe parameters, injects `fx_core.js` + `fx_ui.js`

## Status
These patches were applied to the compiled single-file bundle, not to `src/`.
The ready build is `release/ThermoSim3D_failure-sim.html`.
The paths inside `patch2.py` / `patch3.py` point to the author's working directory and need adjusting.
Porting the engine into `src/physics/` is still open.

## Model notes
- Added a non-return valve term to the pump and CDU pump equations (without it the model gave reverse flow at zero speed).
- All failure assumptions (generator start time, ATS delay, battery size, fuel, detection delays, leak diameter) are defaults
  editable in the panel. They are not manufacturer data.
