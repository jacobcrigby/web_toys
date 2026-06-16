// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { PersistedV1 } from './storage.ts';
import { loadPersisted, savePersisted } from './storage.ts';

const VALID: PersistedV1 = {
  version: 1,
  settings: { mode: 'ai', difficulty: 'hard', humanPlays: 'O', muted: true },
  scores: { x: 3, o: 5, draws: 2 },
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('savePersisted / loadPersisted', () => {
  test('round-trips settings and scores under the uttt:v1 key', () => {
    savePersisted(VALID);
    expect(localStorage.getItem('uttt:v1')).toBeTruthy();
    expect(loadPersisted()).toEqual(VALID);
  });

  test('returns null when nothing is stored', () => {
    expect(loadPersisted()).toBeNull();
  });

  test('returns null for corrupt JSON', () => {
    localStorage.setItem('uttt:v1', '{not json!!');
    expect(loadPersisted()).toBeNull();
  });

  test('returns null for a wrong version or shape', () => {
    localStorage.setItem('uttt:v1', JSON.stringify({ ...VALID, version: 2 }));
    expect(loadPersisted()).toBeNull();
    localStorage.setItem('uttt:v1', JSON.stringify({ version: 1, settings: { mode: 'bogus' } }));
    expect(loadPersisted()).toBeNull();
    localStorage.setItem(
      'uttt:v1',
      JSON.stringify({ ...VALID, scores: { x: 'three', o: 0, draws: 0 } }),
    );
    expect(loadPersisted()).toBeNull();
  });

  test('save failures are swallowed with at most one console.warn', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });
    expect(() => savePersisted(VALID)).not.toThrow();
    expect(() => savePersisted(VALID)).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
