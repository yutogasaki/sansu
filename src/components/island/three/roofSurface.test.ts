import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { APPEARANCE_FAMILIES, ISLAND_APPEARANCE_SLOT_IDS, ISLAND_APPEARANCE_VERSIONS,
    createIslandAppearance, islandAppearanceStyleId } from '../../../domain/island/appearance';
import { IslandPartMaterials } from './appearanceParts';
import { IslandCosmeticScenery } from './cosmeticScenery';
import { cottageRoofGeometry } from './geometry';
import { IslandPlacementOcclusion } from './placementOcclusion';
import { IslandMaterials, batch, disposeGeometry, mesh } from './primitives';
import { createIslandRoofSurface, ISLAND_ROOF_SURFACE_CANDIDATE } from './roofSurface';
import { makeScenery } from './scenery';

const pixel = (texture: THREE.DataTexture, x: number, y: number) => {
    const index = (y * texture.image.width + x) * 4;
    return Array.from(texture.image.data.slice(index, index + 4));
};
const actualMeshes = (roots: readonly THREE.Object3D[]) => {
    const result: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
    for (const root of roots) root.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) result.push(child);
    });
    return result;
};

describe('default roof material prototype', () => {
    it('limits the pool to the exact legacy default roof style', () => {
        for (const family of APPEARANCE_FAMILIES) for (const version of ISLAND_APPEARANCE_VERSIONS) {
            for (const slot of ISLAND_APPEARANCE_SLOT_IDS) {
                const id = islandAppearanceStyleId(family, slot, version), pool = createIslandRoofSurface(id);
                expect(Boolean(pool), id).toBe(id === 'legacy-v1:moon-garden:houseRoof');
                pool?.dispose();
            }
        }
    });

    it('handles only the roof face and four warm seams, preserving requested surface properties', () => {
        const pool = createIslandRoofSurface('legacy-v1:moon-garden:houseRoof')!;
        try {
            for (const source of ['#dc7c62', '#dc795d', '#426857', '#72ab50', '#f7e8c6']) {
                expect(pool.surface(source, .76)).toBeUndefined();
            }
            expect(pool.surface('#c24f3e', .76, 0, true)).toBeUndefined();
            for (const source of ['#eb8a5a', '#ed9967', '#de7956', '#e58259']) {
                const material = pool.surface(source, .76, .12)!;
                expect(material.map).toBeNull(); expect(material.roughness).toBe(.76);
                expect(material.metalness).toBe(.12); expect(material.emissive.getHex()).toBe(0);
                // A light warm seam instead of the old near-black palette ink.
                expect(material.color.r).toBeGreaterThan(material.color.g);
                expect(material.color.g).toBeGreaterThan(material.color.b);
                expect(material.color.r).toBeGreaterThan(.5);
            }
            expect(pool.texture).toBeUndefined(); // Seams do not allocate an unused roof map.
        } finally { pool.dispose(); }
    });

    it('keeps opaque, deterministic broad colors continuous across both texture edges', () => {
        const a = createIslandRoofSurface('legacy-v1:moon-garden:houseRoof')!;
        const b = createIslandRoofSurface('legacy-v1:moon-garden:houseRoof')!;
        try {
            const material = a.surface('#c24f3e', .76)!;
            b.surface('#c24f3e', .76);
            const texture = a.texture!;
            expect(texture.image.data).toEqual(b.texture!.image.data);
            expect(texture.image.width).toBe(128); expect(texture.image.height).toBe(128);
            expect(texture.name).toBe(ISLAND_ROOF_SURFACE_CANDIDATE);
            expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
            expect(texture.generateMipmaps).toBe(true);
            expect(texture.minFilter).toBe(THREE.LinearMipmapLinearFilter);
            expect(texture.repeat.toArray()).toEqual([1, 1]);
            expect(material.color.getHexString()).toBe('ffffff'); expect(material.roughness).toBe(.76);
            expect(material.bumpMap).toBeNull(); expect(material.displacementMap).toBeNull();
            let yellow = 0;
            for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
                const [r, g, blue, alpha] = pixel(texture, x, y);
                expect(alpha).toBe(255); expect(Math.min(r, g, blue)).toBeGreaterThan(85);
                if (r > g && g > blue + 20) yellow++;
            }
            expect(yellow / (128 * 128)).toBeGreaterThan(.5);
            for (let i = 0; i < 128; i++) {
                expect(pixel(texture, 0, i)).toEqual(pixel(texture, 127, i));
                expect(pixel(texture, i, 0)).toEqual(pixel(texture, i, 127));
            }
            // The pink tile still covers its lower center; the rounded lower
            // corner reveals the yellow tile below. It is not a rectangular grid.
            const center = pixel(texture, 48, 46), corner = pixel(texture, 61, 46);
            expect(center[2]).toBeGreaterThan(center[1] - 10);
            expect(corner[1]).toBeGreaterThan(corner[2] + 20);
        } finally { a.dispose(); b.dispose(); }
    });

    it('shares one texture through real shell batching and retires sources without double-disposing borrowed clones', () => {
        const pool = createIslandRoofSurface('legacy-v1:moon-garden:houseRoof')!;
        const source = pool.surface('#c24f3e', .76)!, other = pool.surface('#c24f3e', .88)!;
        const seam = pool.surface('#eb8a5a', .76)!;
        expect(pool.surface('#C24F3E', .76)).toBe(source);
        expect(other).not.toBe(source); expect(other.map).toBe(source.map);
        const texture = pool.texture!, clone = source.clone(); clone.userData.islandOwned = true;
        const group = new THREE.Group(), geometry = cottageRoofGeometry();
        const originalUV = Array.from(geometry.getAttribute('uv').array);
        const originalPositions = Array.from(geometry.getAttribute('position').array);
        let textureDisposed = 0, sourceDisposed = 0, otherDisposed = 0, seamDisposed = 0, cloneDisposed = 0;
        texture.addEventListener('dispose', () => textureDisposed++);
        source.addEventListener('dispose', () => sourceDisposed++);
        other.addEventListener('dispose', () => otherDisposed++);
        seam.addEventListener('dispose', () => seamDisposed++);
        clone.addEventListener('dispose', () => cloneDisposed++);
        mesh(group, geometry, clone); batch(group);
        const actual = group.children[0] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
        expect(Array.from(actual.geometry.getAttribute('position').array)).toEqual(originalPositions);
        expect(Array.from(actual.geometry.getAttribute('uv').array)).toEqual(originalUV);
        expect(actual.material).toBe(clone); expect(actual.material.map).toBe(texture);
        disposeGeometry(group);
        expect(cloneDisposed).toBe(1); expect(textureDisposed).toBe(0); expect(sourceDisposed).toBe(0);
        pool.dispose(); pool.dispose();
        expect([textureDisposed, sourceDisposed, otherDisposed, seamDisposed]).toEqual([1, 1, 1, 1]);
        expect(pool.surface('#c24f3e', .76)).toBeUndefined();
    });

    it('delivers the mapped face and all four seams through the actual scenery builder without leaking into other styles', () => {
        const sourceColors = ['#c24f3e', '#eb8a5a', '#ed9967', '#de7956', '#e58259'];
        const materials = new IslandPartMaterials('legacy-v1:moon-garden:houseRoof');
        const scenery = makeScenery(materials, 'houseRoof');
        try {
            const meshes = actualMeshes([scenery]), drawn = new Set(meshes.map(object => object.material));
            for (const color of sourceColors) expect(drawn.has(materials.surface(color, .76)), color).toBe(true);
            const face = meshes.find(object => object.material === materials.surface('#c24f3e', .76))!;
            expect(face.material.map?.name).toBe(ISLAND_ROOF_SURFACE_CANDIDATE);
            expect(face.geometry.getAttribute('uv')?.count).toBe(face.geometry.getAttribute('position').count);
            for (const color of sourceColors.slice(1)) {
                expect(materials.surface(color, .76).name).toBe(`${ISLAND_ROOF_SURFACE_CANDIDATE}:${color}`);
            }
        } finally { disposeGeometry(scenery); materials.dispose(); }

        const cases = APPEARANCE_FAMILIES.flatMap(family => ISLAND_APPEARANCE_VERSIONS.map(version => ({
            family, version, slot: 'houseRoof' as const,
        }))).filter(({ family, version }) => family !== 'moon-garden' || version !== 'legacy-v1');
        const otherSlots = (['houseBody', 'houseWindows'] as const).map(slot => ({
            family: 'moon-garden' as const, version: 'legacy-v1' as const, slot,
        }));
        for (const { family, version, slot } of [...cases, ...otherSlots]) {
            const style = islandAppearanceStyleId(family, slot, version);
            const selected = new IslandPartMaterials(style), previous = new IslandMaterials(family);
            const actual = makeScenery(selected, slot);
            try {
                expect(actualMeshes([actual]).some(object => object.material.name.startsWith(ISLAND_ROOF_SURFACE_CANDIDATE)), style).toBe(false);
                for (const color of sourceColors) {
                    const a = selected.surface(color, .76), b = previous.surface(color, .76);
                    expect(a.color.toArray(), `${style}:${color}`).toEqual(b.color.toArray());
                    expect(a.roughness).toBe(b.roughness); expect(a.metalness).toBe(b.metalness);
                    expect(a.map?.image.data).toEqual(b.map?.image.data);
                }
            } finally { disposeGeometry(actual); selected.dispose(); previous.dispose(); }
        }
    });

    it('restores an actual placement clone before retiring the roof pool on an explicit-style switch', () => {
        const world = new IslandCosmeticScenery(), occlusion = new IslandPlacementOcclusion();
        const preview = new THREE.Mesh(new THREE.BoxGeometry(.3, .3, .3), new THREE.MeshBasicMaterial());
        try {
            const roof = actualMeshes(world.partObjects('houseRoof')).find(object => object.material.map?.name === ISLAND_ROOF_SURFACE_CANDIDATE)!;
            const original = roof.material, texture = original.map!;
            const body = world.partObjects('houseBody'), windows = world.partObjects('houseWindows');
            let textureRetired = 0, sourceRetired = 0, cloneRetired = 0;
            texture.addEventListener('dispose', () => textureRetired++);
            original.addEventListener('dispose', () => sourceRetired++);
            const center = new THREE.Box3().setFromObject(roof, true).getCenter(new THREE.Vector3());
            const camera = new THREE.OrthographicCamera(-3, 3, 3, -3, .1, 30);
            camera.position.copy(center).add(new THREE.Vector3(0, 2, 8)); camera.lookAt(center); camera.updateMatrixWorld(true);
            preview.position.copy(center).add(new THREE.Vector3(0, -.5, -2));
            occlusion.update(preview, [], camera, world.partObjects('houseRoof'));
            const clone = roof.material;
            expect(clone).not.toBe(original); expect(clone.map).toBe(texture);
            clone.addEventListener('dispose', () => cloneRetired++);
            // This is the same restore-before-rebuild ownership boundary as runtime.update.
            occlusion.restore(); expect(roof.material).toBe(original);
            expect([cloneRetired, sourceRetired, textureRetired]).toEqual([1, 0, 0]);
            const appearance = createIslandAppearance('moon-garden', 'legacy-v1');
            appearance.slots.houseRoof = 'parts-v1:moon-garden:houseRoof';
            world.updateAppearance({ themeId: 'moon-garden', accentId: null, appearance });
            expect([cloneRetired, sourceRetired, textureRetired]).toEqual([1, 1, 1]);
            expect(actualMeshes(world.partObjects('houseRoof')).some(object => object.material.map === texture)).toBe(false);
            expect(actualMeshes(world.partObjects('houseRoof')).some(object => object.material.map?.name === ISLAND_ROOF_SURFACE_CANDIDATE)).toBe(false);
            expect(world.partObjects('houseBody')).toEqual(body); expect(world.partObjects('houseWindows')).toEqual(windows);
            appearance.slots.houseRoof = 'legacy-v1:moon-garden:houseRoof';
            world.updateAppearance({ themeId: 'moon-garden', accentId: null, appearance });
            const renewed = actualMeshes(world.partObjects('houseRoof')).find(object => object.material.map?.name === ISLAND_ROOF_SURFACE_CANDIDATE)!.material.map!;
            expect(renewed).not.toBe(texture);
            let renewedRetired = 0; renewed.addEventListener('dispose', () => renewedRetired++);
            world.dispose(); world.dispose();
            expect([cloneRetired, sourceRetired, textureRetired, renewedRetired]).toEqual([1, 1, 1, 1]);
        } finally { occlusion.restore(); world.dispose(); preview.geometry.dispose(); preview.material.dispose(); }
    });
});
