# AGENTS.md — daylight-map

Read the monorepo `../AGENTS.md` first. This file covers what is specific to this project.

## What this is

An interactive map of the continental US. Click a point and the app computes a
full year of sunrises and sunsets there under three scenarios — **current law**,
**permanent standard time**, and **permanent daylight saving time** — and reports
how many days cross two adjustable thresholds, by default *sunrise before
4:00 AM* and *sunset after 8:00 PM*.

The point of the toy is that those two numbers come from opposite geography:
early sunrises are an eastern-edge, high-latitude, permanent-standard
phenomenon, while late sunsets (and the dark winter mornings that pay for them)
are a western-edge, permanent-DST phenomenon. Keep that contrast legible in any
change you make to the UI copy or the charts.

## Commands

```
pnpm dev        # http://localhost:5173/web_toys/daylight-map/  (base applies in dev too)
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Gate before any commit: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.

## Architecture

```
src/
  main.ts  controller.ts  state.ts  url.ts
  solar/    NOAA solar position and sunrise/sunset     PURE: no DOM, no Intl, no Date
  time/     zone offsets, DST window, scenarios        PURE: Intl allowed
  geo/      tz lookup, CONUS classification, presets   PURE: tz-lookup allowed
  stats/    year series, threshold counts, extremes    PURE
  chart/    chart geometry and path strings            PURE
  ui/       everything that touches the DOM
  styles/
