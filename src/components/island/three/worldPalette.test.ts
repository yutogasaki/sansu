import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { cottageRoofGeometry } from './geometry';
import { makeFurniture } from './furniture';
import { IslandPlacementPreview } from './placementPreview';
import { batch, disposeGeometry, IslandMaterials, mesh } from './primitives';
import { islandWorldColor, makeWorldPattern, type IslandArtDirection } from './worldPalette';

const cleanup: (() => void)[] = [];
const materials = () => {
    const result = new IslandMaterials();
    cleanup.push(() => result.dispose());
    return result;
};
const group = () => {
    const result = new THREE.Group();
    cleanup.push(() => disposeGeometry(result));
    return result;
};
const meshes = (object: THREE.Object3D) => {
    const result: THREE.Mesh[] = [];
    object.traverse(child => { if (child instanceof THREE.Mesh) result.push(child); });
    return result;
};

beforeEach(() => {
    // Select an explicit direction in both browser-like and node test environments.
    vi.stubGlobal('location', { search: '?island-art=festival' });
    vi.stubEnv('VITE_ISLAND_ART_DIRECTION', 'festival');
});
afterEach(() => {
    cleanup.splice(0).reverse().forEach(dispose => dispose());
    vi.unstubAllGlobals(); vi.unstubAllEnvs();
});

describe('world paint and GPU resource contracts', () => {
    it('paints the roof, crown and mushroom with opaque sRGB patterns while keeping animal faces unpainted', () => {
        for (const direction of ['festival', 'moon-garden', 'prism'] satisfies IslandArtDirection[]) {
            for (const source of ['#c24f3e', '#86b557', '#dc795d']) {
                const texture = makeWorldPattern(source, direction)!;
                cleanup.push(() => texture.dispose());
                expect(texture).toBeInstanceOf(THREE.DataTexture);
                expect([texture.image.width, texture.image.height]).toEqual([128, 128]);
                expect(texture.format).toBe(THREE.RGBAFormat);
                expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
                const pixels = texture.image.data as Uint8Array;
                expect(pixels).toHaveLength(128 * 128 * 4);
                const colors = new Set<string>();
                let opaque = true;
                for (let i = 0; i < pixels.length; i += 4) {
                    colors.add(`#${[pixels[i], pixels[i + 1], pixels[i + 2]].map(value => value.toString(16).padStart(2, '0')).join('')}`);
                    opaque &&= pixels[i + 3] === 255;
                }
                expect(opaque).toBe(true);
                expect(colors.has(islandWorldColor(source, direction))).toBe(true);
                expect(colors.size).toBeGreaterThan(1);
            }
            // Fur, cream muzzle and eyes are semantic identity colors, not world paint keys.
            for (const source of ['#b38154', '#f3ead4', '#fff0d4', '#493e32']) {
                expect(islandWorldColor(source, direction)).toBe(source);
                expect(makeWorldPattern(source, direction)).toBeUndefined();
            }
        }
    });

    it('keeps authored roof UVs through batching and supplies finite UVs for a mapped primitive without them', () => {
        const palette = materials(), model = group(), paint = palette.get('#c24f3e');
        const roof = cottageRoofGeometry(), authored = Array.from(roof.getAttribute('uv').array);
        mesh(model, roof, paint, [2, 1, -1]);
        mesh(model, new THREE.BoxGeometry(1, 1, 1).deleteAttribute('uv'), paint, [-2, 0, 0]);
        batch(model, palette.painted);
        const rendered = meshes(model);
        expect(rendered).toHaveLength(1);
        expect(rendered[0].material).toBe(paint);
        expect(paint.map).toBeInstanceOf(THREE.DataTexture);
        const uv = rendered[0].geometry.getAttribute('uv');
        expect(uv.count).toBe(rendered[0].geometry.getAttribute('position').count);
        expect(Array.from(uv.array).every(Number.isFinite)).toBe(true);
        expect(Array.from(uv.array).slice(0, authored.length)).toEqual(authored);
        const generated = Array.from(uv.array).slice(authored.length);
        expect(Math.max(...generated) - Math.min(...generated)).toBeGreaterThan(.9);
    });

    it('retains visibly different roughness and metalness instead of merging them into the flat painted material', () => {
        const palette = materials(), model = group();
        const metal = palette.surface('#426857', .3, .18), rough = palette.surface('#426857', .95, 0);
        mesh(model, new THREE.BoxGeometry(1, 1, 1), metal);
        mesh(model, new THREE.SphereGeometry(1, 8, 6), rough, [2, 0, 0]);
        mesh(model, new THREE.BoxGeometry(1, 1, 1), palette.get('#b77640'), [-2, 0, 0]);
        batch(model, palette.painted);
        const rendered = meshes(model).map(object => object.material);
        expect(rendered).toHaveLength(3);
        expect(rendered).toContain(metal); expect(rendered).toContain(rough); expect(rendered).toContain(palette.painted);
        expect([metal.roughness, metal.metalness, rough.roughness, rough.metalness]).toEqual([.3, .18, .95, 0]);
    });

    it('shares the real furniture pattern through repeated preview edits and cancels without disposing its texture', () => {
        const palette = materials(), saved = makeFurniture('mushroom', palette), preview = new IslandPlacementPreview(palette);
        cleanup.push(() => disposeGeometry(saved), () => preview.dispose());
        const paint = palette.get('#dc795d'), texture = paint.map!;
        let disposed = 0;
        texture.addEventListener('dispose', () => { disposed++; });
        const savedPaint = meshes(saved).map(object => object.material).find(material =>
            material instanceof THREE.MeshStandardMaterial && material.map === texture) as THREE.MeshStandardMaterial;
        expect(savedPaint).toBe(paint);
        for (let cycle = 0; cycle < 3; cycle++) {
            const item = { id: `mushroom-${cycle}`, kind: 'mushroom' as const, rotation: 0, position: { x: 0, z: 1 } };
            preview.update(item);
            preview.update({ ...item, position: { x: 2, z: 1 }, rotation: Math.PI / 2 }, false);
            const ghost = meshes(preview.group).map(object => object.material).find(material =>
                material instanceof THREE.MeshStandardMaterial && material.map === texture) as THREE.MeshStandardMaterial;
            expect(ghost).toBeDefined(); expect(ghost).not.toBe(savedPaint);
            expect(ghost.map).toBe(savedPaint.map);
            preview.update(undefined);
            expect(disposed).toBe(0);
            expect(savedPaint.map).toBe(texture);
        }
        preview.dispose(); disposeGeometry(saved);
        palette.dispose(); cleanup.length = 0;
        expect(disposed).toBe(1);
    });
});
