// SPDX-License-Identifier: Apache-2.0
import type { Room } from './room.ts'
import type { Unsubscribe } from './types.ts'

type SyncReq = { knownCount: number }
type SyncRes<T> = { moves: T[] }

export interface HistorySync<TMove> {
  /** Call after each local move to broadcast it to the peer. */
  recordMove(move: TMove): void
  destroy(): void
}

export function createHistorySync<TMove>(config: {
  room: Room
  onMove: (move: TMove) => void
  getHistory: () => TMove[]
}): HistorySync<TMove> {
  const { room, onMove, getHistory } = config

  const moveCh = room.channel<TMove>('hs:move')
  const reqCh = room.channel<SyncReq>('hs:sync-req')
  const resCh = room.channel<SyncRes<TMove>>('hs:sync-res')

  let localCount = 0

  // On peer-join (initial or reconnect): request any moves we missed
  const unsubJoin: Unsubscribe = room.on('peer-join', () => {
    reqCh.send({ knownCount: localCount })
  })

  // Respond to sync requests: send moves from knownCount onward
  const unsubReq: Unsubscribe = reqCh.on(({ knownCount }) => {
    const missing = getHistory().slice(knownCount)
    if (missing.length > 0) {
      resCh.send({ moves: missing })
    }
  })

  // Replay moves from sync responses
  const unsubRes: Unsubscribe = resCh.on(({ moves }) => {
    for (const move of moves) {
      localCount++
      onMove(move)
    }
  })

  // Live moves arriving from the peer
  const unsubMove: Unsubscribe = moveCh.on((move) => {
    localCount++
    onMove(move)
  })

  return {
    recordMove(move: TMove): void {
      moveCh.send(move)
      localCount++
    },
    destroy(): void {
      unsubJoin()
      unsubReq()
      unsubRes()
      unsubMove()
    },
  }
}