```

**Allowed imports.** Anything else is a layering violation:

```
main       → controller
controller → ui, stats, chart, solar, time, geo, url, state
ui         → state, stats, chart, time, geo   (types and formatters only; never computes)
url        → stats, time
chart      → stats, time, solar
stats      → solar, time
geo        → time
time       → solar   (calendar helpers and CivilDate only)
solar      → nothing
```

Hard rules:

- `src/ui/` is the only layer that touches `document`.
- `src/ui/map.ts` is the only file that imports `leaflet`.
- `src/geo/lookup.ts` is the only file that imports `@photostructure/tz-lookup`.
- `src/ui/` receives an `Actions` callback object and never imports the controller.

Tests are colocated as `src/**/*.test.ts`. **A separate `tests/` directory will
not run** — the vitest `include` in `vite.config.ts` only matches `src`.

Vitest runs in `environment: 'node'`. Leaflet touches `window` at import time and
throws there, so the layering above is a test-suite constraint, not just style:
nothing a pure-layer test imports may reach `ui/map.ts`.

## Load-bearing invariants

Each of these is enforced by a test. If you change the geography or the scenario
model, re-read them.

**No local-date rollover.** `sunEventsUtc` returns minutes from 00:00 UT of the
supplied date, and sunset can exceed 1440. Across the continental US, adding the
local offset always lands both events on the same local date, so the series does
`localMinutes = utcMinutes + offsetMinutes` with no date bookkeeping. The sweep
in `solar/events.test.ts` proves it, and it only holds when **each longitude is
paired with the offsets its own zone actually uses** — sweeping the whole
longitude range against all five offsets includes impossible pairs that really do
roll over. Margins are about 3h20m and 1h40m from midnight.

**Whole-day DST.** Transitions happen at 02:00 local, but every sunrise and
sunset in the continental US falls after that, so treating the March transition
day as wholly daylight time and the November one as wholly standard is exact for
this app. `time/dst.test.ts` pins the reasoning at Eastport, the country's
earliest sunrises.

**Arizona needs no special case.** `scenariosFor` gives a non-DST zone a `fixed`
rule for current law, so its current-law series is identical to its
permanent-standard series by construction.

**One solar year per location.** `solarYear` is the only expensive step (~1 ms);
the three scenarios are cheap `+offset` passes over it. Never recompute it per
scenario, and never recompute it on a threshold change — thresholds only affect
`scenarioStats`, which is why `restatResults` exists.

**`effectiveZone` refuses a rejected zone.** Open water still resolves to a
synthetic `Etc/GMT±n` zone and `Intl` accepts it happily, so falling back to the
detected zone would report a confident year of statistics for the mid-Atlantic.
Once `classifyPoint` returns `no-land-zone`, only an explicit override supplies a
zone.

## Data and its limits

- **Tiles**: CARTO basemaps (`light_all` / `dark_all`), OSM-derived, no API key.
  The OSM Foundation asks third-party apps not to use `tile.openstreetmap.org`,
  and CARTO additionally ships a matching dark style. Attribution is required and
  is in the map control and the footer.
- **Time zones**: `@photostructure/tz-lookup`, built from OpenStreetMap
  boundaries via timezone-boundary-builder. It is a **raster approximation**.
  Maine's eastern tip — Eastport, Lubec, Calais — is US Eastern time but resolves
  to `America/Moncton`. Presets therefore carry an explicit zone, and the
  controller sets an override whenever a preset's zone differs from what the
  raster reports. `geo/presets.ts` lists the known disagreements and
  `geo/presets.test.ts` pins them, so an upstream data fix shows up as a test
  failure rather than a silent change.
- **Solar**: NOAA general solar position, refined iteratively at each estimated
  event time, accurate to about a minute. Verified against published times for
  New York, Seattle, Detroit, and Miami, and cross-checked against `suncalc`
  (a devDependency used only as a test oracle) across 2,000+ samples.
  **Elevation is not modelled** — a sea-level horizon, per NOAA/USNO convention.
  Refraction is the standard 34′ constant. This is stated in the page footer;
  keep it there.

This project makes **runtime network requests** for map tiles. That is a
deliberate exception to the offline stance some sibling projects take, and the
only one — there is no backend, no accounts, and no telemetry.

## Charts

Geometry lives in `chart/model.ts` (pure, unit-tested); `ui/chart.ts` is a thin
translation to SVG nodes. SVG rather than canvas so colours come from CSS custom
properties and theming is free.

- Midnight at the top, the next midnight at the bottom, like a calendar day.
- **Straight segments only, no smoothing** — under current law the hour-long DST
  jumps must render as honest vertical steps.
- **Every id is suffixed with the scenario id.** Three charts share one document
  and duplicate ids make `clip-path` and `href` references resolve to the wrong
  element with no error at all.
- **Referenced geometry in `<defs>` carries no `fill` or `stroke`.** A `<use>`
  clone only inherits a paint property when the referenced element does not set
  one, so styling the source path directly makes every clone identical and
  silently defeats the threshold highlighting. This bug is invisible in tests —
  it only shows up on screen.
- The two chart hues were chosen by running the repo's palette validator, not by
  eye: yellow (daylight) against violet (past a threshold) clears the CVD and
  normal-vision separation floors in **both** modes. Yellow falls below 3:1 on
  the light surface, which obliges the relief rule — visible labels and a table
  view, both of which the page ships. Colour is never the sole indicator: the
  threshold regions also carry a hatch pattern, and every count appears as text.
- A shallow crossing is only a few pixels of fill, so the tripping stretch of the
  sunrise/sunset curve is stroked in the trip colour too. Without it Eastport's
  headline 66 days — a 19-minute crossing — is nearly invisible.

## Gotchas

1. **Never call `L.marker()`.** `L.Icon.Default` guesses `marker-icon.png` from
   the stylesheet path at runtime and 404s under `base: '/web_toys/daylight-map/'`.
   The selection marker is an `L.circleMarker`: pure SVG, CSS-themeable, no image
   assets. If a pin is ever genuinely needed:
   `import iconUrl from 'leaflet/dist/images/marker-icon.png?url'` (plus the 2x
   and shadow variants) and `L.Icon.Default.mergeOptions({ ... })`.
2. **`import * as L from 'leaflet'`.** `@types/leaflet` uses
   `export as namespace L` with named ESM exports and no default export.
3. **Never poll the map for its zoom.** Leaflet's animated `setView` leaves
   `getZoom()` returning the previous value until the animation settles, which
   wrote stale zooms into the URL. `MapHandle` deliberately exposes no zoom
   getter; zoom reaches the controller through `MapHandlers.onZoom` on `zoomend`.
4. **`esModuleInterop: true`** is the one deviation from the sibling tsconfigs.
   `@photostructure/tz-lookup` is CJS with `export =`, which a default import
   cannot consume under `verbatimModuleSyntax` without it. It is an interop
   setting, not a relaxation of type strictness — the rule against weakening the
   strict flags still stands.
5. **Round total minutes before splitting them.** `Math.round(m % 60)` yields
   "16:60". `time/format.ts` does it correctly and the test pins it.
6. **`noUncheckedIndexedAccess`** makes `days[i]` possibly undefined. Prefer
   `for (const d of days)`.
7. **SVG needs `createElementNS`.** `document.createElement` yields an
   `HTMLUnknownElement` for SVG tags — use the `svg()` helper in `ui/dom.ts`.
8. **`vitest run` exits non-zero with no test files**, so never leave the project
   without one.
9. The map container needs an explicit height or Leaflet renders it 0px tall.
   Call `invalidateSize()` after layout changes.
10. Keep the `{r}` tile placeholder and **do not** set `detectRetina: true` —
    CARTO's `@2x` tiles already cover the same extent, and `detectRetina` also
    shifts `zoomOffset` and would double-scale.

## Deliberately not built

A CONUS-wide heatmap overlay of a chosen statistic. The pure layers take plain
`(year, latitude, longitude, zone, thresholds)` arguments and return plain data
specifically so this can be added in a worker later without refactoring. If you
add it, `solarYear` is the unit of work to parallelise.
