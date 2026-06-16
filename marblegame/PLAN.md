# PLAN.md — Marble Game

Plan-driven development tracker. This is the source of truth for **what** we are
building and **in what order**. Agents: read `AGENTS.md` first, then this file,
then `docs/alpha-plan.html` for the full design rationale.

## Vision

A tilt-to-roll 3D marble game (Labyrinth / Perplexus / Rollgoal lineage). The
player tilts the play surface; gravity moves the marble. Built on Babylon.js +
Havok physics.

## Alpha goal

A marble rolling on a tiltable table with containing walls and a few test boxes
for collision. Prove out the rendering, physics, tilt-control, and audio-seam
foundations that every later feature builds on.

### In scope (Alpha)

- Glassy, smoky, see-through marble (PBR glass + smoky tint).
- A flat table with raised walls that tilts on two axes via player input.
- Tilt controls: **keyboard (baseline)**, mouse drag, gamepad — all behind one
  input abstraction.
- A handful of dynamic test objects — boxes, ramps, and cylinders — to test
  collisions, gravity feel, and non-square contact.
- Fixed angled overhead camera.
- Reset (re-center marble, level the table).
- Debug overlay (FPS + Babylon Inspector toggle).
- Audio *seam*: collision hook calls an `AudioService`; Alpha ships the stub.

### Out of scope (Alpha — do not build yet)

- Goal hole / win / lose states.
- Levels, mazes, level loading.
- Real audio assets, music.
- Menus, scoring, persistence.
- Inside-a-sphere (Perplexus) mode.
- Device tilt / gyro controls (deferred — adds iOS permission + HTTPS work).

## Locked decisions

| Area        | Decision                                                            |
|-------------|---------------------------------------------------------------------|
| Language    | TypeScript (strict)                                                  |
| Build       | Vite                                                                 |
| Engine      | Babylon.js (`@babylonjs/core`)                                       |
| Physics     | Havok (`HavokPlugin`, Physics v2 API)                                |
| World       | Tilting flat table + walls under a pivot `TransformNode`             |
| Controls    | Keyboard + mouse drag + gamepad, via `TiltIntent` (gyro deferred)    |
| Camera      | Fixed angled `ArcRotateCamera`, user controls detached              |
| Marble      | PBR glass, smoky tint volume, IBL reflections                       |
| Audio       | `AudioService` interface + `NullAudioService` stub in Alpha          |

## Architecture at a glance

```
input sources ──► TiltIntent ──► InputManager (combine + clamp) ──► Table.applyTilt()
                                                                        │
                                                          pivot TransformNode rotates
                                                                        │
        Havok: marble & boxes are DYNAMIC, table & walls are ANIMATED  │
                                                                        ▼
                         gravity rolls the marble across the tilted surface
                                                                        │
                              collision observable ──► AudioService.playClack()
```

See `docs/alpha-plan.html` for the full breakdown.

## Milestones

Work top to bottom. A phase is done only when every box is checked **and** its
acceptance criteria hold. Check boxes in the same change that completes the work.

> **Verification status:** Phases 0–8 are implemented; `npm run typecheck` and
> `npm run build` pass and the dev server serves the full module graph. The
> acceptance criteria that need a GPU browser (visual look, roll feel, FPS) have
> **not** been confirmed yet — no headless browser is available in the build
> environment. First task next session: open it in a browser and validate, then
> run Phase 9.

### Phase 0 — Scaffolding
- [x] `package.json` with Babylon, Havok, Vite, TypeScript
- [x] `tsconfig.json` (strict), `vite.config.ts`, `index.html` with a fullscreen canvas
- [x] `src/main.ts` boots a Babylon scene with a render loop and clear color
- [x] npm scripts: `dev`, `build`, `preview`, `typecheck`
- **Accept:** `npm run build` and `typecheck` clean; dev server serves the entry. ✔ (visual blank-scene check pending in browser)

### Phase 1 — Scene foundation
- [x] `GameApp` owns Engine, Scene, resize handling, and the render loop
- [x] `SceneBuilder` adds the fixed angled `ArcRotateCamera` (controls detached)
- [x] Lighting (hemispheric + directional) and an environment/IBL texture (`ReflectionProbe`)
- [x] Play surface provided by `Table` (no separate reference ground needed)
- **Accept:** Lit scene from the fixed camera; resize handled. ✔ (visual check pending)

### Phase 2 — Physics world
- [x] `PhysicsWorld` initializes Havok (async wasm load) and enables physics with gravity
- [x] Dynamic bodies fall and rest (proven by the real marble/objects, not a throwaway sphere)
- **Accept:** Bodies fall under gravity and settle. ✔ (runtime check pending)

