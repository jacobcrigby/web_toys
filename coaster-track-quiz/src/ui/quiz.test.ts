// @vitest-environment jsdom
// SPDX-License-Identifier: Apache-2.0

import { describe, expect, it, vi } from 'vitest';
import { generateQuestion } from '../quiz/generate.ts';
import { grade } from '../quiz/grade.ts';
import { emptyProgress } from '../quiz/progress.ts';
import type { Question } from '../quiz/types.ts';
import { createRng } from '../rng.ts';
import { fixtureDataset } from '../testing/fixtures.ts';
import { createQuizView, type QuizActions, type QuizViewState } from './quiz.ts';

const dataset = fixtureDataset();

function actions(): QuizActions {
  return { answer: vi.fn(), next: vi.fn(), useHint: vi.fn(), skipCoaster: vi.fn() };
}

function question(seed: number): Question {
  return generateQuestion(dataset, emptyProgress(), createRng(seed));
}

function state(overrides: Partial<QuizViewState> & { question: Question }): QuizViewState {
  return { progress: emptyProgress(), verdict: null, hintUsed: false, ...overrides };
}

const optionsOf = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('.option')];

describe('options', () => {
  it('renders one button per option, in order, for a new question', () => {
    const view = createQuizView(dataset, actions());
    const q = question(1);
    view.update(state({ question: q }));

    const names = optionsOf(view.el).map((b) => b.querySelector('.option__name')?.textContent);
    expect(names).toEqual(q.options.map((id) => dataset.manufacturer(id).name));
    view.destroy();
  });

  it('keeps the same buttons across updates to the same question', () => {
    const view = createQuizView(dataset, actions());
    const q = question(2);
    view.update(state({ question: q }));
    const before = optionsOf(view.el);
    view.update(state({ question: q, hintUsed: true }));
    expect(optionsOf(view.el)).toEqual(before);
    view.destroy();
  });

  it('replaces the buttons when the question changes', () => {
    const view = createQuizView(dataset, actions());
    view.update(state({ question: question(3) }));
    const q = question(4);
    view.update(state({ question: q }));
    expect(optionsOf(view.el)).toHaveLength(q.options.length);
    expect(optionsOf(view.el)[0]?.querySelector('.option__name')?.textContent).toBe(
      dataset.manufacturer(q.options[0] as (typeof q.options)[number]).name,
    );
    view.destroy();
  });

  it('answers through the button and through its number key', () => {
    const a = actions();
    const view = createQuizView(dataset, a);
    const q = question(5);
    view.update(state({ question: q }));

    optionsOf(view.el)[1]?.click();
    expect(a.answer).toHaveBeenCalledWith(q.options[1]);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    expect(a.answer).toHaveBeenCalledWith(q.options[2]);
    view.destroy();
  });

  it('marks the answer, the pick and the rest once graded', () => {
    const view = createQuizView(dataset, actions());
    const q = question(6);
    const wrong = q.options.find((id) => id !== q.answer) as (typeof q.options)[number];
    const verdict = grade(dataset, q, wrong, false, emptyProgress());
    view.update(state({ question: q, verdict }));

    const byVerdict = Object.fromEntries(
      optionsOf(view.el).map((b) => [b.getAttribute('data-verdict'), b.disabled]),
    );
    expect(byVerdict).toEqual({ correct: true, wrong: true, neutral: true });
    expect(view.el.querySelector('.reveal')).not.toBeNull();
    view.destroy();
  });
});

describe('hint and photo toggle', () => {
  it('hides the hint button for a coaster with no wide shot', () => {
    const noContext = fixtureDataset({ withContext: false });
    const view = createQuizView(noContext, actions());
    view.update(state({ question: generateQuestion(noContext, emptyProgress(), createRng(7)) }));
    expect(view.el.querySelector<HTMLElement>('.hint')?.hidden).toBe(true);
    view.destroy();
  });

  it('swaps the hint button for the photo toggle once the hint is used', () => {
    const view = createQuizView(dataset, actions());
    const q = question(8);
    view.update(state({ question: q }));
    const hint = view.el.querySelector<HTMLElement>('.hint') as HTMLElement;
    const toggle = view.el.querySelector<HTMLElement>('.shot-toggle') as HTMLElement;
    expect(hint.hidden).toBe(false);
    expect(toggle.hidden).toBe(true);

    view.update(state({ question: q, hintUsed: true }));
    expect(hint.hidden).toBe(true);
    expect(toggle.hidden).toBe(false);
    expect(view.el.querySelector('img')?.getAttribute('src')).toBe(q.coaster.context?.url);

    // And the learner can flip back to the close-up without losing the hint.
    view.el.querySelector<HTMLButtonElement>('.shot-toggle__option')?.click();
    expect(view.el.querySelector('img')?.getAttribute('src')).toBe(q.coaster.closeup.url);
    view.destroy();
  });

  it('resets to the close-up and hides the toggle on the next question', () => {
    const view = createQuizView(dataset, actions());
    view.update(state({ question: question(9), hintUsed: true }));
    const q = question(10);
    view.update(state({ question: q }));
    expect(view.el.querySelector<HTMLElement>('.shot-toggle')?.hidden).toBe(true);
    expect(view.el.querySelector('img')?.getAttribute('src')).toBe(q.coaster.closeup.url);
    view.destroy();
  });
});

describe('keyboard flow', () => {
  it('moves on with Enter only after a verdict, and shows the next button then', () => {
    const a = actions();
    const view = createQuizView(dataset, a);
    const q = question(11);
    view.update(state({ question: q }));
    const next = [...view.el.querySelectorAll<HTMLButtonElement>('button')].find((b) =>
      b.textContent?.includes('Next track'),
    ) as HTMLButtonElement;
    expect(next.hidden).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(a.next).not.toHaveBeenCalled();

    view.update(
      state({ question: q, verdict: grade(dataset, q, q.answer, false, emptyProgress()) }),
    );
    expect(next.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(a.next).toHaveBeenCalledTimes(1);
    view.destroy();
  });

  it('stops listening once destroyed', () => {
    const a = actions();
    const view = createQuizView(dataset, a);
    view.update(state({ question: question(12) }));
    view.destroy();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(a.answer).not.toHaveBeenCalled();
  });
});
