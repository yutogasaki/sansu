import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { APPEARANCE_FAMILIES, ISLAND_APPEARANCE_SLOT_IDS, ISLAND_APPEARANCE_VERSIONS,
    islandAppearanceStyleId } from '../../../domain/island/appearance';
import { IslandPartMaterials } from './appearanceParts';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { createIslandGrassSurface, ISLAND_GRASS_BLADE_HALF_LENGTH, ISLAND_GRASS_SURFACE_CANDIDATE } from './grassSurface';
import { IslandMaterials, batch, disposeGeometry, mesh } from './primitives';
import { makeScenery } from './scenery';

function capMeshes(groups: readonly THREE.Object3D[]) {
    const result: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
    for (const group of groups) group.traverse(child => {
        if (!(child instanceof THREE.Mesh) || !(child.material instanceof THREE.MeshStandardMaterial)) return;
        const points = child.geometry.getAttribute('position');
        if (Array.from({ length: points.count }, (_, i) => points.getY(i)).every(y => y === 0)) result.push(child);
    });
    return result;
}
const capShape = (caps: ReturnType<typeof capMeshes>) => caps.map(({ geometry }) => ({
    position: Array.from(geometry.getAttribute('position').array), normal: Array.from(geometry.getAttribute('normal').array),
    color: Array.from(geometry.getAttribute('color').array), index: geometry.index ? Array.from(geometry.index.array) : null,
}));

