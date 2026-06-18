# AGENTS.md — Ultimate Tic-Tac-Toe

Orientation for coding-agent sessions. Read this, then **read PLAN.md and work the current phase**. Update PLAN.md's status header and checkboxes in the same commit as the code.

## Project

In-browser Ultimate Tic-Tac-Toe. Two modes: two-player hotseat, and single player vs AI (Easy = random + take-the-win, Medium = depth-3 alpha-beta with heuristic eval, Hard = MCTS in a Web Worker, ~1s budget). Vanilla TypeScript + Vite, **no UI framework, zero runtime dependencies**. Vitest for tests, Biome for format+lint. Deployed to GitHub Pages at `https://<owner>.github.io/ultimate-tic-tac-toe/` via GitHub Actions.

Out of scope (do not add): backend, accounts, i18n, coverage tooling.

## Commands

| Command | What |
|---|---|
| `pnpm dev` | Dev server at `http://localhost:5173/ultimate-tic-tac-toe/` (base path applies in dev too) |
| `pnpm test` / `pnpm run test:watch` | Vitest run / watch (node env, picks up `src/**/*.test.ts` only) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm lint` / `pnpm format` | `biome check .` / `biome format --write .` |
| `pnpm build` | typecheck + `vite build` |
| `pnpm preview` | Serve the production build locally |

**Canonical gate** (run before claiming any task done):
`pnpm typecheck && pnpm lint && pnpm test && pnpm build`

## Architecture

Allowed imports (anything else is a layering violation): `main → controller`; `controller → ui, ai, engine, storage`; `ai → engine`; `ui → engine` (types only); `engine →` nothing. `src/ui/` is the only layer touching `document`; it receives an `Actions` callback object and **never imports the controller** (the controller imports `ui`'s `mount`/`render`, not the other way around).

```
src/
  main.ts             # boot: styles import, deps, new GameController(root, deps).init()
  controller.ts       # GameController: owns AppState, wires engine + AI + UI; all mutations via commit()
  state.ts            # AppState / Settings / Scores types
  storage.ts          # localStorage "uttt:v1" — { version: 1, settings, scores }
  engine/             # pure rules; no DOM, no randomness; plain-data state
    index.ts          #   public API — consumers import ONLY from 'src/engine'
    types.ts lines.ts board.ts rules.ts state.ts history.ts
    __tests__/        #   board/rules/state/history/fullGames tests + fixtures
  network/            # multiplayer session (protocol.ts, session.ts)
  ai/                 # difficulty strategies
    index.ts types.ts rng.ts tactics.ts easy.ts medium.ts
    mcts.ts           #   pure resumable MCTS core (no worker imports — unit-testable)
    protocol.ts       #   worker message discriminated unions
    mcts.worker.ts    #   Web Worker entry (thin adapter over mcts.ts)
    hard.ts           #   worker client: ids, cancel, watchdog, Medium fallback
  ui/                 # render.ts (mount/render), menu.ts hud.ts board.ts history.ts overlay.ts
                      # dom.ts keyboard.ts sound.ts
  styles/             # index.css (@import) + tokens.css base.css layout.css menu.css
                      # board.css hud.css overlay.css animations.css
```

### Key types (full spec in PLAN.md Phase 1)

```ts
type Player = 'X' | 'O';
type GridIndex = 0|1|2|3|4|5|6|7|8;            // macro boards AND cells, reading order
interface Move { board: GridIndex; cell: GridIndex }   // mover implied by state.currentPlayer
type BoardStatus = Player | 'draw' | 'open';
type GameStatus =
  | { kind: 'playing' }
  | { kind: 'won'; winner: Player; line: WinLine }     // line = macro-grid indices
  | { kind: 'drawn' };
