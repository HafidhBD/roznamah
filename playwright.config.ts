import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';

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
