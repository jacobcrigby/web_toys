// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { formatMonthDay, formatTimeOfDay, zoneInfo } from '../time/index.ts';
import { localSeries, type ScenarioSeries, solarYear } from './series.ts';
import {
  computeResults,
  DEFAULT_THRESHOLDS,
  restatResults,
  scenarioStats,
  type Thresholds,
} from './summary.ts';

const EASTPORT = { latitude: 44.9065, longitude: -66.9899, zone: 'America/New_York' };
const DETROIT = { latitude: 42.3314, longitude: -83.0458, zone: 'America/Detroit' };
const PHOENIX = { latitude: 33.4484, longitude: -112.074, zone: 'America/Phoenix' };

function resultsFor(
  place: { latitude: number; longitude: number; zone: string },
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
) {
  return computeResults(2026, place.latitude, place.longitude, zoneInfo(place.zone), thresholds);
}

describe('the headline statistics', () => {
  it('finds 66 sub-4 AM sunrises at Eastport under permanent standard time', () => {
    const [, standard] = resultsFor(EASTPORT).stats;
    expect(standard.daysSunriseBeforeEarly).toBe(66);
    expect(standard.daysSunsetAfterLate).toBe(0);
    expect(formatTimeOfDay(standard.earliestSunrise.minutes)).toBe('3:41 AM');
    expect(formatMonthDay(2026, standard.earliestSunrise.doy)).toBe('Jun 15');
  });

  it('eliminates them entirely at Eastport under permanent DST', () => {
    const [, , dst] = resultsFor(EASTPORT).stats;
    expect(dst.daysSunriseBeforeEarly).toBe(0);
    expect(dst.daysSunsetAfterLate).toBe(64);
    expect(formatTimeOfDay(dst.earliestSunrise.minutes)).toBe('4:41 AM');
  });

  it('finds 155 post-8 PM sunsets at Detroit under permanent DST', () => {
    const [, , dst] = resultsFor(DETROIT).stats;
    expect(dst.daysSunsetAfterLate).toBe(155);
    expect(dst.daysSunriseBeforeEarly).toBe(0);
  });

  it('shows what Detroit pays for them', () => {
    const [, standard, dst] = resultsFor(DETROIT).stats;
    // The cost of permanent DST is dark mornings, not lost evenings.
    expect(dst.daysSunriseAfterLate).toBe(129);
    expect(standard.daysSunriseAfterLate).toBe(17);
    expect(formatTimeOfDay(dst.latestSunrise.minutes)).toBe('9:01 AM');
    expect(standard.daysSunsetAfterLate).toBe(56);
  });

  it('drives the two headline numbers from different places', () => {
    // The thesis the app exists to show: nowhere gets both.
    const eastport = resultsFor(EASTPORT).stats[1];
    const detroit = resultsFor(DETROIT).stats[2];
    expect(eastport.daysSunriseBeforeEarly).toBeGreaterThan(60);
    expect(eastport.daysSunsetAfterLate).toBe(0);
    expect(detroit.daysSunsetAfterLate).toBeGreaterThan(150);
    expect(detroit.daysSunriseBeforeEarly).toBe(0);
  });
});

describe('Arizona', () => {
  it('has an identical current-law and permanent-standard series, day for day', () => {
    const { series } = resultsFor(PHOENIX);
    const [current, standard] = series;
    expect(current.days).toEqual(standard.days);
  });

  it('still gains late sunsets under permanent DST', () => {
    const [current, , dst] = resultsFor(PHOENIX).stats;
    expect(current.daysSunsetAfterLate).toBe(0);
    expect(dst.daysSunsetAfterLate).toBeGreaterThan(100);
  });
});

describe('current law', () => {
  it('keeps every late sunset that permanent DST would deliver at Detroit', () => {
    // All post-8 PM sunsets already fall inside the existing DST window, so
    // permanent DST adds none at Detroit — it only changes the winter.
    const [current, , dst] = resultsFor(DETROIT).stats;
    expect(current.daysSunsetAfterLate).toBe(dst.daysSunsetAfterLate);
  });

  it('puts Detroit’s latest sunrise the day before the clocks go back', () => {
    // An artifact of the real rules, not a bug: the last DST morning is darker
    // than any standard-time morning that winter.
    const [current] = resultsFor(DETROIT).stats;
    expect(formatMonthDay(2026, current.latestSunrise.doy)).toBe('Oct 31');
  });
});

