import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { EPOCH, hash, stableJSON } from './growing-fixture-data.mjs';

export const PLACE_FIXTURE_SCHEMA = 'sansu-growing-place-fixtures-v1';
export async function loadPlaceDomain(root = process.cwd()) {
    const compiled = await build({ stdin: { contents: `
        export { newIsland } from './src/domain/growingIsland/island.ts';
        export { applyIntent } from './src/domain/growingIsland/commands.ts';
        export { refreshUnlocks } from './src/domain/growingIsland/community.ts';
        export { landCells, occupant, key, reachableFromHome, isReachable } from './src/domain/growingIsland/space.ts';
        export { derivePlaces } from './src/domain/growingIsland/places.ts';
        export { derivePlaceRelations } from './src/domain/growingIsland/placeRelations.ts';
        export { placeStatuses, syncPlaceMilestones, validatePlaceProgress } from './src/domain/growingIsland/placeGoals.ts';
        export { PLACE_CATALOG } from './src/domain/growingIsland/placeCatalog.ts';
        export { RULES, UNLOCKS } from './src/domain/growingIsland/rules.ts';
        export { createInitialProfile } from './src/domain/user/profile.ts';
    `, resolveDir: root }, absWorkingDir: root, preserveSymlinks: true, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
    const sources = Object.fromEntries(await Promise.all([...Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>'), 'package-lock.json'].sort()
        .map(async file => [path.relative(root, path.resolve(root, file)).split(path.sep).join('/'), hash(await fs.readFile(path.resolve(root, file)))])));
    const domain = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    return { domain, sources, sourceHash: hash(stableJSON(sources)) };
}

/** Explicit diagnostic credit, land, clocks and maturity. Nothing here is earned learning. */
function baseState(domain, id) {
    let state = domain.newIsland(id, EPOCH);
    state.drops = 10000;
    state.land = { expanded: 'east', extra: ['south'], capes: [], districts: ['east'] };
    state.unlocked = domain.UNLOCKS.map(item => item.key);
    state.tutorial = 'done';
    state.guidance.starter.automatic = false;
    state.nature = { hours: 24 * 9, realAt: EPOCH, lastSpread: 24 * 9, lastMix: 24 * 9 };
    for (const owned of state.landmarks.filter(owned => owned.cell)) state = domain.applyIntent(state, { id: `qa-store-${owned.id}`, command: { type: 'store', id: owned.id } }).state;
    return state;
}

export function addDiagnosticLayout(domain, initial, goalId, variantId, offset, prefix = goalId) {
    const goal = domain.PLACE_CATALOG.goals.find(goal => goal.id === goalId), layout = goal.variants.find(layout => layout.id === variantId);
    assert(layout, `${goalId}/${variantId} is a catalog layout`);
    let state = structuredClone(initial), serial = 0;
    const members = [];
    for (const item of layout.demo) {
        const input = goal.inputs.find(input => input.role === item.role);
        assert(input, `Unknown role ${item.role}`);
        const [type, kind] = input.kind.split(':'), cell = { x: item.x + offset.x, z: item.z + offset.z };
        try { state = domain.applyIntent(state, { id: `qa-${prefix}-${serial++}`, command: { type: type === 'plot' ? 'plant' : 'place', kind, cell } }).state; }
        catch (error) { throw Error(`${prefix}/${variantId}: ${kind} at ${cell.x},${cell.z}: ${error.message}`); }
        const owned = [...state.plots, ...state.landmarks].find(owned => owned.cell?.x === cell.x && owned.cell?.z === cell.z);
        assert(owned && owned.kind === kind);
        members.push(owned.id);
        if (kind === 'sapling') Object.assign(owned, { growth: 18, maturedAt: 0 });
        if (kind === 'flower') owned.growth = 6;
        if (type === 'plot') Object.assign(owned, { stage: kind === 'home' ? 2 : 1, builtAt: 0, stagedAt: 0, style: goalId === 'P02' && kind === 'home' ? 'tree' : 'plain' });
    }
    state.unopened = []; state.arrivals = [];
    return { state, members };
}

function nativeCase(domain, id, state, expected) {
    const fixedDates = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT/.test(value) ? new Date(EPOCH).toISOString()
        : Array.isArray(value) ? value.map(fixedDates) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, fixedDates(item)])) : value;
    const profile = { ...fixedDates(domain.createInitialProfile('配置の診断', 1, 0, 1, 'math')), id, soundEnabled: false };
    const homes = state.plots.filter(plot => plot.kind === 'home' && plot.cell), home = homes[0];
    state.villagers = expected.homes ? homes.map((home, i) => ({ id: `qa-${id}-friend-${i}`, name: `なかま${i + 1}`,
        species: ['rabbit', 'otter', 'fox', 'duck', 'squirrel', 'hedgehog', 'penguin', 'owl'][i], home: home.id,
        variant: { color: i % 4, accessory: i % 3, sparkle: false }, trait: i % 2 ? 'lively' : 'mellow', arrivedAt: 0 }))
        : [{ id: `qa-${id}-friend`, name: 'なかま', species: 'rabbit', home: home?.id ?? 'pokomoko',
            variant: { color: 0, accessory: 0, sparkle: false }, trait: 'mellow', arrivedAt: 0 }];
    domain.syncPlaceMilestones(state, EPOCH);
    const places = domain.derivePlaces(state), relations = domain.derivePlaceRelations(state, places);
    for (const entry of [...expected.places ?? [], ...expected.wholePlaces ?? []]) assert(places.some(place => place.ruleId === entry.ruleId && place.variant === entry.variant && place.stage === 'grown'), `${id}: ${entry.ruleId}/${entry.variant} must be physically ready`);
    if (expected.homes) assert.equal(homes.length, expected.homes, `${id}: all individually owned homes remain present`);
    for (const relation of expected.relations ?? []) assert(relations.some(value => value.id === relation), `${id}: ${relation} must use a real reachable path/environment`);
    const reached = domain.reachableFromHome(state);
    for (const owned of [...state.plots, ...state.landmarks]) if (owned.cell) {
        assert.equal(domain.occupant(state, owned.cell, owned.id), undefined, `${id}: no overlapping owners`);
        if (owned.kind === 'home') assert(domain.isReachable(owned.cell, reached), `${id}: homes stay reachable`);
    }
    domain.validatePlaceProgress(state.placeProgress);
    return { id, synthetic: true, expected, conditions: ['Explicit diagnostic credit/land/maturity/population', 'Normal domain purchase commands create individual ownership', 'No invented learning completion and no natural seven-day-growth claim',
        ...(expected.homeStage ? [`Whole-island final maturity diagnostic: every home is existing stage ${expected.homeStage}; individual layouts use minimum stage 2`] : [])], profile,
        island: { profileId: id, version: 4, revision: 0, createdAt: EPOCH, updatedAt: EPOCH, state },
        projection: { places, relations } };
}