### Phase 3 — The marble
- [x] `Marble` builds the glassy smoky PBR sphere (tint + refraction + IBL)
- [x] Marble has a `DYNAMIC` body with mass/friction/restitution from `GameConfig`
- [x] Spawns above the surface and settles
- **Accept:** Reads as see-through smoked glass; rolls/settles believably. ✔ (visual check pending)

### Phase 4 — Tilting table
- [x] `Table` builds a flat surface + four raised walls as `ANIMATED` bodies under a pivot `TransformNode`
- [x] `Table.setTilt(intent)` + `update()` lerp the pivot within `GameConfig` tilt limits
- [x] Driven live by input (superseded the temporary hard-coded tilt)
- **Accept:** Tilting rolls the marble downhill; walls contain it. ✔ (runtime check pending)

### Phase 5 — Input system
- [x] `TiltIntent` type + `InputSource` interface
- [x] `InputManager` aggregates active sources into one clamped `TiltIntent` and drives `Table`
- [x] `KeyboardInput` (baseline), `MouseInput`, `GamepadInput`
- **Accept:** Keyboard tilts; each other source tilts when present; combined input clamped. ✔ (runtime check pending)

### Phase 6 — Test objects
- [x] `TestObjects` spawns `DYNAMIC` bodies: boxes (BOX), cylinders (CYLINDER), a ramp wedge (CONVEX_HULL)
- **Accept:** Marble knocks objects around; rolls down ramp/along cylinders; objects respect walls. ✔ (runtime check pending)

### Phase 7 — Audio seam
- [x] `AudioService` interface + `NullAudioService` stub wired in
- [x] Collision observable hook maps impulse → `playClack(volume)` (throttled)
- **Accept:** Collisions call the stub with a sensible volume; silent; no errors. ✔ (runtime check pending)

### Phase 8 — Debug & reset
- [x] `DebugOverlay` shows FPS and lazy-loads + toggles the Babylon Inspector via `I`
- [x] Reset key (`R`) re-centers the marble (clears velocity) and levels the table
- **Accept:** FPS visible, Inspector toggles, reset returns to a clean start. ✔ (runtime check pending)

### Phase 9 — Tuning pass
- [ ] Tune gravity, friction, restitution, tilt sensitivity, marble material in `GameConfig` (needs in-browser playtest)
- **Accept:** Rolling feels good and controllable; stable ~60 FPS on desktop.

## Definition of done (Alpha)

All phases complete and accepted; `npm run build`, `npm run typecheck`, and
`npm run check:physics` pass; no console errors; code adheres to the principles in
`AGENTS.md`; `PLAN.md` checkboxes reflect reality.

`npm run check:physics` runs a headless (NullEngine + Havok) simulation that
asserts the table tilt holds, the marble rolls when tilted, and obstacles ride the
board. Run it after any change to the table, marble, or physics setup.

## Risks & watch-items

- **Havok wasm loading** must be awaited before any physics body is created.
- **One ANIMATED compound body, driven by `rotationQuaternion`** — the board
  (surface + walls + obstacles) is a single `PhysicsBody` (ANIMATED) built from a
  `PhysicsShapeContainer`, tilted by slerping the root node's `rotationQuaternion`.
  Do **not** parent separate physics bodies under a pivot and rotate with Euler
  `rotation`: Havok writes the post-step transform back as a quaternion, which
  silently overrides Euler updates (tilt appears to reset after a few frames) and
  parented kinematic bodies don't drive the simulation (marble never rolls).
- **Obstacles are fixed to the board** — boxes, ramps, and upright cylinders are
  part of the table compound so they tilt with it. Cylinders stand on a flat face
  (vertical axis) so they read as obstacles, not rollers.
- **FPS-independent physics** — `setSubTimeStep(1000/60)` makes Babylon drain real
  elapsed time in fixed steps (built-in accumulator), so behavior is the same at
  30, 60, or 144 fps. Tilt is updated in `onBeforePhysicsObservable` so its feel is
  fixed-step too.
- **No tunneling, no launching** — the board body uses `PrestepType.ACTION` (swept
  contact, so a moving surface pushes the marble instead of teleporting through it),
  `update()` recomputes the root world matrix so ACTION reads a fresh target, the
  tilt is capped to a constant angular speed (`maxTiltSpeed`) so fast reversals
  can't fling the marble, and a world velocity limit caps marble speed. With
  `TELEPORT` the marble tunnels through the floor; with fraction-lerp tilt it
  launches on reversal — both are regression-checked by `npm run check:physics`.
- **Non-square colliders** — ramps and cylinders need correct collider shapes
  (convex/wedge mesh and cylinder), not box approximations, or the marble's roll
  feel will be wrong.
- **Glass cost** — PBR transmission/refraction is the heaviest material; keep the
  marble single and watch mobile performance in the tuning pass.
- **Input fighting** — detach camera user-controls so mouse-drag tilt and the
  camera don't compete for the pointer.
