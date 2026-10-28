import assert from 'node:assert/strict';
import * as T from 'three';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { editableIslandWorld, editableTerrainSegmentSupported, TERRAIN_DRY_LEVEL } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { HOUSE_CELLS, landBounds } from '../../../src/domain/growingIsland/space';
import { landscapePoint } from '../../../src/domain/growingIsland/landscape';
import { worldFloorGeometry } from '../../../src/components/island/growing/worldFloorGeometry';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import type { IslandWorld } from '../../../src/domain/growingIsland/worldDefinition';
import { sectionBlend, sectionOffset, sectionRaiseWeight, terrainMethod, SECTION_PROFILE_REVISION, type TerrainMethod } from './section-profile';

// The comparison transform adds the explicit mode argument; the production API
// intentionally remains untouched. Run this entry with terrainMethodTransform.
const worldOf = editableIslandWorld as (state: GrowingState, curved: boolean, mode: TerrainMethod) => IslandWorld;
assert.equal(terrainMethod(), 'A'); assert.equal(terrainMethod('?terrainTrial=B'), 'B');
assert.equal(terrainMethod('?groundTrial=garden'), 'A');
for (const mode of ['A', 'B'] as const) {
    let previous = -1;
    for (let i = 0; i <= 1000; i++) {
        const value = sectionBlend(i / 1000, mode);
        assert.ok(value >= previous && value >= 0 && value <= 1); previous = value;
    }
    assert.equal(sectionBlend(0, mode), 0); assert.equal(sectionBlend(1, mode), 1);
}
for (const knot of [.18, .82]) {
    const h = 1e-5, left = (sectionBlend(knot, 'B') - sectionBlend(knot - h, 'B')) / h;
    const right = (sectionBlend(knot + h, 'B') - sectionBlend(knot, 'B')) / h;
    assert.ok(Math.abs(left - right) < .001, 'profile slope must join continuously');
}
for (const corners of [[0, 8, 0, 8], [-4, 0, 8, 0], [0, -4, 0, -4]] as const) {
    for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) {
        const x = i / 40, z = j / 40, a = sectionOffset(corners, x, z, 'A');
        const b = sectionOffset(corners, x, z, 'B', 0);
        assert.ok(b <= a + 1e-12, 'boundary profile must not add dry floor');
        if (corners.some(n => n < 0)) assert.ok(sectionOffset(corners, x, z, 'B') <= a + 1e-12, 'cuts must not fill');
    }
}

