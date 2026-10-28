import assert from 'node:assert/strict';
import fixture from '../2026-10-23-place-method-comparison/evidence/expanded-place-recipe-flower-flat-wide-fixture.json';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import type { WorldDefinition, WorldFloor, WorldPoint } from '../../../src/domain/growingIsland/worldTypes';
import { compileWorldDefinition } from '../../../src/domain/growingIsland/worldDefinition';
import { editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { legacyIslandWorld } from '../../../src/domain/growingIsland/legacyWorldDefinition';
import { flatBodyFootprintSupported, flatOwnerFootprintSupported } from './flat-support';
import { replacePlace } from './model';

const cases: { name: string; accepted: boolean }[] = [];
type Rect = [x0: number, z0: number, x1: number, z1: number];
function floor(rectangles: Rect[], kind: WorldFloor['kind'] = 'ground', y: number | ((x: number, z: number) => number) = .5, shift: Cell = { x: 0, z: 0 }): WorldFloor {
    const vertices: { cell: Cell; point: WorldPoint }[] = [], indices: number[] = [];
    for (const [x0, z0, x1, z1] of rectangles) {
        const offset = vertices.length;
        for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]])
            vertices.push({ cell: { x, z }, point: { x: x + shift.x, z: z + shift.z, y: typeof y === 'number' ? y : y(x, z) } });
        indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
    }
    return { id: kind, kind, vertices, indices, color: '#a4cb87' };
}
function world(floors: WorldFloor[]) {
    const input: WorldDefinition = { version: 1, id: 'flat-support-synthetic', districts: [{
        id: 'test', templateId: 'test', logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
        floors, sites: [{ id: 'origin', cell: { x: 0, z: 0 }, floorId: 'ground', placement: true }], ports: [],
    }], edges: [] };
    return compileWorldDefinition(input);
}
function check(name: string, floors: WorldFloor[], expected: boolean) {
    const w = world(floors), before = JSON.stringify(w.definition);
    const accepted = flatOwnerFootprintSupported(w, { x: 0, z: 0 });
    assert.equal(accepted, expected, name);
    assert.equal(flatOwnerFootprintSupported(w, { x: 0, z: 0 }), accepted, `${name}: stable cache`);
    assert.equal(JSON.stringify(w.definition), before, `${name}: immutable world`);
    cases.push({ name, accepted });
}
const square: Rect[] = [[-1, -1, 1, 1]];
check('whole flat rectangle', [floor(square)], true);
check('opposite triangle winding', [{ ...floor(square), indices: [2, 1, 0, 3, 2, 0] }], true);
check('translated physical floor uses actual center', [floor(square, 'ground', .5, { x: 17.25, z: -8.75 })], true);
const sheared = (rectangles: Rect[]) => {
    const source = floor(rectangles);
    return { ...source, vertices: source.vertices.map(vertex => ({ ...vertex,
        point: { ...vertex.point, x: vertex.point.x + .75 * vertex.point.z } })) };
};
check('wide sheared floor covers physical rectangle', [sheared(square)], true);
check('logical square support does not cover rigid physical corners after shear', [sheared([[-.5, -.5, .5, .5]])], false);
check('tilted floor', [floor(square, 'ground', (x, z) => .5 + x * .04 + z * .03)], false);
check('shore boundary within footprint', [floor([[-1, -1, .42, 1]])], false);
check('raised overlapping deck', [floor(square), floor([[.2, -.3, .4, .3]], 'deck', .7)], false);
check('same-level overlapping deck', [floor(square), floor([[.2, -.3, .4, .3]], 'deck', .5)], false);
check('water covers edge of otherwise flat ground', [floor(square), floor([[.2, -.3, .4, .3]], 'water', .6)], false);
check('water below solid ground', [floor(square), floor([[.2, -.3, .4, .3]], 'water', -.4)], true);
const hole: Rect[] = [[-1, -1, 1, .11], [-1, .11, .13, .13], [.15, .11, 1, .13], [-1, .13, 1, 1]];
check('small hole between the old 25 sample points', [floor(hole)], false);
check('overlap cannot pay for a hole by area sum', [floor([...hole, [-.4, -.4, .1, .1]])], false);
check('narrow seam is still a real hole', [floor([[-1, -1, .13, 1], [.13001, -1, 1, 1]])], false);
check('shared seam without gap', [floor([[-1, -1, .13, 1], [.13, -1, 1, 1]])], true);
assert.equal(flatBodyFootprintSupported(world([floor(hole)]), { x: 0, z: 0 }), false, 'body destination cannot bridge a small interior hole');
assert.equal(flatBodyFootprintSupported(world([floor([[-1, -1, .13, 1], [.13001, -1, 1, 1]])]), { x: 0, z: 0 }), false, 'body destination rejects narrow seams');
assert.equal(flatBodyFootprintSupported(world([sheared([[-.18, -.18, .18, .18]])]), { x: 0, z: 0 }), false, 'logical body square is not enough after shear');
assert.equal(flatBodyFootprintSupported(world([floor([[-.2, -.2, .2, .2]])]), { x: 0, z: 0 }), true, 'body can use a flat area smaller than furniture');
check('flat center with steep outer rim', [floor([[-.2, -.2, .2, .2], [-1, -1, 1, -.2], [-1, .2, 1, 1], [-1, -.2, -.2, .2], [.2, -.2, 1, .2]], 'ground',
    (x, z) => .5 + Math.max(0, Math.abs(x) - .2, Math.abs(z) - .2))], false);

