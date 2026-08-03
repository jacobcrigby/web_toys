// SPDX-License-Identifier: Apache-2.0
import 'leaflet/dist/leaflet.css';
import * as L from 'leaflet';
import { CONUS_BBOX, CONUS_CENTER } from '../geo/index.ts';
import { onThemeChange, prefersDark } from './theme.ts';

/**
 * OpenStreetMap-derived basemaps from CARTO.
 *
 * The OSM Foundation's own tile servers ask third-party applications not to use
 * them, and CARTO additionally publishes matching light and dark styles, which
 * this page needs for its two colour schemes.
 */
const TILE_URL = 'https://{s}.basemaps.cartocdn.com/{style}/{z}/{x}/{y}{r}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors ' +
  '&copy; <a href="https://carto.com/attributions">CARTO</a>';

/**
 * Deliberately exposes no zoom getter. Leaflet's animated `setView` leaves
 * `getZoom()` returning the previous value until the animation settles, so
 * polling it wrote stale zooms into the URL. Zoom reaches the caller through
 * `MapHandlers.onZoom` instead.
 */
export interface MapHandle {
  setSelection(latitude: number, longitude: number): void;
  panTo(latitude: number, longitude: number, zoom?: number): void;
  invalidateSize(): void;
}

function tileLayer(dark: boolean): L.TileLayer {
  return L.tileLayer(TILE_URL.replace('{style}', dark ? 'dark_all' : 'light_all'), {
    subdomains: 'abcd',
    minZoom: 3,
    maxZoom: 12,
    attribution: ATTRIBUTION,
    // The {r} placeholder already serves CARTO's 512px @2x tiles at the same
    // extent. detectRetina would additionally shift zoomOffset and double-scale.
  });
}

export interface MapHandlers {
  onSelect(latitude: number, longitude: number): void;
  /** Fires after a zoom settles, so the caller can keep its own state in step. */
  onZoom(zoom: number): void;
}

export function createMap(
  container: HTMLElement,
  initial: { latitude: number; longitude: number; zoom: number },
  handlers: MapHandlers,
): MapHandle {
  const map = L.map(container, {
    center: [initial.latitude, initial.longitude],
    zoom: initial.zoom,
    minZoom: 3,
    maxZoom: 12,
    maxBounds: L.latLngBounds(
      [CONUS_BBOX.minLat - 6, CONUS_BBOX.minLon - 8],
      [CONUS_BBOX.maxLat + 6, CONUS_BBOX.maxLon + 8],
    ),
    maxBoundsViscosity: 0.8,
    worldCopyJump: false,
  });

  let layer = tileLayer(prefersDark()).addTo(map);
  onThemeChange((dark) => {
    map.removeLayer(layer);
    layer = tileLayer(dark).addTo(map);
  });

  // A circleMarker is plain SVG. Leaflet's default marker icon resolves its PNG
  // from the stylesheet location and 404s under a non-root Vite base.
  let marker: L.CircleMarker | null = null;

  map.on('click', (event: L.LeafletMouseEvent) => {
    handlers.onSelect(event.latlng.lat, event.latlng.lng);
  });

  // Zoom animations mean getZoom() lags a setView call, so the caller must not
  // poll it. Report the settled value instead.
  map.on('zoomend', () => {
    handlers.onZoom(map.getZoom());
  });

  window.addEventListener('resize', () => {
    map.invalidateSize();
  });

  return {
    setSelection(latitude, longitude) {
      if (marker === null) {
        marker = L.circleMarker([latitude, longitude], {
          radius: 7,
          className: 'selection-marker',
        }).addTo(map);
      } else {
        marker.setLatLng([latitude, longitude]);
      }
    },
    panTo(latitude, longitude, zoom) {
      map.setView([latitude, longitude], zoom ?? map.getZoom());
    },
    invalidateSize() {
      map.invalidateSize();
    },
  };
}

export { CONUS_CENTER };
