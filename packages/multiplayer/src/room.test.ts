// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest'

// --- Trystero mock ---
let mockOnPeerJoin: ((id: string) => void) | null = null
let mockOnPeerLeave: ((id: string) => void) | null = null
const mockSendFns = new Map<string, ReturnType<typeof vi.fn>>()
const mockReceiveFns = new Map<string, ReturnType<typeof vi.fn>>()

vi.mock('trystero/nostr', () => ({
  joinRoom: vi.fn(() => ({
    onPeerJoin: (cb: (id: string) => void) => { mockOnPeerJoin = cb },
    onPeerLeave: (cb: (id: string) => void) => { mockOnPeerLeave = cb },
    makeAction: vi.fn((label: string) => {
      const sendFn = vi.fn(() => [Promise.resolve()])
      const receiveFn = vi.fn()
      mockSendFns.set(label, sendFn)
      mockReceiveFns.set(label, receiveFn)
      return [sendFn, receiveFn]
    }),
    leave: vi.fn(),
    getPeers: vi.fn(() => []),
  })),
}))

import { createRoom, joinRoom } from './room.ts'

beforeEach(() => {
  mockOnPeerJoin = null
  mockOnPeerLeave = null
  mockSendFns.clear()
  mockReceiveFns.clear()
})

describe('createRoom', () => {
  it('starts in waiting status', async () => {
    const room = await createRoom({ appId: 'test-v1' })
    expect(room.status).toBe('waiting')
  })

  it('transitions to connected on peer-join', async () => {
    const room = await createRoom({ appId: 'test-v1' })
    const handler = vi.fn()
    room.on('peer-join', handler)
    mockOnPeerJoin?.('peer-1')
    expect(room.status).toBe('connected')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('transitions to disconnected on peer-leave', async () => {
    const room = await createRoom({ appId: 'test-v1' })
    mockOnPeerJoin?.('peer-1')
    const handler = vi.fn()
    room.on('peer-leave', handler)
    mockOnPeerLeave?.('peer-1')
    expect(room.status).toBe('disconnected')
    expect(handler).toHaveBeenCalledOnce()
  })

  it('emits status events', async () => {
    const room = await createRoom({ appId: 'test-v1' })
    const statuses: string[] = []
    room.on('status', (s) => statuses.push(s))
    mockOnPeerJoin?.('peer-1')
    mockOnPeerLeave?.('peer-1')
    expect(statuses).toEqual(['connected', 'disconnected'])
  })

  it('unsubscribe removes the handler', async () => {
    const room = await createRoom({ appId: 'test-v1' })
    const handler = vi.fn()
    const unsub = room.on('peer-join', handler)
    unsub()
    mockOnPeerJoin?.('peer-1')
    expect(handler).not.toHaveBeenCalled()
  })
})

describe('joinRoom', () => {
  it('preserves the supplied code', async () => {
    const room = await joinRoom('swift-panda-7', { appId: 'test-v1' })
    expect(room.code).toBe('swift-panda-7')
  })
})

describe('Channel', () => {
  it('send calls the Trystero send function', async () => {
    const room = await createRoom({ appId: 'test-v1' })
    const ch = room.channel<{ n: number }>('test-ch')
    ch.send({ n: 42 })
    expect(mockSendFns.get('test-ch')).toHaveBeenCalledWith({ n: 42 })
  })

  it('on handler fires when Trystero receives a message', async () => {
    const room = await createRoom({ appId: 'test-v1' })
    const ch = room.channel<string>('test-ch')
    const handler = vi.fn()
    ch.on(handler)
    // Simulate Trystero calling the receive handler
    const receiveFn = mockReceiveFns.get('test-ch')
    expect(receiveFn).toHaveBeenCalledOnce() // called once during setup
    const registeredHandler = receiveFn?.mock.calls[0]?.[0]
    registeredHandler?.('hello', 'peer-1')
    expect(handler).toHaveBeenCalledWith('hello')
  })

  it('returns same channel instance for same name', async () => {
    const room = await createRoom({ appId: 'test-v1' })
    expect(room.channel('a')).toBe(room.channel('a'))
  })
})
