export type Player = 'X' | 'O';
export type GridIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; // macro boards AND cells, reading order
export type CellValue = Player | null;
export type BoardStatus = Player | 'draw' | 'open';
export type WinLine = readonly [GridIndex, GridIndex, GridIndex];

export interface Move {
  board: GridIndex;
  cell: GridIndex;
} // mover implied by state.currentPlayer

export type GameStatus =
  | { kind: 'playing' }
  | { kind: 'won'; winner: Player; line: WinLine } // line = macro-grid indices
  | { kind: 'drawn' };

export interface GameState {
  cells: CellValue[]; // length 81, index = board*9 + cell
  boardStatus: BoardStatus[]; // length 9, derived cache, updated incrementally
  currentPlayer: Player;
  forcedBoard: GridIndex | null; // null = free choice among open boards
  status: GameStatus;
  moveCount: number;
}
