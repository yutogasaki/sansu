import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

export const EPOCH = Date.parse('2026-10-05T03:00:00Z');
export const SCHEMA = 'sansu-growing-fixtures-v1';
export const stableJSON = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
export const hash = value => createHash('sha256').update(value).digest('hex');

export async function loadDomain(root = process.cwd()) {
    const compiled = await build({ stdin: { contents: `
        export { newIsland } from './src/domain/growingIsland/island.ts';
        export { applyIntent } from './src/domain/growingIsland/commands.ts';
        export { refreshUnlocks } from './src/domain/growingIsland/community.ts';
        export { landCells, occupant, key, reachableFromHome, isReachable, bridgeSite } from './src/domain/growingIsland/space.ts';
        export { RULES } from './src/domain/growingIsland/rules.ts';
        export { createInitialProfile } from './src/domain/user/profile.ts';
    `, resolveDir: root }, absWorkingDir: root, preserveSymlinks: true,
    bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
    const files = [...Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>'), 'package-lock.json'].sort();
    const roots = await Promise.all(['src', 'node_modules'].map(async name => [name, await fs.realpath(path.join(root, name))]));
    const sources = Object.fromEntries(await Promise.all(files.map(async file => {
        const actual = await fs.realpath(path.resolve(root, file));
        let key = file === 'package-lock.json' ? file : undefined;
        for (const [name, directory] of roots) {
            const relative = path.relative(directory, actual);
            if (!relative.startsWith('..') && !path.isAbsolute(relative)) key = `${name}/${relative.split(path.sep).join('/')}`;
        }
        assert(key, `Unexpected fixture source: ${file}`);
        return [key, hash(await fs.readFile(actual))];
    })));
    const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    return { domain, sources, sourceHash: hash(stableJSON(sources)) };
}

function fixedDates(value) {
    if (typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value)) return new Date(EPOCH).toISOString();
    if (Array.isArray(value)) return value.map(fixedDates);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fixedDates(item)]));
    return value;
}

function makeCase(domain, id, name) {
    const profileId = `qa-fixed-growing-${id}-v1`;
    const profile = { ...fixedDates(domain.createInitialProfile(name, 1, 0, 1, 'math')), id: profileId, soundEnabled: false, hissanModeEnabled: false };
    let state = domain.newIsland(profileId, EPOCH), serial = 0;
    const command = value => { state = domain.applyIntent(state, { id: `qa-fixture-${id}-${serial++}`, command: value }).state; };
    command({ type: 'starter-guide', automatic: false });
    if (id !== 'starter') {
        command({ type: 'plant', kind: 'home', cell: { x: 1, z: 3 } });
        state.drops = 20000; // Explicit QA credit, with no invented learning completions.
        state.genki.best = 150; domain.refreshUnlocks(state);
        command({ type: 'expand', side: 'west' });
        if (id === 'crowded') {
            for (const side of ['east', 'south', 'west', 'east']) command({ type: 'expand', side });
        }
        const homeCount = id === 'crowded' ? 8 : 2;
        for (const cell of domain.landCells(state)) {
            if (state.plots.filter(plot => plot.kind === 'home').length === homeCount) break;
            try { command({ type: 'plant', kind: 'home', cell }); } catch { /* Retain domain collision/reachability checks. */ }
        }
        assert.equal(state.plots.length, homeCount);
        for (const plot of state.plots) Object.assign(plot, { stage: id === 'crowded' ? 3 : 1, builtAt: 0, stagedAt: 0, style: 'plain' });
        const prototype = state.villagers[0];
        state.villagers = Array.from({ length: id === 'crowded' ? 13 : 2 }, (_, index) => ({ ...structuredClone(prototype),
            id: `qa-friend-${index}`, name: `なかま${index + 1}`, home: state.plots[id === 'crowded' ? Math.floor(index / 2) : index].id,
            species: ['rabbit', 'otter', 'fox', 'duck'][index % 4], arrivedAt: index }));
        domain.refreshUnlocks(state);
        const kinds = ['flower', 'bench', 'water-bowl', 'sapling', 'planter', 'lantern'];
        const itemCount = id === 'crowded' ? 40 : 10;
        for (const cell of domain.landCells(state)) {
            if (state.plots.length + state.landmarks.length === itemCount) break;
            const kind = kinds[state.landmarks.length % kinds.length];
            const before = state;
            try {
                command({ type: 'place', kind, cell });
                const reached = domain.reachableFromHome(state);
                assert(state.plots.every(plot => domain.isReachable(plot.cell, reached)), 'Keep fixture homes reachable');
            } catch { state = before; /* Skip invalid cells using the real command. */ }
        }
        assert.equal(state.plots.length + state.landmarks.length, itemCount);
        for (const item of state.landmarks) if (item.kind === 'flower' || item.kind === 'sapling') {
            item.growth = item.kind === 'flower' ? 6 : 18;
            if (item.kind === 'sapling') item.maturedAt = 0;
        }
        if (id === 'crowded') { const x = domain.bridgeSite(state); assert.notEqual(x, undefined); command({ type: 'bridge-build', x }); }
        state.town = { clock: id === 'crowded' ? 240 : 48, bank: 0 };
        state.nature = { hours: 24, realAt: EPOCH, lastSpread: 6, lastMix: 4 };
        state.unopened = []; state.arrivals = [];
    }
    return { id, label: name, synthetic: true, conditions: id === 'starter' ? ['new owner, no answers']
        : ['synthetic credit/unlocks', 'explicit maturity/population/clock, no earned learning'], profile,
    island: { profileId, version: 3, revision: 0, createdAt: EPOCH, updatedAt: EPOCH, state } };
}

