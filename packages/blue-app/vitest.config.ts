import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    include: [
      'src/main/**/*.test.ts',
      'src/preload/**/*.test.ts',
      'src/shared/**/*.test.ts',
      'src/renderer/tests/**/*.test.{ts,tsx}',
      'src/renderer/components/**/*.test.{ts,tsx}',
    ],
    globals: true,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
});
