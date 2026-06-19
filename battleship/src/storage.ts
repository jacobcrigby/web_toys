// SPDX-License-Identifier: Apache-2.0
import type { AppState } from './state.ts';
import { makeInitialAppState } from './state.ts';

const KEY = 'battleship:v1';
const VERSION = 1;

interface Persisted {
  version: number;
  scores: [number, number];
  settings: AppState['settings'];
}

function isValidPersisted(raw: unknown): raw is Persisted {
  if (typeof raw !== 'object' || raw === null) return false;
  const p = raw as Record<string, unknown>;
  return (
    p.version === VERSION &&
    Array.isArray(p.scores) &&
    (p.scores as unknown[]).length === 2 &&
    typeof p.settings === 'object'
  );
}

export function loadPersistedState(base: AppState): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return base;
    const parsed: unknown = JSON.parse(raw);
    if (!isValidPersisted(parsed)) return base;
    return {
      ...base,
      scores: parsed.scores,
      settings: { ...base.settings, ...parsed.settings },
    };
  } catch {
    return base;
  }
}

export function saveState(state: AppState): void {
  const persisted: Persisted = {
    version: VERSION,
    scores: state.scores,
    settings: state.settings,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(persisted));
  } catch {
    // Safari private mode and storage quota errors are silently swallowed
  }
}

export function clearState(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function loadInitialAppState(): AppState {
  return loadPersistedState(makeInitialAppState());
}
