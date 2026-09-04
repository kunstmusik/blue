import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.worktrees/**',
      '**/release/**',
      '**/coverage/**',
      '**/generated/**',
      '**/fixtures/**',
      '**/__fixtures__/**',
      '**/user-content/**',
    ],
  },
  {
    linterOptions: {
      reportUnusedDisableDirectives: 'error',
    },
  },
  // General TypeScript parsing
  {
    files: ['packages/**/*.{ts,tsx}'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
      'react-hooks': {
        rules: {
          'exhaustive-deps': {
            create() {
              return {};
            },
          },
        },
      },
    },
    languageOptions: {
      parser: tseslint.parser,
    },
  },
  // Production source files: ban browser dialog globals and properties.
  // Inline disables require a nearby comment explaining the host or fixture
  // boundary; the audited production tree currently has no such exception.
  {
    files: ['packages/blue-app/src/**/*.{ts,tsx}'],
    ignores: ['packages/blue-app/src/main/native-confirmation.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        {
          name: 'confirm',
          message: 'Use window.blueAPI.showNativeConfirmation or ConfirmationDialog instead of window.confirm / confirm.',
        },
        {
          name: 'prompt',
          message: 'Use an in-app text prompt dialog instead of window.prompt / prompt.',
        },
        {
          name: 'alert',
          message: 'Use toast notifications or ConfirmationDialog instead of window.alert / alert.',
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'window',
          property: 'confirm',
          message: 'Use window.blueAPI.showNativeConfirmation or ConfirmationDialog instead of window.confirm.',
        },
        {
          object: 'window',
          property: 'prompt',
          message: 'Use an in-app text prompt dialog instead of window.prompt.',
        },
        {
          object: 'window',
          property: 'alert',
          message: 'Use toast notifications or ConfirmationDialog instead of window.alert.',
        },
        {
          object: 'globalThis',
          property: 'confirm',
          message: 'Use window.blueAPI.showNativeConfirmation or ConfirmationDialog instead of globalThis.confirm.',
        },
        {
          object: 'globalThis',
          property: 'prompt',
          message: 'Use an in-app text prompt dialog instead of globalThis.prompt.',
        },
        {
          object: 'globalThis',
          property: 'alert',
          message: 'Use toast notifications or ConfirmationDialog instead of globalThis.alert.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='showMessageBox']",
          message: 'Use showNativeConfirmation from packages/blue-app/src/main/native-confirmation.ts instead of calling showMessageBox directly.',
        },
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='showMessageBoxSync']",
          message: 'Use showNativeConfirmation from packages/blue-app/src/main/native-confirmation.ts instead of calling showMessageBoxSync directly.',
        },
      ],
    },
  },
  // Main process restriction on dialog.showMessageBox (except native-confirmation.ts)
  {
    files: ['packages/blue-app/src/main/**/*.ts'],
    ignores: ['packages/blue-app/src/main/native-confirmation.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'dialog',
          property: 'showMessageBox',
          message: 'Use showNativeConfirmation from packages/blue-app/src/main/native-confirmation.ts instead of dialog.showMessageBox directly.',
        },
        {
          object: 'dialog',
          property: 'showMessageBoxSync',
          message: 'Use showNativeConfirmation from packages/blue-app/src/main/native-confirmation.ts instead of dialog.showMessageBoxSync directly.',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='showMessageBox']",
          message: 'Use showNativeConfirmation from packages/blue-app/src/main/native-confirmation.ts instead of calling showMessageBox directly.',
        },
        {
          selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='showMessageBoxSync']",
          message: 'Use showNativeConfirmation from packages/blue-app/src/main/native-confirmation.ts instead of calling showMessageBoxSync directly.',
        },
      ],
    },
  },
  // Renderer restriction on hand-rolled className template literals and array joins
  {
    files: ['packages/blue-app/src/renderer/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "JSXAttribute[name.name='className'] > JSXExpressionContainer > TemplateLiteral",
          message: 'Use cn() from src/renderer/lib/cn.ts instead of template literals for className.',
        },
        {
          selector: "JSXAttribute[name.name='className'] JSXExpressionContainer CallExpression[callee.property.name='join']",
          message: 'Use cn() from src/renderer/lib/cn.ts instead of array join for className.',
        },
      ],
    },
  },
  // Test files exception: allow mocking/asserting globals and properties in tests
  {
    files: [
      'packages/**/*.test.{ts,tsx}',
      'packages/**/tests/**/*.{ts,tsx}',
      'packages/**/test/**/*.{ts,tsx}',
      'packages/**/testing/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-globals': 'off',
      'no-restricted-properties': 'off',
      'no-restricted-syntax': 'off',
    },
  },
);
