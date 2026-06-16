import type { GameState, Move } from '../engine/index.ts';
import { legalMoves } from '../engine/index.ts';
import { pick } from './rng.ts';
import { findGameWinningMoves } from './tactics.ts';
import type { AiContext, AiPlayer } from './types.ts';

/** Exactly two rules: take a game-winning move, else uniform random. */
export function createEasyAi(): AiPlayer {
  return {
    difficulty: 'easy',
    chooseMove(state: GameState, ctx: AiContext): Promise<Move> {
      const wins = findGameWinningMoves(state);
      const move = wins.length > 0 ? pick(ctx.rng, wins) : pick(ctx.rng, legalMoves(state));
      return Promise.resolve(move);
    },
    dispose() {},
  };
}
