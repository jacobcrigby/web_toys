// SPDX-License-Identifier: Apache-2.0

import type { HistorySync, PeerStatus, Room } from '@web-toys/multiplayer';
import { createHistorySync } from '@web-toys/multiplayer';
import type { Move, Player } from '../engine/index.ts';
import type { LobbyMessage } from './protocol.ts';

interface SessionConfig {
  room: Room;
  isHost: boolean;
  hostSide: Player;
  onStatusChange: (s: PeerStatus) => void;
  onGameStart: (mySide: Player) => void;
  onOpponentResign: () => void;
  onRemoteMove: (move: Move) => void;
  getHistory: () => Move[];
}

function opposite(p: Player): Player {
  return p === 'X' ? 'O' : 'X';
}

export class MultiplayerSession {
  private readonly _room: Room;
  private readonly _historySync: HistorySync<Move>;
  private readonly _unsubs: Array<() => void> = [];

  constructor(config: SessionConfig) {
    this._room = config.room;

    const lobbyCh = config.room.channel<LobbyMessage>('lobby');

    this._historySync = createHistorySync<Move>({
      room: config.room,
      onMove: (move) => config.onRemoteMove(move),
      getHistory: config.getHistory,
    });

    this._unsubs.push(
      config.room.on('status', config.onStatusChange),

      lobbyCh.on((msg) => {
        switch (msg.type) {
          case 'ready': {
            // Guest: host announced their side
            const mySide: Player = opposite(msg.hostSide);
            lobbyCh.send({ type: 'side-accepted' });
            config.onGameStart(mySide);
            break;
          }
          case 'side-accepted': {
            // Host: guest confirmed
            config.onGameStart(config.hostSide);
            break;
          }
          case 'resign': {
            config.onOpponentResign();
            break;
          }
        }
      }),
    );

    if (config.isHost) {
      this._unsubs.push(
        config.room.on('peer-join', () => {
          lobbyCh.send({ type: 'ready', hostSide: config.hostSide });
        }),
      );
    }
  }

  sendMove(move: Move): void {
    this._historySync.recordMove(move);
  }

  sendResign(): void {
    const lobbyCh = this._room.channel<LobbyMessage>('lobby');
    lobbyCh.send({ type: 'resign' });
  }

  destroy(): void {
    for (const u of this._unsubs) u();
    this._historySync.destroy();
    this._room.destroy();
  }
}
