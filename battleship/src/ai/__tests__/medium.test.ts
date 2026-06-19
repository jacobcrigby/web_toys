// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { GridConfig, PlayerBoard, ShipPlacement } from '../../engine/index.ts';
import { createInitialState } from '../../engine/index.ts';
import { MediumAi } from '../medium.ts';

const G10: GridConfig = { rows: 10, cols: 10 };

function ship(
  k: ShipPlacement['kind'],
  o: number,
  or: ShipPlacement['orientation'],
): ShipPlacement {
  return { kind: k, origin: o, orientation: or };
}

function fleets() {
  return {
    p0: [
      ship('carrier', 0, 'h'),
      ship('battleship', 10, 'h'),
      ship('destroyer', 20, 'h'),
      ship('submarine', 30, 'h'),
      ship('patrol', 40, 'h'),
    ],
    p1: [
      ship('carrier', 50, 'h'),
      ship('battleship', 60, 'h'),
      ship('destroyer', 70, 'h'),
      ship('submarine', 80, 'h'),
      ship('patrol', 90, 'h'),
    ],
  };
}

let seed = 1;
const testRng = () => {
  seed = (seed * 1664525 + 1013904223) & 0xffffffff;
  return (seed >>> 0) / 0x100000000;
};

describe('MediumAi', () => {
  it('returns a legal shot', async () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    const ai = new MediumAi();
    const action = await ai.chooseAction(state, 0, {
      rng: testRng,
      signal: new AbortController().signal,
    });
    expect(action.kind).toBe('shot');
    expect((action as { cell: number }).cell).toBeGreaterThanOrEqual(0);
    expect((action as { cell: number }).cell).toBeLessThan(100);
  });

  it('targets adjacent cell after a hit on an unsunk ship', async () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('classic', G10, p0, p1);
    // Hit cell 55 (P1 has no ship there in this fleet — use 50 which IS the carrier)
    // Actually carrier at 50–54, so hitting 50 is a hit on unsunk carrier
    const state = {
      ...base,
      boards: [base.boards[0], { ...base.boards[1], shotsReceived: [50] }] as [
        PlayerBoard,
        PlayerBoard,
      ],
    };
    const ai = new MediumAi();
    const results = new Set<number>();
    let localSeed = 7;
    for (let i = 0; i < 50; i++) {
      const rng = () => {
        localSeed = (localSeed * 1664525 + 1013904223) & 0xffffffff;
        return (localSeed >>> 0) / 0x100000000;
      };
      const action = await ai.chooseAction(state, 0, { rng, signal: new AbortController().signal });
      results.add((action as { cell: number }).cell);
    }
    // After hitting cell 50, Medium should fire at 40 (N), 60 (S), 51 (E) — not 49 (W, different row)
    // All results should be adjacent to 50
    for (const cell of results) {
      const adjacent = [40, 60, 51]; // 49 is W but wraps to prev row — invalid
      expect(adjacent).toContain(cell);
    }
  });

  it('never fires at an already-targeted cell', async () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('classic', G10, p0, p1);
    const shotCells = Array.from({ length: 99 }, (_, i) => i);
    const state = {
      ...base,
      boards: [base.boards[0], { ...base.boards[1], shotsReceived: shotCells }] as [
        PlayerBoard,
        PlayerBoard,
      ],
    };
    const ai = new MediumAi();
    let localSeed = 42;
    const rng = () => {
      localSeed = (localSeed * 1664525 + 1013904223) & 0xffffffff;
      return (localSeed >>> 0) / 0x100000000;
    };
    const action = await ai.chooseAction(state, 0, { rng, signal: new AbortController().signal });
    expect((action as { cell: number }).cell).toBe(99);
  });
});
