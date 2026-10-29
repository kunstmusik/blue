import { defineConfig } from 'vitest/config';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from '@vitest/browser-playwright';
import { testTags } from './test-tags';

export default defineConfig({
  plugins: [tailwindcss()],
  test: {
    tags: testTags,
    tagsFilter: ['!performance'],
    include: ['src/renderer/browser/**/*.browser.test.tsx'],
    globals: true,
    deps: {
      optimizer: { client: { include: ['@tanstack/react-table'] } },
    },
    browser: {
      enabled: true,
      provider: playwright({
        launchOptions: {
          channel: process.env.BLUE_TEST_BROWSER_CHANNEL ?? 'chrome',
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
