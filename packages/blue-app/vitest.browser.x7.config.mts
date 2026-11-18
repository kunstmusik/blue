import { defineConfig } from 'vite-plus';
import { resolve } from 'path';
import { playwright } from 'vite-plus/test/browser-playwright';

export default defineConfig({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    include: ['src/renderer/browser/blue-x7-editor.browser.test.tsx'],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
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
      '@': resolve(import.meta.dirname, 'src/renderer'),
    },
  },
});
