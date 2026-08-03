// SPDX-License-Identifier: Apache-2.0
import './styles/index.css';
import { DaylightController } from './controller.ts';

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  new DaylightController(root).init();
}