const original = structuredClone(fixture.state) as unknown as GrowingState;
const originalText = JSON.stringify(original);
const state = replacePlace(original, { center: { x: 5, z: 5 }, radius: 1.6, height: .5, entrance: 1.2, flatRadius: 1.75 }, { actors: [], occupiedPlaceTargets: [] });
const actual = editableIslandWorld(state)!;
const legacy = legacyIslandWorld({ land: state.land, bridge: state.bridge }, true);
function oldSupported(cell: Cell) {
    const center = actual.floorAt(cell)?.point.y, oldCenter = legacy.floorAt(cell)?.point.y;
    if (center === undefined || oldCenter === undefined) return false;
    return [-.46, -.23, 0, .23, .46].every(x => [-.46, -.23, 0, .23, .46].every(z => {
        const at = { x: cell.x + x, z: cell.z + z }, next = actual.floorAt(at)?.point.y, old = legacy.floorAt(at)?.point.y;
        return next !== undefined && old !== undefined && Math.abs((next - center) - (old - oldCenter)) <= .13;
    }));
}
assert.equal(oldSupported({ x: 6, z: 5 }), false, 'reproduce actual legacy-slope false negative');
assert.equal(flatOwnerFootprintSupported(actual, { x: 6, z: 5 }), true, 'actual east plateau is physically flat');
assert.equal(flatOwnerFootprintSupported(actual, { x: 5, z: 5 }), true, 'actual central plateau is physically flat');
assert.equal(flatOwnerFootprintSupported(actual, { x: 5, z: 6 }), false, 'actual south ramp/rim is not a flat owner floor');
assert.equal(flatBodyFootprintSupported(actual, { x: 5.5, z: 5 }), true, 'actual fractional walk site supports body without granting furniture rights');
assert.equal(flatOwnerFootprintSupported(actual, { x: 5.5, z: 5 }), false);
const existing = actual.sites.filter(site => site.placement).map(site => ({ cell: site.cell, old: oldSupported(site.cell), flat: flatOwnerFootprintSupported(actual, site.cell) }));
assert.equal(flatOwnerFootprintSupported(actual, { x: Number.NaN, z: 5 }), false);
assert.equal(flatOwnerFootprintSupported(actual, { x: 6.01, z: 5 }), false, 'floor alone does not grant a planting site');
assert.equal(JSON.stringify(original), originalText, 'fixture not mutated');
console.log(JSON.stringify({ at: new Date().toISOString(), scope: 'strict physical flat support; no route or pinned-footing grant',
    heightTolerance: 1e-6, uncoveredAreaTolerance: 1e-12, cases, actual: { eastOld: false, eastFlat: true, centerFlat: true, southFlat: false,
        originalAccepted: existing.filter(site => site.old).length, newlyFlat: existing.filter(site => !site.old && site.flat).map(site => site.cell) } }, null, 2));
