import type { PeerStatus, Room } from '@web-toys/multiplayer';
import { createRoom, joinRoom as joinNetRoom } from '@web-toys/multiplayer';
import type { AiDifficulty, AiPlayer, Rng } from './ai/index.ts';
import { mulberry32 } from './ai/index.ts';
import type { GameState, GridIndex, Move, Player } from './engine/index.ts';
import {
  createHistory,
  createInitialState,
  currentState,
  isLegalMove,
  pushMove,
  undo as undoMoves,
  undoToPlayerTurn,
} from './engine/index.ts';
import { MultiplayerSession } from './network/session.ts';
import type { AppState, Settings } from './state.ts';
import { createAppState } from './state.ts';
import { loadPersisted, savePersisted } from './storage.ts';
import { mount, render } from './ui/render.ts';
import type { SoundManager } from './ui/sound.ts';

export interface ControllerDeps {
  sound: SoundManager;
  createAi: (difficulty: AiDifficulty) => AiPlayer;
}

const MIN_AI_DELAY_MS: Record<AiDifficulty, number> = { easy: 500, medium: 500, hard: 0 };

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export class GameController {
  private state: AppState = createAppState();
  private ai: AiPlayer | null = null;
  private aiAbort: AbortController | null = null;
  private rng: Rng = mulberry32(Date.now() >>> 0);
  private session: MultiplayerSession | null = null;
  private disconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private root: HTMLElement,
    private deps: ControllerDeps,
  ) {}

  init(): void {
    const persisted = loadPersisted();
    if (persisted) {
      this.state = { ...this.state, settings: persisted.settings, scores: persisted.scores };
      this.deps.sound.setMuted(persisted.settings.muted);
    }
    mount(this.root, {
      onCell: (b, c) => this.playCell(b, c),
      onUndo: () => this.undo(),
      onNewGame: () => this.startGame(),
      onRematch: () => this.rematch(),
      onMenu: () => this.goToMenu(),
      onMute: () => this.setSetting('muted', !this.state.settings.muted),
      onStart: () => this.startGame(),
      onResetScores: () => this.resetScores(),
      onSetting: (k, v) => this.setSetting(k, v as never),
      onStartOnlineHost: (side) => {
        void this.startOnlineHost(side);
      },
      onJoinOnlineGuest: (code) => {
        void this.startOnlineGuest(code);
      },
      onLobbyCodeChange: (code) => {
        void this.lobbyCodeChange(code);
      },
      onLobbyCopyLink: () => {
        const code = this.state.connection?.roomCode;
        if (code) {
          const url = new URL(location.href);
          url.searchParams.set('room', code);
          void navigator.clipboard.writeText(url.toString());
        }
      },
      onLobbyCancel: () => this.lobbyCancel(),
      onResign: () => this.resignOnline(),
      onKeepWaiting: () => this.keepWaiting(),
    });
    render(this.state, null);
  }

  undo(): void {
    if (this.state.settings.mode === 'online') return;
    const history = this.state.history;
    if (!history || this.state.aiThinking || history.entries.length === 0) {
      return;
    }
    if (currentState(history).status.kind !== 'playing') {
      return; // game over: use Rematch (undo never decrements scores)
    }
    const next =
      this.state.settings.mode === 'ai'
        ? undoToPlayerTurn(history, this.state.settings.humanPlays)
        : undoMoves(history, 1);
    if (next === history) {
      return;
    }
    this.commit((s) => {
      s.history = next;
    });
  }

  resetScores(): void {
    this.commit((s) => {
      s.scores = { x: 0, o: 0, draws: 0 };
    });
  }

  startGame(): void {
    this.abortAiTurn();
    this.ai?.dispose();
    this.ai =
      this.state.settings.mode === 'ai' ? this.deps.createAi(this.state.settings.difficulty) : null;
    this.commit((s) => {
      s.screen = 'game';
      s.history = createHistory(createInitialState());
      s.aiThinking = false;
    });
    this.maybeDispatchAiTurn();
  }

  rematch(): void {
    this.startGame(); // same settings; scores carry over (covers the AI opening as X)
  }

  goToMenu(): void {
    this.abortAiTurn();
    this.ai?.dispose();
    this.ai = null;
    this.session?.destroy();
    this.session = null;
    this._clearDisconnectTimer();
    this.commit((s) => {
      s.screen = 'menu';
      s.history = null;
      s.aiThinking = false;
      s.connection = null;
      s.disconnectedAt = null;
      s.timedOut = false;
    });
  }

  async startOnlineHost(side: Player): Promise<void> {
    // Reuse existing code when called from the lobby (e.g., side-button change);
    // generate a new code when first entering the lobby from the menu.
    const existingCode = this.state.connection?.isHost ? this.state.connection.roomCode : undefined;
    this.session?.destroy();
    this.session = null;
    try {
      const room: Room = existingCode
        ? await joinNetRoom(existingCode, { appId: 'web-toys-uttt-v1' })
        : await createRoom({ appId: 'web-toys-uttt-v1' });
      this.commit((s) => {
        s.screen = 'lobby';
        s.settings.mode = 'online';
        s.connection = { roomCode: room.code, mySide: side, status: 'waiting', isHost: true };
      });
      this._setupSession(room, true, side);
    } catch {
      // relay unreachable — return to menu
      this.commit((s) => {
        s.screen = 'menu';
        s.connection = null;
      });
    }
  }

  async startOnlineGuest(code: string): Promise<void> {
    this.commit((s) => {
      s.screen = 'lobby';
      s.settings.mode = 'online';
      s.connection = { roomCode: code, mySide: 'O', status: 'waiting', isHost: false };
    });
    try {
      const room: Room = await joinNetRoom(code, { appId: 'web-toys-uttt-v1' });
      this._setupSession(room, false, 'X' /* placeholder; corrected on ready msg */);
    } catch {
      this.commit((s) => {
        s.screen = 'menu';
        s.settings.mode = 'hotseat';
        s.connection = null;
      });
    }
  }

  async lobbyCodeChange(code: string): Promise<void> {
    const conn = this.state.connection;
    if (!conn?.isHost || this.state.screen !== 'lobby') return;
    const mySide = conn.mySide;
    this.session?.destroy();
    this.session = null;
    try {
      const room: Room = await joinNetRoom(code, { appId: 'web-toys-uttt-v1' });
      this.commit((s) => {
        if (s.connection) s.connection.roomCode = code;
      });
      this._setupSession(room, true, mySide);
    } catch {
      // relay unreachable; state keeps old code until user retries
    }
  }

  resignOnline(): void {
    this.session?.sendResign();
    this.goToMenu();
  }

  lobbyCancel(): void {
    this.session?.destroy();
    this.session = null;
    this._clearDisconnectTimer();
    this.commit((s) => {
      s.screen = 'menu';
      s.settings.mode = 'hotseat';
      s.connection = null;
      s.disconnectedAt = null;
      s.timedOut = false;
    });
  }

  private _setupSession(room: Room, isHost: boolean, hostSide: Player): void {
    this.session?.destroy();
    this.session = new MultiplayerSession({
      room,
      isHost,
      hostSide,
      onStatusChange: (status: PeerStatus) => {
        if (status === 'connected') {
          this._clearDisconnectTimer();
          this.commit((s) => {
            if (s.connection) s.connection.status = status;
            s.disconnectedAt = null;
            s.timedOut = false;
          });
        } else {
          this.commit((s) => {
            if (s.connection) s.connection.status = status;
          });
          if (status === 'disconnected') {
            this._startDisconnectTimer();
          }
        }
      },
      onGameStart: (mySide: Player) => {
        this.commit((s) => {
          s.screen = 'game';
          s.history = createHistory(createInitialState());
          s.aiThinking = false;
          if (s.connection) s.connection.mySide = mySide;
        });
        // If opponent (X) goes first and we're O, start waiting immediately
        this.maybeSetWaitingForPeer();
      },
      onOpponentResign: () => {
        this.goToMenu();
      },
      onRemoteMove: (move) => {
        const history = this.state.history;
        if (!history) return;
        if (!isLegalMove(currentState(history), move)) {
          this._tearDownOnlineSession();
          return;
        }
        this.applyAndCommit(history, move);
        this.maybeSetWaitingForPeer();
      },
      getHistory: () => {
        const history = this.state.history;
        if (!history) return [];
        return history.entries.map((e) => e.move);
      },
    });
  }

  private maybeSetWaitingForPeer(): void {
    const { settings, history, screen, connection } = this.state;
    if (screen !== 'game' || settings.mode !== 'online' || !history || !connection) return;
    const game = currentState(history);
    if (game.status.kind !== 'playing') return;
    if (game.currentPlayer !== connection.mySide) {
      this.commit((s) => {
        s.aiThinking = true;
      });
    }
  }

  private _startDisconnectTimer(): void {
    this._clearDisconnectTimer();
    this.commit((s) => {
      s.disconnectedAt = Date.now();
      s.timedOut = false;
    });
    this.disconnectTimer = setTimeout(() => {
      this.disconnectTimer = null;
      this.commit((s) => {
        s.timedOut = true;
      });
    }, 30_000);
  }

  keepWaiting(): void {
    this._startDisconnectTimer();
  }

  private _clearDisconnectTimer(): void {
    if (this.disconnectTimer !== null) {
      clearTimeout(this.disconnectTimer);
      this.disconnectTimer = null;
    }
  }

  private _tearDownOnlineSession(): void {
    this._clearDisconnectTimer();
    this.session?.destroy();
    this.session = null;
  }

  playCell(board: GridIndex, cell: GridIndex): void {
    const history = this.state.history;
    if (!history || this.state.aiThinking || this.state.screen !== 'game') {
      return;
    }
    const game = currentState(history);
    if (
      this.state.settings.mode === 'ai' &&
      game.currentPlayer !== this.state.settings.humanPlays
    ) {
      return;
    }
    // Online turn guard: block if it's the opponent's turn
    if (
      this.state.settings.mode === 'online' &&
      game.currentPlayer !== this.state.connection?.mySide
    ) {
      return;
    }
    if (!isLegalMove(game, { board, cell })) {
      return; // illegal taps do nothing
    }
    this.applyAndCommit(history, { board, cell });
    // Send local move to peer (only for local human moves, not remote moves)
    if (this.state.settings.mode === 'online') {
      this.session?.sendMove({ board, cell });
    }
    this.maybeSetWaitingForPeer();
    if (this.state.settings.mode !== 'online') this.maybeDispatchAiTurn();
  }

  setSetting<K extends keyof Settings>(k: K, v: Settings[K]): void {
    this.commit((s) => {
      s.settings[k] = v;
    });
    if (k === 'muted') {
      this.deps.sound.setMuted(Boolean(v));
    }
  }

  /**
   * AI-turn dispatch invariant: in AI mode, after any commit that leaves the
   * game playing with the AI to move and no request in flight, dispatch.
   */
  private maybeDispatchAiTurn(): void {
    const { settings, history, aiThinking, screen } = this.state;
    if (screen !== 'game' || settings.mode !== 'ai' || !history || aiThinking || !this.ai) {
      return;
    }
    const game = currentState(history);
    if (game.status.kind !== 'playing' || game.currentPlayer === settings.humanPlays) {
      return;
    }
    void this.runAiTurn(this.ai, history, game);
  }

  private async runAiTurn(
    ai: AiPlayer,
    history: NonNullable<AppState['history']>,
    game: GameState,
  ): Promise<void> {
    const abort = new AbortController();
    this.aiAbort = abort;
    this.commit((s) => {
      s.aiThinking = true;
    });
    let move: Move | null = null;
    try {
      const [chosen] = await Promise.all([
        ai.chooseMove(game, { rng: this.rng, signal: abort.signal }),
        sleep(MIN_AI_DELAY_MS[ai.difficulty]),
      ]);
      move = chosen;
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        console.error('AI failed to choose a move:', err);
      }
    }
    // Stale-move guard: abort-rejection alone cannot close the race — fast AIs
    // resolve before the min-delay sleep, so a New Game/Menu click in that
    // window aborts nothing already-settled. New Game/Menu/dispose always call
    // abort(), making signal.aborted a sufficient staleness check.
    if (this.aiAbort !== abort || abort.signal.aborted) {
      return;
    }
    this.aiAbort = null;
    if (move === null) {
      this.commit((s) => {
        s.aiThinking = false; // never soft-lock
      });
      return;
    }
    this.applyAndCommit(history, move);
    this.maybeDispatchAiTurn();
  }

  private abortAiTurn(): void {
    this.aiAbort?.abort();
    this.aiAbort = null;
  }

  /** Shared human/AI move path: push, score on game end, sound. */
  private applyAndCommit(history: NonNullable<AppState['history']>, move: Move): void {
    const before = currentState(history);
    const next = pushMove(history, move);
    const after = currentState(next);
    this.commit((s) => {
      s.history = next;
      s.aiThinking = false;
      // Score increment locus: the commit that transitions status to won/drawn.
      if (after.status.kind === 'won') {
        if (after.status.winner === 'X') {
          s.scores.x++;
        } else {
          s.scores.o++;
        }
      } else if (after.status.kind === 'drawn') {
        s.scores.draws++;
      }
    });
    if (after.status.kind === 'won') {
      this.deps.sound.play('win');
    } else if (after.status.kind === 'drawn') {
      this.deps.sound.play('draw');
    } else if (after.boardStatus[move.board] !== before.boardStatus[move.board]) {
      this.deps.sound.play('capture');
    } else {
      this.deps.sound.play('place');
    }
  }

  /** Every state mutation flows through here: mutate → persist → render. */
  private commit(mutate: (s: AppState) => void): void {
    const prev = this.state;
    const next: AppState = {
      ...prev,
      settings: { ...prev.settings },
      scores: { ...prev.scores },
      connection: prev.connection !== null ? { ...prev.connection } : null,
    };
    mutate(next);
    this.state = next;
    savePersisted({ version: 1, settings: next.settings, scores: next.scores });
    render(next, prev);
  }
}
