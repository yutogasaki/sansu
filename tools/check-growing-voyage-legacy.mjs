import 'fake-indexeddb/auto';
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const oldRevision = process.env.SANSU_VOYAGE_OLD_REVISION ?? '882937581c46ec633a4e4663726385ad7e7a09f1';
const output = process.env.SANSU_VOYAGE_LEGACY_OUTPUT;
const browserUrl = process.env.SANSU_VOYAGE_LEGACY_BROWSER_URL;
assert(output, 'Specify a new SANSU_VOYAGE_LEGACY_OUTPUT file');
if (browserUrl) assert(['127.0.0.1', 'localhost'].includes(new URL(browserUrl).hostname), 'Use a disposable local origin');
const paths = ['src/domain/growingIsland/repository.ts', 'src/domain/user/repository.ts'];
const originals = Object.fromEntries(paths.map(path => [path, execFileSync('git', ['show', `${oldRevision}:${path}`], { encoding: 'utf8' })]));
const sha = value => createHash('sha256').update(value).digest('hex');

// Run the same explicit fixture with fake IDB or a disposable browser's real IDB.
// It tests compatibility boundaries; it does not simulate a real SW update.
async function exercise(old, current) {
    const check = (condition, message) => { if (!condition) throw new Error(message); };
    const rejects = async action => { try { await action(); } catch { return; } throw new Error('Legacy action unexpectedly succeeded'); };
    const previous = old.growingDb, db = current.growingDb;
    const result = {};
    try {
        const state = current.newIsland('child', 1000);
        await previous.islands.put({ profileId: 'child', version: 4, revision: 0, createdAt: 1000, updatedAt: 1000, state });
        await old.addMoment('child', new Blob(['original-photo']), 1, 1, 500, previous);
        previous.close();
        await db.open();
        check(await (await db.moments.toArray())[0].image.text() === 'original-photo', 'Migration lost the old photo bytes');
        for (const islandId of ['forest', 'main']) for (let i = 0; i < 60; i++)
            await current.addMoment('child', new Blob([`${islandId} ${i}`]), 1, 1, 1000 + i, db, islandId);
        const counts = async () => {
            const all = await db.moments.toArray();
            return { total: all.length, forest: all.filter(x => x.islandId === 'forest').length,
                main: all.filter(x => (x.islandId ?? 'main') === 'main').length };
        };
        result.photosBefore = await counts();
        check(result.photosBefore.total === 120, 'Expected 60 photographs per island');
        db.close(); await previous.open();
        await rejects(() => old.addMoment('child', new Blob(['old writer']), 1, 1, 3000, previous));
        previous.close(); await db.open();
        result.photosAfterOldWriter = await counts();
        check(JSON.stringify(result.photosBefore) === JSON.stringify(result.photosAfterOldWriter), 'Legacy retention changed the photographs');
        await db.archivedIslands.put({ profileId: 'child', islandId: 'forest', version: 4, revision: 0, createdAt: 1000, updatedAt: 1000, state });
        await current.nativeDb.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: { id: 'child', name: 'Child' } } });
        await current.nativeDb.profiles.put({ id: 'child', name: 'Child' });
        db.close(); await previous.open();
        await rejects(() => old.deleteProfile('child'));
        previous.close(); await db.open();
        result.oldDeletionRejected = true;
        check((await current.nativeDb.appData.get('app')).profiles.child && await current.nativeDb.profiles.get('child'), 'Legacy deletion removed the native owner');
        result.nativeOwnerRetained = true;
        result.remainingAfterOldOwnerDeletion = { active: await db.islands.count(), archived: await db.archivedIslands.count(), photos: await db.moments.count() };
        check(JSON.stringify(result.remainingAfterOldOwnerDeletion) === JSON.stringify({ active: 1, archived: 1, photos: 120 }), 'Legacy deletion partly removed the voyage data');
        await current.deleteProfile('child');
        check(await db.islands.count() === 0 && await db.archivedIslands.count() === 0 && await db.moments.count() === 0, 'Current deletion left growing data');
        check(!await current.nativeDb.profiles.get('child') && !(await current.nativeDb.appData.get('app')).profiles.child, 'Current deletion left the native owner');
        result.currentDeletionComplete = true;
        return result;
    } finally {
        previous.close(); await db.delete(); await current.nativeDb.delete();
    }
}
async function bundle(old) {
    const result = await build({ stdin: { contents: `
        export {growingDb,addMoment} from './src/domain/growingIsland/repository.ts';
        export {newIsland} from './src/domain/growingIsland/island.ts';
        export {db as nativeDb} from './src/db';
        export {deleteProfile} from './src/domain/user/repository.ts';
        export const exercise = ${exercise.toString()};`, resolveDir: process.cwd() },
        bundle: true, platform: browserUrl ? 'browser' : 'node', format: 'esm', write: false, logLevel: 'silent',
        define: { 'import.meta.env': JSON.stringify({ DEV: false, BASE_URL: '/' }), __LIFE_REPLAY_VERSION__: '"voyage-compatibility"', __APP_VERSION__: '"voyage-compatibility"' },
        plugins: old ? [{ name: 'actual-old-writers', setup(builder) {
            builder.onLoad({ filter: /\/src\/domain\/(growingIsland|user)\/repository\.ts$/ }, args => {
                const path = paths.find(path => args.path === `${process.cwd()}/${path}`);
                return path ? { contents: originals[path], loader: 'ts', resolveDir: args.path.slice(0, args.path.lastIndexOf('/')) } : undefined;
            });
        } }] : [],
    });
    return `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`;
}
const report = { at: new Date().toISOString(), oldRevision, oldHashes: Object.fromEntries(paths.map(path => [path, sha(originals[path])])),
    currentHashes: Object.fromEntries(await Promise.all(paths.map(async path => [path, sha(await fs.readFile(path))]))),
    scope: `Actual old repository and profile-deletion code with compatible current dependencies; ${browserUrl ? 'disposable Chromium real IndexedDB' : 'fake IndexedDB'}. Explicit fixtures, no personal data or two-build SW claim.`, pass: false };
let browser;
try {
    const urls = await Promise.all([bundle(true), bundle(false)]);
    if (browserUrl) {
        const { chromium } = await import('playwright');
        browser = await chromium.launch();
        const context = await browser.newContext();
        const page = await context.newPage();
        await page.route('**/__voyage_compatibility_host', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Compatibility fixture</title>' }));
        await page.goto(`${browserUrl}/__voyage_compatibility_host`);
        Object.assign(report, await page.evaluate(async urls => {
            const [old, current] = await Promise.all(urls.map(url => import(url)));
            return current.exercise(old, current);
        }, urls));
    } else {
        const [old, current] = await Promise.all(urls.map(url => import(url)));
        Object.assign(report, await exercise(old, current));
    }
    report.pass = true;
} catch (error) { report.error = error.stack?.replace(/data:text\/javascript;base64,[^\s)]+/g, '[bundled writer]'); process.exitCode = 1; }
finally {
    if (browser) await browser.close();
    report.qaHash = sha(await fs.readFile(new URL(import.meta.url)));
    await fs.writeFile(output, JSON.stringify(report, null, 2), { flag: 'wx' });
}
console.log(JSON.stringify(report, null, 2));
