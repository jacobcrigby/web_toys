import { describe, expect, test } from 'vitest';
import { buildBoardStatus, buildCells, makeState, playMoves } from '../engine/__tests__/helpers.ts';
import { isLegalMove } from '../engine/index.ts';
import { createEasyAi } from './easy.ts';
import { mulberry32 } from './rng.ts';

describe('Easy AI', () => {
  test('takes a game-winning move when one exists', async () => {
    const s = makeState({
      cells: buildCells([
        [8, 0, 'X'],
        [8, 4, 'X'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'X', 4: 'X' }),
      currentPlayer: 'X',
      forcedBoard: 8,
    });
    const ai = createEasyAi();
    for (let seed = 1; seed <= 10; seed++) {
      const move = await ai.chooseMove(s, { rng: mulberry32(seed) });
      expect(move).toEqual({ board: 8, cell: 8 });
    }
  });

  test('does NOT block an opponent threat (no blocking rule, by design)', async () => {
    // O threatens to win the game at {8,8}; X to move with free choice.
    const s = makeState({
      cells: buildCells([
        [8, 0, 'O'],
        [8, 4, 'O'],
      ]),
      boardStatus: buildBoardStatus({ 0: 'O', 4: 'O' }),
      currentPlayer: 'X',
      forcedBoard: null,
    });
    const ai = createEasyAi();
    const choices = new Set<string>();
    for (let seed = 1; seed <= 50; seed++) {
      const move = await ai.chooseMove(s, { rng: mulberry32(seed) });
      choices.add(`${move.board},${move.cell}`);
    }
    // A blocking AI would always play 8,8. Easy must scatter.
    expect(choices.size).toBeGreaterThan(1);
    expect([...choices].some((c) => c !== '8,8')).toBe(true);
  });

  test('returns only legal moves', async () => {
    const ai = createEasyAi();
    const s = playMoves([
      [4, 4],
      [4, 0],
    ]); // X forced to board 0
    for (let seed = 1; seed <= 20; seed++) {
      const move = await ai.chooseMove(s, { rng: mulberry32(seed) });
      expect(isLegalMove(s, move)).toBe(true);
    }
  });

  test('exposes difficulty and a no-op dispose', () => {
    const ai = createEasyAi();
    expect(ai.difficulty).toBe('easy');
    expect(() => ai.dispose()).not.toThrow();
  });
});
