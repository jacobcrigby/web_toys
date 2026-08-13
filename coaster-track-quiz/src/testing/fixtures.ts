// SPDX-License-Identifier: Apache-2.0
//
// Synthetic coasters for the engine tests. Deliberately not the real curated dataset: the
// engine must be testable before curation finishes, and its behaviour should not change when a
// photo is swapped. Real data is covered separately by data/dataset.test.ts.
//
// Not imported by any application module, so it never reaches the bundle.

import { buildDataset, type Dataset } from '../data/dataset.ts';
import { MANUFACTURERS } from '../data/manufacturers.ts';
import { TRACK_FAMILIES } from '../data/track-families.ts';
import type { Coaster, CoasterImage, ManufacturerId, TrackFamilyId } from '../data/types.ts';
import { MANUFACTURER_IDS } from '../data/types.ts';

function image(kind: 'closeup' | 'context', slug: string): CoasterImage {
  return {
    kind,
    url: `https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/${slug}.jpg/1024px-${slug}.jpg`,
    width: 1024,
    height: 768,
    blindAlt: 'Steel track seen from below',
    attribution: {
      author: 'Test Photographer',
      licenseShortName: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      descriptionUrl: `https://commons.wikimedia.org/wiki/File:${slug}.jpg`,
      fileName: `File:${slug}.jpg`,
      description: 'A test photograph',
    },
  };
}

export interface FixtureOptions {
  /** Coasters generated per manufacturer. */
  readonly perManufacturer?: number;
  /** Manufacturers to include. Defaults to all eight. */
  readonly manufacturers?: readonly ManufacturerId[];
  /** When true, every coaster gets a context photo so `canHint` is always true. */
  readonly withContext?: boolean;
}

export function fixtureCoasters(options: FixtureOptions = {}): Coaster[] {
  const { perManufacturer = 6, manufacturers = MANUFACTURER_IDS, withContext = true } = options;
  const coasters: Coaster[] = [];

  for (const manufacturerId of manufacturers) {
    const families = MANUFACTURERS[manufacturerId].families;

    for (let i = 0; i < perManufacturer; i += 1) {
      const familyId = families[i % families.length] as TrackFamilyId;
      const id = `${manufacturerId}-${i}`;
      coasters.push({
        id,
        name: `Test Coaster ${id}`,
        park: `Test Park ${i}`,
        country: 'Testland',
        opened: 2000 + i,
        rcdbId: String(10000 + coasters.length),
        manufacturer: manufacturerId,
        family: TRACK_FAMILIES[familyId].id,
        closeup: image('closeup', `Closeup_${id}`),
        context: withContext ? image('context', `Context_${id}`) : null,
      });
    }
  }

  return coasters;
}

export function fixtureDataset(options: FixtureOptions = {}): Dataset {
  return buildDataset(fixtureCoasters(options));
}
