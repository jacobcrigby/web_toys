import type { GameState, GridIndex, Move } from '../engine/index.ts';
import type { AppState } from '../state.ts';
import { h } from './dom.ts';
import type { Actions } from './render.ts';

export const BOARD_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export const POSITION_WORDS = [
  'top left',
  'top',
  'top right',
  'left',
  'center',
  'right',
  'bottom left',
  'bottom',
  'bottom right',
] as const;

export function boardLetter(i: number): string {
  return BOARD_LETTERS[i] ?? '?';
}

const SVG_NS = 'http://www.w3.org/2000/svg';

let macroEl: HTMLElement;
let boardEls: HTMLElement[] = [];
let claimEls: HTMLElement[] = [];
let cellEls: HTMLButtonElement[] = [];
let winlineSvg: SVGSVGElement;
let winlineEl: SVGLineElement;

export function buildMacro(actions: Actions): HTMLElement {
  boardEls = [];
  claimEls = [];
  cellEls = [];
  macroEl = h('div', {
    class: 'macro',
    role: 'application',
    'aria-roledescription': 'ultimate tic-tac-toe board',
    'aria-label': 'Game board',
  });

  for (let b = 0; b < 9; b++) {
    const board = h('section', {
      class: 'board',
      'data-board': String(b),
      role: 'group',
      'aria-label': `Board ${boardLetter(b)} (${POSITION_WORDS[b]})`,
    });
    for (let c = 0; c < 9; c++) {
      const cell = h('button', {
        class: 'cell',
        type: 'button',
        'data-board': String(b),
        'data-cell': String(c),
        tabindex: '-1',
        'aria-disabled': 'true',
        'aria-label': cellLabel(b, c, null),
      });
      cellEls.push(cell);
      board.append(cell);
    }
    const claim = h('div', { class: 'board__claim', 'aria-hidden': 'true' });
    claimEls.push(claim);
    board.append(claim);
    boardEls.push(board);
    macroEl.append(board);
  }

  winlineSvg = document.createElementNS(SVG_NS, 'svg');
  winlineSvg.setAttribute('class', 'winline');
  winlineSvg.setAttribute('viewBox', '0 0 300 300');
  winlineSvg.setAttribute('aria-hidden', 'true');
  winlineSvg.style.display = 'none';
  winlineEl = document.createElementNS(SVG_NS, 'line');
  winlineSvg.append(winlineEl);
  macroEl.append(winlineSvg);

  // Event delegation: one click listener for all 81 cells.
  macroEl.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLButtonElement>('.cell');
    if (!cell) {
      return;
    }
    if (cell.getAttribute('aria-disabled') === 'true') {
      shakeRequiredBoard(cell);
      return;
    }
    const b = Number(cell.dataset.board) as GridIndex;
    const c = Number(cell.dataset.cell) as GridIndex;
    actions.onCell(b, c);
  });

  // One-shot animation classes clean themselves up.
  macroEl.addEventListener('animationend', (e) => {
    (e.target as HTMLElement).classList?.remove(
      'anim-pop',
      'anim-claim',
      'anim-shake',
      'anim-pulse',
    );
  });

  return macroEl;
}

/** Illegal tap: shake the board the player must play in. */
function shakeRequiredBoard(tapped: HTMLElement): void {
  const target =
    macroEl.querySelector<HTMLElement>('.board--active') ?? tapped.closest<HTMLElement>('.board');
  if (!target) {
    return;
  }
  target.classList.remove('anim-shake');
  void target.offsetWidth; // restart the animation on rapid re-taps
  target.classList.add('anim-shake');
}

function cellLabel(b: number, c: number, value: string | null): string {
  return `Board ${boardLetter(b)}, cell ${c + 1}, ${POSITION_WORDS[c]}: ${value ?? 'empty'}`;
}

const centerX = (b: GridIndex): number => (b % 3) * 100 + 50;
const centerY = (b: GridIndex): number => Math.floor(b / 3) * 100 + 50;

