// SPDX-License-Identifier: Apache-2.0

/** The eight manufacturers the quiz teaches. */
export type ManufacturerId =
  | 'bolliger-mabillard'
  | 'intamin'
  | 'rocky-mountain'
  | 'vekoma'
  | 'arrow-dynamics'
  | 'mack-rides'
  | 'gci'
  | 'gerstlauer';

export const MANUFACTURER_IDS = [
  'bolliger-mabillard',
  'intamin',
  'rocky-mountain',
  'vekoma',
  'arrow-dynamics',
  'mack-rides',
  'gci',
  'gerstlauer',
] as const satisfies readonly ManufacturerId[];

/**
 * A track family is a distinct generation or product line of track. The visual tell belongs
 * to the family, not the company: Vekoma's 1980s corkscrew track and their post-2015
 * smooth-steel track look nothing alike, and B&M is only confusable with *modern* Vekoma.
 */
export type TrackFamilyId =
  | 'bm-box-spine'
  | 'bm-inverted'
  | 'intamin-box-spine'
  | 'intamin-prefab-wood'
  | 'rmc-ibox'
  | 'rmc-topper'
  | 'rmc-raptor'
  | 'vekoma-classic'
  | 'vekoma-slc'
  | 'vekoma-modern'
  | 'arrow-tubular'
  | 'arrow-mine-train'
  | 'mack-box-spine'
  | 'gci-wood'
  | 'gerstlauer-euro-fighter'
  | 'gerstlauer-infinity';

/** The aspect of the track a tell describes. Also the row key in the Track Guide table. */
export type TellKey =
  | 'spine'
  | 'rails'
  | 'crossties'
  | 'joints'
  | 'supports'
  | 'footers'
  | 'material'
  | 'silhouette';

export interface Tell {
  readonly key: TellKey;
  /** Short enough to read at a glance in the reveal callout. */
  readonly phrase: string;
  /** Longer prose, shown only in the Track Guide. */
  readonly detail?: string;
  /** The reveal leads with the single `primary` tell. */
  readonly strength: 'primary' | 'supporting';
}

export interface TrackFamily {
  readonly id: TrackFamilyId;
  readonly manufacturer: ManufacturerId;
  readonly name: string;
  /** [firstYear, lastYear]; `null` end means still in production. */
  readonly years: readonly [number, number | null];
  readonly summary: string;
  /** At least one `primary`, and no duplicate `TellKey`. Enforced by dataset.test.ts. */
  readonly tells: readonly Tell[];
  /** Most confusable first — this drives decoy selection. */
  readonly confusableWith: readonly TrackFamilyId[];
}

export interface Manufacturer {
  readonly id: ManufacturerId;
  readonly name: string;
  readonly shortName: string;
  readonly country: string;
  readonly founded: number;
  readonly blurb: string;
  readonly families: readonly TrackFamilyId[];
}

/**
 * Everything needed to credit a Wikimedia Commons photograph. The photos are CC-licensed
 * third-party content, so this is a licence obligation rather than a nicety — see AGENTS.md.
 */
export interface Attribution {
  /** Plain text. Commons returns HTML here, so it is sanitized at generation time. */
  readonly author: string;
  readonly licenseShortName: string;
  /** `null` only for public-domain markers, which have no licence deed to link. */
  readonly licenseUrl: string | null;
  /** The Commons file description page. Withheld until reveal — it names the ride. */
  readonly descriptionUrl: string;
  readonly fileName: string;
  /** The Commons `ImageDescription`, plain text. Also withheld until reveal. */
  readonly description: string;
}

export interface CoasterImage {
  readonly kind: 'closeup' | 'context';
  /** An `upload.wikimedia.org` thumbnail URL with tracking params stripped. */
  readonly url: string;
  readonly width: number;
  readonly height: number;
  /**
   * Alt text safe to show *before* the answer: describes the hardware without naming the
   * ride, the park, or the manufacturer. Machine-checked by the leak guard in dataset.test.ts.
   */
  readonly blindAlt: string;
  readonly attribution: Attribution;
}

export interface Coaster {
  readonly id: string;
  readonly name: string;
  readonly park: string;
  readonly country: string;
  readonly opened: number | null;
  /** Wikidata P2751. The RCDB URL is derived from it, never stored. */
  readonly rcdbId: string;
  readonly manufacturer: ManufacturerId;
  readonly family: TrackFamilyId;
  readonly closeup: CoasterImage;
  /** `null` when Commons has no usable wide shot — the hint button hides itself. */
  readonly context: CoasterImage | null;
  /** Optional aside shown in the reveal, e.g. why this particular photo is diagnostic. */
  readonly note?: string;
}
