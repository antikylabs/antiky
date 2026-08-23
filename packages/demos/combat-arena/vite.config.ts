import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  // Assets resolve against this module's own URL, not the site root. Vite's default base of '/'
  // emits `new URL("/assets/x.glb", import.meta.url)`, and a root-absolute path discards the base
  // URL's directory — which 404s wherever the demo is served from a subpath, as it is on the
  // website under /demo-builds/<slug>/.
  base: './',
  publicDir: false,
  build: {
    assetsInlineLimit: 0,
    emptyOutDir: true,
    target: 'es2022',
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('./src/game.ts', import.meta.url)),
      formats: ['es'],
      fileName: () => 'antiky.game.js',
    },
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash][extname]',
        chunkFileNames: 'chunks/[name]-[hash].js',
        entryFileNames: 'antiky.game.js',
      },
    },
  },
});
