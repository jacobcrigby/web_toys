// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { applyAction, createInitialState, IllegalActionError } from '../state.ts';
import type { GridConfig, ShipPlacement } from '../types.ts';

const G10: GridConfig = { rows: 10, cols: 10 };

function ship(
  kind: ShipPlacement['kind'],
  origin: number,
  orientation: ShipPlacement['orientation'],
): ShipPlacement {
  return { kind, origin, orientation };
}

// Minimal valid fleet: no overlaps, fits in 10x10
function fleet0(): ShipPlacement[] {
  return [
    ship('carrier', 0, 'h'), // row 0: 0–4
    ship('battleship', 10, 'h'), // row 1: 10–13
    ship('destroyer', 20, 'h'), // row 2: 20–22
    ship('submarine', 30, 'h'), // row 3: 30–32
    ship('patrol', 40, 'h'), // row 4: 40–41
  ];
}

function fleet1(): ShipPlacement[] {
  return [
    ship('carrier', 50, 'h'), // row 5: 50–54
    ship('battleship', 60, 'h'), // row 6: 60–63
    ship('destroyer', 70, 'h'), // row 7: 70–72
    ship('submarine', 80, 'h'), // row 8: 80–82
    ship('patrol', 90, 'h'), // row 9: 90–91
  ];
}

describe('createInitialState', () => {
  it('creates a valid initial state', () => {
    const state = createInitialState('classic', G10, fleet0(), fleet1());
    expect(state.phase).toBe('battle');
    expect(state.currentPlayer).toBe(0);
    expect(state.winner).toBeNull();
    expect(state.actionCount).toBe(0);
    expect(state.boards[0].shotsReceived).toEqual([]);
    expect(state.boards[1].shotsReceived).toEqual([]);
  });

  it('is JSON-plain (survives round-trip)', () => {
    const state = createInitialState('classic', G10, fleet0(), fleet1());
    const rt = JSON.parse(JSON.stringify(state)) as typeof state;
    expect(rt).toEqual(state);
  });

  it('classic mode sets ammo to zero', () => {
    const state = createInitialState('classic', G10, fleet0(), fleet1());
    expect(state.ammo[0].exocet).toBe(0);
    expect(state.ammo[1].exocet).toBe(0);
  });

  it('advanced mode sets full ammo', () => {
    const state = createInitialState('advanced', G10, fleet0(), fleet1());
    expect(state.ammo[0].exocet).toBe(2);
    expect(state.ammo[0].tomahawk).toBe(1);
    expect(state.ammo[0].apache).toBe(2);
    expect(state.ammo[0].torpedo).toBe(2);
  });
});

describe('applyAction — classic shot', () => {
  it('records a miss', () => {
    const state = createInitialState('classic', G10, fleet0(), fleet1());
    const next = applyAction(state, { kind: 'shot', cell: 99 }); // row 9 col 9 — no ship
    expect(next.boards[1].shotsReceived).toContain(99);
    expect(next.currentPlayer).toBe(1); // turn passes
    expect(next.winner).toBeNull();
  });

  it('records a hit', () => {
    const state = createInitialState('classic', G10, fleet0(), fleet1());
    const next = applyAction(state, { kind: 'shot', cell: 50 }); // carrier row 5
    expect(next.boards[1].shotsReceived).toContain(50);
    expect(next.winner).toBeNull();
  });

  it('sinks a patrol boat and records the win', () => {
    let state = createInitialState('classic', G10, fleet0(), fleet1());
    // Sink player 1's patrol boat (cells 90, 91)
    state = applyAction(state, { kind: 'shot', cell: 90 }); // p0 shoots
    state = applyAction(state, { kind: 'shot', cell: 0 }); // p1 shoots back

    // Now sink all of p1's ships step by step
    // carrier: 50–54, battleship: 60–63, destroyer: 70–72, submarine: 80–82, patrol: 90–91
    const p1ShipCells = [50, 51, 52, 53, 54, 60, 61, 62, 63, 70, 71, 72, 80, 81, 82, 91];

    for (const cell of p1ShipCells) {
      expect(state.currentPlayer).toBe(0);
      state = applyAction(state, { kind: 'shot', cell });
      if (state.winner === null) {
        // p1 shoots somewhere safe
        const tried = new Set(state.boards[0].shotsReceived);
        const safe =
          Array.from({ length: 100 }, (_, i) => i).find((c) => !tried.has(c) && c >= 50) ?? 99;
        state = applyAction(state, { kind: 'shot', cell: safe });
      }
    }

    expect(state.winner).toBe(0);
    expect(state.phase).toBe('over');
  });

  it('increments actionCount', () => {
    const state = createInitialState('classic', G10, fleet0(), fleet1());
    const next = applyAction(state, { kind: 'shot', cell: 99 });
    expect(next.actionCount).toBe(1);
  });

  it('throws IllegalActionError when game is over', () => {
    const state = createInitialState('classic', G10, fleet0(), fleet1());
    // Sink all p1 ships directly (skip alternating — just apply p0 shots only, ignoring turn rule for test setup)
    // Instead, use a state with phase:'over' directly
    const overState = { ...state, phase: 'over' as const, winner: 0 as const };
    expect(() => applyAction(overState, { kind: 'shot', cell: 0 })).toThrow(IllegalActionError);
  });

  it('is immutable — original state unchanged', () => {
    const state = createInitialState('classic', G10, fleet0(), fleet1());
    const before = JSON.stringify(state);
    applyAction(state, { kind: 'shot', cell: 50 });
    expect(JSON.stringify(state)).toBe(before);
  });

  it('initial board has empty revealed array', () => {
    const state = createInitialState('advanced', G10, fleet0(), fleet1());
    expect(state.boards[0].revealed).toEqual([]);
    expect(state.boards[1].revealed).toEqual([]);
  });
});

