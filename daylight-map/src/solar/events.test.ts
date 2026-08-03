// SPDX-License-Identifier: Apache-2.0
import { getTimes } from 'suncalc';
import { describe, expect, it } from 'vitest';
import { STANDARD_ZENITH_DEGREES, sunEventsUtc } from './events.ts';
import { type CivilDate, doyToCivilDate } from './julian.ts';

function normalEvents(date: CivilDate, latitude: number, longitude: number) {
  const result = sunEventsUtc(date, latitude, longitude);
  if (result.kind !== 'normal') {
    throw new Error(`Expected normal sun events, got ${result.kind}`);
  }
  return result;
}

/** Format UT minutes shifted by a fixed offset as a local HH:MM clock string. */
function localClock(utcMinutes: number, offsetMinutes: number): string {
  const total = Math.round(utcMinutes + offsetMinutes);
  const hours = Math.floor(total / 60) % 24;
  const minutes = ((total % 60) + 60) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

describe('sunEventsUtc against published times', () => {
  // Offsets are the zone rules actually in force on each date.
  const cases: ReadonlyArray<{
    label: string;
    date: CivilDate;
    latitude: number;
    longitude: number;
    offsetMinutes: number;
    sunrise: string;
    sunset: string;
  }> = [
    {
      label: 'New York, summer solstice',
      date: { year: 2026, month: 6, day: 21 },
      latitude: 40.7128,
      longitude: -74.006,
      offsetMinutes: -240,
      sunrise: '05:25',
      sunset: '20:31',
    },
    {
      label: 'Seattle, winter solstice',
      date: { year: 2026, month: 12, day: 21 },
      latitude: 47.6062,
      longitude: -122.3321,
      offsetMinutes: -480,
      sunrise: '07:55',
      sunset: '16:20',
    },
    {
      label: 'Detroit, summer solstice',
      date: { year: 2026, month: 6, day: 21 },
      latitude: 42.3314,
      longitude: -83.0458,
      offsetMinutes: -240,
      sunrise: '05:56',
      sunset: '21:13',
    },
    {
      label: 'Miami, summer solstice',
      date: { year: 2026, month: 6, day: 21 },
      latitude: 25.7617,
      longitude: -80.1918,
      offsetMinutes: -240,
      sunrise: '06:30',
      sunset: '20:15',
    },
  ];

  for (const c of cases) {
    it(c.label, () => {
      const events = normalEvents(c.date, c.latitude, c.longitude);
      expect(localClock(events.sunriseUtcMinutes, c.offsetMinutes)).toBe(c.sunrise);
      expect(localClock(events.sunsetUtcMinutes, c.offsetMinutes)).toBe(c.sunset);
    });
  }
});

describe('sunEventsUtc against the suncalc oracle', () => {
  it('agrees within two minutes across the continental US and the whole year', () => {
    const latitudes = [24.5, 28, 32, 36, 40, 44, 47, 49];
    const longitudes = [-124, -115, -105, -95, -85, -75, -67];
    let worstSunrise = 0;
    let worstSunset = 0;
    let samples = 0;

    for (let doy = 0; doy < 365; doy += 7) {
      const date = doyToCivilDate(2026, doy);
      const dayStartMs = Date.UTC(date.year, date.month - 1, date.day);
      // Anchoring at 12:00 UT selects the right solar day everywhere in CONUS:
      // the largest solar-noon offset is about 8h20m, comfortably under 12h.
      const anchor = new Date(dayStartMs + 12 * 60 * 60 * 1000);

      for (const latitude of latitudes) {
        for (const longitude of longitudes) {
          const ours = normalEvents(date, latitude, longitude);
          const theirs = getTimes(anchor, latitude, longitude);
          if (theirs.sunrise === null || theirs.sunset === null) {
            throw new Error(`Oracle reported no sun events at ${latitude}, ${longitude}`);
          }
          const theirSunrise = (theirs.sunrise.getTime() - dayStartMs) / 60000;
          const theirSunset = (theirs.sunset.getTime() - dayStartMs) / 60000;

          worstSunrise = Math.max(worstSunrise, Math.abs(ours.sunriseUtcMinutes - theirSunrise));
          worstSunset = Math.max(worstSunset, Math.abs(ours.sunsetUtcMinutes - theirSunset));
          samples += 1;
        }
      }
    }

    expect(samples).toBeGreaterThan(2000);
    expect(worstSunrise).toBeLessThan(2);
    expect(worstSunset).toBeLessThan(2);
  });
});

describe('sunEventsUtc invariants', () => {
  it('is symmetric about solar noon', () => {
    for (let doy = 0; doy < 365; doy += 11) {
      const date = doyToCivilDate(2026, doy);
      const events = normalEvents(date, 42.3314, -83.0458);
      const beforeNoon = events.solarNoonUtcMinutes - events.sunriseUtcMinutes;
      const afterNoon = events.sunsetUtcMinutes - events.solarNoonUtcMinutes;
      // The declination drifts slightly between sunrise and sunset, so the two
      // halves are close but not identical.
      expect(Math.abs(beforeNoon - afterNoon)).toBeLessThan(1);
    }
  });

  it('puts solar noon a longitude-consistent distance from mean noon', () => {
    const longitude = -83.0458;
    const events = normalEvents({ year: 2026, month: 6, day: 21 }, 42.3314, longitude);
    // 720 - 4*lon is mean solar noon; the residual is the equation of time.
    const residual = 720 - 4 * longitude - events.solarNoonUtcMinutes;
    expect(Math.abs(residual)).toBeLessThan(17);
  });

  it('gives a day slightly longer than twelve hours at the equinox', () => {
    for (const latitude of [25, 35, 45, 49]) {
      const events = normalEvents({ year: 2026, month: 3, day: 20 }, latitude, -90);
      const dayLength = events.sunsetUtcMinutes - events.sunriseUtcMinutes;
      // Refraction and the sun's radius push the equinox day past 12 hours,
      // and the effect grows with latitude.
      expect(dayLength).toBeGreaterThan(720);
      expect(dayLength).toBeLessThan(735);
    }
  });

  it('lengthens the solstice day as latitude increases', () => {
    let previous = 0;
    for (const latitude of [25, 30, 35, 40, 45, 49]) {
      const events = normalEvents({ year: 2026, month: 6, day: 21 }, latitude, -90);
      const dayLength = events.sunsetUtcMinutes - events.sunriseUtcMinutes;
      expect(dayLength).toBeGreaterThan(previous);
      previous = dayLength;
    }
  });

  it('converges to well within the tolerance after two refinement passes', () => {
    const date = { year: 2026, month: 6, day: 21 };
    const twoPasses = normalEvents(date, 44.9065, -66.9899);
    const manyPasses = sunEventsUtc(date, 44.9065, -66.9899, { maxIterations: 12 });
    if (manyPasses.kind !== 'normal') {
      throw new Error('Expected normal sun events');
    }
    expect(Math.abs(twoPasses.sunriseUtcMinutes - manyPasses.sunriseUtcMinutes)).toBeLessThan(0.01);
    expect(Math.abs(twoPasses.sunsetUtcMinutes - manyPasses.sunsetUtcMinutes)).toBeLessThan(0.01);
  });

  it('reports polar day and polar night above the arctic circle', () => {
    expect(sunEventsUtc({ year: 2026, month: 6, day: 21 }, 78, 15).kind).toBe('polar-day');
    expect(sunEventsUtc({ year: 2026, month: 12, day: 21 }, 78, 15).kind).toBe('polar-night');
  });
});

describe('the continental US never needs local-date rollover handling', () => {
  // Each zone paired with the longitudes it actually spans. Pairing the full
  // CONUS longitude range against every offset would include geographically
  // impossible combinations, which really do roll over.
  const zoneExtents: ReadonlyArray<{
    label: string;
    standardOffsetMinutes: number;
    westLongitude: number;
    eastLongitude: number;
  }> = [
    { label: 'Pacific', standardOffsetMinutes: -480, westLongitude: -124.8, eastLongitude: -116.5 },
    { label: 'Mountain', standardOffsetMinutes: -420, westLongitude: -120, eastLongitude: -101 },
    { label: 'Arizona', standardOffsetMinutes: -420, westLongitude: -114.9, eastLongitude: -109 },
    { label: 'Central', standardOffsetMinutes: -360, westLongitude: -106.6, eastLongitude: -84 },
    { label: 'Eastern', standardOffsetMinutes: -300, westLongitude: -90.5, eastLongitude: -66.9 },
  ];

  it('keeps sunrise and sunset inside the local day for every zone, day, and scenario', () => {
    const latitudes = [24.4, 31, 37, 43, 47, 49.4];
    let earliestSunrise = Number.POSITIVE_INFINITY;
    let latestSunset = Number.NEGATIVE_INFINITY;

    for (const zone of zoneExtents) {
      // Permanent standard time and permanent DST bracket every offset the app
      // can apply to this zone.
      for (const offset of [zone.standardOffsetMinutes, zone.standardOffsetMinutes + 60]) {
        const longitudes = [
          zone.westLongitude,
          (zone.westLongitude + zone.eastLongitude) / 2,
          zone.eastLongitude,
        ];
        for (const longitude of longitudes) {
          for (const latitude of latitudes) {
            for (let doy = 0; doy < 365; doy += 1) {
              const events = normalEvents(doyToCivilDate(2026, doy), latitude, longitude);
              const sunrise = events.sunriseUtcMinutes + offset;
              const sunset = events.sunsetUtcMinutes + offset;
              earliestSunrise = Math.min(earliestSunrise, sunrise);
              latestSunset = Math.max(latestSunset, sunset);
              expect(sunrise).toBeGreaterThanOrEqual(0);
              expect(sunset).toBeLessThan(1440);
            }
          }
        }
      }
    }

    // Recorded so a future bbox change that erodes the margin fails loudly here
    // rather than silently producing off-by-a-day statistics.
    expect(earliestSunrise).toBeGreaterThan(120);
    expect(latestSunset).toBeLessThan(1400);
  });
});

describe('zenith', () => {
  it('uses the standard refraction and semidiameter horizon', () => {
    expect(STANDARD_ZENITH_DEGREES).toBe(90.833);
  });

  it('produces a shorter day at a higher zenith', () => {
    const date = { year: 2026, month: 6, day: 21 };
    const standard = normalEvents(date, 42.3314, -83.0458);
    const geometric = sunEventsUtc(date, 42.3314, -83.0458, { zenithDegrees: 90 });
    if (geometric.kind !== 'normal') {
      throw new Error('Expected normal sun events');
    }
    const standardLength = standard.sunsetUtcMinutes - standard.sunriseUtcMinutes;
    const geometricLength = geometric.sunsetUtcMinutes - geometric.sunriseUtcMinutes;
    expect(geometricLength).toBeLessThan(standardLength);
  });
});
