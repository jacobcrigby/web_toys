# PLAN.md — Ultimate Tic-Tac-Toe implementation plan

Read AGENTS.md first (rules, conventions, architecture, gotchas). This file is the execution plan: work phases in order, check off tasks as you go.

## Current status

- **Phase:** 6 complete — all phases done; project feature-complete per plan
- **Next task:** none (maintenance only). Outstanding: on-device QA (iOS Safari `100dvh`, VoiceOver/TalkBack) needs physical hardware — headless checks done; revisit `role="application"` fallback only if SR testing shows cell-exploration problems.
- **Live URL:** https://jacobcrigby.github.io/ultimate-tic-tac-toe/

_Update this block and the checkboxes below in the same commit as the work._

**Canonical gate** (every phase's verification starts with this):
`npm run typecheck && npm run lint && npm test && npm run build`

---

## Phase 0 — Scaffold + CI + Pages

**Goal:** Empty-but-deployable project: toolchain, strict configs, CI that tests/typechecks/builds, placeholder page live on GitHub Pages.

### Tasks
- [x] Scaffold **non-interactively** — in a non-empty dir (LICENSE, .git) `npm create vite@latest .` prompts and can hang an agent shell, and its "remove existing files" answer would delete LICENSE. Instead: `npm create vite@latest tmp-scaffold -- --template vanilla-ts`, move its contents (including `.gitignore`) into the repo root, `rm -rf tmp-scaffold`. Delete demo cruft: `src/counter.ts`, `src/typescript.svg`, `public/vite.svg`. Replace `src/main.ts` with a minimal placeholder and `src/style.css` with an empty file (real styles arrive in Phase 2 under `src/styles/`).
- [x] `npm i -D vitest @biomejs/biome`. Take whatever current majors npm resolves (do not force version numbers from this plan). Commit `package-lock.json`.
- [x] Set `package.json` scripts:
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit",
    "format": "biome format --write .",
    "lint": "biome check ."
  }
}
```
- [x] Replace `vite.config.ts`:
```ts
/// <reference types="vitest/config" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  base: '/ultimate-tic-tac-toe/',
  build: { target: 'es2022' },
  worker: { format: 'es' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
```
- [x] Replace `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "moduleDetection": "force",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vite/client"],
    "useDefineForClassFields": true,
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "noEmit": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```
- [x] Add `biome.json`:
```json
{
  "$schema": "./node_modules/@biomejs/biome/configuration_schema.json",
  "formatter": { "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "javascript": { "formatter": { "quoteStyle": "single" } },
  "linter": { "enabled": true, "rules": { "recommended": true } },
  "files": { "ignoreUnknown": true }
}
```
- [x] Add `.github/workflows/ci.yml` (bump action majors to current at scaffold time):
```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npx biome ci .
      - run: npm test
      - run: npm run build
      - if: github.event_name == 'push' && github.ref == 'refs/heads/main'
        uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    needs: check
    runs-on: ubuntu-latest
    permissions:
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    concurrency:
      group: pages
      cancel-in-progress: false
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```
  Deliberately **no `actions/configure-pages` step**: it calls the Pages REST API, which needs `pages` permission the check job doesn't have (it would fail every main push with a misleading error), and nothing here uses its outputs — the base path is hardcoded in `vite.config.ts`, and upload/deploy don't require it.
- [x] `index.html`: title + "Ultimate Tic-Tac-Toe — coming soon" placeholder.
- [x] **Manual, one-time:** repo Settings → Pages → Source: **GitHub Actions** (deploy fails until set). _(Already configured — deploy job succeeded.)_
- [x] Push to main; confirm CI green and placeholder live; record the URL in the status block above.

### Acceptance criteria
- Canonical gate passes locally and in CI (note: no tests exist yet — `vitest run` must be configured/invoked so an empty suite does not fail CI; add a trivial placeholder test if needed, e.g. `src/smoke.test.ts`, removed in Phase 1).
- Placeholder page is live at `https://<owner>.github.io/ultimate-tic-tac-toe/` with no 404s for assets.

### Verification
`npm run typecheck && npm run lint && npm test && npm run build` · `npm run dev` serves at the base path · visit the Pages URL.

---

## Phase 1 — Engine (TDD)

**Goal:** Complete, pure, fully-tested rules engine in `src/engine/`. No DOM, no randomness, zero imports from other layers. Plain-data state (structured-clone-safe).

### Module layout
```
src/engine/
  types.ts      # Player, GridIndex, CellValue, BoardStatus, WinLine, Move, GameStatus, GameState
  lines.ts      # LINES win-line table + lineWinner helper
  board.ts      # computeBoardStatus
  rules.ts      # legalMoves, isLegalMove, playableBoards
  state.ts      # createInitialState, applyMove, applyMoveInPlace, cloneState, IllegalMoveError
  history.ts    # GameHistory, createHistory, currentState, pushMove, undo, undoToPlayerTurn
  index.ts      # re-exports the public API; consumers import ONLY from 'src/engine'
  __tests__/    # board.test.ts rules.test.ts state.test.ts history.test.ts fullGames.test.ts
                # helpers.ts fixtures/games.ts
```

### Types (`types.ts`) — exact
```ts
export type Player = 'X' | 'O';
export type GridIndex = 0|1|2|3|4|5|6|7|8;   // macro boards AND cells, reading order
export type CellValue = Player | null;
export type BoardStatus = Player | 'draw' | 'open';
export type WinLine = readonly [GridIndex, GridIndex, GridIndex];

export interface Move { board: GridIndex; cell: GridIndex }  // mover implied by state.currentPlayer

export type GameStatus =
  | { kind: 'playing' }
  | { kind: 'won'; winner: Player; line: WinLine }   // line = macro-grid indices
  | { kind: 'drawn' };

export interface GameState {
  cells: CellValue[];          // length 81, index = board*9 + cell
  boardStatus: BoardStatus[];  // length 9, derived cache, updated incrementally
  currentPlayer: Player;
  forcedBoard: GridIndex | null;  // null = free choice among open boards
  status: GameStatus;
  moveCount: number;
}
```

### Public API (re-exported from `index.ts`)
```ts
// lines.ts
export const LINES: readonly WinLine[]; // [0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]
export function lineWinner<T>(get: (i: GridIndex) => T, empty: T): { winner: T; line: WinLine } | null;
// Macro scan MUST normalize non-Player statuses to the sentinel:
//   lineWinner(i => { const s = boardStatus[i]; return s === 'X' || s === 'O' ? s : null; }, null)
// The naive lineWinner(i => boardStatus[i], 'open') declares three DRAWN boards a "winner" — wrong (E10/E11).

// state.ts
export function createInitialState(firstPlayer: Player = 'X'): GameState;
export function applyMove(state: GameState, move: Move): GameState;     // IMMUTABLE; throws IllegalMoveError
export function applyMoveInPlace(state: GameState, move: Move): void;   // mutating fast path — MCTS playouts ONLY
export function cloneState(state: GameState): GameState;
export class IllegalMoveError extends Error {
  constructor(public reason: 'game-over'|'board-closed'|'wrong-board'|'cell-occupied', public move: Move);
}

// rules.ts
export function legalMoves(state: GameState): Move[];          // deterministic: board asc, then cell asc; [] when over
export function isLegalMove(state: GameState, move: Move): boolean;
export function playableBoards(state: GameState): GridIndex[]; // [forcedBoard] or all open boards; [] when over

// board.ts
export function computeBoardStatus(cells: CellValue[], board: GridIndex): BoardStatus; // win beats full

// history.ts
export interface HistoryEntry { move: Move; player: Player; stateAfter: GameState }
export interface GameHistory { initialState: GameState; entries: HistoryEntry[] }
export function createHistory(initial: GameState): GameHistory;
export function currentState(h: GameHistory): GameState;           // last stateAfter or initialState
export function pushMove(h: GameHistory, move: Move): GameHistory;  // applyMove + append
export function undo(h: GameHistory, count?: number): GameHistory;  // pop min(count, length); hotseat: count=1
export function undoToPlayerTurn(h: GameHistory, human: Player): GameHistory;
```

`applyMove` and `applyMoveInPlace` share one validation/update core. **`applyMove` algorithm — ordering is load-bearing:**
1. Validate (status playing → forced-board match → board open → cell empty), else throw with the matching `reason`.
2. Write `cells[board*9+cell] = currentPlayer`; recompute `boardStatus[move.board]` (that board only).
3. Two independent checks, in order:
   - 3a. If the played board became a `Player`: scan macro `LINES` over `boardStatus` counting **only `'X'`/`'O'`, never `'draw'`** (normalizer form above) → `status = { kind:'won', winner, line }`.
   - 3b. If `status` is still `playing` and all 9 boards are closed — **regardless of how the last one closed** (a small-board win with no macro line still closes it) → `{ kind:'drawn' }`.
4. `forcedBoard = boardStatus[move.cell] === 'open' ? move.cell : null` — evaluated AFTER step 2.
5. Flip `currentPlayer`, increment `moveCount`.

`undoToPlayerTurn(h, human)` (vs-AI undo): pop trailing entries until at least one `human` entry has been removed AND `currentState(h).currentPlayer === human`. Covers: AI already replied (pops 2), game ended on human's move before AI replied (pops 1), human plays O after AI opening. If no human entry exists, return `h` unchanged.

### Rule edge cases (each gets a test)
| # | Case | Expected |
|---|------|----------|
| E1 | First move | `forcedBoard: null`, 81 legal moves |
| E2 | Cell targets a closed (won or drawn) board | `forcedBoard = null`; legal = every empty cell of every open board |
| E3 | Move closes the board it was played in AND `board === cell` | free choice (step-4 ordering) |
| E4 | Move wins a small board | claimed permanently; its empty cells never legal again |
| E5 | Ninth cell filled, no winner | `'draw'`; counts for neither macro player |
| E6 | Final cell both fills and wins the board | winner, not draw (win check precedes full check) |
| E7 | Move wins small board + completes macro line simultaneously | `status` won in same `applyMove`; `legalMoves` → `[]` |
| E8 | All 9 boards closed, no macro line | `{ kind:'drawn' }` — draw only when all boards close |
| E9 | Illegal inputs | `IllegalMoveError` with reason `game-over` / `board-closed` / `wrong-board` / `cell-occupied` |
| E10 | Three drawn boards complete a macro line, other boards open | status stays `playing` — drawn boards never satisfy a line |
| E11 | Boards 0–2 drawn; the same `applyMove` gives X the [3,4,5] macro line | `{ kind:'won', winner:'X', line:[3,4,5] }` — drawn boards elsewhere must not mask a real win |

### Tasks (TDD: test first for each module)
- [x] `types.ts`, `lines.ts` + `helpers.ts` (`playMoves(moves: [number,number][], first?)` folding `applyMove`; `makeState(partial)` for hand-crafted positions).
- [x] `board.ts` + `board.test.ts`: all 8 win lines for X and O; open; draw pattern (X@{0,2,3,7,8}, O@{1,4,5,6}); E6.
- [x] `state.ts` + `state.test.ts`: alternation + moveCount; immutability (input untouched); `applyMoveInPlace` deep-equals `applyMove` result; one test per `IllegalMoveError` reason (E9); board-closure fixtures — A: `[[4,0],[0,4],[4,1],[1,4],[4,2]]` ⇒ board 4 won by X, forced 2 (E4); B: `[[4,0],[0,4],[4,8],[8,4],[4,4]]` ⇒ X wins board 4 on cell 4 ⇒ `forcedBoard null`, 70 legal moves (E3); macro outcomes via `makeState` (E7, E10, E11 — E10/E11 need `makeState` positions with three drawn boards on a macro line); **structured-clone invariant**: `structuredClone(state)` and `JSON.parse(JSON.stringify(state))` deep-equal the original.
- [x] `rules.ts` + `rules.test.ts`: E1; after `(4,7)` only empty cells of board 7 legal; sent to WON board (fixture A + move `[2,4]` ⇒ 69 moves, none in board 4); sent to DRAWN board via `makeState`; won board with empty cells yields no moves; `[]` when over; deterministic ordering.
- [x] `history.ts` + `history.test.ts`: hotseat undo restores state + player; `undoToPlayerTurn` pops 2 when AI replied, 1 when not, no-op with zero human entries; undo past start returns `initialState`.
- [x] `fullGames.test.ts` + `fixtures/games.ts` — **copy move lists exactly** (one transposition makes a replay move throw):
  - 29-move X macro win:
    `[[6,4],[4,0],[0,4],[4,6],[6,5],[5,7],[7,0],[0,6],[6,8],[8,7],[7,8],[8,8],[8,6],[6,1],[1,3],[3,8],[8,0],[0,8],[8,3],[3,2],[2,6],[6,7],[7,3],[3,4],[4,4],[4,7],[7,6],[6,6],[6,3]]` ⇒ `status.kind==='won'`, `winner==='X'`; assert every prefix move was legal.
  - 46-move macro draw (exercises free-choice-after-closure, e.g. consecutive `[2,6],[2,7]`):
    `[[6,2],[2,3],[3,0],[0,8],[8,7],[7,4],[4,2],[2,1],[1,2],[2,8],[8,6],[6,3],[3,7],[7,6],[6,7],[7,8],[8,0],[0,4],[4,3],[3,5],[5,3],[3,8],[8,3],[3,2],[2,5],[5,6],[6,0],[0,2],[2,0],[0,0],[1,5],[5,0],[6,1],[1,1],[1,8],[7,2],[2,6],[2,7],[4,0],[5,1],[5,8],[4,8],[4,1],[2,4],[5,5],[5,2]]` ⇒ `status.kind==='drawn'`, all `boardStatus` closed.
- [x] `index.ts` public re-exports; remove the Phase 0 placeholder test.

### Acceptance criteria
- All E1–E11 edge cases and both full-game fixtures pass; immutability and structured-clone invariants tested.
- Engine has zero imports from outside `src/engine/` and no `document`/`window`/`Math.random` references.

### Verification
Canonical gate.

---

## Phase 2 — Hotseat UI

**Goal:** Fully playable hotseat game on a phone-width viewport: persistent-DOM renderer, board legibility, result overlay, keyboard + screen-reader access. (Menu screen arrives in Phase 3; the app boots straight into a hotseat game for now. Undo/history/scores UI arrive in Phase 5.)

### App-shell contracts
```ts
// src/state.ts
type Mode = 'hotseat' | 'ai';
interface Settings { mode: Mode; difficulty: 'easy'|'medium'|'hard'; humanPlays: Player; muted: boolean }
interface Scores { x: number; o: number; draws: number }
interface AppState {
  screen: 'menu' | 'game';        // 'game' only until Phase 3
  settings: Settings;             // defaults: hotseat / medium / 'X' / false
  history: GameHistory | null;    // engine history; game state = currentState(history)
  aiThinking: boolean;            // always false until Phase 3
  scores: Scores;                 // in-memory until Phase 5
}

// src/controller.ts
class GameController {
  constructor(root: HTMLElement, deps: { sound: SoundManager })  // AiPlayer dep added Phase 3
  init(): void;                    // mount(root, actions), first render
  startGame(): void; playCell(b: GridIndex, c: GridIndex): void;
  rematch(): void; goToMenu(): void;          // undo(), resetScores() added Phase 5
  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void;
  private commit(mutate: (s: AppState) => void): void;  // mutate → (persist, Phase 5) → render(state, prev)
}

// src/ui/render.ts
interface Actions {
  onCell(b: GridIndex, c: GridIndex): void; onUndo(): void; onNewGame(): void;
  onRematch(): void; onMenu(): void; onMute(): void; onStart(): void;
  onResetScores(): void;  // wired Phase 5
  onSetting(k: keyof Settings, v: unknown): void;
}
function mount(root: HTMLElement, actions: Actions): void;  // builds ALL static DOM once (81 buttons)
function render(state: AppState, prev: AppState | null): void;
```

**Pattern (do not deviate):** persistent DOM + declarative sync. `mount()` builds the full DOM once; `render(state, prev)` exhaustively re-syncs attributes/classes/text on the ~120 dynamic elements every commit. No innerHTML re-render (it destroys focus, transitions, `animationend` listeners). All state mutations go through `commit()` — code paths that bypass it desync the prev-diff used for one-shot animations (Phase 6).

### Board DOM (per small board; 9 of these in `.macro`)
```html
<div class="macro" role="application" aria-roledescription="ultimate tic-tac-toe board" aria-label="Game board">
  <section class="board board--active" data-board="4" role="group" aria-label="Board E (center)">
    <button class="cell" data-board="4" data-cell="0" tabindex="-1"
            aria-label="Board E, cell 1, top left: empty"></button>
    <!-- ...9 cells; filled: class="cell cell--x", aria-label "...: X" -->
    <div class="board__claim" aria-hidden="true">X</div>  <!-- visible only when board--won-* -->
  </section>
</div>
```
Event delegation: one click listener on `.macro`, mapping `data-board`/`data-cell` → `actions.onCell`. Class scheme (BEM-lite): `.board--active`, `.board--choice`, `.board--won-x`, `.board--won-o`, `.board--draw`; `.cell--x`, `.cell--o`; (Phase 6 adds `.cell--last`, `.cell--winline`, `.anim-*`).

### `src/styles/tokens.css` (exact)
```css
:root {
  /* players */
  --color-x: #2563eb; --color-x-soft: #dbeafe;   /* blue */
  --color-o: #ea580c; --color-o-soft: #ffedd5;   /* orange */
  /* neutrals (slate) */
  --surface-0: #f8fafc; --surface-1: #ffffff; --surface-2: #eef2f7;
  --ink: #0f172a; --ink-muted: #64748b; --line: #e2e8f0;
  /* shape & space */
  --radius-s: 6px; --radius-m: 12px; --radius-l: 20px;
  --space-1: 4px; --space-2: 8px; --space-3: 16px; --space-4: 24px; --space-5: 40px;
  --shadow-1: 0 1px 3px rgb(15 23 42 / .08); --shadow-2: 0 8px 24px rgb(15 23 42 / .12);
  /* motion */
  --dur-fast: 120ms; --dur-med: 240ms; --dur-slow: 400ms;
  --ease-out: cubic-bezier(.2,.8,.2,1);
  /* board sizing */ --board-gap: clamp(4px, 1.2vw, 10px);
}
```

### Board-state legibility (must read instantly)
- **Active board:** `.board--active` → 2px ring (`box-shadow: 0 0 0 2px var(--turn-color)`) + `--color-{x|o}-soft` tint of the player to move; render sets `--turn-color` on `.macro`. **Free choice:** every open board gets `.board--choice` (1px ring, faint tint).
- **Won board:** cells fade to `opacity:.18`, background goes player-soft, `.board__claim` shows a large centered mark (~70% of board) in the player color. **Drawn:** `--surface-2` background, cells `opacity:.3`, claim slot shows muted "–".
- **Turn chip (HUD):** pill "X to move" / "O to move" in player color.
- Marks are colored text (X blue, O orange), system font stack, `font-weight: 700`. Small boards are `--surface-1` cards (radius-m, shadow-1) on a `--surface-0` page; thin `--line` borders between cells, **no margins** (full cell box stays tappable).

### Layout (mobile/touch-first)
- `.macro { width: min(100%, calc(100dvh - var(--chrome-h))); aspect-ratio: 1; margin-inline: auto }` with `--chrome-h: 168px`. Game screen: `display:flex; flex-direction:column; height:100dvh; overflow:hidden` — **never scrolls during play**. Controls/history shrink before the board does.
- Touch: `touch-action: manipulation` on cells; `:active` pressed tint, never hover-only affordances. Accepted floor: ~38px cells on 360px-wide phones (documented trade-off; 9×44px cannot fit).
- Desktop `@media (min-width: 880px)`: board left (max 640px), sidebar right (score card, controls, vertical history — populated in Phase 5).

### A11y
- `src/ui/keyboard.ts`: roving tabindex — `.macro` is one tab stop; Arrow keys move focus across the logical 9×9 grid (crossing board edges), Enter/Space plays, Home/End jump within row. Non-playable cells: `aria-disabled="true"` + ignored click (NOT `disabled` — keeps them focusable).
- Labels: boards A–I with position words ("Board E (center)"); cells "Board E, cell 5, center: empty/X/O".
- Visually-hidden `<div id="status" aria-live="polite">` updated by render: turn changes ("O to move — must play in board C"), board captures ("X wins board E"), results (swap to `role="alert"`).
- If screen-reader testing shows `role="application"` hurts cell exploration, fall back to `role="group"` + live region.

### Tasks
- [x] `src/styles/` files (tokens/base/layout/board/hud/overlay; `index.css` `@import`s them; Vite inlines), `src/ui/dom.ts` (`h()` helper, `qs()`).
- [x] `state.ts`, `storage.ts` stub (`loadPersisted(): null`, real impl Phase 5), `ui/sound.ts` no-op `SoundManager { play(name), setMuted(b) }`.
- [x] `ui/render.ts` mount/render + `ui/board.ts`, `ui/hud.ts`, `ui/overlay.ts` region sync fns; `controller.ts` with `commit()`; `main.ts` boots a hotseat game.
- [x] Board legibility states + turn chip; HUD score bar (in-memory tallies; incremented in the `commit()` that ends the game — never in `render()`; see Phase 5 score-increment locus).
- [x] Result overlay: board stays visible and dimmed; panel in lower third; "X wins!"/"O wins!"/"Draw"; **Rematch** (same settings) + **Menu** (hidden/disabled until Phase 3).
- [x] Controls row: **New game** (mid-game inline confirm — "Sure?" second tap, 3s timeout — skipped if <2 moves) and reserved slots for Undo/Mute (later phases).
- [x] `ui/keyboard.ts` roving tabindex + live region.

### Acceptance criteria
- Full hotseat game playable start-to-finish on a 360px-wide viewport with no scrolling; all rules enforced by the engine (illegal taps do nothing); forced board / free choice visually obvious; win/draw overlay appears with working Rematch; complete game playable with keyboard only.

### Verification
Canonical gate · manual: `npm run dev`, play a full game at 360px and desktop widths, keyboard-only run-through.

---

## Phase 3 — Easy/Medium AI + menu

**Goal:** vs-AI mode with Easy and Medium, menu screen for mode/difficulty/side selection, deterministic seeded tests, strength gate.

### AI contracts
```ts
// src/ai/types.ts
export type AiDifficulty = 'easy' | 'medium' | 'hard';
export type Rng = () => number; // [0,1)
export interface AiContext { rng: Rng; signal?: AbortSignal }
export interface AiPlayer {
  readonly difficulty: AiDifficulty;
  chooseMove(state: GameState, ctx: AiContext): Promise<Move>;
  dispose(): void; // Hard terminates worker; others no-op
}
// src/ai/index.ts
export function createAi(difficulty: AiDifficulty): AiPlayer;
```

```ts
// src/ai/rng.ts — mulberry32, exact
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const pick = <T>(rng: Rng, arr: T[]): T => /* arr[floor(rng()*len)] */;
export const shuffle = <T>(rng: Rng, arr: T[]): T[] => /* Fisher–Yates in place */;
```
Production seed: `Date.now() >>> 0`. Tests pass `mulberry32(fixedSeed)`.

`src/ai/tactics.ts`: `findGameWinningMoves(state): Move[]` — legal moves where `applyMove(state, m).status` is `{kind:'won', winner: state.currentPlayer}` (whole-game macro win only). Shared by Easy and MCTS playouts.

### Easy (`easy.ts`) — exactly two rules, nothing else
1. If `findGameWinningMoves(state)` non-empty → `pick(rng, wins)`.
2. Else `pick(rng, legalMoves(state))`.

**No blocking, no small-board preference, no lookahead** — locked by a unit test asserting Easy does NOT block.

### Medium (`medium.ts`) — negamax alpha-beta, fixed depth 3
- 50,000-node safety cap (return best-so-far). **All negamax scores are from the perspective of the side to move at that node.** A node whose `status.kind` is `'won'` is always a **loss** for the side to move (the winner is the previous mover), so terminal evaluation is `−(10000 − plyFromRoot)` — there is no symmetric "win" branch at a node. `'drawn'` → 0. Depth-0 leaves → `evaluate(state, state.currentPlayer)`. Getting this perspective wrong is the classic negamax sign bug; partially-confused variants can pass behavioral tests while playing below spec.
- Leaf eval `evaluate(state, me) = terms(me) − terms(opp)`:

| Term | Weight |
|---|---|
| Won small board | 100 × position weight (center board 1.4, corner 1.2, edge 1.0) |
| Macro threat: 2 of my boards on a macro line, 3rd open | +200 per line |
| Local threat: 2-in-a-row + empty 3rd cell in any open board | +5 per threat |
| Center cell owned in an open board | +3 per board |
| Side-to-move has free board choice | +15 to side-to-move |
| Side-to-move forced into a board they can win right now | +10 to side-to-move |

- Move ordering: (1) game-winning, (2) small-board-winning, (3) center cell, (4) rest `shuffle(rng)`. Root ties among equal-best broken via `rng`. Use the engine's `LINES` for line scans.

### Controller integration
- Menu screen (`ui/menu.ts`, `screen: 'menu'` becomes the boot default): title; mode toggle (Hotseat / vs AI); difficulty segmented control (visible only vs AI); "You play" X/O toggle (vs AI only — X always moves first, so hotseat has no first-player option); Start; lifetime score line (read-only).
- Controller holds an `AiPlayer` (`createAi(settings.difficulty)`) created on game start, `dispose()`d on new settings/menu. Per AI turn: create `AbortController`, set `aiThinking: true` (input locked: `.macro` gets `aria-busy="true"` + `pointer-events:none`; turn chip shows "AI thinking" with 3-dot CSS pulse), then
  `const [move] = await Promise.all([ai.chooseMove(state, ctx), sleep(minDelayMs)])`.
- **Stale-move guard — after the await, before applying: `if (ctx.signal.aborted) return;`** Abort-rejection alone does NOT close this race: Easy/Medium resolve `chooseMove` in microseconds and the min-delay sleep keeps `Promise.all` pending, so a New Game/Menu click in that window aborts nothing already-settled and the stale move would be applied to the freshly reset game. New Game / Menu / dispose always call `abort()`, so `signal.aborted` is a sufficient staleness check. Clear `aiThinking` (and re-enable input) in a `finally` — never soft-lock.
  Min delay: Easy/Medium 500ms, Hard 0ms (controller-side so AI unit tests stay fast).
- New Game / Menu calls `abortController.abort()`; an aborted `chooseMove` rejects with `DOMException('aborted','AbortError')`, which the controller swallows.
- **AI-turn dispatch invariant:** in AI mode, after **any** commit that leaves `status.kind === 'playing'`, `currentPlayer !== settings.humanPlays`, and no AI request in flight → dispatch the AI turn. `startGame()`, `rematch()`, and the post-human-move flow all route through this one check — it covers the AI's X opening when the human plays O, **including after Rematch** (a literal "only after startGame()" trigger leaves the board hung there).

### Tests
- Behavioral: Easy takes a game-winning move; Easy does NOT block; Medium blocks an immediate macro loss; both AIs return only legal moves (assert `isLegalMove` inside the game-runner helper).
- Controller stale-move guard (node test, fake `AiPlayer` that resolves instantly): fire `abort()` + reset during the min-delay window → the already-resolved move is **not** applied to the new game and `aiThinking` ends false.
- `src/ai/strength.test.ts`: `playGame(aiA, aiB, seed): 'A'|'B'|'draw'` with seeded rngs, alternating colors. **Gate: Medium(d3) score ≥ 32/40 (80%) vs Easy over 40 games** (seeds 1..40; win 1, draw 0.5). Set `vi.setConfig({ testTimeout: 120_000 })` in this file.

### Tasks
- [x] `rng.ts` + tests (determinism, pick/shuffle bounds).
- [x] `tactics.ts` + tests.
- [x] `easy.ts` (TDD, behavioral lock-in tests).
- [x] `medium.ts` (TDD: eval terms unit-tested on crafted positions, then search).
- [x] `types.ts`, `index.ts` factory.
- [x] Menu screen + settings wiring; controller AI-turn loop with abort + min delay + `humanPlays:'O'` case.
- [x] `strength.test.ts` with the Medium-vs-Easy gate.

### Acceptance criteria
- All behavioral tests + strength gate green; typical Medium move <100ms; full vs-AI game playable at both difficulties from the menu; New Game during AI think cancels cleanly; vs-AI overlay says "You win!" / "AI wins".

### Verification
Canonical gate · manual: play vs Easy and Medium, including as O; Rematch while playing O re-triggers the AI opening.

---

## Phase 4 — Hard AI (MCTS in a Web Worker)

**Goal:** Hard difficulty: UCT MCTS with ~1s think budget in a Web Worker, cancellable, with graceful fallback to Medium. UI stays responsive while thinking.

### MCTS core (`src/ai/mcts.ts` — pure, NO worker imports, unit-testable)
```ts
export interface MctsOptions { rng: Rng; maxIterations: number; explorationC?: number } // default Math.SQRT2
export interface MctsSearch {
  run(n: number): void;             // resumable: perform up to n iterations
  iterations: number;
  best(): { move: Move; iterations: number; winRate: number };
}
export function createMctsSearch(state: GameState, opts: MctsOptions): MctsSearch;
```
- **UCT:** `wins/visits + C * Math.sqrt(Math.log(parent.visits) / visits)`; unvisited children first (shuffled).
- **Node:** `{ move: Move|null, player: Player /* who played move */, parent, children, untried: Move[] /* rng-shuffled */, visits, wins /* from player's perspective; draw = 0.5 */ }`. No state per node — each iteration `cloneState(root)` then descends with **`applyMoveInPlace`** on the private clone (never share `boardStatus` arrays between nodes).
- **Expansion:** pop one move from `untried` per iteration. **Playout:** at each step take an immediately game-winning move if one exists, else uniform random; run to terminal (read `state.status`). **Do not call `findGameWinningMoves` in playouts** — it runs immutable `applyMove` per candidate move (a full state clone each), multiplying playout cost ~10× and gutting the 1s budget while fixed-iteration tests stay green. Add a clone-free `wouldWinGame(state, move): boolean` to `tactics.ts`: the move wins its small board iff the mover already owns the other two cells of a `LINE` through `move.cell` within that board, and that capture completes a macro `LINE` for the mover over `boardStatus` — O(1) per candidate, no clone. Easy keeps using `findGameWinningMoves` (per-move cost is irrelevant there). **Backprop:** `visits++; wins += result===node.player ? 1 : draw ? 0.5 : 0`.
- **Final move:** max visits; ties → higher win rate → `rng`.

### Worker protocol (`src/ai/protocol.ts` — exact)
```ts
export type WorkerRequest =
  | { type: 'search'; id: number; state: GameState; budgetMs: number; maxIterations: number; seed: number }
  | { type: 'cancel'; id: number };
export type WorkerResponse =
  | { type: 'result'; id: number; move: Move; stats: { iterations: number; winRate: number } }
  | { type: 'cancelled'; id: number }
  | { type: 'error'; id: number; message: string };
```

### Worker entry (`src/ai/mcts.worker.ts`)
- Starts with `/// <reference lib="webworker" />`. Logic in an exported `handleRequest(msg, post)` so Vitest (node) can test it without a real Worker.
- Owns wall-clock: `deadline = performance.now() + budgetMs` (default 1000). Loop `search.run(256)` slices; between slices `await new Promise(r => setTimeout(r, 0))` so `cancel` messages get processed mid-search. Stop on deadline, `maxIterations` (default 50,000), or cancel (post `cancelled`). If exactly one legal move, return it immediately. Do NOT move budget enforcement to the main thread.

### Hard client (`src/ai/hard.ts`)
- Lazy worker creation on first `chooseMove`: `new Worker(new URL('./mcts.worker.ts', import.meta.url), { type: 'module' })`.
- Monotonically increasing request `id`; responses with stale ids dropped. Seed travels in the `search` message.
- On `ctx.signal` abort: post `cancel`, reject pending promise with `AbortError`; if no `cancelled`/`result` within 250ms → `worker.terminate()`, respawn lazily.
- **Fallback:** if the worker fails to construct (`error` event), posts `error`, or misses a watchdog of `budgetMs + 2000ms` → mark worker dead, `console.warn` once, serve that and all subsequent moves by running Medium synchronously on the main thread.
- No progress messages — worker posts only the final result (YAGNI).

### Tasks
- [x] `tactics.ts`: clone-free `wouldWinGame` + a seeded property test asserting it agrees with `findGameWinningMoves` across random positions.
- [x] `mcts.ts` (TDD at fixed iterations + seed: finds forced wins / blocks in crafted near-terminal positions; assert tactical correctness, not exact move snapshots).
- [x] `protocol.ts`; `mcts.worker.ts` with exported `handleRequest` + unit tests (search/cancel/error paths, stale ids).
- [x] `hard.ts` client + fallback; wire `createAi('hard')`; Hard enabled in menu.
- [x] Strength gate in `strength.test.ts`: **MCTS@1000 iterations (direct `createMctsSearch`, no worker/clock) score ≥ 6.5/10 (65%) vs Medium(d3) over 10 games** (seeds, colors alternate). Target whole strength suite <90s in CI; if it flakes, raise MCTS iterations or widen N before loosening thresholds; if runtime exceeds ~90s, reduce N to 8 before reducing iterations.

### Acceptance criteria
- MCTS unit + strength gates green; Hard responds in ~1s; UI remains interactive while thinking (thinking indicator shows, input locked); New Game during Hard think cancels within ~250ms; killing the worker via DevTools degrades to Medium without breaking the game.
- Manual worker smoke test: Hard plays correctly under `npm run dev` AND `npm run build && npm run preview` (worker bundling under the `/ultimate-tic-tac-toe/` base path cannot be unit-tested in node).

### Verification
Canonical gate · `npm run preview` Hard-mode smoke · after merge: play Hard on the live Pages URL.

---

## Phase 5 — Undo, move history, scores, persistence

**Goal:** Undo with correct vs-AI semantics, move-history strip, persistent scores + settings.

### Specs
- **Undo** (controls row): hotseat = `undo(h, 1)`; vs AI = `undoToPlayerTurn(h, settings.humanPlays)` (pops AI reply + human move, or just 1 if the AI hasn't replied). Disabled when: history empty, game over (use Rematch), `aiThinking` (blocked, not queued; controller also ignores `playCell` while thinking), or — vs AI — **the history contains no human move yet** (human plays O and only the AI's opening is on the board: `undoToPlayerTurn` would no-op, so an enabled button would visibly do nothing). Undo never decrements scores (it's disabled post-result).
- **History strip** (`ui/history.ts`): rendered from `GameHistory.entries`; notation `<BoardLetter><cellDigit>` — boards A–I, cells 1–9, both reading order (`E5` = center of center). Numbered plies `1. X E5  2. O E1 …`, mover's color on the mark. Display-only (no time-travel). Portrait: horizontal scroll strip under controls; desktop: vertical sidebar list.
- **Persistence** (`src/storage.ts`):
```ts
interface PersistedV1 { version: 1; settings: Settings; scores: Scores }
export function loadPersisted(): PersistedV1 | null;  // key "uttt:v1"; try/catch + shape/version check → null on any failure
export function savePersisted(p: PersistedV1): void;  // try/catch around setItem; silent no-op on failure
```
  `commit()` saves on every mutation — so `savePersisted` must swallow `setItem` failures (Safari private mode, quota) with at most a one-time `console.warn`, or every move would throw mid-game. In-progress games are NOT persisted (out of scope).
- **Score increment locus:** scores increment **inside the `commit()` that transitions `status` from `playing` to won/drawn** (the `playCell` and AI-move paths) — never in `render()`. Detecting the overlay transition in the render path is a side effect where it doesn't belong and double-counts when a later commit re-renders with the overlay still up (e.g. toggling Mute on the result screen).
- **Score bar** (HUD): `X 3 · 5 O · 2 draws`, colored marks; menu shows the same totals read-only; "Reset scores" link in menu with confirm.

### Tasks
- [x] Wire Undo button + disabled states; vs-AI semantics via `undoToPlayerTurn`.
- [x] History strip (both layouts) rendered from `entries`.
- [x] `storage.ts` real implementation + load on `init()` (corrupt/missing → defaults); persist on every commit.
- [x] Reset scores (menu, with confirm): `Actions.onResetScores` → `GameController.resetScores()`.

### Acceptance criteria
- Undo after AI reply returns to the human's turn with the board exactly two plies back; undo before AI reply removes one ply; undo disabled while thinking/after result/at game start; starting as O, Undo stays disabled until the human has moved. Scores and settings survive reload; corrupt localStorage falls back cleanly. History notation matches the played game.

### Verification
Canonical gate · manual: reload mid-session (scores persist), corrupt `localStorage["uttt:v1"]` by hand (app boots with defaults), undo in both modes.

---

## Phase 6 — Polish

**Goal:** Animations, last-move/win-line highlighting, optional sound + mute, reduced motion, a11y pass, final QA.

### Animation specs (`styles/animations.css`; one-shot classes added by `render` when diffing `prev`, removed on `animationend`)
| Animation | Spec | Reduced-motion |
|---|---|---|
| Mark placement | `.anim-pop`: scale .6→1 + fade, 150ms `--ease-out` | instant |
| Board capture | claim mark scale 1.25→1 + fade-in 300ms; cells dim over 240ms | instant final state |
| Active-board transition | `transition: box-shadow, background var(--dur-med) var(--ease-out)` | instant |
| Win line reveal | winning 3 boards pulse sequentially (80ms stagger), then SVG line overlay draws via stroke-dashoffset 400ms (uses `status.line`) | static line, no pulse |
| Result overlay | backdrop fade + panel slide-up 240ms | fade only |
| Illegal-tap feedback | required board `.anim-shake` ±3px, 200ms | active ring blinks once (opacity) |

`@media (prefers-reduced-motion: reduce)` sets all `--dur-*: 0ms` and disables keyframes; everything still functions via instant state changes.

### Tasks
- [x] Last-move indicator: `.cell--last` → 6px dot in mover's color, bottom-center.
- [x] All animations above; verify persistent-DOM render never clips them.
- [x] Sound: implement `SoundManager` (place, capture, win, draw — short synthesized WebAudio blips, no asset files); Mute toggle button in controls row (`aria-pressed`, persisted via `settings.muted`); manager short-circuits when muted.
- [x] A11y pass: keyboard-only full game re-checked; live-region announcements verified; reduced-motion verified (tokens zeroed, keyframes off, static win line). _VoiceOver/TalkBack spot check requires physical devices — not possible in this environment._
- [x] Device QA: 360px phone viewport + desktop verified headless. _iOS Safari `100dvh` check requires a physical device._
- [x] Final visual QA against tokens (spacing, contrast); Hard-mode smoke on the live Pages URL.

### Acceptance criteria
- All animations match spec and vanish under reduced motion; sound works and mute persists; no clipped layouts at 360px or on iOS Safari; a11y checks pass; live site fully playable in all modes/difficulties.

### Verification
Canonical gate · manual QA checklist above on the deployed site.
