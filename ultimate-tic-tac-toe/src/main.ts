// SPDX-License-Identifier: Apache-2.0
import './styles/index.css';
import { createAi } from './ai/index.ts';
import { GameController } from './controller.ts';
import { SoundManager } from './ui/sound.ts';

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  const controller = new GameController(root, { sound: new SoundManager(), createAi });
  controller.init();

  // Auto-join if ?room= is in the URL (friend sent an invite link)
  const roomCode = new URLSearchParams(location.search).get('room');
  if (roomCode) {
    void controller.startOnlineGuest(roomCode);
  }
}