interface GameState {
  cells: CellValue[];          // length 81, index = board*9 + cell
  boardStatus: BoardStatus[];  // length 9, cached derivation
  currentPlayer: Player;
  forcedBoard: GridIndex | null;   // null = free choice among open boards
  status: GameStatus;
  moveCount: number;
}
interface AiPlayer {
  readonly difficulty: 'easy'|'medium'|'hard';
  chooseMove(state: GameState, ctx: { rng: () => number; signal?: AbortSignal }): Promise<Move>;
  dispose(): void;            // Hard terminates its worker; others no-op
}
```

## Conventions

- **TDD is mandatory for `src/engine/` and `src/ai/`**: write the failing Vitest test first. UI tests are optional (add `jsdom` + `// @vitest-environment jsdom` per file only when needed).
- **Immutability**: `applyMove` (returns new state) is the canonical API. `applyMoveInPlace` exists only as the MCTS playout fast path — call it only on private `cloneState` copies.
- **`GameState` must stay JSON-plain** (no Map/Set/Date/class instances): it crosses `postMessage` to the worker as-is. An invariant test enforces structured-clone/JSON round-trip equality.
- **Strict tsconfig is non-negotiable**: `noUncheckedIndexedAccess` means `cells[i]` is `T | undefined` — narrow explicitly or use a checked helper. Never "fix" friction by weakening tsconfig. Prefer targeted `// biome-ignore <rule>: <reason>` over disabling lint rules globally.
- **CSS**: plain CSS, design tokens (colors, space, radius, shadow, motion durations) live in `src/styles/tokens.css` — X is blue `--color-x: #2563eb`, O is orange `--color-o: #ea580c`. BEM-lite classes with state modifiers (`.board--active`, `.cell--x`). No hover-only affordances (touch-first). No preprocessor.
- **A11y baseline**: full keyboard play (one tab stop for the board, roving tabindex + arrow keys), ARIA labels on cells/boards, visually-hidden `aria-live` status region, `prefers-reduced-motion` zeroes all motion tokens, color is never the sole state indicator.
- **Notation**: boards A–I and cells 1–9 in reading order (top-left first); `E5` = center cell of center board. Internal indices are 0–8.
- Tests co-locate with source as `src/**/*.test.ts` (Vitest include pattern) — tests in a separate `tests/` dir will silently not run.

## Ultimate Tic-Tac-Toe rules (authoritative)

- 9 small tic-tac-toe boards in a 3×3 macro grid. **X always moves first** and may play any cell of any board.
- The cell position (0–8) you play within a small board **sends your opponent to the corresponding small board** for their next move (`forcedBoard`).
- If the target board is **closed** (won by either player, or full/drawn), the opponent may instead play in **any open board** (`forcedBoard = null`).
- Winning a small board **claims it permanently**; no further moves are ever legal in a closed board, even in its empty cells.
- A full small board with no winner is **drawn** and counts for **neither** player on the macro grid.
- The game is won by claiming **three small boards in a row** (row/column/diagonal of the macro grid). If all 9 boards close with no macro line, the game is a **draw** (no early dead-position detection).

Load-bearing edge semantics (see PLAN.md Phase 1 edge table E1–E11):
- `forcedBoard` is computed **after** the played board's status updates: a move that closes the very board it points to (including `board === cell`, e.g. winning cell 4 of board 4) yields free choice.
- The small-board **win check precedes the full check**: a final cell that both fills and wins a board makes it won, not drawn.
- A move can win a small board and the game in the same `applyMove`; afterwards `legalMoves` is `[]`.

## Gotchas

- **Base path is unconditional**: `base: '/ultimate-tic-tac-toe/'` in `vite.config.ts`, in dev and prod. Never hardcode absolute URLs (`/foo.png`) — use Vite imports or relative paths.
- **Worker**: instantiate with `new Worker(new URL('./mcts.worker.ts', import.meta.url), { type: 'module' })` (Vite bundles it natively; `worker: { format: 'es' }` is set). The worker file starts with `/// <reference lib="webworker" />` — do **not** add `WebWorker` to global tsconfig `lib`.
- Vitest runs in node — the real Worker path can't be unit-tested; the worker's logic lives in an exported `handleRequest(msg, post)` for tests, and the bundled worker gets a manual smoke check on the deployed site.
- **One-time manual step before the first deploy**: repo Settings → Pages → Source: **GitHub Actions**. The deploy job fails until this is set.
- `applyMove` step ordering is load-bearing (board status recompute → macro check → forcedBoard → flip player). Don't reorder.
- Time budget for Hard lives **in the worker** (`performance.now()`), not the main thread — postMessage latency would eat the budget.

## Workflow

1. Read PLAN.md's **Current status** block; do the next unchecked task in the current phase.
2. TDD for engine/AI. Run the canonical gate before finishing.
3. Update PLAN.md (status block + checkboxes) **in the same commit** as the work.
4. `main` is always deployable; every merge to main auto-deploys to Pages.
