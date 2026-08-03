// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import {
  civilDateToDoy,
  daysInYear,
  doyToCivilDate,
  isLeapYear,
  julianDayFromCivil,
  monthStartDoys,
} from './julian.ts';

describe('julianDayFromCivil', () => {
  it('places J2000.0 at the documented Julian Day', () => {
    expect(julianDayFromCivil({ year: 2000, month: 1, day: 1 })).toBe(2451544.5);
  });

  it('advances by exactly one per day', () => {
    const a = julianDayFromCivil({ year: 2026, month: 2, day: 28 });
    const b = julianDayFromCivil({ year: 2026, month: 3, day: 1 });
    expect(b - a).toBe(1);
  });

  it('handles the leap day', () => {
    const a = julianDayFromCivil({ year: 2024, month: 2, day: 28 });
    const b = julianDayFromCivil({ year: 2024, month: 3, day: 1 });
    expect(b - a).toBe(2);
  });
});

describe('leap years', () => {
  it('applies the century rules', () => {
    expect(isLeapYear(2024)).toBe(true);
    expect(isLeapYear(2026)).toBe(false);
    expect(isLeapYear(1900)).toBe(false);
    expect(isLeapYear(2000)).toBe(true);
  });

  it('reports year length', () => {
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2024)).toBe(366);
  });
});

describe('day-of-year conversion', () => {
  it('round-trips every day of a common year', () => {
    for (let doy = 0; doy < 365; doy += 1) {
      expect(civilDateToDoy(doyToCivilDate(2026, doy))).toBe(doy);
    }
  });

  it('round-trips every day of a leap year', () => {
    for (let doy = 0; doy < 366; doy += 1) {
      expect(civilDateToDoy(doyToCivilDate(2024, doy))).toBe(doy);
    }
  });

  it('maps the boundaries of a common year', () => {
    expect(doyToCivilDate(2026, 0)).toEqual({ year: 2026, month: 1, day: 1 });
    expect(doyToCivilDate(2026, 364)).toEqual({ year: 2026, month: 12, day: 31 });
  });

  it('places the leap day', () => {
    expect(doyToCivilDate(2024, 59)).toEqual({ year: 2024, month: 2, day: 29 });
    expect(doyToCivilDate(2026, 59)).toEqual({ year: 2026, month: 3, day: 1 });
  });

  it('rejects an out-of-range day', () => {
    expect(() => doyToCivilDate(2026, 365)).toThrow(RangeError);
  });
});

describe('monthStartDoys', () => {
  it('starts each month where the previous one ended', () => {
    expect(monthStartDoys(2026)).toEqual([0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]);
  });

  it('shifts by one after February in a leap year', () => {
    expect(monthStartDoys(2024)).toEqual([0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335]);
  });
});
