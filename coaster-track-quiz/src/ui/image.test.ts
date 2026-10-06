// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoasterImage } from '../data/types.ts';
import { createTrackImage } from './image.ts';

function makeImage(overrides: Partial<CoasterImage> = {}): CoasterImage {
  return {
    kind: 'closeup',
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/00/A.jpg/1024px-A.jpg',
    width: 1024,
    height: 768,
    blindAlt: 'Steel box spine seen from below',
    attribution: {
      author: 'Jane Doe',
      licenseShortName: 'CC BY-SA 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0',
      descriptionUrl: 'https://commons.wikimedia.org/wiki/File:A.jpg',
      fileName: 'File:A.jpg',
      description: 'Nemesis at Alton Towers, track detail',
    },
    ...overrides,
  };
}

const imgOf = (el: HTMLElement) => el.querySelector('img') as HTMLImageElement;
const state = (el: HTMLElement) => el.getAttribute('data-state');

beforeEach(() => {
  vi.useFakeTimers();
});

describe('load states', () => {
  it('starts in loading and reaches ready on load', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    expect(state(handle.el)).toBe('loading');

    imgOf(handle.el).dispatchEvent(new Event('load'));
    expect(state(handle.el)).toBe('ready');
  });

  it('retries once silently before showing an error', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    const img = imgOf(handle.el);
    const firstSrc = img.src;

    img.dispatchEvent(new Event('error'));
    expect(state(handle.el)).toBe('loading');

    vi.advanceTimersByTime(2_000);
    expect(state(handle.el)).toBe('loading');
    // Re-requested with a fragment, so the browser fetches again rather than replaying a miss.
    expect(img.src).not.toBe(firstSrc);
    expect(img.src.startsWith(firstSrc)).toBe(true);
  });

  it('goes to error when the hotlink fails twice', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    const img = imgOf(handle.el);

    img.dispatchEvent(new Event('error'));
    vi.advanceTimersByTime(2_000);
    img.dispatchEvent(new Event('error'));

    expect(state(handle.el)).toBe('error');
    expect(handle.el.textContent).toContain('would not load');
  });

  it('recovers if the silent retry succeeds', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    const img = imgOf(handle.el);

    img.dispatchEvent(new Event('error'));
    vi.advanceTimersByTime(2_000);
    img.dispatchEvent(new Event('load'));

    expect(state(handle.el)).toBe('ready');
  });

  it('gives up on an image that hangs without erroring, after one more try', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    vi.advanceTimersByTime(10_500);
    expect(state(handle.el)).toBe('loading');
    vi.advanceTimersByTime(12_500);
    expect(state(handle.el)).toBe('error');
  });

  it('gets a fresh silent retry for each new source', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    const img = imgOf(handle.el);
    img.dispatchEvent(new Event('error'));
    vi.advanceTimersByTime(2_000);
    img.dispatchEvent(new Event('error'));
    expect(state(handle.el)).toBe('error');

    handle.setSource(makeImage({ url: 'https://upload.wikimedia.org/wikipedia/commons/b/B.jpg' }));
    img.dispatchEvent(new Event('error'));
    expect(state(handle.el)).toBe('loading');
  });

  it('does not retry a source it has been pointed away from', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    const img = imgOf(handle.el);
    img.dispatchEvent(new Event('error'));

    const next = 'https://upload.wikimedia.org/wikipedia/commons/b/B.jpg';
    handle.setSource(makeImage({ url: next }));
    vi.advanceTimersByTime(5_000);
    expect(img.src).toBe(next);
  });

  it('does not fire the watchdog once the image has loaded', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    imgOf(handle.el).dispatchEvent(new Event('load'));
    vi.advanceTimersByTime(30_000);
    expect(state(handle.el)).toBe('ready');
  });

  it('ignores a late load from a source that was replaced', () => {
    const handle = createTrackImage();
    const img = imgOf(handle.el);

    handle.setSource(makeImage());
    const staleToken = img.dataset.token;
    handle.setSource(makeImage({ url: 'https://upload.wikimedia.org/wikipedia/commons/b/B.jpg' }));

    // Replay the first image's load event by restoring its token.
    img.dataset.token = staleToken as string;
    img.dispatchEvent(new Event('load'));
    expect(state(handle.el)).toBe('loading');
  });

  it('offers to skip a ride whose photo is broken', () => {
    const onSkip = vi.fn();
    const handle = createTrackImage({ onSkip });
    handle.setSource(makeImage());
    imgOf(handle.el).dispatchEvent(new Event('error'));
    vi.advanceTimersByTime(2_000);
    imgOf(handle.el).dispatchEvent(new Event('error'));

    const skip = [...handle.el.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Skip'),
    );
    skip?.dispatchEvent(new Event('click'));
    expect(onSkip).toHaveBeenCalled();
  });
});

describe('attribution by phase', () => {
  it('always credits the author and licence', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    expect(handle.el.textContent).toContain('Jane Doe');
    expect(handle.el.textContent).toContain('CC BY-SA 4.0');
  });

  it('withholds the Commons link until the answer is revealed', () => {
    // The file page names the ride, so linking it during the question gives the answer away.
    const handle = createTrackImage();
    handle.setSource(makeImage());
    expect(handle.el.querySelector('a[href*="commons.wikimedia.org"]')).toBeNull();

    handle.reveal();
    expect(handle.el.querySelector('a[href*="commons.wikimedia.org"]')).not.toBeNull();
  });

  it('uses blind alt text before the reveal and the real description after', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage());
    expect(imgOf(handle.el).alt).toBe('Steel box spine seen from below');

    handle.reveal();
    expect(imgOf(handle.el).alt).toBe('Nemesis at Alton Towers, track detail');
  });

  it('renders a public-domain marker as plain text with no licence link', () => {
    const handle = createTrackImage();
    handle.setSource(
      makeImage({
        attribution: {
          ...makeImage().attribution,
          licenseShortName: 'Public domain',
          licenseUrl: null,
        },
      }),
    );
    expect(handle.el.textContent).toContain('Public domain');
    expect(handle.el.querySelector('a[href*="creativecommons"]')).toBeNull();
  });

  it('starts already revealed when asked, for the Track Guide', () => {
    const handle = createTrackImage();
    handle.setSource(makeImage(), { revealed: true });
    expect(handle.el.querySelector('a[href*="commons.wikimedia.org"]')).not.toBeNull();
  });
});