describe('default mint lawn bump surface', () => {
    // Fixed31 saved cameras, at their actual PNG dimensions. Projection alone
    // cannot establish the lit blade's visible area or whether it looks like grass.
    it.each([
        { view: 'phone overview', width: 390, height: 338, px: .08377, py: .09666 },
        { view: 'phone near', width: 390, height: 338, px: .13089, py: .15103 },
        { view: 'tablet overview', width: 768, height: 410, px: .08377, py: .15692 },
        { view: 'tablet near', width: 768, height: 410, px: .13089, py: .24518 },
    ])('retains the representative leaf in $view without changing ground UVs', ({ width, height, px, py }) => {
        const materials = new IslandPartMaterials('legacy-v1:moon-garden:ground');
        const scenery = makeScenery(materials, 'ground');
        try {
            const cap = capMeshes([scenery])[0], position = cap.geometry.getAttribute('position'), uv = cap.geometry.getAttribute('uv');
            for (let i = 0; i < uv.count; i++) {
                expect(uv.getX(i)).toBeCloseTo(position.getX(i) / 1.15 + .5, 5);
                expect(uv.getY(i)).toBeCloseTo(position.getZ(i) / 1.15 + .5, 5);
            }
            const texture = cap.material.bumpMap!;
            expect(texture.repeat.toArray()).toEqual([.25, .25]);
            const world = new THREE.Matrix4().fromArray([
                .94440, 0, -.32879, 0, -.17236, .85157, -.49509, 0,
                .27999, .52424, .80423, 0, 4.7, 9.65, 13.47, 1,
            ]);
            const projection = new THREE.Matrix4().makeScale(px, py, -.02002).multiply(world.invert());
            const project = (x: number, z: number) => {
                const p = new THREE.Vector3(x, 0, z).applyMatrix4(projection);
                return new THREE.Vector2(p.x * width / 2, -p.y * height / 2);
            };
            const origin = project(0, 0), pixels = ISLAND_GRASS_BLADE_HALF_LENGTH[0] + ISLAND_GRASS_BLADE_HALF_LENGTH[1];
            const length = pixels / texture.image.width * 1.15 / texture.repeat.x;
            const lengths = Array.from({ length: 180 }, (_, i) => {
                const angle = i / 180 * Math.PI;
                return project(Math.cos(angle) * length, Math.sin(angle) * length).distanceTo(origin);
            });
            expect(Math.min(...lengths)).toBeGreaterThan(2);
            if (width === 390) expect(Math.min(...lengths) * texture.repeat.x).toBeLessThan(2); // Former repeat=1 failed.
        } finally { disposeGeometry(scenery); materials.dispose(); }
    });

    it('selects the semantic default ground without replacing existing surface maps', () => {
        for (const family of APPEARANCE_FAMILIES) for (const version of ISLAND_APPEARANCE_VERSIONS) {
            for (const slot of ISLAND_APPEARANCE_SLOT_IDS) {
                const style = islandAppearanceStyleId(family, slot, version), base = new THREE.MeshStandardMaterial();
                const result = createIslandGrassSurface(base, style);
                expect(Boolean(result), style).toBe(style === 'legacy-v1:moon-garden:ground');
                expect(base.bumpMap).toBeNull(); expect(base.name).toBe('');
                result?.dispose(); base.dispose();
            }
        }
        for (const property of ['map', 'bumpMap', 'normalMap', 'displacementMap'] as const) {
            const texture = new THREE.Texture(), base = new THREE.MeshStandardMaterial({ [property]: texture });
            expect(createIslandGrassSurface(base, 'legacy-v1:moon-garden:ground')).toBeUndefined();
            expect(base[property]).toBe(texture); base.dispose(); texture.dispose();
        }
    });

    it('creates one deterministic mipmapped height texture and leaves albedo and shader hooks alone', () => {
        const base = new THREE.MeshStandardMaterial({ color: '#68c8a8', roughness: .98 });
        const a = createIslandGrassSurface(base, 'legacy-v1:moon-garden:ground')!;
        const b = createIslandGrassSurface(base, 'legacy-v1:moon-garden:ground')!;
        try {
            expect(a.texture.image.data).toEqual(b.texture.image.data);
            expect(a.texture.image.width).toBe(128); expect(a.texture.image.height).toBe(128);
            expect(a.texture.image.data.byteLength).toBe(128 * 128);
            expect(new Set(a.texture.image.data).size).toBeGreaterThan(100);
            expect(a.texture.format).toBe(THREE.RedFormat); expect(a.texture.colorSpace).toBe(THREE.NoColorSpace);
            expect(a.texture.wrapS).toBe(THREE.RepeatWrapping); expect(a.texture.wrapT).toBe(THREE.RepeatWrapping);
            expect(a.texture.generateMipmaps).toBe(true);
            expect(a.texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
            expect(a.material.color.toArray()).toEqual(base.color.toArray());
            expect(a.material.roughness).toBe(base.roughness); expect(a.material.map).toBeNull();
            expect(a.material.onBeforeCompile).toBe(base.onBeforeCompile);
            expect(a.material.customProgramCacheKey()).toBe(base.customProgramCacheKey());
            expect(a.material.bumpMap).toBe(a.texture); expect(a.material.bumpScale).toBe(1.2);
            expect(a.material.displacementMap).toBeNull();
            let textureRetired = 0, materialRetired = 0;
            a.texture.addEventListener('dispose', () => textureRetired++);
            a.material.addEventListener('dispose', () => materialRetired++);
            a.dispose(); a.dispose(); expect(textureRetired).toBe(1); expect(materialRetired).toBe(1);
        } finally { a.dispose(); b.dispose(); base.dispose(); }
    });

    it('retains bump UVs and material through painted batching while ordinary solids still merge', () => {
        const base = new THREE.MeshStandardMaterial({ color: '#68c8a8', roughness: .98 });
        const grass = createIslandGrassSurface(base, 'legacy-v1:moon-garden:ground')!;
        const painted = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .98 });
        const group = new THREE.Group(), plane = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
        const expanded = plane.toNonIndexed(), expectedUV = Array.from(expanded.getAttribute('uv').array);
        expanded.dispose();
        mesh(group, plane, grass.material);
        mesh(group, new THREE.BoxGeometry(1, 1, 1), base, [2, 0, 0]);
        batch(group, painted);
        try {
            const children = group.children as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
            const bumped = children.find(child => child.material.bumpMap)!;
            expect(bumped.material).toBe(grass.material); expect(bumped.material.bumpMap).toBe(grass.texture);
            expect(Array.from(bumped.geometry.getAttribute('uv').array)).toEqual(expectedUV);
            const solid = children.find(child => child.material === painted)!;
            expect(solid).toBeDefined(); expect(solid.geometry.getAttribute('uv')).toBeUndefined();
            expect(solid.geometry.getAttribute('color')).toBeDefined();
        } finally { disposeGeometry(group); grass.dispose(); base.dispose(); painted.dispose(); }
    });

    it('keeps the original level mesh, normals, vertex colors and shadows with cap UVs', () => {
        const legacy = new IslandMaterials('moon-garden');
        const selected = new IslandPartMaterials('legacy-v1:moon-garden:ground');
        const oldScene = makeScenery(legacy, 'ground'), newScene = makeScenery(selected, 'ground');
        try {
            const before = capMeshes([oldScene]), after = capMeshes([newScene]);
            expect(after).toHaveLength(1); expect(capShape(after)).toEqual(capShape(before));
            expect(after[0].matrix.toArray()).toEqual(before[0].matrix.toArray());
            expect(after[0].castShadow).toBe(before[0].castShadow);
            expect(after[0].receiveShadow).toBe(before[0].receiveShadow);
            const a = after[0].material, b = before[0].material;
            expect(a.color.toArray()).toEqual(b.color.toArray()); expect(a.roughness).toBe(b.roughness);
            expect(a.metalness).toBe(b.metalness); expect(a.vertexColors).toBe(b.vertexColors);
            expect(a.transparent).toBe(false); expect(a.opacity).toBe(1); expect(a.map).toBeNull();
            expect(a.name).toBe(ISLAND_GRASS_SURFACE_CANDIDATE);
            const pooled = selected.surface('#72ab50', .98);
            expect(a).not.toBe(pooled); expect(a.bumpMap).toBe(pooled.bumpMap);
            const uv = after[0].geometry.getAttribute('uv');
            expect(uv.count).toBe(after[0].geometry.getAttribute('position').count);
            expect(Math.max(...Array.from({ length: uv.count }, (_, i) => uv.getX(i)))
                - Math.min(...Array.from({ length: uv.count }, (_, i) => uv.getX(i)))).toBeGreaterThan(4);
        } finally { disposeGeometry(oldScene); disposeGeometry(newScene); legacy.dispose(); selected.dispose(); }
    });

    it('keeps the visible cap texture and retires it once on purchase, restore and exit', () => {
        const world = new IslandCosmeticScenery(), caps = capMeshes(world.partObjects('ground'));
        const baseline = capShape(caps), disposed = caps.map(() => 0);
        caps.forEach(({ material }, i) => material.addEventListener('dispose', () => disposed[i]++));
        const textures = new Set(caps.map(({ material }) => material.bumpMap)), texture = [...textures][0]!;
        let textureRetired = 0; texture.addEventListener('dispose', () => textureRetired++);
        const shore = world.partObjects('shore'), water = world.partObjects('water'), tree = world.tree;
        try {
            expect(caps).toHaveLength(1); expect(textures.size).toBe(1);
            expect(world.updateAppearance()).toBe(false); expect(capMeshes(world.partObjects('ground'))).toEqual(caps);
            const appearance = structuredClone(world.appearance);
            appearance.slots.ground = islandAppearanceStyleId('candy', 'ground');
            const choice = { themeId: 'moon-garden' as const, accentId: null, appearance };
            world.updateAppearance(choice);
            const purchased = capMeshes(world.partObjects('ground'));
            expect(capShape(purchased)).toEqual(baseline); expect(disposed).toEqual([1]);
            expect(textureRetired).toBe(1);
            expect(purchased.every(({ material }) => material.name === 'biscuit-ground-v1' && material.map && !material.bumpMap)).toBe(true);
            expect(purchased.every(({ material }) => material.map!.repeat.equals(new THREE.Vector2(1, 1)))).toBe(true);
            expect(world.partObjects('shore')).toEqual(shore); expect(world.partObjects('water')).toEqual(water);
            expect(world.tree).toBe(tree);
            appearance.slots.ground = 'legacy-v1:moon-garden:ground'; world.updateAppearance(choice);
            const restored = capMeshes(world.partObjects('ground')), restoredTexture = restored[0].material.bumpMap!;
            expect(capShape(restored)).toEqual(baseline); expect(restoredTexture).not.toBe(texture);
            let restoredRetired = 0; restoredTexture.addEventListener('dispose', () => restoredRetired++);
            world.dispose(); world.dispose();
            expect(restoredRetired).toBe(1); expect(textureRetired).toBe(1); expect(disposed).toEqual([1]);
        } finally { world.dispose(); }
    });
});
