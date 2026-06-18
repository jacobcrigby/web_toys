# Battleship — Design Spec

_Date: 2026-06-18_

## Context

A new browser toy in the web_toys monorepo: a faithful Battleship implementation with VS-AI and online peer-to-peer multiplayer, designed to ship as v1 (Classic mode) and extend to v2 (Advanced Mission with special weapons) without engine refactoring. The weapon-aware `Action` union and modular engine design means v2 is additive, not a rewrite.

---

## Scope

| Version | Scope |
|---|---|
| **v1** | Classic mode (1 shot/turn), VS AI (Easy/Medium/Hard), Online WebRTC, configurable grid size, manual + random ship placement |
| **v2** | Advanced Mission: Exocet, Tomahawk, Apache, Torpedoes, Sonar, Recon Planes, Anti-Aircraft Guns |

---

## Game Rules

**Standard fleet** (same for all grid sizes):
| Ship | Size |
|---|---|
| Aircraft Carrier | 5 |
| Battleship | 4 |
| Destroyer | 3 |
| Submarine | 3 |
| Patrol Boat | 2 |

**Classic mode**: alternate turns, one shot per turn; first to sink all 5 enemy ships wins.

**Grid**: player-selectable at game start — **8×8, 10×10, or 12×12**. Rows labeled A–H/J/L, columns 1–8/10/12. Cells indexed row-major: `cell = row * cols + col`.

---

## Architecture

Mirrors the UTTT project structure exactly: `engine/` → pure rules; `ai/` → difficulty strategies; `ui/` → mount-once/render-on-state; `network/` → WebRTC session; `storage/` → localStorage versioning; `controller.ts` → single source of truth with `commit()`.

```
battleship/
├── index.html
├── vite.config.ts            # base: '/web_toys/battleship/', es2022, ESM workers
├── tsconfig.json             # strict, noUncheckedIndexedAccess
├── package.json              # "battleship", scripts: dev/build/typecheck/lint/test
├── biome.json
└── src/
    ├── main.ts               # init GameController, auto-join ?room=
    ├── controller.ts         # commit(), maybeDispatchAiTurn(), network callbacks
    ├── state.ts              # AppState
    ├── storage.ts            # localStorage, BattleshipV1 versioning
    ├── engine/
    │   ├── types.ts
    │   ├── index.ts          # barrel
    │   ├── ships.ts          # SHIP_SIZES, placement validation
    │   ├── state.ts          # createInitialState, applyAction (immutable)
    │   ├── rules.ts          # isLegalAction, legalCells
    │   ├── weapons.ts        # resolveAction: cell patterns for each weapon type
    │   ├── ammo.ts           # ammo tracking, deductAmmo, weaponAvailable
    │   ├── recon.ts          # recon plane state transitions, scan result logic
    │   └── __tests__/
    ├── ai/
    │   ├── types.ts          # AiPlayer interface
    │   ├── easy.ts
    │   ├── medium.ts
    │   ├── hard.ts           # Web Worker client
    │   ├── hard.worker.ts
    │   └── index.ts          # createAi factory
    ├── network/
    │   ├── protocol.ts       # GameMessage discriminated union
    │   └── session.ts        # BattleshipSession wrapping @web-toys/multiplayer
    ├── ui/
    │   ├── render.ts         # top-level mount()/render(state, prev)
    │   ├── grid.ts           # buildGrid(), syncGrid() — 10×10 cells, event delegation
    │   ├── placement.ts      # ship placement UI (queue, preview, rotate, undo, random)
    │   ├── weapons.ts        # v2 weapon panel: buttons, pattern preview, ammo display
    │   ├── hud.ts            # turn indicator, grid size badge, scores
    │   ├── menu.ts           # mode + grid size selector
    │   ├── lobby.ts          # room code + waiting screen
    │   ├── overlay.ts        # win/resign/disconnect overlays
    │   └── dom.ts            # h() helper
    └── styles/
        ├── index.css
        ├── tokens.css        # colors, spacing, motion (matches UTTT conventions)
        ├── base.css
        ├── grid.css          # cell states: untried / miss / hit / sunk
        ├── ships.css         # ship tokens during placement
        └── placement.css
```

---

## Engine & State

### Core Types (`engine/types.ts`)

```typescript
type GridConfig = { rows: number; cols: number }

type ShipKind = 'carrier' | 'battleship' | 'destroyer' | 'submarine' | 'patrol'

// SHIP_SIZES constant lives in engine/ships.ts (not types.ts)
// Shown here for reference:
// const SHIP_SIZES: Record<ShipKind, number> = {
//   carrier: 5, battleship: 4, destroyer: 3, submarine: 3, patrol: 2,
// }

interface ShipPlacement {
  kind: ShipKind
  origin: number      // cell index
  orientation: 'h' | 'v'
}

interface PlayerBoard {
  ships: ShipPlacement[]
  shotsReceived: number[]   // all cells attacked against this player (hit or miss)
}

interface Ammo {
  exocet: number      // starts 2; 0 when Carrier sunk
  tomahawk: number    // starts 1; 0 when Battleship sunk
  apache: number      // starts 2; 0 when Destroyer sunk
  torpedo: number     // starts 2; 0 when Submarine sunk
}

type ReconPlane =
  | { status: 'on-carrier' }
  | { status: 'deployed'; cell: number }
  | { status: 'destroyed' }

interface ReconState {
  plane1: ReconPlane
  plane2: ReconPlane
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
  | { kind: 'anti-aircraft'; cell: number }

interface GameState {
  mode: 'classic' | 'advanced'
  grid: GridConfig
  phase: 'battle' | 'over'   // placement is pre-game, not in GameState
  currentPlayer: 0 | 1
  boards: [PlayerBoard, PlayerBoard]
  ammo: [Ammo, Ammo]
  recon: [ReconState, ReconState]
  winner: 0 | 1 | null
  actionCount: number
}
```

