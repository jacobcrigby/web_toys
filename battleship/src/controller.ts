// SPDX-License-Identifier: Apache-2.0
import type { AiPlayer } from './ai/index.ts';
import { createAi } from './ai/index.ts';
import type { GameState, ShipPlacement } from './engine/index.ts';
import { applyAction, createInitialState, isLegalAction, randomPlacement } from './engine/index.ts';
import type { AppState, Settings } from './state.ts';
import { GRID_CONFIGS } from './state.ts';
import { loadInitialAppState, saveState } from './storage.ts';
import type { Actions } from './ui/render.ts';
import {
  announce,
  mount,
  render,
  setPlacementHoveredCell,
  setPlacementOrientation,
} from './ui/render.ts';

export class GameController {
  private root: HTMLElement;
  private state: AppState;
  private prev: AppState | null = null;
  private ai: AiPlayer | null = null;
  private aiAbort: AbortController | null = null;
  private rngSeed: number;

  constructor(root: HTMLElement) {
    this.root = root;
    this.state = loadInitialAppState();
    this.rngSeed = Math.floor(Math.random() * 0x7fffffff);
  }

  private rng(): number {
    this.rngSeed = (Math.imul(this.rngSeed, 1664525) + 1013904223) | 0;
    return (this.rngSeed >>> 0) / 0x100000000;
  }

  init(): void {
    const actions = this.buildActions();
    mount(this.root, actions);
    this.commit({});
  }

  commit(patch: Partial<AppState>): void {
    const prev = this.state;
    this.state = { ...this.state, ...patch };
    saveState(this.state);
    render(this.state, prev, this.buildActions());
    this.prev = prev;

    if (this.state.screen === 'battle' && this.state.game && !this.state.aiThinking) {
      this.maybeDispatchAiTurn();
    }
  }

  private buildActions(): Actions {
    return {
      menu: {
        onStartVsAi: (settings) => this.startVsAi(settings),
        onStartOnlineHost: (settings) => this.startOnlinePlaceholder(settings),
      },
      placement: {
        onConfirmPlacement: (ships) => this.confirmPlacement(ships),
        onRandomize: () => this.randomizePlacement(),
        onRotate: () => this.rotatePlacementOrientation(),
        onCellHover: (cell) => {
          setPlacementHoveredCell(cell);
          render(this.state, this.prev, this.buildActions());
        },
        onCellLeave: () => {
          setPlacementHoveredCell(null);
          render(this.state, this.prev, this.buildActions());
        },
        onCellClick: (cell) => this.placementCellClick(cell),
      },
      lobby: {
        onJoinRoom: (_code) => {
          /* multiplayer phase */
        },
        onCopyCode: () => {
          if (this.state.connection?.role === 'host') {
            void navigator.clipboard.writeText(this.state.connection.roomCode);
          }
        },
      },
      overlay: {
        onPlayAgain: () => this.playAgain(),
        onReturnToMenu: () => this.returnToMenu(),
        onResign: () => this.returnToMenu(),
      },
      onFireCell: (cell) => this.fireCell(cell),
    };
  }

  private startVsAi(settings: Settings): void {
    this.ai = createAi(settings.aiDifficulty);
    const grid = GRID_CONFIGS[settings.gridSize];
    const humanShips = randomPlacement(grid, () => this.rng());

    this.commit({
      settings,
      screen: 'placement',
      placementProgress: {
        ships: humanShips,
        pendingKinds: [],
        randomized: true,
      },
      humanPlayerIndex: 0,
      game: null,
    });
  }

  private startOnlinePlaceholder(settings: Settings): void {
    // Multiplayer wired in Phase 7 — for now show a placeholder
    alert('Online multiplayer coming soon!');
    void settings;
  }

  private rotatePlacementOrientation(): void {
    const current = (this.state as AppState & { _orientation?: 'h' | 'v' })._orientation ?? 'h';
    const next: 'h' | 'v' = current === 'h' ? 'v' : 'h';
    (this.state as AppState & { _orientation?: 'h' | 'v' })._orientation = next;
    setPlacementOrientation(next);
    render(this.state, this.prev, this.buildActions());
  }

