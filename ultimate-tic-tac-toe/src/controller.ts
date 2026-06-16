import type { AiDifficulty, AiPlayer, Rng } from './ai/index.ts';
import { mulberry32 } from './ai/index.ts';
import type { GameState, GridIndex, Move } from './engine/index.ts';
import {
  createHistory,
  createInitialState,
  currentState,
  isLegalMove,
  pushMove,
  undo as undoMoves,
  undoToPlayerTurn,
} from './engine/index.ts';
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
    });
    render(this.state, null);
  }

  undo(): void {
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
    this.commit((s) => {
      s.screen = 'menu';
      s.history = null;
      s.aiThinking = false;
    });
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
    if (!isLegalMove(game, { board, cell })) {
      return; // illegal taps do nothing
    }
    this.applyAndCommit(history, { board, cell });
    this.maybeDispatchAiTurn();
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
    };
    mutate(next);
    this.state = next;
    savePersisted({ version: 1, settings: next.settings, scores: next.scores });
    render(next, prev);
  }
}
