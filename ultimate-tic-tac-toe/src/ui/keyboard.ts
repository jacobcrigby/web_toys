/**
 * Roving tabindex: the whole macro board is one tab stop. Arrow keys move
 * focus across the logical 9×9 grid (crossing board edges), Home/End jump
 * within the row. Enter/Space activate natively (cells are <button>s).
 */
export function initKeyboard(macro: HTMLElement): void {
  const cells = Array.from(macro.querySelectorAll<HTMLButtonElement>('.cell'));
  let row = 0;
  let col = 0;

  const domIndex = (r: number, c: number): number => {
    const board = Math.floor(r / 3) * 3 + Math.floor(c / 3);
    const cell = (r % 3) * 3 + (c % 3);
    return board * 9 + cell;
  };

  const moveTo = (r: number, c: number, focus: boolean): void => {
    cells[domIndex(row, col)]?.setAttribute('tabindex', '-1');
    row = r;
    col = c;
    const el = cells[domIndex(r, c)];
    el?.setAttribute('tabindex', '0');
    if (focus) {
      el?.focus();
    }
  };

  moveTo(0, 0, false);

  macro.addEventListener('keydown', (e) => {
    let r = row;
    let c = col;
    switch (e.key) {
      case 'ArrowUp':
        r = Math.max(0, r - 1);
        break;
      case 'ArrowDown':
        r = Math.min(8, r + 1);
        break;
      case 'ArrowLeft':
        c = Math.max(0, c - 1);
        break;
      case 'ArrowRight':
        c = Math.min(8, c + 1);
        break;
      case 'Home':
        c = 0;
        break;
      case 'End':
        c = 8;
        break;
      default:
        return;
    }
    e.preventDefault();
    moveTo(r, c, true);
  });

  // Keep the roving stop in sync when focus lands via pointer or AT.
  macro.addEventListener('focusin', (e) => {
    const el = e.target as HTMLElement;
    const board = el.dataset.board;
    const cell = el.dataset.cell;
    if (board === undefined || cell === undefined) {
      return;
    }
    const b = Number(board);
    const c = Number(cell);
    const r = Math.floor(b / 3) * 3 + Math.floor(c / 3);
    const cc = (b % 3) * 3 + (c % 3);
    if (r !== row || cc !== col) {
      moveTo(r, cc, false);
    }
  });
}
