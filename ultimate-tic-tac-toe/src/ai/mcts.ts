import type { GameState, Move, Player } from '../engine/index.ts';
import { applyMoveInPlace, cloneState, legalMoves } from '../engine/index.ts';
import type { Rng } from './rng.ts';
import { pick, shuffle } from './rng.ts';
import { wouldWinGame } from './tactics.ts';

export interface MctsOptions {
  rng: Rng;
  maxIterations: number;
  explorationC?: number; // default Math.SQRT2
}

export interface MctsSearch {
  run(n: number): void; // resumable: perform up to n iterations
  iterations: number;
  best(): { move: Move; iterations: number; winRate: number };
}

interface Node {
  move: Move | null;
  player: Player; // who played `move`
  parent: Node | null;
  children: Node[];
  untried: Move[]; // rng-shuffled
  visits: number;
  wins: number; // from `player`'s perspective; draw = 0.5
}

/**
 * UCT MCTS. No state per node — each iteration clones the root state once and
 * descends with applyMoveInPlace on the private clone.
 */
export function createMctsSearch(rootState: GameState, opts: MctsOptions): MctsSearch {
  const C = opts.explorationC ?? Math.SQRT2;
  const rng = opts.rng;
  const root: Node = {
    move: null,
    player: rootState.currentPlayer === 'X' ? 'O' : 'X',
    parent: null,
    children: [],
    untried: shuffle(rng, legalMoves(rootState)),
    visits: 0,
    wins: 0,
  };

  function selectChild(node: Node): Node {
    let bestScore = Number.NEGATIVE_INFINITY;
    let best = node.children[0] as Node;
    const logParent = Math.log(node.visits);
    for (const child of node.children) {
      const score = child.wins / child.visits + C * Math.sqrt(logParent / child.visits);
      if (score > bestScore) {
        bestScore = score;
        best = child;
      }
    }
    return best;
  }

  function iterate(): void {
    const state = cloneState(rootState);
    let node = root;

    // Selection: descend while fully expanded.
    while (node.untried.length === 0 && node.children.length > 0) {
      node = selectChild(node);
      if (node.move) {
        applyMoveInPlace(state, node.move);
      }
    }

    // Expansion: pop one untried move.
    if (node.untried.length > 0 && state.status.kind === 'playing') {
      const move = node.untried.pop() as Move;
      const mover = state.currentPlayer;
      applyMoveInPlace(state, move);
      const child: Node = {
        move,
        player: mover,
        parent: node,
        children: [],
        untried: state.status.kind === 'playing' ? shuffle(rng, legalMoves(state)) : [],
        visits: 0,
        wins: 0,
      };
      node.children.push(child);
      node = child;
    }

    // Playout: take an immediate game-winning move if one exists, else random.
    while (state.status.kind === 'playing') {
      const moves = legalMoves(state);
      let move: Move | null = null;
      for (const m of moves) {
        if (wouldWinGame(state, m)) {
          move = m;
          break;
        }
      }
      applyMoveInPlace(state, move ?? pick(rng, moves));
    }

    // Backprop.
    const status = state.status;
    let n: Node | null = node;
    while (n) {
      n.visits++;
      if (status.kind === 'won') {
        n.wins += status.winner === n.player ? 1 : 0;
      } else {
        n.wins += 0.5;
      }
      n = n.parent;
    }
  }

  const search: MctsSearch = {
    iterations: 0,
    run(n: number): void {
      const target = Math.min(search.iterations + n, opts.maxIterations);
      while (search.iterations < target) {
        if (root.untried.length === 0 && root.children.length === 0) {
          return; // terminal root: nothing to search
        }
        iterate();
        search.iterations++;
      }
    },
    best(): { move: Move; iterations: number; winRate: number } {
      let candidates: Node[] = [];
      let maxVisits = -1;
      for (const child of root.children) {
        if (child.visits > maxVisits) {
          maxVisits = child.visits;
          candidates = [child];
        } else if (child.visits === maxVisits) {
          candidates.push(child);
        }
      }
      // ties: higher win rate, then rng
      let bestRate = Number.NEGATIVE_INFINITY;
      let top: Node[] = [];
      for (const child of candidates) {
        const rate = child.wins / child.visits;
        if (rate > bestRate) {
          bestRate = rate;
          top = [child];
        } else if (rate === bestRate) {
          top.push(child);
        }
      }
      const chosen = pick(rng, top);
      return {
        move: chosen.move as Move,
        iterations: search.iterations,
        winRate: chosen.wins / chosen.visits,
      };
    },
  };
  return search;
}
