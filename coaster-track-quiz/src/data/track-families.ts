// SPDX-License-Identifier: Apache-2.0
//
// Hand-written teaching content: what to actually look at, per generation of track.
//
// A tell belongs to a *track family*, not to a company. Vekoma's 1980s catalogue track and
// their post-2015 track share nothing visually, and B&M is only genuinely confusable with the
// modern Vekoma. Hanging tells off the manufacturer would force one blurred paragraph per
// company and destroy the point of the exercise.
//
// The same `phrase` strings are rendered by both the reveal and the Track Guide, so the two
// can never drift apart.

import type { TellKey, TrackFamily, TrackFamilyId } from './types.ts';

/**
 * Which aspect to reach for first when contrasting two families. `contrastFamilies` walks this
 * order and uses the first key both families describe differently, so the generated
 * "not X, because…" line leads with the most decisive difference available.
 */
export const DISCRIMINATOR_ORDER: readonly TellKey[] = [
  'spine',
  'material',
  'rails',
  'crossties',
  'supports',
  'joints',
  'footers',
  'silhouette',
];

export const TRACK_FAMILIES: Readonly<Record<TrackFamilyId, TrackFamily>> = {
  'bm-box-spine': {
    id: 'bm-box-spine',
    manufacturer: 'bolliger-mabillard',
    name: 'B&M box spine',
    years: [1990, null],
    summary:
      'The reference point for modern steel track. Once you can spot a B&M box spine, every ' +
      'other maker becomes easier, because you are mostly asking "is this a B&M or not?".',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A deep hollow rectangular box spine with flat, smooth, unbroken sides',
        detail:
          'The spine is a large welded steel box — no lattice, no lacing, no visible internal ' +
          'structure. It is markedly deeper than anything else on the market, which is where ' +
          'the famous hollow roar comes from.',
      },
      {
        key: 'rails',
        strength: 'supporting',
        phrase: 'Round tube rails standing off the spine on plain flat steel plates',
        detail:
          'The plates are simple flat rectangles welded to the top corners of the box, spaced ' +
          'generously. No gussets, no triangles, no fuss.',
      },
      {
        key: 'crossties',
        strength: 'supporting',
        phrase: 'No ladder of ties between the rails — the box carries everything',
        detail:
          'This alone separates B&M from Arrow and older Vekoma, whose rails are tied together ' +
          'by a visible run of rungs.',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Fat round-tube columns, usually one thick leg per footer',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Big, wide, unhurried shaping — sweeping curves rather than snap transitions',
      },
    ],
    confusableWith: ['vekoma-modern', 'mack-box-spine', 'intamin-box-spine'],
  },

  'bm-inverted': {
    id: 'bm-inverted',
    manufacturer: 'bolliger-mabillard',
    name: 'B&M inverted',
    years: [1992, null],
    summary:
      'The train hangs below the track with riders’ legs free. Visually it is the standard ' +
      'B&M box spine turned into an overhead beam, and its direct rival is the Vekoma SLC.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A heavy box spine overhead, deep enough to hide the running rails from below',
        detail:
          'Look up at the underside: on a B&M the box is broad and the whole assembly looks ' +
          'thick. An SLC overhead beam is visibly slimmer.',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Track slung under wide inverted-U or A-frame gantries on round columns',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Large-radius inversions with long, drawn-out entries and exits',
      },
    ],
    confusableWith: ['vekoma-slc', 'bm-box-spine'],
  },

  'intamin-box-spine': {
    id: 'intamin-box-spine',
    manufacturer: 'intamin',
    name: 'Intamin steel spine',
    years: [1990, null],
    summary:
      'Intamin build tall and light. For the same height and speed their track is visibly ' +
      'skinnier than B&M, which is the single most reliable way to tell the two apart.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A slimmer, shallower box spine that looks under-built next to a B&M',
        detail:
          'Intamin lean on material efficiency rather than mass. On a 200ft hyper the spine ' +
          'can look almost delicate — an impression B&M track never gives.',
      },
      {
        key: 'rails',
        strength: 'supporting',
        phrase: 'Rails carried on shaped gusset plates that flare out into triangles',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Square or rectangular-section columns rather than round tube',
        detail:
          'A strong tell at distance. B&M and Mack use round tube supports almost everywhere; ' +
          'square-section legs under a big steel coaster usually mean Intamin.',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Extreme numbers — the tallest, the fastest, the steepest on the midway',
      },
    ],
    confusableWith: ['bm-box-spine', 'gerstlauer-euro-fighter', 'mack-box-spine'],
  },

  'intamin-prefab-wood': {
    id: 'intamin-prefab-wood',
    manufacturer: 'intamin',
    name: 'Intamin prefabricated wood',
    years: [2000, null],
    summary:
      'Wooden track cut by machine in a factory to steel-coaster tolerances, then bolted ' +
      'together on site. Looks like wood, rides like steel.',
    tells: [
      {
        key: 'material',
        strength: 'primary',
        phrase: 'Machine-cut laminated wooden track in factory-made sections',
        detail:
          'The give-away is the precision. A site-built woodie has visible irregularity in its ' +
          'laminations and joints; these sections are identical to each other.',
      },
      {
        key: 'crossties',
        strength: 'supporting',
        phrase: 'Uniform, tightly and evenly spaced ties with no improvisation',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Steel-coaster geometry in wood: sustained airtime hills, cleanly banked turns',
      },
    ],
    confusableWith: ['gci-wood', 'rmc-topper'],
  },

  'rmc-ibox': {
    id: 'rmc-ibox',
    manufacturer: 'rocky-mountain',
    name: 'RMC I-Box',
    years: [2011, null],
    summary:
      'Steel track bolted onto a wooden support structure — usually the recycled bones of an ' +
      'old wooden coaster. The mixed materials make this the easiest RMC to call.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A steel I-beam spine with an open web you can see straight through',
        detail:
          'Not a closed box. Look at the end of a track section or through a curve and the ' +
          'I-profile — two flanges joined by a single vertical web — is unmistakable.',
      },
      {
        key: 'material',
        strength: 'supporting',
        phrase: 'Steel track sitting on a timber structure: wood below, steel above',
      },
      {
        key: 'rails',
        strength: 'supporting',
        phrase: 'Square box-section rails, bolted rather than welded',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Steel ledgers bolted through to wooden bents, with visible bolt plates',
      },
    ],
    confusableWith: ['rmc-topper', 'gci-wood', 'intamin-prefab-wood'],
  },

  'rmc-topper': {
    id: 'rmc-topper',
    manufacturer: 'rocky-mountain',
    name: 'RMC Topper Track',
    years: [2011, null],
    summary:
      'Steel caps wrapped over laminated wooden track. Far more woodie-looking than I-Box, and ' +
      'the family most likely to be mistaken for a conventional wooden coaster.',
    tells: [
      {
        key: 'material',
        strength: 'primary',
        phrase: 'Steel caps wrapped over wooden laminations, so the running surface is all steel',
        detail:
          'A traditional woodie has a thin flat steel strip pinned to the top of a stack of ' +
          'wooden layers. Topper Track wraps the wood in a continuous steel channel — the ' +
          'metal comes down the sides, not just across the top.',
      },
      {
        key: 'rails',
        strength: 'supporting',
        phrase: 'The steel cap is the rail; nothing separate sits on top of the wood',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Reads as a woodie until you notice an inversion or a flawless transition',
      },
    ],
    confusableWith: ['gci-wood', 'rmc-ibox', 'intamin-prefab-wood'],
  },

  'rmc-raptor': {
    id: 'rmc-raptor',
    manufacturer: 'rocky-mountain',
    name: 'RMC Raptor single rail',
    years: [2018, null],
    summary:
      'An all-steel single-rail track that the train straddles. Nothing else looks remotely like it.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'One tall, narrow blade of track — no pair of running rails at all',
        detail:
          'The car sits astride a single deep spine like a motorcycle. Once seen it is never ' +
          'confused with anything else.',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'So thin it nearly vanishes against the sky; violently tight, twisty shaping',
      },
    ],
    confusableWith: ['rmc-ibox'],
  },

  'vekoma-classic': {
    id: 'vekoma-classic',
    manufacturer: 'vekoma',
    name: 'Vekoma classic (catalogue era)',
    years: [1979, 2012],
    summary:
      'The mass-produced Vekoma that gave them their old reputation — corkscrews, boomerangs ' +
      'and looping coasters sold from a catalogue and built in dozens of parks.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A busy, industrial-looking spine with a dense run of short angled braces',
        detail:
          'Where a B&M box is smooth and closed, this era of Vekoma track is visibly assembled ' +
          'from many small pieces. There is a lot going on between spine and rails.',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Latticed and trussed support columns rather than smooth tube',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Catalogue shapes — the same corkscrew and boomerang, park after park',
        detail:
          'If you have the feeling you have ridden this exact layout somewhere else, that is ' +
          'itself the tell.',
      },
    ],
    confusableWith: ['arrow-tubular', 'vekoma-slc', 'arrow-mine-train'],
  },

  'vekoma-slc': {
    id: 'vekoma-slc',
    manufacturer: 'vekoma',
    name: 'Vekoma SLC',
    years: [1994, null],
    summary:
      'The Suspended Looping Coaster, the most-installed inverted coaster in the world and the ' +
      'budget answer to a B&M invert.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A slim overhead beam — thin enough to see daylight around the running gear',
        detail:
          'Compare with a B&M invert, where the overhead box is deep and blocky. The SLC beam ' +
          'looks like the minimum metal required.',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Narrow, tightly spaced support frames, often in a repeating A-shape',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'The identical roll-over, sidewinder and inline-twist sequence everywhere',
      },
    ],
    confusableWith: ['bm-inverted', 'vekoma-classic'],
  },

  'vekoma-modern': {
    id: 'vekoma-modern',
    manufacturer: 'vekoma',
    name: 'Vekoma modern (smooth steel)',
    years: [2013, null],
    summary:
      'A ground-up redesign. These ride as smoothly as anything B&M builds, and they are the ' +
      'hardest single call in this quiz.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A clean box spine like B&M’s, but noticeably shallower front to back',
        detail:
          'This is a judgement of proportion rather than a categorical difference. Ask whether ' +
          'the spine looks heavy enough for the size of the ride; on modern Vekoma it usually ' +
          'does not quite.',
      },
      {
        key: 'rails',
        strength: 'supporting',
        phrase: 'Rail plates that are narrower and spaced closer together than B&M’s',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Slimmer round columns and a lighter overall structure',
      },
      {
        key: 'joints',
        strength: 'supporting',
        phrase: 'Prominent bolted flanges where track sections meet',
      },
    ],
    confusableWith: ['bm-box-spine', 'mack-box-spine', 'intamin-box-spine'],
  },

  'arrow-tubular': {
    id: 'arrow-tubular',
    manufacturer: 'arrow-dynamics',
    name: 'Arrow tubular steel',
    years: [1975, 2002],
    summary:
      'The original modern steel track, and still the most distinctive. Everything Arrow built ' +
      'is now decades old, so age itself is a clue.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A single large round pipe as the spine, not a box',
        detail:
          'Cylindrical, obviously so, and often the same diameter as the running rails. No ' +
          'other maker in this quiz uses a round pipe spine.',
      },
      {
        key: 'crossties',
        strength: 'supporting',
        phrase: 'A ladder of flat rungs tying the two rails together at regular intervals',
        detail: 'The classic Arrow look. Count the rungs — they are close together and uniform.',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Slender latticed supports, usually all one bright colour',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Angular, abrupt shaping and circular loops rather than teardrops',
      },
    ],
    confusableWith: ['vekoma-classic', 'arrow-mine-train'],
  },

  'arrow-mine-train': {
    id: 'arrow-mine-train',
    manufacturer: 'arrow-dynamics',
    name: 'Arrow mine train',
    years: [1966, 1999],
    summary:
      'The same tubular hardware kept low and wrapped around the terrain. Arrow effectively ' +
      'invented this genre and built most of the surviving examples.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'Round pipe spine again, but light gauge and never far off the ground',
      },
      {
        key: 'crossties',
        strength: 'supporting',
        phrase: 'The same ladder of flat rungs between the rails',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Hugs terrain and water, helices instead of inversions, no big drop',
      },
    ],
    confusableWith: ['arrow-tubular', 'vekoma-classic'],
  },

  'mack-box-spine': {
    id: 'mack-box-spine',
    manufacturer: 'mack-rides',
    name: 'Mack steel spine',
    years: [1990, null],
    summary:
      'Sits visually between B&M and Intamin — lighter than the former, tidier than the ' +
      'latter. The fabrication quality is the thing to notice.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A box spine of medium depth with unusually clean, precise welds',
        detail:
          'Not as deep as B&M, not as spindly as Intamin. Mack track tends to look like it was ' +
          'made to a tighter tolerance than either.',
      },
      {
        key: 'rails',
        strength: 'supporting',
        phrase: 'Rails on short, evenly spaced brackets, closer in than B&M’s plates',
      },
      {
        key: 'joints',
        strength: 'supporting',
        phrase: 'Neat bolted flange connections at regular section joints',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Flowing, family-friendly shaping; often heavily themed and indoors',
      },
    ],
    confusableWith: ['bm-box-spine', 'vekoma-modern', 'intamin-box-spine'],
  },

  'gci-wood': {
    id: 'gci-wood',
    manufacturer: 'gci',
    name: 'GCI wooden track',
    years: [1996, null],
    summary:
      'Traditional site-built wooden track used in a thoroughly untraditional way: low, dense ' +
      'and continuously twisting.',
    tells: [
      {
        key: 'material',
        strength: 'primary',
        phrase: 'Stacked wooden laminations topped with a thin flat steel running strip',
        detail:
          'The steel is a strip pinned to the top surface only — it does not wrap down the ' +
          'sides. That is what separates it from RMC Topper Track.',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'A thicket of closely spaced timber bents, far denser than an older woodie',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase:
          'Low, tangled layouts that cross over themselves constantly; almost no straight track',
      },
      {
        key: 'crossties',
        strength: 'supporting',
        phrase: 'Steep banking held for long stretches, which older wooden trains could not take',
      },
    ],
    confusableWith: ['rmc-topper', 'intamin-prefab-wood', 'rmc-ibox'],
  },

  'gerstlauer-euro-fighter': {
    id: 'gerstlauer-euro-fighter',
    manufacturer: 'gerstlauer',
    name: 'Gerstlauer Euro-Fighter',
    years: [2003, null],
    summary:
      'Compact, vertical and aggressive, built to fit a big thrill into a small plot. The ' +
      'beyond-vertical first drop is the calling card.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'A rectangular box spine with pronounced triangular gussets at the rail joints',
        detail:
          'Busier at the rail connection than B&M, but far tidier than catalogue-era Vekoma. ' +
          'The triangles are the thing to look for.',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Square-section legs packed tightly into a small footprint',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'A vertical lift, a beyond-90° drop, then sharp-cornered inversions stacked close',
      },
    ],
    confusableWith: ['intamin-box-spine', 'gerstlauer-infinity', 'mack-box-spine'],
  },

  'gerstlauer-infinity': {
    id: 'gerstlauer-infinity',
    manufacturer: 'gerstlauer',
    name: 'Gerstlauer Infinity',
    years: [2012, null],
    summary:
      'The later, smoother Gerstlauer. Same compact instincts as the Euro-Fighter with better ' +
      'shaping and a lower-slung train.',
    tells: [
      {
        key: 'spine',
        strength: 'primary',
        phrase: 'The Euro-Fighter box spine and gussets, with larger-radius shaping around it',
      },
      {
        key: 'supports',
        strength: 'supporting',
        phrase: 'Square-section legs, still tightly packed',
      },
      {
        key: 'silhouette',
        strength: 'supporting',
        phrase: 'Compact and vertical, but the inversions are rounder and less snappy',
      },
    ],
    confusableWith: ['gerstlauer-euro-fighter', 'intamin-box-spine'],
  },
};