interface Vertex { x: number; z: number; px: number; pz: number }
const area = (polygon: Vertex[]) => Math.abs(polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % polygon.length]; return sum + p.px * q.pz - q.px * p.pz;
}, 0)) / 2;
function clip(polygon: Vertex[], axis: 'x' | 'z', value: number, sign: number): Vertex[] {
    const result: Vertex[] = [];
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], inside = sign * (a[axis] - value) >= -1e-10;
        if (inside) result.push(a);
        if (inside !== (sign * (b[axis] - value) >= -1e-10)) {
            const t = (value - a[axis]) / (b[axis] - a[axis]);
            result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, px: a.px + (b.px - a.px) * t, pz: a.pz + (b.pz - a.pz) * t });
        }
    }
    return result;
}
function unownedDryArea(world: IslandWorld, state: GrowingState) {
    const bounds = landBounds(state); let total = 0;
    for (const floor of world.floors.filter(f => f.kind === 'ground')) for (let i = 0; i < floor.indices.length; i += 3) {
        const triangle = floor.indices.slice(i, i + 3).map(index => {
            const { cell, point } = floor.vertices[index]; return { ...cell, px: point.x, pz: point.z };
        });
        let inside = clip(triangle, 'x', bounds.minX - .5, 1);
        inside = clip(inside, 'x', bounds.maxX + .5, -1); inside = clip(inside, 'z', -.5, 1); inside = clip(inside, 'z', bounds.depth - .5, -1);
        total += area(triangle) - area(inside);
    }
    return total;
}
const fixtures: { name: string; heights: Record<string, number> }[] = [
    { name: 'unchanged-flat', heights: {} },
    { name: 'raised-east-shoulder', heights: { '4,2': 8, '4,3': 4, '5,2': 4 } },
    { name: 'open-west-cove', heights: { '0,2': -4, '0,3': -4, '0,4': -4 } },
    { name: 'mixed-ridge-and-cut', heights: { '0,3': -4, '0,4': -4, '1,3': 8, '2,3': 8, '2,4': 4 } },
];
const runs = [];
for (const fixture of fixtures) {
    const state = newIsland(`explicit-section-fixture:${fixture.name}`, 0);
    state.landmarks = []; state.plots = []; state.keepsakes = [];
    state.terrain = { version: 1, heights: fixture.heights, undo: [], redo: [] };
    const input = JSON.stringify(state), a = worldOf(state, true, 'A'), b = worldOf(state, true, 'B');
    assert.notEqual(a.revision, b.revision); assert.ok(a.revision!.includes(SECTION_PROFILE_REVISION));
    const reordered = structuredClone(state); reordered.terrain!.heights = Object.fromEntries(Object.entries(fixture.heights).reverse());
    assert.equal(worldOf(reordered, true, 'B'), b, 'input insertion order must not change world or cache key');
    assert.deepEqual(JSON.parse(JSON.stringify(b.definition)), worldOf(JSON.parse(input), true, 'B').definition);
    assert.equal(JSON.stringify(state), input, 'generation cannot mutate the saved input');
    const rights = (w: IslandWorld) => w.sites.filter(s => s.placement).map(s => `${s.cell.x},${s.cell.z}`).sort();
    assert.deepEqual(rights(a), rights(b));
    const bounds = landBounds(state), pins = [...HOUSE_CELLS, { x: bounds.maxX - 1, z: bounds.depth - 1 }];
    const empty = structuredClone(state); empty.terrain!.heights = {};
    const initial = worldOf(empty, true, 'A');
    let pinSamples = 0, maxPinnedError = 0;
    for (const pin of pins) for (let ix = -5; ix <= 5; ix++) for (let iz = -5; iz <= 5; iz++) {
        const cell = { x: pin.x + ix * .092, z: pin.z + iz * .092 };
        assert.equal(sectionRaiseWeight(cell, bounds) >= 0, true);
        const expected = initial.floorAt(cell)!.point.y;
        for (const world of [a, b]) {
            const y = world.floorAt(cell)?.point.y; assert.notEqual(y, undefined);
            maxPinnedError = Math.max(maxPinnedError, Math.abs(y! - expected)); pinSamples++;
        }
    }
    assert.ok(maxPinnedError < 1e-7, `fixed support moved: ${maxPinnedError}`);
    const outsideA = unownedDryArea(a, state), outsideB = unownedDryArea(b, state);
    assert.ok(outsideB <= outsideA + 1e-7, `unowned dry area grew ${outsideA} -> ${outsideB}`);
    let maxHeightDifference = 0, drySamples = 0, differentSamples = 0, wetSamples = 0;
    for (let iz = -8; iz <= 48; iz++) for (let ix = -8; ix <= 58; ix++) {
        const cell = { x: ix / 10, z: iz / 10 }, fa = a.floorAt(cell), fb = b.floorAt(cell);
        if (fa && fb) { const diff = Math.abs(fa.point.y - fb.point.y); maxHeightDifference = Math.max(maxHeightDifference, diff); if (diff > .02) differentSamples++; drySamples++; }
        if (fixture.name === 'open-west-cove' && !fa) { assert.equal(fb, undefined, 'B closed an A water opening'); wetSamples++; }
    }
    if (fixture.name === 'unchanged-flat') assert.equal(maxHeightDifference, 0);
    else assert.ok(maxHeightDifference > .02, 'B should change actual floor, not merely color');
    if (fixture.name === 'open-west-cove') {
        for (let i = 0; i <= 30; i++) for (const world of [a, b]) assert.equal(world.floorAt({ x: -i / 20, z: 3 }), undefined, 'cove must open into the real sea');
    }
    const methods = [];
    for (const [mode, world] of [['A', a], ['B', b]] as const) {
        const geometry = worldFloorGeometry(world), material = new T.MeshBasicMaterial({ side: T.DoubleSide }), mesh = new T.Mesh(geometry, material);
        mesh.updateMatrixWorld(true); const ray = new T.Raycaster(); let hitSamples = 0, maxRayError = 0;
        for (const cell of [{ x: 4, z: 2 }, { x: 3.35, z: 2.2 }, { x: 0, z: 3 }, { x: 1.2, z: 3.25 }, { x: -.7, z: 3 }, { x: 2, z: 1 }]) {
            const floor = world.floorAt(cell), physical = landscapePoint(cell);
            ray.set(new T.Vector3(physical.x, 10, physical.z), new T.Vector3(0, -1, 0));
            const hit = ray.intersectObject(mesh)[0];
            assert.equal(Boolean(hit), Boolean(floor), `${mode}: draw/hit differs from actual floor at ${JSON.stringify(cell)}`);
            if (floor && hit) { maxRayError = Math.max(maxRayError, Math.abs(hit.point.y - floor.point.y)); assert.ok(floor.point.y >= TERRAIN_DRY_LEVEL - 1e-8); hitSamples++; }
        }
        assert.ok(maxRayError < .002, `render/support height mismatch: ${maxRayError}`);
        let walkEdges = 0;
        for (const site of world.walkSites) for (const neighbor of world.neighbors(site.cell, 'walk')) {
            assert.ok(editableTerrainSegmentSupported(world, site.cell, neighbor)); walkEdges++;
        }
        methods.push({ mode, hitSamples, maxRayError, walkEdges }); geometry.dispose(); material.dispose();
    }
    runs.push({ name: fixture.name, fixture: 'explicit synthetic heights, no user data injection or normal-journey claim', pinSamples, maxPinnedError, outsideA, outsideB,
        maxHeightDifference, drySamples, samplesChangedOver2cm: differentSamples, wetSamples, methods });
}
console.log(JSON.stringify({ passed: true, profile: SECTION_PROFILE_REVISION, at: new Date().toISOString(), runs }, null, 2));
