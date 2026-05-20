import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import path from 'node:path';

// Vite + Electron integration. The renderer is just a Vite app;
// the main + preload processes are bundled separately via vite-plugin-electron.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@electron': path.resolve(__dirname, './electron'),
    },
    // Prefer the `"source"` condition so @volt/shared is bundled from raw TS.
    // The compiled CJS uses runtime `__exportStar(require(...))` which Rollup
    // can't statically analyze; reading the source bypasses that.
    conditions: ['source', 'module', 'browser', 'development', 'production'],
  },
  plugins: [
    react(),
    electron([
      {
        // Main process
        entry: 'electron/main.ts',
        vite: {
          resolve: {
            conditions: ['source', 'module', 'node', 'default'],
          },
          build: {
            outDir: 'dist-electron',
            sourcemap: true,
            rollupOptions: {
              // Native modules must be external.
              external: ['electron', 'better-sqlite3', 'keytar'],
            },
          },
        },
      },
      {
        // Preload script — must NOT externalize @volt/shared. Sandboxed preload
        // scripts can't use require() at runtime, so all deps must be bundled.
        entry: 'electron/preload.ts',
        vite: {
          resolve: {
            conditions: ['source', 'module', 'browser', 'default'],
          },
          build: {
            outDir: 'dist-electron',
            sourcemap: true,
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  build: {
    // Renderer bundle goes here; loaded by Electron in production
    outDir: 'dist',
    // Performance budget: warn if initial chunk > 1 MB
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Lazy-loadable chunks: editor, charts, etc.
          codemirror: ['@uiw/react-codemirror', '@codemirror/lang-json', '@codemirror/lang-javascript', '@codemirror/lang-xml', '@codemirror/lang-html'],
          radix: [
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-popover',
            '@radix-ui/react-tabs',
            '@radix-ui/react-tooltip',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
});
