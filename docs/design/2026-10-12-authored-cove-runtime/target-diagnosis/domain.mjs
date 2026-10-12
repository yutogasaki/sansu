import { readFileSync, writeFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';
const root = '/private/tmp/sansu-authored-cove-c2/candidate';
const out = '/private/tmp/sansu-cove-distant-p9-diagnosis';
const compiled = await build({ stdin: { resolveDir: root, contents: `
 export { authoredWorldFrame } from './src/domain/growingIsland/authoredWorldFrame';
 export { compileWorldDefinition } from './src/domain/growingIsland/worldDefinition';
 export { withNative05WaterCarvingScope } from './src/domain/growingIsland/authoredWaterCarving';
 export { walkableCells, reachableFromHome, isReachable, approachCells, key, HOME_CELL } from './src/domain/growingIsland/space';
 export { canPlace } from './src/domain/growingIsland/commands';
` }, bundle: true, format: 'esm', platform: 'node', write: false, metafile: true, logLevel: 'silent' });
writeFileSync(`${out}/domain-bundle.mjs`, compiled.outputFiles[0].contents);
const d = await import(`${out}/domain-bundle.mjs`);
const failure = JSON.parse(readFileSync('/private/tmp/sansu-authored-cove-c2/full/report.json'));
const initial = failure.initialState, moved = failure.failureState;
const original = d.withNative05WaterCarvingScope(d.compileWorldDefinition(JSON.parse(gunzipSync(readFileSync(`${root}/prototypes/place-qa/native05-world.json.gz`)))));
const before = d.authoredWorldFrame(initial, original, { water: true, cove: true });
const after = d.authoredWorldFrame(moved, original, { water: true, cove: true });
const bareBefore = d.authoredWorldFrame(initial, original, { water: true, cove: false });
const bareAfter = d.authoredWorldFrame(moved, original, { water: true, cove: false });
const checksum = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const cell = key => { const [x, z] = key.split(',').map(Number); return { x, z }; };
function access(state, world) {
    const walkable = d.walkableCells(state, world), reached = d.reachableFromHome(state, walkable, world);
    const owners = [...state.plots, ...state.landmarks].filter(owner => owner.cell).map(owner => ({ id: owner.id, cell: owner.cell,
        dryFloor: Boolean(world.floorAt(owner.cell)), reachable: d.isReachable(owner.cell, reached, world),
        approaches: d.approachCells(owner.cell, world).filter(cell => reached.has(d.key(cell))) }));
    return { walkable, reached, summary: { walkable: walkable.size, reached: reached.size, unreachable: owners.filter(owner => !owner.reachable),
        floorCount: world.floors.length, floors: world.floors.map(floor => ({ id: floor.id, hash: checksum(floor) })), dryFalse: owners.filter(owner => !owner.dryFloor).map(owner => owner.id) } };
}
const prior = access(initial, before.world), current = access(moved, after.world);
const controlPrior = access(initial, after.world);
const removedWalkable = [...controlPrior.walkable].filter(key => !current.walkable.has(key));
const addedWalkable = [...current.walkable].filter(key => !controlPrior.walkable.has(key));
const blockingBoundary = removedWalkable.map(key => ({ key, neighbors: after.world.neighbors(cell(key)).map(d.key),
    reachableNeighbors: after.world.neighbors(cell(key)).map(d.key).filter(key => current.reached.has(key)),
    disconnectedNeighbors: after.world.neighbors(cell(key)).map(d.key).filter(key => current.walkable.has(key) && !current.reached.has(key)) }));
const target = moved.plots.find(owner => owner.id === 'p9').cell;
const representative = initial.plots.find(owner => owner.id === 'p3');
const destination = d.approachCells(representative.cell, after.world).find(cell => controlPrior.reached.has(d.key(cell)));
const route = after.world.route(d.HOME_CELL, destination, controlPrior.walkable);
const initialWater = failure.captures[0].metadata.authoredWater;
const result = {
    scope: 'Only the exact c2 baseline and failed move (4,-4), plus same-world baseline occupancy control. No placement search.',
    sourceClosureUnchanged: failure.sourceClosureUnchanged, target, canPlace: d.canPlace(initial, target, 'p9', before.world),
    baseline: prior.summary, failed: current.summary, baselineOccupancyOnFailedWorld: controlPrior.summary,
    upstreamWaterFloorsIdentical: checksum(bareBefore.world.floors) === checksum(bareAfter.world.floors),
    removedFloorIds: before.world.floors.filter(floor => !after.world.floors.some(next => next.id === floor.id)).map(floor => floor.id),
    changedRetainedFloors: before.world.floors.filter(floor => after.world.floors.some(next => next.id === floor.id && checksum(next) !== checksum(floor))).map(floor => floor.id),
    addedWalkable, removedWalkable, blockingBoundary,
    representativeRoute: { owner: representative.id, destination, route, blockedRoutePoints: route.filter(cell => !current.walkable.has(d.key(cell))) },
    browser: { before: failure.captures[0].physical, after: JSON.parse(failure.failureMetadata.authoredObstructionWalking), waterMetadataInitiallyPresent: Boolean(initialWater) },
    moduleInputs: Object.keys(compiled.metafile.inputs).filter(file => file !== '<stdin>'),
};
writeFileSync(`${out}/domain-report.json`, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ target, canPlace: result.canPlace,
    before: { reached: prior.reached.size, unreachable: prior.summary.unreachable.map(owner => owner.id) },
    after: { reached: current.reached.size, unreachable: current.summary.unreachable.map(owner => owner.id) },
    sameFailedWorldBeforeMove: { reached: controlPrior.reached.size, unreachable: controlPrior.summary.unreachable.map(owner => owner.id) },
    waterFloorsIdentical: result.upstreamWaterFloorsIdentical, removedFloorIds: result.removedFloorIds, changedRetainedFloors: result.changedRetainedFloors,
    removedWalkable, addedWalkable, blockingBoundary, blockedRoutePoints: result.representativeRoute.blockedRoutePoints }, null, 2));
