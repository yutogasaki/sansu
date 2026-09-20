import { expect, it } from 'vitest';
import { BufferGeometry, Mesh, Texture } from 'three';
import { newLife, type ItemKind } from '../../../domain/islandLife/model';
import { replayLife } from '../../../domain/islandLife/simulation';
import { buildLifeScene } from './scene';

// Regression ceilings for these fixed fixtures, not player placement limits or GPU totals.
it.each([
    { count: 0, constructions: 700, meshes: 135, triangles: 67000, geometryMiB: 4.5 },
    { count: 30, constructions: 2500, meshes: 290, triangles: 205000, geometryMiB: 14 },
    { count: 100, constructions: 6800, meshes: 650, triangles: 530000, geometryMiB: 36 },
])('keeps $count placed items within the scene allocation budget', budget => {
    const state = replayLife(newLife('scene-budget', 100));
    if (budget.count) {
        state.extraLand = [];
        for (let z = 0; z < 15; z++) for (let x = 0; x < 16; x++) if (x > 5 || z > 4) state.extraLand.push({ x, z });
    }
    state.items = Array.from({ length: budget.count }, (_, i) => ({ id: `item-${i}`,
        kind: (['flower', 'bench', 'lantern'] as ItemKind[])[i % 3], cell: { x: i % 16, z: 5 + Math.floor(i / 16) }, growth: 6, style: 'original' }));
    const before = new BufferGeometry();
    const scene = buildLifeScene(state);
    const after = new BufferGeometry();
    const constructions = after.id - before.id - 1;
    before.dispose(); after.dispose();
    try {
        expect(constructions).toBeLessThanOrEqual(budget.constructions);
        let meshes = 0, triangles = 0, bytes = 0;
        const geometries = new Set<Mesh['geometry']>(), textures = new Set<Texture>();
        scene.root.traverse(node => {
            if (!(node instanceof Mesh)) return;
            meshes++; geometries.add(node.geometry);
            for (const material of Array.isArray(node.material) ? node.material : [node.material])
                for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
            triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
        });
        for (const geometry of geometries) {
            bytes += geometry.index?.array.byteLength ?? 0;
            for (const attribute of Object.values(geometry.attributes)) bytes += attribute.array.byteLength;
        }
        let textureBytes = 0;
        for (const texture of textures) {
            const image = texture.image as { width?: number; height?: number } | undefined;
            if (image?.width && image.height) textureBytes += image.width * image.height * 4 * (texture.generateMipmaps ? 4 / 3 : 1);
        }
        expect(textures.size).toBeLessThanOrEqual(6);
        expect(textureBytes / 1024 ** 2).toBeLessThanOrEqual(16);
        expect(meshes).toBeLessThanOrEqual(budget.meshes);
        expect(triangles).toBeLessThanOrEqual(budget.triangles);
        expect(bytes / 1024 ** 2).toBeLessThanOrEqual(budget.geometryMiB);
    } finally { scene.dispose(); }
});
