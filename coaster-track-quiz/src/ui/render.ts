// SPDX-License-Identifier: Apache-2.0
//
// The app shell: masthead, tabs, and a <main> whose contents are swapped per route. Follows
// daylight-map's closure-based mount() rather than module-level refs, so nothing leaks between
// tests or between mounts.

import type { Dataset } from '../data/dataset.ts';
import type { AppState, Route } from '../state.ts';
import { clear, h } from './dom.ts';
import { createGuideView } from './guide.ts';
import { createQuizView, type QuizActions, type QuizView } from './quiz.ts';
import { createStatsView } from './stats.ts';

export interface Actions extends QuizActions {
  resetProgress(): void;
}

export interface View {
  render(state: AppState): void;
}

const TABS: readonly { route: Route['name']; href: string; label: string }[] = [
  { route: 'quiz', href: '#/quiz', label: 'Quiz' },
  { route: 'guide', href: '#/guide', label: 'Track guide' },
  { route: 'stats', href: '#/stats', label: 'Progress' },
];

export function mount(root: HTMLElement, dataset: Dataset, actions: Actions): View {
  const tabs = TABS.map((tab) => h('a', { class: 'tab', href: tab.href }, tab.label));
  const nav = h('nav', { class: 'tabs', 'aria-label': 'Sections' }, ...tabs);

  const main = h('main', { class: 'main', id: 'main' });

  const shell = h(
    'div',
    { class: 'shell' },
    h(
      'header',
      { class: 'masthead' },
      h('a', { class: 'masthead__home', href: '../' }, '← web toys'),
      h('span', { class: 'masthead__title' }, 'Coaster Track Quiz'),
      nav,
    ),
    main,
    h(
      'footer',
      { class: 'footer' },
      h(
        'p',
        {},
        'Photographs are hotlinked from Wikimedia Commons and remain under their own licences, ' +
          'credited on each image. Everything else runs locally in your browser — no accounts, ' +
          'no server, no tracking.',
      ),
    ),
  );

  clear(root);
  root.appendChild(shell);

  let quizView: QuizView | null = null;
  let lastRoute: Route['name'] | null = null;

  return {
    render(state) {
      tabs.forEach((tab, index) => {
        const isCurrent = TABS[index]?.route === state.route.name;
        tab.setAttribute('aria-current', isCurrent ? 'page' : 'false');
      });

      const routeChanged = lastRoute !== state.route.name;
      lastRoute = state.route.name;

      if (state.route.name === 'quiz') {
        if (routeChanged || !quizView) {
          quizView?.destroy();
          quizView = createQuizView(dataset, actions);
          clear(main);
          main.appendChild(quizView.el);
        }
        if (state.question) {
          quizView.update({
            question: state.question,
            progress: state.progress,
            verdict: state.verdict,
            hintUsed: state.hintUsed,
          });
        }
        return;
      }

      quizView?.destroy();
      quizView = null;
      clear(main);

      if (state.route.name === 'guide') {
        main.appendChild(createGuideView(dataset));
        if (state.route.manufacturer) {
          document.getElementById(`guide-${state.route.manufacturer}`)?.scrollIntoView();
        }
        return;
      }

      main.appendChild(createStatsView(dataset, state.progress, actions.resetProgress));
    },
  };
}
