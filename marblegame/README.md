# marblegame

Get the marble to the goal.

A tilt-to-roll 3D marble game (in the lineage of Labyrinth, Perplexus, and
Rollgoal) built with Babylon.js and the Havok physics engine. You never move the
marble directly — you tilt the surface and gravity does the rest.

**Play the latest build:** https://jacobcrigby.github.io/marblegame/

## Controls

- **WASD / arrow keys** — tilt the table (mouse-drag and gamepad also work)
- **R** — reset the marble and level the table
- **I** — toggle the Babylon Inspector

## Develop

```bash
npm install
npm run dev        # Vite dev server with HMR
npm run build      # type-check + production build
npm run typecheck  # tsc --noEmit
```

## Docs

- `PLAN.md` — plan-driven development tracker (scope, decisions, phases)
- `AGENTS.md` — operating guide for AI coding agents
- `docs/alpha-plan.html` — the full Alpha design document

Pushes to `main` build and deploy to GitHub Pages via
`.github/workflows/deploy.yml`.