**Invariant**: `GameState` is JSON-plain — no Map/Set/class instances. Verified by `JSON.stringify` round-trip in tests.

### Key Engine Rules

- `isLegalAction(state, action, playerIndex)`:
  - Classic: only `shot` is legal; target cell must be un-shot
  - Advanced: weapon actions require the associated ship to be afloat AND ammo > 0
  - `recon-scan` requires the plane to be deployed (not on carrier, not destroyed)
  - `anti-aircraft` fires on your own grid, not the enemy's

- `resolveAction(state, action)` → `ActionResult`:
  - Returns cells hit, ships sunk, recon findings, plane destroyed (if AA gun or carrier hit with parked plane)
  - Torpedo stops at first hit — cells beyond are not revealed
  - When a ship sinks: ammo for its weapon type drops to 0; planes parked on a sunk Carrier are destroyed

- `applyAction(state, action)`:
  - Calls `resolveAction`, produces new `GameState`
  - Switches `currentPlayer` unless action is informational (sonar/recon results are revealed but turn ends)

---

## AppState & Controller

```typescript
interface AppState {
  screen: 'menu' | 'placement' | 'lobby' | 'battle' | 'over'
  settings: Settings         // mode, gridConfig, aiDifficulty, humanPlayerIndex
  placementProgress: PlacementProgress | null
  game: GameState | null     // null until placement complete
  aiThinking: boolean
  scores: [number, number]
  connection: Connection | null
  disconnectedAt: number | null
}
```

`commit(patch: Partial<AppState>)` merges, persists to localStorage, and calls `render(state, prev)`.

---

## Ship Placement (Pre-Game)

Placement lives in `PlacementProgress` (not in `GameState`):
```typescript
interface PlacementProgress {
  playerIndex: 0 | 1         // whose turn to place (local player in online)
  placed: ShipPlacement[]
  queue: ShipKind[]          // remaining ships to place
  hoveredCell: number | null
  orientation: 'h' | 'v'
}
```

**Manual flow**: ships queue in size order; click cell = set origin, R key = rotate, click confirm = anchor. Undo removes last placed ship. Preview renders green (valid) or red (invalid) on hover.

**Random**: `randomPlacement(grid, rng)` fills all ships at once. "Reshuffle" reruns. Switching to manual after randomizing pre-fills `placed` and empties `queue`.

**Online**: both players place simultaneously on their own screen. When done, send `{ type: 'placement', ships: ShipPlacement[] }` via Trystero. Battle starts when both placements received. Ship positions are in the shared state (trust model — no cryptographic commitment, appropriate for a casual toy; noted here for transparency).

---

## AI

All three implement `AiPlayer`:
```typescript
interface AiPlayer {
  chooseAction(
    state: GameState,
    playerIndex: 0 | 1,
    opts: { rng: () => number; signal: AbortSignal }
  ): Promise<Action>
}
```

**Easy** (`ai/easy.ts`): Random untried cell. In Advanced mode, fires special weapons randomly when available.

**Medium** (`ai/medium.ts`): Hunt/target heuristic:
- _Hunt_: checkerboard pattern (maximizes coverage since min ship length is 2)
- _Target_: when confirmed hits from an unsunk ship exist, fire adjacent to hit cells
- In Advanced mode: uses weapons when probability of hitting multiple ships in weapon area is high (simple area-coverage heuristic)

**Hard** (`ai/hard.ts` + `ai/hard.worker.ts`): Probability-density map:
- After each shot, count valid placements for each remaining ship across all grid cells
- Fire at highest-density unsunk cell
- Runs in Web Worker; fallback to Medium if worker fails
- In Advanced mode: evaluates weapon patterns against density map, fires weapon if total density in pattern exceeds single-cell density by a threshold

---

## Multiplayer

Uses `@web-toys/multiplayer` (Trystero/WebRTC). Follows UTTT's `MultiplayerSession` pattern.

```typescript
// network/protocol.ts
type GameMode = 'classic' | 'advanced'

type GameMessage =
  | { type: 'settings';   mode: GameMode; grid: GridConfig }  // host → guest on join
  | { type: 'placement';  ships: ShipPlacement[] }
  | { type: 'action';     action: Action }
  | { type: 'resign' }
```

