# AGENTS.md

Guidance for AI coding agents (Claude Code, OpenCode, and others) working in
this repository. Read this first, then read `PLAN.md`. Detailed design lives in
`docs/alpha-plan.html`.

## What this project is

A 3D marble game in the spirit of the classic Labyrinth tabletop game, Perplexus,
and Rollgoal. The player **never moves the marble directly** — they tilt the play
surface and gravity rolls the marble. Built with **Babylon.js** and the **Havok**
physics plugin.

The current target is the **Alpha**: a marble rolling on a tiltable table with
walls and a few test boxes for collision. See `PLAN.md` for scope and phases.

## Tech stack

- **Language:** TypeScript (strict mode)
- **Rendering:** Babylon.js (`@babylonjs/core`)
- **Physics:** Havok via `@babylonjs/havok` + Babylon's `HavokPlugin` (Physics v2 API)
- **Build/dev:** Vite
- **Runtime target:** Modern evergreen browsers, desktop first (device-tilt/gyro deferred)

## Commands

> These exist once Phase 0 (scaffolding) is complete. If they are missing, you are
> in Phase 0 — create them per `PLAN.md` before doing anything else.

```bash
npm install        # install dependencies
npm run dev        # start Vite dev server with HMR
npm run build      # type-check + production build
npm run preview    # serve the production build locally
npm run typecheck  # tsc --noEmit
npm run check:physics  # headless NullEngine+Havok physics assertions
```

## Repository layout

```
marblegame/
  index.html              # Vite entry HTML, mounts the canvas
  package.json
  tsconfig.json
  vite.config.ts
  public/                 # static assets served as-is (Havok wasm, audio, env)
  scripts/
    physicsCheck.ts       # headless physics verification (npm run check:physics)
  docs/
    alpha-plan.html       # the detailed Alpha plan (design of record)
  src/
    main.ts               # bootstrap: create canvas + GameApp, start loop
    config/
      GameConfig.ts       # single source of truth for tunables
    core/
      GameApp.ts          # owns Engine, Scene, render loop, lifecycle
    physics/
      PhysicsWorld.ts     # Havok init, gravity, plugin enable
    scene/
      SceneBuilder.ts     # camera + lights + environment/IBL
      Table.ts            # tiltable board: one ANIMATED compound body, slerped tilt
      Marble.ts           # glassy smoky sphere + dynamic body
      TestObjects.ts      # fixed obstacles (boxes, ramps, upright cylinders) added to the board compound
      compoundPart.ts     # shared helper: attach a mesh+shape to the board compound
    input/
      TiltIntent.ts       # normalized tilt value type
      InputSource.ts      # interface every input source implements
      InputManager.ts     # aggregates sources -> single TiltIntent
      KeyboardInput.ts
      MouseInput.ts
      GamepadInput.ts
    audio/
      AudioService.ts     # interface + NullAudioService stub; collision hook
    ui/
      DebugOverlay.ts     # FPS readout + Babylon Inspector toggle
```

Do not invent parallel folder structures. If a file's home is unclear, follow the
table above or ask.

## Architecture rules

- **One concern per module.** `GameApp` owns lifecycle; it does not build glass
  materials. `Table` owns tilt; it does not read the keyboard.
- **Input flows one way:** input sources → `TiltIntent` → `InputManager` (combine
  + clamp) → `Table` applies tilt. Sources never touch the table or physics
  directly.
- **All tunables live in `GameConfig`.** Gravity, tilt limits, marble size,
  friction/restitution, camera angle, colors — no magic numbers scattered in
  logic. Change behavior there, not inline.
- **Physics motion types:** marble and boxes are `DYNAMIC`; the table and walls are
  `ANIMATED` (kinematic, driven by the pivot node's transform). The ground/IBL are
  static.
- **The audio seam is real but inert in Alpha.** Code calls `AudioService` on
  collisions; the wired implementation is `NullAudioService`. Do not block the
  Alpha on sourcing sound assets.

## Plan-Driven Development workflow

This project is built plan-first. Code follows the plan; the plan is not
reverse-engineered from the code.

1. **Read `PLAN.md` before writing code.** Find the current phase (first phase with
   unchecked boxes).
2. **Work one phase at a time, in order.** Each phase has acceptance criteria. Do
   not start the next phase until the current phase's criteria are met.
3. **Keep the plan in sync.** When a task is done, check its box in `PLAN.md` in the
   same change. If reality forces a design change, update `PLAN.md` and
   `docs/alpha-plan.html` rather than letting them drift.
4. **No scope creep.** If something isn't in the current phase or the Alpha scope,
   it waits. Propose it; don't smuggle it in.

## Clean code principles (required)

Write code that reads like the code already here. Match naming and idiom.

- **KISS** — the simplest thing that satisfies the acceptance criteria. No
  speculative frameworks.
- **YAGNI** — build only what the current phase needs. No "we might want…" code.
- **DRY with the Rule of Two** — do not abstract on the first occurrence. Wait for
  the second real use, then factor out. Premature abstraction is a defect.
- **Single responsibility** — small modules with one clear job (see layout above).
- **Comments describe the present, not the past.** A comment says how the code
  works *now*. History belongs in Git, not in comments. Delete commented-out code.
  Do not write narrative ("first we…, then we…", "changed this to…") or restate the
  code. Prefer a clear name over a comment.

## Git workflow

- Develop on the branch you were assigned (see your task instructions). Create it
  locally if needed.
- Commit in focused units with clear, imperative messages (e.g. "Add Havok physics
  world and gravity"). One phase may be several commits.
- Push with `git push -u origin <branch>`.
- **Do not open a pull request unless explicitly asked.**

## When in doubt

Ask. A short clarifying question is cheaper than a wrong abstraction or
out-of-scope work.
