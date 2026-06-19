// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { GridConfig, ShipPlacement } from '../../engine/index.ts';
import { createInitialState } from '../../engine/index.ts';
import { EasyAi } from '../easy.ts';

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

describe('EasyAi', () => {
  it('always picks a legal cell', async () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    const ai = new EasyAi();
    const action = await ai.chooseAction(state, 0, {
      rng: testRng,
      signal: new AbortController().signal,
    });
    expect(action.kind).toBe('shot');
    expect((action as { cell: number }).cell).toBeGreaterThanOrEqual(0);
    expect((action as { cell: number }).cell).toBeLessThan(100);
  });

  it('never fires at an already-targeted cell', async () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('classic', G10, p0, p1);
    // Pre-fill 99 of the 100 cells as already shot
    const shotCells = Array.from({ length: 99 }, (_, i) => i);
    const state = {
      ...base,
      boards: [base.boards[0], { ...base.boards[1], shotsReceived: shotCells }] as [
        import('../../engine/index.ts').PlayerBoard,
        import('../../engine/index.ts').PlayerBoard,
      ],
    };
    const ai = new EasyAi();
    let localSeed = 42;
    const rng = () => {
      localSeed = (localSeed * 1664525 + 1013904223) & 0xffffffff;
      return (localSeed >>> 0) / 0x100000000;
    };
    const action = await ai.chooseAction(state, 0, { rng, signal: new AbortController().signal });
    expect((action as { cell: number }).cell).toBe(99); // only legal cell left
  });

  it('covers all legal cells across many turns (no bias)', async () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    const ai = new EasyAi();
    const chosen = new Set<number>();
    let localSeed = 100;
    const rng = () => {
      localSeed = (localSeed * 1664525 + 1013904223) & 0xffffffff;
      return (localSeed >>> 0) / 0x100000000;
    };
    for (let i = 0; i < 2000; i++) {
      const action = await ai.chooseAction(state, 0, { rng, signal: new AbortController().signal });
      chosen.add((action as { cell: number }).cell);
    }
    // With 500 samples, expect to cover all 100 cells at least once
    expect(chosen.size).toBe(100);
  });
});
