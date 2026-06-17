// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHistorySync } from './history-sync.ts'
import type { Channel, Room } from './room.ts'
import type { PeerStatus, Unsubscribe } from './types.ts'

// ---- Minimal Room stub -------------------------------------------------------

type Handler = (...args: unknown[]) => void

function makeStubRoom(): Room & {
  triggerPeerJoin(): void
  getChannelSends(name: string): unknown[]
  getChannelReceive(name: string): (msg: unknown) => void
} {
  const joinHandlers = new Set<Handler>()
  const channels = new Map<string, { sends: unknown[]; receiveHandler: Handler | null }>()

  function getOrCreateCh(name: string) {
    if (!channels.has(name)) channels.set(name, { sends: [], receiveHandler: null })
    return channels.get(name)!
  }

  return {
    code: 'test-room',
    status: 'waiting' as PeerStatus,
    channel<T>(name: string): Channel<T> {
      const ch = getOrCreateCh(name)
      return {
        send(msg: T) { ch.sends.push(msg) },
        on(handler: (msg: T) => void): Unsubscribe {
          ch.receiveHandler = handler as Handler
          return () => { ch.receiveHandler = null }
        },
      }
    },
    on: ((event: 'peer-join' | 'peer-leave' | 'status', handler: Handler) => {
      if (event === 'peer-join') joinHandlers.add(handler)
      return () => { joinHandlers.delete(handler) }
    }) as Room['on'],
    destroy() {},
    triggerPeerJoin() { joinHandlers.forEach((h) => h()) },
    getChannelSends(name: string): unknown[] {
      return getOrCreateCh(name).sends
    },
    getChannelReceive(name: string) {
      return (msg: unknown) => { getOrCreateCh(name).receiveHandler?.(msg) }
    },
  }
}

describe('createHistorySync', () => {
  let room: ReturnType<typeof makeStubRoom>
  let received: string[]

  beforeEach(() => {
    room = makeStubRoom()
    received = []
  })

  // Test 1: recordMove() sends via hs:move channel
  it('recordMove sends on the hs:move channel', () => {
    const sync = createHistorySync({ room, onMove: vi.fn(), getHistory: () => [] })
    sync.recordMove('my-move')
    expect(room.getChannelSends('hs:move')).toContain('my-move')
  })

  // Test 2: Receiving hs:move calls onMove
  it('fires onMove for live moves via hs:move channel', () => {
    createHistorySync({ room, onMove: (m) => received.push(m as string), getHistory: () => [] })
    const moveReceive = room.getChannelReceive('hs:move')
    moveReceive('move-x')
    expect(received).toEqual(['move-x'])
  })

  // Test 3: On peer-join, sends { knownCount: N } via hs:sync-req
  it('sends sync-request with knownCount 0 on peer-join (no prior moves)', () => {
    const history: string[] = []
    createHistorySync({ room, onMove: (m) => received.push(m as string), getHistory: () => history })
    room.triggerPeerJoin()
    expect(room.getChannelSends('hs:sync-req')).toEqual([{ knownCount: 0 }])
  })

  it('sends sync-request with correct knownCount after receiving moves', () => {
    createHistorySync({ room, onMove: (m) => received.push(m as string), getHistory: () => [] })
    // Simulate receiving 2 moves via hs:move
    const moveReceive = room.getChannelReceive('hs:move')
    moveReceive('m1')
    moveReceive('m2')
    room.triggerPeerJoin()
    expect(room.getChannelSends('hs:sync-req')).toEqual([{ knownCount: 2 }])
  })

  // Test 4: On hs:sync-req received, replies with getHistory().slice(knownCount) via hs:sync-res
  it('replies to sync-req with missing moves via hs:sync-res', () => {
    const history = ['move-a', 'move-b', 'move-c']
    createHistorySync({
      room,
      onMove: (m) => received.push(m as string),
      getHistory: () => history,
    })
    const syncReqReceive = room.getChannelReceive('hs:sync-req')
    syncReqReceive({ knownCount: 1 })
    expect(room.getChannelSends('hs:sync-res')).toEqual([{ moves: ['move-b', 'move-c'] }])
  })

  it('does not send hs:sync-res when peer already has all moves', () => {
    const history = ['move-a', 'move-b']
    createHistorySync({
      room,
      onMove: (m) => received.push(m as string),
      getHistory: () => history,
    })
    const syncReqReceive = room.getChannelReceive('hs:sync-req')
    syncReqReceive({ knownCount: 2 })
    expect(room.getChannelSends('hs:sync-res')).toHaveLength(0)
  })

  // Test 5: On hs:sync-res received, calls onMove for each move in the array
  it('calls onMove for each move in sync-res', () => {
    createHistorySync({ room, onMove: (m) => received.push(m as string), getHistory: () => [] })
    const syncResReceive = room.getChannelReceive('hs:sync-res')
    syncResReceive({ moves: ['move-a', 'move-b'] })
    expect(received).toEqual(['move-a', 'move-b'])
  })

  // Test 6: Full reconnect replay scenario
  it('replays all missing moves on reconnect (full scenario)', () => {
    const history = ['move-a', 'move-b', 'move-c']
    const sync = createHistorySync({
      room,
      onMove: (m) => received.push(m as string),
      getHistory: () => history,
    })

    // First connect: peer joins, both sides have 0 moves
    room.triggerPeerJoin()
    // Peer sends sync-req with knownCount=0 (they know 0 moves)
    const syncReqReceive = room.getChannelReceive('hs:sync-req')
    syncReqReceive({ knownCount: 0 })
    // We should have sent all 3 moves back via hs:sync-res
    expect(room.getChannelSends('hs:sync-res')).toEqual([{ moves: ['move-a', 'move-b', 'move-c'] }])

    // Peer responds to our sync-req with 0 moves (peer had none)
    const syncResReceive = room.getChannelReceive('hs:sync-res')
    syncResReceive({ moves: [] })
    expect(received).toHaveLength(0) // no moves from empty array

    // Now our localCount is 0 (we didn't receive anything via sync-res or hs:move)
    // Simulate 3 more moves recorded locally (these increment localCount)
    sync.recordMove('move-a')
    sync.recordMove('move-b')
    sync.recordMove('move-c')

    // Peer leaves and rejoins
    room.triggerPeerJoin()
    // We should have sent sync-req with knownCount=3
    const syncReqSends = room.getChannelSends('hs:sync-req')
    expect(syncReqSends[syncReqSends.length - 1]).toEqual({ knownCount: 3 })

    // Peer tells us they know 0 moves — we reply with all 3
    syncReqReceive({ knownCount: 0 })
    const syncResSends = room.getChannelSends('hs:sync-res')
    expect(syncResSends[syncResSends.length - 1]).toEqual({ moves: ['move-a', 'move-b', 'move-c'] })

    // Peer sends us sync-res with all 3 moves (we knew 3 but they send from their perspective)
    syncResReceive({ moves: ['move-a', 'move-b', 'move-c'] })
    expect(received).toEqual(['move-a', 'move-b', 'move-c'])
  })

  // Test 7: destroy() unsubscribes all handlers
  it('destroy stops receiving moves and peer-join events', () => {
    const sync = createHistorySync({
      room,
      onMove: (m) => received.push(m as string),
      getHistory: () => [],
    })
    sync.destroy()

    // After destroy, peer-join should not send sync-req
    room.triggerPeerJoin()
    expect(room.getChannelSends('hs:sync-req')).toHaveLength(0)

    // After destroy, hs:move should not call onMove
    const moveReceive = room.getChannelReceive('hs:move')
    moveReceive('after-destroy')
    expect(received).toHaveLength(0)
  })
})
