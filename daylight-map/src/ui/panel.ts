// SPDX-License-Identifier: Apache-2.0
import { buildChartModel } from '../chart/index.ts';
import { doyToCivilDate } from '../solar/index.ts';
import type { Results, ScenarioStats } from '../stats/index.ts';
import {
  formatDuration,
  formatMonthDay,
  formatOffset,
  formatTimeOfDay,
  MONTH_ABBREVIATIONS,
} from '../time/index.ts';
import { renderChart, renderChartLegend } from './chart.ts';
import { h } from './dom.ts';

function coordText(latitude: number, longitude: number): string {
  const ns = latitude >= 0 ? 'N' : 'S';
  const ew = longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(latitude).toFixed(4)}° ${ns}, ${Math.abs(longitude).toFixed(4)}° ${ew}`;
}

/** "66 days" or "1 day". */
function dayCountText(count: number): string {
  return `${count} ${count === 1 ? 'day' : 'days'}`;
}

function spanText(spans: readonly { startDoy: number; endDoy: number }[], year: number): string {
  if (spans.length === 0) {
    return 'never';
  }
  const first = spans[0];
  if (first === undefined) {
    return 'never';
  }
  const range =
    first.startDoy === first.endDoy
      ? formatMonthDay(year, first.startDoy)
      : `${formatMonthDay(year, first.startDoy)} – ${formatMonthDay(year, first.endDoy)}`;
  return spans.length > 1 ? `${range}, +${spans.length - 1} more` : range;
}

/** The compact three-column comparison of the two headline numbers. */
export function renderComparison(results: Results): HTMLElement {
  const { thresholds, stats, year } = results;
  const table = h('table', { class: 'comparison' });

  table.append(
    h('caption', {}, [
      `Days per year at this location, based on ${year}. Highlighted rows are the two headline measures.`,
    ]),
  );

  const headRow = h('tr', {}, [h('th', { scope: 'col' }, ['Measure'])]);
  for (const s of stats) {
    headRow.append(h('th', { scope: 'col' }, [s.scenario.shortLabel]));
  }
  table.append(h('thead', {}, [headRow]));

  const rows: {
    label: string;
    headline: boolean;
    value: (s: ScenarioStats) => string;
  }[] = [
    {
      label: `Sunrise before ${formatTimeOfDay(thresholds.earlySunriseMinutes)}`,
      headline: true,
      value: (s) => String(s.daysSunriseBeforeEarly),
    },
    {
      label: `Sunset after ${formatTimeOfDay(thresholds.lateSunsetMinutes)}`,
      headline: true,
      value: (s) => String(s.daysSunsetAfterLate),
    },
    {
      label: `Sunrise after ${formatTimeOfDay(thresholds.lateSunriseMinutes)}`,
      headline: false,
      value: (s) => String(s.daysSunriseAfterLate),
    },
    {
      label: `Sunset before ${formatTimeOfDay(thresholds.earlySunsetMinutes)}`,
      headline: false,
      value: (s) => String(s.daysSunsetBeforeEarly),
    },
    {
      label: 'Earliest sunrise',
      headline: false,
      value: (s) => formatTimeOfDay(s.earliestSunrise.minutes),
    },
    {
      label: 'Latest sunrise',
      headline: false,
      value: (s) => formatTimeOfDay(s.latestSunrise.minutes),
    },
    {
      label: 'Latest sunset',
      headline: false,
      value: (s) => formatTimeOfDay(s.latestSunset.minutes),
    },
  ];

  const body = h('tbody');
  for (const row of rows) {
    const tr = h('tr', row.headline ? { 'data-headline': 'true' } : {}, [
      h('th', { scope: 'row' }, [row.label]),
    ]);
    for (const s of stats) {
      tr.append(h('td', {}, [row.value(s)]));
    }
    body.append(tr);
  }
  table.append(body);

  return table;
}

/** Sampled data table under each chart: the 1st and 15th of every month. */
function renderDataTable(results: Results, index: number): HTMLElement {
  const series = results.series[index];
  if (series === undefined) {
    return h('div');
  }
  const table = h('table', { class: 'data-table' });
  table.append(
    h('thead', {}, [
      h('tr', {}, [
        h('th', { scope: 'col' }, ['Date']),
        h('th', { scope: 'col' }, ['Sunrise']),
        h('th', { scope: 'col' }, ['Sunset']),
        h('th', { scope: 'col' }, ['Day length']),
      ]),
    ]),
  );

  const body = h('tbody');
  for (const day of series.days) {
    const date = doyToCivilDate(results.year, day.doy);
    if (date.day !== 1 && date.day !== 15) {
      continue;
    }
    body.append(
      h('tr', {}, [
        h('th', { scope: 'row' }, [`${MONTH_ABBREVIATIONS[date.month - 1]} ${date.day}`]),
        h('td', {}, [formatTimeOfDay(day.sunriseMinutes)]),
        h('td', {}, [formatTimeOfDay(day.sunsetMinutes)]),
        h('td', {}, [formatDuration(day.dayLengthMinutes)]),
      ]),
    );
  }
  table.append(body);

  return h('details', { class: 'data-table-wrap' }, [
    h('summary', {}, ['Show the numbers']),
    h('div', { class: 'data-table-scroll' }, [table]),
  ]);
}

function offsetSummary(results: Results, index: number): string {
  const series = results.series[index];
  if (series === undefined) {
    return '';
  }
  const rule = series.scenario.rule;
  if (rule.kind === 'fixed') {
    return `Clocks fixed at ${formatOffset(rule.offsetMinutes)} all year`;
  }
  return `${formatOffset(rule.standardOffsetMinutes)} in winter, ${formatOffset(
    rule.daylightOffsetMinutes,
  )} in summer`;
}

/** One scenario: headline numbers, supporting facts, chart, data table. */
export function renderScenarioCard(results: Results, index: number): HTMLElement {
  const stats = results.stats[index];
  const series = results.series[index];
  if (stats === undefined || series === undefined) {
    return h('section');
  }
  const { thresholds, year } = results;

  const card = h('section', { class: 'card scenario' });

  card.append(
    h('div', { class: 'scenario__head' }, [
      h('h2', {}, [stats.scenario.label]),
      h('span', { class: 'scenario__offset' }, [offsetSummary(results, index)]),
    ]),
  );

  card.append(
    h('div', { class: 'headline' }, [
      h('div', { class: 'headline__item' }, [
        h('div', { class: 'headline__value' }, [String(stats.daysSunriseBeforeEarly)]),
        h('div', { class: 'headline__label' }, [
          `days with sunrise before ${formatTimeOfDay(thresholds.earlySunriseMinutes)}`,
        ]),
        h('div', { class: 'headline__detail' }, [spanText(stats.earlySunriseSpans, year)]),
      ]),
      h('div', { class: 'headline__item' }, [
        h('div', { class: 'headline__value' }, [String(stats.daysSunsetAfterLate)]),
        h('div', { class: 'headline__label' }, [
          `days with sunset after ${formatTimeOfDay(thresholds.lateSunsetMinutes)}`,
        ]),
        h('div', { class: 'headline__detail' }, [spanText(stats.lateSunsetSpans, year)]),
      ]),
    ]),
  );

  const facts = h('dl', { class: 'facts' });
  const factRows: [string, string][] = [
    [
      'Earliest sunrise',
      `${formatTimeOfDay(stats.earliestSunrise.minutes)} · ${formatMonthDay(year, stats.earliestSunrise.doy)}`,
    ],
    [
      'Latest sunrise',
      `${formatTimeOfDay(stats.latestSunrise.minutes)} · ${formatMonthDay(year, stats.latestSunrise.doy)}`,
    ],
    [
      'Earliest sunset',
      `${formatTimeOfDay(stats.earliestSunset.minutes)} · ${formatMonthDay(year, stats.earliestSunset.doy)}`,
    ],
    [
      'Latest sunset',
      `${formatTimeOfDay(stats.latestSunset.minutes)} · ${formatMonthDay(year, stats.latestSunset.doy)}`,
    ],
    [
      `Sunrise after ${formatTimeOfDay(thresholds.lateSunriseMinutes)}`,
      dayCountText(stats.daysSunriseAfterLate),
    ],
    [
      `Sunset before ${formatTimeOfDay(thresholds.earlySunsetMinutes)}`,
      dayCountText(stats.daysSunsetBeforeEarly),
    ],
  ];
  for (const [term, value] of factRows) {
    facts.append(h('div', {}, [h('dt', {}, [term]), h('dd', {}, [value])]));
  }
  card.append(facts);

  const model = buildChartModel(series, stats, thresholds);
  card.append(
    renderChart(model, `${stats.scenario.label}: sunrise and sunset through ${year}`),
    renderChartLegend(),
    renderDataTable(results, index),
  );

  return card;
}

export { coordText };
