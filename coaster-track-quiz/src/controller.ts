// SPDX-License-Identifier: Apache-2.0

import type { Dataset } from './data/dataset.ts';
import type { ManufacturerId } from './data/types.ts';
import { generateQueue } from './quiz/generate.ts';
import { grade } from './quiz/grade.ts';
import { applyOutcome, emptyProgress } from './quiz/progress.ts';
import { createRng, type Rng, randomSeed } from './rng.ts';
import { type AppState, parseRoute } from './state.ts';
import { clearProgress, loadProgress, saveProgress } from './storage.ts';
import { preload } from './ui/image.ts';
import { type Actions, mount, type View } from './ui/render.ts';

const QUEUE_DEPTH = 2;

export function start(root: HTMLElement, dataset: Dataset): void {
  const rng: Rng = createRng(randomSeed());

  let state: AppState = {
    route: parseRoute(globalThis.location?.hash ?? ''),
    queue: [],
    question: null,
    verdict: null,
    hintUsed: false,
    progress: loadProgress(),
    failedImages: new Set(),
  };

  const actions: Actions = {
    answer(choice: ManufacturerId) {
      if (state.verdict || !state.question) return;
      const verdict = grade(dataset, state.question, choice, state.hintUsed, state.progress);
      const progress = applyOutcome(state.progress, state.question, verdict);
      saveProgress(progress);
      commit({ verdict, progress });
    },

    next() {
      if (!state.verdict) return;
      // Drop the answered question and top the queue back up from the updated progress.
      refill(state.queue.slice(1));
    },

    useHint() {
      if (state.verdict || state.hintUsed || !state.question?.canHint) return;
      commit({ hintUsed: true });
    },

    skipCoaster() {
      if (!state.question) return;
      const failedImages = new Set(state.failedImages).add(state.question.coaster.id);
      commit({ failedImages });
      refill(state.queue.slice(1), failedImages);
    },

    resetProgress() {
      clearProgress();
      const progress = emptyProgress();
      commit({ progress });
      refill([], state.failedImages, progress);
    },
  };

  const view: View = mount(root, dataset, actions);

  function refill(
    keep: readonly (typeof state.queue)[number][],
    failedImages: ReadonlySet<string> = state.failedImages,
    progress = state.progress,
  ): void {
    const needed = QUEUE_DEPTH - keep.length;
    const blocked = new Set([...failedImages, ...keep.map((question) => question.coaster.id)]);
    const fresh = needed > 0 ? generateQueue(dataset, progress, rng, needed, blocked) : [];
    const queue = [...keep, ...fresh];

    commit({
      queue,
      question: queue[0] ?? null,
      verdict: null,
      hintUsed: false,
      progress,
      failedImages,
    });
  }

  function commit(patch: Partial<AppState>): void {
    state = { ...state, ...patch };
    view.render(state);
    warmNextImages();
  }

  /**
   * Hotlinked Commons thumbnails are slow, so the next question's photo and the current hint
   * image are fetched in the background while the learner is still looking at this one.
   */
  function warmNextImages(): void {
    const upcoming = state.queue[1];
    if (upcoming) preload(upcoming.coaster.closeup.url);
    const context = state.question?.coaster.context;
    if (context) preload(context.url);
  }

  globalThis.addEventListener?.('hashchange', () => {
    commit({ route: parseRoute(globalThis.location.hash) });
  });

  refill([]);
}