describe('applyAction — sonar does not damage', () => {
  it('sonar does not add cells to shotsReceived', () => {
    const state = createInitialState('advanced', G10, fleet0(), fleet1());
    const next = applyAction(state, { kind: 'sonar', center: 55 }); // center on p1 carrier
    expect(next.boards[1].shotsReceived).toEqual([]);
  });

  it('sonar cannot sink a ship', () => {
    const state = createInitialState('advanced', G10, fleet0(), fleet1());
    // Sonar at carrier center — should NOT sink it
    const next = applyAction(state, { kind: 'sonar', center: 52 }); // p1 carrier 50–54
    expect(next.phase).toBe('battle');
    expect(next.winner).toBeNull();
  });
});

describe('applyAction — recon-scan stores to revealed, not shotsReceived', () => {
  it('recon-scan adds to revealed but not shotsReceived', () => {
    const state = createInitialState('advanced', G10, fleet0(), fleet1());
    // Deploy plane 1 to cell 56 on p1's grid
    const withPlane = {
      ...state,
      recon: [
        { plane1: { status: 'deployed' as const, cell: 56 }, plane2: state.recon[0].plane2 },
        state.recon[1],
      ] as [import('../types.ts').ReconState, import('../types.ts').ReconState],
    };
    const next = applyAction(withPlane, { kind: 'recon-scan', planeId: 1, pattern: 1 });
    // shotsReceived must remain empty — no damage
    expect(next.boards[1].shotsReceived).toEqual([]);
    // revealed must contain the scan cells
    expect(next.boards[1].revealed.length).toBeGreaterThan(0);
  });

  it('recon-scan cannot win the game', () => {
    // Place all of p1's ships under the scan area so a naive implementation would sink them
    const p0 = fleet0();
    const p1Small: import('../types.ts').ShipPlacement[] = [
      ship('carrier', 55, 'h'), // 55–59
      ship('battleship', 60, 'h'), // 60–63
      ship('destroyer', 70, 'h'), // 70–72
      ship('submarine', 80, 'h'), // 80–82
      ship('patrol', 90, 'h'), // 90–91
    ];
    const state = createInitialState('advanced', G10, p0, p1Small);
    // Deploy plane to cell 56 and scan around it
    const withPlane = {
      ...state,
      recon: [
        { plane1: { status: 'deployed' as const, cell: 56 }, plane2: state.recon[0].plane2 },
        state.recon[1],
      ] as [import('../types.ts').ReconState, import('../types.ts').ReconState],
    };
    const next = applyAction(withPlane, { kind: 'recon-scan', planeId: 1, pattern: 1 });
    expect(next.phase).toBe('battle');
    expect(next.winner).toBeNull();
  });
});
