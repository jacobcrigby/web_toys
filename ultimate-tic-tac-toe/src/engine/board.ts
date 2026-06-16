import { lineWinner } from './lines.ts';
import type { BoardStatus, CellValue, GridIndex } from './types.ts';

/** Status of one small board from the 81-cell array. Win beats full (E6). */
export function computeBoardStatus(cells: CellValue[], board: GridIndex): BoardStatus {
  const base = board * 9;
  const win = lineWinner<CellValue>((i) => cells[base + i] ?? null, null);
  if (win?.winner) {
    return win.winner;
  }
  for (let i = 0; i < 9; i++) {
    if ((cells[base + i] ?? null) === null) {
      return 'open';
    }
  }
  return 'draw';
}
