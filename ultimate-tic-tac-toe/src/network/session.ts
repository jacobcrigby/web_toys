// SPDX-License-Identifier: Apache-2.0

import type { Channel, HistorySync, PeerStatus, Room } from '@web-toys/multiplayer';
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
  private readonly _lobbyCh: Channel<LobbyMessage>;
  private readonly _historySync: HistorySync<Move>;
  private readonly _unsubs: Array<() => void> = [];
  private _gameStarted = false;

  constructor(config: SessionConfig) {
    this._room = config.room;
    this._lobbyCh = config.room.channel<LobbyMessage>('lobby');

    const lobbyCh = this._lobbyCh;

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
            // Guest: host announced their side (lobby phase only)
            if (this._gameStarted) break;
            const mySide: Player = opposite(msg.hostSide);
            lobbyCh.send({ type: 'side-accepted' });
            this._gameStarted = true;
            config.onGameStart(mySide);
            break;
          }
          case 'side-accepted': {
            // Host: guest confirmed (lobby phase only)
            if (this._gameStarted) break;
            this._gameStarted = true;
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
      // Only send 'ready' during lobby; mid-game reconnects are handled by HistorySync
      this._unsubs.push(
        config.room.on('peer-join', () => {
          if (!this._gameStarted) {
            lobbyCh.send({ type: 'ready', hostSide: config.hostSide });
          }
        }),
      );
    }
  }

  sendMove(move: Move): void {
    this._historySync.recordMove(move);
  }

  sendResign(): void {
    this._lobbyCh.send({ type: 'resign' });
  }

  destroy(): void {
    for (const u of this._unsubs) u();
    this._historySync.destroy();
    this._room.destroy();
  }
}