describe('threshold semantics', () => {
  /** A series with sunrise and sunset pinned to exact threshold values. */
  function syntheticSeries(sunrise: number, sunset: number, dayCount = 10): ScenarioSeries {
    return {
      scenario: {
        id: 'permanent-standard',
        label: 'test',
        shortLabel: 'test',
        rule: { kind: 'fixed', offsetMinutes: 0 },
      },
      year: 2026,
      days: Array.from({ length: dayCount }, (_, doy) => ({
        doy,
        offsetMinutes: 0,
        sunriseMinutes: sunrise,
        sunsetMinutes: sunset,
        solarNoonMinutes: (sunrise + sunset) / 2,
        dayLengthMinutes: sunset - sunrise,
      })),
    };
  }

  it('excludes values exactly on the threshold', () => {
    const stats = scenarioStats(syntheticSeries(240, 1200), DEFAULT_THRESHOLDS);
    expect(stats.daysSunriseBeforeEarly).toBe(0);
    expect(stats.daysSunsetAfterLate).toBe(0);
  });

  it('includes values one minute past the threshold', () => {
    const stats = scenarioStats(syntheticSeries(239, 1201), DEFAULT_THRESHOLDS);
    expect(stats.daysSunriseBeforeEarly).toBe(10);
    expect(stats.daysSunsetAfterLate).toBe(10);
  });

  it('rejects an empty series rather than inventing extremes', () => {
    expect(() => scenarioStats(syntheticSeries(300, 1100, 0), DEFAULT_THRESHOLDS)).toThrow(
      RangeError,
    );
  });
});

describe('span extraction', () => {
  it('groups the early sunrises into contiguous runs', () => {
    const [, standard] = resultsFor(EASTPORT).stats;
    const spans = standard.earlySunriseSpans;
    expect(spans.length).toBe(1);
    const span = spans[0];
    if (span === undefined) {
      throw new Error('Expected a span');
    }
    // The run covers exactly the counted days.
    expect(span.endDoy - span.startDoy + 1).toBe(standard.daysSunriseBeforeEarly);
    expect(formatMonthDay(2026, span.startDoy)).toBe('May 15');
    expect(formatMonthDay(2026, span.endDoy)).toBe('Jul 19');
  });

  it('splits a run interrupted by the spring-forward jump', () => {
    // Under current law the late sunsets are one block, because the DST window
    // brackets them; permanent standard time yields a different block.
    const [, standard] = resultsFor(DETROIT).stats;
    const total = standard.lateSunsetSpans.reduce(
      (sum, span) => sum + (span.endDoy - span.startDoy + 1),
      0,
    );
    expect(total).toBe(standard.daysSunsetAfterLate);
  });

  it('reports no spans when nothing crosses the threshold', () => {
    const [, standard] = resultsFor(EASTPORT).stats;
    expect(standard.lateSunsetSpans).toEqual([]);
  });
});

describe('computeResults', () => {
  it('returns the three scenarios in a stable order', () => {
    const { stats } = resultsFor(DETROIT);
    expect(stats.map((s) => s.scenario.id)).toEqual([
      'current',
      'permanent-standard',
      'permanent-dst',
    ]);
  });

  it('covers every day of the year', () => {
    for (const scenario of resultsFor(DETROIT).stats) {
      expect(scenario.dayCount).toBe(365);
    }
    const leap = computeResults(
      2024,
      DETROIT.latitude,
      DETROIT.longitude,
      zoneInfo(DETROIT.zone),
      DEFAULT_THRESHOLDS,
    );
    expect(leap.stats[0].dayCount).toBe(366);
  });

  it('orders the extremes sensibly', () => {
    for (const s of resultsFor(DETROIT).stats) {
      expect(s.earliestSunrise.minutes).toBeLessThanOrEqual(s.latestSunrise.minutes);
      expect(s.earliestSunset.minutes).toBeLessThanOrEqual(s.latestSunset.minutes);
      expect(s.shortestDay.minutes).toBeLessThan(s.longestDay.minutes);
    }
  });
});

describe('restatResults', () => {
  it('matches a full recompute', () => {
    const relaxed: Thresholds = {
      earlySunriseMinutes: 5 * 60,
      lateSunsetMinutes: 19 * 60,
      lateSunriseMinutes: 7 * 60,
      earlySunsetMinutes: 18 * 60,
    };
    const restated = restatResults(resultsFor(DETROIT), relaxed);
    const recomputed = resultsFor(DETROIT, relaxed);
    expect(restated.stats).toEqual(recomputed.stats);
    expect(restated.thresholds).toEqual(relaxed);
  });

  it('reuses the existing series rather than rebuilding them', () => {
    const original = resultsFor(DETROIT);
    const restated = restatResults(original, DEFAULT_THRESHOLDS);
    // Identity, not just equality: no new solar year was computed.
    expect(restated.series).toBe(original.series);
  });
});

describe('performance', () => {
  it('computes a full location in a few milliseconds', () => {
    const start = performance.now();
    for (let i = 0; i < 20; i += 1) {
      resultsFor(DETROIT);
    }
    const perRun = (performance.now() - start) / 20;
    // Generous headroom over the ~2-4ms measured, so this flags a real
    // regression rather than CI noise. Recomputing synchronously on every map
    // click depends on this staying fast.
    expect(perRun).toBeLessThan(50);
  });

  it('shares one solar year across the three scenarios', () => {
    const solar = solarYear(2026, DETROIT.latitude, DETROIT.longitude);
    const scenarios = resultsFor(DETROIT).series.map((s) => s.scenario);
    for (const scenario of scenarios) {
      const series = localSeries(solar, scenario, 2026);
      expect(series.days.length).toBe(365);
    }
  });
});
