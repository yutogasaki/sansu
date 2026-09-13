import * as T from 'three';

/** Local art study only: the source image is deliberately outside public/precache. */
export const canopyMaterialStudy = import.meta.env.DEV
    && import.meta.env.VITE_CANOPY_MATERIAL_STUDY === 'true';

export function makeCanopyStudyWood(material: T.MeshStandardMaterial, root: T.Group) {
    // A mapped fallback must exist before batching, which otherwise removes UVs.
    const fallback = new T.DataTexture(new Uint8Array([150, 111, 73, 255]), 1, 1);
    fallback.colorSpace = T.SRGBColorSpace; fallback.needsUpdate = true;
    material.map = fallback; material.roughness = .9;
    root.userData.materialStatus = 'loading';
    let disposed = false;
    const texture = new T.TextureLoader().load('/docs/design/2026-09-14-canopy-materials/bark-albedo-candidate-2.png', loaded => {
        if (disposed) { loaded.dispose(); return; }
        material.map = material.bumpMap = loaded; material.bumpScale = .025;
        material.needsUpdate = true; root.userData.materialStatus = 'ready';
    }, undefined, () => { if (!disposed) root.userData.materialStatus = 'fallback'; });
    texture.colorSpace = T.SRGBColorSpace;
    texture.wrapS = texture.wrapT = T.RepeatWrapping;
    texture.anisotropy = 4;
    return () => { disposed = true; fallback.dispose(); texture.dispose(); };
}
