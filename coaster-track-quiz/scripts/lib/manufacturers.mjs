// SPDX-License-Identifier: Apache-2.0
//
// Wikidata QIDs for the eight manufacturers the quiz covers. Kept alongside the scripts
// rather than in src/, because only the curation tooling ever needs them — the app itself
// never talks to Wikidata.

export const MANUFACTURER_QIDS = {
  'bolliger-mabillard': { qid: 'Q667822', label: 'Bolliger & Mabillard' },
  intamin: { qid: 'Q660675', label: 'Intamin' },
  'rocky-mountain': { qid: 'Q3662070', label: 'Rocky Mountain Construction' },
  vekoma: { qid: 'Q546697', label: 'Vekoma' },
  'arrow-dynamics': { qid: 'Q702968', label: 'Arrow Dynamics' },
  'mack-rides': { qid: 'Q566832', label: 'Mack Rides' },
  gci: { qid: 'Q1544251', label: 'Great Coasters International' },
  gerstlauer: { qid: 'Q162810', label: 'Gerstlauer' },
};

export const MANUFACTURER_IDS = Object.keys(MANUFACTURER_QIDS);
