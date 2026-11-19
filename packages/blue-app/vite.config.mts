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
const electronArgs = [projectRoot, '--no-sandbox'];

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
        async onstart({ startup }) {
          await startup(electronArgs, { cwd: projectRoot });
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
        async onstart({ reload, startup }) {
          if (process.electronApp) {
            reload();
            return;
          }
          // The first launch uses the hook for whichever bundle finishes last.
          await startup(electronArgs, { cwd: projectRoot });
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
      'build:electron': {
        // Both TypeScript projects emit shared files. Bundle last so the app
        // starts with the sandbox-compatible preload on cold and warm builds.
        command: 'tsc -p tsconfig.main.json && tsc -p tsconfig.preload.json && vp build',
        cache: false,
        dependsOn: ['build:deps'],
      },
      'build:ts:host-tests': {
        command: 'tsc -p tsconfig.host-tests.json',
        dependsOn: ['build:deps'],
      },
      'build:ts:renderer': {
        command: 'tsc -p tsconfig.renderer.json',
        dependsOn: ['build:deps'],
      },
      'build:all': {
        command: 'node -e ""',
        dependsOn: ['build:electron', 'build:ts:host-tests', 'build:ts:renderer'],
      },
    },
  },
}));
