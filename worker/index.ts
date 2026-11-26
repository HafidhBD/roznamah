import { PgBoss } from 'pg-boss';
import { writeFileSync } from 'node:fs';

// Placeholder entry: Task 11 replaces the body (queues, handlers). Keep this path:
// `npm run build:worker` -> worker/dist/index.js, started with `node worker/dist/index.js`.
async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is not set');
  const boss = new PgBoss(url);
  boss.on('error', (err: unknown) => console.error('pg-boss error', err));
  await boss.start();
  console.log('worker ready');

  // Liveness marker for the compose healthcheck (mtime < 2 min). Keep this pattern in Task 11.
  const alive = () => {
    try {
      writeFileSync('/tmp/worker-alive', String(Date.now()));
    } catch {}
  };
  alive();
  setInterval(alive, 30_000).unref();

  const stop = async () => {
    await boss.stop();
    process.exit(0);
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
