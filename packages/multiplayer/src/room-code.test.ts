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
