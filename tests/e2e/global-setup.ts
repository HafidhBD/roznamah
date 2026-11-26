/**
 * Spawns the render worker (exactly like `npm run worker`) once for the whole e2e run, so specs that
 * download PDFs share one consumer of the queue. Its output goes to test-results/e2e-worker.log.
 * The returned function is Playwright's global teardown.
 */
import { spawn } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync } from 'node:fs';
import type { FullConfig } from '@playwright/test';

export const WORKER_LOG = 'test-results/e2e-worker.log';

export default async function globalSetup(config: FullConfig) {
  mkdirSync('test-results', { recursive: true });
  const log = createWriteStream(WORKER_LOG);
  const worker = spawn(process.execPath, ['--import', 'tsx', 'worker/index.ts'], {
    env: { ...process.env, APP_URL: config.projects[0].use.baseURL },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  worker.stdout!.pipe(log);
  worker.stderr!.pipe(log);

  const deadline = Date.now() + 60_000;
  try {
    for (;;) {
      if (worker.exitCode !== null) throw new Error(`worker exited early:\n${readFileSync(WORKER_LOG, 'utf8')}`);
      try {
        if (readFileSync(WORKER_LOG, 'utf8').includes('listening for')) break;
      } catch {}
      if (Date.now() > deadline) throw new Error(`worker did not start:\n${readFileSync(WORKER_LOG, 'utf8')}`);
      await new Promise((r) => setTimeout(r, 250));
    }
  } catch (err) {
    // No teardown runs when global setup throws: never leave the worker running (it would keep consuming jobs).
    if (worker.exitCode === null) worker.kill('SIGKILL');
    throw err;
  }

  return async () => {
    if (worker.exitCode !== null) return;
    const exited = new Promise((done) => worker.once('exit', done));
    worker.kill('SIGTERM');
    await exited;
  };
}
