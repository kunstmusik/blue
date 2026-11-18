import { defineConfig } from 'vite-plus';
import { GithubActionsReporter } from 'vite-plus/test/node';
import { createPackageReporterConfig } from '../../scripts/vitest-package-reporters.mts';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    ...createPackageReporterConfig('@blue/engine-client', GithubActionsReporter),
  },
});
