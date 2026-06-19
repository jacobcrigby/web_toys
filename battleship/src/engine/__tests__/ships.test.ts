// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  isShipSunk,
  isValidPlacement,
  randomPlacement,
  SHIP_SIZES,
  shipCells,
  validateFleet,
} from '../ships.ts';
import type { GridConfig, ShipPlacement } from '../types.ts';

const G10: GridConfig = { rows: 10, cols: 10 };
const G8: GridConfig = { rows: 8, cols: 8 };

function ship(
  kind: ShipPlacement['kind'],
  origin: number,
  orientation: ShipPlacement['orientation'],
): ShipPlacement {
  return { kind, origin, orientation };
}

describe('SHIP_SIZES', () => {
  it('has correct sizes', () => {
    expect(SHIP_SIZES.carrier).toBe(5);
    expect(SHIP_SIZES.battleship).toBe(4);
    expect(SHIP_SIZES.destroyer).toBe(3);
    expect(SHIP_SIZES.submarine).toBe(3);
    expect(SHIP_SIZES.patrol).toBe(2);
  });
});

describe('shipCells', () => {
  it('returns horizontal cells', () => {
    // Carrier at A1 (cell 0) horizontal → cells 0,1,2,3,4
    expect(shipCells(ship('carrier', 0, 'h'), G10)).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns vertical cells', () => {
    // Carrier at A1 (cell 0) vertical → cells 0,10,20,30,40
    expect(shipCells(ship('carrier', 0, 'v'), G10)).toEqual([0, 10, 20, 30, 40]);
  });

  it('returns patrol boat horizontal from B3 (cell 12)', () => {
    // row 1, col 2 → cell 12; patrol horizontal → 12, 13
    expect(shipCells(ship('patrol', 12, 'h'), G10)).toEqual([12, 13]);
  });

  it('works on 8x8 grid', () => {
    // row 0, col 0, carrier vertical → 0,8,16,24,32
    expect(shipCells(ship('carrier', 0, 'v'), G8)).toEqual([0, 8, 16, 24, 32]);
  });
});

describe('isValidPlacement', () => {
  it('accepts valid placement with no existing ships', () => {
    expect(isValidPlacement([], ship('carrier', 0, 'h'), G10)).toBe(true);
  });

  it('rejects placement out of bounds (horizontal overflow)', () => {
    // Carrier H at column 7 → needs cols 7–11, only 10 cols
    expect(isValidPlacement([], ship('carrier', 7, 'h'), G10)).toBe(false);
  });

  it('rejects placement out of bounds (vertical overflow)', () => {
    // Carrier V at row 7 (cell 70) → needs rows 7–11, only 10 rows
    expect(isValidPlacement([], ship('carrier', 70, 'v'), G10)).toBe(false);
  });

  it('rejects overlapping ships', () => {
    const existing = [ship('carrier', 0, 'h')]; // occupies 0–4
    expect(isValidPlacement(existing, ship('battleship', 2, 'h'), G10)).toBe(false);
  });

  it('accepts adjacent (non-overlapping) ships', () => {
    const existing = [ship('carrier', 0, 'h')]; // occupies 0–4
    expect(isValidPlacement(existing, ship('battleship', 5, 'h'), G10)).toBe(true);
  });

  it('accepts vertical after horizontal', () => {
    const existing = [ship('carrier', 0, 'h')]; // row 0, cols 0–4
    // Battleship V at cell 10 (row 1, col 0) → rows 1–4, col 0 — no overlap
    expect(isValidPlacement(existing, ship('battleship', 10, 'v'), G10)).toBe(true);
  });
});

describe('validateFleet', () => {
  function makeFleet(_grid?: GridConfig): ShipPlacement[] {
    return [
      ship('carrier', 0, 'h'),
      ship('battleship', 10, 'h'),
      ship('destroyer', 20, 'h'),
      ship('submarine', 30, 'h'),
      ship('patrol', 40, 'h'),
    ];
  }

  it('accepts a valid fleet', () => {
    expect(validateFleet(makeFleet(G10), G10)).toBe(true);
  });

  it('rejects fleet with wrong count', () => {
    const f = makeFleet(G10).slice(0, 4);
    expect(validateFleet(f, G10)).toBe(false);
  });

  it('rejects fleet with duplicate ship kind', () => {
    const f = makeFleet(G10);
    f[4] = ship('carrier', 50, 'h'); // second carrier
    expect(validateFleet(f, G10)).toBe(false);
  });

  it('rejects fleet with overlap', () => {
    const f: ShipPlacement[] = [
      ship('carrier', 0, 'h'),
      ship('battleship', 2, 'h'), // overlaps carrier at 2,3,4
      ship('destroyer', 20, 'h'),
      ship('submarine', 30, 'h'),
      ship('patrol', 40, 'h'),
    ];
    expect(validateFleet(f, G10)).toBe(false);
  });
});

describe('isShipSunk', () => {
  it('returns false when no cells hit', () => {
    const s = ship('patrol', 0, 'h'); // cells 0, 1
    expect(isShipSunk(s, [], G10)).toBe(false);
  });

  it('returns false when partially hit', () => {
    const s = ship('patrol', 0, 'h');
    expect(isShipSunk(s, [0], G10)).toBe(false);
  });

  it('returns true when all cells hit', () => {
    const s = ship('patrol', 0, 'h');
    expect(isShipSunk(s, [0, 1], G10)).toBe(true);
  });
});

describe('randomPlacement', () => {
  it('produces a valid fleet', () => {
    let seed = 42;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0x100000000;
    };
    const fleet = randomPlacement(G10, rng);
    expect(validateFleet(fleet, G10)).toBe(true);
  });

  it('works on 8x8 grid', () => {
    let seed = 7;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      return (seed >>> 0) / 0x100000000;
    };
    const fleet = randomPlacement(G8, rng);
    expect(validateFleet(fleet, G8)).toBe(true);
  });
});
