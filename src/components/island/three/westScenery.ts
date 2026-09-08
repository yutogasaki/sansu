import * as THREE from 'three';
import type { IslandMaterials } from './primitives';
import { makeExpansion, makeStarTree } from './scenery';

/** The western grove has its own coast and the same physical bridge deck as the east.
 * A rotation preserves upward normals, winding and the inset walking surface. */
export function makeWestExpansion(materials: IslandMaterials) {
    const group = new THREE.Group();
    group.name = 'western-grove';
    const land = makeExpansion(materials, undefined, 'west');
    land.rotation.y = Math.PI;
    group.add(land);
    const tree = makeStarTree(materials);
    tree.name = 'western-grove-tree';
    tree.scale.setScalar(.65);
    tree.position.set(-6.7, 0, -1.2);
    group.add(tree);
    return group;
}
