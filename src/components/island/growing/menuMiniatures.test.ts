import * as T from 'three';
import { describe, expect, it, vi } from 'vitest';
import { IslandMaterials } from '../three/primitives';
import { menuMiniature, menuPictureMaker, visibleBounds } from './menuMiniatures';
import { wonder } from './wonderPaint';
import type { Villager } from '../../../domain/growingIsland/types';
const people: Villager[] = Array.from({ length: 8 }, (_, i) => ({ id: `friend-${i}`, species: i % 2 ? 'otter' : 'rabbit', variant: { color: i, accessory: 0, sparkle: false }, trait: 'mellow', home: 'pokomoko', arrivedAt: i }));
describe('world miniatures for the optional menu', () => {
    it('removes empty margins without trimming the visible feet or plot platform', () => {
        const pixels = new Uint8ClampedArray(6 * 5 * 4);
        expect(visibleBounds(pixels, 6, 5)).toBeUndefined();
        pixels[(1 * 6 + 2) * 4 + 3] = 255; pixels[(4 * 6 + 5) * 4 + 3] = 255;
        expect(visibleBounds(pixels, 6, 5)).toEqual({ left: 2, top: 1, width: 4, height: 4 });
    });
    it('uses only the first three actual resident IDs and shows no residents for an empty island', () => {
        const m = new IslandMaterials();
        const populated = menuMiniature(m, people);
        expect(populated.children.filter(c => c.userData.actorId).map(c => c.userData.actorId)).toEqual(['friend-0', 'friend-1', 'friend-2']);
        expect(menuMiniature(m, []).children.filter(c => c.userData.actorId)).toHaveLength(0);
        m.dispose();
    });
    it('shows the real unbuilt home plot and never a grown house', () => {
        const m = new IslandMaterials(), root = menuMiniature(m);
        expect(root.getObjectByName('plot-flag')).toBeDefined();
        expect(root.children.filter(c => c.userData.actorId)).toHaveLength(0);
        m.dispose();
    });
    it('restores the active render target and clear settings after a failed picture without disposing shared materials', () => {
        const m = new IslandMaterials(), material = m.surface('#b7ce9f', .9), dispose = vi.spyOn(material, 'dispose');
        const original = new T.WebGLRenderTarget(20, 10), color = new T.Color('#123456');
        const renderer = { getRenderTarget: () => original, getClearColor: (target: T.Color) => target.copy(color), getClearAlpha: () => .6,
            setRenderTarget: vi.fn(), setClearColor: vi.fn(), render: vi.fn(() => { throw new Error('context lost'); }) };
        const render = menuPictureMaker(renderer as unknown as T.WebGLRenderer, m);
        expect(render(people)).toEqual({ friends: undefined, seeds: undefined });
        expect(renderer.setRenderTarget).toHaveBeenLastCalledWith(original);
        expect(renderer.setClearColor).toHaveBeenLastCalledWith(color, .6);
        expect(dispose).not.toHaveBeenCalled();
        const attempts = renderer.render.mock.calls.length;
        render([...people, { ...people[0], id: 'ignored-extra' }]);
        expect(renderer.render.mock.calls.length).toBeGreaterThan(attempts);
        render([{ ...people[0], outfit: { hat: 2 } }]);
        expect(renderer.render.mock.calls.length).toBeGreaterThan(attempts);
        original.dispose(); m.dispose();
    });

    it.each(['success', 'throw'] as const)('releases the actor sparkle and platform after a %s render, preserving shared paint', outcome => {
        const m = new IslandMaterials(), sharedPaint = wonder('dots-red');
        const paintDispose = vi.spyOn(sharedPaint, 'dispose');
        const geometryDisposals = new Map<T.BufferGeometry, number>(), materialDisposals = new Map<T.Material, number>();
        const sparkleMaterials = new Set<T.Material>();
        const context = { createImageData: (width: number, height: number) => ({ data: new Uint8ClampedArray(width * height * 4) }), putImageData: vi.fn() };
        vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => context, toDataURL: () => 'data:image/png;base64,miniature' }) });
        const renderer = {
            getRenderTarget: () => null, getClearColor: (target: T.Color) => target, getClearAlpha: () => 1,
            setRenderTarget: vi.fn(), setClearColor: vi.fn(),
            render: (scene: T.Scene) => {
                scene.traverse(object => {
                    if (!(object instanceof T.Mesh)) return;
                    const geometry = object.geometry;
                    if (!geometryDisposals.has(geometry)) {
                        geometryDisposals.set(geometry, 0);
                        geometry.addEventListener('dispose', () => geometryDisposals.set(geometry, geometryDisposals.get(geometry)! + 1));
                    }
                    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                        if (object.name === 'growing-sparkle') sparkleMaterials.add(material);
                        if (materialDisposals.has(material)) continue;
                        materialDisposals.set(material, 0);
                        material.addEventListener('dispose', () => materialDisposals.set(material, materialDisposals.get(material)! + 1));
                    }
                });
                if (outcome === 'throw') throw new Error('context lost');
            },
            readRenderTargetPixels: (_target: T.WebGLRenderTarget, _x: number, _y: number, _width: number, _height: number, pixels: Uint8Array) => { pixels[3] = 255; },
        };
        try {
            const pictures = menuPictureMaker(renderer as unknown as T.WebGLRenderer, m)([{ ...people[0], variant: { ...people[0].variant, sparkle: true } }]);
            expect(pictures.friends).toBe(outcome === 'success' ? 'data:image/png;base64,miniature' : undefined);
            expect(sparkleMaterials.size).toBe(1);
            expect([...geometryDisposals.values()].every(count => count === 1)).toBe(true);
            for (const [material, count] of materialDisposals) expect(count).toBe(sparkleMaterials.has(material) ? 1 : 0);
            expect(paintDispose).not.toHaveBeenCalled();
        } finally { vi.unstubAllGlobals(); paintDispose.mockRestore(); m.dispose(); }
    });
});
