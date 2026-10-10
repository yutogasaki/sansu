import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  base: './',
  server: {
    host: '127.0.0.1',
    port: 8241,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('../../../', import.meta.url))] },
  },
  build: { outDir: '/private/tmp/sansu-island-final-3d-build', emptyOutDir: true },
});
