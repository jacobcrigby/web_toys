// SPDX-License-Identifier: Apache-2.0
import './styles/index.css';
import { GameController } from './controller.ts';

const root = document.getElementById('app');
if (!root) throw new Error('#app not found');
new GameController(root).init();
