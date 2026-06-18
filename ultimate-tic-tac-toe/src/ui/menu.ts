import type { AppState } from '../state.ts';
import { h } from './dom.ts';
import type { Actions } from './render.ts';

let modeBtns: HTMLButtonElement[] = [];
let difficultyGroup: HTMLElement;
let difficultyBtns: HTMLButtonElement[] = [];
let sideGroup: HTMLElement;
let sideBtns: HTMLButtonElement[] = [];
let startBtn: HTMLButtonElement;
let onlineGroup: HTMLElement;
let scoresEl: HTMLElement;
let resetBtn: HTMLButtonElement;
let disarmReset: () => void = () => {};

function seg(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const btn = h(
    'button',
    { class: 'seg', type: 'button', role: 'radio', 'aria-checked': 'false' },
    [label],
  );
  if (disabled) {
    btn.disabled = true;
  }
  btn.addEventListener('click', onClick);
  return btn;
}

export function buildMenu(actions: Actions): HTMLElement {
  modeBtns = [
    seg('2 players', () => actions.onSetting('mode', 'hotseat')),
    seg('vs AI', () => actions.onSetting('mode', 'ai')),
    seg('Online', () => actions.onSetting('mode', 'online')),
  ];
  difficultyBtns = [
    seg('Easy', () => actions.onSetting('difficulty', 'easy')),
    seg('Medium', () => actions.onSetting('difficulty', 'medium')),
    seg('Hard', () => actions.onSetting('difficulty', 'hard')),
  ];
  sideBtns = [
    seg('X', () => actions.onSetting('humanPlays', 'X')),
    seg('O', () => actions.onSetting('humanPlays', 'O')),
  ];

  difficultyGroup = h('div', { class: 'menu__field' }, [
    h('span', { class: 'menu__label', id: 'label-difficulty' }, ['Difficulty']),
    h(
      'div',
      { class: 'menu__seggroup', role: 'radiogroup', 'aria-labelledby': 'label-difficulty' },
      difficultyBtns,
    ),
  ]);
  sideGroup = h('div', { class: 'menu__field' }, [
    h('span', { class: 'menu__label', id: 'label-side' }, ['You play']),
    h(
      'div',
      { class: 'menu__seggroup', role: 'radiogroup', 'aria-labelledby': 'label-side' },
      sideBtns,
    ),
  ]);

  startBtn = h('button', { class: 'btn btn--primary menu__start', type: 'button' }, [
    'Start game',
  ]) as HTMLButtonElement;
  startBtn.addEventListener('click', () => actions.onStart());

  const joinInput = h('input', {
    class: 'menu__join-input',
    type: 'text',
    placeholder: 'Room code',
    'aria-label': 'Join room code',
  }) as HTMLInputElement;

  const joinBtn = h('button', { class: 'btn', type: 'button' }, ['Join game']) as HTMLButtonElement;
  joinBtn.addEventListener('click', () => {
    const code = joinInput.value.trim();
    if (code) actions.onJoinOnlineGuest(code);
  });

  const createBtn = h('button', { class: 'btn btn--primary', type: 'button' }, [
    'Create game',
  ]) as HTMLButtonElement;
  createBtn.addEventListener('click', () => actions.onStartOnlineHost('X'));

  onlineGroup = h('div', { class: 'menu__field menu__online-controls' }, [
    createBtn,
    h('span', { class: 'menu__label' }, ['— or join —']),
    h('div', { class: 'menu__join-row' }, [joinInput, joinBtn]),
  ]);

  scoresEl = h('p', { class: 'menu__scores' }, ['']);

  resetBtn = h('button', { class: 'menu__reset', type: 'button' }, ['Reset scores']);
  resetBtn.hidden = true;
  let armed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  disarmReset = () => {
    armed = false;
    clearTimeout(timer);
    resetBtn.textContent = 'Reset scores';
    resetBtn.classList.remove('menu__reset--armed');
  };
  resetBtn.addEventListener('click', () => {
    if (armed) {
      disarmReset();
      actions.onResetScores();
      return;
    }
    armed = true;
    resetBtn.textContent = 'Sure?';
    resetBtn.classList.add('menu__reset--armed');
    timer = setTimeout(disarmReset, 3000);
  });

  return h('div', { class: 'screen screen--menu' }, [
    h('div', { class: 'menu' }, [
      h('h1', { class: 'menu__title' }, [
        h('span', { class: 'menu__title-x' }, ['Ultimate']),
        ' ',
        h('span', { class: 'menu__title-o' }, ['Tic-Tac-Toe']),
      ]),
      h('div', { class: 'menu__field' }, [
        h('span', { class: 'menu__label', id: 'label-mode' }, ['Mode']),
        h(
          'div',
          { class: 'menu__seggroup', role: 'radiogroup', 'aria-labelledby': 'label-mode' },
          modeBtns,
        ),
      ]),
      difficultyGroup,
      sideGroup,
      onlineGroup,
      startBtn,
      scoresEl,
      resetBtn,
    ]),
  ]);
}

export function syncMenu(state: AppState): void {
  const { mode, difficulty, humanPlays } = state.settings;
  modeBtns[0]?.setAttribute('aria-checked', String(mode === 'hotseat'));
  modeBtns[1]?.setAttribute('aria-checked', String(mode === 'ai'));
  modeBtns[2]?.setAttribute('aria-checked', String(mode === 'online'));
  const diffs = ['easy', 'medium', 'hard'] as const;
  difficultyBtns.forEach((btn, i) => {
    btn.setAttribute('aria-checked', String(difficulty === diffs[i]));
  });
  sideBtns[0]?.setAttribute('aria-checked', String(humanPlays === 'X'));
  sideBtns[1]?.setAttribute('aria-checked', String(humanPlays === 'O'));
  difficultyGroup.hidden = mode !== 'ai';
  sideGroup.hidden = mode !== 'ai';
  onlineGroup.hidden = mode !== 'online';
  startBtn.hidden = mode === 'online';
  const { x, o, draws } = state.scores;
  const hasScores = x + o + draws > 0;
  scoresEl.textContent = hasScores ? `Lifetime: X ${x} · ${o} O · ${draws} draws` : '';
  if (resetBtn.hidden !== !hasScores) {
    resetBtn.hidden = !hasScores;
    disarmReset();
  }
}
