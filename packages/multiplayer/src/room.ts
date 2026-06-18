// SPDX-License-Identifier: Apache-2.0
import { joinRoom as trysteroJoin } from 'trystero/nostr'
import { deriveRoomId, generateCode } from './room-code.ts'
import type { PeerStatus, RoomConfig, Unsubscribe } from './types.ts'

const TRYSTERO_APP_ID = 'web-toys'

const DEFAULT_RELAYS = [
  'wss://relay.damus.io',
  'wss://relay.nostr.band',
  'wss://nos.lol',
]

type TrysteroRoom = ReturnType<typeof trysteroJoin>

// ---- Channel ----------------------------------------------------------------

export interface Channel<T> {
  send(msg: T): void
  on(handler: (msg: T) => void): Unsubscribe
}

class ChannelImpl<T> implements Channel<T> {
  private readonly _broadcast: (data: T) => unknown
  private readonly _handlers = new Set<(msg: T) => void>()

  constructor(name: string, trRoom: TrysteroRoom) {
    // Cast needed because Trystero constrains T extends DataPayload but our
    // public Channel<T> is intentionally unconstrained.
    const [broadcast, receive] = trRoom.makeAction(name) as unknown as [
      (data: T) => Promise<void[]>,
      (cb: (data: T, peerId: string) => void) => void,
    ]
    this._broadcast = broadcast
    receive((data) => {
      this._handlers.forEach((h) => h(data))
    })
  }

  send(msg: T): void {
    this._broadcast(msg)
  }

  on(handler: (msg: T) => void): Unsubscribe {
    this._handlers.add(handler)
    return () => {
      this._handlers.delete(handler)
    }
  }
}

// ---- Room -------------------------------------------------------------------

type EventMap = {
  'peer-join': []
  'peer-leave': []
  status: [PeerStatus]
}

export interface Room {
  readonly code: string
  readonly status: PeerStatus
  channel<T>(name: string): Channel<T>
  on(event: 'peer-join' | 'peer-leave', handler: () => void): Unsubscribe
  on(event: 'status', handler: (s: PeerStatus) => void): Unsubscribe
  destroy(): void
}

class RoomImpl implements Room {
  readonly code: string
  private _status: PeerStatus = 'waiting'
  private readonly _trRoom: TrysteroRoom
  private readonly _handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  private readonly _channels = new Map<string, ChannelImpl<unknown>>()

  constructor(code: string, trRoom: TrysteroRoom) {
    this.code = code
    this._trRoom = trRoom

    trRoom.onPeerJoin(() => {
      this._setStatus('connected')
      this._emit('peer-join')
    })

    trRoom.onPeerLeave(() => {
      this._setStatus('disconnected')
      this._emit('peer-leave')
    })
  }

  get status(): PeerStatus {
    return this._status
  }

  channel<T>(name: string): Channel<T> {
    if (!this._channels.has(name)) {
      this._channels.set(name, new ChannelImpl<T>(name, this._trRoom) as ChannelImpl<unknown>)
    }
    return this._channels.get(name) as Channel<T>
  }

  on(event: 'peer-join' | 'peer-leave', handler: () => void): Unsubscribe
  on(event: 'status', handler: (s: PeerStatus) => void): Unsubscribe
  on(event: keyof EventMap, handler: (() => void) | ((s: PeerStatus) => void)): Unsubscribe {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set())
    // Non-null assertion: we just set it if absent
    this._handlers.get(event)!.add(handler as (...args: unknown[]) => void)
    return () => {
      this._handlers.get(event)?.delete(handler as (...args: unknown[]) => void)
    }
  }

  destroy(): void {
    void this._trRoom.leave()
    this._handlers.clear()
    this._channels.clear()
  }

  private _setStatus(s: PeerStatus): void {
    if (this._status === s) return
    this._status = s
    this._emit('status', s)
  }

  private _emit(event: string, ...args: unknown[]): void {
    this._handlers.get(event)?.forEach((h) => h(...args))
  }
}

// ---- Factory ----------------------------------------------------------------

async function _makeRoom(code: string, config: RoomConfig): Promise<Room> {
  const roomId = await deriveRoomId(config.appId, code)
  const trRoom = trysteroJoin(
    { appId: TRYSTERO_APP_ID, relayUrls: config.relays ?? DEFAULT_RELAYS },
    roomId,
  )
  return new RoomImpl(code, trRoom)
}

export async function createRoom(config: RoomConfig): Promise<Room> {
  return _makeRoom(generateCode(), config)
}

export async function joinRoom(code: string, config: RoomConfig): Promise<Room> {
  return _makeRoom(code, config)
}
