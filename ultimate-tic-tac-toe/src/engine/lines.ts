import type { GridIndex, WinLine } from './types.ts';

export const LINES: readonly WinLine[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

/**
 * Scan all win lines over an abstract 3x3 grid. `empty` is the sentinel that
 * never wins — callers scanning macro boardStatus must normalize 'draw'/'open'
 * to the sentinel before calling, or three drawn boards would count as a line.
 */
export function lineWinner<T>(
  get: (i: GridIndex) => T,
  empty: T,
): { winner: T; line: WinLine } | null {
  for (const line of LINES) {
    const a = get(line[0]);
    if (a !== empty && a === get(line[1]) && a === get(line[2])) {
      return { winner: a, line };
    }
  }
  return null;
}
