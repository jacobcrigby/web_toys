import type { GameState, GridIndex, Player } from '../engine/index.ts';
import type { AppState, Settings } from '../state.ts';
import { boardLetter, buildMacro, syncBoards } from './board.ts';
import { h } from './dom.ts';
import { buildHistoryStrip, syncHistory } from './history.ts';
import { buildHud, syncHud } from './hud.ts';
import { initKeyboard } from './keyboard.ts';
import { buildLobby, syncLobby } from './lobby.ts';
import { buildMenu, syncMenu } from './menu.ts';
import { buildOverlay, syncOverlay } from './overlay.ts';

export interface Actions {
  onCell(b: GridIndex, c: GridIndex): void;
  onUndo(): void;
  onNewGame(): void;
  onRematch(): void;
  onMenu(): void;
  onMute(): void;
  onStart(): void;
  onResetScores(): void; // wired Phase 5
  onSetting(k: keyof Settings, v: unknown): void;
  // Online mode
  onStartOnlineHost(side: Player): void;
  onJoinOnlineGuest(code: string): void;
  onLobbyCodeChange(code: string): void;
  onLobbyCodeRandomize(): void;
  onLobbyCopyLink(): void;
  onLobbyCancel(): void;
  onResign(): void;
}

let statusEl: HTMLElement;
let newGameBtn: HTMLButtonElement;
let undoBtn: HTMLButtonElement;
let muteBtn: HTMLButtonElement;
let menuScreenEl: HTMLElement;
let lobbyScreenEl: HTMLElement;
let gameScreenEl: HTMLElement;
let lastState: AppState | null = null;

/**
 * The UI layer reads engine state as plain data (ui → engine is types-only):
 * the current game state is the last history entry's stateAfter.
 */
function gameStateOf(state: AppState): GameState | null {
  const h = state.history;
  if (!h) {
    return null;
  }
  return h.entries.at(-1)?.stateAfter ?? h.initialState;
}

/** Builds ALL static DOM once; render() only syncs attributes/classes/text. */
export function mount(root: HTMLElement, actions: Actions): void {
  const hud = buildHud();
  const macro = buildMacro(actions);
  const controls = buildControls(actions);
  const historyStrip = buildHistoryStrip();
  gameScreenEl = h('div', { class: 'screen screen--game' }, [hud, macro, controls, historyStrip]);
  menuScreenEl = buildMenu(actions);
  lobbyScreenEl = buildLobby(actions);
  const overlay = buildOverlay(actions);
  statusEl = h('div', {
    id: 'status',
    class: 'visually-hidden',
    role: 'status',
    'aria-live': 'polite',
  });
  root.replaceChildren(menuScreenEl, lobbyScreenEl, gameScreenEl, overlay, statusEl);
  initKeyboard(macro);
}

function buildControls(actions: Actions): HTMLElement {
  newGameBtn = h('button', { class: 'btn', type: 'button' }, ['New game']);
  let armed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const disarm = () => {
    armed = false;
    clearTimeout(timer);
    newGameBtn.textContent = 'New game';
    newGameBtn.classList.remove('btn--danger-armed');
  };
  newGameBtn.addEventListener('click', () => {
    const game = lastState ? gameStateOf(lastState) : null;
    const midGame = game !== null && game.status.kind === 'playing' && game.moveCount >= 2;
    if (!midGame || armed) {
      disarm();
      actions.onNewGame();
      return;
    }
    armed = true;
    newGameBtn.textContent = 'Sure?';
    newGameBtn.classList.add('btn--danger-armed');
    timer = setTimeout(disarm, 3000);
  });
  undoBtn = h('button', { class: 'btn', type: 'button' }, ['Undo']);
  undoBtn.disabled = true;
  undoBtn.addEventListener('click', () => actions.onUndo());
  const menuBtn = h('button', { class: 'btn', type: 'button' }, ['Menu']);
  menuBtn.addEventListener('click', () => {
    disarm();
    actions.onMenu();
  });
  muteBtn = h(
    'button',
    {
      class: 'btn btn--icon',
      type: 'button',
      'aria-label': 'Mute sounds',
      'aria-pressed': 'false',
    },
    ['🔊'],
  );
  muteBtn.addEventListener('click', () => actions.onMute());
  return h('div', { class: 'controls' }, [undoBtn, newGameBtn, menuBtn, muteBtn]);
}

/**
 * Undo is blocked (not queued) while the AI thinks; disabled post-result (use
 * Rematch) and — vs AI — until the human has a move to take back, so the
 * button never visibly does nothing.
 */
function undoDisabled(state: AppState, game: GameState | null): boolean {
  const history = state.history;
  if (!history || history.entries.length === 0 || state.aiThinking || !game) {
    return true;
  }
  if (game.status.kind !== 'playing') {
    return true;
  }
  if (
    state.settings.mode === 'ai' &&
    !history.entries.some((e) => e.player === state.settings.humanPlays)
  ) {
    return true;
  }
  return false;
}

export function render(state: AppState, prev: AppState | null): void {
  const game = gameStateOf(state);
  const prevGame = prev ? gameStateOf(prev) : null;
  menuScreenEl.hidden = state.screen !== 'menu';
  lobbyScreenEl.hidden = state.screen !== 'lobby';
  gameScreenEl.hidden = state.screen !== 'game';
  syncMenu(state);
  if (state.screen === 'lobby') syncLobby(state);
  const lastMove = state.history?.entries.at(-1)?.move ?? null;
  syncBoards(state, game, prevGame, lastMove);
  syncHud(state, game);
  syncHistory(state.history);
  undoBtn.disabled = undoDisabled(state, game);
  muteBtn.setAttribute('aria-pressed', String(state.settings.muted));
  muteBtn.textContent = state.settings.muted ? '🔇' : '🔊';
  const justEnded =
    game !== null &&
    game.status.kind !== 'playing' &&
    (prevGame === null || prevGame.status.kind === 'playing');
  syncOverlay(state, game, justEnded);
  announce(game, prevGame);
  lastState = state;
}

/** Visually-hidden live region: turn changes, board captures, results. */
function announce(game: GameState | null, prevGame: GameState | null): void {
  if (!game) {
    return;
  }
  if (game.status.kind !== 'playing') {
    if (prevGame === null || prevGame.status.kind === 'playing') {
      statusEl.setAttribute('role', 'alert');
      statusEl.textContent =
        game.status.kind === 'won' ? `${game.status.winner} wins the game!` : 'The game is a draw';
    }
    return;
  }
  statusEl.setAttribute('role', 'status');
  if (prevGame && prevGame.moveCount === game.moveCount) {
    return; // no move happened; keep the last announcement
  }
  const parts: string[] = [];
  if (prevGame) {
    for (let b = 0; b < 9; b++) {
      if (prevGame.boardStatus[b] === 'open' && game.boardStatus[b] !== 'open') {
        const s = game.boardStatus[b];
        parts.push(
          s === 'draw' ? `Board ${boardLetter(b)} is drawn` : `${s} wins board ${boardLetter(b)}`,
        );
      }
    }
  }
  parts.push(
    game.forcedBoard !== null
      ? `${game.currentPlayer} to move — must play in board ${boardLetter(game.forcedBoard)}`
      : `${game.currentPlayer} to move — play any open board`,
  );
  statusEl.textContent = parts.join('. ');
}
