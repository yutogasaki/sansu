import { afterEach, expect, it, vi } from 'vitest';
import * as T from 'three';
import { makeCanopyGroundStudy, type CanopyGroundVariant } from './canopyGroundStudy';

afterEach(() => vi.restoreAllMocks());
function fixture(variant: CanopyGroundVariant = 'turf') {
    const texture = new T.Texture();
    let loaded: ((texture: T.Texture) => void) | undefined;
    let failed: ((error: unknown) => void) | undefined;
    vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad, _progress, onError) => {
        loaded = onLoad; failed = onError; return texture;
    });
    const mesh = new T.Mesh(new T.BoxGeometry(12, .15, 8), new T.MeshStandardMaterial());
    const positions = Array.from(mesh.geometry.getAttribute('position').array);
    const root = new T.Group(); root.add(mesh);
    const dispose = makeCanopyGroundStudy(mesh, root, 2.5, variant);
    return { mesh, positions, root, texture, dispose, loaded: () => loaded!(texture), failed: () => failed!(new Error('offline')) };
}

it.each(['moss', 'turf', 'earth'] as const)('keeps expanded ground positions and hit geometry for %s', variant => {
    const f = fixture(variant);
    expect(Array.from(f.mesh.geometry.getAttribute('position').array)).toEqual(f.positions);
    expect(f.root.children).toEqual([f.mesh]);
    const uv = f.mesh.geometry.getAttribute('uv');
    expect(Array.from(uv.array).every(v => Number.isFinite(v) && v >= 0 && v <= 1)).toBe(true);
    expect(f.root.userData.visualCandidate).toBe(`canopy-ground-${variant}-study-v1`);
    f.dispose(); f.mesh.geometry.dispose(); f.mesh.material.dispose();
});

it('retains the ground fallback on failure and releases only its own resources once', () => {
    const f = fixture(), fallback = f.mesh.material.map!;
    const fallbackDisposed = vi.fn(), textureDisposed = vi.fn(), materialDisposed = vi.fn();
    fallback.addEventListener('dispose', fallbackDisposed);
    f.texture.addEventListener('dispose', textureDisposed);
    f.mesh.material.addEventListener('dispose', materialDisposed);
    f.failed();
    expect(f.mesh.material.map).toBe(fallback);
    expect(f.root.userData.groundMaterialStatus).toBe('fallback');
    f.dispose(); f.dispose();
    expect(fallbackDisposed).toHaveBeenCalledOnce();
    expect(textureDisposed).toHaveBeenCalledOnce();
    expect(materialDisposed).not.toHaveBeenCalled();
    f.mesh.geometry.dispose(); f.mesh.material.dispose();
});

it('does not revive a scene when an image arrives after teardown', () => {
    const f = fixture(), fallback = f.mesh.material.map;
    f.dispose(); f.loaded();
    expect(f.mesh.material.map).toBe(fallback);
    expect(f.root.userData.groundMaterialStatus).not.toBe('ready');
    f.mesh.geometry.dispose(); f.mesh.material.dispose();
});

it('uses the loaded material without taking ownership of the existing bump map', () => {
    const f = fixture(), bump = new T.Texture(), bumpDisposed = vi.fn();
    bump.addEventListener('dispose', bumpDisposed); f.mesh.material.bumpMap = bump;
    f.loaded();
    expect(f.mesh.material.map).toBe(f.texture);
    expect(f.root.userData.groundMaterialStatus).toBe('ready');
    f.dispose();
    expect(f.mesh.material.bumpMap).toBe(bump);
    expect(bumpDisposed).not.toHaveBeenCalled();
    bump.dispose(); f.mesh.geometry.dispose(); f.mesh.material.dispose();
});
