import { defineConfig } from 'vite-plus';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import electronRenderer from 'vite-plugin-electron-renderer';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'path';

// The Electron plugin bundles main/preload in every mode. In development it
// also provides HMR + hot restart; in production the single-file preload is
// required because sandboxed preload scripts cannot require local modules.
const projectRoot = resolve(import.meta.dirname);

export default defineConfig(({ command }) => ({
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
  },
  plugins: [
    tailwindcss(),
    react(),
    electron({
      main: {
        onstart({ startup }) {
          startup([projectRoot, '--no-sandbox'], { cwd: projectRoot });
        },
        entry: {
          main: resolve(projectRoot, 'src/main/main.ts'),
          'repository-worker': resolve(
            projectRoot,
            'src/main/unified-library/repository-worker.ts',
          ),
          'code-repository-worker': resolve(
            projectRoot,
            'src/main/code-repository/repository-worker.ts',
          ),
        },
        vite: {
          build: {
            outDir: resolve(projectRoot, 'dist/main'),
            rolldownOptions: {
              external: ['node:sqlite', 'zeromq', '@blue/engine-client', '@blue/data'],
            },
          },
        },
      },
      preload: {
        onstart({ reload }) {
          if (process.electronApp) {
            reload();
          }
        },
        input: resolve(projectRoot, 'src/preload/preload.ts'),
        vite: {
          build: {
            outDir: resolve(projectRoot, 'dist/preload'),
          },
        },
      },
    }),
    electronRenderer(),
  ],
  root: 'src/renderer',
  base: command === 'serve' ? '/' : './',
  build: {
    outDir: resolve(projectRoot, 'dist/renderer'),
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        main: resolve(projectRoot, 'src/renderer/index.html'),
        settings: resolve(projectRoot, 'src/renderer/settings.html'),
        effectEditor: resolve(projectRoot, 'src/renderer/effect-editor.html'),
        trackInstrumentEditor: resolve(projectRoot, 'src/renderer/track-instrument-editor.html'),
        about: resolve(projectRoot, 'src/renderer/about.html'),
        popout: resolve(projectRoot, 'src/renderer/popout.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src/renderer'),
    },
  },
  run: {
    tasks: {
      'build:deps': {
        command: 'node -e ""',
        dependsOn: ['engine:stage', '@blue/data#build', '@blue/engine-client#build'],
      },
      'build:ts:main': {
        command: 'tsc -p tsconfig.main.json',
        dependsOn: ['build:deps'],
      },
      'build:ts:preload': {
        command: 'tsc -p tsconfig.preload.json',
        dependsOn: ['build:deps'],
      },
      'build:ts:renderer': {
        command: 'tsc -p tsconfig.renderer.json',
        dependsOn: ['build:deps'],
      },
      'build:bundle': {
        command: 'vp build',
        dependsOn: ['build:deps'],
      },
      'build:all': {
        command: 'node -e ""',
        dependsOn: ['build:ts:main', 'build:ts:preload', 'build:ts:renderer', 'build:bundle'],
      },
    },
  },
}));
