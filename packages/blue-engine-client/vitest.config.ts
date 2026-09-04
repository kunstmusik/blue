import { defineConfig } from 'vitest/config';
import { GithubActionsReporter } from 'vitest/node';
import { createPackageReporterConfig } from '../../scripts/vitest-package-reporters';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    ...createPackageReporterConfig('@blue/engine-client', GithubActionsReporter),
  },
});
