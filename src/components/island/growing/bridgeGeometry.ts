import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';

/** The first two offshore walking cells and the lookout share one uninterrupted deck. */
export function buildBridge(m: IslandMaterials) {
    const root = new T.Group(); root.name = 'growing-bridge';
    const wood = [m.surface('#e9bf75', .78), m.surface('#dca863', .78)];
    const support = m.surface('#688794', .7);
    const plank = (x: number, z: number, width: number, depth: number, material: T.Material, y = .105) => {
        const mesh = new T.Mesh(new T.BoxGeometry(width, .095, depth), material);
        mesh.position.set(x, y, z); mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh); return mesh;
    };
    for (let i = 0; i < 8; i++) plank(0, .42 + i * .25, .76, .23, wood[i % 2]).name = `bridge-board-${i}`;
    plank(0, 2.25, 1.04, .8, wood[0], .105).name = 'bridge-landing';
    for (const x of [-.4, .4]) {
        const post = new T.Mesh(new T.CylinderGeometry(.055, .065, .6, 8), support);
        post.position.set(x, -.22, 2.27); post.name = 'bridge-finish'; root.add(post);
    }
    // A flower marks the destination without blocking the walking cell.
    const center = new T.Mesh(new T.SphereGeometry(.08, 10, 8), m.surface('#f6cf88', .8));
    center.position.set(.36, .25, 2.5); center.name = 'bridge-finish'; root.add(center);
    return root;
}
