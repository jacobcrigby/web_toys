import type { GameState, GridIndex, Move, Player } from '../engine/index.ts';
import { applyMove, LINES, legalMoves } from '../engine/index.ts';
import type { Rng } from './rng.ts';
import { pick, shuffle } from './rng.ts';
import { wouldWinBoard, wouldWinGame } from './tactics.ts';
import type { AiContext, AiPlayer } from './types.ts';

const DEPTH = 3;
const WIN_SCORE = 10_000;
const MAX_NODES = 50_000;
// center board 1.4, corners 1.2, edges 1.0
const POSITION_WEIGHT = [1.2, 1.0, 1.2, 1.0, 1.4, 1.0, 1.2, 1.0, 1.2] as const;

function opponent(p: Player): Player {
  return p === 'X' ? 'O' : 'X';
}

/** Can `player` win small board `board` with a single move right now? */
function boardWinnableNow(state: GameState, board: GridIndex, player: Player): boolean {
  const base = board * 9;
  for (const line of LINES) {
    let mine = 0;
    let empty = 0;
    for (const i of line) {
      const v = state.cells[base + i];
      if (v === player) {
        mine++;
      } else if (v === null || v === undefined) {
        empty++;
      }
    }
    if (mine === 2 && empty === 1) {
      return true;
    }
  }
  return false;
}

function termsFor(state: GameState, p: Player): number {
  let score = 0;
  for (let b = 0; b < 9; b++) {
    const status = state.boardStatus[b];
    if (status === p) {
      score += 100 * (POSITION_WEIGHT[b] ?? 1);
    } else if (status === 'open') {
      // local threats: 2-in-a-row + empty third cell, +5 each
      const base = b * 9;
      for (const line of LINES) {
        let mine = 0;
        let empty = 0;
        for (const i of line) {
          const v = state.cells[base + i];
          if (v === p) {
            mine++;
          } else if (v === null || v === undefined) {
            empty++;
          }
        }
        if (mine === 2 && empty === 1) {
          score += 5;
        }
      }
      if (state.cells[base + 4] === p) {
        score += 3; // center cell in an open board
      }
    }
  }
  // macro threats: 2 of my boards on a line, third open, +200 each
  for (const line of LINES) {
    let mine = 0;
    let open = 0;
    for (const b of line) {
      const status = state.boardStatus[b];
      if (status === p) {
        mine++;
      } else if (status === 'open') {
        open++;
      }
    }
    if (mine === 2 && open === 1) {
      score += 200;
    }
  }
  return score;
}

/** Heuristic leaf eval from `me`'s perspective. */
export function evaluate(state: GameState, me: Player): number {
  let score = termsFor(state, me) - termsFor(state, opponent(me));
  if (state.status.kind === 'playing') {
    let sideToMove = 0;
    if (state.forcedBoard === null) {
      sideToMove += 15; // free board choice
    } else if (boardWinnableNow(state, state.forcedBoard, state.currentPlayer)) {
      sideToMove += 10; // forced into a board they can win right now
    }
    score += state.currentPlayer === me ? sideToMove : -sideToMove;
  }
  return score;
}

/** Ordering: game-winning, small-board-winning, center cell, rest shuffled. */
function orderedMoves(state: GameState, rng: Rng): Move[] {
  const gameWins: Move[] = [];
  const smallWins: Move[] = [];
  const centers: Move[] = [];
  const rest: Move[] = [];
  for (const move of legalMoves(state)) {
    if (wouldWinGame(state, move)) {
      gameWins.push(move);
    } else if (wouldWinBoard(state, move)) {
      smallWins.push(move);
    } else if (move.cell === 4) {
      centers.push(move);
    } else {
      rest.push(move);
    }
  }
  shuffle(rng, rest);
  return [...gameWins, ...smallWins, ...centers, ...rest];
}

interface SearchCtx {
  nodes: number;
  rng: Rng;
}

/**
 * Negamax with alpha-beta. All scores are from the perspective of the side to
 * move at the node. A 'won' node is always a LOSS for the side to move (the
 * winner is the previous mover): -(WIN_SCORE - plyFromRoot).
 */
function negamax(
  state: GameState,
  depth: number,
  ply: number,
  alphaIn: number,
  beta: number,
  ctx: SearchCtx,
): number {
  ctx.nodes++;
  if (state.status.kind === 'won') {
    return -(WIN_SCORE - ply);
  }
  if (state.status.kind === 'drawn') {
    return 0;
  }
  if (depth === 0) {
    return evaluate(state, state.currentPlayer);
  }
  let alpha = alphaIn;
  let best = Number.NEGATIVE_INFINITY;
  for (const move of orderedMoves(state, ctx.rng)) {
    if (ctx.nodes >= MAX_NODES) {
      break; // safety cap: return best-so-far
    }
    const score = -negamax(applyMove(state, move), depth - 1, ply + 1, -beta, -alpha, ctx);
    if (score > best) {
      best = score;
    }
    if (best > alpha) {
      alpha = best;
    }
    if (alpha >= beta) {
      break;
    }
  }
  return best === Number.NEGATIVE_INFINITY ? evaluate(state, state.currentPlayer) : best;
}

export function createMediumAi(): AiPlayer {
  return {
    difficulty: 'medium',
    chooseMove(state: GameState, aiCtx: AiContext): Promise<Move> {
      const ctx: SearchCtx = { nodes: 0, rng: aiCtx.rng };
      let alpha = Number.NEGATIVE_INFINITY;
      let best: Move[] = [];
      for (const move of orderedMoves(state, ctx.rng)) {
        if (ctx.nodes >= MAX_NODES && best.length > 0) {
          break;
        }
        const score = -negamax(
          applyMove(state, move),
          DEPTH - 1,
          1,
          Number.NEGATIVE_INFINITY,
          -alpha,
          ctx,
        );
        if (score > alpha || best.length === 0) {
          alpha = score;
          best = [move];
        } else if (score === alpha) {
          best.push(move); // root ties broken via rng below
        }
      }
      return Promise.resolve(pick(ctx.rng, best));
    },
    dispose() {},
  };
}
