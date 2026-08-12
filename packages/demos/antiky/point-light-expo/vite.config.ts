import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';

const FLOOR_ASSETS = Object.freeze({
  'virtual:blackout-relay/forest-floor-diffuse': './assets/poly-haven/forest-floor/forest_floor_diff_1k.jpg',
  'virtual:blackout-relay/forest-floor-ao': './assets/poly-haven/forest-floor/forest_floor_ao_1k.jpg',
  'virtual:blackout-relay/forest-floor-roughness': './assets/poly-haven/forest-floor/forest_floor_rough_1k.jpg',
  // A second ground, blended over the first so the floor stops reading as one texture stretched
  // across the whole reliquary. Fetched and verified by
  // `packages/demos/scripts/install-poly-haven-material.mjs`.
  'virtual:blackout-relay/second-ground': './assets/poly-haven/forrest-ground-01/forrest-ground-01_diff_1k.jpg',
});

function bundledFloorAssets(): Plugin {
  return {
    name: 'blackout-relay-floor-assets',
    enforce: 'pre' as const,
    resolveId(source: string) {
      return source in FLOOR_ASSETS ? `\0${source}` : null;
    },
    load(id: string) {
      const sourceId = id.startsWith('\0') ? id.slice(1) : id;
      const assetPath = FLOOR_ASSETS[sourceId as keyof typeof FLOOR_ASSETS];
      if (assetPath === undefined) return null;
      const absolutePath = fileURLToPath(new URL(assetPath, import.meta.url));
      const referenceId = this.emitFile({
        type: 'asset',
        name: absolutePath.split('/').at(-1),
        source: readFileSync(absolutePath),
      });
      return `export default import.meta.ROLLUP_FILE_URL_${referenceId};`;
    },
  };
}

export default defineConfig({
  // Assets resolve against this module's own URL, not the site root. Vite's default base of '/'
  // emits `new URL("/assets/x.glb", import.meta.url)`, and a root-absolute path discards the base
  // URL's directory — which 404s wherever the demo is served from a subpath, as it is on the
  // website under /demo-builds/<slug>/.
  base: './',
  plugins: [bundledFloorAssets()],
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