function syncWinline(game: GameState, justWon: boolean): void {
  if (game.status.kind !== 'won') {
    winlineSvg.style.display = 'none';
    winlineSvg.classList.remove('winline--draw');
    return;
  }
  const [a, , c] = game.status.line;
  winlineEl.setAttribute('x1', String(centerX(a)));
  winlineEl.setAttribute('y1', String(centerY(a)));
  winlineEl.setAttribute('x2', String(centerX(c)));
  winlineEl.setAttribute('y2', String(centerY(c)));
  winlineEl.setAttribute(
    'stroke',
    game.status.winner === 'X' ? 'var(--color-x)' : 'var(--color-o)',
  );
  const len = Math.hypot(centerX(c) - centerX(a), centerY(c) - centerY(a));
  winlineEl.setAttribute('stroke-dasharray', String(len));
  winlineEl.style.setProperty('--winline-len', String(len));
  winlineSvg.style.display = 'block';
  if (justWon) {
    winlineSvg.classList.add('winline--draw');
  }
}

export function syncBoards(
  state: AppState,
  game: GameState | null,
  prevGame: GameState | null,
  lastMove: Move | null,
): void {
  macroEl.setAttribute('aria-busy', String(state.aiThinking));
  if (!game) {
    return;
  }
  const turn = game.currentPlayer === 'X' ? 'x' : 'o';
  macroEl.style.setProperty('--turn-color', `var(--color-${turn})`);
  macroEl.style.setProperty('--turn-soft', `var(--color-${turn}-soft)`);

  // Diff vs prev only when exactly one ply was added (not undo/rematch/load).
  const movePlayed = prevGame !== null && game.moveCount === prevGame.moveCount + 1;
  const justWon =
    game.status.kind === 'won' && (prevGame === null || prevGame.status.kind === 'playing');
  const lastIdx = lastMove ? lastMove.board * 9 + lastMove.cell : -1;

  const playing = game.status.kind === 'playing';
  for (let b = 0; b < 9; b++) {
    const boardEl = boardEls[b];
    const claimEl = claimEls[b];
    if (!boardEl || !claimEl) {
      continue;
    }
    const status = game.boardStatus[b] ?? 'open';
    boardEl.classList.toggle('board--active', playing && game.forcedBoard === b);
    boardEl.classList.toggle(
      'board--choice',
      playing && game.forcedBoard === null && status === 'open',
    );
    boardEl.classList.toggle('board--won-x', status === 'X');
    boardEl.classList.toggle('board--won-o', status === 'O');
    boardEl.classList.toggle('board--draw', status === 'draw');
    claimEl.textContent = status === 'open' ? '' : status === 'draw' ? '–' : status;

    if (movePlayed && status !== 'open' && prevGame.boardStatus[b] === 'open') {
      claimEl.classList.add('anim-claim'); // board capture
    }
    if (justWon && game.status.kind === 'won') {
      const i = game.status.line.indexOf(b as GridIndex);
      if (i !== -1) {
        boardEl.style.setProperty('--pulse-delay', `${i * 80}ms`);
        boardEl.classList.add('anim-pulse');
      }
    }

    const boardPlayable =
      playing && status === 'open' && (game.forcedBoard === null || game.forcedBoard === b);
    for (let c = 0; c < 9; c++) {
      const idx = b * 9 + c;
      const cellEl = cellEls[idx];
      if (!cellEl) {
        continue;
      }
      const value = game.cells[idx] ?? null;
      cellEl.classList.toggle('cell--x', value === 'X');
      cellEl.classList.toggle('cell--o', value === 'O');
      cellEl.classList.toggle('cell--last', idx === lastIdx);
      if (cellEl.textContent !== (value ?? '')) {
        cellEl.textContent = value ?? '';
      }
      if (movePlayed && value !== null && (prevGame.cells[idx] ?? null) === null) {
        cellEl.classList.add('anim-pop'); // mark placement
      }
      cellEl.setAttribute('aria-disabled', String(!(boardPlayable && value === null)));
      cellEl.setAttribute('aria-label', cellLabel(b, c, value));
    }
  }
  syncWinline(game, justWon);
}
