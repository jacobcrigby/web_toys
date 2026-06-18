# AGENTS.md — Battleship

Orientation for coding-agent sessions. Read this before touching any code.

## Project

In-browser Battleship. Two modes: VS AI (Easy/Medium/Hard) and online peer-to-peer via WebRTC room codes.

**v1**: Classic mode (1 shot/turn), configurable grid size (8×8 / 10×10 / 12×12), manual + random ship placement.
**v2**: Advanced Mission — special weapons (Exocet, Tomahawk, Apache, Torpedo, Sonar, Recon Planes, Anti-Aircraft Guns).

Vanilla TypeScript + Vite, no UI framework, zero runtime dependencies (except `@web-toys/multiplayer` for WebRTC). Vitest for tests, Biome for format+lint.

**Spec**: `docs/superpowers/specs/2026-06-18-battleship-design.md` (at repo root)

## Commands

| Command | What |
|---|---|
| `pnpm dev` | Dev server at `http://localhost:5173/web_toys/battleship/` |
| `pnpm test` / `pnpm run test:watch` | Vitest run / watch |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | `biome check .` / `biome format --write .` |
| `pnpm build` | typecheck + `vite build` |
| `pnpm preview` | Serve the production build locally |

**Canonical gate** (run before every commit):
```
pnpm typecheck && pnpm lint && pnpm test && pnpm build
```

## Architecture

Layer hierarchy (importing across layers is a violation):
```
main → controller
controller → ui, ai, engine, storage, network
ai → engine
ui → engine (types only; never imports controller)
engine → nothing
network → nothing
```

`src/ui/` is the only layer touching `document`. It receives an `Actions` callback object and never imports the controller directly.

```
src/
  main.ts               # boot: styles, new GameController(root, deps).init()
  controller.ts         # GameController: owns AppState; all mutations via commit()
  state.ts              # AppState, Settings, PlacementProgress types
  storage.ts            # localStorage "battleship:v1" with version guard
  engine/               # pure rules; no DOM, no randomness
    index.ts            #   barrel export — consumers import ONLY from 'src/engine'
    types.ts            #   GridConfig, ShipKind, ShipPlacement, Action union, GameState, ...
    ships.ts            #   SHIP_SIZES, shipCells(), isValidPlacement(), validateFleet()
    state.ts            #   createInitialState(), applyAction() (immutable)
    rules.ts            #   isLegalAction(), legalCells()
    weapons.ts          #   resolveAction() → ActionResult; weapon cell patterns
    ammo.ts             #   (v2) weaponAvailable(), deductAmmo()
    recon.ts            #   (v2) plane move/scan/destroy logic
    __tests__/
  ai/
    types.ts            #   AiPlayer interface
    easy.ts             #   random legal shot
    medium.ts           #   hunt/target heuristic
    hard.ts             #   probability-density Web Worker client
    hard.worker.ts      #   Web Worker entry
    index.ts            #   createAi factory
  network/
    protocol.ts         #   GameMessage discriminated union
    session.ts          #   BattleshipSession wrapping @web-toys/multiplayer
  ui/
    render.ts           #   mount(root, actions) / render(state, prev)
    grid.ts             #   buildGrid() / syncGrid() — event delegation
    placement.ts        #   ship placement UI
    weapons.ts          #   (v2) weapon panel
    hud.ts              #   turn indicator, scores
    menu.ts             #   mode + grid size + difficulty selector
    lobby.ts            #   room code entry/display
    overlay.ts          #   win/resign/disconnect overlays
    dom.ts              #   h() helper
  styles/
    index.css           #   @import barrel
    tokens.css          #   colors, space, radius, motion
    base.css
    layout.css
    grid.css            #   cell states: untried/miss/hit/sunk
    ships.css
    placement.css
```

## Key Types

