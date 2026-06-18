// SPDX-License-Identifier: Apache-2.0

export type PeerStatus = 'waiting' | 'connected' | 'disconnected' | 'reconnecting'

export interface RoomConfig {
  /** Per-game namespace, e.g. "web-toys-uttt-v1". Included in the room-ID hash
   *  so two games using the same human-readable code never collide. */
  appId: string
  /** Nostr relay WebSocket URLs. Defaults to three well-known public relays. */
  relays?: string[]
}

export type Unsubscribe = () => void
