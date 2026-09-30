# AGENTS.md — switch-mode

## What this is

An interactive, slow-motion visualization of **switch-mode DC-DC converters** — buck (step-down),
boost (step-up) and inverting buck-boost. A live circuit simulation drives an animated schematic
(current-flow dots on the switch-ON loop, the switch-OFF/diode loop and the load), a five-lane
oscilloscope (gate, switch node, inductor voltage, inductor current, output voltage), and
measurement tiles (average/ideal V_out, ripples, CCM/DCM, efficiency).

## Key facts for agents

- **Single file:** `index.html` (inline HTML, CSS, and JavaScript — no build step, no bundler, no package manager).
- **No dependencies to install.** Open `index.html` directly in a browser to run it.
- **No tests, no TypeScript, no linter.** Verify by opening the page in a browser; `window.__smps`
  exposes `{ P, S, stats, step, settle, coldStart, idealVout }` for scripted checks (e.g. Playwright:
  set a topology, call `settle()`, compare `stats.vAvg` with `idealVout(P.duty)`).
- **Not a pnpm workspace.** There is no `package.json` here (same as `microcosm` / `opensauce`).
- **Fully offline:** no runtime network requests, no fonts/CDNs.

## Simulation model

- State: inductor current `S.iL` and output-capacitor voltage magnitude `S.v` (the buck-boost
  output is displayed negated). Symplectic Euler with `SPP = 200` steps per switching period.
- Non-synchronous converter: the diode stops conduction when `iL` reaches 0 (DCM); `iL` is clamped ≥ 0.
- Optional losses: 0.45 V diode drop, 50 mΩ switch R_on, 50 mΩ inductor DCR.
- Duty is latched at the start of each period. With **Regulate** on, `regulate()` runs once per period:
  an integrator on the output error plus capacitor-current feedback (damps the LC resonance), with
  gains scaled from L, C and the plant's dV/dD so it stays stable across the slider ranges.
- Playback speed is in switching cycles per real second; the scope is a ring buffer of the last
  500 periods. Slow sweeps draw left→right over the previous trace; fast sweeps show the last
  complete sweep (triggered-scope look). When the speed is > 4 cycles/s the schematic blends the
  ON/OFF loops by the fraction of time each is active.

## Deployment

Deployed to `https://jacobcrigby.github.io/web_toys/switch-mode/` by copying the directory as-is
(`cp -r switch-mode dist/switch-mode` in the root `deploy.yml`).

## Conventions

- Keep everything inline in `index.html`. Do not split into separate files or add a build step.
- No external network requests.
- License: Apache-2.0 (`LICENSE` file in this directory); source carries the `SPDX-License-Identifier: Apache-2.0` header.
