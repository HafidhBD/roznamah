import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// Same env as `next dev` sees (.env.local wins over .env.development; loadEnvFile never overrides).
for (const file of ['.env.local', '.env.development']) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

const chromium = '/opt/pw-browsers/chromium';
const port = process.env.PORT ?? '3000';
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: 'list',
  use: {
    baseURL,
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
    // Downloads e2e reads emails from the in-memory outbox (GET /api/test/outbox).
    env: { PORT: port, EMAIL_TRANSPORT: 'memory' },
  },
});
