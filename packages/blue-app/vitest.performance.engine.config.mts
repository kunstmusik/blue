import { defineConfig } from 'vite-plus';
import base from './vitest.config.mts';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      'src/main/global-history-engine.integration.test.ts',
      'src/main/meter-engine.integration.test.ts',
    ],
    tagsFilter: ['performance && real-engine'],
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
    env: { BLUE_RUN_REAL_ENGINE: '1', BLUE_REQUIRE_PERFORMANCE_ENGINE: '1' },
  },
});
