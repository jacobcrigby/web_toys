import { expect, test, vi } from 'vitest';
import type { Player } from '../engine/index.ts';
import { applyMove, createInitialState, isLegalMove } from '../engine/index.ts';
import { createEasyAi } from './easy.ts';
import { createMctsSearch } from './mcts.ts';
import { createMediumAi } from './medium.ts';
import { mulberry32 } from './rng.ts';
import type { AiPlayer } from './types.ts';

vi.setConfig({ testTimeout: 120_000 });

type GameResult = 'A' | 'B' | 'draw';

/** Seeded full game; every move asserted legal before it is applied. */
async function playGame(
  aiA: AiPlayer,
  aiB: AiPlayer,
  seed: number,
  aPlays: Player,
): Promise<GameResult> {
  const rngA = mulberry32(seed);
  const rngB = mulberry32(seed + 1_000_003);
  let state = createInitialState();
  while (state.status.kind === 'playing') {
    const isA = state.currentPlayer === aPlays;
    const ai = isA ? aiA : aiB;
    const move = await ai.chooseMove(state, { rng: isA ? rngA : rngB });
    expect(isLegalMove(state, move), `${ai.difficulty} returned an illegal move`).toBe(true);
    state = applyMove(state, move);
  }
  if (state.status.kind === 'drawn') {
    return 'draw';
  }
  return state.status.winner === aPlays ? 'A' : 'B';
}

test('strength gate: Medium scores >= 32/40 (80%) vs Easy, alternating colors', async () => {
  const medium = createMediumAi();
  const easy = createEasyAi();
  let score = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const mediumPlays: Player = seed % 2 === 1 ? 'X' : 'O';
    const result = await playGame(medium, easy, seed, mediumPlays);
    if (result === 'A') {
      score += 1;
    } else if (result === 'draw') {
      score += 0.5;
    }
  }
  expect(score).toBeGreaterThanOrEqual(32);
});

test('strength gate: MCTS@1000 iterations scores >= 6.5/10 (65%) vs Medium(d3)', async () => {
  const mcts: AiPlayer = {
    difficulty: 'hard',
    chooseMove(state, ctx) {
      const search = createMctsSearch(state, { rng: ctx.rng, maxIterations: 1000 });
      search.run(1000);
      return Promise.resolve(search.best().move);
    },
    dispose() {},
  };
  const medium = createMediumAi();
  let score = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const mctsPlays: Player = seed % 2 === 1 ? 'X' : 'O';
    const result = await playGame(mcts, medium, seed, mctsPlays);
    if (result === 'A') {
      score += 1;
    } else if (result === 'draw') {
      score += 0.5;
    }
  }
  expect(score).toBeGreaterThanOrEqual(6.5);
});
