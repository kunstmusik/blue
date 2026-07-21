import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import { playwright } from '@vitest/browser-playwright';

export default defineConfig({
  test: {
    include: ['src/renderer/browser/**/*.browser.test.tsx'],
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
          name: 'bsb-geometry',
          headless: true,
          fileParallelism: false,
          viewport: { width: 1280, height: 960 },
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
