// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { computeResults, DEFAULT_THRESHOLDS, type Results } from '../stats/index.ts';
import { zoneInfo } from '../time/index.ts';
import { buildChartModel, DEFAULT_DIMS, doyToX, minutesToY, plotOf } from './model.ts';

const PLOT = plotOf(DEFAULT_DIMS);

function detroit(): Results {
  return computeResults(2026, 42.3314, -83.0458, zoneInfo('America/Detroit'), DEFAULT_THRESHOLDS);
}

function modelFor(index: 0 | 1 | 2) {
  const results = detroit();
  return buildChartModel(results.series[index], results.stats[index], results.thresholds);
}

describe('scales', () => {
  it('maps midnight to the top of the plot and the next midnight to the bottom', () => {
    expect(minutesToY(0, PLOT)).toBe(PLOT.y);
    expect(minutesToY(1440, PLOT)).toBe(PLOT.y + PLOT.height);
    expect(minutesToY(720, PLOT)).toBe(PLOT.y + PLOT.height / 2);
  });

  it('spans the full plot width across the year', () => {
    expect(doyToX(0, 365, PLOT)).toBe(PLOT.x);
    expect(doyToX(364, 365, PLOT)).toBe(PLOT.x + PLOT.width);
  });

  it('does not divide by zero for a degenerate series', () => {
    expect(doyToX(0, 1, PLOT)).toBe(PLOT.x);
  });

  it('keeps early times above late times', () => {
    // The orientation is load-bearing for how the thresholds read.
    expect(minutesToY(4 * 60, PLOT)).toBeLessThan(minutesToY(20 * 60, PLOT));
  });
});

describe('band path', () => {
  it('is a closed path starting with a move', () => {
    const model = modelFor(2);
    expect(model.bandPath.startsWith('M')).toBe(true);
    expect(model.bandPath.endsWith('Z')).toBe(true);
  });

  it('has one point per day on each edge', () => {
    const model = modelFor(2);
    const commands = model.bandPath.match(/[ML]/g) ?? [];
    expect(commands.length).toBe(365 * 2);
  });

  it('contains no curve commands, so DST steps stay visible', () => {
    const model = modelFor(0);
    expect(model.bandPath).not.toMatch(/[CSQTA]/);
  });

  it('traces sunrise left to right and sunset right to left', () => {
    const model = modelFor(1);
    const sunriseStart = model.sunrisePath.slice(1).split(' ')[0];
    expect(model.bandPath.slice(1).split(' ')[0]).toBe(sunriseStart);
  });
});

describe('threshold lines', () => {
  it('places both thresholds and carries their counts', () => {
    const model = modelFor(2);
    const early = model.thresholdLines.find((t) => t.id === 'early-sunrise');
    const late = model.thresholdLines.find((t) => t.id === 'late-sunset');
    expect(early?.label).toBe('4:00 AM');
    expect(late?.label).toBe('8:00 PM');
    expect(late?.dayCount).toBe(155);
    expect(early?.dayCount).toBe(0);
  });

  it('moves when the thresholds move', () => {
    const results = detroit();
    const shifted = buildChartModel(results.series[2], results.stats[2], {
      ...DEFAULT_THRESHOLDS,
      lateSunsetMinutes: 21 * 60,
    });
    const base = modelFor(2);
    const baseLate = base.thresholdLines.find((t) => t.id === 'late-sunset');
    const shiftedLate = shifted.thresholdLines.find((t) => t.id === 'late-sunset');
    expect(shiftedLate?.y).toBeGreaterThan(baseLate?.y ?? 0);
    expect(shiftedLate?.label).toBe('9:00 PM');
  });
});

describe('trip zones', () => {
  it('covers the region above the early threshold and below the late one', () => {
    const model = modelFor(2);
    const early = model.tripZones.find((z) => z.id === 'early-sunrise');
    const late = model.tripZones.find((z) => z.id === 'late-sunset');
    expect(early?.y).toBe(PLOT.y);
    expect(early?.height).toBeCloseTo(minutesToY(4 * 60, PLOT) - PLOT.y, 6);
    expect(late?.y).toBeCloseTo(minutesToY(20 * 60, PLOT), 6);
    expect((late?.y ?? 0) + (late?.height ?? 0)).toBeCloseTo(PLOT.y + PLOT.height, 6);
  });

  it('spans the full plot width', () => {
    for (const zone of modelFor(2).tripZones) {
      expect(zone.x).toBe(PLOT.x);
      expect(zone.width).toBe(PLOT.width);
    }
  });
});

describe('DST transition markers', () => {
  it('marks both transitions on the current-law chart', () => {
    const model = modelFor(0);
    expect(model.transitions.map((t) => t.label)).toEqual(['Clocks forward', 'Clocks back']);
    const [forward, back] = model.transitions;
    expect(forward?.x).toBeLessThan(back?.x ?? 0);
  });

  it('marks none on the two permanent charts', () => {
    expect(modelFor(1).transitions).toEqual([]);
    expect(modelFor(2).transitions).toEqual([]);
  });

  it('marks none for a zone that does not observe DST', () => {
    const phoenix = computeResults(
      2026,
      33.4484,
      -112.074,
      zoneInfo('America/Phoenix'),
      DEFAULT_THRESHOLDS,
    );
    const model = buildChartModel(phoenix.series[0], phoenix.stats[0], phoenix.thresholds);
    expect(model.transitions).toEqual([]);
  });
});

describe('axes', () => {
  it('labels twelve months across the x axis', () => {
    const model = modelFor(2);
    expect(model.xTicks.length).toBe(12);
    expect(model.xTicks[0]?.label).toBe('Jan');
    expect(model.xTicks[11]?.label).toBe('Dec');
    expect(model.xTicks[0]?.position).toBe(PLOT.x);
  });

  it('labels the y axis every three hours, midnight to midnight', () => {
    const model = modelFor(2);
    expect(model.yTicks.length).toBe(9);
    expect(model.yTicks[0]?.label).toBe('12:00 AM');
    expect(model.yTicks[4]?.label).toBe('12:00 PM');
    expect(model.yTicks[8]?.label).toBe('12:00 AM');
    expect(model.yTicks[8]?.position).toBe(PLOT.y + PLOT.height);
  });
});

describe('summary', () => {
  it('states both headline counts in prose', () => {
    const model = modelFor(2);
    expect(model.summary).toContain('155 of 365 days have sunset after 8:00 PM');
    expect(model.summary).toContain('No days have sunrise before 4:00 AM');
  });

  it('names the scenario and the extremes', () => {
    const model = modelFor(1);
    expect(model.summary).toContain('Permanent standard time');
    expect(model.summary).toContain('Sunrise ranges from');
    expect(model.summary).toContain('Sunset ranges from');
  });

  it('gives the date range of the counted days', () => {
    const results = computeResults(
      2026,
      44.9065,
      -66.9899,
      zoneInfo('America/New_York'),
      DEFAULT_THRESHOLDS,
    );
    const model = buildChartModel(results.series[1], results.stats[1], results.thresholds);
    expect(model.summary).toContain('66 of 365 days have sunrise before 4:00 AM');
    expect(model.summary).toContain('May 15 to July 19');
  });
});

describe('model identity', () => {
  it('carries the scenario id so SVG element ids stay unique per chart', () => {
    // Three charts share one page; duplicated ids silently break clip-path.
    expect(modelFor(0).scenarioId).toBe('current');
    expect(modelFor(1).scenarioId).toBe('permanent-standard');
    expect(modelFor(2).scenarioId).toBe('permanent-dst');
  });
});
