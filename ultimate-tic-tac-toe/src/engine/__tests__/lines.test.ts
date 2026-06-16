import { describe, expect, test } from 'vitest';
import { LINES, lineWinner } from '../lines.ts';
import type { CellValue, GridIndex } from '../types.ts';

describe('LINES', () => {
  test('contains the 8 win lines in canonical order', () => {
    expect(LINES).toEqual([
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ]);
  });
});

describe('lineWinner', () => {
  const fromArray =
    (values: CellValue[]) =>
    (i: GridIndex): CellValue =>
      values[i] ?? null;

  test('finds a completed line and returns winner + line', () => {
    const values: CellValue[] = ['X', 'X', 'X', null, 'O', null, 'O', null, null];
    expect(lineWinner(fromArray(values), null)).toEqual({ winner: 'X', line: [0, 1, 2] });
  });

  test('finds each of the 8 lines for both players', () => {
    for (const player of ['X', 'O'] as const) {
      for (const line of LINES) {
        const values: CellValue[] = Array(9).fill(null);
        for (const i of line) {
          values[i] = player;
        }
        expect(lineWinner(fromArray(values), null)).toEqual({ winner: player, line });
      }
    }
  });

  test('returns null when no line is complete', () => {
    const values: CellValue[] = ['X', 'O', 'X', 'O', 'X', 'O', 'O', 'X', 'O'];
    expect(lineWinner(fromArray(values), null)).toBeNull();
  });

  test('never treats the empty sentinel as a winner', () => {
    const values: CellValue[] = Array(9).fill(null);
    expect(lineWinner(fromArray(values), null)).toBeNull();
  });

  test('works with a custom sentinel type', () => {
    // The macro scan normalizes 'draw'/'open' to the sentinel; three matching
    // sentinels must never count as a win.
    const statuses = ['draw', 'draw', 'draw', 'X', 'X', 'open', 'open', 'open', 'open'];
    const get = (i: GridIndex) => {
      const s = statuses[i];
      return s === 'X' || s === 'O' ? s : null;
    };
    expect(lineWinner(get, null)).toBeNull();
  });
});
