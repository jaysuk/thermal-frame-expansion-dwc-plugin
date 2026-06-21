# Thermal Frame Expansion — DuetWebControl plugin

Measures your printer's **frame thermal-expansion coefficient** — how much the Z height drifts as the
frame heats up — and gives you a single number to plug into a thermal-compensation macro.

It runs a guided procedure: home, (optionally) tram, heat the bed (and hotend), heat-soak, then probe
Z repeatedly over several hours while logging the frame thermistor temperature. It fits Z drift
against frame temperature by least squares and reports the slope (`mm/°C`) and the fit quality (R²),
ready to drop into `sys/thermal-adjust-vars.g`:

```
set global.taCoeff = 0.001234
```

A Duet Web Control **3.7** plugin (Vue 3 / Vuetify 4), built against the DWC source tree.

## Requirements

- DuetWebControl 3.7+ (the plugin declares `dwcVersion: auto-major`).
- A **frame thermistor** configured in `config.g`, e.g. `M308 S2 P"..." Y"thermistor" A"Frame"`. The
  sensor *name* (the `A"..."` value) goes in the plugin's Setup tab.
- A working Z probe (`G30 S-1` must report a trigger height).

> ⚠️ A run can take several hours and **the browser tab must stay open** for the whole run.

## Install

Download `ThermalFrameExpansion-<version>.zip` from the latest [release](../../releases), then in DWC:
**Settings → General → Plugins → Install Plugin**, pick the ZIP, accept the third-party prompt and
reload. The plugin appears under **Plugins → Thermal Expansion**. It can also update itself in-app
(Plugins → Thermal Expansion → About).

## Develop

This plugin builds against a local DuetWebControl checkout and uses the shared
[`dwc-plugin-test-kit`](https://github.com/jaysuk/dwc-plugin-test-kit) for type-checking, tests and CI,
and [`dwc-plugin-runtime`](https://github.com/jaysuk/dwc-plugin-runtime) for self-update + diagnostics.

```bash
npm install
npm test                      # unit + component tests
DWC_DIR=/path/to/DuetWebControl npm run typecheck
DWC_DIR=/path/to/DuetWebControl npm run verify-build   # produces the installable ZIP
# or on Windows: build.bat (set DWC_DIR at the top first)
```

Releases are cut with `npm run release -- <version> --push`, which tags and pushes; CI then builds the
ZIP and publishes the GitHub Release (notes come from the shared changelog generator in the runtime
repo). Commit messages follow Conventional Commits (`feat:`, `fix:`, …) so the notes bucket correctly.

## License

GPL-3.0-or-later.
