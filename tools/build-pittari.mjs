import { build } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { Script } from 'node:vm';

const sources = ['prototypes/pittari/index.html', ...['main.ts', 'view.ts', 'style.css', 'engine.ts', 'boards.ts', 'state.ts'].map(name => `src/prototypes/pittari/${name}`)];
const hash = createHash('sha256');
for (const path of sources) hash.update(await readFile(path));
const revision = `${execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()}-pittari-${hash.digest('hex').slice(0, 12)}`;
const out = 'output/pittari';
await mkdir(out, { recursive: true });
const result = await build({ configFile: false, define: { __BUILD_REVISION__: JSON.stringify(revision) },
    build: { write: false, minify: true, rollupOptions: { input: 'prototypes/pittari/index.html', output: { inlineDynamicImports: true } } } });
const outputs = (Array.isArray(result) ? result : [result]).flatMap(bundle => bundle.output);
let html = outputs.find(file => file.fileName.endsWith('.html')).source.toString();
const css = outputs.filter(file => file.type === 'asset' && file.fileName.endsWith('.css')).map(file => file.source.toString()).join('\n');
const js = outputs.filter(file => file.type === 'chunk').map(file => file.code).join('\n');
html = html.replace(/<script\b[^>]*src="[^"]+"[^>]*><\/script>/g, '')
    .replace(/<link\b[^>]*href="[^"]+\.css"[^>]*>/g, '')
    .replace('</head>', () => `<style>${css}</style></head>`)
    .replace('</body>', () => `<script>${js.replaceAll('</script', '<\\/script')}</script></body>`);
// Replacement strings interpret $& in minified identifiers; validate the exact embedded output.
new Script(html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>')));
await writeFile(`${out}/pittari_chain.html`, html);
await writeFile(`${out}/build.json`, JSON.stringify({ revision, candidate: 'pittari-positive-v1', delivery: 'standalone-prototype', bytes: Buffer.byteLength(html), sources }, null, 2));
console.log(`Pittari standalone: ${out}/pittari_chain.html (${Buffer.byteLength(html)} bytes), ${revision}`);
