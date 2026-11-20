import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      'build:all': {
        command: [
          'node -e',
          `"const fs = require('node:fs');`,
          `fs.mkdirSync('dist/esm', { recursive: true });`,
          `fs.mkdirSync('dist/cjs', { recursive: true });`,
          `fs.writeFileSync('dist/esm/package.json', JSON.stringify({ type: 'module' }, null, 2) + '\\n');`,
          `fs.writeFileSync('dist/cjs/package.json', JSON.stringify({ type: 'commonjs' }, null, 2) + '\\n');"`,
        ].join(' '),
        dependsOn: ['build:esm', 'build:cjs'],
      },
    },
  },
});
