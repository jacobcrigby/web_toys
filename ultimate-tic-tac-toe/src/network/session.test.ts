// SPDX-License-Identifier: Apache-2.0

import type { Channel, Room, Unsubscribe } from '@web-toys/multiplayer';
import { describe, expect, it, vi } from 'vitest';
import type { Move } from '../engine/index.ts';
import { MultiplayerSession } from './session.ts';

// ---- Minimal Room stub -------------------------------------------------------
function makeStubRoom(): Room & {
  triggerPeerJoin(): void;
  triggerPeerLeave(): void;
  receiveOnChannel<T>(name: string, msg: T): void;
  sentOnChannel<T>(name: string): T[];
} {
  const joinHandlers = new Set<() => void>();
  const leaveHandlers = new Set<() => void>();
  const statusHandlers = new Set<(s: string) => void>();
  const channelData = new Map<
    string,
    { sent: unknown[]; receiver: ((msg: unknown) => void) | null }
  >();

  function ch(name: string) {
    if (!channelData.has(name)) channelData.set(name, { sent: [], receiver: null });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const entry = channelData.get(name);
    if (!entry) throw new Error(`channel ${name} missing`);
    return entry;
  }

  return {
    code: 'test',
    status: 'waiting' as const,
    channel<T>(name: string): Channel<T> {
      return {
        send(msg: T) {
          ch(name).sent.push(msg);
        },
        on(handler: (msg: T) => void): Unsubscribe {
          ch(name).receiver = handler as (msg: unknown) => void;
          return () => {
            ch(name).receiver = null;
          };
        },
      };
    },
    on(
      event: 'peer-join' | 'peer-leave' | 'status',
      handler: (() => void) | ((s: string) => void),
    ): Unsubscribe {
      if (event === 'peer-join') joinHandlers.add(handler as () => void);
      if (event === 'peer-leave') leaveHandlers.add(handler as () => void);
      if (event === 'status') statusHandlers.add(handler as (s: string) => void);
      return () => {
        joinHandlers.delete(handler as () => void);
        leaveHandlers.delete(handler as () => void);
        statusHandlers.delete(handler as (s: string) => void);
      };
    },
    destroy() {},
    triggerPeerJoin() {
      for (const h of joinHandlers) h();
    },
    triggerPeerLeave() {
      for (const h of leaveHandlers) h();
    },
    receiveOnChannel<T>(name: string, msg: T) {
      ch(name).receiver?.(msg);
    },
    sentOnChannel<T>(name: string): T[] {
      return ch(name).sent as T[];
    },
  };
}

const MOVE_A: Move = { board: 0, cell: 4 };
const MOVE_B: Move = { board: 4, cell: 4 };

describe('MultiplayerSession — host flow', () => {
  it('sends ready with hostSide when peer joins', () => {
    const room = makeStubRoom();
    new MultiplayerSession({
      room,
      isHost: true,
      hostSide: 'X',
      onStatusChange: vi.fn(),
      onGameStart: vi.fn(),
      onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(),
      getHistory: () => [],
    });
    room.triggerPeerJoin();
    expect(room.sentOnChannel('lobby')).toContainEqual({ type: 'ready', hostSide: 'X' });
  });

  it('calls onGameStart with hostSide when side-accepted received', () => {
    const onGameStart = vi.fn();
    const room = makeStubRoom();
    new MultiplayerSession({
      room,
      isHost: true,
      hostSide: 'X',
      onStatusChange: vi.fn(),
      onGameStart,
      onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(),
      getHistory: () => [],
    });
    room.receiveOnChannel('lobby', { type: 'side-accepted' });
    expect(onGameStart).toHaveBeenCalledWith('X');
  });
});

describe('MultiplayerSession — guest flow', () => {
  it('calls onGameStart with opposite side when ready received', () => {
    const onGameStart = vi.fn();
    const room = makeStubRoom();
    new MultiplayerSession({
      room,
      isHost: false,
      hostSide: 'X',
      onStatusChange: vi.fn(),
      onGameStart,
      onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(),
      getHistory: () => [],
    });
    room.receiveOnChannel('lobby', { type: 'ready', hostSide: 'X' });
    expect(onGameStart).toHaveBeenCalledWith('O');
    expect(room.sentOnChannel('lobby')).toContainEqual({ type: 'side-accepted' });
  });
});

describe('MultiplayerSession — resign', () => {
  it('sends resign on sendResign()', () => {
    const room = makeStubRoom();
    const session = new MultiplayerSession({
      room,
      isHost: true,
      hostSide: 'X',
      onStatusChange: vi.fn(),
      onGameStart: vi.fn(),
      onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(),
      getHistory: () => [],
    });
    session.sendResign();
    expect(room.sentOnChannel('lobby')).toContainEqual({ type: 'resign' });
  });

  it('calls onOpponentResign when resign received', () => {
    const onOpponentResign = vi.fn();
    const room = makeStubRoom();
    new MultiplayerSession({
      room,
      isHost: false,
      hostSide: 'X',
      onStatusChange: vi.fn(),
      onGameStart: vi.fn(),
      onOpponentResign,
      onRemoteMove: vi.fn(),
      getHistory: () => [],
    });
    room.receiveOnChannel('lobby', { type: 'resign' });
    expect(onOpponentResign).toHaveBeenCalledOnce();
  });
});

describe('MultiplayerSession — move relay', () => {
  it('onRemoteMove is called when hs:move is received', () => {
    const onRemoteMove = vi.fn();
    const room = makeStubRoom();
    new MultiplayerSession({
      room,
      isHost: true,
      hostSide: 'X',
      onStatusChange: vi.fn(),
      onGameStart: vi.fn(),
      onOpponentResign: vi.fn(),
      onRemoteMove,
      getHistory: () => [],
    });
    room.receiveOnChannel('hs:move', MOVE_A);
    expect(onRemoteMove).toHaveBeenCalledWith(MOVE_A);
  });

  it('sendMove sends on hs:move channel', () => {
    const room = makeStubRoom();
    const session = new MultiplayerSession({
      room,
      isHost: true,
      hostSide: 'X',
      onStatusChange: vi.fn(),
      onGameStart: vi.fn(),
      onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(),
      getHistory: () => [],
    });
    session.sendMove(MOVE_B);
    expect(room.sentOnChannel('hs:move')).toContainEqual(MOVE_B);
  });
});
