import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { hash, loadDomain, stableJSON, validatePack } from './growing-fixture-data.mjs';
import { readCapture, readRegular } from './growing-fixture-evidence.mjs';

export function parseOptions(args) {
    const options = {};
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        assert(['--before', '--after', '--fixtures', '--output-dir'].includes(key) && args[i + 1]
            && !args[i + 1].startsWith('--') && !options[key], 'Specify --before --after --fixtures --output-dir once each');
        options[key] = path.resolve(args[i + 1]);
    }
    assert.equal(Object.keys(options).length, 4, 'Specify --before --after --fixtures --output-dir');
    return { before: options['--before'], after: options['--after'], fixtures: options['--fixtures'], output: options['--output-dir'] };
}

const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const inside = (directory, file) => { const relative = path.relative(directory, file); return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)); };

async function resolvedOutput(file) {
    let ancestor = path.dirname(file);
    for (;;) {
        try { return path.resolve(await fs.realpath(ancestor), path.relative(ancestor, file)); }
        catch (error) { if (error.code !== 'ENOENT') throw error; ancestor = path.dirname(ancestor); }
    }
}

function html(report) {
    const identity = side => `<article><h2>${side === 'before' ? '変更前' : '変更後'}</h2><p>Revision: <code>${escape(report[side].version.revision)}</code><br>Version: <code>${escape(report[side].version.version)}</code><br>Target: ${escape(report[side].target)}</p><details><summary>配信・候補・検証コード</summary><pre>${escape(JSON.stringify(report[side], null, 2))}</pre></details></article>`;
    return `<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self'; style-src 'unsafe-inline'"><title>育つ島の固定データ比較</title><style>body{font-family:system-ui,sans-serif;margin:24px;color:#242832;background:#f4f5f7}main{max-width:1600px;margin:auto}header,.pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}article,figure{margin:0;padding:16px;background:white;border:1px solid #d9dde3;border-radius:8px}img{display:block;max-width:100%;max-height:800px;margin:auto}code,pre{overflow-wrap:anywhere;white-space:pre-wrap}h2{font-size:20px}section{margin-block:32px}figcaption{margin-bottom:12px}</style><main><h1>育つ島の固定データ比較</h1><p>合成QA保存・同じ条件の6組。比較整合性のみPASS。美術の魅力・理解/安全・公開は未評価。</p><p>固定日時: ${escape(new Date(report.conditions.epoch).toISOString())} / ${escape(report.conditions.timezone)} · 音OFF · Chromium · phone通常motion / tablet reduced motion</p><p>Payload: <code>${escape(report.payloadHash)}</code></p><header>${identity('before')}${identity('after')}</header>${report.pairs.map(item => `<section><h2>${escape(item.label)} · ${item.width}px · ${item.population}人 / ${item.objects}物</h2><div class="pair">${['before', 'after'].map(side => `<figure><figcaption>${side === 'before' ? '変更前' : '変更後'} · ${escape(item[side].candidate)}<br><small>SHA: ${escape(item[side].imageHash)}</small></figcaption><img src="${escape(item[side].file)}" alt="${escape(item.label)} ${side === 'before' ? '変更前' : '変更後'} ${item.width}px"></figure>`).join('')}</div></section>`).join('')}</main></html>`;
}

export async function main(args = process.argv.slice(2)) {
    const options = parseOptions(args), loaded = await loadDomain();
    const packBytes = await readRegular(options.fixtures), pack = validatePack(JSON.parse(packBytes), loaded);
    const before = await readCapture(options.before, pack), after = await readCapture(options.after, pack);
    assert.deepEqual(before.report.conditions, after.report.conditions);
    // Rendering candidates may change; delivery and feature choices must remain comparable.
    const features = report => ({ delivery: report.version.delivery, islandDelivery: report.version.island.delivery,
        life: Object.fromEntries(['enabled', 'discovery', 'fantasy', 'saveVersion'].map(key => [key, report.version.island.life?.[key]])) });
    assert.deepEqual(features(before.report), features(after.report), 'Different delivery/feature conditions');
    for (let index = 0; index < before.cases.length; index++) {
        const left = before.cases[index], right = after.cases[index];
        assert.equal(stableJSON(left.native.learning), stableJSON(right.native.learning), 'Learning evidence differs');
        assert.equal(left.metadata.serviceWorkerControlled, right.metadata.serviceWorkerControlled, 'Different service worker condition');
    }
    const output = await resolvedOutput(options.output);
    for (const source of [before.directory, after.directory, await fs.realpath(path.dirname(options.fixtures))]) {
        assert(!inside(source, output), 'Keep comparison outside input directories');
    }
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.mkdir(output, { recursive: false });
    const manifest = source => ({ target: source.report.target, version: source.report.version,
        reportHash: source.fingerprints[source.file], initialBuild: source.report.initialBuild, initialQA: source.report.initialQA });
    const report = { schema: 'sansu-growing-comparison-v1', pass: false, payloadHash: pack.payloadHash, sourceHash: pack.sourceHash,
        conditions: before.report.conditions, before: manifest(before), after: manifest(after), pairs: [],
        gates: { comparisonIntegrity: 'NOT_EVALUATED', visualAppeal: 'NOT_EVALUATED', comprehensionSafety: 'NOT_EVALUATED' },
        inputs: { ...before.fingerprints, ...after.fingerprints, [options.fixtures]: hash(packBytes) } };
    try {
        for (let index = 0; index < before.cases.length; index++) {
            const left = before.cases[index], right = after.cases[index];
            const pair = { id: left.id, label: pack.cases.find(item => item.id === left.id).label, width: left.width,
                objects: left.objects, population: left.population };
            for (const [side, item] of [['before', left], ['after', right]]) {
                const file = `${side}-${item.file}`, nativeFile = `${side}-${item.nativeFile}`;
                await fs.writeFile(path.join(output, file), item.image, { flag: 'wx' });
                await fs.writeFile(path.join(output, nativeFile), await readRegular(item.nativePath), { flag: 'wx' });
                pair[side] = { file, nativeFile, imageHash: item.imageHash, nativeHash: item.nativeHash,
                    candidate: item.visualCandidate, metadata: item.metadata };
            }
            report.pairs.push(pair);
        }
        for (const [file, fingerprint] of Object.entries(report.inputs)) assert.equal(hash(await readRegular(file)), fingerprint, 'Comparison input changed');
        for (const pair of report.pairs) for (const side of ['before', 'after']) {
            assert.equal(hash(await readRegular(path.join(output, pair[side].file))), pair[side].imageHash);
            assert.equal(hash(await readRegular(path.join(output, pair[side].nativeFile))), pair[side].nativeHash);
        }
        assert.equal((await loadDomain()).sourceHash, loaded.sourceHash, 'Fixture domain changed during comparison');
        report.pass = true; report.gates.comparisonIntegrity = 'PASS';
        await fs.writeFile(path.join(output, 'comparison.html'), html(report), { flag: 'wx' });
    } catch (error) {
        report.pass = false; report.gates.comparisonIntegrity = 'FAIL'; report.error = String(error.stack || error); throw error;
    } finally { await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2), { flag: 'wx' }); }
    console.log(`PASS comparison integrity: 6 pairs; ${output}/comparison.html`);
    return report;
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    await main().catch(error => { console.error(error.stack); process.exitCode = 1; });
}
