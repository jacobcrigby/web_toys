// SPDX-License-Identifier: Apache-2.0

import type { Dataset } from '../data/dataset.ts';
import type { ManufacturerId } from '../data/types.ts';
import { summarize } from '../quiz/progress.ts';
import type { Progress, Question, Verdict } from '../quiz/types.ts';
import { h } from './dom.ts';
import { createTrackImage } from './image.ts';
import { renderReveal } from './reveal.ts';

export interface QuizActions {
  answer(choice: ManufacturerId): void;
  next(): void;
  useHint(): void;
  skipCoaster(): void;
}

export interface QuizViewState {
  readonly question: Question;
  readonly progress: Progress;
  readonly verdict: Verdict | null;
  readonly hintUsed: boolean;
}

export interface QuizView {
  readonly el: HTMLElement;
  update(state: QuizViewState): void;
  /** Detach the document-level key handler. Must be called when the view is swapped out. */
  destroy(): void;
}

export function createQuizView(dataset: Dataset, actions: QuizActions): QuizView {
  const image = createTrackImage({ onSkip: () => actions.skipCoaster() });
  const options = h('div', { class: 'options', role: 'group', 'aria-label': 'Who built this?' });
  const hintButton = h(
    'button',
    { type: 'button', class: 'button button--ghost hint' },
    h('span', {}, 'Show the whole ride'),
    h('span', { class: 'hint__cost' }, 'counts as a hint'),
  );
  const revealSlot = h('div', { class: 'reveal-slot', 'aria-live': 'polite' });
  const nextButton = h('button', { type: 'button', class: 'button button--primary' }, 'Next track');
  const scoreLine = h('p', { class: 'scoreline' });
  const prompt = h('h1', { class: 'prompt' }, 'Who built this track?');

  const el = h(
    'section',
    { class: 'quiz' },
    prompt,
    image.el,
    h('div', { class: 'quiz__controls' }, options, hintButton),
    revealSlot,
    h('div', { class: 'quiz__footer' }, scoreLine, nextButton),
  );

  hintButton.addEventListener('click', () => actions.useHint());
  nextButton.addEventListener('click', () => actions.next());

  let current: QuizViewState | null = null;
  let buttons = new Map<ManufacturerId, HTMLButtonElement>();

  // Number keys pick an option; Enter or space moves on. Keeps the drill fast.
  const onKeyDown = (event: KeyboardEvent) => {
    if (!current) return;
    const target = event.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;

    if (current.verdict) {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        actions.next();
      }
      return;
    }

    const index = Number(event.key) - 1;
    const choice = current.question.options[index];
    if (Number.isInteger(index) && index >= 0 && choice) {
      event.preventDefault();
      actions.answer(choice);
    } else if (event.key.toLowerCase() === 'h' && current.question.canHint) {
      event.preventDefault();
      actions.useHint();
    }
  };
  document.addEventListener('keydown', onKeyDown);

  function renderOptions(state: QuizViewState) {
    const sameQuestion = current?.question.id === state.question.id;
    if (!sameQuestion) {
      options.replaceChildren();
      buttons = new Map();

      state.question.options.forEach((id, index) => {
        const manufacturer = dataset.manufacturer(id);
        const button = h(
          'button',
          { type: 'button', class: 'option' },
          h('span', { class: 'option__key' }, String(index + 1)),
          h('span', { class: 'option__name' }, manufacturer.name),
        );
        button.addEventListener('click', () => actions.answer(id));
        buttons.set(id, button);
        options.appendChild(button);
      });
    }

    for (const [id, button] of buttons) {
      const verdict = state.verdict;
      button.disabled = verdict !== null;
      if (!verdict) {
        button.removeAttribute('data-verdict');
        continue;
      }
      if (id === verdict.answer) button.setAttribute('data-verdict', 'correct');
      else if (id === verdict.chosen) button.setAttribute('data-verdict', 'wrong');
      else button.setAttribute('data-verdict', 'neutral');
    }
  }

  return {
    el,
    update(state) {
      const newQuestion = current?.question.id !== state.question.id;

      if (newQuestion) {
        image.setSource(state.question.coaster.closeup);
      } else if (state.hintUsed && !current?.hintUsed && state.question.coaster.context) {
        image.setSource(state.question.coaster.context);
      }

      renderOptions(state);

      hintButton.hidden = !state.question.canHint;
      hintButton.disabled = state.hintUsed || state.verdict !== null;

      revealSlot.replaceChildren();
      if (state.verdict) {
        image.reveal();
        const panel = renderReveal(dataset, state.question.coaster, state.verdict);
        revealSlot.appendChild(panel);
        panel.querySelector<HTMLElement>('.reveal__heading')?.focus();
      }

      nextButton.hidden = state.verdict === null;

      const summary = summarize(state.progress);
      scoreLine.textContent =
        summary.seen === 0
          ? 'No answers yet'
          : `${summary.seen} seen · ${Math.round(summary.accuracy * 100)}% unaided · streak ${state.progress.streak}`;

      current = state;
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      image.destroy();
    },
  };
}
