// SPDX-License-Identifier: Apache-2.0
import type { Player } from '../engine/index.ts'

export type LobbyMessage =
  | { type: 'ready'; hostSide: Player }
  | { type: 'side-accepted' }
  | { type: 'resign' }
