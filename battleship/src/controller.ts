// SPDX-License-Identifier: Apache-2.0
import type { AiPlayer } from './ai/index.ts';
import { createAi } from './ai/index.ts';
import type { Action, GameState, ShipPlacement } from './engine/index.ts';
import { applyAction, createInitialState, isLegalAction, randomPlacement } from './engine/index.ts';
import { type BattleshipSession, guestJoin, hostRoom } from './network/session.ts';
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
import { getSelectedAction, resetWeaponSelection } from './ui/weapons.ts';

const DISCONNECT_ABANDON_MS = 30_000;

export class GameController {
  private root: HTMLElement;
  private state: AppState;
  private prev: AppState | null = null;
  private ai: AiPlayer | null = null;
  private aiAbort: AbortController | null = null;
  private rngSeed: number;
  private session: BattleshipSession | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private opponentShips: ShipPlacement[] | null = null;
  private ownShips: ShipPlacement[] | null = null;

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
    const urlParams = new URLSearchParams(location.search);
    const roomCode = urlParams.get('room');
    mount(this.root, this.buildActions());
    this.commit({});
    if (roomCode) {
      void this.startOnlineGuest(roomCode, this.state.settings);
    }
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
        onStartOnlineHost: (settings) => {
          void this.startOnlineHost(settings);
        },
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
        onCellClick: (_cell) => {
          const progress = this.state.placementProgress;
          if (!progress || progress.pendingKinds.length > 0) return;
          this.confirmPlacement(progress.ships);
        },
      },
      lobby: {
        onJoinRoom: (code) => {
          void this.startOnlineGuest(code, this.state.settings);
        },
        onCopyCode: () => {
          const conn = this.state.connection;
          if (conn?.role === 'host') {
            const url = new URL(location.href);
            url.searchParams.set('room', conn.roomCode);
            void navigator.clipboard.writeText(url.toString());
          }
        },
      },
      overlay: {
        onPlayAgain: () => this.playAgain(),
        onReturnToMenu: () => this.returnToMenu(),
        onResign: () => {
          this.session?.sendResign();
          this.returnToMenu();
        },
      },
      onFireCell: (cell) => this.fireCell(cell),
    };
  }

  // ── VS AI ──────────────────────────────────────────────────────────────────

  private startVsAi(settings: Settings): void {
    this.teardownOnline();
    this.ai = createAi(settings.aiDifficulty);
    const grid = GRID_CONFIGS[settings.gridSize];
    const humanShips = randomPlacement(grid, () => this.rng());
    this.commit({
      settings,
      screen: 'placement',
      placementProgress: { ships: humanShips, pendingKinds: [], randomized: true },
      humanPlayerIndex: 0,
      game: null,
    });
  }

  private maybeDispatchAiTurn(): void {
    const game = this.state.game;
    if (game?.phase !== 'battle') return;
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
        this.announceShot(newGame, (action as { cell: number }).cell, aiPlayerIndex);
        this.commit({
          game: newGame,
          aiThinking: false,
          ...this.overPatch(newGame),
        });
      })
      .catch(() => {
        if (!abort.signal.aborted) this.commit({ aiThinking: false });
      });
  }

  // ── Online host ─────────────────────────────────────────────────────────────

  private async startOnlineHost(settings: Settings): Promise<void> {
    this.teardownOnline();
    try {
      const session = await hostRoom(this.buildSessionCbs());
      this.session = session;
      this.commit({
        settings,
        screen: 'lobby',
        humanPlayerIndex: 0,
        game: null,
        placementProgress: null,
        connection: { role: 'host', roomCode: session.roomCode, peerConnected: false },
      });
    } catch {
      this.commit({ screen: 'menu', connection: null });
    }
  }

  // ── Online guest ─────────────────────────────────────────────────────────────

  private async startOnlineGuest(code: string, settings: Settings): Promise<void> {
    this.teardownOnline();
    this.commit({
      settings,
      screen: 'lobby',
      humanPlayerIndex: 1,
      game: null,
      placementProgress: null,
      connection: { role: 'guest', roomCode: code },
    });
    try {
      const session = await guestJoin(code, this.buildSessionCbs());
      this.session = session;
    } catch {
      this.commit({ screen: 'menu', connection: null });
    }
  }

  private buildSessionCbs() {
    return {
      onPeerConnected: () => {
        this.clearDisconnectTimer();
        const conn = this.state.connection;
        if (conn?.role === 'host') {
          this.commit({ connection: { ...conn, peerConnected: true } });
          const s = this.state.settings;
          this.session?.sendSettings(s.mode, s.gridSize);
          this.enterPlacement();
        }
      },
      onSettings: (mode: AppState['settings']['mode'], gridSize: import('./state.ts').GridSize) => {
        const settings: Settings = { ...this.state.settings, mode, gridSize };
        this.commit({ settings });
        this.enterPlacement();
      },
      onOpponentPlacement: (ships: ShipPlacement[]) => {
        this.opponentShips = ships;
        this.maybeStartOnlineGame();
      },
      onOpponentReady: () => {
        /* not used in this flow */
      },
      onOpponentAction: (action: Action) => {
        const game = this.state.game;
        if (game?.phase !== 'battle') return;
        const newGame = applyAction(game, action);
        this.announceShot(newGame, (action as { cell: number }).cell, game.currentPlayer);
        this.commit({ game: newGame, ...this.overPatch(newGame) });
      },
      onOpponentResign: () => {
        this.clearDisconnectTimer();
        const humanIdx = this.state.humanPlayerIndex;
        this.commit({
          screen: 'over',
          scores:
            humanIdx === 0
              ? [this.state.scores[0] + 1, this.state.scores[1]]
              : [this.state.scores[0], this.state.scores[1] + 1],
        });
      },
      onDisconnect: () => {
        if (this.state.screen === 'over' || this.state.screen === 'menu') return;
        this.commit({ disconnectedAt: Date.now() });
        this.disconnectTimer = setTimeout(() => {
          this.returnToMenu();
        }, DISCONNECT_ABANDON_MS);
      },
    };
  }

  private enterPlacement(): void {
    const grid = GRID_CONFIGS[this.state.settings.gridSize];
    const ships = randomPlacement(grid, () => this.rng());
    this.commit({
      screen: 'placement',
      placementProgress: { ships, pendingKinds: [], randomized: true },
    });
  }

  private maybeStartOnlineGame(): void {
    const own = this.ownShips;
    const opp = this.opponentShips;
    if (!own || !opp) return;
    const grid = GRID_CONFIGS[this.state.settings.gridSize];
    const humanIdx = this.state.humanPlayerIndex;
    const p0Ships = humanIdx === 0 ? own : opp;
    const p1Ships = humanIdx === 0 ? opp : own;
    const game = createInitialState(this.state.settings.mode, grid, p0Ships, p1Ships);
    this.ownShips = null;
    this.opponentShips = null;
    this.commit({ screen: 'battle', game, placementProgress: null });
  }

  // ── Placement ───────────────────────────────────────────────────────────────

  private rotatePlacementOrientation(): void {
    const state = this.state as AppState & { _orient?: 'h' | 'v' };
    const next: 'h' | 'v' = state._orient === 'v' ? 'h' : 'v';
    state._orient = next;
    setPlacementOrientation(next);
    render(this.state, this.prev, this.buildActions());
  }

  private randomizePlacement(): void {
    const grid = GRID_CONFIGS[this.state.settings.gridSize];
    const ships = randomPlacement(grid, () => this.rng());
    this.commit({ placementProgress: { ships, pendingKinds: [], randomized: true } });
  }

  private confirmPlacement(humanShips: ShipPlacement[]): void {
    if (this.state.connection) {
      // Online: send placement to opponent, wait for theirs
      this.ownShips = humanShips;
      this.session?.sendPlacement(humanShips);
      this.commit({ placementProgress: null });
      this.maybeStartOnlineGame();
    } else {
      // VS AI: generate AI ships and start immediately
      const grid = GRID_CONFIGS[this.state.settings.gridSize];
      const aiShips = randomPlacement(grid, () => this.rng());
      const game = createInitialState(this.state.settings.mode, grid, humanShips, aiShips);
      this.commit({ screen: 'battle', game, placementProgress: null });
    }
  }

  // ── Battle ──────────────────────────────────────────────────────────────────

  private fireCell(cell: number): void {
    const game = this.state.game;
    if (game?.phase !== 'battle') return;
    if (game.currentPlayer !== this.state.humanPlayerIndex) return;
    const action = getSelectedAction(cell, game) ?? { kind: 'shot' as const, cell };
    if (!isLegalAction(game, action, this.state.humanPlayerIndex).legal) return;

    resetWeaponSelection();
    const newGame = applyAction(game, action);
    this.announceShot(newGame, cell, this.state.humanPlayerIndex);
    this.session?.sendAction(action);
    this.commit({ game: newGame, ...this.overPatch(newGame) });
  }

  private announceShot(game: GameState, cell: number, shooter: 0 | 1): void {
    const targetIdx = shooter === 0 ? 1 : 0;
    const board = game.boards[targetIdx];
    if (!board) return;
    announce(board.shotsReceived.includes(cell) ? 'Hit!' : 'Miss.');
  }

  private overPatch(game: GameState): Partial<AppState> {
    if (game.phase !== 'over') return {};
    const humanIdx = this.state.humanPlayerIndex;
    const humanWon = game.winner === humanIdx;
    return {
      screen: 'over',
      scores: humanWon
        ? [this.state.scores[0] + 1, this.state.scores[1]]
        : [this.state.scores[0], this.state.scores[1] + 1],
    };
  }

  // ── Post-game ──────────────────────────────────────────────────────────────

  private playAgain(): void {
    const { settings, humanPlayerIndex } = this.state;
    if (this.state.connection) {
      void this.startOnlineHost(settings);
      return;
    }
    this.ai = createAi(settings.aiDifficulty);
    const grid = GRID_CONFIGS[settings.gridSize];
    const ships = randomPlacement(grid, () => this.rng());
    this.commit({
      screen: 'placement',
      game: null,
      placementProgress: { ships, pendingKinds: [], randomized: true },
      humanPlayerIndex,
    });
  }

  private returnToMenu(): void {
    this.teardownOnline();
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

  // ── Cleanup ────────────────────────────────────────────────────────────────

  private teardownOnline(): void {
    this.session?.destroy();
    this.session = null;
    this.clearDisconnectTimer();
    this.ownShips = null;
    this.opponentShips = null;
  }

  private clearDisconnectTimer(): void {
    if (this.disconnectTimer !== null) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }
}