export function validatePack(pack, loaded) {
    assert.equal(pack.schema, SCHEMA); assert.equal(pack.synthetic, true); assert.equal(pack.epoch, EPOCH);
    assert.equal(pack.timezone, 'Asia/Tokyo');
    assert.equal(pack.sourceHash, loaded.sourceHash, 'Fixture domain/lock changed; regenerate the pack');
    assert.equal(hash(stableJSON(pack.sources)), pack.sourceHash, 'Fixture provenance hash mismatch');
    assert.equal(pack.payloadHash, hash(stableJSON(pack.cases)), 'Fixture payload hash mismatch');
    assert.deepEqual(pack.cases.map(item => item.id), ['starter', 'growing', 'crowded']);
    const { domain } = loaded;
    for (const item of pack.cases) {
        const { profile, island } = item, state = island.state;
        assert.equal(item.synthetic, true);
        assert.equal(profile.id, `qa-fixed-growing-${item.id}-v1`); assert.equal(island.profileId, profile.id);
        assert.equal(state.seed, profile.id); assert.equal(island.version, 3); assert.equal(state.rules, 'growing-island-v1');
        assert.deepEqual(state.learned, []); assert.deepEqual(profile.recentAttempts, []);
        assert.deepEqual(profile.mathSkills, {}); assert.deepEqual(profile.vocabWords, {});
        assert.equal(profile.todayCount, 0); assert.equal(profile.streak, 0); assert.equal(profile.lastStudyDate, '');
        assert.equal(profile.soundEnabled, false); assert.equal(state.town.bank, 0); assert.equal(state.nature.realAt, EPOCH);
        const cells = new Set(domain.landCells(state).map(domain.key)), reached = domain.reachableFromHome(state);
        const objects = [...state.plots, ...state.landmarks, ...state.keepsakes];
        assert.equal(new Set(objects.map(object => object.id)).size, objects.length);
        for (const object of objects) if (object.cell) {
            assert(cells.has(domain.key(object.cell)), 'Object outside land');
            assert.equal(domain.occupant(state, object.cell, object.id), undefined, 'Overlapping fixture objects');
            if (object.kind === 'home') assert(domain.isReachable(object.cell, reached), 'Unreachable fixture home');
        }
        assert.equal(new Set(state.villagers.map(person => person.id)).size, state.villagers.length);
        for (const home of state.plots.filter(plot => plot.kind === 'home')) {
            assert(state.villagers.filter(person => person.home === home.id).length <= domain.RULES.homeCapacity[home.stage], 'Fixture housing overflow');
        }
        for (const person of state.villagers) assert(state.plots.some(plot => plot.kind === 'home' && plot.id === person.home), 'Dangling fixture home');
    }
    return pack;
}

export async function makePack(root = process.cwd()) {
    const loaded = await loadDomain(root);
    const cases = [['starter', 'はじめの島'], ['growing', '育ち途中の島'], ['crowded', 'にぎわう島']].map(([id, label]) => makeCase(loaded.domain, id, label));
    return validatePack({ schema: SCHEMA, synthetic: true, epoch: EPOCH, timezone: 'Asia/Tokyo', sources: loaded.sources,
        sourceHash: loaded.sourceHash, payloadHash: hash(stableJSON(cases)), cases }, loaded);
}

export function ownedState(state) {
    return Object.fromEntries(['seed', 'plots', 'landmarks', 'keepsakes', 'villagers', 'land', 'bridge', 'drops', 'town', 'learned', 'unlocked'].map(key => [key, state[key]]));
}

export async function main(args = process.argv.slice(2)) {
    assert(args.length === 0 || args.length === 2 && args[0] === '--output-dir', 'Usage: npm run fixtures:growing -- [--output-dir NEW_DIRECTORY]');
    const output = path.resolve(args[1] ?? `output/growing-fixtures/pack-${randomUUID()}`);
    const pack = await makePack();
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.mkdir(output, { recursive: false });
    await fs.writeFile(path.join(output, 'fixtures.json'), `${JSON.stringify(pack, null, 2)}\n`);
    console.log(`Created explicit QA fixture pack: ${output}/fixtures.json\nPayload: ${pack.payloadHash}`);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
    await main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
