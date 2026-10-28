import assert from 'node:assert/strict';
import * as T from 'three';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { legacyIslandWorld } from '../../../src/domain/growingIsland/legacyWorldDefinition';
import { HOUSE_CELLS, landBounds } from '../../../src/domain/growingIsland/space';
import { landscapePoint } from '../../../src/domain/growingIsland/landscape';
import { worldFloorGeometry } from '../../../src/components/island/growing/worldFloorGeometry';
import type { GrowingState, Cell } from '../../../src/domain/growingIsland/types';
import type { IslandWorld } from '../../../src/domain/growingIsland/worldDefinition';
import type { TerrainMethod } from './section-profile';
import { COASTAL_FIELD_REVISION } from './coastal-field';

const worldOf = editableIslandWorld as (state: GrowingState, curved: boolean, mode: TerrainMethod) => IslandWorld;
const probeOffsets = [-.46, -.23, 0, .23, .46];
function legallySupported(original: IslandWorld, after: IslandWorld, cell: Cell) {
    const center = after.floorAt(cell)?.point.y, oldCenter = original.floorAt(cell)?.point.y;
    return center !== undefined && oldCenter !== undefined && probeOffsets.every(dx => probeOffsets.every(dz => {
        const at = { x: cell.x + dx, z: cell.z + dz }, y = after.floorAt(at)?.point.y, old = original.floorAt(at)?.point.y;
        return y !== undefined && old !== undefined && Math.abs((y - center) - (old - oldCenter)) <= .130000001;
    }));
}
const fixtures: { name: string; heights: Record<string, number> }[] = [
    { name: 'flat-coast', heights: {} },
    { name: 'open-west-cove', heights: { '0,2': -4, '0,3': -4, '0,4': -4 } },
    { name: 'cape-and-bay', heights: { '0,1': 5, '1,1': 4, '0,3': -4, '0,4': -4 } },
    { name: 'closed-inland-hole', heights: { '2,3': -4 } },
];
const runs = [];
for (const fixture of fixtures) {
    const state = newIsland(`explicit-coastal-fixture:${fixture.name}`, 0);
    state.terrain = { version: 1, heights: fixture.heights, undo: [], redo: [] };
    // Existing flower/bench remain exactly where the ordinary initial state places them.
    const before = JSON.stringify(state), a = worldOf(state, true, 'A'), c = worldOf(state, true, 'C');
    const original = legacyIslandWorld({ land: state.land, bridge: state.bridge }, true), bounds = landBounds(state);
    assert.ok(c.revision!.includes(COASTAL_FIELD_REVISION)); assert.notEqual(a.revision, c.revision);
    const reordered = structuredClone(state); reordered.terrain!.heights = Object.fromEntries(Object.entries(fixture.heights).reverse());
    assert.equal(worldOf(reordered, true, 'C'), c); assert.equal(JSON.stringify(state), before);
    const ownersMoved = structuredClone(state); ownersMoved.landmarks = []; ownersMoved.plots = []; ownersMoved.keepsakes = [];
    assert.equal(worldOf(ownersMoved, true, 'C'), c, 'owner movement/storage cannot reshape terrain');
    assert.deepEqual(c.sites.filter(s => s.placement).map(s => s.cell), a.sites.filter(s => s.placement).map(s => s.cell));
    let legalA = 0, lostLegalCells = 0, supportedOwners = 0, maxPreservedError = 0;
    for (const site of a.sites.filter(s => s.placement)) if (legallySupported(original, a, site.cell)) {
        legalA++; if (!legallySupported(original, c, site.cell)) lostLegalCells++;
        for (const dx of probeOffsets) for (const dz of probeOffsets) {
            const at = { x: site.cell.x + dx, z: site.cell.z + dz };
            const ya = a.floorAt(at)!.point.y, yc = c.floorAt(at)?.point.y; assert.notEqual(yc, undefined);
            maxPreservedError = Math.max(maxPreservedError, Math.abs(ya - yc!));
        }
    }
    assert.equal(lostLegalCells, 0); assert.ok(maxPreservedError < 1e-7);
    for (const owner of [...state.plots, ...state.landmarks, ...state.keepsakes]) if (owner.cell && legallySupported(original, a, owner.cell)) {
        assert.ok(legallySupported(original, c, owner.cell)); supportedOwners++;
    }
    for (const pin of [...HOUSE_CELLS, { x: bounds.maxX - 1, z: bounds.depth - 1 }]) for (const dx of probeOffsets) for (const dz of probeOffsets) {
        const at = { x: pin.x + dx, z: pin.z + dz }; assert.equal(c.floorAt(at)?.point.y, a.floorAt(at)?.point.y);
    }
    let wetA = 0, newlyDry = 0, newlyWet = 0, changed = 0, maxLowering = 0;
    for (let iz = -10; iz <= 50; iz++) for (let ix = -10; ix <= 60; ix++) {
        const at = { x: ix / 10, z: iz / 10 }, fa = a.floorAt(at), fc = c.floorAt(at);
        if (!fa) { wetA++; if (fc) newlyDry++; }
        if (fa && !fc) newlyWet++;
        if (fa && fc) { assert.ok(fc.point.y <= fa.point.y + 1e-7); const delta = fa.point.y - fc.point.y; maxLowering = Math.max(maxLowering, delta); if (delta > .02) changed++; }
    }
    assert.equal(newlyDry, 0, 'no opening, owned or unowned, may be filled');
    if (fixture.name === 'open-west-cove' || fixture.name === 'cape-and-bay') for (let i = 0; i <= 30; i++)
        assert.equal(c.floorAt({ x: -i / 20, z: 3 }), undefined, 'existing opening must reach the sea');
    if (fixture.name === 'closed-inland-hole') for (const offset of [{ x: 0, z: 0 }, { x: .3, z: 0 }, { x: -.3, z: 0 }]) {
        const at = { x: 2 + offset.x, z: 3 + offset.z }; assert.equal(c.floorAt(at)?.point.y, a.floorAt(at)?.point.y, 'closed inland hole must not seed coastal carving');
    }
    const geometry = worldFloorGeometry(c), material = new T.MeshBasicMaterial({ side: T.DoubleSide }), mesh = new T.Mesh(geometry, material);
    mesh.updateMatrixWorld(true); const ray = new T.Raycaster(); let maxRayError = 0, hitProbes = 0;
    for (let iz = 0; iz <= 8; iz++) for (let ix = -2; ix <= 12; ix++) {
        const cell = { x: ix / 2 + .013, z: iz / 2 + .017 }, physical = landscapePoint(cell), floor = c.floorAt(cell);
        ray.set(new T.Vector3(physical.x, 10, physical.z), new T.Vector3(0, -1, 0));
        const hit = ray.intersectObject(mesh)[0]; assert.equal(Boolean(hit), Boolean(floor));
        if (hit && floor) { maxRayError = Math.max(maxRayError, Math.abs(hit.point.y - floor.point.y)); hitProbes++; }
    }
    assert.ok(maxRayError < .002); geometry.dispose(); material.dispose();
    let walkEdges = 0;
    for (const site of c.walkSites) for (const neighbor of c.neighbors(site.cell, 'walk')) { assert.ok(editableTerrainSegmentSupported(c, site.cell, neighbor)); walkEdges++; }
    runs.push({ name: fixture.name, fixture: 'diagnostic heights; initial owners preserved, not an ordinary UI journey', legalA, lostLegalCells, supportedOwners, maxPreservedError,
        wetA, newlyDry, newlyWet, sampledAreaRemovedApprox: newlyWet * .01, changedOver2cm: changed, maxLowering, maxRayError, hitProbes, walkEdges });
}
// A remote edit must not restyle the opposite side of the island.
const state = newIsland('explicit-coast-locality', 0); state.land.expanded = 'east'; state.land.extra = ['west', 'south'];
state.terrain = { version: 1, heights: {}, undo: [], redo: [] };
const initial = worldOf(state, true, 'C'), next = structuredClone(state); next.terrain!.heights = { '-3,5': -4 };
const edited = worldOf(next, true, 'C'); let remoteSamples = 0, maxRemoteDelta = 0;
for (let z = -5; z <= 80; z++) for (let x = 30; x <= 90; x++) {
    const cell = { x: x / 10, z: z / 10 }, a = initial.floorAt(cell), b = edited.floorAt(cell);
    assert.equal(Boolean(a), Boolean(b)); if (a && b) maxRemoteDelta = Math.max(maxRemoteDelta, Math.abs(a.point.y - b.point.y)); remoteSamples++;
}
assert.equal(maxRemoteDelta, 0);
console.log(JSON.stringify({ passed: true, at: new Date().toISOString(), revision: COASTAL_FIELD_REVISION, ownerIndependent: true,
    locality: { remoteSamples, maxRemoteDelta }, runs }, null, 2));
