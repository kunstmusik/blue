import { defineConfig } from 'vite-plus';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';
import { playwright } from 'vite-plus/test/browser-playwright';
import { testTags } from './test-tags.mts';

export default defineConfig({
  plugins: [tailwindcss()],
  optimizeDeps: { include: ['dockview', '@tanstack/react-table'] },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    tags: testTags,
    tagsFilter: ['!performance'],
    include: ['src/renderer/browser/**/*.browser.test.tsx'],
    globals: true,
    browser: {
      locators: {
        // Vitest v4 compatibility: keep partial, case-insensitive locator matching.
        // Remove after updating locators for full, case-sensitive matches.
        // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
        // https://vitest.dev/guide/migration/#locators-are-strict-by-default
        exact: false,
      },
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
      '@': resolve(import.meta.dirname, 'src/renderer'),
    },
  },
});
