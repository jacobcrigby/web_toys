// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { STANDARD_ZENITH_DEGREES } from './events.ts';
import { julianDayFromCivil } from './julian.ts';
import { hourAngleDegrees, solarPosition } from './position.ts';

/** Julian Day at 12:00 UT on a civil date. */
function noonJd(year: number, month: number, day: number): number {
  return julianDayFromCivil({ year, month, day }) + 0.5;
}

describe('solarPosition declination', () => {
  it('reaches the obliquity of the ecliptic at the solstices', () => {
    expect(solarPosition(noonJd(2026, 6, 21)).declinationDegrees).toBeCloseTo(23.438, 2);
    expect(solarPosition(noonJd(2026, 12, 21)).declinationDegrees).toBeCloseTo(-23.437, 2);
  });

  it('passes through zero at the equinoxes', () => {
    expect(solarPosition(noonJd(2026, 3, 20)).declinationDegrees).toBeCloseTo(-0.043, 1);
    expect(solarPosition(noonJd(2026, 9, 22)).declinationDegrees).toBeCloseTo(0.197, 1);
  });

  it('stays inside the obliquity envelope all year', () => {
    for (let doy = 0; doy < 365; doy += 1) {
      const { declinationDegrees } = solarPosition(noonJd(2026, 1, 1) + doy);
      expect(Math.abs(declinationDegrees)).toBeLessThan(23.5);
    }
  });
});

describe('solarPosition equation of time', () => {
  it('finds the annual minimum in mid-February', () => {
    let min = Number.POSITIVE_INFINITY;
    let minDoy = -1;
    for (let doy = 0; doy < 365; doy += 1) {
      const { equationOfTimeMinutes } = solarPosition(noonJd(2026, 1, 1) + doy);
      if (equationOfTimeMinutes < min) {
        min = equationOfTimeMinutes;
        minDoy = doy;
      }
    }
    expect(min).toBeCloseTo(-14.23, 1);
    // 2026-02-11 is day-of-year index 41.
    expect(minDoy).toBe(41);
  });

  it('finds the annual maximum in early November', () => {
    let max = Number.NEGATIVE_INFINITY;
    let maxDoy = -1;
    for (let doy = 0; doy < 365; doy += 1) {
      const { equationOfTimeMinutes } = solarPosition(noonJd(2026, 1, 1) + doy);
      if (equationOfTimeMinutes > max) {
        max = equationOfTimeMinutes;
        maxDoy = doy;
      }
    }
    expect(max).toBeCloseTo(16.49, 1);
    // 2026-11-03 is day-of-year index 306.
    expect(maxDoy).toBe(306);
  });
});

describe('hourAngleDegrees', () => {
  it('returns null during polar night', () => {
    expect(hourAngleDegrees(80, -23.44, STANDARD_ZENITH_DEGREES)).toBeNull();
  });

  it('returns null during polar day', () => {
    expect(hourAngleDegrees(80, 23.44, STANDARD_ZENITH_DEGREES)).toBeNull();
  });

  it('is just over 90 degrees at the equator, where refraction lengthens the day', () => {
    const hourAngle = hourAngleDegrees(0, 0, STANDARD_ZENITH_DEGREES);
    expect(hourAngle).not.toBeNull();
    expect(hourAngle as number).toBeGreaterThan(90);
    expect(hourAngle as number).toBeLessThan(91);
  });

  it('grows with latitude at the northern summer solstice', () => {
    const declination = 23.44;
    let previous = 0;
    for (const latitude of [25, 30, 35, 40, 45, 49]) {
      const hourAngle = hourAngleDegrees(latitude, declination, STANDARD_ZENITH_DEGREES);
      expect(hourAngle).not.toBeNull();
      expect(hourAngle as number).toBeGreaterThan(previous);
      previous = hourAngle as number;
    }
  });
});
