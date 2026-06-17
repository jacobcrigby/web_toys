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

function randomIndex(max: number): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return (buf[0] as number) % max
}

function pick<T>(arr: T[]): T {
  return arr[randomIndex(arr.length)] as T
}

/** Returns a random human-readable code, e.g. "swift-panda-7". */
export function generateCode(): string {
  return `${pick(ADJECTIVES)}-${pick(NOUNS)}-${randomIndex(10)}`
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
