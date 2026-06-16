// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { AiPlayer } from './ai/index.ts';
import { GameController } from './controller.ts';
import type { Move } from './engine/index.ts';
import { SoundManager } from './ui/sound.ts';

function fakeAi(move: Move): AiPlayer {
  return {
    difficulty: 'medium', // min delay 500ms
    chooseMove: () => Promise.resolve(move), // resolves in a microtask
    dispose() {},
  };
}

function setup(aiMoves: Move[]) {
  document.body.innerHTML = '<div id="app"></div>';
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) {
    throw new Error('missing root');
  }
  let call = 0;
  const controller = new GameController(root, {
    sound: new SoundManager(),
    createAi: () => fakeAi(aiMoves[Math.min(call++, aiMoves.length - 1)] as Move),
  });
  controller.init();
  return controller;
}

const ariaBusy = () => document.querySelector('.macro')?.getAttribute('aria-busy');
const marks = () => document.querySelectorAll('.cell--x, .cell--o').length;

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('controller AI turn', () => {
  test('dispatches the AI opening when the human plays O, and locks input while thinking', async () => {
    const controller = setup([{ board: 4, cell: 4 }]);
    controller.setSetting('mode', 'ai');
    controller.setSetting('humanPlays', 'O');
    controller.startGame();
    await vi.advanceTimersByTimeAsync(0);
    expect(ariaBusy()).toBe('true'); // thinking through the min delay
    expect(marks()).toBe(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(ariaBusy()).toBe('false');
    expect(marks()).toBe(1); // AI opened
    expect(document.querySelector('.cell[data-board="4"][data-cell="4"]')?.className).toContain(
      'cell--x',
    );
  });

  test('stale-move guard: Menu during the min-delay window discards the resolved move', async () => {
    const controller = setup([{ board: 4, cell: 4 }]);
    controller.setSetting('mode', 'ai');
    controller.setSetting('humanPlays', 'O');
    controller.startGame();
    await vi.advanceTimersByTimeAsync(0); // chooseMove already resolved; sleep pending
    controller.goToMenu(); // abort + reset during the window
    await vi.advanceTimersByTimeAsync(1000);
    expect(ariaBusy()).toBe('false'); // aiThinking ended false — no soft-lock
    expect(marks()).toBe(0); // stale move was NOT applied
  });

  test('stale-move guard: New Game during the window discards the old move; fresh dispatch proceeds', async () => {
    const controller = setup([
      { board: 4, cell: 4 }, // first game's AI would play E5
      { board: 0, cell: 0 }, // second game's AI plays A1
    ]);
    controller.setSetting('mode', 'ai');
    controller.setSetting('humanPlays', 'O');
    controller.startGame();
    await vi.advanceTimersByTimeAsync(0);
    controller.startGame(); // reset during the first AI's delay window
    await vi.advanceTimersByTimeAsync(1000);
    expect(marks()).toBe(1); // exactly the new game's opening, not both
    expect(document.querySelector('.cell[data-board="0"][data-cell="0"]')?.className).toContain(
      'cell--x',
    );
    expect(document.querySelector('.cell[data-board="4"][data-cell="4"]')?.className).not.toContain(
      'cell--x',
    );
    expect(ariaBusy()).toBe('false');
  });

  test('AI replies after a human move when the human plays X', async () => {
    const controller = setup([{ board: 7, cell: 7 }]);
    controller.setSetting('mode', 'ai');
    controller.setSetting('humanPlays', 'X');
    controller.startGame();
    await vi.advanceTimersByTimeAsync(0);
    expect(marks()).toBe(0); // human to move; no AI dispatch
    controller.playCell(4, 7); // human plays; AI is forced to board 7
    await vi.advanceTimersByTimeAsync(0);
    expect(ariaBusy()).toBe('true');
    await vi.advanceTimersByTimeAsync(500);
    expect(marks()).toBe(2);
    expect(document.querySelector('.cell[data-board="7"][data-cell="7"]')?.className).toContain(
      'cell--o',
    );
  });

  test('human clicks are ignored while the AI is thinking', async () => {
    const controller = setup([{ board: 7, cell: 7 }]);
    controller.setSetting('mode', 'ai');
    controller.setSetting('humanPlays', 'X');
    controller.startGame();
    controller.playCell(4, 7);
    await vi.advanceTimersByTimeAsync(0); // AI thinking
    controller.playCell(0, 0); // must be ignored
    await vi.advanceTimersByTimeAsync(500);
    expect(marks()).toBe(2); // human move + AI reply only
  });
});

describe('undo', () => {
  test('hotseat: removes exactly one ply', async () => {
    const controller = setup([{ board: 0, cell: 0 }]);
    controller.startGame(); // hotseat by default
    controller.playCell(4, 4);
    controller.playCell(4, 0);
    expect(marks()).toBe(2);
    controller.undo();
    expect(marks()).toBe(1);
    expect(document.querySelector('.cell[data-board="4"][data-cell="4"]')?.className).toContain(
      'cell--x',
    );
  });

  test('vs AI: removes the AI reply and the human move together', async () => {
    const controller = setup([{ board: 7, cell: 7 }]);
    controller.setSetting('mode', 'ai');
    controller.setSetting('humanPlays', 'X');
    controller.startGame();
    controller.playCell(4, 7);
    await vi.advanceTimersByTimeAsync(500);
    expect(marks()).toBe(2);
    controller.undo();
    expect(marks()).toBe(0);
    expect(ariaBusy()).toBe('false');
  });

  test('vs AI as O: no-op before the human has moved', async () => {
    const controller = setup([{ board: 4, cell: 4 }]);
    controller.setSetting('mode', 'ai');
    controller.setSetting('humanPlays', 'O');
    controller.startGame();
    await vi.advanceTimersByTimeAsync(500); // AI opening on the board
    expect(marks()).toBe(1);
    controller.undo();
    expect(marks()).toBe(1); // unchanged
  });

  test('ignored while the AI is thinking', async () => {
    const controller = setup([{ board: 7, cell: 7 }]);
    controller.setSetting('mode', 'ai');
    controller.setSetting('humanPlays', 'X');
    controller.startGame();
    controller.playCell(4, 7);
    await vi.advanceTimersByTimeAsync(0); // thinking
    controller.undo();
    await vi.advanceTimersByTimeAsync(500);
    expect(marks()).toBe(2); // human move + AI reply both intact
  });
});

describe('persistence and scores', () => {
  test('settings and scores are saved on commit and loaded by a fresh controller', async () => {
    const controller = setup([{ board: 4, cell: 4 }]);
    controller.setSetting('mode', 'ai');
    controller.setSetting('difficulty', 'easy');
    controller.setSetting('humanPlays', 'O');
    const stored = JSON.parse(localStorage.getItem('uttt:v1') ?? 'null');
    expect(stored?.settings).toEqual({
      mode: 'ai',
      difficulty: 'easy',
      humanPlays: 'O',
      muted: false,
    });
    // A fresh controller (new page load) restores the settings.
    setup([{ board: 4, cell: 4 }]);
    const checked = document.querySelector('.seg[aria-checked="true"]');
    expect(checked?.textContent).toBe('vs AI');
  });

  test('resetScores zeroes the persisted totals', () => {
    const controller = setup([{ board: 4, cell: 4 }]);
    controller.startGame();
    // fabricate a finished game by direct score-bearing play is verbose;
    // instead assert reset clears whatever is persisted
    controller.resetScores();
    const stored = JSON.parse(localStorage.getItem('uttt:v1') ?? 'null');
    expect(stored?.scores).toEqual({ x: 0, o: 0, draws: 0 });
  });

  test('corrupt localStorage falls back to defaults', () => {
    localStorage.setItem('uttt:v1', '{broken');
    setup([{ board: 4, cell: 4 }]);
    const checked = document.querySelector('.seg[aria-checked="true"]');
    expect(checked?.textContent).toBe('2 players'); // default mode
  });
});
