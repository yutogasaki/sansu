import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { assertJourney, buildArchiveFiles, copyCandidate, digestFiles, executeSteps, growingEnvironment, main, previewURL } from './verify-growing.mjs';

const dirs = [];
async function temporary() {
    const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'sansu-growing-runner-test-'));
    dirs.push(directory); return directory;
}
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => fs.rm(dir, { recursive: true, force: true }))); });

describe('Growing verification candidate boundary', () => {
    it('removes inherited release/preview settings and pins the production candidate', () => {
        const env = growingEnvironment({ PATH: '/bin', NODE_ENV: 'production', VITE_GROWING_ISLAND_ENABLED: 'false',
            VITE_ISLAND_LIFE_PREVIEW: 'true', VITE_OTHER_EXPERIMENT: 'true',
            SANSU_GUIDANCE_PRODUCTION_URL: 'https://production.example', SANSU_BUILD_REVISION: 'stale' }, 'candidate');
        expect(env.PATH).toBe('/bin');
        expect(env.VITE_GROWING_ISLAND_ENABLED).toBe('true');
        expect(env.VITE_ISLAND_LIFE_PREVIEW).toBe('false');
        expect(env.SANSU_BUILD_REVISION).toBe('candidate');
        expect(env).not.toHaveProperty('SANSU_GUIDANCE_PRODUCTION_URL');
        expect(env).not.toHaveProperty('VITE_OTHER_EXPERIMENT');
        expect(env).not.toHaveProperty('NODE_ENV');
    });

    it('copies working contents independently and retains deterministic input hashes', async () => {
        const source = await temporary(), target = await temporary();
        await fs.writeFile(path.join(source, 'app.ts'), 'before');
        const input = await digestFiles(source, ['app.ts', 'app.ts']);
        await copyCandidate(source, target, ['app.ts'], input);
        await fs.writeFile(path.join(source, 'app.ts'), 'after');
        expect(await digestFiles(target, ['app.ts'])).toEqual(input);
        expect(await digestFiles(source, ['app.ts'])).not.toEqual(input);
    });

    it('retains manifests imported by the source while omitting unshipped authoring meshes', () => {
        const manifest = 'assets/pipeline/island-design-v2/runtime-manifest.json';
        expect(buildArchiveFiles(['vite.config.ts', 'src/prototypes/assetLab/main.ts', manifest,
            'assets/pipeline/island-design-v2/raw/model.glb', 'docs/design/screenshot.png']))
            .toEqual(['vite.config.ts', 'src/prototypes/assetLab/main.ts', manifest]);
    });

    it('rejects source changes between fingerprint and copy', async () => {
        const source = await temporary(), target = await temporary();
        await fs.writeFile(path.join(source, 'app.ts'), 'before');
        const input = await digestFiles(source, ['app.ts']);
        await fs.writeFile(path.join(source, 'app.ts'), 'after');
        await expect(copyCandidate(source, target, ['app.ts'], input)).rejects.toThrow('Source changed');
    });

    it('rejects symlinks that escape the fixed source boundary', async () => {
        const source = await temporary(), target = await temporary();
        await fs.writeFile(path.join(source, 'live.ts'), 'live');
        await fs.symlink(path.join(source, 'live.ts'), path.join(source, 'app.ts'));
        await expect(copyCandidate(source, target, ['app.ts'], await digestFiles(source, ['app.ts']))).rejects.toThrow('regular file');
    });

    it('stops at the first error and does not mark later checks as passed', async () => {
        const steps = ['core', 'journey', 'update'].map(id => ({ id, status: 'NOT_RUN' }));
        const started = [];
        await expect(executeSteps(steps, async step => {
            started.push(step.id); if (step.id === 'journey') throw Error('save failed');
        })).rejects.toThrow('save failed');
        expect(started).toEqual(['core', 'journey']);
        expect(steps.map(s => s.status)).toEqual(['PASS', 'FAIL', 'NOT_RUN']);
    });

    it('does not overwrite existing output evidence', async () => {
        const output = await temporary();
        await fs.writeFile(path.join(output, 'report.json'), 'original');
        await expect(main(['--output-dir', output])).rejects.toThrow();
        expect(await fs.readFile(path.join(output, 'report.json'), 'utf8')).toBe('original');
    });

    it('waits for asynchronous preview log creation without failing on ENOENT', async () => {
        let attempts = 0;
        expect(await previewURL(async () => {
            if (++attempts === 1) throw Object.assign(Error('not opened yet'), { code: 'ENOENT' });
            return 'Local: http://127.0.0.1:49123/';
        })).toBe('http://127.0.0.1:49123');
    });

    it('preserves real preview errors and rejects missing readiness', async () => {
        await expect(previewURL(async () => { throw Error('server exited'); })).rejects.toThrow('server exited');
        await expect(previewURL(async () => '', 10)).rejects.toThrow('did not start');
    });
});

describe('Growing journey evidence', () => {
    const version = { revision: 'candidate', version: 'candidate:uuid' };
    const evidence = () => ({ pass: true, version,
        scenarios: [{ viewport: { width: 390 }, pass: true }, { viewport: { width: 768 }, pass: true }],
        captures: [390, 768].map(width => ({ file: `${width}-island.png`, appRoot: { revision: 'candidate', version: 'candidate:uuid', islandFeatureEnabled: true, natureTownFeatureEnabled: false }, world: { growingFeatureEnabled: 'true', visualCandidate: 'growing-island-v1' } })),
    });
    it('accepts both rendered viewport scenarios of the matching build', () => {
        expect(() => assertJourney(evidence(), version)).not.toThrow();
    });
    it.each(['pass', 'version', 'viewport', 'identity', 'runtime-version', 'flag', 'missing-screen'])('rejects a false PASS caused by %s', reason => {
        const report = evidence();
        if (reason === 'pass') report.pass = false;
        if (reason === 'version') report.version = { ...version, version: 'stale' };
        if (reason === 'viewport') report.scenarios.pop();
        if (reason === 'identity') report.captures[0].world.growingFeatureEnabled = 'false';
        if (reason === 'runtime-version') report.captures[0].appRoot.version = 'stale';
        if (reason === 'flag') report.captures[0].appRoot.islandFeatureEnabled = false;
        if (reason === 'missing-screen') report.captures.pop();
        expect(() => assertJourney(report, version)).toThrow();
    });
});
