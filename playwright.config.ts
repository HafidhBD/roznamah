import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

try {
  process.loadEnvFile('.env.local');
} catch {}

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
  },
});
