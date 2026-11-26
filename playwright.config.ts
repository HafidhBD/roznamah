import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

// Same env as `next dev` sees (.env.local wins over .env.development; loadEnvFile never overrides).
for (const file of ['.env.local', '.env.development']) {
  try {
    process.loadEnvFile(file);
  } catch {}
}

const chromium = '/opt/pw-browsers/chromium';

export default defineConfig({
  testDir: 'tests/e2e',
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    launchOptions: existsSync(chromium) ? { executablePath: chromium } : {},
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
