import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function makeAuthoredFixture(root = process.cwd()) {
    const compiled = await build({ stdin: { contents: `
        export { newIsland } from './src/domain/growingIsland/island.ts';
        export { applyIntent } from './src/domain/growingIsland/commands.ts';
        export { UNLOCKS } from './src/domain/growingIsland/rules.ts';
        export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts';
        export { key, reachableFromHome, isReachable, occupant } from './src/domain/growingIsland/space.ts';
        export { derivePlaces } from './src/domain/growingIsland/places.ts';
    `, resolveDir: root }, bundle: true, platform: 'node', format: 'esm', write: false, metafile: true, logLevel: 'silent' });
    const sources = Object.fromEntries(await Promise.all([...Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>'), 'package-lock.json', 'tools/growing-authored-fixture.mjs'].sort().map(async file => [file, hash(await fs.readFile(path.resolve(root, file)))])));
    const d = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString('base64')}`);
    const worldBytes = await fs.readFile(path.join(root, 'docs/design/2026-10-11-authored-world-foundation/native05-world.json.gz'));
    const world = d.compileWorldDefinition(JSON.parse(gunzipSync(worldBytes).toString()));
    const epoch = Date.UTC(2026, 9, 11, 3);
    let state = d.newIsland('native05-authored-whole-diagnostic', epoch);
    state.landmarks = []; state.drops = 10000; state.unlocked = d.UNLOCKS.map(item => item.key); state.tutorial = 'done'; state.guidance.starter.automatic = false;
    state.nature = { hours: 216, realAt: epoch, lastSpread: 216, lastMix: 216 };
    // New explicit diagnostic; these coordinates never relocate a player's old save.
    const homes = [[3, 1, 'plain', 3], [4, 0, 'flower', 1], [2, -8, 'tree', 2], [1, -3, 'tree', 5],
        [9, -9, 'plain', 4], [7, -1, 'water', 6], [9, -1, 'water', 3], [12, 0, 'light', 2]];
    const ownership = [];
    const add = (type, kind, x, z, options = {}) => {
        const cell = { x, z }; assert(world.owns(cell), `${kind} has acquired site ${x},${z}`);
        state = d.applyIntent(state, { id: `authored-acquire-${ownership.length}`, command: { type, kind, cell } }, epoch, world).state;
        const owner = [...state.plots, ...state.landmarks].find(item => item.cell && d.key(item.cell) === d.key(cell));
        assert(owner?.kind === kind); Object.assign(owner, options); ownership.push({ id: owner.id, kind, cell });
    };
    for (const [x, z, style, roof] of homes) add('plant', 'home', x, z, { stage: 4, style, roof, builtAt: 0, stagedAt: 0 });
    add('plant', 'play', 8, 0, { stage: 1, style: 'plain', builtAt: 0, stagedAt: 0 });
    for (const [x, z] of [[3, -9], [4, -9], [3, -8], [4, -8], [2, -4], [2, -3]]) add('place', 'sapling', x, z, { growth: 18, maturedAt: 0 });
    for (const [x, z, color] of [[8, -4, 'red'], [9, -4, 'yellow'], [10, -4, 'blue'], [11, -4, 'red']]) add('place', 'flower', x, z, { growth: 6, color });
    for (const [kind, x, z] of [['water-bowl', 7, -3], ['water-bowl', 9, -3], ['water-bowl', 9, -2], ['water-channel', 8, -3], ['water-channel', 8, -2]]) add('place', kind, x, z, { growth: 18 });
    for (const [x, z] of [[5, -9], [10, -3], [12, -4]]) add('place', 'bench', x, z);
    const initialOwnership = structuredClone(ownership), relocations = [];
    // The initial inner bowl blocks the narrow approach. Rearrange the same
    // water and seat owners through normal move commands; never widen the floor.
    for (const [kind, fromX, fromZ, x, z] of [['water-bowl', 9, -3, 7, -4], ['water-channel', 8, -2, 9, -3],
        ['water-bowl', 9, -2, 8, -2], ['bench', 10, -3, 9, -2]]) {
        const owner = [...state.plots, ...state.landmarks].find(owner => owner.kind === kind && owner.cell?.x === fromX && owner.cell?.z === fromZ);
        assert(owner); const before = structuredClone(owner);
        state = d.applyIntent(state, { id: `authored-rearrange-${relocations.length}`, command: { type: 'move', id: owner.id, cell: { x, z } } }, epoch, world).state;
        const moved = [...state.plots, ...state.landmarks].find(owner => owner.id === before.id);
        assert.deepEqual(moved, { ...before, cell: { x, z } });
        ownership.find(owner => owner.id === before.id).cell = { x, z };
        relocations.push({ id: before.id, kind, from: before.cell, to: { x, z } });
    }
    state.unopened = []; state.arrivals = []; state.town.bank = 0;
    state.villagers = state.plots.filter(item => item.kind === 'home').map((home, i) => ({ id: `authored-friend-${i}`, name: `なかま${i + 1}`, home: home.id,
        species: ['rabbit', 'otter', 'fox', 'duck', 'squirrel', 'hedgehog', 'penguin', 'owl'][i], variant: { color: i % 4, accessory: i % 3, sparkle: false }, trait: i % 2 ? 'lively' : 'mellow', arrivedAt: 0 }));
    const reached = d.reachableFromHome(state, undefined, world);
    for (const owner of [...state.plots, ...state.landmarks]) if (owner.cell) {
        assert.equal(d.occupant(state, owner.cell, owner.id), undefined, `No duplicate ownership at ${d.key(owner.cell)}`);
        assert(d.isReachable(owner.cell, reached, world), `Owner ${owner.id} has a supported approach`);
    }
    assert.equal(ownership.length, 27);
    return { schema: 'sansu-authored-whole-diagnostic-v1', candidate: 'native05-authored-editable-m1-v1', synthetic: true, epoch,
        conditions: ['Explicit diagnostic credit, maturity, population and acquired world sites', 'Normal world-aware commands create each owner', 'No earned learning, natural growth, migration or player-save claim'],
        worldId: world.id, worldSha256: hash(worldBytes), sourceHash: hash(JSON.stringify(sources)), sources, initialOwnership, relocations, ownership, state,
        projection: { places: d.derivePlaces(state, world), reachableWalkingPoints: reached.size } };
}
export async function main(args = process.argv.slice(2)) {
    assert(args.length === 2 && args[0] === '--output', 'Usage: node tools/growing-authored-fixture.mjs --output NEW_FILE');
    const fixture = await makeAuthoredFixture(); await fs.writeFile(args[1], `${JSON.stringify(fixture, null, 2)}\n`, { flag: 'wx' });
    console.log(JSON.stringify({ file: args[1], candidate: fixture.candidate, owners: fixture.ownership.length, homes: fixture.state.plots.filter(item => item.kind === 'home').length,
        places: fixture.projection.places.map(place => [place.ruleId, place.stage, place.variant]), reachableWalkingPoints: fixture.projection.reachableWalkingPoints }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main().catch(error => { console.error(error.stack); process.exitCode = 1; });
