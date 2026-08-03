// SPDX-License-Identifier: Apache-2.0
import {
  CONUS_CENTER,
  classifyPoint,
  lookupZone,
  type PointClass,
  type Preset,
} from './geo/index.ts';
import { type AppState, effectiveZone, type Notice } from './state.ts';
import {
  computeResults,
  DEFAULT_THRESHOLDS,
  type Results,
  type Thresholds,
} from './stats/index.ts';
import { CONUS_ZONES, zoneInfo } from './time/index.ts';
import { createMap, type MapHandle } from './ui/map.ts';
import { mount, type View } from './ui/render.ts';
import { parseHash, serializeHash } from './url.ts';

const DEFAULT_PRESET = { latitude: 42.3314, longitude: -83.0458, zoom: 5 };

function noticeFor(
  pointClass: PointClass,
  detectedZone: string | null,
  override: string | null,
): Notice | null {
  // An override already answers whatever the classifier objected to, so say
  // what is actually being used rather than repeating the objection.
  if (override !== null) {
    if (pointClass.kind === 'conus' && override === detectedZone) {
      return null;
    }
    const detected =
      pointClass.kind === 'no-land-zone' || detectedZone === null
        ? 'No time zone was detected at that point'
        : `Zone detection placed that point in ${detectedZone}`;
    return { kind: 'info', message: `${detected}. Using ${override} instead.` };
  }

  switch (pointClass.kind) {
    case 'conus':
      return null;
    case 'non-us-zone':
      return {
        kind: 'warning',
        message:
          `That point is outside the continental US — it resolved to ${pointClass.zone}. ` +
          'The scenarios below apply US clock rules to that zone’s standard offset. ' +
          'Detection is approximate near borders, so if you meant a US location, pick its ' +
          'time zone above.',
      };
    case 'outside-bbox':
      return {
        kind: 'info',
        message:
          `That point is outside the continental US, but sits in ${pointClass.zone}. ` +
          'The statistics below still apply to it.',
      };
    case 'no-land-zone':
      return {
        kind: 'warning',
        message:
          'There is no time zone at that point — it is open ocean. Pick a point on land, ' +
          'or choose a time zone above to compute anyway.',
      };
  }
}

/**
 * Owns application state. Every mutation goes through `commit`, which
 * recomputes what changed, re-renders, and syncs the URL.
 */
export class DaylightController {
  private state: AppState;
  private readonly view: View;
  private map: MapHandle | null = null;

  constructor(root: HTMLElement) {
    const year = new Date().getFullYear();
    const initial = parseHash(window.location.hash, year);

    const latitude = initial?.latitude ?? DEFAULT_PRESET.latitude;
    const longitude = initial?.longitude ?? DEFAULT_PRESET.longitude;
    const detectedZone = lookupZone(latitude, longitude);

    this.state = {
      latitude,
      longitude,
      zoom: initial?.zoom ?? DEFAULT_PRESET.zoom,
      year: initial?.year ?? year,
      detectedZone,
      zoneOverride: initial?.zone ?? null,
      pointClass: classifyPoint(latitude, longitude, detectedZone),
      thresholds: initial?.thresholds ?? DEFAULT_THRESHOLDS,
      results: null,
      notice: null,
    };

    this.view = mount(root, {
      selectPreset: (preset) => this.selectPreset(preset),
      setZoneOverride: (zone) => this.setZoneOverride(zone),
      setThresholds: (patch) => this.setThresholds(patch),
      resetThresholds: () => this.setThresholds(DEFAULT_THRESHOLDS),
      copyLink: () => this.copyLink(),
    });
  }

  init(): void {
    this.map = createMap(
      this.view.mapContainer,
      { latitude: this.state.latitude, longitude: this.state.longitude, zoom: this.state.zoom },
      {
        onSelect: (latitude, longitude) => this.selectPoint(latitude, longitude),
        onZoom: (zoom) => this.setZoom(zoom),
      },
    );

    window.addEventListener('hashchange', () => this.applyHash());

    this.commit(this.recomputed(this.state));
    this.map.setSelection(this.state.latitude, this.state.longitude);
    // The map is created inside a grid cell that may still be settling.
    requestAnimationFrame(() => this.map?.invalidateSize());
  }

