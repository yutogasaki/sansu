import type { Cell } from './types';
import type { WorldDefinition, WorldDistrict, WorldFloor } from './worldTypes';

/** An L-shaped acquired shore. Its north-east inlet is explicitly water. */
export function inletWorldDefinition(): WorldDefinition {
    const floor = (id: string, kind: WorldFloor['kind'], cells: Cell[]): WorldFloor => {
        const vertices = cells.flatMap(cell => [[-.5, -.5], [-.5, .5], [.5, -.5], [.5, .5]].map(([dx, dz]) => {
            const x = cell.x + dx, z = cell.z + dz;
            return { cell: { x, z }, point: { x: x * 1.3 + z * .15, y: kind === 'water' ? -.2 : x * .1 + z * .2, z: z * 1.1 } };
        }));
        return { id, kind, color: '#a4cb87', vertices, indices: cells.flatMap((_, i) => [0, 1, 2, 2, 1, 3].map(index => index + i * 4)) };
    };
    const cells = [{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 0, z: 1 }];
    const district: WorldDistrict = { id: 'old-shore', templateId: 'inlet-test', logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
        floors: [floor('shore', 'ground', cells), floor('inlet', 'water', [{ x: 1, z: 1 }])],
        sites: cells.map((cell, i) => ({ id: ['a', 'b', 'c'][i], cell, floorId: 'shore', placement: true })), ports: [{ id: 'east-port', siteId: 'b' }] };
    return { version: 1, id: 'inlet-test-v1', districts: [district], edges: [
        { from: { districtId: district.id, siteId: 'a' }, to: { districtId: district.id, siteId: 'b' }, allows: ['walk', 'join', 'water'] },
        { from: { districtId: district.id, siteId: 'a' }, to: { districtId: district.id, siteId: 'c' }, allows: ['walk', 'join'] },
    ] };
}
