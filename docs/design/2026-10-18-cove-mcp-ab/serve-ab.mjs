import { createServer } from 'vite';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const folder = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(folder, '../../..');
const candidate = process.argv.includes('--variant');
process.env.VITE_ISLAND_ENABLED = 'true';
process.env.VITE_ISLAND_LIFE_ENABLED = 'true';
process.env.SANSU_BUILD_REVISION = candidate ? 'mcp-cove-ab-variant-v1' : 'mcp-cove-ab-baseline-v1';
const sourceDir = path.resolve(root, 'docs/design/2026-10-12-authored-cove-entrance');
const mappings = new Map([
  [path.join(sourceDir, 'cove-delivery-manifest.json'), 'delivery-variant.json'],
  [path.join(sourceDir, 'source-manifest.json'), 'source-variant.json'],
  [path.join(sourceDir, 'shared-apron-world-patch-v1.json'), 'patch-variant.json'],
]);
const server = await createServer({
  root, configFile: path.join(root, 'vite.config.ts'),
  server: { host: '127.0.0.1', port: candidate ? 8252 : 8251, strictPort: true, open: false },
  plugins: candidate ? [{
    name: 'mcp-cove-diagnostic-only', enforce: 'pre',
    load(id) {
      const match = mappings.get(id.split('?')[0]);
      if (match) return readFileSync(path.join(folder, match), 'utf8');
    },
    configureServer(vite) {
      vite.middlewares.use((request, response, next) => {
        if (request.url?.split('?')[0] !== '/prototypes/place-qa/native-cove-corner.glb.gz') return next();
        response.setHeader('Content-Type', 'application/gzip');
        response.setHeader('Cache-Control', 'no-store');
        response.end(readFileSync(path.join(folder, 'cove-roof-variant.glb.gz')));
      });
    },
  }] : [],
});
await server.listen();
server.printUrls();
