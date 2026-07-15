import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import electronRenderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

// Dev mode: use electron plugin for HMR + hot restart
// Production: only react + renderer plugin, output to dist/renderer
const isDev = process.env.APP_ENV === 'dev';
const projectRoot = resolve(__dirname);

export default defineConfig({
  plugins: [
    react(),
    ...(isDev
      ? [
          electron({
            main: {
              entry: {
                main: resolve(projectRoot, 'src/main/main.ts'),
                'repository-worker': resolve(
                  projectRoot,
                  'src/main/unified-library/repository-worker.ts',
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
        ]
      : []),
  ],
  root: 'src/renderer',
  base: isDev ? '/' : './',
  build: {
    outDir: resolve(projectRoot, 'dist/renderer'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'src/renderer/index.html'),
        settings: resolve(projectRoot, 'src/renderer/settings.html'),
        effectEditor: resolve(projectRoot, 'src/renderer/effect-editor.html'),
        popout: resolve(projectRoot, 'src/renderer/popout.html'),
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src/renderer'),
    },
  },
});