```ts
type GridConfig = { rows: number; cols: number };

type ShipKind = 'carrier' | 'battleship' | 'destroyer' | 'submarine' | 'patrol';
// SHIP_SIZES: carrier=5, battleship=4, destroyer=3, submarine=3, patrol=2

interface ShipPlacement {
  kind: ShipKind;
  origin: number;        // cell index (row-major: row * cols + col)
  orientation: 'h' | 'v';
}

type Action =
  | { kind: 'shot';          cell: number }
  | { kind: 'exocet';        center: number; pattern: 1 | 2 }
  | { kind: 'tomahawk';      center: number }
  | { kind: 'apache';        center: number; pattern: 1 | 2 }
  | { kind: 'torpedo';       startCell: number; dir: 'h' | 'v' }
  | { kind: 'sonar';         center: number }
  | { kind: 'recon-move';    planeId: 1 | 2; cell: number }
  | { kind: 'recon-scan';    planeId: 1 | 2; pattern: 1 | 2 }
  | { kind: 'anti-aircraft'; cell: number };

interface GameState {
  mode: 'classic' | 'advanced';
  grid: GridConfig;
  phase: 'battle' | 'over';
  currentPlayer: 0 | 1;
  boards: [PlayerBoard, PlayerBoard];
  ammo: [Ammo, Ammo];
  recon: [ReconState, ReconState];
  winner: 0 | 1 | null;
  actionCount: number;
}

interface AiPlayer {
  chooseAction(
    state: GameState,
    playerIndex: 0 | 1,
    opts: { rng: () => number; signal: AbortSignal }
  ): Promise<Action>;
}
```

## Conventions

- **TDD is mandatory for `src/engine/` and `src/ai/`**: write the failing Vitest test first. UI tests optional (add `jsdom` + `// @vitest-environment jsdom` per file).
- **Immutability**: `applyAction()` returns a new `GameState` — never mutate. The only exception is internal MCTS playout clones in the hard AI worker.
- **`GameState` must stay JSON-plain**: no Map/Set/Date/class instances — it crosses `postMessage` to the hard AI worker. Enforce with a JSON round-trip invariant test.
- **Strict tsconfig is non-negotiable**: `noUncheckedIndexedAccess` means array indexing can return `T | undefined`. Narrow explicitly; never weaken the config.
- **CSS**: plain CSS only. Design tokens (colors, space, radius, motion) in `tokens.css`. Cell states use `data-state` attributes, not classes. Color is never the sole indicator — use shape/icon too.
- **A11y baseline**: ARIA grid role, `aria-label` per cell (e.g. "B3, miss"), visually-hidden `aria-live` region for hit/miss, roving tabindex + arrow keys, Space to fire, `prefers-reduced-motion` disables animations.
- **Base path**: `base: '/web_toys/battleship/'` in vite.config.ts — unconditional in dev and prod. Never hardcode absolute URLs.
- **Worker**: `new Worker(new URL('./hard.worker.ts', import.meta.url), { type: 'module' })`. Worker file starts with `/// <reference lib="webworker" />`. Logic lives in an exported `handleRequest()` for unit tests; worker is just a thin adapter.
- Tests co-locate with source as `src/**/*.test.ts` — a `tests/` dir won't be picked up.

## Grid Coordinate System

Cell index: `cell = row * cols + col` (row-major)
- Row 0 = A, row 1 = B, …, row 9 = J (for 10×10)
- Col 0 = 1, col 1 = 2, …
- Utility functions `cellToCoord(cell, grid)` and `coordToCell(row, col, grid)` in `engine/types.ts`

## Ship Placement Rules

- Ships placed H (horizontal) or V (vertical), never diagonal
- All cells of a ship must be within grid bounds
- Ships may not overlap
- All 5 ships must be placed before battle begins

## Weapon Rules (v2)

- A weapon is unavailable if its associated ship is sunk or ammo is exhausted
- Weapons disabled when ship sinks: Exocet if Carrier sunk, Tomahawk if Battleship sunk, Apache if Destroyer sunk, Torpedo/Sonar if Submarine sunk
- Recon planes on Carrier are destroyed if the Carrier cell they occupy is hit
- Deployed planes (on enemy grid) survive carrier sinking
- All actions (shot, weapon, sonar, recon-move, recon-scan, anti-aircraft) cost the active player's full turn

## Gotchas

- `build:all` at repo root runs `pnpm --filter '*' run build` — battleship must have a `build` script.
- Base path is `/web_toys/battleship/` in dev AND prod (`vite.config.ts base` is unconditional).
- The hard AI worker cannot be unit-tested via Vitest (node env) — export `handleRequest()` for tests, smoke-check the deployed worker manually.
- `noUncheckedIndexedAccess` means `boards[i]` is `PlayerBoard | undefined` — use `boards[0 as 0]` or write checked helpers.
