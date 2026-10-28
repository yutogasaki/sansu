import assert from 'node:assert/strict';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import { replacePlace } from './model';
import { placeHeight, type PlaceShape } from './field';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import type { GrowingState } from '../../../src/domain/growingIsland/types';

const original = structuredClone(fixture.state) as unknown as GrowingState;
const before = JSON.stringify(original), safety = { actors: [], occupiedPlaceTargets: [] };
const high: PlaceShape = { center: { x: 5, z: 5 }, radius: 1.6, height: .9, entrance: 1.2 };
const reports = [];
for (const [name, shape] of [['high', high], ['high-narrow', { ...high, entrance: .4 }], ['high-wide', { ...high, entrance: 2 }], ['high-large', { ...high, radius: 2 }], ['inlet', { ...high, height: -.55 }], ['narrow', { ...high, height: -.55, entrance: .4 }], ['wide', { ...high, height: -.55, entrance: 2 }]] as const) {
    try {
        const state = replacePlace(original, shape, safety), world = editableIslandWorld(state)!;
        const restored = replacePlace(state, undefined, safety);
        assert.deepEqual(restored.terrain, original.terrain);
        for (const key of ['plots', 'landmarks', 'villagers', 'land', 'drops', 'placeProgress'] as const) assert.deepEqual(state[key], original[key]);
        assert.equal(editableIslandWorld(restored)!.revision, editableIslandWorld(original)!.revision);
        const open = new Set(world.walkSites.map(s => `${s.cell.x},${s.cell.z}`));
        const route = world.route({ x: 2, z: 1 }, shape.center, open);
        const routePass = shape.height >= 0 ? Boolean(route?.length) : route === undefined;
        const rampSamples = Array.from({ length: 91 }, (_, i) => ({ z: 5 - i / 20, point: world.floorAt({ x: 5, z: 5 - i / 20 })?.point }));
        const rampSlopes = rampSamples.slice(1).flatMap((sample, i) => {
            const previous = rampSamples[i].point, next = sample.point;
            return previous && next ? [Math.abs(next.y - previous.y) / Math.hypot(next.x - previous.x, next.z - previous.z)] : [];
        });
        const wetSection = Array.from({ length: 81 }, (_, i) => 3 + i / 20).filter(x => !world.floorAt({ x, z: 7 }));
        reports.push({ name, accepted: true, routePass, revision: world.revision, center: world.floorAt(shape.center)?.point,
            water: !world.floorAt(shape.center), edges: world.definition.edges.length, geometryRoute: route,
            northRampMaxSlope: Math.max(...rampSlopes), allowedSlope: .8, rampSamples,
            wetSectionAtZ7: { count: wetSection.length, minX: Math.min(...wetSection), maxX: Math.max(...wetSection) } });
    } catch (error) { reports.push({ name, accepted: false, error: String(error) }); }
}
assert.equal(JSON.stringify(original), before);
assert.throws(() => replacePlace(original, { ...high, center: { x: 100, z: 0 } }, safety));
assert.throws(() => replacePlace(original, { ...high, center: { x: 2, z: 1 } }, safety));
assert.throws(() => replacePlace(original, { ...high, center: { x: 2, z: 5 }, height: -.55 }, safety));
assert.throws(() => replacePlace(original, high, { ...safety, actors: [high.center] }));
assert.throws(() => replacePlace(original, high, { ...safety, occupiedPlaceTargets: [{ placeId: 'busy', targetId: 'busy', route: [] }] }));
assert.equal(placeHeight({}, { x: 0, z: 0 }, .3), .3);
// Continuous input, without cell-boundary snapping or square plateaux.
const a = placeHeight({ trialPlace: high }, { x: 5.99999, z: 5 }, .2), b = placeHeight({ trialPlace: high }, { x: 6.00001, z: 5 }, .2);
assert(Math.abs(a - b) < .0001);
console.log(JSON.stringify({ status: reports.every(r => r.accepted && r.routePass) ? 'PASS' : 'PARTIAL', date: new Date().toISOString(), reports,
    protected: ['unowned land', 'house footing', 'owned flower footing', 'actor footing', 'occupied gallery'], restoredRawTerrainAndWorld: true,
    limitations: ['Node diagnostic with actors absent in accepted cases', 'No DB save, browser or visual acceptance claim'] }, null, 2));
