// SPDX-License-Identifier: Apache-2.0
import type { Channel, Room } from '@web-toys/multiplayer';
import type { Action, GameMode, ShipPlacement } from '../engine/index.ts';
import type { GridSize } from '../state.ts';
import type { LobbyMessage } from './protocol.ts';

const APP_ID = 'web-toys-battleship-v1';

export interface SessionCallbacks {
  onPeerConnected(): void;
  onSettings(mode: GameMode, gridSize: GridSize): void;
  onOpponentPlacement(ships: ShipPlacement[]): void;
  onOpponentReady(): void;
  onOpponentAction(action: Action): void;
  onOpponentResign(): void;
  onDisconnect(): void;
}

export class BattleshipSession {
  private readonly _room: Room;
  private readonly _ch: Channel<LobbyMessage>;
  private readonly _unsubs: Array<() => void> = [];
  private readonly _isHost: boolean;
  private _placementSent = false;

  constructor(room: Room, isHost: boolean, cbs: SessionCallbacks) {
    this._room = room;
    this._isHost = isHost;
    this._ch = room.channel<LobbyMessage>('game');

    this._unsubs.push(
      room.on('status', (status) => {
        if (status === 'disconnected') cbs.onDisconnect();
      }),

      room.on('peer-join', () => {
        cbs.onPeerConnected();
      }),

      this._ch.on((msg) => {
        switch (msg.type) {
          case 'settings':
            if (!this._isHost) cbs.onSettings(msg.mode, msg.gridSize);
            break;
          case 'settings-accepted':
            // Host: guest confirmed settings — both now know what game to play
            break;
          case 'placement':
            cbs.onOpponentPlacement(msg.ships);
            break;
          case 'ready':
            cbs.onOpponentReady();
            break;
          case 'action':
            cbs.onOpponentAction(msg.action);
            break;
          case 'resign':
            cbs.onOpponentResign();
            break;
        }
      }),
    );
  }

  sendSettings(mode: GameMode, gridSize: GridSize): void {
    this._ch.send({ type: 'settings', mode, gridSize });
  }

  sendPlacement(ships: ShipPlacement[]): void {
    if (this._placementSent) return;
    this._placementSent = true;
    this._ch.send({ type: 'placement', ships });
  }

  sendReady(): void {
    this._ch.send({ type: 'ready' });
  }

  sendAction(action: Action): void {
    this._ch.send({ type: 'action', action });
  }

  sendResign(): void {
    this._ch.send({ type: 'resign' });
  }

  get roomCode(): string {
    return this._room.code;
  }

  destroy(): void {
    for (const u of this._unsubs) u();
    this._room.destroy();
  }
}

export async function hostRoom(cbs: SessionCallbacks): Promise<BattleshipSession> {
  const { createRoom } = await import('@web-toys/multiplayer');
  const room: Room = await createRoom({ appId: APP_ID });
  return new BattleshipSession(room, true, cbs);
}

export async function guestJoin(code: string, cbs: SessionCallbacks): Promise<BattleshipSession> {
  const { joinRoom } = await import('@web-toys/multiplayer');
  const room: Room = await joinRoom(code, { appId: APP_ID });
  return new BattleshipSession(room, false, cbs);
}