  private randomizePlacement(): void {
    const grid = GRID_CONFIGS[this.state.settings.gridSize];
    const ships = randomPlacement(grid, () => this.rng());
    this.commit({
      placementProgress: { ships, pendingKinds: [], randomized: true },
    });
  }

  private placementCellClick(_cell: number): void {
    const progress = this.state.placementProgress;
    if (!progress || progress.pendingKinds.length > 0) return;
    this.confirmPlacement(progress.ships);
  }

  private confirmPlacement(humanShips: ShipPlacement[]): void {
    const grid = GRID_CONFIGS[this.state.settings.gridSize];
    const aiShips = randomPlacement(grid, () => this.rng());
    const gameState = createInitialState(
      this.state.settings.mode,
      grid,
      humanShips, // player 0 = human
      aiShips, // player 1 = AI
    );
    this.commit({ screen: 'battle', game: gameState, placementProgress: null });
  }

  private maybeDispatchAiTurn(): void {
    const game = this.state.game;
    if (!game || game.phase !== 'battle') return;
    if (game.currentPlayer === this.state.humanPlayerIndex) return;
    if (!this.ai) return;

    this.commit({ aiThinking: true });
    this.aiAbort?.abort();
    const abort = new AbortController();
    this.aiAbort = abort;

    const aiPlayerIndex = game.currentPlayer;
    void this.ai
      .chooseAction(game, aiPlayerIndex, { rng: () => this.rng(), signal: abort.signal })
      .then((action) => {
        if (abort.signal.aborted) return;
        const currentGame = this.state.game;
        if (!currentGame || currentGame.currentPlayer !== aiPlayerIndex) return;
        const newGame = applyAction(currentGame, action);
        const shot = action as { cell: number };
        this.announceShot(newGame, shot.cell, aiPlayerIndex);
        this.commit({
          game: newGame,
          aiThinking: false,
          ...(newGame.phase === 'over'
            ? {
                screen: 'over',
                scores:
                  newGame.winner === 0
                    ? [this.state.scores[0] + 1, this.state.scores[1]]
                    : [this.state.scores[0], this.state.scores[1] + 1],
              }
            : {}),
        });
      })
      .catch(() => {
        if (!abort.signal.aborted) this.commit({ aiThinking: false });
      });
  }

  private fireCell(cell: number): void {
    const game = this.state.game;
    if (!game || game.phase !== 'battle') return;
    if (game.currentPlayer !== this.state.humanPlayerIndex) return;
    if (!isLegalAction(game, { kind: 'shot', cell }, this.state.humanPlayerIndex).legal) return;

    const newGame = applyAction(game, { kind: 'shot', cell });
    this.announceShot(newGame, cell, this.state.humanPlayerIndex);

    this.commit({
      game: newGame,
      ...(newGame.phase === 'over'
        ? {
            screen: 'over',
            scores:
              newGame.winner === this.state.humanPlayerIndex
                ? [this.state.scores[0] + 1, this.state.scores[1]]
                : [this.state.scores[0], this.state.scores[1] + 1],
          }
        : {}),
    });
  }

  private announceShot(game: GameState, cell: number, shooter: 0 | 1): void {
    const targetIdx = shooter === 0 ? 1 : 0;
    const board = game.boards[targetIdx];
    if (!board) return;
    const isHit = board.shotsReceived.includes(cell);
    const msg = isHit ? 'Hit!' : 'Miss.';
    announce(msg);
  }

  private playAgain(): void {
    const { settings, humanPlayerIndex } = this.state;
    this.ai = createAi(settings.aiDifficulty);
    const grid = GRID_CONFIGS[settings.gridSize];
    const humanShips = randomPlacement(grid, () => this.rng());
    this.commit({
      screen: 'placement',
      game: null,
      placementProgress: { ships: humanShips, pendingKinds: [], randomized: true },
      humanPlayerIndex,
    });
  }

  private returnToMenu(): void {
    this.ai = null;
    this.aiAbort?.abort();
    this.aiAbort = null;
    this.commit({
      screen: 'menu',
      game: null,
      placementProgress: null,
      aiThinking: false,
      connection: null,
      disconnectedAt: null,
    });
  }
}
