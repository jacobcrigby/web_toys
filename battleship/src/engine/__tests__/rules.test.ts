// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { isLegalAction, legalCells } from '../rules.ts';
import { createInitialState } from '../state.ts';
import type { GridConfig, ShipPlacement } from '../types.ts';

const G10: GridConfig = { rows: 10, cols: 10 };

function ship(
  kind: ShipPlacement['kind'],
  origin: number,
  orientation: ShipPlacement['orientation'],
): ShipPlacement {
  return { kind, origin, orientation };
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

describe('isLegalAction — classic mode', () => {
  it('allows a valid shot', () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    expect(isLegalAction(state, { kind: 'shot', cell: 99 }, 0).legal).toBe(true);
  });

  it('rejects out-of-bounds cell', () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    expect(isLegalAction(state, { kind: 'shot', cell: 100 }, 0).legal).toBe(false);
  });

  it('rejects already-targeted cell', () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('classic', G10, p0, p1);
    const state = {
      ...base,
      boards: [base.boards[0], { ...base.boards[1], shotsReceived: [99] }] as [
        import('../types.ts').PlayerBoard,
        import('../types.ts').PlayerBoard,
      ],
    };
    expect(isLegalAction(state, { kind: 'shot', cell: 99 }, 0).legal).toBe(false);
  });

  it('rejects non-shot actions', () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    expect(isLegalAction(state, { kind: 'tomahawk', center: 55 }, 0).legal).toBe(false);
  });

  it("rejects when it's not your turn", () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    expect(isLegalAction(state, { kind: 'shot', cell: 99 }, 1).legal).toBe(false);
  });
});

describe('isLegalAction — advanced mode weapons', () => {
  it('allows tomahawk when battleship afloat and ammo available', () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('advanced', G10, p0, p1);
    expect(isLegalAction(state, { kind: 'tomahawk', center: 55 }, 0).legal).toBe(true);
  });

  it('rejects tomahawk when ammo is 0', () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('advanced', G10, p0, p1);
    const state = {
      ...base,
      ammo: [{ ...base.ammo[0], tomahawk: 0 }, base.ammo[1]] as [
        import('../types.ts').Ammo,
        import('../types.ts').Ammo,
      ],
    };
    expect(isLegalAction(state, { kind: 'tomahawk', center: 55 }, 0).legal).toBe(false);
  });

  it('rejects exocet when carrier is sunk', () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('advanced', G10, p0, p1);
    // Sink p0 carrier (cells 0–4)
    const state = {
      ...base,
      boards: [{ ...base.boards[0], shotsReceived: [0, 1, 2, 3, 4] }, base.boards[1]] as [
        import('../types.ts').PlayerBoard,
        import('../types.ts').PlayerBoard,
      ],
    };
    expect(isLegalAction(state, { kind: 'exocet', center: 55, pattern: 1 }, 0).legal).toBe(false);
  });

  it('rejects recon-scan when plane not deployed', () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('advanced', G10, p0, p1);
    // plane1 is on-carrier by default
    expect(isLegalAction(state, { kind: 'recon-scan', planeId: 1, pattern: 1 }, 0).legal).toBe(
      false,
    );
  });

  it('allows recon-scan when plane is deployed', () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('advanced', G10, p0, p1);
    const state = {
      ...base,
      recon: [
        { plane1: { status: 'deployed' as const, cell: 55 }, plane2: base.recon[0].plane2 },
        base.recon[1],
      ] as [import('../types.ts').ReconState, import('../types.ts').ReconState],
    };
    expect(isLegalAction(state, { kind: 'recon-scan', planeId: 1, pattern: 1 }, 0).legal).toBe(
      true,
    );
  });
});

describe('legalCells', () => {
  it('returns all cells initially', () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    expect(legalCells(state, 0)).toHaveLength(100);
  });

  it('excludes already-targeted cells', () => {
    const { p0, p1 } = fleets();
    const base = createInitialState('classic', G10, p0, p1);
    const state = {
      ...base,
      boards: [base.boards[0], { ...base.boards[1], shotsReceived: [0, 1, 2] }] as [
        import('../types.ts').PlayerBoard,
        import('../types.ts').PlayerBoard,
      ],
    };
    const legal = legalCells(state, 0);
    expect(legal).toHaveLength(97);
    expect(legal).not.toContain(0);
    expect(legal).not.toContain(1);
    expect(legal).not.toContain(2);
  });

  it("returns empty when it's not your turn", () => {
    const { p0, p1 } = fleets();
    const state = createInitialState('classic', G10, p0, p1);
    expect(legalCells(state, 1)).toHaveLength(0);
  });
});
