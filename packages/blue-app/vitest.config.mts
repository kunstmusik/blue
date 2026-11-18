import { defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';
import { resolve } from 'path';
import { createPackageReporterConfig } from '../../scripts/vitest-package-reporters.mts';
import { testTags } from './test-tags.mts';

export default defineConfig({
  test: {
    tags: testTags,
    tagsFilter: ['!performance'],
    include: [
      'src/main/**/*.test.ts',
      'src/preload/**/*.test.ts',
      'src/shared/**/*.test.ts',
      'src/renderer/tests/**/*.test.{ts,tsx}',
      'src/renderer/components/**/*.test.{ts,tsx}',
      'src/renderer/lib/**/*.test.ts',
    ],
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    ...createPackageReporterConfig('@blue/app', GithubActionsReporter),
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src/renderer'),
    },
  },
});
