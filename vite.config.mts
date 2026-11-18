import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    semi: true,
    singleQuote: true,
    tabWidth: 2,
    trailingComma: 'all',
    printWidth: 100,
    endOfLine: 'lf',
    ignorePatterns: [
      '**/dist/**',
      '**/build/**',
      '**/release/**',
      '**/.engine-stage/**',
      '*.tsbuildinfo',
      'release-metadata.json',
      '**/.worktrees/**',
      '**/coverage/**',
      '**/generated/**',
      '**/fixtures/**',
      '**/__fixtures__/**',
      '**/test-fixtures/**',
      '**/target/**',
      'graphify-out/**',
      '**/vendor/**',
      'native/blue-engine/build*/**',
      'native/blue-engine/.vcpkg/**',
      'native/blue-engine/vcpkg_installed/**',
      'native/blue-engine/downloads/**',
      '**/examples/**',
      '**/user-content/**',
      'specs/**',
      '.specify/**',
      'research/**',
      '.tmp-research/**',
      '**/.agents/skills/**',
    ],
  },
  lint: {
    ignorePatterns: [
      '**/dist/**',
      '**/build/**',
      '**/node_modules/**',
      '**/.worktrees/**',
      '**/release/**',
      '**/coverage/**',
      '**/generated/**',
      'native/blue-engine/.vcpkg/**',
      'native/blue-engine/vcpkg_installed/**',
      'native/blue-engine/build-*/**',
      'docs/manual/_build/**',
      '**/fixtures/**',
      '**/__fixtures__/**',
      '**/user-content/**',
      '**/*.min.js',
      '**/*.log',
      '**/.env*',
    ],
    jsPlugins: ['./scripts/blue-lint-plugin.mjs'],
    overrides: [
      {
        files: ['packages/blue-app/src/**/*.{ts,tsx}'],
        rules: {
          'no-restricted-globals': [
            'error',
            {
              name: 'confirm',
              message:
                'Use window.blueAPI.showNativeConfirmation or ConfirmationDialog instead of window.confirm / confirm.',
            },
            {
              name: 'prompt',
              message: 'Use an in-app text prompt dialog instead of window.prompt / prompt.',
            },
            {
              name: 'alert',
              message:
                'Use toast notifications or ConfirmationDialog instead of window.alert / alert.',
            },
          ],
          'blue/no-browser-dialogs': 'error',
          'blue/no-direct-show-message-box': 'error',
        },
      },
      {
        files: ['packages/blue-app/src/renderer/**/*.{ts,tsx}'],
        rules: {
          'blue/no-classname-string-concat': 'error',
        },
      },
      {
        files: [
          'packages/blue-app/src/main/native-confirmation.ts',
          'packages/**/*.test.{ts,tsx}',
          'packages/**/tests/**/*.{ts,tsx}',
          'packages/**/test/**/*.{ts,tsx}',
          'packages/**/testing/**/*.{ts,tsx}',
        ],
        rules: {
          'no-restricted-globals': 'off',
          'blue/no-browser-dialogs': 'off',
          'blue/no-direct-show-message-box': 'off',
          'blue/no-classname-string-concat': 'off',
        },
      },
    ],
  },
});
