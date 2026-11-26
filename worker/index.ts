/**
 * Render worker: consumes pg-boss `render-download` jobs one at a time (concurrency 1) with one
 * long-lived Chromium. Dev: `npm run worker` (loads .env.local / .env.development like `next dev`).
 */
import { existsSync, writeFileSync } from 'node:fs';
import type { JobWithMetadata } from 'pg-boss';
import type { RenderJobData } from '@/lib/queue';

if (process.env.NODE_ENV !== 'production') {
  for (const file of ['.env.local', '.env.development']) {
    if (existsSync(file)) process.loadEnvFile(file); // never overrides variables already set
  }
}

async function main() {
  // Imported after the env files so DATABASE_URL etc. are set when the modules initialise.
  const { createBoss, startBoss, RENDER_JOB } = await import('@/lib/queue');
  const { launchBrowser } = await import('@/lib/render/pdf');
  const { processDownload } = await import('@/lib/render/job');
  const { sql } = await import('@/db/client');
  const { logConfigProblems } = await import('@/lib/config-check');
  logConfigProblems('worker');

  let browser = await launchBrowser();
  const liveBrowser = async () => {
    if (!browser.isConnected()) {
      console.warn('[worker] Chromium disconnected; relaunching');
      browser = await launchBrowser();
    }
    return browser;
  };

  const boss = await startBoss(createBoss());
  // batchSize 1 + a single work() subscription = one job at a time.
  await boss.work<RenderJobData>(
    RENDER_JOB,
    { batchSize: 1, pollingIntervalSeconds: 1, includeMetadata: true },
    async ([found]) => {
      const job = found as JobWithMetadata<RenderJobData>; // includeMetadata: true
      console.info(`[worker] job ${job.id} download ${job.data.downloadId} (attempt ${job.retryCount + 1})`);
      await processDownload(job.data.downloadId, await liveBrowser(), job);
    },
  );
  console.info(`[worker] listening for ${RENDER_JOB}`);

  // Liveness marker for the compose healthcheck (mtime < 2 min). Touched only after pg-boss itself
  // answers a query on the render queue, so a dead boss / lost DB turns the container unhealthy.
  let stopping = false;
  let heartbeat: ReturnType<typeof setTimeout> | undefined;
  const beat = async () => {
    try {
      if (await boss.getQueue(RENDER_JOB)) writeFileSync('/tmp/worker-alive', String(Date.now()));
      else console.error(`[worker] heartbeat: queue ${RENDER_JOB} not found`);
    } catch (err) {
      console.error('[worker] heartbeat: pg-boss check failed', err);
    }
    if (!stopping) heartbeat = setTimeout(() => void beat(), 30_000);
  };
  await beat();

  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    clearTimeout(heartbeat);
    console.info(`[worker] ${signal}: stopping`);
    await boss.stop({ graceful: true, timeout: 30_000 }).catch((e) => console.error(e));
    await browser.close().catch(() => {});
    await sql.end({ timeout: 5 }).catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] fatal', err);
  process.exit(1);
});
