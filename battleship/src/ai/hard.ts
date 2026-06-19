// SPDX-License-Identifier: Apache-2.0
import type { GameState } from '../engine/index.ts';
import type { WorkerRequest, WorkerResponse } from './hard.worker.ts';
import { MediumAi } from './medium.ts';
import type { AiOptions, AiPlayer } from './types.ts';

const TIMEOUT_MS = 2000;
const medium = new MediumAi();

export class HardAi implements AiPlayer {
  private worker: Worker | null = null;

  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('./hard.worker.ts', import.meta.url), { type: 'module' });
    }
    return this.worker;
  }

  async chooseAction(state: GameState, playerIndex: 0 | 1, opts: AiOptions) {
    const seed = Math.floor(opts.rng() * 0x7fffffff);
    const req: WorkerRequest = { state, playerIndex, seed };

    const workerResult = await Promise.race<WorkerResponse | null>([
      this.askWorker(req),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), TIMEOUT_MS)),
    ]);

    if (workerResult !== null) {
      return { kind: 'shot' as const, cell: workerResult.cell };
    }

    // Fallback to Medium AI on timeout
    return medium.chooseAction(state, playerIndex, opts);
  }

  private askWorker(req: WorkerRequest): Promise<WorkerResponse> {
    return new Promise((resolve, reject) => {
      try {
        const worker = this.getWorker();
        const handler = (e: MessageEvent<WorkerResponse>) => {
          worker.removeEventListener('message', handler);
          worker.removeEventListener('error', errHandler);
          resolve(e.data);
        };
        const errHandler = (e: ErrorEvent) => {
          worker.removeEventListener('message', handler);
          worker.removeEventListener('error', errHandler);
          reject(new Error(e.message));
        };
        worker.addEventListener('message', handler);
        worker.addEventListener('error', errHandler);
        worker.postMessage(req);
      } catch (err) {
        reject(err);
      }
    });
  }

  terminate() {
    this.worker?.terminate();
    this.worker = null;
  }
}
