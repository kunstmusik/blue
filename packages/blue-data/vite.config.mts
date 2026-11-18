import { defineConfig } from 'vite-plus';

export default defineConfig({
  run: {
    tasks: {
      'build:all': {
        command: 'node -e ""',
        dependsOn: ['build:esm', 'build:cjs'],
      },
    },
  },
});
