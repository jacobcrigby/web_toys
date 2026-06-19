// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createInitialState } from '../state.ts';
import type { GridConfig, ShipPlacement } from '../types.ts';
import { resolveAction } from '../weapons.ts';

const G10: GridConfig = { rows: 10, cols: 10 };

function ship(
  kind: ShipPlacement['kind'],
  origin: number,
  orientation: ShipPlacement['orientation'],
): ShipPlacement {
  return { kind, origin, orientation };
}

// Isolated target fleet for P1: a single ship at known locations
function simpleFleets() {
  const p0: ShipPlacement[] = [
    ship('carrier', 0, 'h'),
    ship('battleship', 10, 'h'),
    ship('destroyer', 20, 'h'),
    ship('submarine', 30, 'h'),
    ship('patrol', 40, 'h'),
  ];
  const p1: ShipPlacement[] = [
    ship('carrier', 55, 'h'), // row 5: cells 55–59
    ship('battleship', 60, 'h'), // row 6: cells 60–63
    ship('destroyer', 70, 'h'), // row 7: cells 70–72
    ship('submarine', 80, 'h'), // row 8: cells 80–82
    ship('patrol', 90, 'h'), // row 9: cells 90–91
  ];
  return { p0, p1 };
}

describe('resolveAction — shot', () => {
  it('reports a miss on empty cell', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('classic', G10, p0, p1);
    const result = resolveAction(state, { kind: 'shot', cell: 99 });
    expect(result.cellsAttacked).toEqual([99]);
    expect(result.cellsHit).toEqual([]);
    expect(result.shipsSunk).toEqual([]);
  });

  it('reports a hit', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('classic', G10, p0, p1);
    const result = resolveAction(state, { kind: 'shot', cell: 55 }); // carrier
    expect(result.cellsHit).toContain(55);
    expect(result.shipsSunk).toEqual([]);
  });

  it('reports a sunk patrol boat', () => {
    const { p0, p1 } = simpleFleets();
    let state = createInitialState('advanced', G10, p0, p1);
    // Pre-hit cell 90 for p1 patrol (cells 90–91)
    state = { ...state, boards: [state.boards[0], { ...state.boards[1], shotsReceived: [90] }] };
    const result = resolveAction(state, { kind: 'shot', cell: 91 });
    expect(result.shipsSunk).toContain('patrol');
  });
});

describe('resolveAction — tomahawk (3×3)', () => {
  it('hits all cells in 3x3 area including ships', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    // Tomahawk at center 56 (row 5, col 6) → 3x3: row 4–6, col 5–7
    const result = resolveAction(state, { kind: 'tomahawk', center: 56 });
    expect(result.cellsAttacked).toHaveLength(9);
    // P1 carrier occupies 55–59; cells 55,56,57 should be in the 3x3
    expect(result.cellsHit).toContain(55);
    expect(result.cellsHit).toContain(56);
    expect(result.cellsHit).toContain(57);
  });

  it('clips to grid edge', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    const result = resolveAction(state, { kind: 'tomahawk', center: 0 }); // top-left corner
    expect(result.cellsAttacked).toHaveLength(4); // only 2x2 in-bounds
  });
});

describe('resolveAction — exocet', () => {
  it('pattern 1 (plus) hits 5 cells', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    const result = resolveAction(state, { kind: 'exocet', center: 55, pattern: 1 });
    // Plus: 55, 45, 65, 54, 56
    expect(result.cellsAttacked).toHaveLength(5);
    expect(result.cellsAttacked).toContain(55);
    expect(result.cellsAttacked).toContain(45); // N
    expect(result.cellsAttacked).toContain(65); // S
    expect(result.cellsAttacked).toContain(54); // W
    expect(result.cellsAttacked).toContain(56); // E
  });

  it('pattern 2 (X) hits diagonal cells', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    const result = resolveAction(state, { kind: 'exocet', center: 55, pattern: 2 });
    // X: 55, 44, 46, 64, 66
    expect(result.cellsAttacked).toContain(44); // NW
    expect(result.cellsAttacked).toContain(46); // NE
    expect(result.cellsAttacked).toContain(64); // SW
    expect(result.cellsAttacked).toContain(66); // SE
  });
});

describe('resolveAction — apache', () => {
  it('pattern 1 (vertical) hits 3 cells', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    const result = resolveAction(state, { kind: 'apache', center: 56, pattern: 1 });
    expect(result.cellsAttacked).toEqual([46, 56, 66]);
  });

  it('pattern 2 (horizontal) hits 3 cells', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    const result = resolveAction(state, { kind: 'apache', center: 56, pattern: 2 });
    expect(result.cellsAttacked).toEqual([55, 56, 57]);
  });
});

