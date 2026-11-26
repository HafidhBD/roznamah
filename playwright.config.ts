import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

/**
 * One command runs every e2e spec: `npm run test:e2e`.
 *
 * Playwright starts its own `next dev` on PORT (default 3300) with a separate build dir
 * (NEXT_DIST_DIR=.next/e2e), so it never reuses or collides with a developer's `next dev` on :3000
 * (Next allows one dev server per build dir). The render worker is spawned once for the whole run by
 * tests/e2e/global-setup.ts. All values below are DEV/TEST ONLY — never production secrets.
 */

// Same env as `next dev` sees (.env.local wins over .env.development; loadEnvFile never overrides).
for (const file of ['.env.local', '.env.development']) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

const port = process.env.PORT ?? '3300';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

const e2eEnv: Record<string, string> = {
  PORT: port,
  NEXT_DIST_DIR: '.next/e2e',
  APP_URL: baseURL,
  AUTH_URL: baseURL,
  // Download e2e reads emails from the in-memory outbox (GET /api/test/outbox).
  EMAIL_TRANSPORT: 'memory',
  AUTH_SECRET: process.env.AUTH_SECRET || 'e2e-only-auth-secret-not-for-production-000000',
  ADMIN_EMAILS: process.env.ADMIN_EMAILS || 'admin@example.com',
  RENDER_SECRET: process.env.RENDER_SECRET || 'dev-render-secret',
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://roznamah:roznamah@localhost:5432/roznamah',
};
// Specs (DB cleanup, admin sessions, print secret) and the spawned worker see the same values.
Object.assign(process.env, e2eEnv);

const chromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: 'list',
  globalSetup: './tests/e2e/global-setup.ts',
  use: {
    baseURL,
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  webServer: {
    command: `next dev -p ${port}`,
    url: baseURL,
    // Reusing a server started without the env above (e.g. no memory outbox) breaks specs; opt in only.
    reuseExistingServer: process.env.E2E_REUSE_SERVER === '1',
    timeout: 180_000,
    env: e2eEnv,
  },
});
