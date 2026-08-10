import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import electronRenderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

// The Electron plugin bundles main/preload in every mode. In development it
// also provides HMR + hot restart; in production the single-file preload is
// required because sandboxed preload scripts cannot require local modules.
const projectRoot = resolve(__dirname);

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    electron({
      main: {
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
            rollupOptions: {
              external: ['node:sqlite', 'zeromq', '@blue/engine-client', '@blue/data'],
            },
          },
        },
      },
      preload: {
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
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'src/renderer/index.html'),
        settings: resolve(projectRoot, 'src/renderer/settings.html'),
        effectEditor: resolve(projectRoot, 'src/renderer/effect-editor.html'),
        trackInstrumentEditor: resolve(
          projectRoot,
          'src/renderer/track-instrument-editor.html',
        ),
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
}));
