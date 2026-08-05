import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: fileURLToPath(new URL('../../website/public', import.meta.url)),
});