  /** Rebuild derived state — results and notice — from the inputs. */
  private recomputed(state: AppState): AppState {
    const zone = effectiveZone(state);
    let results: Results | null = null;
    if (zone !== null) {
      try {
        results = computeResults(
          state.year,
          state.latitude,
          state.longitude,
          zoneInfo(zone, state.year),
          state.thresholds,
        );
      } catch {
        results = null;
      }
    }
    return {
      ...state,
      results,
      notice: noticeFor(state.pointClass, state.detectedZone, state.zoneOverride),
    };
  }

  private commit(next: AppState): void {
    this.state = next;
    this.view.render(this.state);
    this.syncHash();
  }

  private syncHash(): void {
    const hash = serializeHash({
      latitude: this.state.latitude,
      longitude: this.state.longitude,
      zoom: this.state.zoom,
      zone: this.state.zoneOverride,
      thresholds: this.state.thresholds,
      year: this.state.year,
    });
    if (hash !== window.location.hash) {
      window.history.replaceState(null, '', hash);
    }
  }

  /** Track the map's zoom without recomputing anything. */
  private setZoom(zoom: number): void {
    if (zoom === this.state.zoom) {
      return;
    }
    this.state = { ...this.state, zoom };
    this.syncHash();
  }

  private applyHash(): void {
    const parsed = parseHash(window.location.hash, this.state.year);
    if (parsed === null) {
      return;
    }
    if (
      parsed.latitude === this.state.latitude &&
      parsed.longitude === this.state.longitude &&
      parsed.zone === this.state.zoneOverride
    ) {
      return;
    }
    const detectedZone = lookupZone(parsed.latitude, parsed.longitude);
    // Move the map before committing: syncHash reads the live map zoom, so
    // panning afterwards would write the previous zoom back into the URL.
    this.map?.panTo(parsed.latitude, parsed.longitude, parsed.zoom);
    this.map?.setSelection(parsed.latitude, parsed.longitude);
    this.commit(
      this.recomputed({
        ...this.state,
        latitude: parsed.latitude,
        longitude: parsed.longitude,
        zoom: parsed.zoom,
        year: parsed.year,
        thresholds: parsed.thresholds,
        detectedZone,
        zoneOverride: parsed.zone,
        pointClass: classifyPoint(parsed.latitude, parsed.longitude, detectedZone),
      }),
    );
  }

  private selectPoint(latitude: number, longitude: number): void {
    const detectedZone = lookupZone(latitude, longitude);
    this.commit(
      this.recomputed({
        ...this.state,
        latitude,
        longitude,
        detectedZone,
        // A new point gets a fresh detection; a stale override from somewhere
        // else on the map would silently misreport the new location.
        zoneOverride: null,
        pointClass: classifyPoint(latitude, longitude, detectedZone),
      }),
    );
    this.map?.setSelection(latitude, longitude);
  }

  private selectPreset(preset: Preset): void {
    const detectedZone = lookupZone(preset.latitude, preset.longitude);
    // Presets carry their own zone because the raster misplaces a few of them,
    // notably the eastern tip of Maine. Set an override whenever the two differ
    // so the preset shows the zone the place actually keeps.
    const zoneOverride = detectedZone === preset.zone ? null : preset.zone;
    this.commit(
      this.recomputed({
        ...this.state,
        latitude: preset.latitude,
        longitude: preset.longitude,
        detectedZone,
        zoneOverride,
        pointClass: classifyPoint(preset.latitude, preset.longitude, detectedZone),
      }),
    );
    this.map?.panTo(preset.latitude, preset.longitude, Math.max(this.state.zoom, 6));
    this.map?.setSelection(preset.latitude, preset.longitude);
  }

  private setZoneOverride(zone: string | null): void {
    if (zone !== null && !CONUS_ZONES.has(zone)) {
      return;
    }
    this.commit(this.recomputed({ ...this.state, zoneOverride: zone }));
  }

  private setThresholds(patch: Partial<Thresholds>): void {
    const thresholds = { ...this.state.thresholds, ...patch };
    // Thresholds never affect the solar year, only the counts derived from it.
    this.commit(this.recomputed({ ...this.state, thresholds }));
  }

  private copyLink(): void {
    void navigator.clipboard?.writeText(window.location.href);
  }
}

export { CONUS_CENTER };
