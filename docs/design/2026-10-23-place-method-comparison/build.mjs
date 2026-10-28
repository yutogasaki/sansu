import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Freeze the inputs and outputs of a local candidate build, including public
// assets. This is evidence for this experiment, not a release verifier.
const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const revision = process.argv[2];
if (!revision || !/^place-method-comparison-v\d+$/.test(revision)) throw Error('Pass an explicit candidate build revision');
const execute = promisify(execFile);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(folder) {
    return (await Promise.all((await readdir(folder, { withFileTypes: true })).map(entry => {
        const full = path.join(folder, entry.name);
        return entry.isDirectory() ? files(full) : [full];
    }))).flat();
}
const sources = [...await files(path.join(root, 'src')), ...await files(path.join(root, 'public'))];
for (const folder of [directory, path.join(root, 'docs/design/2026-10-22-place-strategy-trial')]) {
    sources.push(...(await readdir(folder)).filter(name => /\.(?:ts|tsx|mjs)$/.test(name) && !/(?:check|test)/.test(name)).map(name => path.join(folder, name)));
}
sources.push(...['vite.config.ts', 'package.json', 'package-lock.json', 'index.html'].map(file => path.join(root, file)));
sources.push(path.join(directory, 'evidence/expanded-fixture-v2.json'));
sources.push(path.join(directory, 'evidence/expanded-place-recipe-flower-flat-wide-fixture.json'));
sources.sort();
const fingerprint = async () => Object.fromEntries(await Promise.all(sources.map(async file => [path.relative(root, file), hash(await readFile(file))])));
const before = await fingerprint(), startedAt = new Date().toISOString();
let status = 'PASS', output = '';
try {
    const result = await execute(process.execPath, [path.join(root, 'node_modules/vite/bin/vite.js'), 'build', '--config', path.join(directory, 'vite.config.ts')], {
        cwd: root, timeout: 180_000, maxBuffer: 8 * 1024 * 1024,
        env: { ...process.env, SANSU_BUILD_REVISION: revision, VITE_ISLAND_ENABLED: 'true', VITE_ISLAND_LIFE_ENABLED: 'true' },
    });
    output = result.stdout + result.stderr;
} catch (error) { status = 'FAIL'; output = `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}`; }
const after = await fingerprint(), changedInputs = Object.keys(before).filter(file => before[file] !== after[file]);
if (changedInputs.length) status = 'STALE';
const target = '/private/tmp/sansu-place-method-comparison-build';
const artifacts = status === 'FAIL' ? {} : Object.fromEntries(await Promise.all((await files(target)).sort().map(async file => {
    const bytes = await readFile(file); return [path.relative(target, file), { bytes: bytes.length, sha256: hash(bytes) }];
})));
const manifest = { status, revision, startedAt, completedAt: new Date().toISOString(), node: process.version,
    scope: 'Local Vite experiment. No production source rewrite, deployment or release acceptance.',
    flags: { island: true, life: true }, inputSHA256: hash(JSON.stringify(before)), inputHashes: before, changedInputs, artifacts };
await writeFile(path.join(directory, 'evidence', `build-${revision}.json`), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(directory, 'evidence', `build-${revision}.txt`), output);
console.log(JSON.stringify({ status, revision, changedInputs, inputSHA256: manifest.inputSHA256, outputFiles: Object.keys(artifacts).length }, null, 2));
if (status !== 'PASS') process.exitCode = 1;
