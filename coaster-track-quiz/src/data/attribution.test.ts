// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it } from 'vitest';
import {
  formatCredit,
  isPublicDomain,
  rcdbUrl,
  sanitizeArtist,
  stripTrackingParams,
} from './attribution.ts';
import type { Attribution } from './types.ts';

const BASE = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/15/X.jpg/960px-X.jpg';

describe('stripTrackingParams', () => {
  it('leaves a bare URL untouched', () => {
    expect(stripTrackingParams(BASE)).toBe(BASE);
  });

  it('removes the utm params Commons appends', () => {
    const dirty = `${BASE}?utm_source=commons.wikimedia.org&utm_campaign=imageinfo&utm_content=thumbnail`;
    expect(stripTrackingParams(dirty)).toBe(BASE);
  });

  it('preserves a legitimate non-utm param', () => {
    expect(stripTrackingParams(`${BASE}?width=960&utm_source=x`)).toBe(`${BASE}?width=960`);
  });

  it('keeps the fragment when dropping the whole query', () => {
    expect(stripTrackingParams(`${BASE}?utm_source=x#retry1`)).toBe(`${BASE}#retry1`);
  });
});

describe('sanitizeArtist', () => {
  it('unwraps an anchor', () => {
    expect(sanitizeArtist('<a href="//commons.wikimedia.org/wiki/User:Jane">Jane Doe</a>')).toBe(
      'Jane Doe',
    );
  });

  it('collapses nested markup and whitespace', () => {
    expect(sanitizeArtist('<span>  Jane   </span><br/><span>Doe </span>')).toBe('Jane Doe');
  });

  it('decodes the entities Commons emits', () => {
    expect(sanitizeArtist('Bob &amp; Alice&#39;s Photos')).toBe("Bob & Alice's Photos");
  });

  it('falls back for empty or whitespace-only input', () => {
    expect(sanitizeArtist('')).toBe('Unknown author');
    expect(sanitizeArtist('<span>   </span>')).toBe('Unknown author');
  });
});

describe('isPublicDomain', () => {
  it('recognises public-domain markers', () => {
    for (const marker of ['Public domain', 'PD', 'CC0', 'No restrictions']) {
      expect(isPublicDomain(marker)).toBe(true);
    }
  });

  it('does not treat a real licence as public domain', () => {
    for (const licence of ['CC BY-SA 4.0', 'CC BY 2.0', 'GFDL']) {
      expect(isPublicDomain(licence)).toBe(false);
    }
  });
});

describe('formatCredit', () => {
  it('joins author and licence', () => {
    const attribution: Attribution = {
      author: 'Jane Doe',
      licenseShortName: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      descriptionUrl: 'https://commons.wikimedia.org/wiki/File:X.jpg',
      fileName: 'File:X.jpg',
      description: 'Track detail',
    };
    expect(formatCredit(attribution)).toBe('Jane Doe · CC BY-SA 4.0');
  });
});

describe('rcdbUrl', () => {
  it('builds the RCDB deep link surfaced in the reveal', () => {
    expect(rcdbUrl('656')).toBe('https://rcdb.com/656.htm');
  });
});
