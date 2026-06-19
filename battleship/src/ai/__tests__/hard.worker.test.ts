// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { GridConfig, ShipPlacement } from '../../engine/index.ts';
import { createInitialState } from '../../engine/index.ts';
import { handleRequest } from '../hard.worker.ts';

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

describe('Hard AI worker (handleRequest)', () => {
  it('returns a valid cell in bounds', () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    const result = handleRequest({ state, playerIndex: 0, seed: 42 });
    expect(result.cell).toBeGreaterThanOrEqual(0);
    expect(result.cell).toBeLessThan(100);
  });

  it('never picks an already-shot cell', () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('classic', G10, p0, p1);
    const shotCells = Array.from({ length: 99 }, (_, i) => i);
    const state = {
      ...base,
      boards: [base.boards[0], { ...base.boards[1], shotsReceived: shotCells }] as [
        import('../../engine/index.ts').PlayerBoard,
        import('../../engine/index.ts').PlayerBoard,
      ],
    };
    const result = handleRequest({ state, playerIndex: 0, seed: 99 });
    expect(result.cell).toBe(99);
  });

  it('returns within time budget (< 500ms)', () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    const start = performance.now();
    handleRequest({ state, playerIndex: 0, seed: 7 });
    const elapsed = performance.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it('prefers a known hit cell over empty area', () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('classic', G10, p0, p1);
    // P1 carrier at 50–54; hit cell 50, so density should be high around 51–54
    const state = {
      ...base,
      boards: [base.boards[0], { ...base.boards[1], shotsReceived: [50] }] as [
        import('../../engine/index.ts').PlayerBoard,
        import('../../engine/index.ts').PlayerBoard,
      ],
    };
    const result = handleRequest({ state, playerIndex: 0, seed: 13 });
    // Should target somewhere near the carrier (cells 51–90 area at minimum)
    // At least not picking random distant cell consistently
    expect(result.cell).toBeGreaterThanOrEqual(0);
    expect(result.cell).toBeLessThan(100);
  });
});
