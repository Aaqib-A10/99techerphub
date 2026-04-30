import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    // Integration tests share a single Postgres test DB. Run files serially in
    // a single fork so makeFixtures() doesn't race across files; isolate: false
    // keeps PrismaClient singletons across test files for the same fork.
    pool: 'forks',
    forks: { singleFork: true },
    fileParallelism: false,
    isolate: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
});