**Flow**:
1. Host creates room (6-char code), sets mode + grid size, sends `settings` to guest on connect
2. Both place ships; each sends `placement` when done
3. Active player sends `action`; both apply locally and re-render
4. `?room=CODE` URL auto-joins as guest (same as UTTT)
5. Disconnect: 30-second grace period before abandon overlay

---

## v2 Advanced Mission Weapons

All weapon geometry lives in `engine/weapons.ts`. All patterns clip to grid bounds.

| Weapon | Ship | Charges | Pattern |
|---|---|---|---|
| Exocet | Aircraft Carrier | 2 total, 1/turn | P1: Plus (center+NSEW, 5 cells); P2: X (center+diagonals, 5 cells) |
| Tomahawk | Battleship | 1 total, 1/turn | 3×3 square (9 cells) |
| Apache | Destroyer | 2 total, 1/turn | P1: 3 cells vertical; P2: 3 cells horizontal |
| Torpedo | Submarine | 2 total, 1/turn | Entire row (H) or column (V); stops + explodes at first hit |
| Sonar | Submarine | 1/turn, unlimited total | 3×3 area; returns `detected: boolean` only (no positions) |
| Recon Move | Carrier (plane) | 1/turn, unlimited total | Moves a plane to any enemy-grid cell; cannot also scan or attack same turn |
| Recon Scan | Carrier (plane) | 1/turn, unlimited total | P1: 4-cell plus around plane; P2: 4-cell corners around plane; reveals exact hit/miss; cannot also move or attack same turn |
| Anti-Aircraft | (defense) | 1/turn, unlimited total | Fire on your own grid; destroys enemy plane if present |

All actions cost the active player's full turn (no combining).

**Weapon disabling**: when a ship sinks, its weapon charges drop to 0 and the UI button greys out permanently. Planes parked on a sunk Carrier are immediately destroyed; deployed planes survive independently.

**Recon plane vulnerability**: `resolveAction` checks whether any shot/weapon blast covers a Carrier cell that has a parked plane. If so, the plane is destroyed as part of that attack.

---

## UI — Battle Screen Layout

```
┌─────────────────────────────────────┐
│  ENEMY WATERS  (grid: cols × rows)  │  ← click to fire; hover preview
│  [v2 weapon panel: buttons + ammo]  │
├─────────────────────────────────────┤
│  Turn indicator / status message    │
├─────────────────────────────────────┤
│  MY FLEET      (grid: cols × rows)  │  ← your ships; incoming shots shown
│  [v2: recon plane status, AA gun]   │
└─────────────────────────────────────┘
```

**Cell states** (CSS data attributes, color never sole indicator — shape/icon used too):
- `untried`: neutral
- `miss`: white peg marker
- `hit`: red peg marker
- `sunk`: revealed ship silhouette

**v2 weapon panel**: appears above Enemy Waters in Advanced mode. One button per ship weapon (Exocet/Tomahawk/Apache/Torpedo) + Sonar + AA Gun. Greyed when ship sunk or ammo = 0. Selecting a weapon switches to multi-cell targeting preview on hover.

**Recon planes**: shown as small plane icons on Enemy Waters at their current cell; grayed when destroyed.

---

## Screens

| Screen | Trigger |
|---|---|
| Menu | initial load; play again |
| Lobby | VS Online selected; host shows code, guest enters code |
| Placement | lobby complete; or VS AI selected |
| Battle | both placements confirmed |
| Game Over overlay | winner determined or resign |

---

## Accessibility

- Full keyboard play: Tab/arrow roving focus on grid, Space to fire
- ARIA grid role with `aria-label` per cell (e.g. "B3, miss")
- Visually-hidden status region (`aria-live="polite"`) announces hit/miss/sunk
- `prefers-reduced-motion` disables peg-drop animations
- Color + shape: misses = circle outline, hits = filled circle + red, never color alone

---

## Monorepo Integration

1. Create `battleship/` with Vite project scaffold
2. Add `'battleship'` to `pnpm-workspace.yaml`
3. Add card to root `index.html` (emoji: ⚓ or 🚢)
4. Add `cp -r battleship/dist dist/battleship` to `.github/workflows/deploy.yml`
5. `vite.config.ts` base: `/web_toys/battleship/`

---

## Verification

```bash
# From repo root
pnpm install
pnpm -C battleship run typecheck
pnpm -C battleship run lint
pnpm -C battleship run test
pnpm -C battleship run build

# Manual test checklist
# v1:
# - Place ships manually (rotate, undo, all 5 ships placed)
# - Place ships randomly, reshuffle
# - VS AI: all three difficulties, win and lose
# - Online: host + guest, full game, disconnect/reconnect, resign
# - 8×8 / 10×10 / 12×12 grid sizes each

# v2 (Advanced Mission):
# - Each special weapon fires correctly (verify cell patterns)
# - Weapon greyed out after ship sinks
# - Exocet/Apache both patterns
# - Torpedo stops at first hit
# - Sonar returns correct detected/clear
# - Recon plane moves, scans, gets shot down by AA gun
# - Recon plane destroyed when Carrier is sunk while parked
```
