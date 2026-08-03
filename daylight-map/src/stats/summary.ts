// SPDX-License-Identifier: Apache-2.0
import { type Scenario, scenariosFor, type ZoneInfo } from '../time/index.ts';
import { localSeries, type ScenarioSeries, solarYear } from './series.ts';

export interface Thresholds {
  /** Sunrise strictly before this counts as an early sunrise. Default 04:00. */
  readonly earlySunriseMinutes: number;
  /** Sunset strictly after this counts as a late sunset. Default 20:00. */
  readonly lateSunsetMinutes: number;
  /** Sunrise strictly after this counts as a late sunrise. Default 08:00. */
  readonly lateSunriseMinutes: number;
  /** Sunset strictly before this counts as an early sunset. Default 17:00. */
  readonly earlySunsetMinutes: number;
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  earlySunriseMinutes: 4 * 60,
  lateSunsetMinutes: 20 * 60,
  lateSunriseMinutes: 8 * 60,
  earlySunsetMinutes: 17 * 60,
};

export interface Extreme {
  readonly doy: number;
  readonly minutes: number;
}

/** A run of consecutive days, inclusive at both ends. */
export interface DaySpan {
  readonly startDoy: number;
  readonly endDoy: number;
}

export interface ScenarioStats {
  readonly scenario: Scenario;
  readonly dayCount: number;
  /** Days with sunrise before the early-sunrise threshold. */
  readonly daysSunriseBeforeEarly: number;
  /** Days with sunset after the late-sunset threshold. */
  readonly daysSunsetAfterLate: number;
  readonly daysSunriseAfterLate: number;
  readonly daysSunsetBeforeEarly: number;
  readonly earliestSunrise: Extreme;
  readonly latestSunrise: Extreme;
  readonly earliestSunset: Extreme;
  readonly latestSunset: Extreme;
  readonly shortestDay: Extreme;
  readonly longestDay: Extreme;
  readonly earlySunriseSpans: readonly DaySpan[];
  readonly lateSunsetSpans: readonly DaySpan[];
}

/** Group the days satisfying a predicate into runs of consecutive days. */
function spansWhere(
  days: readonly { doy: number }[],
  predicate: (index: number) => boolean,
): DaySpan[] {
  const spans: DaySpan[] = [];
  let start: number | null = null;
  for (let i = 0; i < days.length; i += 1) {
    if (predicate(i)) {
      if (start === null) {
        start = i;
      }
    } else if (start !== null) {
      spans.push({ startDoy: start, endDoy: i - 1 });
      start = null;
    }
  }
  if (start !== null) {
    spans.push({ startDoy: start, endDoy: days.length - 1 });
  }
  return spans;
}

/**
 * Count threshold crossings and find the extremes for one scenario.
 *
 * Comparisons are strict, matching how the thresholds read in prose: "sunrise
 * before 4:00 AM" excludes a sunrise at exactly 4:00.
 */
export function scenarioStats(series: ScenarioSeries, thresholds: Thresholds): ScenarioStats {
  const { days } = series;
  const first = days[0];
  if (first === undefined) {
    throw new RangeError('Cannot summarise an empty series');
  }

  let daysSunriseBeforeEarly = 0;
  let daysSunsetAfterLate = 0;
  let daysSunriseAfterLate = 0;
  let daysSunsetBeforeEarly = 0;

  let earliestSunrise: Extreme = { doy: first.doy, minutes: first.sunriseMinutes };
  let latestSunrise: Extreme = earliestSunrise;
  let earliestSunset: Extreme = { doy: first.doy, minutes: first.sunsetMinutes };
  let latestSunset: Extreme = earliestSunset;
  let shortestDay: Extreme = { doy: first.doy, minutes: first.dayLengthMinutes };
  let longestDay: Extreme = shortestDay;

  for (const day of days) {
    if (day.sunriseMinutes < thresholds.earlySunriseMinutes) {
      daysSunriseBeforeEarly += 1;
    }
    if (day.sunsetMinutes > thresholds.lateSunsetMinutes) {
      daysSunsetAfterLate += 1;
    }
    if (day.sunriseMinutes > thresholds.lateSunriseMinutes) {
      daysSunriseAfterLate += 1;
    }
    if (day.sunsetMinutes < thresholds.earlySunsetMinutes) {
      daysSunsetBeforeEarly += 1;
    }

    if (day.sunriseMinutes < earliestSunrise.minutes) {
      earliestSunrise = { doy: day.doy, minutes: day.sunriseMinutes };
    }
    if (day.sunriseMinutes > latestSunrise.minutes) {
      latestSunrise = { doy: day.doy, minutes: day.sunriseMinutes };
    }
    if (day.sunsetMinutes < earliestSunset.minutes) {
      earliestSunset = { doy: day.doy, minutes: day.sunsetMinutes };
    }
    if (day.sunsetMinutes > latestSunset.minutes) {
      latestSunset = { doy: day.doy, minutes: day.sunsetMinutes };
    }
    if (day.dayLengthMinutes < shortestDay.minutes) {
      shortestDay = { doy: day.doy, minutes: day.dayLengthMinutes };
    }
    if (day.dayLengthMinutes > longestDay.minutes) {
      longestDay = { doy: day.doy, minutes: day.dayLengthMinutes };
    }
  }

  return {
    scenario: series.scenario,
    dayCount: days.length,
    daysSunriseBeforeEarly,
    daysSunsetAfterLate,
    daysSunriseAfterLate,
    daysSunsetBeforeEarly,
    earliestSunrise,
    latestSunrise,
    earliestSunset,
    latestSunset,
    shortestDay,
    longestDay,
    earlySunriseSpans: spansWhere(
      days,
      (i) => (days[i]?.sunriseMinutes ?? Number.POSITIVE_INFINITY) < thresholds.earlySunriseMinutes,
    ),
    lateSunsetSpans: spansWhere(
      days,
      (i) => (days[i]?.sunsetMinutes ?? Number.NEGATIVE_INFINITY) > thresholds.lateSunsetMinutes,
    ),
  };
}

export interface Results {
  readonly year: number;
  readonly latitude: number;
  readonly longitude: number;
  readonly zone: ZoneInfo;
  readonly thresholds: Thresholds;
  readonly series: readonly [ScenarioSeries, ScenarioSeries, ScenarioSeries];
  readonly stats: readonly [ScenarioStats, ScenarioStats, ScenarioStats];
}

/**
 * Everything the UI needs for one location.
 *
 * The solar year is computed once and shared across the three scenarios.
 */
export function computeResults(
  year: number,
  latitude: number,
  longitude: number,
  zone: ZoneInfo,
  thresholds: Thresholds,
): Results {
  const solar = solarYear(year, latitude, longitude);
  const scenarios = scenariosFor(zone);
  const series = scenarios.map((scenario) => localSeries(solar, scenario, year)) as unknown as [
    ScenarioSeries,
    ScenarioSeries,
    ScenarioSeries,
  ];
  const stats = series.map((s) => scenarioStats(s, thresholds)) as unknown as [
    ScenarioStats,
    ScenarioStats,
    ScenarioStats,
  ];
  return { year, latitude, longitude, zone, thresholds, series, stats };
}

/**
 * Recompute only the statistics, reusing series already built for a location.
 *
 * Threshold changes take this path; they must never trigger a new solar year.
 */
export function restatResults(results: Results, thresholds: Thresholds): Results {
  const stats = results.series.map((s) => scenarioStats(s, thresholds)) as unknown as [
    ScenarioStats,
    ScenarioStats,
    ScenarioStats,
  ];
  return { ...results, thresholds, stats };
}
