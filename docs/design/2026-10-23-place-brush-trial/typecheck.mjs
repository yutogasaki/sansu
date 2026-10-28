/** TypeScript noEmit over the actual Vite-transformed candidate in a temp copy.
 * No product source is rewritten. esbuild/Vite bundling is not the type checker.
 * Keep the overlay and result under /private/tmp for independent inspection.
 */
import { cp, mkdir, mkdtemp, readFile, readdir, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { loadConfigFromFile } from 'vite';

const execute = promisify(execFile), directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..'), relative = path.relative(root, directory);
const timeoutMs = Number(process.env.SANSU_TRIAL_TIMEOUT_MS ?? 120_000);
if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 600_000) throw Error('Trial timeout must be 1000..600000 ms');
const overlay = await mkdtemp('/private/tmp/sansu-place-trial-types-');
const hash = source => createHash('sha256').update(source).digest('hex');
const transformedPaths = ['src/components/island/growing/placeSpringGeometry.ts', 'src/domain/growingIsland/places.ts', 'src/components/island/growing/placeFlowerGeometry.ts', 'src/components/island/growing/native/nativePlaceGrove.ts', 'src/components/island/growing/placePondGeometry.ts', 'src/components/island/growing/placePaths.ts', 'src/domain/growingIsland/types.ts', 'src/domain/growingIsland/syncProjection.ts', 'src/domain/growingIsland/worldDefinition.ts', 'src/domain/growingIsland/placeTerrain.ts', 'src/domain/growingIsland/editableTerrainWorld.ts', 'src/domain/growingIsland/terrainEditing.ts', 'src/domain/growingIsland/landscape.ts',
    'src/domain/growingIsland/commands.ts', 'src/components/island/growing/GrowingWorld.tsx',
    'src/components/island/growing/worldScene.ts', 'src/components/island/growing/GrowingIsland.tsx', 'src/components/island/growing/growingCamera.ts',
    ...['section-profile.ts', 'candidate.ts', 'comparison-camera.ts', 'ground.ts', 'TrialIsland.ts', 'TrialEvidence.tsx', 'TrialCadence.tsx', 'LiveUse.tsx'].map(name => `docs/design/2026-10-23-place-method-comparison/${name}`)];
const candidateFiles = (await readdir(directory)).filter(name => /\.(?:ts|tsx|mjs|json)$/.test(name));
const evidenceInputs = (await readdir(path.join(directory, 'evidence'))).filter(name => /\.json$/.test(name));
const watchedPaths = [...transformedPaths, ...candidateFiles.map(name => `${relative}/${name}`),
    ...evidenceInputs.map(name => `${relative}/evidence/${name}`),
    'docs/design/2026-10-22-place-strategy-trial/foundation.ts', 'docs/design/2026-10-22-place-strategy-trial/foundation-transform.mjs'];
const fingerprint = async () => Object.fromEntries(await Promise.all(watchedPaths.sort().map(async file => [file, hash(await readFile(path.join(root, file)))])));
const before = await fingerprint();

await cp(path.join(root, 'src'), path.join(overlay, 'src'), { recursive: true });
await mkdir(path.join(overlay, 'docs/design'), { recursive: true });
for (const entry of await readdir(root, { withFileTypes: true })) {
    if (['src', 'docs', '.git', '.agents', '.codex'].includes(entry.name)) continue;
    await symlink(path.join(root, entry.name), path.join(overlay, entry.name), entry.isDirectory() ? 'dir' : 'file');
}
for (const entry of await readdir(path.join(root, 'docs'), { withFileTypes: true })) {
    if (entry.name === 'design') continue;
    await symlink(path.join(root, 'docs', entry.name), path.join(overlay, 'docs', entry.name), entry.isDirectory() ? 'dir' : 'file');
}
for (const entry of await readdir(path.join(root, 'docs/design'), { withFileTypes: true })) {
    const from = path.join(root, 'docs/design', entry.name), to = path.join(overlay, 'docs/design', entry.name);
    if (entry.name === path.basename(directory) || ['2026-10-22-place-strategy-trial', '2026-10-23-place-method-comparison'].includes(entry.name)) {
        await cp(from, to, { recursive: true, filter: source => !source.split(path.sep).includes('evidence') || source.endsWith('evidence') || source.endsWith('.json') });
    } else await symlink(from, to, entry.isDirectory() ? 'dir' : 'file');
}

// Execute precisely the local experiment's Vite transform hook, including its
// guarded substitutions, rather than reproducing a second approximation here.
const loaded = await loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(directory, 'vite.config.ts'), root);
if (!loaded) throw Error('Comparison Vite config could not be loaded');
const plugins = (await Promise.all(loaded.config.plugins.flat(Infinity))).flat(Infinity);
const plugin = plugins.find(plugin => plugin && plugin.name === 'place-method-comparison');
const transform = typeof plugin?.transform === 'function' ? plugin.transform : plugin?.transform?.handler;
if (!transform) throw Error('Expected comparison transform was not found');
const transformations = [];
for (const file of transformedPaths) {
    const original = await readFile(path.join(overlay, file), 'utf8');
    const result = await transform.call({}, original, path.join(root, file));
    const code = typeof result === 'string' ? result : result?.code;
    if (!code || code === original) throw Error(`Expected transformed module missing: ${file}`);
    await writeFile(path.join(overlay, file), code);
    transformations.push({ path: file, inputSHA256: hash(original), transformedSHA256: hash(code) });
}

let status = 'PASS', output = '';
try {
    const result = await execute(process.execPath, [path.join(root, 'node_modules/typescript/bin/tsc'),
        '--project', path.join(overlay, relative, 'tsconfig.trial.json'), '--pretty', 'false'],
    { cwd: overlay, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 });
    output = result.stdout + result.stderr;
} catch (error) { status = 'FAIL'; output = `${error.stdout ?? ''}${error.stderr ?? ''}${error.message ?? ''}\n${JSON.stringify({ code: error.code, signal: error.signal, killed: error.killed, timeoutMs })}\n`; }
const after = await fingerprint();
const changedInputs = watchedPaths.filter(file => before[file] !== after[file]);
if (changedInputs.length) status = 'STALE';
const report = { status, date: new Date().toISOString(), node: process.version, overlay, timeoutMs,
    checker: 'TypeScript tsc --noEmit via tsconfig.trial.json; actual browser transform outputs',
    scope: 'Trial TS/TSX plus their production imports, transformed floor/domain/scene/UI; no build or test claim',
    inputHashes: before, changedInputs, transformations, output };
await writeFile(path.join(overlay, 'typecheck-result.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (status !== 'PASS') process.exitCode = 1;
