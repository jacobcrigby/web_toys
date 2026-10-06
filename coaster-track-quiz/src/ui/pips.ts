// SPDX-License-Identifier: Apache-2.0

import type { Box } from '../quiz/types.ts';
import { h } from './dom.ts';

/** Five small squares, `box` of them lit. Shared by the Progress table and the reveal. */
export function pips(box: Box): HTMLElement {
  return h(
    'span',
    { class: 'pips', role: 'img', 'aria-label': `Box ${box} of 5` },
    ...[1, 2, 3, 4, 5].map((n) => h('span', { class: 'pip', 'data-on': n <= box })),
  );
}
