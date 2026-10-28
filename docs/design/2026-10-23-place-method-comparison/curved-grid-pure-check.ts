import assert from 'node:assert/strict';
import { curvedGridPoint, curvedGridCell, curvedGridJacobian, CURVED_GRID_REVISION, CURVED_GRID_DESIGN } from './curved-grid';
import type { Cell } from '../../../src/domain/growingIsland/types';
const cross = (a: Cell, b: Cell, c: Cell) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
let maxInverseError = 0, maxDeterminantError = 0, maxDisplacement = 0, probes = 0;
for (let iz = -240; iz <= 240; iz++) for (let ix = -240; ix <= 240; ix++) {
    const at = { x: ix / 7 + .013, z: iz / 9 + .019 }, mapped = curvedGridPoint(at), inverse = curvedGridCell(mapped);
    const j = curvedGridJacobian(at), determinant = j.xx * j.zz - j.xz * j.zx;
    maxInverseError = Math.max(maxInverseError, Math.hypot(inverse.x - at.x, inverse.z - at.z));
    maxDeterminantError = Math.max(maxDeterminantError, Math.abs(determinant - 1)); probes++;
    if (at.x >= -.5 && at.x <= 5.5 && at.z >= -.5 && at.z <= 4.5) maxDisplacement = Math.max(maxDisplacement, Math.hypot(mapped.x - at.x, mapped.z - at.z));
}
assert(maxInverseError < 1e-12); assert(maxDeterminantError < 1e-12);
const meshes = [];
for (const detail of [6, 12]) {
    let minTriangleRatio = Infinity, maxTriangleRatio = 0, initialArea = 0, triangles = 0;
    for (let iz = -2 * detail; iz < 10 * detail; iz++) for (let ix = -8 * detail; ix < 13 * detail; ix++) {
        const a = { x: ix / detail, z: iz / detail }, b = { x: (ix + 1) / detail, z: iz / detail };
        const c = { x: ix / detail, z: (iz + 1) / detail }, d = { x: (ix + 1) / detail, z: (iz + 1) / detail };
        for (const triangle of [[a, b, c], [b, d, c]]) {
            const actual = triangle.map(curvedGridPoint), area2 = cross(actual[0], actual[1], actual[2]);
            const ratio = area2 * detail * detail; minTriangleRatio = Math.min(minTriangleRatio, ratio); maxTriangleRatio = Math.max(maxTriangleRatio, ratio); triangles++;
            assert(area2 > 0, 'A rendered triangle flipped');
            if (a.x >= -.5 && a.x < 5.5 && a.z >= -.5 && a.z < 4.5) initialArea += area2 / 2;
        }
    }
    assert(Math.abs(initialArea - 30) / 30 < .001);
    meshes.push({ detail, triangles, minTriangleRatio, maxTriangleRatio, initialArea, initialAreaRelativeError: (initialArea - 30) / 30 });
}
// A projection without land/owner inputs cannot move an old coordinate on
// acquisition. Record exact reused anchors rather than pretend this proves
// the pier's later rigid world-space offsets or all model footprint contact.
const anchors = [{ x: 2, z: 0 }, { x: 3, z: 0 }, { x: 2, z: 1 }, { x: 0, z: 1 }, { x: 4, z: 4 }].map(cell => ({ cell, point: curvedGridPoint(cell), inverse: curvedGridCell(curvedGridPoint(cell)) }));
console.log(JSON.stringify({ passed: true, revision: CURVED_GRID_REVISION, at: new Date().toISOString(), design: CURVED_GRID_DESIGN,
    probes, maxInverseError, maxDeterminantError, maxInitialDisplacement: maxDisplacement, meshes, anchors,
    notProven: ['actual shared world renderer/hit', 'rigid owner footprint', 'fixed house/pier whole mesh contact', 'actual walking and mobile art'] }, null, 2));
