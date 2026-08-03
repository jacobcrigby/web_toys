// SPDX-License-Identifier: Apache-2.0
import { monthStartDoys } from '../solar/index.ts';
import type { ScenarioSeries, ScenarioStats, Thresholds } from '../stats/index.ts';
import {
  formatLongMonthDay,
  formatTimeOfDay,
  MONTH_ABBREVIATIONS,
  usDstWindow,
} from '../time/index.ts';

export interface ChartDims {
  readonly width: number;
  readonly height: number;
  readonly padTop: number;
  readonly padRight: number;
  readonly padBottom: number;
  readonly padLeft: number;
}

/**
 * Sized so the chart renders close to 1:1 in the results column.
 *
 * The viewBox is the type's coordinate system too: a much wider box would be
 * scaled down to fit, shrinking the axis labels below legibility along with it.
 */
export const DEFAULT_DIMS: ChartDims = {
  width: 560,
  height: 300,
  padTop: 12,
  // Room for the threshold labels, which sit outside the plot on the right.
  padRight: 58,
  padBottom: 28,
  padLeft: 52,
};

export interface Plot {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export type ThresholdId = 'early-sunrise' | 'late-sunset';

export interface ThresholdLine {
  readonly id: ThresholdId;
  readonly y: number;
  readonly minutes: number;
  readonly label: string;
  readonly dayCount: number;
}

export interface TripZone {
  readonly id: ThresholdId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly dayCount: number;
}

export interface Tick {
  readonly position: number;
  readonly label: string;
}

export interface TransitionMarker {
  readonly x: number;
  readonly label: string;
}

export interface ChartModel {
  readonly scenarioId: string;
  readonly dims: ChartDims;
  readonly plot: Plot;
  readonly bandPath: string;
  readonly sunrisePath: string;
  readonly sunsetPath: string;
  readonly thresholdLines: readonly ThresholdLine[];
  readonly tripZones: readonly TripZone[];
  readonly transitions: readonly TransitionMarker[];
  readonly xTicks: readonly Tick[];
  readonly yTicks: readonly Tick[];
  /** Plain-language equivalent of the whole chart, for the SVG <desc>. */
  readonly summary: string;
}

export function plotOf(dims: ChartDims): Plot {
  return {
    x: dims.padLeft,
    y: dims.padTop,
    width: dims.width - dims.padLeft - dims.padRight,
    height: dims.height - dims.padTop - dims.padBottom,
  };
}

/** Day of year to an x coordinate, spanning the full plot width. */
export function doyToX(doy: number, dayCount: number, plot: Plot): number {
  if (dayCount <= 1) {
    return plot.x;
  }
  return plot.x + (doy / (dayCount - 1)) * plot.width;
}

/**
 * Minutes past midnight to a y coordinate.
 *
 * Midnight is at the top and the following midnight at the bottom, the way a
 * calendar renders a day. Early sunrises then sit near the top edge and late
 * sunsets near the bottom, so both thresholds read as the daylight band pushing
 * outward toward the edges of the day.
 */
export function minutesToY(minutes: number, plot: Plot): number {
  return plot.y + (minutes / 1440) * plot.height;
}

function round(value: number): string {
  return (Math.round(value * 100) / 100).toString();
}

function polyline(points: readonly (readonly [number, number])[]): string {
  return points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`).join(' ');
}

/**
 * Join a run of day indices into prose: "May 15 – Jul 19".
 *
 * Falls back to listing at most two runs; more than that and the count alone
 * carries the meaning.
 */
function describeSpans(
  spans: readonly { startDoy: number; endDoy: number }[],
  year: number,
): string {
  if (spans.length === 0) {
    return '';
  }
  const described = spans
    .slice(0, 2)
    .map((span) =>
      span.startDoy === span.endDoy
        ? formatLongMonthDay(year, span.startDoy)
        : `${formatLongMonthDay(year, span.startDoy)} to ${formatLongMonthDay(year, span.endDoy)}`,
    );
  const suffix = spans.length > 2 ? `, and ${spans.length - 2} more periods` : '';
  return `${described.join(', ')}${suffix}`;
}

function buildSummary(
  series: ScenarioSeries,
  stats: ScenarioStats,
  thresholds: Thresholds,
): string {
  const { year } = series;
  const parts = [
    `${stats.scenario.label} in ${year}.`,
    `Sunrise ranges from ${formatTimeOfDay(stats.earliestSunrise.minutes)} on ` +
      `${formatLongMonthDay(year, stats.earliestSunrise.doy)} to ` +
      `${formatTimeOfDay(stats.latestSunrise.minutes)} on ` +
      `${formatLongMonthDay(year, stats.latestSunrise.doy)}.`,
    `Sunset ranges from ${formatTimeOfDay(stats.earliestSunset.minutes)} on ` +
      `${formatLongMonthDay(year, stats.earliestSunset.doy)} to ` +
      `${formatTimeOfDay(stats.latestSunset.minutes)} on ` +
      `${formatLongMonthDay(year, stats.latestSunset.doy)}.`,
  ];

  const early = stats.daysSunriseBeforeEarly;
  const earlySpans = describeSpans(stats.earlySunriseSpans, year);
  parts.push(
    early === 0
      ? `No days have sunrise before ${formatTimeOfDay(thresholds.earlySunriseMinutes)}.`
      : `${early} of ${stats.dayCount} days have sunrise before ` +
          `${formatTimeOfDay(thresholds.earlySunriseMinutes)}${earlySpans ? ` (${earlySpans})` : ''}.`,
  );

  const late = stats.daysSunsetAfterLate;
  const lateSpans = describeSpans(stats.lateSunsetSpans, year);
  parts.push(
    late === 0
      ? `No days have sunset after ${formatTimeOfDay(thresholds.lateSunsetMinutes)}.`
      : `${late} of ${stats.dayCount} days have sunset after ` +
          `${formatTimeOfDay(thresholds.lateSunsetMinutes)}${lateSpans ? ` (${lateSpans})` : ''}.`,
  );

  return parts.join(' ');
}

/**
 * Geometry and text for one scenario's daylight chart.
 *
 * Pure: returns path strings and coordinates, touching no DOM, so the layout is
 * unit-testable and the rendering layer stays a thin translation to SVG nodes.
 */
export function buildChartModel(
  series: ScenarioSeries,
  stats: ScenarioStats,
  thresholds: Thresholds,
  dims: ChartDims = DEFAULT_DIMS,
): ChartModel {
  const plot = plotOf(dims);
  const { days, year } = series;
  const dayCount = days.length;

  const sunrisePoints: [number, number][] = days.map((day) => [
    doyToX(day.doy, dayCount, plot),
    minutesToY(day.sunriseMinutes, plot),
  ]);
  const sunsetPoints: [number, number][] = days.map((day) => [
    doyToX(day.doy, dayCount, plot),
    minutesToY(day.sunsetMinutes, plot),
  ]);

  // Straight segments only. Under current law the hour-long DST jumps show up
  // as vertical steps, which is exactly what the chart is meant to reveal.
  const bandPath = `${polyline(sunrisePoints)} ${polyline([...sunsetPoints].reverse())
    .replace(/^M/, 'L')
    .trimStart()} Z`;

  const earlyY = minutesToY(thresholds.earlySunriseMinutes, plot);
  const lateY = minutesToY(thresholds.lateSunsetMinutes, plot);

  const thresholdLines: ThresholdLine[] = [
    {
      id: 'early-sunrise',
      y: earlyY,
      minutes: thresholds.earlySunriseMinutes,
      label: formatTimeOfDay(thresholds.earlySunriseMinutes),
      dayCount: stats.daysSunriseBeforeEarly,
    },
    {
      id: 'late-sunset',
      y: lateY,
      minutes: thresholds.lateSunsetMinutes,
      label: formatTimeOfDay(thresholds.lateSunsetMinutes),
      dayCount: stats.daysSunsetAfterLate,
    },
  ];

  const tripZones: TripZone[] = [
    {
      id: 'early-sunrise',
      x: plot.x,
      y: plot.y,
      width: plot.width,
      height: Math.max(0, earlyY - plot.y),
      dayCount: stats.daysSunriseBeforeEarly,
    },
    {
      id: 'late-sunset',
      x: plot.x,
      y: lateY,
      width: plot.width,
      height: Math.max(0, plot.y + plot.height - lateY),
      dayCount: stats.daysSunsetAfterLate,
    },
  ];

  const xTicks: Tick[] = monthStartDoys(year).map((doy, index) => ({
    position: doyToX(doy, dayCount, plot),
    label: MONTH_ABBREVIATIONS[index] ?? '',
  }));

  const yTicks: Tick[] = [];
  for (let minutes = 0; minutes <= 1440; minutes += 180) {
    yTicks.push({
      position: minutesToY(minutes, plot),
      label: formatTimeOfDay(minutes % 1440),
    });
  }

  const transitions: TransitionMarker[] = [];
  if (series.scenario.rule.kind === 'usDst') {
    const window = usDstWindow(year);
    transitions.push(
      { x: doyToX(window.startDoy, dayCount, plot), label: 'Clocks forward' },
      { x: doyToX(window.endDoy, dayCount, plot), label: 'Clocks back' },
    );
  }

  return {
    scenarioId: series.scenario.id,
    dims,
    plot,
    bandPath,
    sunrisePath: polyline(sunrisePoints),
    sunsetPath: polyline(sunsetPoints),
    thresholdLines,
    tripZones,
    transitions,
    xTicks,
    yTicks,
    summary: buildSummary(series, stats, thresholds),
  };
}
