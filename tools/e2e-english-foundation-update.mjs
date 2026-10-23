import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { spawn } from 'node:child_process';
const oldDir = resolve(process.env.SANSU_FOUNDATION_OLD_DIR || '/tmp/sansu-foundation-final-dist');
const newDir = resolve(process.env.SANSU_FOUNDATION_NEW_DIR || '/tmp/sansu-foundation-final-dist-v2');
const oldVersion = JSON.parse(await readFile(`${oldDir}/version.json`, 'utf8'));
const newVersion = JSON.parse(await readFile(`${newDir}/version.json`, 'utf8'));
assert.notEqual(oldVersion.version, newVersion.version); assert(oldVersion.island.enabled && newVersion.island.enabled);
let deployed = oldDir;
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.woff2': 'font/woff2', '.webp': 'image/webp', '.png': 'image/png' };
const server = createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost');
    if (request.method === 'POST' && /^\/_qa\/deploy\/(old|new)$/.test(url.pathname)) { deployed = url.pathname.endsWith('old') ? oldDir : newDir; response.writeHead(204).end(); return; }
    const path = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    for (const root of path.startsWith('/assets/') ? [deployed, oldDir, newDir] : [deployed]) {
        const file = resolve(root, `.${path}`); if (!file.startsWith(`${root}/`)) { response.writeHead(403).end(); return; }
        try { const bytes = await readFile(file); response.writeHead(200, { 'Content-Type': mime[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); response.end(bytes); return; }
        catch { /* Try the retained content-hashed previous deployment asset. */ }
    }
    response.writeHead(404).end();
});
await new Promise(ok => server.listen(0, '127.0.0.1', ok));
const base = `http://127.0.0.1:${server.address().port}`;
try {
    await new Promise((ok, fail) => {
        const child = spawn(process.execPath, ['tools/e2e-english-foundation.mjs'], { stdio: 'inherit', env: { ...process.env, SANSU_FOUNDATION_URL: base, SANSU_FOUNDATION_UPDATE_CONTROL: `${base}/_qa/deploy`, SANSU_FOUNDATION_NEW_VERSION: newVersion.version } });
        child.on('error', fail); child.on('exit', code => code === 0 ? ok() : fail(new Error(`foundation update failed ${code}`)));
    });
} finally { await new Promise(ok => server.close(ok)); }
