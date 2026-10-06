// SPDX-License-Identifier: Apache-2.0

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MANUFACTURER_IDS } from './data/types.ts';
import { emptyProgress } from './quiz/progress.ts';
import { clearProgress, loadProgress, saveProgress } from './storage.ts';

const KEY = 'coaster-track-quiz:v1';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, value);
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }
  get length() {
    return this.map.size;
  }
}

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  vi.stubGlobal('localStorage', store as unknown as Storage);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('round trip', () => {
  it('restores what it saved', () => {
    const progress = {
      ...emptyProgress(),
      askedCount: 7,
      streak: 3,
      bestStreak: 5,
      recentCoasters: ['a', 'b'],
    };
    saveProgress(progress);
    expect(loadProgress()).toEqual(progress);
  });

  it('starts fresh when nothing is stored', () => {
    expect(loadProgress()).toEqual(emptyProgress());
  });

  it('forgets everything after clearProgress', () => {
    saveProgress({ ...emptyProgress(), askedCount: 9 });
    clearProgress();
    expect(loadProgress().askedCount).toBe(0);
  });
});

describe('rejecting junk', () => {
  it.each([
    ['malformed JSON', '{not json'],
    ['a bare string', '"hello"'],
    ['an array', '[1,2,3]'],
    ['null', 'null'],
    ['an older schema', JSON.stringify({ ...emptyProgress(), schema: 0 })],
    ['a future schema', JSON.stringify({ ...emptyProgress(), schema: 99 })],
  ])('falls back to a fresh Progress for %s', (_label, raw) => {
    store.setItem(KEY, raw);
    expect(loadProgress()).toEqual(emptyProgress());
  });
});

describe('field-level repair', () => {
  it('drops a manufacturer that no longer exists', () => {
    store.setItem(
      KEY,
      JSON.stringify({
        ...emptyProgress(),
        byManufacturer: {
          ...emptyProgress().byManufacturer,
          'schwarzkopf-retired': { box: 4, seen: 9, correct: 9, hinted: 0, lastAskedAt: 3 },
        },
      }),
    );

    const loaded = loadProgress();
    expect(Object.keys(loaded.byManufacturer).sort()).toEqual([...MANUFACTURER_IDS].sort());
  });

  it('defaults a manufacturer missing from the saved record', () => {
    // Simulates the roster growing after the learner already has history.
    const { vekoma, ...rest } = emptyProgress().byManufacturer;
    expect(vekoma).toBeDefined();
    store.setItem(KEY, JSON.stringify({ ...emptyProgress(), byManufacturer: rest }));

    expect(loadProgress().byManufacturer.vekoma.box).toBe(1);
  });

  it('repairs an out-of-range or non-numeric box', () => {
    for (const bad of [0, 9, 2.5, '3', null]) {
      store.setItem(
        KEY,
        JSON.stringify({
          ...emptyProgress(),
          byManufacturer: {
            ...emptyProgress().byManufacturer,
            gci: { box: bad, seen: 1, correct: 1, hinted: 0, lastAskedAt: 1 },
          },
        }),
      );
      expect(loadProgress().byManufacturer.gci.box, `box ${bad}`).toBe(1);
    }
  });

  it('keeps a valid box untouched', () => {
    store.setItem(
      KEY,
      JSON.stringify({
        ...emptyProgress(),
        byManufacturer: {
          ...emptyProgress().byManufacturer,
          gci: { box: 4, seen: 6, correct: 5, hinted: 1, unaided: 4, lastAskedAt: 6 },
        },
      }),
    );
    expect(loadProgress().byManufacturer.gci).toEqual({
      box: 4,
      seen: 6,
      correct: 5,
      hinted: 1,
      unaided: 4,
      lastAskedAt: 6,
    });
  });

  it('estimates unaided for a record saved before the field existed', () => {
    store.setItem(
      KEY,
      JSON.stringify({
        ...emptyProgress(),
        byManufacturer: {
          ...emptyProgress().byManufacturer,
          gci: { box: 3, seen: 6, correct: 5, hinted: 2, lastAskedAt: 6 },
        },
      }),
    );
    expect(loadProgress().byManufacturer.gci.unaided).toBe(3);
  });

  it('never restores more unaided answers than correct ones', () => {
    store.setItem(
      KEY,
      JSON.stringify({
        ...emptyProgress(),
        byManufacturer: {
          ...emptyProgress().byManufacturer,
          gci: { box: 3, seen: 6, correct: 2, hinted: 0, unaided: 9, lastAskedAt: 6 },
        },
      }),
    );
    expect(loadProgress().byManufacturer.gci.unaided).toBe(2);
  });

  it('restores lastAskedAt for an entry JSON turned into null', () => {
    // -Infinity does not survive JSON.stringify; it comes back as null.
    saveProgress(emptyProgress());
    expect(loadProgress().byManufacturer.gci.lastAskedAt).toBe(-Infinity);
  });

  it('strips confusion entries pointing at unknown manufacturers', () => {
    store.setItem(
      KEY,
      JSON.stringify({
        ...emptyProgress(),
        confusion: { ...emptyProgress().confusion, gci: { vekoma: 3, 'who-dis': 5 } },
      }),
    );
    expect(loadProgress().confusion.gci).toEqual({ vekoma: 3 });
  });

  it('never reports a bestStreak below the current streak', () => {
    store.setItem(KEY, JSON.stringify({ ...emptyProgress(), streak: 6, bestStreak: 2 }));
    expect(loadProgress().bestStreak).toBe(6);
  });
});

describe('hostile environments', () => {
  it('swallows a setItem that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => undefined,
    } as unknown as Storage);

    expect(() => saveProgress(emptyProgress())).not.toThrow();
  });

  it('swallows a getItem that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    } as unknown as Storage);

    expect(loadProgress()).toEqual(emptyProgress());
  });

  it('works with no localStorage at all', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(loadProgress()).toEqual(emptyProgress());
    expect(() => saveProgress(emptyProgress())).not.toThrow();
    expect(() => clearProgress()).not.toThrow();
  });
});
