import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import { chromium } from 'playwright';
import { ISLAND_CANDIDATE, runtimeMetadata } from './island-e2e-helpers.mjs';
import { verifyIslandProgression } from './island-e2e-progression.mjs';

const target = process.env.SANSU_ISLAND_PRODUCTION_URL;
const manifestPath = process.env.SANSU_ISLAND_BUILD_SOURCE;
const out = process.env.SANSU_ISLAND_OUTPUT;
assert(target && manifestPath && out, 'Set immutable production target, build source manifest and fresh output directory');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const source = JSON.parse(await fs.readFile(manifestPath));
const qa = ['tools/e2e-island-living.mjs', 'tools/island-e2e-progression.mjs', 'tools/island-e2e-helpers.mjs', 'tools/island-learning-checks.mjs', 'tools/island-learning-fixtures.mjs'];
const fingerprint = async () => Promise.all([...new Set([...source.files.map(file => file.path), ...qa])].sort()
    .map(async path => ({ path, sha256: sha(await fs.readFile(path)) })));
const start = await fingerprint();
assert.deepEqual(source.files.filter(file => start.find(actual => actual.path === file.path)?.sha256 !== file.sha256), []);
await fs.mkdir(out, { recursive: true });
await assert.rejects(fs.readFile(`${out}/report.json`), { code: 'ENOENT' });
const version = await (await fetch(`${target}/version.json`, { cache: 'no-store' })).json();
assert.equal(version.revision, source.revision); assert(version.island.enabled);
assert.equal(version.island.candidate, ISLAND_CANDIDATE);
const report = { target, version, sourceHash: source.sourceHash, manifestPath, startedAt: new Date().toISOString(),
    humanN: 0, pass: false, sourceStart: sha(JSON.stringify(start)), captures: [],
    scope: 'Actual empty-database setup and 25 normal learning sections on each viewport. No profile, growth, clock or discovery injection. Author/Chromium evidence, not child observation.' };
const browser = await chromium.launch(process.env.SANSU_ISLAND_BROWSER_GPU === 'metal' ? { args: ['--use-angle=metal'] } : {});
try {
    report.results = await verifyIslandProgression(browser, target, async (page, name) => {
        await page.waitForTimeout(850);
        const metadata = await runtimeMetadata(page);
        assert.equal(metadata.revision, version.revision); assert.equal(metadata.version, version.version);
        assert.equal(metadata.candidate, ISLAND_CANDIDATE);
        const file = `${name}.png`, bytes = await page.screenshot({ path: `${out}/${file}`, animations: 'disabled', fullPage: true });
        report.captures.push({ file, sha256: sha(bytes), ...metadata });
    }, { production: true });
    assert.deepEqual(await fingerprint(), start, 'Application and QA inputs stay fixed through the production run');
    report.pass = true;
} finally {
    report.completedAt = new Date().toISOString(); await browser.close();
    report.browserClosed = true; await fs.writeFile(`${out}/report.json`, JSON.stringify(report, null, 2));
}
