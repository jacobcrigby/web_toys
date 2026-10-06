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

/** Which of the two photos is on screen. Purely presentational, so it lives in the view. */
type Shot = 'closeup' | 'context';

const kbd = (key: string): HTMLElement => h('kbd', { class: 'key', 'aria-hidden': 'true' }, key);

export function createQuizView(dataset: Dataset, actions: QuizActions): QuizView {
  const image = createTrackImage({ onSkip: () => actions.skipCoaster() });
  const options = h('div', { class: 'options', role: 'group', 'aria-label': 'Who built this?' });

  const hintButton = h(
    'button',
    { type: 'button', class: 'button button--ghost hint', 'aria-keyshortcuts': 'h' },
    h('span', {}, 'Show the whole ride'),
    kbd('H'),
    h('span', { class: 'hint__cost' }, 'counts as a hint'),
  );

  // Once the hint is spent the learner can flip between the two photos freely; the cost has
  // already been paid, and comparing the two is where the learning happens.
  const shotButtons: Record<Shot, HTMLButtonElement> = {
    closeup: h('button', { type: 'button', class: 'shot-toggle__option' }, 'Track close-up'),
    context: h('button', { type: 'button', class: 'shot-toggle__option' }, 'Whole ride'),
  };
  const shotToggle = h(
    'div',
    { class: 'shot-toggle', role: 'group', 'aria-label': 'Which photo to show', hidden: true },
    shotButtons.closeup,
    shotButtons.context,
  );

  const revealSlot = h('div', { class: 'reveal-slot', 'aria-live': 'polite' });
  const nextButton = h(
    'button',
    { type: 'button', class: 'button button--primary', 'aria-keyshortcuts': 'Enter' },
    'Next track',
    kbd('↵'),
  );
  const scoreLine = h('p', { class: 'scoreline' });
  const prompt = h('h1', { class: 'prompt', tabindex: '-1' }, 'Who built this track?');

  const el = h(
    'section',
    { class: 'quiz' },
    prompt,
    image.el,
    h(
      'div',
      { class: 'quiz__controls' },
      options,
      h('div', { class: 'quiz__aids' }, hintButton, shotToggle),
    ),
    revealSlot,
    h('div', { class: 'quiz__footer' }, scoreLine, nextButton),
  );

  let current: QuizViewState | null = null;
  let shot: Shot = 'closeup';
  let buttons = new Map<ManufacturerId, HTMLButtonElement>();

  function showShot(next: Shot) {
    if (!current) return;
    const source = next === 'context' ? current.question.coaster.context : null;
    shot = source ? next : 'closeup';
    image.setSource(source ?? current.question.coaster.closeup, {
      revealed: current.verdict !== null,
    });
    for (const [name, button] of Object.entries(shotButtons) as [Shot, HTMLButtonElement][]) {
      button.setAttribute('aria-pressed', String(name === shot));
    }
  }

  hintButton.addEventListener('click', () => actions.useHint());
  nextButton.addEventListener('click', () => actions.next());
  shotButtons.closeup.addEventListener('click', () => showShot('closeup'));
  shotButtons.context.addEventListener('click', () => showShot('context'));

  // Number keys pick an option; Enter or space moves on; H asks for the hint. Keeps the drill fast.
  const onKeyDown = (event: KeyboardEvent) => {
    if (!current || event.altKey || event.ctrlKey || event.metaKey) return;
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

  function renderOptions(state: QuizViewState, newQuestion: boolean) {
    if (newQuestion) {
      options.replaceChildren();
      buttons = new Map();

      state.question.options.forEach((id, index) => {
        const manufacturer = dataset.manufacturer(id);
        const button = h(
          'button',
          { type: 'button', class: 'option' },
          h('span', { class: 'option__key', 'aria-hidden': 'true' }, String(index + 1)),
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
      const hintJustUsed = state.hintUsed && !current?.hintUsed;
      const previous = current;
      current = state;

      if (newQuestion) {
        shot = 'closeup';
        image.setSource(state.question.coaster.closeup);
      } else if (hintJustUsed) {
        showShot('context');
      }

      renderOptions(state, newQuestion);

      hintButton.hidden = !state.question.canHint || state.hintUsed;
      hintButton.disabled = state.verdict !== null;
      shotToggle.hidden = !state.hintUsed;

      revealSlot.replaceChildren();
      if (state.verdict) {
        image.reveal();
        const panel = renderReveal(dataset, state.question.coaster, state.verdict);
        revealSlot.appendChild(panel);
        panel.querySelector<HTMLElement>('.reveal__heading')?.focus();
      } else if (newQuestion && previous) {
        // Moving on removes the focused reveal heading from the document, which would dump a
        // keyboard user back at the top of the page. Land on the prompt instead.
        const active = document.activeElement;
        if (!active || active === document.body || !document.contains(active)) prompt.focus();
      }

      nextButton.hidden = state.verdict === null;

      const summary = summarize(state.progress);
      scoreLine.textContent =
        summary.seen === 0
          ? 'No answers yet'
          : `${summary.seen} seen · ${Math.round(summary.accuracy * 100)}% unaided · streak ${state.progress.streak}`;
    },
    destroy() {
      document.removeEventListener('keydown', onKeyDown);
      image.destroy();
    },
  };
}
