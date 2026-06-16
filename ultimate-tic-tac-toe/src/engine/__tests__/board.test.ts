import { describe, expect, test } from 'vitest';
import { computeBoardStatus } from '../board.ts';
import { LINES } from '../lines.ts';
import type { CellValue, GridIndex, Player } from '../types.ts';

const BOARDS: GridIndex[] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** Build an 81-cell array with `values` (sparse, indices 0-8) placed in `board`. */
function cellsWith(board: GridIndex, values: Partial<Record<GridIndex, Player>>): CellValue[] {
  const cells: CellValue[] = Array(81).fill(null);
  for (const [cell, player] of Object.entries(values)) {
    cells[board * 9 + Number(cell)] = player;
  }
  return cells;
}

describe('computeBoardStatus', () => {
  test('empty board is open', () => {
    expect(computeBoardStatus(Array(81).fill(null), 0)).toBe('open');
  });

  test('detects all 8 win lines for both players, on every board index', () => {
    for (const player of ['X', 'O'] as const) {
      for (const line of LINES) {
        for (const board of [0, 4, 8] as const) {
          const values: Partial<Record<GridIndex, Player>> = {};
          for (const i of line) {
            values[i] = player;
          }
          expect(computeBoardStatus(cellsWith(board, values), board)).toBe(player);
        }
      }
    }
  });

  test('only reads the requested board', () => {
    // Board 0 won by X must not affect board 1's status.
    const cells = cellsWith(0, { 0: 'X', 1: 'X', 2: 'X' });
    expect(computeBoardStatus(cells, 1)).toBe('open');
  });

  test('full board with no winner is a draw', () => {
    // X@{0,2,3,7,8}, O@{1,4,5,6} — the canonical no-line full pattern.
    const cells = cellsWith(4, {
      0: 'X',
      2: 'X',
      3: 'X',
      7: 'X',
      8: 'X',
      1: 'O',
      4: 'O',
      5: 'O',
      6: 'O',
    });
    expect(computeBoardStatus(cells, 4)).toBe('draw');
  });

  test('E6: final cell that both fills and wins the board makes it won, not drawn', () => {
    // Full board where the last mark completes X's bottom row.
    const cells = cellsWith(2, {
      0: 'X',
      1: 'O',
      2: 'X',
      3: 'O',
      4: 'X',
      5: 'O',
      6: 'X',
      7: 'X',
      8: 'X',
    });
    expect(computeBoardStatus(cells, 2)).toBe('X');
  });

  test('partially filled board with no line is open on all boards', () => {
    for (const board of BOARDS) {
      const cells = cellsWith(board, { 0: 'X', 4: 'O' });
      expect(computeBoardStatus(cells, board)).toBe('open');
    }
  });
});
