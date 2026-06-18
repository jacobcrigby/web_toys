// SPDX-License-Identifier: Apache-2.0
import { generateCode } from '@web-toys/multiplayer';
import type { AppState } from '../state.ts';
import { h } from './dom.ts';
import type { Actions } from './render.ts';

let codeInput: HTMLInputElement;
let sideBtns: [HTMLButtonElement, HTMLButtonElement];
let waitingEl: HTMLElement;
let hostControls: HTMLElement;

export function buildLobby(actions: Actions): HTMLElement {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;

  function fireCodeChange(code: string): void {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      actions.onLobbyCodeChange(code);
    }, 500);
  }

  codeInput = h('input', {
    class: 'lobby__code-input',
    type: 'text',
    'aria-label': 'Room code',
    spellcheck: 'false',
    autocomplete: 'off',
  }) as HTMLInputElement;
  codeInput.addEventListener('input', () => {
    fireCodeChange(codeInput.value.trim());
  });

  const randomizeBtn = h(
    'button',
    { class: 'btn btn--icon', type: 'button', 'aria-label': 'New random code' },
    ['↺'],
  ) as HTMLButtonElement;
  randomizeBtn.addEventListener('click', () => {
    const code = generateCode();
    codeInput.value = code;
    clearTimeout(debounceTimer);
    debounceTimer = undefined;
    actions.onLobbyCodeChange(code);
  });

  const copyBtn = h('button', { class: 'btn', type: 'button' }, [
    'Copy invite link',
  ]) as HTMLButtonElement;
  copyBtn.addEventListener('click', () => actions.onLobbyCopyLink());

  const sideXBtn = h(
    'button',
    { class: 'seg', type: 'button', role: 'radio', 'aria-checked': 'false' },
    ['X'],
  ) as HTMLButtonElement;
  const sideOBtn = h(
    'button',
    { class: 'seg', type: 'button', role: 'radio', 'aria-checked': 'false' },
    ['O'],
  ) as HTMLButtonElement;
  sideBtns = [sideXBtn, sideOBtn];
  sideXBtn.addEventListener('click', () => actions.onStartOnlineHost('X'));
  sideOBtn.addEventListener('click', () => actions.onStartOnlineHost('O'));

  const sideGroup = h('div', { class: 'menu__field' }, [
    h('span', { class: 'menu__label', id: 'label-lobby-side' }, ['You play as']),
    h(
      'div',
      { class: 'menu__seggroup', role: 'radiogroup', 'aria-labelledby': 'label-lobby-side' },
      sideBtns,
    ),
  ]);

  hostControls = h('div', { class: 'lobby__host-controls' }, [
    h('div', { class: 'lobby__code-row' }, [codeInput, randomizeBtn]),
    copyBtn,
    sideGroup,
  ]);

  waitingEl = h('p', { class: 'lobby__waiting', 'aria-live': 'polite' }, ['Waiting for opponent…']);

  const cancelBtn = h('button', { class: 'btn', type: 'button' }, ['Cancel']) as HTMLButtonElement;
  cancelBtn.addEventListener('click', () => actions.onLobbyCancel());

  return h('div', { class: 'screen screen--lobby' }, [
    h('div', { class: 'menu' }, [
      h('h2', { class: 'menu__title' }, ['Play Online']),
      hostControls,
      waitingEl,
      cancelBtn,
    ]),
  ]);
}

export function syncLobby(state: AppState): void {
  const conn = state.connection;
  if (!conn) return;

  const isHost = conn.isHost;

  hostControls.hidden = !isHost;
  if (isHost) {
    if (codeInput.value === '') codeInput.value = conn.roomCode;
    sideBtns[0].setAttribute('aria-checked', String(conn.mySide === 'X'));
    sideBtns[1].setAttribute('aria-checked', String(conn.mySide === 'O'));
  }

  if (conn.status === 'connected') {
    waitingEl.textContent = 'Opponent connected!';
  } else if (!isHost) {
    waitingEl.textContent = `Joining ${conn.roomCode}…`;
  } else {
    waitingEl.textContent = 'Waiting for opponent…';
  }
}
