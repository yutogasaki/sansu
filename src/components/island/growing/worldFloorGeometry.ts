import * as T from 'three';
import type { IslandWorld } from '../../../domain/growingIsland/worldDefinition';

/** This is the actual evaluated floor, rather than a second reconstruction of it.
 * Legacy bridge planks remain separately drawn; authored decks can be included. */
export function worldFloorGeometry(world: IslandWorld, origin = { x: 0, z: 0 }, includeDeck = false) {
    const positions: number[] = [], indices: number[] = [], colors: number[] = [];
    const shade = new T.Color('#84bba1');
    for (const floor of world.floors.filter(floor => floor.kind === 'ground' || includeDeck && floor.kind === 'deck')) {
        const offset = positions.length / 3, meadow = new T.Color(floor.color);
        for (const { cell: { x, z }, point } of floor.vertices) {
            positions.push(point.x - origin.x, point.y, point.z - origin.z);
            const color = meadow.clone().lerp(shade, Math.min(.28, Math.max(0, point.y) * .14));
            const variation = .97 + Math.sin(x * 1.37 + z * .42) * Math.sin(z * .83) * .025;
            colors.push(color.r * variation, color.g * variation, color.b * variation);
        }
        for (const index of floor.indices) indices.push(index + offset);
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}