export const TRACK_FAMILY_LIST: readonly TrackFamily[] = Object.values(TRACK_FAMILIES);

/** Canonical key for a pair of families: both ids, sorted, joined with `|`. */
export function pairKey(a: TrackFamilyId, b: TrackFamilyId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Hand-written notes for the pairs where a mechanically derived one-attribute contrast is too
 * thin to be useful. Everything else falls back to `contrastFamilies`, which is why this table
 * only needs to cover the genuinely hard calls rather than all 120 combinations.
 */
export const PAIR_NOTES: ReadonlyMap<string, string> = new Map([
  [
    pairKey('bm-box-spine', 'vekoma-modern'),
    'The hardest pair in the quiz. Both are clean box spines with plate-mounted round rails. ' +
      'Judge depth against the size of the ride: B&M looks overbuilt, modern Vekoma looks ' +
      'merely sufficient. Bolted section flanges point to Vekoma.',
  ],
  [
    pairKey('bm-box-spine', 'intamin-box-spine'),
    'Look at the legs before the track. Round tube columns mean B&M; square-section columns ' +
      'almost always mean Intamin. Then check the spine — Intamin’s is shallower and its ' +
      'rail plates flare into triangles rather than staying plain rectangles.',
  ],
  [
    pairKey('bm-box-spine', 'mack-box-spine'),
    'Both are round-supported box spines. B&M is deeper and the rail plates stand further off ' +
      'the spine; Mack keeps the rails tucked in close on short brackets and shows tidier ' +
      'welds and flange joints.',
  ],
  [
    pairKey('intamin-box-spine', 'gerstlauer-euro-fighter'),
    'Both run square-section supports on a compact footprint. Gerstlauer adds obvious ' +
      'triangular gussets where the rails meet the spine, and its elements are sharper-cornered. ' +
      'Intamin goes for scale; Gerstlauer goes for verticality in a small plot.',
  ],
  [
    pairKey('gci-wood', 'rmc-topper'),
    'Both look like wooden coasters. Check where the steel stops: GCI pins a flat strip to the ' +
      'top surface only, while RMC Topper wraps a steel channel down the sides of the ' +
      'laminations. An inversion settles it instantly — GCI never inverts.',
  ],
  [
    pairKey('gci-wood', 'rmc-ibox'),
    'RMC I-Box is steel track on a wooden structure, so the running surface is unmistakably ' +
      'steel box-section bolted to timber. GCI is wood all the way up with a thin steel strip ' +
      'on top.',
  ],
  [
    pairKey('gci-wood', 'intamin-prefab-wood'),
    'Both are genuinely wooden. GCI is site-built and slightly irregular, with a dense ' +
      'thicket of bents and a tangled low layout. Intamin’s prefab sections are machine-cut ' +
      'and identical, carrying steel-coaster geometry — long airtime hills, clean banking.',
  ],
  [
    pairKey('arrow-tubular', 'vekoma-classic'),
    'Vekoma licensed this heritage, so the two are close. Arrow’s spine is a plain round ' +
      'pipe with a clean ladder of rungs. Vekoma adds a great deal more small bracing between ' +
      'spine and rails, and its supports are more heavily latticed.',
  ],
  [
    pairKey('bm-inverted', 'vekoma-slc'),
    'Both hang the train under an overhead beam. B&M’s beam is deep and blocky and its ' +
      'inversions are large-radius; the SLC beam is slim, its support frames are narrow and ' +
      'closely spaced, and the layout is the same one you have seen in ten other parks.',
  ],
  [
    pairKey('vekoma-modern', 'mack-box-spine'),
    'Both are mid-depth box spines from makers known for smoothness. Mack shows cleaner welds ' +
      'and neater flange joints; modern Vekoma runs narrower, more frequent rail plates and a ' +
      'slightly lighter support structure.',
  ],
]);
