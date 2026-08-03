// SPDX-License-Identifier: Apache-2.0

import { PRESETS, type Preset } from '../geo/index.ts';
import { type AppState, effectiveZone } from '../state.ts';
import type { Thresholds } from '../stats/index.ts';
import { CONUS_ZONES, formatClock, formatOffset, zoneInfo, zoneLabel } from '../time/index.ts';
import { h, qs } from './dom.ts';
import { coordText, renderComparison, renderScenarioCard } from './panel.ts';

export interface Actions {
  selectPreset(preset: Preset): void;
  setZoneOverride(zone: string | null): void;
  setThresholds(patch: Partial<Thresholds>): void;
  resetThresholds(): void;
  copyLink(): void;
}

export interface View {
  readonly mapContainer: HTMLElement;
  render(state: AppState): void;
}

const THRESHOLD_FIELDS: {
  key: keyof Thresholds;
  id: string;
  label: string;
  primary: boolean;
}[] = [
  { key: 'earlySunriseMinutes', id: 'th-rise', label: 'Sunrise earlier than', primary: true },
  { key: 'lateSunsetMinutes', id: 'th-set', label: 'Sunset later than', primary: true },
  { key: 'lateSunriseMinutes', id: 'th-late-rise', label: 'Sunrise later than', primary: false },
  { key: 'earlySunsetMinutes', id: 'th-early-set', label: 'Sunset earlier than', primary: false },
];

function timeField(field: (typeof THRESHOLD_FIELDS)[number], actions: Actions): HTMLLabelElement {
  const input = h('input', { type: 'time', id: field.id, step: '60' });
  input.addEventListener('change', () => {
    const parsed = input.value;
    const [hours, minutes] = parsed.split(':');
    if (hours === undefined || minutes === undefined) {
      return;
    }
    const total = Number(hours) * 60 + Number(minutes);
    if (Number.isFinite(total)) {
      actions.setThresholds({ [field.key]: total } as Partial<Thresholds>);
    }
  });
  return h('label', { class: 'field', for: field.id }, [field.label, input]);
}

/**
 * Build the page once and return a `render` that syncs it to state.
 *
 * The results column is rebuilt wholesale on each render. It is a few hundred
 * nodes and recompute is already sub-frame, so fine-grained diffing would buy
 * nothing and cost correctness.
 */
