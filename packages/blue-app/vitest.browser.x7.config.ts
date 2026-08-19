import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    include: ['src/renderer/browser/blue-x7-editor.browser.test.tsx'],
    globals: true,
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          channel: 'chrome',
        },
      }),
      instances: [
        {
          browser: 'chromium',
          name: 'x7-desktop',
          headless: true,
          fileParallelism: false,
          viewport: { width: 1280, height: 960 },
        },
        {
          browser: 'chromium',
          name: 'x7-narrow',
          headless: true,
          fileParallelism: false,
          viewport: { width: 360, height: 600 },
        },
      ],
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
});
