import { defineConfig } from 'vite-plus';
import base from './vitest.config.mts';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: ['tests/integration/performance-benchmark.test.ts'],
    tagsFilter: ['performance'],
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
  },
});
