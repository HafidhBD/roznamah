import { defineConfig } from 'tsup';

// Worker + one-shot scripts, bundled to CommonJS in worker/dist. Native / browser packages stay external
// and are resolved from node_modules in the runtime image.
export default defineConfig({
  entry: {
    index: 'worker/index.ts',
    migrate: 'scripts/migrate.ts',
    seed: 'scripts/seed.ts',
  },
  outDir: 'worker/dist',
  format: ['cjs'],
  platform: 'node',
  target: 'node22',
  clean: true,
  sourcemap: false,
  dts: false,
  noExternal: ['pg-boss', 'postgres', 'drizzle-orm', 'zod'],
  external: ['playwright', 'playwright-core', 'sharp', 'node-vibrant'],
});