export function mount(root: HTMLElement, actions: Actions): View {
  root.replaceChildren();

  const mapContainer = h('div', { class: 'map', id: 'map' });
  const mapHint = h('p', { class: 'map-hint' }, ['Click anywhere to see that spot’s year']);
  const mapPane = h('div', { class: 'map-pane' }, [mapContainer, mapHint]);

  // Location card
  const coords = h('p', { class: 'location__coords' });
  const zoneChip = h('span', { class: 'zone-chip' });
  const zoneSelect = h('select', { id: 'zone-select', 'aria-label': 'Time zone' });
  zoneSelect.append(h('option', { value: '' }, ['Use detected zone']));
  for (const id of CONUS_ZONES.keys()) {
    const info = zoneInfo(id);
    zoneSelect.append(
      h('option', { value: id }, [
        `${id} — ${zoneLabel(info)} (${formatOffset(info.standardOffsetMinutes)})`,
      ]),
    );
  }
  zoneSelect.addEventListener('change', () => {
    actions.setZoneOverride(zoneSelect.value === '' ? null : zoneSelect.value);
  });

  const presetSelect = h('select', { id: 'preset-select', 'aria-label': 'Jump to a place' });
  presetSelect.append(h('option', { value: '' }, ['Jump to a place…']));
  for (const preset of PRESETS) {
    presetSelect.append(h('option', { value: preset.name }, [preset.name]));
  }
  presetSelect.addEventListener('change', () => {
    const preset = PRESETS.find((p) => p.name === presetSelect.value);
    if (preset) {
      actions.selectPreset(preset);
    }
    presetSelect.value = '';
  });

  const copyButton = h('button', { class: 'button', type: 'button' }, ['Copy link']);
  copyButton.addEventListener('click', () => {
    actions.copyLink();
  });

  const presetNote = h('p', { class: 'headline__detail' });
  const notice = h('p', { class: 'notice notice--empty' });

  const locationCard = h('section', { class: 'card location' }, [
    coords,
    h('div', { class: 'location__row' }, [zoneChip]),
    h('div', { class: 'location__row' }, [
      h('label', { class: 'field', for: 'zone-select' }, ['Time zone', zoneSelect]),
      h('label', { class: 'field', for: 'preset-select' }, ['Place', presetSelect]),
    ]),
    h('div', { class: 'location__row' }, [copyButton]),
    presetNote,
    notice,
  ]);

  // Threshold controls
  const primaryGrid = h('div', { class: 'controls__grid' });
  const secondaryGrid = h('div', { class: 'controls__grid' });
  for (const field of THRESHOLD_FIELDS) {
    (field.primary ? primaryGrid : secondaryGrid).append(timeField(field, actions));
  }
  const resetButton = h('button', { class: 'button', type: 'button' }, [
    'Reset to 4:00 AM / 8:00 PM',
  ]);
  resetButton.addEventListener('click', () => {
    actions.resetThresholds();
  });

  const controlsCard = h('section', { class: 'card' }, [
    h('h2', {}, ['Thresholds']),
    h('p', { class: 'masthead__lede' }, [
      'The two counts below the map use these times. Change them to ask a different question.',
    ]),
    primaryGrid,
    h('details', { class: 'controls__more' }, [
      h('summary', {}, ['Secondary thresholds']),
      secondaryGrid,
    ]),
    h('div', { class: 'location__row' }, [resetButton]),
  ]);

  const comparisonCard = h('section', { class: 'card' });
  const scenarios = h('div');
  const liveRegion = h('p', {
    class: 'visually-hidden',
    role: 'status',
    'aria-live': 'polite',
  });

  const footer = h('footer', { class: 'site-footer' }, [
    h('p', {}, [
      'Map tiles by CARTO, data © OpenStreetMap contributors. Time zones from tz-lookup, ' +
        'built from OpenStreetMap boundaries by timezone-boundary-builder.',
    ]),
    h('p', {}, [
      'Sunrise and sunset use the NOAA solar position algorithm at a sea-level horizon, ' +
        'accurate to about a minute. Elevation is not modelled, so a location with a low ' +
        'horizon to the east or west sees the sun a few minutes earlier or later than shown.',
    ]),
  ]);

  const results = h('div', { class: 'results' }, [
    locationCard,
    controlsCard,
    comparisonCard,
    scenarios,
    liveRegion,
    footer,
  ]);

  const app = h('div', { class: 'app' }, [
    h('header', { class: 'masthead' }, [
      h('h1', {}, ['Daylight Map']),
      h('p', { class: 'masthead__lede' }, [
        'Whether locking the clock is a good deal depends entirely on where you are. ' +
          'Click anywhere in the continental US to compare a year of sunrises and sunsets ' +
          'under today’s rules, permanent standard time, and permanent daylight saving time.',
      ]),
    ]),
    h('div', { class: 'workspace' }, [mapPane, results]),
  ]);

  root.append(app);

  function render(state: AppState): void {
    coords.textContent = coordText(state.latitude, state.longitude);

    const zone = effectiveZone(state);
    zoneChip.replaceChildren();
    if (zone === null) {
      zoneChip.append('No time zone here');
    } else {
      const info = zoneInfo(zone, state.year);
      zoneChip.append(
        h('span', { class: 'zone-chip__id' }, [zone]),
        `${zoneLabel(info)} · ${formatOffset(info.standardOffsetMinutes)} standard`,
      );
    }
    zoneSelect.value = state.zoneOverride ?? '';

    presetNote.textContent =
      state.zoneOverride !== null && state.zoneOverride !== state.detectedZone
        ? `Overriding the detected zone${state.detectedZone ? ` (${state.detectedZone})` : ''}.`
        : '';

    if (state.notice === null) {
      notice.className = 'notice notice--empty';
      notice.textContent = '';
    } else {
      notice.className = 'notice';
      notice.textContent = state.notice.message;
    }

    for (const field of THRESHOLD_FIELDS) {
      const input = qs<HTMLInputElement>(root, `#${field.id}`);
      const next = formatClock(state.thresholds[field.key]);
      if (input.value !== next) {
        input.value = next;
      }
    }

    comparisonCard.replaceChildren();
    scenarios.replaceChildren();

    if (state.results === null) {
      comparisonCard.append(
        h('h2', {}, ['Nothing to show yet']),
        h('p', { class: 'masthead__lede' }, [
          'Pick a point on land, or choose a time zone above to compute anyway.',
        ]),
      );
      liveRegion.textContent = 'No time zone at that point.';
      return;
    }

    comparisonCard.append(renderComparison(state.results));
    for (let index = 0; index < state.results.stats.length; index += 1) {
      scenarios.append(renderScenarioCard(state.results, index));
    }

    const [, standard, dst] = state.results.stats;
    liveRegion.textContent =
      `Computed for ${coordText(state.latitude, state.longitude)}. ` +
      `Permanent standard time: ${standard.daysSunriseBeforeEarly} days with sunrise before the early threshold. ` +
      `Permanent daylight saving time: ${dst.daysSunsetAfterLate} days with sunset after the late threshold.`;
  }

  return { mapContainer, render };
}
