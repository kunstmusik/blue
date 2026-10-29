import { defineConfig } from 'vitest/config';
import base from './vitest.config';

// Explicit files avoid importing the rest of the app suite during measurements.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    include: [
      'src/renderer/components/workbench/panels/editors/csound-editor-menu.test.ts',
      'src/renderer/components/workbench/panels/code-repository/CodeRepositoryDialog.test.tsx',
      'src/renderer/tests/udo-code-completions.test.ts',
      'src/shared/project-editor-score-color-application.test.ts',
      'src/main/global-project-history.performance.test.ts',
      'src/main/unified-library/performance.test.ts',
      'src/main/blue-x7-multi-instance.integration.test.ts',
    ],
    tagsFilter: ['performance && !real-engine'],
    fileParallelism: false,
    maxWorkers: 1,
    retry: 0,
  },
});
