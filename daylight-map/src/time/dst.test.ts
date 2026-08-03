// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { civilDateToDoy, doyToCivilDate, sunEventsUtc } from '../solar/index.ts';
import { isDstDay, nthWeekdayOfMonth, usDstWindow } from './dst.ts';

describe('nthWeekdayOfMonth', () => {
  it('finds the second Sunday in March 2026', () => {
    expect(nthWeekdayOfMonth(2026, 3, 0, 2)).toBe(8);
  });

  it('finds the first Sunday in November 2026', () => {
    expect(nthWeekdayOfMonth(2026, 11, 0, 1)).toBe(1);
  });

  it('handles a month starting on the target weekday', () => {
    // 2026-03-01 is a Sunday, so the first Sunday is the 1st.
    expect(nthWeekdayOfMonth(2026, 3, 0, 1)).toBe(1);
  });

  it('agrees with the platform date for a spread of years', () => {
    for (const year of [2024, 2025, 2026, 2027, 2028, 2030]) {
      for (const [month, n] of [
        [3, 2],
        [11, 1],
      ] as const) {
        const day = nthWeekdayOfMonth(year, month, 0, n);
        expect(new Date(Date.UTC(year, month - 1, day)).getUTCDay()).toBe(0);
        // Confirm it really is the nth, not merely some Sunday.
        expect(day).toBeGreaterThan((n - 1) * 7);
        expect(day).toBeLessThanOrEqual(n * 7);
      }
    }
  });
});

describe('usDstWindow', () => {
  it('spans the second Sunday in March to the first Sunday in November 2026', () => {
    const window = usDstWindow(2026);
    expect(doyToCivilDate(2026, window.startDoy)).toEqual({ year: 2026, month: 3, day: 8 });
    expect(doyToCivilDate(2026, window.endDoy)).toEqual({ year: 2026, month: 11, day: 1 });
  });

  it('treats the March transition day as daylight time and the November one as standard', () => {
    const window = usDstWindow(2026);
    expect(isDstDay(window.startDoy, window)).toBe(true);
    expect(isDstDay(window.startDoy - 1, window)).toBe(false);
    expect(isDstDay(window.endDoy, window)).toBe(false);
    expect(isDstDay(window.endDoy - 1, window)).toBe(true);
  });

  it('handles a leap year', () => {
    const window = usDstWindow(2024);
    expect(doyToCivilDate(2024, window.startDoy)).toEqual({ year: 2024, month: 3, day: 10 });
    expect(doyToCivilDate(2024, window.endDoy)).toEqual({ year: 2024, month: 11, day: 3 });
  });
});

describe('the whole-day DST simplification', () => {
  // Transitions really happen at 02:00 local. Treating the transition days as
  // wholly one offset or the other is only valid because no sunrise or sunset
  // in the continental US falls before 02:00 standard time. Eastport, Maine is
  // the extreme case: the earliest sunrises in the country.
  const EASTPORT = { latitude: 44.9065, longitude: -66.9899, standardOffset: -300 };

  it('never puts a sunrise or sunset before 02:00 standard time on a transition day', () => {
    const window = usDstWindow(2026);
    for (const doy of [window.startDoy, window.endDoy]) {
      const events = sunEventsUtc(doyToCivilDate(2026, doy), EASTPORT.latitude, EASTPORT.longitude);
      if (events.kind !== 'normal') {
        throw new Error('Expected normal sun events');
      }
      const sunrise = events.sunriseUtcMinutes + EASTPORT.standardOffset;
      const sunset = events.sunsetUtcMinutes + EASTPORT.standardOffset;
      expect(sunrise).toBeGreaterThan(120);
      expect(sunset).toBeGreaterThan(120);
    }
  });

  it('holds across the whole continental US, not just Eastport', () => {
    const window = usDstWindow(2026);
    for (const doy of [window.startDoy, window.endDoy]) {
      const date = doyToCivilDate(2026, doy);
      for (const [longitude, standardOffset] of [
        [-66.9, -300],
        [-90.5, -300],
        [-84, -360],
        [-106.6, -360],
        [-101, -420],
        [-120, -420],
        [-116.5, -480],
        [-124.8, -480],
      ] as const) {
        for (const latitude of [24.4, 37, 49.4]) {
          const events = sunEventsUtc(date, latitude, longitude);
          if (events.kind !== 'normal') {
            throw new Error('Expected normal sun events');
          }
          expect(events.sunriseUtcMinutes + standardOffset).toBeGreaterThan(120);
        }
      }
    }
  });
});

describe('isDstDay', () => {
  it('covers the expected number of days in 2026', () => {
    const window = usDstWindow(2026);
    let count = 0;
    for (let doy = 0; doy < 365; doy += 1) {
      if (isDstDay(doy, window)) {
        count += 1;
      }
    }
    // 2026-03-08 through 2026-10-31 inclusive.
    expect(count).toBe(civilDateToDoy({ year: 2026, month: 11, day: 1 }) - window.startDoy);
    expect(count).toBe(238);
  });
});
