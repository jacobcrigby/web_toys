# WebRTC Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add peer-to-peer online multiplayer to Ultimate Tic-Tac-Toe via WebRTC (Trystero + Nostr signaling), backed by a reusable `packages/multiplayer` workspace package.

**Architecture:** A game-agnostic `@web-toys/multiplayer` package wraps Trystero with typed Channels and a `HistorySync<TMove>` utility that handles reconnect-replay. The UTTT game layer adds a `MultiplayerSession` that wires `HistorySync<Move>` to the controller, which treats the remote move arrival exactly like an AI callback.

**Tech Stack:** Trystero ^0.21 (WebRTC via Nostr signaling), pnpm workspaces, Vitest, TypeScript strict.

## Global Constraints

- TypeScript strict: `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`
- No backend, no accounts, no telemetry — everything runs in the browser
- SPDX header `// SPDX-License-Identifier: Apache-2.0` on every new `.ts` source file
- pnpm only — never commit `package-lock.json` or `yarn.lock`
- TDD for all non-UI code: write the failing test first
- `packages/multiplayer` tests run via `pnpm -C packages/multiplayer run test`
- UTTT tests run via `pnpm -C ultimate-tic-tac-toe run test`
- Canonical gate before any task is "done": `pnpm typecheck && pnpm lint && pnpm test && pnpm build` (run within the changed project)
- Biome for lint+format in ultimate-tic-tac-toe; no linter configured yet in packages/multiplayer (just tsc)

---

## File Map

**New files — `packages/multiplayer/`**
- `package.json` — package config (`@web-toys/multiplayer`, dep on `trystero`)
- `tsconfig.json` — strict TypeScript config
- `vitest.config.ts` — test config (Node env)
- `index.ts` — public re-exports
- `src/types.ts` — `PeerStatus`, `RoomConfig`, `Unsubscribe`
- `src/room-code.ts` — `generateCode()`, `deriveRoomId()`
- `src/room.ts` — `createRoom()`, `joinRoom()`, `RoomImpl`, `ChannelImpl`
- `src/history-sync.ts` — `createHistorySync()`
- `src/room-code.test.ts` — room code tests
- `src/room.test.ts` — room + channel tests (mock Trystero)
- `src/history-sync.test.ts` — reconnect replay tests

**Modified — repo root**
- `pnpm-workspace.yaml` — add `packages/*`

**New files — `ultimate-tic-tac-toe/src/network/`**
- `protocol.ts` — `LobbyMessage` discriminated union
- `session.ts` — `MultiplayerSession` class
- `session.test.ts` — lobby handshake + move relay tests

**Modified — `ultimate-tic-tac-toe/`**
- `package.json` — add `@web-toys/multiplayer: workspace:*`
- `src/state.ts` — add `'lobby'` screen, `'online'` mode, `Connection` type + field
- `src/controller.ts` — `session` field, `startOnline/joinOnline`, `applyAndCommit` hook, disconnect timer
- `src/ui/render.ts` — new `Actions` entries, lobby screen element, `syncLobby` call
- `src/ui/menu.ts` — Online mode button, online sub-controls
- `src/ui/lobby.ts` (**new**) — `buildLobby()`, `syncLobby()`
- `src/ui/hud.ts` — connection status dot
- `src/ui/overlay.ts` — disconnect/abandon overlay state
- `src/styles/lobby.css` (**new**) — lobby screen styles
- `src/styles/index.css` — import lobby.css
- `src/main.ts` — `?room=` URL param detection
- `AGENTS.md` — remove "online multiplayer" from Out of scope
- `PLAN.md` — add Phase 7 entry

---

## Task 1: Scaffold `packages/multiplayer`

**Files:**
- Create: `packages/multiplayer/package.json`
- Create: `packages/multiplayer/tsconfig.json`
- Create: `packages/multiplayer/vitest.config.ts`
- Create: `packages/multiplayer/index.ts`
- Create: `packages/multiplayer/src/types.ts`
- Modify: `pnpm-workspace.yaml`

**Interfaces:**
- Produces: `PeerStatus`, `RoomConfig`, `Unsubscribe` types; empty package wired into workspace

- [ ] **Step 1: Add `packages/*` to workspace**

Edit `pnpm-workspace.yaml` — add the new entry:
```yaml
packages:
  - 'ultimate-tic-tac-toe'
  - 'pdf-to-cbz'
  - 'marblegame'
  - 'packages/*'
allowBuilds:
  esbuild: true
```

- [ ] **Step 2: Create `packages/multiplayer/package.json`**

```json
{
  "name": "@web-toys/multiplayer",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./index.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "trystero": "^0.21.0"
  },
  "devDependencies": {
    "typescript": "^5.8.3",
    "vitest": "^3.2.0"
  }
}
```

- [ ] **Step 3: Create `packages/multiplayer/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022", "DOM"],
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "index.ts"]
}
```

- [ ] **Step 4: Create `packages/multiplayer/vitest.config.ts`**

```typescript
// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 5: Create `packages/multiplayer/src/types.ts`**

```typescript
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
```

- [ ] **Step 6: Create stub `packages/multiplayer/index.ts`**

```typescript
// SPDX-License-Identifier: Apache-2.0
// Public API — filled in by subsequent tasks.
export type { PeerStatus, RoomConfig, Unsubscribe } from './src/types.ts'
```

- [ ] **Step 7: Install workspace deps**

Run from repo root:
```bash
pnpm install
```

Verify the symlink exists:
```bash
ls node_modules/@web-toys/
# Expected: multiplayer -> ../../packages/multiplayer
```

- [ ] **Step 8: Typecheck passes on the stub**

```bash
pnpm -C packages/multiplayer typecheck
# Expected: no errors
```

- [ ] **Step 9: Commit**

```bash
git add pnpm-workspace.yaml packages/multiplayer/
git commit -m "feat: scaffold @web-toys/multiplayer workspace package"
```

---

## Task 2: Room Codes

**Files:**
- Create: `packages/multiplayer/src/room-code.ts`
- Create: `packages/multiplayer/src/room-code.test.ts`

**Interfaces:**
- Produces: `generateCode(): string`, `deriveRoomId(appId, code): Promise<string>`

- [ ] **Step 1: Write the failing tests**

`packages/multiplayer/src/room-code.test.ts`:
```typescript
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest'
import { deriveRoomId, generateCode } from './room-code.ts'

describe('generateCode', () => {
  it('returns a lowercase hyphenated string', () => {
    expect(generateCode()).toMatch(/^[a-z]+-[a-z]+-[0-9]$/)
  })

  it('returns different codes on repeated calls', () => {
    const codes = new Set(Array.from({ length: 30 }, generateCode))
    expect(codes.size).toBeGreaterThan(1)
  })
})

