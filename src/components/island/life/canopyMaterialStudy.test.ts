import { afterEach, expect, it, vi } from 'vitest';
import * as T from 'three';
import { batch, disposeGeometry } from '../three/primitives';
import { makeCanopyStudyWood } from './canopyMaterialStudy';

afterEach(() => vi.restoreAllMocks());
function fixture() {
    let loaded: ((texture: T.Texture) => void) | undefined;
    let failed: ((error: unknown) => void) | undefined;
    const texture = new T.Texture();
    vi.spyOn(T.TextureLoader.prototype, 'load').mockImplementation((_url, onLoad, _progress, onError) => {
        loaded = onLoad; failed = onError; return texture;
    });
    const material = new T.MeshStandardMaterial(), root = new T.Group();
    const dispose = makeCanopyStudyWood(material, root);
    return { material, root, texture, dispose, loaded: () => loaded!(texture), failed: () => failed!(new Error('offline')) };
}

it('retains branch UVs before the asynchronous image is available, including on failure', () => {
    const f = fixture();
    f.root.add(new T.Mesh(new T.TubeGeometry(new T.LineCurve3(new T.Vector3(), new T.Vector3(2, 0, 0))), f.material));
    batch(f.root);
    try {
        expect((f.root.children[0] as T.Mesh).geometry.getAttribute('uv')).toBeDefined();
        const fallback = f.material.map;
        f.failed();
        expect(f.material.map).toBe(fallback);
        expect(f.root.userData.materialStatus).toBe('fallback');
    } finally { disposeGeometry(f.root); f.dispose(); f.material.dispose(); }
});

it('owns and releases both the fallback and the loaded texture', () => {
    const f = fixture(), fallbackDisposed = vi.fn(), imageDisposed = vi.fn();
    f.material.map!.addEventListener('dispose', fallbackDisposed);
    f.texture.addEventListener('dispose', imageDisposed);
    f.loaded();
    expect(f.material.map).toBe(f.texture);
    expect(f.material.bumpMap).toBe(f.texture);
    expect(f.root.userData.materialStatus).toBe('ready');
    f.dispose(); f.material.dispose();
    expect(fallbackDisposed).toHaveBeenCalledOnce();
    expect(imageDisposed).toHaveBeenCalledOnce();
});

it('does not revive an obsolete scene when loading completes after teardown', () => {
    const f = fixture(), fallback = f.material.map, imageDisposed = vi.fn();
    f.texture.addEventListener('dispose', imageDisposed);
    f.dispose(); f.loaded();
    expect(f.material.map).toBe(fallback);
    expect(f.material.bumpMap).toBeNull();
    expect(f.root.userData.materialStatus).not.toBe('ready');
    expect(imageDisposed).toHaveBeenCalledTimes(2);
    f.material.dispose();
});
