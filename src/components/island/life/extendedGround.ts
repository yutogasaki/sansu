import * as T from 'three';
import type { Cell, LifeState } from '../../../domain/islandLife/model';
import { growthStage } from '../../../domain/islandLife/model';
import { extendedGatherings } from '../../../domain/islandLife/extendedGatherings';
import { cellKey } from '../../../domain/islandLife/space';
import { batch, ellipsoid } from '../three/primitives';

/** Local shade and low water-side edging. Neither reserves another cell. */
export function buildExtendedGround(state: LifeState, point: (cell: Cell) => T.Vector3, paint: (color: string) => T.MeshStandardMaterial) {
    const root = new T.Group(); root.name = 'life-extended-ground';
    const crowns = new T.Group(); crowns.name = 'life-grove-crowns';
    const groups = extendedGatherings(state), mature = new Set<string>();
    if (state.landscapeVersion !== 'groves-water-v1') return { root, crowns, mature };
    const tile = (x: number, z: number, width: number, depth: number, color: string, y = .066) => {
        const mesh = new T.Mesh(new T.BoxGeometry(width, .012, depth), paint(color));
        mesh.position.set(x, y, z); mesh.receiveShadow = true; root.add(mesh);
    };
    for (const group of groups) {
        const cells = new Set(group.cells.map(cellKey)), trees = group.kind === 'trees';
        const color = trees ? group.wide ? '#397e77' : '#428f80' : '#b5d7c6';
        for (const cell of group.cells) {
            if (trees) mature.add(cellKey(cell));
            const p = point(cell); tile(p.x, p.z, trees ? 1.16 : .94, trees ? 1.16 : .94, color);
            for (const [dx, dz] of [[1, 0], [0, 1]]) if (cells.has(cellKey({ x: cell.x + dx, z: cell.z + dz }))) {
                tile(p.x + dx * .5, p.z + dz * .5, dx ? .08 : .94, dz ? .08 : .94, color);
                if (trees && group.wide) {
                    const leaf = ellipsoid(crowns, paint('#58ab8d'), [p.x + dx * .5, 1.02, p.z + dz * .5], [dx ? .32 : .15, .065, dz ? .32 : .15], 18);
                    leaf.rotation.z = dx ? .16 : 0; leaf.rotation.x = dz ? -.16 : 0;
                }
            }
            if (!trees) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                if (cells.has(cellKey({ x: cell.x + dx, z: cell.z + dz }))) continue;
                tile(p.x + dx * .45, p.z + dz * .45, dx ? .04 : .9, dz ? .04 : .9, '#ead6af', .077);
            }
        }
    }
    // A single mature tree already has local shade, without claiming a grove.
    for (const item of state.items) if (item.kind === 'sapling' && item.cell && growthStage(item) === 2 && !mature.has(cellKey(item.cell))) {
        const patch = new T.Mesh(new T.CircleGeometry(.68, 32), paint('#529b87'));
        patch.rotation.x = -Math.PI / 2; patch.position.copy(point(item.cell)); patch.position.y = .079;
        patch.receiveShadow = true; root.add(patch);
    }
    batch(root); batch(crowns);
    return { root, crowns, mature };
}