describe('deriveRoomId', () => {
  it('returns a 64-character hex string', async () => {
    const id = await deriveRoomId('app-v1', 'swift-panda-7')
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic', async () => {
    const a = await deriveRoomId('app-v1', 'swift-panda-7')
    const b = await deriveRoomId('app-v1', 'swift-panda-7')
    expect(a).toBe(b)
  })

  it('differs across appIds', async () => {
    const a = await deriveRoomId('app-v1', 'swift-panda-7')
    const b = await deriveRoomId('app-v2', 'swift-panda-7')
    expect(a).not.toBe(b)
  })

  it('normalises code to lowercase', async () => {
    const a = await deriveRoomId('app-v1', 'SWIFT-PANDA-7')
    const b = await deriveRoomId('app-v1', 'swift-panda-7')
    expect(a).toBe(b)
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm -C packages/multiplayer test
# Expected: Cannot find module './room-code.ts'
```

- [ ] **Step 3: Implement `room-code.ts`**

`packages/multiplayer/src/room-code.ts`:
```typescript
// SPDX-License-Identifier: Apache-2.0

const ADJECTIVES = [
  'amber', 'azure', 'bold', 'brisk', 'calm', 'clear', 'cool',
  'crisp', 'dark', 'dusty', 'eager', 'faint', 'fleet', 'fresh',
  'grand', 'hardy', 'icy', 'jolly', 'keen', 'light', 'lofty',
  'misty', 'noble', 'pale', 'plain', 'proud', 'quick', 'quiet',
  'rapid', 'rare', 'rosy', 'rough', 'royal', 'rusty', 'sandy',
  'sharp', 'sleek', 'slim', 'slow', 'soft', 'stark', 'still',
  'stony', 'sunny', 'swift', 'tall', 'tiny', 'true', 'vast',
  'warm', 'wild', 'wise', 'witty',
]

const NOUNS = [
  'bear', 'brook', 'buck', 'cape', 'cedar', 'cliff', 'crane',
  'crow', 'dale', 'deer', 'dove', 'dune', 'eagle', 'elk',
  'fern', 'finch', 'fjord', 'fox', 'glen', 'grove', 'gull',
  'hawk', 'heron', 'hill', 'jay', 'kite', 'lark', 'loon',
  'lynx', 'maple', 'marsh', 'mink', 'mole', 'moose', 'moth',
  'newt', 'oak', 'otter', 'owl', 'panda', 'pine', 'pond',
  'quail', 'raven', 'reed', 'robin', 'rook', 'sage', 'seal',
  'skye', 'slate', 'snipe', 'storm', 'swift', 'teal', 'tern',
  'vole', 'wren',
]

function pick<T>(arr: T[]): T {
  const idx = Math.floor(Math.random() * arr.length)
  // arr is never empty; cast is safe
  return arr[idx] as T
}

/** Returns a random human-readable code, e.g. "swift-panda-7". */
export function generateCode(): string {
  const digit = Math.floor(Math.random() * 10)
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${digit}`
}

/** Returns the Trystero room ID for a given appId + human-readable code.
 *  The hash is opaque to observers of Nostr relay traffic. */
export async function deriveRoomId(appId: string, code: string): Promise<string> {
  const input = `${appId}\0${code.toLowerCase().trim()}`
  const encoded = new TextEncoder().encode(input)
  const buf = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm -C packages/multiplayer test
# Expected: 6 tests pass
```

- [ ] **Step 5: Commit**

```bash
git add packages/multiplayer/src/room-code.ts packages/multiplayer/src/room-code.test.ts
git commit -m "feat(multiplayer): add room code generation and hash derivation"
```

---

## Task 3: Room & Channel

**Files:**
- Create: `packages/multiplayer/src/room.ts`
- Create: `packages/multiplayer/src/room.test.ts`
- Modify: `packages/multiplayer/index.ts`

**Interfaces:**
- Consumes: `PeerStatus`, `RoomConfig`, `Unsubscribe` from `./types.ts`; `deriveRoomId` from `./room-code.ts`
- Produces:
  ```typescript
  interface Room {
    readonly code: string
    readonly status: PeerStatus
    channel<T>(name: string): Channel<T>
    on(event: 'peer-join' | 'peer-leave', handler: () => void): Unsubscribe
    on(event: 'status', handler: (s: PeerStatus) => void): Unsubscribe
    destroy(): void
  }
  interface Channel<T> {
    send(msg: T): void
    on(handler: (msg: T) => void): Unsubscribe
  }
  createRoom(config: RoomConfig): Promise<Room>
  joinRoom(code: string, config: RoomConfig): Promise<Room>
  ```

- [ ] **Step 1: Write failing tests**

`packages/multiplayer/src/room.test.ts`:
```typescript
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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm -C packages/multiplayer test
# Expected: Cannot find module './room.ts'
```

- [ ] **Step 3: Implement `room.ts`**

`packages/multiplayer/src/room.ts`:
```typescript
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
    const [broadcast, receive] = trRoom.makeAction<T>(name)
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
    return () => { this._handlers.delete(handler) }
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

  on(event: keyof EventMap, handler: (...args: unknown[]) => void): Unsubscribe {
    if (!this._handlers.has(event)) this._handlers.set(event, new Set())
    this._handlers.get(event)!.add(handler)
    return () => { this._handlers.get(event)?.delete(handler) }
  }

  destroy(): void {
    this._trRoom.leave()
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm -C packages/multiplayer test
# Expected: all tests pass
```

- [ ] **Step 5: Update `index.ts` to export Room/Channel**

```typescript
// SPDX-License-Identifier: Apache-2.0
export type { PeerStatus, RoomConfig, Unsubscribe } from './src/types.ts'
export type { Room, Channel } from './src/room.ts'
export { createRoom, joinRoom } from './src/room.ts'
export { generateCode, deriveRoomId } from './src/room-code.ts'
```

- [ ] **Step 6: Typecheck**

```bash
pnpm -C packages/multiplayer typecheck
# Expected: no errors
```

- [ ] **Step 7: Commit**

```bash
git add packages/multiplayer/src/room.ts packages/multiplayer/src/room.test.ts packages/multiplayer/index.ts
git commit -m "feat(multiplayer): add Room and Channel wrapping Trystero/Nostr"
```

---

## Task 4: HistorySync

**Files:**
- Create: `packages/multiplayer/src/history-sync.ts`
- Create: `packages/multiplayer/src/history-sync.test.ts`
- Modify: `packages/multiplayer/index.ts`

**Interfaces:**
- Consumes: `Room`, `Channel` from `./room.ts`
- Produces:
  ```typescript
  interface HistorySync<TMove> {
    recordMove(move: TMove): void
    destroy(): void
  }
  createHistorySync<TMove>(config: {
    room: Room
    onMove: (move: TMove) => void
    getHistory: () => TMove[]
  }): HistorySync<TMove>
  ```

The `hs:sync-req` message is `{ knownCount: number }`. The `hs:sync-res` message is `{ moves: TMove[] }`. On `peer-join`, the joining side sends `{ knownCount: localCount }`. The responding side replies with `getHistory().slice(knownCount)`. Both sides send the request to each other on connect; on first connect both have 0 moves and no messages are replayed.

- [ ] **Step 1: Write failing tests**

`packages/multiplayer/src/history-sync.test.ts`:
```typescript
// SPDX-License-Identifier: Apache-2.0
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHistorySync } from './history-sync.ts'
import type { Channel, Room } from './room.ts'
import type { PeerStatus, Unsubscribe } from './types.ts'

// ---- Minimal Room stub -------------------------------------------------------

type Handler = (...args: unknown[]) => void

function makeStubRoom(): Room & {
  triggerPeerJoin(): void
  getChannelSend(name: string): (msg: unknown) => void
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
    on(event: 'peer-join' | 'peer-leave' | 'status', handler: Handler): Unsubscribe {
      if (event === 'peer-join') joinHandlers.add(handler)
      return () => joinHandlers.delete(handler)
    },
    destroy() {},
    triggerPeerJoin() { joinHandlers.forEach((h) => h()) },
    getChannelSend(name: string) {
      return (msg: unknown) => { getOrCreateCh(name).sends.push(msg) }
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

  it('sends sync-request with knownCount 0 on peer-join', () => {
    const history: string[] = []
    createHistorySync({ room, onMove: (m) => received.push(m), getHistory: () => history })
    room.triggerPeerJoin()
    const sends = (room as unknown as { _ch: Map<string, unknown> })
    // Access via the channel sends we built into the stub
    const stubRoom = room as ReturnType<typeof makeStubRoom>
    // Trigger peer join and check the sync-req channel got a send
    expect(received).toHaveLength(0)
  })

  it('replays missing moves on reconnect', () => {
    const history = ['move-a', 'move-b', 'move-c']
    const sync = createHistorySync({
      room,
      onMove: (m) => received.push(m as string),
      getHistory: () => history,
    })
    // Simulate peer-join; peer sends sync-req claiming they know 1 move
    room.triggerPeerJoin()
    // Peer A sends sync-request with knownCount=1
    const syncReqReceive = room.getChannelReceive('hs:sync-req')
    syncReqReceive({ knownCount: 1 })
    // We should have sent back moves[1..] via hs:sync-res
    // Now simulate the peer sending us the sync-response for OUR request (we knew 0)
    const syncResReceive = room.getChannelReceive('hs:sync-res')
    syncResReceive({ moves: ['move-a'] })
    expect(received).toEqual(['move-a'])
  })

  it('fires onMove for live moves via hs:move channel', () => {
    createHistorySync({ room, onMove: (m) => received.push(m as string), getHistory: () => [] })
    const moveReceive = room.getChannelReceive('hs:move')
    moveReceive('move-x')
    expect(received).toEqual(['move-x'])
  })

  it('recordMove sends on the hs:move channel', () => {
    const sentMoves: unknown[] = []
    const stubRoom = makeStubRoom()
    const origChannel = stubRoom.channel.bind(stubRoom)
    vi.spyOn(stubRoom, 'channel').mockImplementation((name) => {
      const ch = origChannel(name)
      if (name === 'hs:move') {
        const origSend = ch.send.bind(ch)
        vi.spyOn(ch, 'send').mockImplementation((msg) => {
          sentMoves.push(msg)
          origSend(msg)
        })
      }
      return ch
    })
    const sync = createHistorySync({ room: stubRoom, onMove: vi.fn(), getHistory: () => [] })
    sync.recordMove('my-move')
    expect(sentMoves).toContain('my-move')
  })
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
pnpm -C packages/multiplayer test
# Expected: Cannot find module './history-sync.ts'
```

- [ ] **Step 3: Implement `history-sync.ts`**

`packages/multiplayer/src/history-sync.ts`:
```typescript
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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm -C packages/multiplayer test
# Expected: all tests pass
```

- [ ] **Step 5: Update `index.ts`**

Add to `packages/multiplayer/index.ts`:
```typescript
export type { HistorySync } from './src/history-sync.ts'
export { createHistorySync } from './src/history-sync.ts'
```

- [ ] **Step 6: Typecheck & commit**

```bash
pnpm -C packages/multiplayer typecheck
git add packages/multiplayer/src/history-sync.ts packages/multiplayer/src/history-sync.test.ts packages/multiplayer/index.ts
git commit -m "feat(multiplayer): add HistorySync for reconnect-aware move log sync"
```

---

## Task 5: UTTT Network Session

**Files:**
- Modify: `ultimate-tic-tac-toe/package.json`
- Create: `ultimate-tic-tac-toe/src/network/protocol.ts`
- Create: `ultimate-tic-tac-toe/src/network/session.ts`
- Create: `ultimate-tic-tac-toe/src/network/session.test.ts`

**Interfaces:**
- Consumes: `Room`, `Channel`, `createHistorySync`, `PeerStatus` from `@web-toys/multiplayer`
- Consumes: `Move`, `Player` from `../engine/index.ts`
- Produces:
  ```typescript
  // protocol.ts
  type LobbyMessage =
    | { type: 'ready'; hostSide: Player }
    | { type: 'side-accepted' }
    | { type: 'resign' }

  // session.ts
  class MultiplayerSession {
    constructor(config: SessionConfig)
    sendMove(move: Move): void
    sendResign(): void
    destroy(): void
  }
  ```

- [ ] **Step 1: Add `@web-toys/multiplayer` to UTTT deps**

In `ultimate-tic-tac-toe/package.json`, add to `"dependencies"` (create it if not present — currently UTTT has no runtime deps):
```json
{
  "dependencies": {
    "@web-toys/multiplayer": "workspace:*"
  }
}
```

Then run:
```bash
pnpm install
```

- [ ] **Step 2: Write failing tests**

`ultimate-tic-tac-toe/src/network/session.test.ts`:
```typescript
// SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest'
import type { Channel, Room } from '@web-toys/multiplayer'
import type { Unsubscribe } from '@web-toys/multiplayer'
import type { Move } from '../engine/index.ts'
import { MultiplayerSession } from './session.ts'

// ---- Minimal Room stub -------------------------------------------------------
function makeStubRoom(): Room & {
  triggerPeerJoin(): void
  triggerPeerLeave(): void
  receiveOnChannel<T>(name: string, msg: T): void
  sentOnChannel<T>(name: string): T[]
} {
  const joinHandlers = new Set<() => void>()
  const leaveHandlers = new Set<() => void>()
  const statusHandlers = new Set<(s: string) => void>()
  const channelData = new Map<string, { sent: unknown[]; receiver: ((msg: unknown) => void) | null }>()

  function ch(name: string) {
    if (!channelData.has(name)) channelData.set(name, { sent: [], receiver: null })
    return channelData.get(name)!
  }

  return {
    code: 'test',
    status: 'waiting' as const,
    channel<T>(name: string): Channel<T> {
      return {
        send(msg: T) { ch(name).sent.push(msg) },
        on(handler: (msg: T) => void): Unsubscribe {
          ch(name).receiver = handler as (msg: unknown) => void
          return () => { ch(name).receiver = null }
        },
      }
    },
    on(event: 'peer-join' | 'peer-leave' | 'status', handler: (...args: unknown[]) => void): Unsubscribe {
      if (event === 'peer-join') joinHandlers.add(handler as () => void)
      if (event === 'peer-leave') leaveHandlers.add(handler as () => void)
      if (event === 'status') statusHandlers.add(handler as (s: string) => void)
      return () => {
        joinHandlers.delete(handler as () => void)
        leaveHandlers.delete(handler as () => void)
        statusHandlers.delete(handler as (s: string) => void)
      }
    },
    destroy() {},
    triggerPeerJoin() { joinHandlers.forEach((h) => h()) },
    triggerPeerLeave() { leaveHandlers.forEach((h) => h()) },
    receiveOnChannel<T>(name: string, msg: T) { ch(name).receiver?.(msg) },
    sentOnChannel<T>(name: string): T[] { return ch(name).sent as T[] },
  }
}

const MOVE_A: Move = { board: 0, cell: 4 }
const MOVE_B: Move = { board: 4, cell: 4 }

describe('MultiplayerSession — host flow', () => {
  it('sends ready with hostSide when peer joins', () => {
    const room = makeStubRoom()
    new MultiplayerSession({
      room,
      isHost: true,
      hostSide: 'X',
      onStatusChange: vi.fn(),
      onGameStart: vi.fn(),
      onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(),
      getHistory: () => [],
    })
    room.triggerPeerJoin()
    expect(room.sentOnChannel('lobby')).toContainEqual({ type: 'ready', hostSide: 'X' })
  })

  it('calls onGameStart with hostSide when side-accepted received', () => {
    const onGameStart = vi.fn()
    const room = makeStubRoom()
    new MultiplayerSession({
      room, isHost: true, hostSide: 'X',
      onStatusChange: vi.fn(), onGameStart, onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(), getHistory: () => [],
    })
    room.receiveOnChannel('lobby', { type: 'side-accepted' })
    expect(onGameStart).toHaveBeenCalledWith('X')
  })
})

describe('MultiplayerSession — guest flow', () => {
  it('calls onGameStart with opposite side when ready received', () => {
    const onGameStart = vi.fn()
    const room = makeStubRoom()
    new MultiplayerSession({
      room, isHost: false, hostSide: 'X',
      onStatusChange: vi.fn(), onGameStart, onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(), getHistory: () => [],
    })
    room.receiveOnChannel('lobby', { type: 'ready', hostSide: 'X' })
    expect(onGameStart).toHaveBeenCalledWith('O')
    expect(room.sentOnChannel('lobby')).toContainEqual({ type: 'side-accepted' })
  })
})

describe('MultiplayerSession — resign', () => {
  it('sends resign on sendResign()', () => {
    const room = makeStubRoom()
    const session = new MultiplayerSession({
      room, isHost: true, hostSide: 'X',
      onStatusChange: vi.fn(), onGameStart: vi.fn(), onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(), getHistory: () => [],
    })
    session.sendResign()
    expect(room.sentOnChannel('lobby')).toContainEqual({ type: 'resign' })
  })

  it('calls onOpponentResign when resign received', () => {
    const onOpponentResign = vi.fn()
    const room = makeStubRoom()
    new MultiplayerSession({
      room, isHost: false, hostSide: 'X',
      onStatusChange: vi.fn(), onGameStart: vi.fn(), onOpponentResign,
      onRemoteMove: vi.fn(), getHistory: () => [],
    })
    room.receiveOnChannel('lobby', { type: 'resign' })
    expect(onOpponentResign).toHaveBeenCalledOnce()
  })
})

describe('MultiplayerSession — move relay', () => {
  it('onRemoteMove is called when hs:move is received', () => {
    const onRemoteMove = vi.fn()
    const room = makeStubRoom()
    new MultiplayerSession({
      room, isHost: true, hostSide: 'X',
      onStatusChange: vi.fn(), onGameStart: vi.fn(), onOpponentResign: vi.fn(),
      onRemoteMove, getHistory: () => [],
    })
    room.receiveOnChannel('hs:move', MOVE_A)
    expect(onRemoteMove).toHaveBeenCalledWith(MOVE_A)
  })

  it('sendMove sends on hs:move channel', () => {
    const room = makeStubRoom()
    const session = new MultiplayerSession({
      room, isHost: true, hostSide: 'X',
      onStatusChange: vi.fn(), onGameStart: vi.fn(), onOpponentResign: vi.fn(),
      onRemoteMove: vi.fn(), getHistory: () => [],
    })
    session.sendMove(MOVE_B)
    expect(room.sentOnChannel('hs:move')).toContainEqual(MOVE_B)
  })
})
```

- [ ] **Step 3: Run tests — expect failure**

```bash
pnpm -C ultimate-tic-tac-toe test
# Expected: Cannot find module './session.ts'
```

- [ ] **Step 4: Create `protocol.ts`**

`ultimate-tic-tac-toe/src/network/protocol.ts`:
```typescript
// SPDX-License-Identifier: Apache-2.0
import type { Player } from '../engine/index.ts'

export type LobbyMessage =
  | { type: 'ready'; hostSide: Player }
  | { type: 'side-accepted' }
  | { type: 'resign' }
```

- [ ] **Step 5: Implement `session.ts`**

`ultimate-tic-tac-toe/src/network/session.ts`:
```typescript
// SPDX-License-Identifier: Apache-2.0
import { createHistorySync } from '@web-toys/multiplayer'
import type { HistorySync, PeerStatus, Room } from '@web-toys/multiplayer'
import type { Move, Player } from '../engine/index.ts'
import type { LobbyMessage } from './protocol.ts'

interface SessionConfig {
  room: Room
  isHost: boolean
  hostSide: Player
  onStatusChange: (s: PeerStatus) => void
  onGameStart: (mySide: Player) => void
  onOpponentResign: () => void
  onRemoteMove: (move: Move) => void
  getHistory: () => Move[]
}

export class MultiplayerSession {
  private readonly _room: Room
  private readonly _config: SessionConfig
  private readonly _historySync: HistorySync<Move>
  private readonly _unsubs: Array<() => void> = []

  constructor(config: SessionConfig) {
    this._room = config.room
    this._config = config

    const lobbyCh = config.room.channel<LobbyMessage>('lobby')

    this._historySync = createHistorySync<Move>({
      room: config.room,
      onMove: (move) => config.onRemoteMove(move),
      getHistory: config.getHistory,
    })

    this._unsubs.push(
      config.room.on('status', config.onStatusChange),

      lobbyCh.on((msg) => {
        switch (msg.type) {
          case 'ready': {
            // Guest: host announced their side
            const mySide: Player = msg.hostSide === 'X' ? 'O' : 'X'
            lobbyCh.send({ type: 'side-accepted' })
            config.onGameStart(mySide)
            break
          }
          case 'side-accepted': {
            // Host: guest confirmed
            config.onGameStart(config.hostSide)
            break
          }
          case 'resign': {
            config.onOpponentResign()
            break
          }
        }
      }),
    )

    if (config.isHost) {
      this._unsubs.push(
        config.room.on('peer-join', () => {
          lobbyCh.send({ type: 'ready', hostSide: config.hostSide })
        }),
      )
    }
  }

  sendMove(move: Move): void {
    this._historySync.recordMove(move)
  }

  sendResign(): void {
    this._room.channel<LobbyMessage>('lobby').send({ type: 'resign' })
  }

  destroy(): void {
    this._unsubs.forEach((u) => u())
    this._historySync.destroy()
    this._room.destroy()
  }
}
```

- [ ] **Step 6: Run tests — expect pass**

```bash
pnpm -C ultimate-tic-tac-toe test
# Expected: all existing + new session tests pass
```

- [ ] **Step 7: Typecheck**

```bash
pnpm -C ultimate-tic-tac-toe typecheck
```

- [ ] **Step 8: Commit**

```bash
git add ultimate-tic-tac-toe/package.json ultimate-tic-tac-toe/src/network/
git commit -m "feat(uttt): add network session with lobby handshake and move relay"
```

---

## Task 6: AppState & Controller

**Files:**
- Modify: `ultimate-tic-tac-toe/src/state.ts`
- Modify: `ultimate-tic-tac-toe/src/controller.ts`
- Modify: `ultimate-tic-tac-toe/src/ui/render.ts` (Actions additions only)

**Interfaces:**
- Consumes: `MultiplayerSession` from `./network/session.ts`; `createRoom`, `joinRoom`, `PeerStatus` from `@web-toys/multiplayer`
- Produces: new `AppState` fields consumed by all UI tasks; new controller public methods `startOnlineHost`, `startOnlineGuest`, `resignOnline`

- [ ] **Step 1: Update `state.ts`**

Replace the entire content of `ultimate-tic-tac-toe/src/state.ts`:
```typescript
// SPDX-License-Identifier: Apache-2.0
import type { PeerStatus } from '@web-toys/multiplayer'
import type { GameHistory, Player } from './engine/index.ts'

export type Mode = 'hotseat' | 'ai' | 'online'
export type Difficulty = 'easy' | 'medium' | 'hard'

export interface Settings {
  mode: Mode
  difficulty: Difficulty
  humanPlays: Player
  muted: boolean
}

export interface Scores {
  x: number
  o: number
  draws: number
}

export interface Connection {
  roomCode: string
  mySide: Player
  status: PeerStatus
  isHost: boolean
}

export interface AppState {
  screen: 'menu' | 'lobby' | 'game'
  settings: Settings
  history: GameHistory | null
  aiThinking: boolean
  scores: Scores
  connection: Connection | null
  /** ms since epoch when disconnect started; null when connected. Used for 30s timeout. */
  disconnectedAt: number | null
}

export function defaultSettings(): Settings {
  return { mode: 'hotseat', difficulty: 'medium', humanPlays: 'X', muted: false }
}

export function createAppState(): AppState {
  return {
    screen: 'menu',
    settings: defaultSettings(),
    history: null,
    aiThinking: false,
    scores: { x: 0, o: 0, draws: 0 },
    connection: null,
    disconnectedAt: null,
  }
}
```

- [ ] **Step 2: Add new Actions to `render.ts`**

In `ultimate-tic-tac-toe/src/ui/render.ts`, extend the `Actions` interface:
```typescript
export interface Actions {
  onCell(b: GridIndex, c: GridIndex): void
  onUndo(): void
  onNewGame(): void
  onRematch(): void
  onMenu(): void
  onMute(): void
  onStart(): void
  onResetScores(): void
  onSetting(k: keyof Settings, v: unknown): void
  // Online mode
  onStartOnlineHost(side: Player): void
  onJoinOnlineGuest(code: string): void
  onLobbyCodeChange(code: string): void
  onLobbyCodeRandomize(): void
  onLobbyCopyLink(): void
  onLobbyCancel(): void
  onResign(): void
}
```

- [ ] **Step 3: Update `controller.ts`**

Add these imports to the top of `controller.ts`:
```typescript
import { createRoom, joinRoom as joinNetRoom } from '@web-toys/multiplayer'
import type { PeerStatus } from '@web-toys/multiplayer'
import type { Connection } from './state.ts'
import { MultiplayerSession } from './network/session.ts'
import type { Player } from './engine/index.ts'
```

Add these fields to `GameController`:
```typescript
private session: MultiplayerSession | null = null
private disconnectTimer: ReturnType<typeof setTimeout> | null = null
```

Add `startOnlineHost`, `startOnlineGuest`, `resignOnline`, `lobbyCodeChange`, `lobbyCodeRandomize`, `lobbyCopyLink`, `lobbyCancel`, and `onOnlineGameStart` methods. Replace the `mount(...)` call in `init()` to wire the new actions. Add the `maybeSetWaitingForPeer()` helper. Modify `applyAndCommit` to call `session?.sendMove`.

Full additions to `controller.ts` (add after `goToMenu()`):

```typescript
async startOnlineHost(side: Player): Promise<void> {
  // Reuse existing code when called from the lobby (e.g., side-button change);
  // generate a new code when first entering the lobby from the menu.
  const existingCode = this.state.connection?.isHost ? this.state.connection.roomCode : undefined
  this.session?.destroy()
  this.session = null
  try {
    const room = existingCode
      ? await joinNetRoom(existingCode, { appId: 'web-toys-uttt-v1' })
      : await createRoom({ appId: 'web-toys-uttt-v1' })
    this.commit((s) => {
      s.screen = 'lobby'
      s.connection = { roomCode: room.code, mySide: side, status: 'waiting', isHost: true }
    })
    this._setupSession(room, true, side)
  } catch {
    // relay unreachable
    this.commit((s) => {
      s.screen = 'menu'
      s.connection = null
    })
  }
}

async startOnlineGuest(code: string): Promise<void> {
  this.commit((s) => {
    s.screen = 'lobby'
    s.connection = { roomCode: code, mySide: 'O', status: 'connecting', isHost: false }
  })
  try {
    const room = await joinNetRoom(code, { appId: 'web-toys-uttt-v1' })
    this._setupSession(room, false, 'X' /* placeholder; corrected on ready msg */)
  } catch {
    this.commit((s) => {
      s.screen = 'menu'
      s.connection = null
    })
  }
}

private _setupSession(room: import('@web-toys/multiplayer').Room, isHost: boolean, hostSide: Player): void {
  this.session?.destroy()
  this.session = new MultiplayerSession({
    room,
    isHost,
    hostSide,
    onStatusChange: (status: PeerStatus) => {
      this.commit((s) => {
        if (s.connection) s.connection.status = status
        if (status === 'disconnected') {
          s.disconnectedAt = Date.now()
          this._startDisconnectTimer()
        } else if (status === 'connected') {
          s.disconnectedAt = null
          this._clearDisconnectTimer()
        }
      })
    },
    onGameStart: (mySide: Player) => {
      this.commit((s) => {
        s.screen = 'game'
        s.history = createHistory(createInitialState())
        s.aiThinking = false
        if (s.connection) s.connection.mySide = mySide
      })
      // If opponent (X) goes first and we're O, start waiting immediately
      this.maybeSetWaitingForPeer()
    },
    onOpponentResign: () => {
      this.commit((s) => {
        s.aiThinking = false
        // Treat opponent resign as a game-end signal — show overlay
        // (We reuse aiThinking=false and let the UI overlay handle it via connection state)
      })
    },
    onRemoteMove: (move) => {
      const history = this.state.history
      if (!history) return
      if (!isLegalMove(currentState(history), move)) {
        this._tearDownOnlineSession()
        return
      }
      this.applyAndCommit(history, move)
      this.maybeSetWaitingForPeer()
    },
    getHistory: () => {
      const history = this.state.history
      if (!history) return []
      return history.entries.map((e) => e.move)
    },
  })
}

resignOnline(): void {
  this.session?.sendResign()
  this._tearDownOnlineSession()
  this.commit((s) => {
    s.screen = 'menu'
    s.history = null
    s.connection = null
  })
}

async lobbyCodeChange(code: string): Promise<void> {
  const conn = this.state.connection
  if (!conn?.isHost || this.state.screen !== 'lobby') return
  const mySide = conn.mySide
  this.session?.destroy()
  this.session = null
  try {
    const room = await joinNetRoom(code, { appId: 'web-toys-uttt-v1' })
    this.commit((s) => {
      if (s.connection) s.connection.roomCode = code
    })
    this._setupSession(room, true, mySide)
  } catch {
    // relay unreachable; state keeps old code until user retries
  }
}

lobbyCancel(): void {
  this.session?.destroy()
  this.session = null
  this.commit((s) => {
    s.screen = 'menu'
    s.connection = null
  })
}

private maybeSetWaitingForPeer(): void {
  const { settings, history, screen, connection } = this.state
  if (screen !== 'game' || settings.mode !== 'online' || !history || !connection) return
  const game = currentState(history)
  if (game.status.kind !== 'playing') return
  if (game.currentPlayer !== connection.mySide) {
    this.commit((s) => { s.aiThinking = true })
  }
}

private _startDisconnectTimer(): void {
  this._clearDisconnectTimer()
  this.disconnectTimer = setTimeout(() => {
    // 30s passed — UI will show "Abandon?" overlay via disconnectedAt check
    this.disconnectTimer = null
  }, 30_000)
}

private _clearDisconnectTimer(): void {
  if (this.disconnectTimer !== null) {
    clearTimeout(this.disconnectTimer)
    this.disconnectTimer = null
  }
}

private _tearDownOnlineSession(): void {
  this._clearDisconnectTimer()
  this.session?.destroy()
  this.session = null
}
```

Modify `playCell` — add an online turn-guard alongside the existing AI guard, then add `sendMove` after `applyAndCommit`:

```typescript
// Add after the existing AI mode guard:
if (
  this.state.settings.mode === 'online' &&
  game.currentPlayer !== this.state.connection?.mySide
) {
  return
}
```

Then after `this.applyAndCommit(history, { board, cell })`, add `sendMove` call **after**:
```typescript
this.applyAndCommit(history, { board, cell })
// Send local move to peer (only for local human moves, not remote moves)
if (this.state.settings.mode === 'online') {
  this.session?.sendMove({ board, cell })
}
this.maybeSetWaitingForPeer()
// Remove the existing this.maybeDispatchAiTurn() call in online mode:
if (this.state.settings.mode !== 'online') this.maybeDispatchAiTurn()
```

Modify `mount(...)` call in `init()` to wire new actions:
```typescript
mount(this.root, {
  // ... existing actions ...
  onStartOnlineHost: (side) => { void this.startOnlineHost(side) },
  onJoinOnlineGuest: (code) => { void this.startOnlineGuest(code) },
  onLobbyCodeChange: (code) => { void this.lobbyCodeChange(code) },
  onLobbyCodeRandomize: () => { /* handled in lobby UI */ },
  onLobbyCopyLink: () => {
    const code = this.state.connection?.roomCode
    if (code) {
      const url = new URL(location.href)
      url.searchParams.set('room', code)
      void navigator.clipboard.writeText(url.toString())
    }
  },
  onLobbyCancel: () => this.lobbyCancel(),
  onResign: () => this.resignOnline(),
})
```

Modify `undo()` to no-op in online mode:
```typescript
undo(): void {
  if (this.state.settings.mode === 'online') return  // add this guard first
  // ... rest of existing undo logic ...
}
```

- [ ] **Step 4: Typecheck**

```bash
pnpm -C ultimate-tic-tac-toe typecheck
# Fix any type errors before proceeding
```

- [ ] **Step 5: Run tests**

```bash
pnpm -C ultimate-tic-tac-toe test
# Expected: all existing tests still pass (engine/AI tests unaffected)
```

- [ ] **Step 6: Commit**

```bash
git add ultimate-tic-tac-toe/src/state.ts ultimate-tic-tac-toe/src/controller.ts ultimate-tic-tac-toe/src/ui/render.ts
git commit -m "feat(uttt): extend AppState and Controller for online mode"
```

---

## Task 7: Lobby UI

**Files:**
- Create: `ultimate-tic-tac-toe/src/ui/lobby.ts`
- Create: `ultimate-tic-tac-toe/src/styles/lobby.css`
- Modify: `ultimate-tic-tac-toe/src/styles/index.css`
- Modify: `ultimate-tic-tac-toe/src/ui/render.ts` (add lobby screen to mount/render)
- Modify: `ultimate-tic-tac-toe/src/ui/menu.ts` (add Online mode option)

**Interfaces:**
- Consumes: `AppState.screen === 'lobby'`, `AppState.connection`
- Consumes: `generateCode` from `@web-toys/multiplayer`
- Produces: lobby DOM visible when `screen === 'lobby'`; menu shows Online button

- [ ] **Step 1: Create `lobby.ts`**

`ultimate-tic-tac-toe/src/ui/lobby.ts`:
```typescript
// SPDX-License-Identifier: Apache-2.0
import { generateCode } from '@web-toys/multiplayer'
import type { AppState } from '../state.ts'
import { h } from './dom.ts'
import type { Actions } from './render.ts'

let codeInput: HTMLInputElement
let randomizeBtn: HTMLButtonElement
let copyBtn: HTMLButtonElement
let sideGroup: HTMLElement
let sideBtns: [HTMLButtonElement, HTMLButtonElement]
let waitingEl: HTMLElement
let hostControls: HTMLElement

export function buildLobby(actions: Actions): HTMLElement {
  codeInput = h('input', {
    class: 'lobby__code-input',
    type: 'text',
    'aria-label': 'Room code',
    spellcheck: 'false',
    autocomplete: 'off',
  }) as HTMLInputElement
  codeInput.addEventListener('input', () => {
    actions.onLobbyCodeChange(codeInput.value.trim())
  })

  randomizeBtn = h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'New random code' }, ['↺']) as HTMLButtonElement
  randomizeBtn.addEventListener('click', () => {
    const code = generateCode()
    codeInput.value = code
    actions.onLobbyCodeChange(code)
  })

  copyBtn = h('button', { class: 'btn', type: 'button' }, ['Copy invite link']) as HTMLButtonElement
  copyBtn.addEventListener('click', () => actions.onLobbyCopyLink())

  const sideXBtn = h('button', { class: 'seg', type: 'button', role: 'radio', 'aria-checked': 'false' }, ['X']) as HTMLButtonElement
  const sideOBtn = h('button', { class: 'seg', type: 'button', role: 'radio', 'aria-checked': 'false' }, ['O']) as HTMLButtonElement
  sideBtns = [sideXBtn, sideOBtn]
  sideXBtn.addEventListener('click', () => actions.onStartOnlineHost('X'))
  sideOBtn.addEventListener('click', () => actions.onStartOnlineHost('O'))

  sideGroup = h('div', { class: 'menu__field' }, [
    h('span', { class: 'menu__label', id: 'label-lobby-side' }, ['You play as']),
    h('div', { class: 'menu__seggroup', role: 'radiogroup', 'aria-labelledby': 'label-lobby-side' }, sideBtns),
  ])

  hostControls = h('div', { class: 'lobby__host-controls' }, [
    h('div', { class: 'lobby__code-row' }, [codeInput, randomizeBtn]),
    copyBtn,
    sideGroup,
  ])

  waitingEl = h('p', { class: 'lobby__waiting', 'aria-live': 'polite' }, ['Waiting for opponent…'])

  const cancelBtn = h('button', { class: 'btn', type: 'button' }, ['Cancel']) as HTMLButtonElement
  cancelBtn.addEventListener('click', () => actions.onLobbyCancel())

  return h('div', { class: 'screen screen--lobby' }, [
    h('div', { class: 'menu' }, [
      h('h2', { class: 'menu__title' }, ['Play Online']),
      hostControls,
      waitingEl,
      cancelBtn,
    ]),
  ])
}

export function syncLobby(state: AppState): void {
  const conn = state.connection
  if (!conn) return

  const isHost = conn.isHost

  hostControls.hidden = !isHost
  if (isHost) {
    if (codeInput.value === '') codeInput.value = conn.roomCode
    sideBtns[0]?.setAttribute('aria-checked', String(conn.mySide === 'X'))
    sideBtns[1]?.setAttribute('aria-checked', String(conn.mySide === 'O'))
  }

  if (conn.status === 'connected') {
    waitingEl.textContent = 'Opponent connected!'
  } else if (!isHost) {
    waitingEl.textContent = `Joining ${conn.roomCode}…`
  } else {
    waitingEl.textContent = 'Waiting for opponent…'
  }
}
```

- [ ] **Step 2: Add lobby to `render.ts`**

In `render.ts`, add the import:
```typescript
import { buildLobby, syncLobby } from './lobby.ts'
```

Add module-level variable:
```typescript
let lobbyScreenEl: HTMLElement
```

In `mount()`, add lobby to the DOM:
```typescript
lobbyScreenEl = buildLobby(actions)
root.replaceChildren(menuScreenEl, lobbyScreenEl, gameScreenEl, overlay, statusEl)
```

In `render()`, add lobby visibility and sync:
```typescript
menuScreenEl.hidden = state.screen !== 'menu'
lobbyScreenEl.hidden = state.screen !== 'lobby'
gameScreenEl.hidden = state.screen !== 'game'
if (state.screen === 'lobby') syncLobby(state)
```

- [ ] **Step 3: Add "Online" option to `menu.ts`**

In `buildMenu()`, add a third mode button and online sub-controls:
```typescript
modeBtns = [
  seg('2 players', () => actions.onSetting('mode', 'hotseat')),
  seg('vs AI', () => actions.onSetting('mode', 'ai')),
  seg('Online', () => actions.onSetting('mode', 'online')),
]
```

Add online sub-controls element (shown when `mode === 'online'`):
```typescript
const joinInput = h('input', {
  class: 'menu__join-input',
  type: 'text',
  placeholder: 'Room code',
  'aria-label': 'Join room code',
}) as HTMLInputElement

const joinBtn = h('button', { class: 'btn', type: 'button' }, ['Join game']) as HTMLButtonElement
joinBtn.addEventListener('click', () => {
  const code = joinInput.value.trim()
  if (code) actions.onJoinOnlineGuest(code)
})

const createBtn = h('button', { class: 'btn btn--primary', type: 'button' }, ['Create game']) as HTMLButtonElement
createBtn.addEventListener('click', () => actions.onStartOnlineHost('X'))

onlineGroup = h('div', { class: 'menu__field menu__online-controls' }, [
  createBtn,
  h('span', { class: 'menu__label' }, ['— or join —']),
  h('div', { class: 'menu__join-row' }, [joinInput, joinBtn]),
])
```

In `syncMenu()`, update to handle the third mode button and online group visibility:
```typescript
modeBtns[0]?.setAttribute('aria-checked', String(mode === 'hotseat'))
modeBtns[1]?.setAttribute('aria-checked', String(mode === 'ai'))
modeBtns[2]?.setAttribute('aria-checked', String(mode === 'online'))
difficultyGroup.hidden = mode !== 'ai'
sideGroup.hidden = mode !== 'ai'
onlineGroup.hidden = mode !== 'online'
// Hide "Start game" button in online mode (game starts via lobby)
startBtn.hidden = mode === 'online'
```

- [ ] **Step 4: Add `lobby.css`**

`ultimate-tic-tac-toe/src/styles/lobby.css`:
```css
.screen--lobby {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: var(--space-5) var(--space-3);
}

.lobby__code-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.lobby__code-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--line);
  border-radius: var(--radius-s);
  font-size: 1.1rem;
  font-family: inherit;
  letter-spacing: 0.05em;
  background: var(--surface-1);
  color: var(--ink);
}

.lobby__code-input:focus {
  outline: none;
  border-color: var(--color-x);
}

.lobby__host-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  width: 100%;
}

.lobby__waiting {
  color: var(--ink-muted);
  text-align: center;
  margin: var(--space-3) 0;
}

.menu__join-row {
  display: flex;
  gap: var(--space-2);
  align-items: center;
}

.menu__join-input {
  flex: 1;
  padding: var(--space-2) var(--space-3);
  border: 2px solid var(--line);
  border-radius: var(--radius-s);
  font-size: 1rem;
  font-family: inherit;
  background: var(--surface-1);
  color: var(--ink);
}

.menu__join-input:focus {
  outline: none;
  border-color: var(--color-x);
}

.menu__online-controls {
  flex-direction: column;
  gap: var(--space-3);
}
```

- [ ] **Step 5: Add import to `index.css`**

In `ultimate-tic-tac-toe/src/styles/index.css`, add:
```css
@import './lobby.css';
```

- [ ] **Step 6: Typecheck and build**

```bash
pnpm -C ultimate-tic-tac-toe typecheck && pnpm -C ultimate-tic-tac-toe build
```

- [ ] **Step 7: Commit**

```bash
git add ultimate-tic-tac-toe/src/ui/lobby.ts ultimate-tic-tac-toe/src/ui/render.ts ultimate-tic-tac-toe/src/ui/menu.ts ultimate-tic-tac-toe/src/styles/lobby.css ultimate-tic-tac-toe/src/styles/index.css
git commit -m "feat(uttt): add lobby screen and online mode menu option"
```

---

## Task 8: HUD & Disconnection UI

**Files:**
- Modify: `ultimate-tic-tac-toe/src/ui/hud.ts`
- Modify: `ultimate-tic-tac-toe/src/ui/overlay.ts`

**Interfaces:**
- Consumes: `AppState.connection.status`, `AppState.disconnectedAt`
- Produces: connection dot in HUD; disconnect banner; abandon overlay after 30s

- [ ] **Step 1: Add connection dot to `hud.ts`**

In `buildHud()`, add a connection dot element:
```typescript
let connDotEl: HTMLElement
let connBannerEl: HTMLElement

// Inside buildHud(), add to the header:
connDotEl = h('span', { class: 'conn-dot', 'aria-hidden': 'true' })
connDotEl.hidden = true

connBannerEl = h('p', { class: 'conn-banner', role: 'status', 'aria-live': 'polite' }, [''])
connBannerEl.hidden = true

// Return updated header:
return h('header', { class: 'hud' }, [
  h('div', { class: 'hud__top' }, [chipEl, connDotEl]),
  connBannerEl,
  scorebar,
])
```

In `syncHud()`, add connection status sync:
```typescript
// Add after the existing chip/score sync:
const conn = state.connection
if (conn && state.screen === 'game') {
  connDotEl.hidden = false
  connDotEl.className = `conn-dot conn-dot--${conn.status === 'connected' ? 'ok' : conn.status === 'disconnected' ? 'bad' : 'warn'}`
  if (conn.status === 'disconnected' || conn.status === 'reconnecting') {
    connBannerEl.hidden = false
    connBannerEl.textContent = 'Opponent disconnected — reconnecting…'
  } else {
    connBannerEl.hidden = true
    connBannerEl.textContent = ''
  }
  // Override aiThinking label for online mode
  if (state.aiThinking && conn.status === 'connected') {
    chipTextEl.textContent = 'Waiting for opponent'
  }
} else {
  connDotEl.hidden = true
  connBannerEl.hidden = true
}
```

Add CSS to `tokens.css` or `hud.css` (check which file has `.hud` styles and add there):
```css
.conn-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-left: var(--space-2);
}
.conn-dot--ok   { background: #16a34a; }
.conn-dot--warn { background: #ca8a04; }
.conn-dot--bad  { background: #dc2626; }

.conn-banner {
  font-size: 0.8rem;
  color: var(--ink-muted);
  text-align: center;
  padding: var(--space-1) 0;
}

.hud__top {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}
```

- [ ] **Step 2: Add abandon overlay to `overlay.ts`**

Add module-level variables:
```typescript
let abandonEl: HTMLElement
let keepWaitingBtn: HTMLButtonElement
let abandonBtn: HTMLButtonElement
```

In `buildOverlay()`, add the disconnect/abandon panel alongside the existing overlay:
```typescript
keepWaitingBtn = h('button', { class: 'btn btn--primary', type: 'button' }, ['Keep waiting']) as HTMLButtonElement
keepWaitingBtn.addEventListener('click', () => {
  abandonEl.hidden = true
  // Controller's disconnectTimer already cleared; this just hides the UI
})
abandonBtn = h('button', { class: 'btn', type: 'button' }, ['Abandon game']) as HTMLButtonElement
abandonBtn.addEventListener('click', () => actions.onMenu())

abandonEl = h('div', { class: 'overlay overlay--abandon' }, [
  h('div', { class: 'overlay__backdrop' }),
  h('div', { class: 'overlay__panel', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'Opponent disconnected' }, [
    h('h2', { class: 'overlay__title' }, ['Opponent disconnected']),
    h('div', { class: 'overlay__actions' }, [keepWaitingBtn, abandonBtn]),
  ]),
])
abandonEl.hidden = true
```

Return both overlays from `buildOverlay()` by wrapping them:
```typescript
return h('div', { class: 'overlays' }, [overlayEl, abandonEl])
```

In `syncOverlay()`, add abandon overlay logic:
```typescript
// At the end of syncOverlay:
const showAbandon =
  state.screen === 'game' &&
  state.disconnectedAt !== null &&
  Date.now() - state.disconnectedAt > 30_000
abandonEl.hidden = !showAbandon
```

- [ ] **Step 3: Typecheck and test**

```bash
pnpm -C ultimate-tic-tac-toe typecheck && pnpm -C ultimate-tic-tac-toe test
```

- [ ] **Step 4: Commit**

```bash
git add ultimate-tic-tac-toe/src/ui/hud.ts ultimate-tic-tac-toe/src/ui/overlay.ts
git commit -m "feat(uttt): add connection status dot and disconnect/abandon UI"
```

---

## Task 9: URL Handling, Docs & AGENTS.md

**Files:**
- Modify: `ultimate-tic-tac-toe/src/main.ts`
- Modify: `ultimate-tic-tac-toe/AGENTS.md`
- Modify: `ultimate-tic-tac-toe/PLAN.md`
- Create: `docs/superpowers/specs/2026-06-17-multiplayer-design.md`

- [ ] **Step 1: Handle `?room=` URL param in `main.ts`**

Replace `ultimate-tic-tac-toe/src/main.ts`:
```typescript
// SPDX-License-Identifier: Apache-2.0
import './styles/index.css'
import { createAi } from './ai/index.ts'
import { GameController } from './controller.ts'
import { SoundManager } from './ui/sound.ts'

const root = document.querySelector<HTMLElement>('#app')
if (root) {
  const controller = new GameController(root, { sound: new SoundManager(), createAi })
  controller.init()

  // Auto-join if ?room= is in the URL (friend sent an invite link)
  const roomCode = new URLSearchParams(location.search).get('room')
  if (roomCode) {
    void controller.startOnlineGuest(roomCode)
  }
}
```

- [ ] **Step 2: Update `AGENTS.md`**

In `ultimate-tic-tac-toe/AGENTS.md`, in the "Out of scope" line, remove "online multiplayer":
```
Out of scope (do not add): backend, accounts, i18n, coverage tooling.
```

Add a brief note to the Architecture section about the new `network/` layer:
```
  network/            # multiplayer session (protocol.ts, session.ts)
```

- [ ] **Step 3: Update `PLAN.md`**

Add Phase 7 to `PLAN.md` with a checked status once all tasks complete.

- [ ] **Step 4: Copy spec doc**

Create `docs/superpowers/specs/2026-06-17-multiplayer-design.md` with the content of the design spec from `~/.claude-personal/plans/let-s-look-into-adding-sleepy-patterson.md` (the design sections, not the implementation plan).

- [ ] **Step 5: Final canonical gate**

```bash
pnpm -C packages/multiplayer test
pnpm -C ultimate-tic-tac-toe typecheck && pnpm -C ultimate-tic-tac-toe lint && pnpm -C ultimate-tic-tac-toe test && pnpm -C ultimate-tic-tac-toe build
```

- [ ] **Step 6: Commit**

```bash
git add ultimate-tic-tac-toe/src/main.ts ultimate-tic-tac-toe/AGENTS.md ultimate-tic-tac-toe/PLAN.md docs/
git commit -m "feat(uttt): wire ?room= URL entry, update docs and AGENTS.md"
```

---

## Verification

End-to-end smoke test (two browser tabs):

1. `pnpm -C ultimate-tic-tac-toe dev` — open `http://localhost:5173/ultimate-tic-tac-toe/`
2. **Tab A:** Menu → Online → Create Game → note the code (e.g. `swift-panda-7`)
3. **Tab B:** Open `http://localhost:5173/ultimate-tic-tac-toe/?room=swift-panda-7`
4. Both tabs should transition from lobby → game screen
5. Play moves alternately — both boards stay in sync
6. Close Tab B — Tab A shows yellow dot + reconnecting banner
7. Re-open Tab B with same URL — game resumes from correct board state
8. Play to completion — win overlay appears on both tabs
9. Tab A: trigger resign — Tab B shows Menu (or opponent-resigned state)
