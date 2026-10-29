import { defineConfig } from 'vitest/config';
import base from './vitest.browser.config';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      'src/renderer/browser/mixer-metering.browser.test.tsx',
      'src/renderer/browser/global-project-history.browser.test.tsx',
      'src/renderer/browser/patterns-layer-group-canvas.browser.test.tsx',
    ],
    tagsFilter: ['performance'],
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
    browser: { ...base.test?.browser, provider: playwright() },
  },
});
