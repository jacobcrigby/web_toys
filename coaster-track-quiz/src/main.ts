// SPDX-License-Identifier: Apache-2.0

import './styles/index.css';
import { start } from './controller.ts';
import { DATASET } from './data/dataset.ts';

const root = document.getElementById('app');
if (!root) throw new Error('#app is missing from index.html');

if (DATASET.coasters.length === 0) {
  root.textContent = 'No coasters in the dataset. Run `pnpm data:emit` to build it.';
} else {
  start(root, DATASET);
}
