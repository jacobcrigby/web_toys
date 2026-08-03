// SPDX-License-Identifier: Apache-2.0
import type { ChartModel } from '../chart/index.ts';
import { h, svg } from './dom.ts';

/**
 * Render a chart model as SVG.
 *
 * Every id is suffixed with the scenario id: three charts share one document,
 * and duplicated ids make `clip-path` references resolve to the wrong element
 * without any error.
 */
export function renderChart(model: ChartModel, titleText: string): SVGSVGElement {
  const { dims, plot, scenarioId } = model;
  const titleId = `chart-title-${scenarioId}`;
  const descId = `chart-desc-${scenarioId}`;
  const hatchId = `hatch-${scenarioId}`;

  const root = svg('svg', {
    class: 'chart',
    viewBox: `0 0 ${dims.width} ${dims.height}`,
    role: 'img',
    'aria-labelledby': `${titleId} ${descId}`,
    preserveAspectRatio: 'xMidYMid meet',
  });

  root.append(
    svg('title', { id: titleId }, [titleText]),
    svg('desc', { id: descId }, [model.summary]),
  );

  const defs = svg('defs');
  // Texture is the secondary channel for the threshold regions, so the
  // highlight survives colour-blindness, greyscale printing, and forced colours.
  const pattern = svg('pattern', {
    id: hatchId,
    patternUnits: 'userSpaceOnUse',
    width: '6',
    height: '6',
    patternTransform: 'rotate(45)',
  });
  pattern.append(svg('line', { class: 'chart__hatch', x1: '0', y1: '0', x2: '0', y2: '6' }));
  defs.append(pattern);

  for (const zone of model.tripZones) {
    const clip = svg('clipPath', { id: `trip-${zone.id}-${scenarioId}` });
    clip.append(
      svg('rect', {
        x: String(zone.x),
        y: String(zone.y),
        width: String(zone.width),
        height: String(zone.height),
      }),
    );
    defs.append(clip);
  }

  // Geometry lives in defs carrying no fill or stroke of its own. A <use> clone
  // only inherits a paint property from the <use> element when the referenced
  // element does not specify one, so styling these directly would make every
  // clone identical and silently defeat the threshold highlighting.
  const bandId = `band-${scenarioId}`;
  const sunriseId = `sunrise-${scenarioId}`;
  const sunsetId = `sunset-${scenarioId}`;
  defs.append(
    svg('path', { id: bandId, d: model.bandPath }),
    svg('path', { id: sunriseId, d: model.sunrisePath, fill: 'none' }),
    svg('path', { id: sunsetId, d: model.sunsetPath, fill: 'none' }),
  );
  root.append(defs);

  // Faint full-width bands mark the threshold regions even where the daylight
  // band does not reach them.
  for (const zone of model.tripZones) {
    if (zone.height <= 0) {
      continue;
    }
    root.append(
      svg('rect', {
        class: 'chart__zone',
        x: String(zone.x),
        y: String(zone.y),
        width: String(zone.width),
        height: String(zone.height),
      }),
    );
  }

  const grid = svg('g', { 'aria-hidden': 'true' });
  for (const tick of model.yTicks) {
    grid.append(
      svg('line', {
        class: 'chart__grid',
        x1: String(plot.x),
        y1: String(tick.position),
        x2: String(plot.x + plot.width),
        y2: String(tick.position),
      }),
      svg(
        'text',
        {
          class: 'chart__label chart__label--y',
          x: String(plot.x - 6),
          y: String(tick.position + 3),
        },
        [tick.label],
      ),
    );
  }
  for (const tick of model.xTicks) {
    grid.append(
      svg(
        'text',
        {
          class: 'chart__label chart__label--x',
          x: String(tick.position),
          y: String(plot.y + plot.height + 14),
        },
        [tick.label],
      ),
    );
  }
  root.append(grid);

  root.append(svg('use', { href: `#${bandId}`, class: 'chart__band' }));

  for (const zone of model.tripZones) {
    if (zone.dayCount === 0 || zone.height <= 0) {
      continue;
    }
    const clipRef = `url(#trip-${zone.id}-${scenarioId})`;
    root.append(
      svg('use', { href: `#${bandId}`, class: 'chart__band--trip', 'clip-path': clipRef }),
      svg('use', { href: `#${bandId}`, fill: `url(#${hatchId})`, 'clip-path': clipRef }),
    );
  }

  root.append(
    svg('use', { href: `#${sunriseId}`, class: 'chart__edge' }),
    svg('use', { href: `#${sunsetId}`, class: 'chart__edge' }),
  );

  // Highlight the tripping stretch of the curve itself. Where a threshold is
  // only just crossed the filled sliver is a couple of pixels tall — at
  // Eastport the sunrise clears 4:00 AM by 19 minutes on 66 days — so without
  // this the headline case would be nearly invisible.
  for (const zone of model.tripZones) {
    if (zone.dayCount === 0 || zone.height <= 0) {
      continue;
    }
    root.append(
      svg('use', {
        href: `#${zone.id === 'early-sunrise' ? sunriseId : sunsetId}`,
        class: 'chart__edge chart__edge--trip',
        'clip-path': `url(#trip-${zone.id}-${scenarioId})`,
      }),
    );
  }

  for (const transition of model.transitions) {
    root.append(
      svg('line', {
        class: 'chart__transition',
        x1: String(transition.x),
        y1: String(plot.y),
        x2: String(transition.x),
        y2: String(plot.y + plot.height),
      }),
      svg(
        'text',
        {
          class: 'chart__transition-label',
          x: String(transition.x),
          y: String(plot.y - 2),
        },
        [transition.label],
      ),
    );
  }

  for (const line of model.thresholdLines) {
    root.append(
      svg('line', {
        class: 'chart__threshold',
        x1: String(plot.x),
        y1: String(line.y),
        x2: String(plot.x + plot.width),
        y2: String(line.y),
      }),
      svg(
        'text',
        {
          class: 'chart__threshold-label',
          x: String(plot.x + plot.width + 6),
          y: String(line.y + 3),
        },
        [line.label],
      ),
    );
  }

  root.append(
    svg('rect', {
      class: 'chart__axis',
      x: String(plot.x),
      y: String(plot.y),
      width: String(plot.width),
      height: String(plot.height),
    }),
  );

  return root;
}

/** Legend for the chart, so the two fills are never identified by colour alone. */
export function renderChartLegend(): HTMLElement {
  return h('p', { class: 'chart-legend' }, [
    h('span', { class: 'chart-legend__item' }, [
      h('span', { class: 'chart-legend__swatch chart-legend__swatch--day' }),
      'Daylight',
    ]),
    h('span', { class: 'chart-legend__item' }, [
      h('span', { class: 'chart-legend__swatch chart-legend__swatch--trip' }),
      'Past a threshold (hatched)',
    ]),
  ]);
}