export async function makePlacePack(root = process.cwd()) {
    const loaded = await loadPlaceDomain(root), { domain } = loaded, cases = [];
    for (const goal of domain.PLACE_CATALOG.goals.filter(goal => goal.id !== 'P06')) for (const layout of goal.variants) {
        const id = `qa-place-${goal.id.toLowerCase()}-${layout.id}-v1`;
        const offset = goal.id === 'P03' ? layout.id === 'tiered' ? { x: 6, z: 1 } : layout.id === 'shore' ? { x: 0, z: 3 } : { x: 0, z: 2 } : { x: 6, z: 1 };
        const built = addDiagnosticLayout(domain, baseState(domain, id), goal.id, layout.id, offset);
        cases.push(nativeCase(domain, id, built.state, { places: [{ ruleId: goal.id, variant: layout.id }] }));
    }
    const combinationLayouts = {
        C01: [['P01', 'lane', { x: 6, z: 1 }], ['P03', 'curve', { x: 6, z: 3 }]],
        C02: [['P03', 'curve', { x: 6, z: 1 }], ['P05', 'canopy', { x: 6, z: 4 }]],
        C03: [['P02', 'lane', { x: 6, z: 1 }], ['P04', 'lane', { x: 6, z: 3 }]],
        C04: [['P05', 'arch', { x: 6, z: 1 }], ['P04', 'lane', { x: 6, z: 4 }]],
    };
    for (const [combination, layouts] of Object.entries(combinationLayouts)) {
        const id = `qa-place-${combination.toLowerCase()}-v1`; let state = baseState(domain, id);
        for (const [goal, variant, offset] of layouts) state = addDiagnosticLayout(domain, state, goal, variant, offset, `${combination}-${goal}`).state;
        cases.push(nativeCase(domain, id, state, { relations: [combination] }));
    }
    const id = 'qa-place-whole-island-v1'; let whole = baseState(domain, id);
    whole.land.districts.push('east', 'south');
    for (const [goal, variant, offset] of [['P02', 'court', { x: 6, z: 1 }], ['P03', 'tiered', { x: 6, z: 6 }], ['P04', 'bay', { x: 0, z: 5 }], ['P05', 'court', { x: 11, z: 1 }]])
        whole = addDiagnosticLayout(domain, whole, goal, variant, offset, `whole-${goal}`).state;
    // Five additional individually owned homes join the tree home and two bay homes.
    // Maturity/styles/roofs are explicit diagnostics; learning or natural growth is not fabricated.
    for (const [i, [cell, style, roof]] of [[{ x: 1, z: 1 }, 'flower', 1], [{ x: 4, z: 1 }, 'light', 2],
        [{ x: 0, z: 4 }, 'water', 3], [{ x: 4, z: 4 }, 'plain', 5], [{ x: 13, z: 9 }, 'water', 6]].entries()) {
        whole = domain.applyIntent(whole, { id: `qa-whole-home-${i}`, command: { type: 'plant', kind: 'home', cell } }).state;
        const home = whole.plots.find(plot => plot.kind === 'home' && plot.cell.x === cell.x && plot.cell.z === cell.z);
        Object.assign(home, { stage: 2, builtAt: 0, stagedAt: 0, style, roof });
    }
    whole.unopened = []; whole.arrivals = [];
    // The whole-island art comparison shows the existing final two-storey homes.
    // The fifteen individual layouts keep their minimum stage-2 qualification.
    whole.plots.filter(plot => plot.kind === 'home').forEach(home => { home.stage = 4; });
    cases.push(nativeCase(domain, id, whole, { families: ['grove', 'spring', 'community', 'flowers'], homes: 8,
        homeStage: 4,
        wholePlaces: [{ ruleId: 'P02', variant: 'court' }, { ruleId: 'P03', variant: 'tiered' }, { ruleId: 'P04', variant: 'bay' }, { ruleId: 'P05', variant: 'court' }], realUseRequiredForP06: true }));
    return { schema: PLACE_FIXTURE_SCHEMA, synthetic: true, epoch: EPOCH, timezone: 'Asia/Tokyo', sourceHash: loaded.sourceHash, sources: loaded.sources,
        payloadHash: hash(stableJSON(cases)), cases };
}

export async function main(args = process.argv.slice(2)) {
    assert(args.length === 2 && args[0] === '--output', 'Usage: node tools/growing-place-fixtures.mjs --output NEW_FILE');
    const pack = await makePlacePack(); await fs.writeFile(args[1], `${JSON.stringify(pack, null, 2)}\n`, { flag: 'wx' });
    console.log(`Created ${pack.cases.length} explicit place diagnostics: ${args[1]}`);
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) await main().catch(error => { console.error(error.stack); process.exitCode = 1; });
