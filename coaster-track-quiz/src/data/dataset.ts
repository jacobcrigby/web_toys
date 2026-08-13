// SPDX-License-Identifier: Apache-2.0

import { COASTERS } from './coasters.generated.ts';
import { MANUFACTURER_LIST, MANUFACTURERS } from './manufacturers.ts';
import { TRACK_FAMILIES, TRACK_FAMILY_LIST } from './track-families.ts';
import type { Coaster, Manufacturer, ManufacturerId, TrackFamily, TrackFamilyId } from './types.ts';
import { MANUFACTURER_IDS } from './types.ts';

export interface Dataset {
  readonly coasters: readonly Coaster[];
  readonly manufacturers: readonly Manufacturer[];
  readonly families: readonly TrackFamily[];
  /** Only manufacturers that actually have curated photos — the quiz never asks about others. */
  readonly askableManufacturers: readonly ManufacturerId[];
  coastersFor(manufacturer: ManufacturerId): readonly Coaster[];
  manufacturer(id: ManufacturerId): Manufacturer;
  family(id: TrackFamilyId): TrackFamily;
  coaster(id: string): Coaster | undefined;
}

export function buildDataset(coasters: readonly Coaster[] = COASTERS): Dataset {
  const byManufacturer = new Map<ManufacturerId, Coaster[]>();
  const byId = new Map<string, Coaster>();

  for (const coaster of coasters) {
    let bucket = byManufacturer.get(coaster.manufacturer);
    if (!bucket) {
      bucket = [];
      byManufacturer.set(coaster.manufacturer, bucket);
    }
    bucket.push(coaster);
    byId.set(coaster.id, coaster);
  }

  const askable = MANUFACTURER_IDS.filter((id) => (byManufacturer.get(id)?.length ?? 0) > 0);

  return {
    coasters,
    manufacturers: MANUFACTURER_LIST,
    families: TRACK_FAMILY_LIST,
    askableManufacturers: askable,
    coastersFor: (manufacturer) => byManufacturer.get(manufacturer) ?? [],
    manufacturer: (id) => MANUFACTURERS[id],
    family: (id) => TRACK_FAMILIES[id],
    coaster: (id) => byId.get(id),
  };
}

export const DATASET: Dataset = buildDataset();
