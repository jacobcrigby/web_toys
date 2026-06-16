import './styles/index.css';
import { createAi } from './ai/index.ts';
import { GameController } from './controller.ts';
import { SoundManager } from './ui/sound.ts';

const root = document.querySelector<HTMLElement>('#app');
if (root) {
  new GameController(root, { sound: new SoundManager(), createAi }).init();
}
