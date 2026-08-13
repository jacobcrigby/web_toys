// SPDX-License-Identifier: Apache-2.0
//
// Hand-written. This file and track-families.ts are the teaching content; everything in
// coasters.generated.ts is machine-derived facts. Re-running `pnpm data:emit` never touches
// these two files.

import type { Manufacturer, ManufacturerId } from './types.ts';

export const MANUFACTURERS: Readonly<Record<ManufacturerId, Manufacturer>> = {
  'bolliger-mabillard': {
    id: 'bolliger-mabillard',
    name: 'Bolliger & Mabillard',
    shortName: 'B&M',
    country: 'Switzerland',
    founded: 1988,
    blurb:
      'Founded by two ex-Intamin engineers in Monthey. Builds big, smooth, heavily engineered ' +
      'steel coasters and invented or popularised most of the modern layouts — inverted, ' +
      'floorless, flying, wing and dive. The track is overbuilt on purpose, which is why it ' +
      'is the easiest of all the makers to recognise once you know what a box spine looks like.',
    families: ['bm-box-spine', 'bm-inverted'],
  },

  intamin: {
    id: 'intamin',
    name: 'Intamin',
    shortName: 'Intamin',
    country: 'Liechtenstein',
    founded: 1967,
    blurb:
      'The record-chasers. Intamin built the first modern hyper, the first strata coasters and ' +
      'most of the early hydraulic launches. Their steel track is noticeably lighter and ' +
      'skinnier than B&M for the same size of ride, and they are the only major maker who also ' +
      'builds prefabricated wooden track.',
    families: ['intamin-box-spine', 'intamin-prefab-wood'],
  },

  'rocky-mountain': {
    id: 'rocky-mountain',
    name: 'Rocky Mountain Construction',
    shortName: 'RMC',
    country: 'United States',
    founded: 2001,
    blurb:
      'Made their name converting worn-out wooden coasters into steel-tracked hybrids that ' +
      'invert. If a ride looks like a woodie but rolls upside down and takes its transitions ' +
      'perfectly smoothly, it is almost certainly RMC. They also build an all-steel single-rail ' +
      'track that looks like nothing else in the industry.',
    families: ['rmc-ibox', 'rmc-topper', 'rmc-raptor'],
  },

  vekoma: {
    id: 'vekoma',
    name: 'Vekoma',
    shortName: 'Vekoma',
    country: 'Netherlands',
    founded: 1926,
    blurb:
      'Originally a steel fabricator for the mining industry, hence the name. For decades ' +
      'Vekoma meant mass-produced catalogue models with a reputation for roughness. Since the ' +
      'mid-2010s they have rebuilt their whole track system and now produce some of the ' +
      'smoothest steel coasters made — which is exactly what makes them hard to tell from B&M.',
    families: ['vekoma-classic', 'vekoma-slc', 'vekoma-modern'],
  },

  'arrow-dynamics': {
    id: 'arrow-dynamics',
    name: 'Arrow Dynamics',
    shortName: 'Arrow',
    country: 'United States',
    founded: 1946,
    blurb:
      'The company that started modern steel coasters — tubular track, the mine train, the ' +
      'first modern vertical loop, the first suspended coaster. Went bankrupt in 2002, so ' +
      'everything they built is old, and the track shows it: a plain round pipe with a ladder ' +
      'of cross ties, and angular shaping that predates computer-modelled transitions.',
    families: ['arrow-tubular', 'arrow-mine-train'],
  },

  'mack-rides': {
    id: 'mack-rides',
    name: 'Mack Rides',
    shortName: 'Mack',
    country: 'Germany',
    founded: 1780,
    blurb:
      'A family firm that has been building rides since horse-drawn carnival wagons, and which ' +
      'also owns Europa-Park. Their steel coasters sit visually between B&M and Intamin: box ' +
      'spine, but lighter than B&M and tidier than Intamin, with unusually clean fabrication.',
    families: ['mack-box-spine'],
  },

  gci: {
    id: 'gci',
    name: 'Great Coasters International',
    shortName: 'GCI',
    country: 'United States',
    founded: 1994,
    blurb:
      'Wood only. GCI builds dense, low, endlessly twisting layouts that weave through their ' +
      'own structure, and they run articulated Millennium Flyer trains that can take much ' +
      'tighter curves than a traditional woodie train. Nothing else in wood looks this busy.',
    families: ['gci-wood'],
  },

  gerstlauer: {
    id: 'gerstlauer',
    name: 'Gerstlauer',
    shortName: 'Gerstlauer',
    country: 'Germany',
    founded: 1982,
    blurb:
      'Specialists in compact, vertical, aggressive rides that fit in a small footprint — the ' +
      'beyond-vertical Euro-Fighter drop is their signature. Grew out of a fabrication shop ' +
      'that built track for Anton Schwarzkopf.',
    families: ['gerstlauer-euro-fighter', 'gerstlauer-infinity'],
  },
};

export const MANUFACTURER_LIST: readonly Manufacturer[] = Object.values(MANUFACTURERS);