describe('resolveAction — torpedo', () => {
  it('horizontal: travels full row when no ships', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    // Row 4 (cells 40–49) — p1 has no ships in row 4
    const result = resolveAction(state, { kind: 'torpedo', startCell: 40, dir: 'h' });
    expect(result.cellsAttacked).toHaveLength(10);
    expect(result.cellsHit).toEqual([]);
  });

  it('horizontal: stops after first hit', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    // Row 5 (cells 50–59): carrier at 55–59
    const result = resolveAction(state, { kind: 'torpedo', startCell: 50, dir: 'h' });
    // Should stop at cell 55 (first carrier cell)
    expect(result.cellsAttacked).toEqual([50, 51, 52, 53, 54, 55]);
    expect(result.cellsHit).toContain(55);
  });

  it('vertical: traverses full column when no ships present', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    // Column 4 (startCell=4): P1 has no ships in col 4 — should traverse all 10 rows
    // P1 ships: carrier cols 5–9, battleship/destroyer/sub/patrol start at cols 0–3
    const result = resolveAction(state, { kind: 'torpedo', startCell: 4, dir: 'v' });
    expect(result.cellsAttacked).toHaveLength(10);
    expect(result.cellsHit).toEqual([]);
  });
});

describe('resolveAction — sonar', () => {
  it('detects enemy ships in 3x3 area', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    // Center 55 → 3x3 covers 44–46, 54–56, 64–66; carrier at 55 is in range
    const result = resolveAction(state, { kind: 'sonar', center: 55 });
    expect(result.sonarDetected).toBe(true);
    expect(result.cellsHit).toEqual([]); // sonar doesn't hit
  });

  it('returns clear when no ships in area', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    // Center 5 (row 0, col 5) → 3x3: 0–6 area; p1 has no ships in rows 0–1
    const result = resolveAction(state, { kind: 'sonar', center: 5 });
    expect(result.sonarDetected).toBe(false);
  });
});

describe('resolveAction — recon plane', () => {
  it('recon-move returns no attacks', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    const result = resolveAction(state, { kind: 'recon-move', planeId: 1, cell: 55 });
    expect(result.cellsAttacked).toEqual([]);
    expect(result.cellsHit).toEqual([]);
  });

  it('recon-scan reveals ship presence', () => {
    const { p0, p1 } = simpleFleets();
    const baseState = createInitialState('advanced', G10, p0, p1);
    // Move plane 1 to cell 56 first
    const state = {
      ...baseState,
      recon: [
        { plane1: { status: 'deployed' as const, cell: 56 }, plane2: baseState.recon[0].plane2 },
        baseState.recon[1],
      ] as [import('../types.ts').ReconState, import('../types.ts').ReconState],
    };
    // Pattern 1 scan from 56: N=46, W=55, E=57, S=66
    const result = resolveAction(state, { kind: 'recon-scan', planeId: 1, pattern: 1 });
    expect(result.reconFindings).toBeDefined();
    const findings = result.reconFindings ?? [];
    // Cell 55 should be a hit (carrier at 55–59)
    const f55 = findings.find((f) => f.cell === 55);
    expect(f55?.hit).toBe(true);
    // Cell 46 should be a miss (no ship in row 4)
    const f46 = findings.find((f) => f.cell === 46);
    expect(f46?.hit).toBe(false);
  });
});

describe('resolveAction — anti-aircraft', () => {
  it('destroys an enemy plane at the targeted cell', () => {
    const { p0, p1 } = simpleFleets();
    const baseState = createInitialState('advanced', G10, p0, p1);
    // P1 has a recon plane deployed at cell 5 on P0's grid
    // P0's recon: planes on carrier; P1's recon: plane1 deployed at 5
    const state = {
      ...baseState,
      recon: [
        baseState.recon[0], // P0's own planes
        { plane1: { status: 'deployed' as const, cell: 5 }, plane2: baseState.recon[1].plane2 },
      ] as [import('../types.ts').ReconState, import('../types.ts').ReconState],
    };
    // P0 fires anti-aircraft at cell 5 on their own grid
    const result = resolveAction(state, { kind: 'anti-aircraft', cell: 5 });
    expect(result.planesDestroyed).toContain(1);
  });

  it('misses when no plane at cell', () => {
    const { p0, p1 } = simpleFleets();
    const state = createInitialState('advanced', G10, p0, p1);
    const result = resolveAction(state, { kind: 'anti-aircraft', cell: 5 });
    expect(result.planesDestroyed).toBeUndefined();
  });
});

describe('planes destroyed when carrier sinks', () => {
  it('destroys on-carrier planes when carrier is sunk', () => {
    const { p0, p1 } = simpleFleets();
    const baseState = createInitialState('advanced', G10, p0, p1);
    // Pre-hit all carrier cells except last (55–59, hit 55–58 already)
    const preHit = [55, 56, 57, 58];
    const state = {
      ...baseState,
      boards: [baseState.boards[0], { ...baseState.boards[1], shotsReceived: preHit }] as [
        import('../types.ts').PlayerBoard,
        import('../types.ts').PlayerBoard,
      ],
    };
    // Final hit sinks the carrier
    const result = resolveAction(state, { kind: 'shot', cell: 59 });
    expect(result.shipsSunk).toContain('carrier');
    // Both planes are on-carrier (initial state) → both destroyed
    expect(result.planesDestroyed).toContain(1);
    expect(result.planesDestroyed).toContain(2);
  });
});
