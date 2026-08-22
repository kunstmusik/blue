import { defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';
import { createPackageReporterConfig } from '../../scripts/vitest-package-reporters';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    testTimeout: 30000,
    ...createPackageReporterConfig('@blue/data', GithubActionsReporter),
  },
});
