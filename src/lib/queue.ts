/**
 * The render queue (pg-boss on the app database). The web app only sends jobs; `worker/index.ts`
 * consumes them. One lazily-started boss per process (cached on globalThis for dev HMR).
 */
import PgBoss from 'pg-boss';

export const RENDER_JOB = 'render-download';
export type RenderJobData = { downloadId: string };

/** Retries on the queue itself, so every sender gets the same policy: 2 retries, 30 s apart. */
export const RENDER_QUEUE_OPTIONS = { retryLimit: 2, retryDelay: 30, expireInSeconds: 15 * 60 } as const;

export function createBoss(options: Omit<PgBoss.ConstructorOptions, 'connectionString'> = {}): PgBoss {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const boss = new PgBoss({ connectionString: url, max: 3, ...options });
  boss.on('error', (err) => console.error('[queue]', err));
  return boss;
}

/** Starts the boss and makes sure the render queue exists (createQueue is idempotent). */
export async function startBoss(boss: PgBoss): Promise<PgBoss> {
  await boss.start();
  await boss.createQueue(RENDER_JOB, { name: RENDER_JOB, ...RENDER_QUEUE_OPTIONS });
  return boss;
}

const globalForQueue = globalThis as unknown as { __roznamahBoss?: Promise<PgBoss> };

function sender(): Promise<PgBoss> {
  if (!globalForQueue.__roznamahBoss) {
    // Send-only: maintenance and scheduling belong to the worker.
    const p = (async () => startBoss(createBoss({ max: 2, supervise: false, schedule: false })))();
    globalForQueue.__roznamahBoss = p;
    p.catch(() => {
      if (globalForQueue.__roznamahBoss === p) globalForQueue.__roznamahBoss = undefined; // retry next time
    });
  }
  return globalForQueue.__roznamahBoss;
}

export async function enqueueRender(downloadId: string): Promise<void> {
  const boss = await sender();
  const id = await boss.send(RENDER_JOB, { downloadId } satisfies RenderJobData, RENDER_QUEUE_OPTIONS);
  if (!id) throw new Error(`could not enqueue ${RENDER_JOB} for ${downloadId}`);
}
