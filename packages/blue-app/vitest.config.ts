import { defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';
import { resolve } from 'path';
import { createPackageReporterConfig } from '../../scripts/vitest-package-reporters';

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
    ...createPackageReporterConfig('@blue/app', GithubActionsReporter),
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
});
