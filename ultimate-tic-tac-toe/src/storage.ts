import type { Scores, Settings } from './state.ts';

export interface PersistedV1 {
  version: 1;
  settings: Settings;
  scores: Scores;
}

const KEY = 'uttt:v1';
let warnedSaveFailure = false;

function isPersistedV1(value: unknown): value is PersistedV1 {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const p = value as Record<string, unknown>;
  if (p.version !== 1) {
    return false;
  }
  const settings = p.settings as Record<string, unknown> | undefined;
  const scores = p.scores as Record<string, unknown> | undefined;
  return (
    typeof settings === 'object' &&
    settings !== null &&
    (settings.mode === 'hotseat' || settings.mode === 'ai') &&
    (settings.difficulty === 'easy' ||
      settings.difficulty === 'medium' ||
      settings.difficulty === 'hard') &&
    (settings.humanPlays === 'X' || settings.humanPlays === 'O') &&
    typeof settings.muted === 'boolean' &&
    typeof scores === 'object' &&
    scores !== null &&
    typeof scores.x === 'number' &&
    typeof scores.o === 'number' &&
    typeof scores.draws === 'number'
  );
}

/** null on any failure: missing, corrupt JSON, wrong version/shape. */
export function loadPersisted(): PersistedV1 | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isPersistedV1(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Called on every commit — must swallow setItem failures (Safari private
 * mode, quota) or every move would throw mid-game.
 */
export function savePersisted(p: PersistedV1): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    if (!warnedSaveFailure) {
      console.warn('Could not persist settings/scores (storage unavailable).');
      warnedSaveFailure = true;
    }
  }
}
