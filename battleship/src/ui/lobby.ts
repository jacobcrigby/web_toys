// SPDX-License-Identifier: Apache-2.0
import type { Connection } from '../state.ts';
import { h } from './dom.ts';

export interface LobbyActions {
  onJoinRoom(code: string): void;
  onCopyCode(): void;
}

export function buildLobby(connection: Connection | null, actions: LobbyActions): HTMLElement {
  const section = h('section', { class: 'lobby' });

  if (!connection) {
    section.appendChild(h('p', {}, 'Connecting…'));
    return section;
  }

  if (connection.role === 'host') {
    const codeEl = h(
      'span',
      { class: 'lobby__code', 'aria-label': 'Room code' },
      connection.roomCode,
    );
    const copyBtn = h('button', { class: 'btn btn--secondary' }, 'Copy Code');
    copyBtn.addEventListener('click', () => actions.onCopyCode());

    section.append(
      h('h2', {}, 'Waiting for opponent…'),
      h('p', {}, 'Share this room code:'),
      codeEl,
      copyBtn,
      h(
        'p',
        { class: 'lobby__status' },
        connection.peerConnected ? 'Opponent connected!' : 'Waiting…',
      ),
    );
  } else {
    const input = h('input', {
      type: 'text',
      class: 'lobby__input',
      placeholder: 'Enter room code',
      maxlength: '8',
      'aria-label': 'Room code',
    }) as HTMLInputElement;

    const joinBtn = h('button', { class: 'btn btn--primary' }, 'Join');
    joinBtn.addEventListener('click', () => {
      const code = (input as HTMLInputElement).value.trim().toUpperCase();
      if (code) actions.onJoinRoom(code);
    });

    section.append(h('h2', {}, 'Join a Game'), input, joinBtn);
  }

  return section;
}
