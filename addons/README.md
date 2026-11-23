# Add-ons

The ready-to-run app in [`release/`](../release) is the compiled TypeScript app from [`src/`](../src) plus add-ons that are patched into the compiled bundle.

| Folder | Content |
|---|---|
| [`core/`](core) | D2C data-center scene and models: cold plates, hybrid tower, filters, 3-way and balancing valves, UPS, room layout, illustrations, static mesh merging |
| [`tools/`](tools) | `integrate.py` patches the `core/` add-ons into the bundle, `build.py` re-inlines the script |
| [`failure-sim/`](failure-sim) | Failure engine, state graphs, N+1 pump, improved IR view |

Build order: `src/` → `npm run build:single` → `tools/integrate.py` → `failure-sim/patch2.py` → `failure-sim/patch3.py`.

Porting these add-ons back into `src/` as TypeScript is planned.
