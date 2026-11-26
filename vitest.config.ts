import { defineConfig } from 'vitest/config';
import path from 'node:path';

const testDb =
  process.env.TEST_DATABASE_URL ??
  'postgresql://roznamah:roznamah@localhost:5432/roznamah_test';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    passWithNoTests: true,
    env: { DATABASE_URL: testDb },
  },
});
