# WebRTC Multiplayer — Design Spec

**Date:** 2026-06-17
**Projects:** `packages/multiplayer` (new), `ultimate-tic-tac-toe`

---

## Context

Ultimate Tic-Tac-Toe currently supports local hotseat and vs-AI modes. This adds peer-to-peer online multiplayer via WebRTC (Trystero + Nostr signaling). The shared transport layer (`packages/multiplayer`) is designed from the start to be reusable across other projects in the repo (marblegame, etc.), so its API is game-agnostic.

No backend is introduced. Everything runs in the browser. No accounts, no telemetry.

---

## Architecture

Two layers with a clean boundary:

```
packages/multiplayer/          ← game-agnostic transport (new pnpm workspace package)
  Room                         wraps Trystero/Nostr; human-readable code; reconnect
  Channel<T>                   typed message passing
  HistorySync<TMove>           synced ordered move log; handles reconnect replay

ultimate-tic-tac-toe/src/network/   ← game-specific (new directory)
  protocol.ts                  UTTT message types (lobby handshake, resign)
  session.ts                   wires Room + HistorySync; owns session lifecycle
```

The engine (`src/engine/`) is untouched. The controller's turn-dispatch is transparent to whether the opponent is AI or remote — both settle on a move via a Promise.

---

## Shared Package: `packages/multiplayer`

### Room codes

- **Human-readable code** (shown to users, shared via link): e.g. `swift-panda-7` — adjective-noun-digit format
- **Trystero room ID** (never shown): `hex(SHA-256(appId + "\0" + code))` via `crypto.subtle.digest`
- **appId** is per-game (e.g. `"web-toys-uttt-v1"`) so two different games on the same code never collide
- Host can edit the code or hit randomize in the lobby before a peer joins

### Public API

```typescript
function createRoom(config: RoomConfig): Promise<Room>
function joinRoom(code: string, config: RoomConfig): Promise<Room>

interface RoomConfig {
  appId: string        // used in hash derivation; namespaces rooms per game
  relays?: string[]    // Nostr relay URLs; defaults to a few well-known public ones
}

type PeerStatus = 'waiting' | 'connected' | 'disconnected' | 'reconnecting'

interface Room {
  readonly code: string       // human-readable
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

function createHistorySync<TMove>(config: {
  room: Room
  onMove: (move: TMove) => void
  getHistory: () => TMove[]
}): HistorySync<TMove>

interface HistorySync<TMove> {
  recordMove(move: TMove): void  // call after each local move
  destroy(): void
}

type Unsubscribe = () => void
```

### HistorySync internals

Uses two internal channels on the Room:
- `hs:move` — single moves sent live
- `hs:sync-req` / `hs:sync-res` — full-log exchange on reconnect

On `peer-join`, the rejoining side sends `{ knownCount: N }`. The other side replies with moves `[N…]`. The `onMove` callback fires for replayed moves exactly as for live moves — callers don't distinguish.

### Default Nostr relays

`wss://relay.damus.io`, `wss://relay.nostr.band`, `wss://nos.lol`

### Package structure

```
packages/multiplayer/
  package.json         name: "@web-toys/multiplayer", private: true, type: "module"
  tsconfig.json        strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes
  src/
    types.ts           PeerStatus, RoomConfig, Unsubscribe
    room-code.ts       generateCode(), deriveRoomId(appId, code): Promise<string>
    room.ts            createRoom(), joinRoom(), Room implementation
    history-sync.ts    createHistorySync()
  index.ts             re-exports public API
```

---

## UTTT Integration

### `src/network/protocol.ts`

```typescript
type LobbyMessage =
  | { type: 'ready'; hostSide: Player }   // host → guest when guest joins
  | { type: 'side-accepted' }             // guest → host; both start game
  | { type: 'resign' }
```

Moves are handled exclusively by `HistorySync<Move>` — not in this protocol.

### `src/network/session.ts`

```typescript
class MultiplayerSession {
  constructor(config: {
    room: Room
    isHost: boolean
    hostSide: Player
    onStatusChange: (s: PeerStatus) => void
    onGameStart: (mySide: Player) => void
    onOpponentResign: () => void
    onRemoteMove: (move: Move) => void
    getHistory: () => Move[]
  })
  sendMove(move: Move): void
  sendResign(): void
  destroy(): void
}
```

### Controller changes

Surgical additions only — nothing architectural:

- `AppState.screen`: add `'lobby'`
- `AppState.settings.mode`: add `'online'`
- `AppState`: add `connection: { status: PeerStatus; roomCode: string; mySide: Player; isHost: boolean } | null`
- `AppState`: add `disconnectedAt: number | null` (timestamp for 30s abandon timer)
- After a local human move: call `this.session?.sendMove(move)`
- Undo action: disabled when `mode === 'online'`

---

## UX Flow

### Menu

"Online" mode added to the mode selector. Choosing it shows:
- **Create Game** — enters lobby as host with a random code
- Code input + **Join game** button — join by code

### Lobby screen

**Host view:**
```
PLAY ONLINE
──────────────────────
Room code:
[ swift-panda-7     ] [↺]
[Copy invite link]

You play as: [X] [O]

Waiting for opponent...

[Cancel]
```
- Code field is editable; `[↺]` regenerates. Changing the code destroys old room, creates new one.
- Copy invite link copies `<base-url>?room=<code>`.

**Guest view:**
```
PLAY ONLINE
──────────────────────
Joining swift-panda-7...

[Cancel]
```
Guest gets whatever side the host didn't pick.

**URL entry:** If `?room=CODE` is in the URL on page load, go straight to guest lobby.

**Handshake:** Host sends `ready` with `hostSide` when guest joins → guest sends `side-accepted` → both transition to `'game'`.

### In-game connection status

Small dot in the HUD next to the turn chip:
- Green = connected
- Yellow = reconnecting (banner: "Opponent disconnected — reconnecting…")
- Red = disconnected

**Timeout at 30s:** overlay — "Opponent disconnected." with **[Keep waiting]** / **[Abandon game]**.

---

## Error Handling

| Case | Behavior |
|---|---|
| Illegal remote move | Tear down session; return to menu |
| Undo in online mode | Button disabled |
| Same-device join (two tabs) | Works fine as a degenerate case; no special handling |
| Tab close mid-game | WebRTC detects within seconds; standard disconnect flow |

---

## Testing

**`packages/multiplayer`** (Vitest, mock Trystero):
- `HistorySync` reconnect replay: `knownCount: N` → receives moves `[N…]`
- `generateCode()` produces valid `adjective-noun-digit` strings
- `deriveRoomId()` is deterministic and differs across appIds

**`ultimate-tic-tac-toe/src/network/`** (Vitest, mock Room):
- Lobby handshake: `ready` → `side-accepted` → `onGameStart` fires
- Session resign flow
