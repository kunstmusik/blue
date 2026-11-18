import { defineConfig } from 'vite-plus';
import { GithubActionsReporter } from 'vite-plus/test/node';
import { createPackageReporterConfig } from '../../scripts/vitest-package-reporters.mts';

export default defineConfig({
  test: {
    tags: [{ name: 'performance', timeout: 60000 }],
    tagsFilter: ['!performance'],
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30000,
    ...createPackageReporterConfig('@blue/data', GithubActionsReporter),
  },
});
