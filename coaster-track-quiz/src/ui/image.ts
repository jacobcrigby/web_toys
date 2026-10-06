// SPDX-License-Identifier: Apache-2.0
//
// The photo panel. Every image is hotlinked from upload.wikimedia.org, which means loads are
// slow, occasionally fail, and occasionally hang without failing — so this component treats
// loading as a first-class state rather than an afterthought.

import { formatCredit } from '../data/attribution.ts';
import type { CoasterImage } from '../data/types.ts';
import { clear, h, link } from './dom.ts';

/** Wikimedia thumbs sometimes stall rather than erroring. Give up and offer a retry. */
const WATCHDOG_MS = 10_000;

/**
 * Commons answers a burst of requests with a 429 that clears almost immediately, so the first
 * failure is retried once, silently, before the learner is shown an error at all.
 */
const AUTO_RETRY_DELAY_MS = 1_500;
const AUTO_RETRIES = 1;

export interface TrackImageHandle {
  readonly el: HTMLElement;
  /** Point the panel at an image. `revealed` controls how much attribution is shown. */
  setSource(image: CoasterImage, options?: { revealed?: boolean }): void;
  /** Switch to full attribution and full alt text, once the answer is on screen. */
  reveal(): void;
  destroy(): void;
}

export interface TrackImageOptions {
  onSkip?: () => void;
}

export function createTrackImage(options: TrackImageOptions = {}): TrackImageHandle {
  const img = h('img', { alt: '', decoding: 'async' }) as HTMLImageElement;
  const skeleton = h('div', { class: 'track-image__skeleton', 'aria-hidden': 'true' });
  const error = h('div', { class: 'track-image__error' });
  const credit = h('p', { class: 'track-image__credit' });
  const frame = h('div', { class: 'track-image__frame' }, skeleton, img, error);
  const el = h('figure', { class: 'track-image', 'data-state': 'idle' }, frame, credit);

  let current: CoasterImage | null = null;
  let revealed = false;
  // Guards against a late load/error from an image we have already navigated away from.
  let token = 0;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  /** Silent retries spent on the current source. Reset whenever the source changes. */
  let autoRetries = 0;

  const setState = (state: 'loading' | 'ready' | 'error') => {
    el.setAttribute('data-state', state);
  };

  const stopWatchdog = () => {
    if (watchdog !== undefined) clearTimeout(watchdog);
    watchdog = undefined;
  };

  const stopRetry = () => {
    if (retryTimer !== undefined) clearTimeout(retryTimer);
    retryTimer = undefined;
  };

  /** A load failed or stalled: retry once on our own, otherwise show the error panel. */
  const failed = () => {
    stopWatchdog();
    if (current && autoRetries < AUTO_RETRIES) {
      autoRetries += 1;
      const source = current;
      const mine = token;
      retryTimer = setTimeout(() => {
        retryTimer = undefined;
        if (mine === token) load(source);
      }, AUTO_RETRY_DELAY_MS);
      return;
    }
    setState('error');
  };

  img.addEventListener('load', () => {
    if (Number(img.dataset.token) !== token) return;
    stopWatchdog();
    setState('ready');
  });

  img.addEventListener('error', () => {
    if (Number(img.dataset.token) !== token) return;
    failed();
  });

  const renderError = () => {
    clear(error);
    const retry = h('button', { type: 'button', class: 'button button--ghost' }, 'Retry');
    retry.addEventListener('click', () => {
      if (current) load(current);
    });

    error.appendChild(h('p', {}, 'That photo would not load from Wikimedia.'));
    error.appendChild(retry);

    if (options.onSkip) {
      const skip = h('button', { type: 'button', class: 'button button--ghost' }, 'Skip this ride');
      skip.addEventListener('click', () => options.onSkip?.());
      error.appendChild(skip);
    }
  };

  const renderCredit = (image: CoasterImage) => {
    clear(credit);
    const { attribution } = image;

    // Author and licence are always present, which is what the CC licences require. The link to
    // the Commons file page waits for the reveal: file names and descriptions almost always
    // contain the coaster's name, so showing it during the question hands over the answer.
    credit.appendChild(document.createTextNode(`${attribution.author} · `));
    credit.appendChild(
      attribution.licenseUrl
        ? link(attribution.licenseUrl, attribution.licenseShortName)
        : document.createTextNode(attribution.licenseShortName),
    );

    if (revealed) {
      credit.appendChild(document.createTextNode(' · '));
      credit.appendChild(link(attribution.descriptionUrl, 'Wikimedia Commons'));
      if (attribution.description) {
        credit.appendChild(
          h('span', { class: 'track-image__description' }, attribution.description),
        );
      }
    }
  };

  const load = (image: CoasterImage) => {
    token += 1;
    stopWatchdog();
    stopRetry();
    setState('loading');

    img.dataset.token = String(token);
    // Alt text follows the same rule as the credit link: nothing that names the ride until the
    // answer is out, so a screen-reader user is not simply told the answer.
    img.alt = revealed ? image.attribution.description || image.blindAlt : image.blindAlt;
    img.width = image.width;
    img.height = image.height;
    // Cache-bust with a fragment, not a query param — dataset.test.ts asserts URLs have no `?`.
    img.src = token > 1 && img.src.startsWith(image.url) ? `${image.url}#r${token}` : image.url;

    renderError();
    const mine = token;
    watchdog = setTimeout(() => {
      if (mine === token && el.getAttribute('data-state') === 'loading') failed();
    }, WATCHDOG_MS);
  };

  return {
    el,
    setSource(image, opts = {}) {
      current = image;
      autoRetries = 0;
      revealed = opts.revealed ?? false;
      renderCredit(image);
      load(image);
    },
    reveal() {
      revealed = true;
      if (!current) return;
      renderCredit(current);
      img.alt = current.attribution.description || current.blindAlt;
    },
    destroy() {
      stopWatchdog();
      stopRetry();
      // Bump the token so the error event this fires is ignored, like any other stale event.
      token += 1;
      img.src = '';
    },
  };
}

/** Warm the browser cache for an image we are about to need. */
export function preload(url: string): void {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
}

export { formatCredit };
