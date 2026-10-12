import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const sha = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
const root = '/private/tmp/sansu-districts-c7/layouts';
const layout = process.argv[2];
const report = { layout, started: new Date().toISOString(), pass: false };
const start = Date.now();
async function main() {
    assert(['east-chain', 'north-chain', 'two-arms'].includes(layout));
    const require = createRequire(process.cwd() + '/package.json');
    const composerPath = 'src/domain/growingIsland/authoredDistrictWorld.ts';
    report.code = { composer: sha(readFileSync(composerPath)), compiler: sha(readFileSync('src/domain/growingIsland/worldDefinition.ts')) };
    const bundle = await require('esbuild').build({ stdin: { contents: "export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition.ts'; export { planAuthoredDistrict, availableAuthoredDistrictPorts } from './src/domain/growingIsland/authoredDistrictWorld.ts'; export { HOME_CELL } from './src/domain/growingIsland/space.ts';", resolveDir: process.cwd() }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'silent' });
    const bundlePath = `${root}/${layout}-bundle.mjs`;
    writeFileSync(bundlePath, bundle.outputFiles[0].text);
    const { compileWorldDefinition, planAuthoredDistrict, availableAuthoredDistrictPorts, HOME_CELL } = await import(bundlePath);
    const basePath = 'prototypes/place-qa/native05-world-source-shading.json.gz', kitPath = 'prototypes/place-qa/authored-district-kit.json.gz';
    const baseBytes = readFileSync(basePath), kitBytes = readFileSync(kitPath);
    const definition = JSON.parse(gunzipSync(baseBytes)), catalog = JSON.parse(gunzipSync(kitBytes));
    const statePath = 'prototypes/place-qa/authored-shoulder-reference-mature.json', stateBytes = readFileSync(statePath), state = JSON.parse(stateBytes).state;
    const ownerLedger = () => ({ plots: state.plots, landmarks: state.landmarks, keepsakes: state.keepsakes, villagers: state.villagers, nextId: state.nextId });
    const ownersBefore = sha(ownerLedger()), stateBefore = sha(state);
    report.inputs = { base: { path: basePath, sha256: sha(baseBytes), definitionSha256: sha(definition), revision: definition.revision ?? null },
        catalog: { path: kitPath, sha256: sha(kitBytes), candidate: catalog.candidate }, source: catalog.source,
        state: { path: statePath, artifactSha256: sha(stateBytes), stateSha256: stateBefore, ownerLedgerSha256: ownersBefore,
            counts: { plots: state.plots.length, landmarks: state.landmarks.length, keepsakes: state.keepsakes.length, villagers: state.villagers.length } } };
    assert.equal(sha(readFileSync(catalog.source.artifact)), catalog.source.sha256);
    const base = compileWorldDefinition(definition), baseSnapshot = sha(base.definition);
    assert.equal(base.sites.filter(site => site.placement).length, 73);
    const snapshot = world => ({ sites: new Map(world.sites.map(site => [JSON.stringify(site.ref), JSON.stringify(site)])),
        floors: new Map(world.definition.districts.flatMap(d => d.floors.map(f => [JSON.stringify([d.id, f.id]), sha(f)]))) });
    const retain = (before, after) => {
        const next = snapshot(after);
        for (const [key, value] of before.sites) assert.equal(next.sites.get(key), value, `prior anchor/support changed ${key}`);
        for (const [key, value] of before.floors) assert.equal(next.floors.get(key), value, `prior floor changed ${key}`);
        return { sites: before.sites.size, floors: before.floors.size };
    };
    const harbor = catalog.templates.find(t => t.id.includes('harbor')), hill = catalog.templates.find(t => t.id.includes('hill'));
    const basePort = name => { const p = catalog.basePorts.find(p => p.id === name); assert(p); return { districtId: p.districtId, portId: p.id }; };
    const firstChoice = { id: layout === 'two-arms' ? 'hill-1' : 'shore-1', templateId: layout === 'two-arms' ? hill.id : harbor.id,
        parent: basePort(layout === 'north-chain' ? 'north-entry' : 'east-entry') };
    let result = planAuthoredDistrict(base, catalog, [], firstChoice);
    const firstProof = { grant: result.grant, revision: result.world.definition.revision, bounds: result.world.bounds,
        placement: result.world.sites.filter(s => s.placement).length, retained: retain(snapshot(base), result.world) };
    let previous = snapshot(result.world), grants = result.grants;
    const remaining = availableAuthoredDistrictPorts(base, catalog, grants).find(p => p.districtId === 'shore-1');
    const secondChoice = { id: layout === 'two-arms' ? 'shore-1' : 'hill-1', templateId: layout === 'two-arms' ? harbor.id : hill.id,
        parent: layout === 'two-arms' ? basePort('north-entry') : { districtId: remaining.districtId, portId: remaining.id } };
    result = undefined; global.gc?.();
    result = planAuthoredDistrict(base, catalog, grants, secondChoice);
    const world = result.world;
    report.priorRetained = retain(previous, world); previous = undefined;
    const placed = world.sites.filter(site => site.placement), added = placed.filter(site => site.ref.districtId !== definition.districts[0].id);
    assert.equal(placed.length, 106); assert.equal(added.length, 33); assert.equal(result.grants.length, 2);
    const cellKey = cell => `${cell.x},${cell.z}`, reached = new Set([cellKey(HOME_CELL)]), queue = [HOME_CELL];
    assert(world.floorAt(HOME_CELL));
    for (let i = 0; i < queue.length; i++) for (const cell of world.neighbors(queue[i])) {
        const id = cellKey(cell); if (!reached.has(id)) { reached.add(id); queue.push(cell); }
    }
    for (const site of added) {
        assert(site.support, `no dry support at ${cellKey(site.cell)}`);
        const dry = world.floorAt(site.cell); assert(dry, `no current dry floor at ${cellKey(site.cell)}`);
        assert(Math.hypot(dry.point.x-site.support.point.x,dry.point.y-site.support.point.y,dry.point.z-site.support.point.z) < .025);
        assert(reached.has(cellKey(site.cell)), `unreachable new placement ${cellKey(site.cell)}`);
    }
    assert.equal(sha(base.definition), baseSnapshot); assert.equal(sha(state), stateBefore); assert.equal(sha(ownerLedger()), ownersBefore);
    assert.equal(sha(readFileSync(composerPath)), report.code.composer, 'composer changed during proof; rerun against stable source');
    report.first = firstProof; report.grants = result.grants; report.ledgerSha256 = sha(result.grants);
    report.final = { revision: world.definition.revision, definitionSha256: sha(world.definition), bounds: world.bounds, placements: placed.length,
        addedPlacements: added.length, sites: world.sites.length, reachableSitesFromHome: reached.size, reachableAddedPlacements: added.length,
        districts: world.definition.districts.map(d => ({ id: d.id, templateId: d.templateId, turn: d.turn, logicalOrigin: d.logicalOrigin, worldOrigin: d.worldOrigin,
            placement: d.sites.filter(s => s.placement).length })), baseUnmodified: true, stateUnmodified: true, ownerLedgerUnmodified: true };
    report.scope = 'Pure domain graph with actual native05 terrain assets; no owner obstruction, renderer, browser or visual-quality claim.';
    report.pass = true;
}
try { await main(); } catch (error) { report.failure = String(error.message ?? error).slice(0, 2000); process.exitCode = 1; }
report.elapsedMs = Date.now() - start;
writeFileSync(`${root}/${layout}.json`, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ layout, pass: report.pass, failure: report.failure, code: report.code, elapsedMs: report.elapsedMs,
    revision: report.final?.revision, bounds: report.final?.bounds, rights: report.final?.placements, reachedNew: report.final?.reachableAddedPlacements }));
