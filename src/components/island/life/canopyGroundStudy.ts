import * as T from 'three';
import { canopyMaterialStudy } from './canopyMaterialStudy';

export type CanopyGroundVariant = 'moss' | 'turf' | 'earth';
const requested = import.meta.env.VITE_CANOPY_GROUND_STUDY;
export const canopyGroundVariant: CanopyGroundVariant | undefined = canopyMaterialStudy
    && (requested === 'moss' || requested === 'turf' || requested === 'earth') ? requested : undefined;

/** Material study only. Reuse the level ground geometry; never create a path or obstruction. */
export function makeCanopyGroundStudy(mesh: T.Mesh<T.BufferGeometry, T.MeshStandardMaterial>, root: T.Group, center: number, variant: CanopyGroundVariant) {
    const material = mesh.material, bounds = new T.Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position') as T.BufferAttribute);
    const positions = mesh.geometry.getAttribute('position'), uv: number[] = [];
    for (let i = 0; i < positions.count; i++) uv.push((positions.getX(i) - bounds.min.x) / (bounds.max.x - bounds.min.x), (positions.getZ(i) - bounds.min.z) / (bounds.max.z - bounds.min.z));
    mesh.geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    const fallback = new T.DataTexture(new Uint8Array([139, 161, 86, 255]), 1, 1);
    fallback.colorSpace = T.SRGBColorSpace; fallback.needsUpdate = true;
    material.color.set('#ffffff'); material.map = fallback; material.bumpScale = .035; material.roughness = .96;
    const shade = new T.Color('#316d64');
    material.onBeforeCompile = shader => {
        shader.uniforms.groundRoot = { value: new T.Vector2(4.9 - center, -3.25) };
        shader.uniforms.groundShade = { value: shade };
        shader.vertexShader = 'varying vec2 groundWorld;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ngroundWorld=(modelMatrix*vec4(position,1.0)).xz;');
        shader.fragmentShader = 'varying vec2 groundWorld; uniform vec2 groundRoot; uniform vec3 groundShade;\n' + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
            vec2 recess=(groundWorld-groundRoot)/vec2(2.2,1.0);
            float localShade=exp(-dot(recess,recess)*1.1)*.7;
            diffuseColor.rgb=mix(diffuseColor.rgb,groundShade,localShade);`);
    };
    material.customProgramCacheKey = () => 'canopy-ground-root-shade-study-v1';
    root.userData.visualCandidate = `canopy-ground-${variant}-study-v1`;
    root.userData.groundMaterialStatus = 'loading';
    let disposed = false;
    const texture = new T.TextureLoader().load('/docs/design/2026-09-14-canopy-ground/material-atlas.png', loaded => {
        if (disposed) { loaded.dispose(); return; }
        material.map = loaded; material.needsUpdate = true; root.userData.groundMaterialStatus = 'ready';
    }, undefined, () => { if (!disposed) root.userData.groundMaterialStatus = 'fallback'; });
    // Sample one panel, with a two-pixel inset to reduce sampling of the neighbouring panel in this atlas study.
    const panel = ['moss', 'turf', 'earth'].indexOf(variant), inset = 2 / 2172;
    texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.ClampToEdgeWrapping;
    texture.offset.set(panel / 3 + inset, 2 / 724); texture.repeat.set(1 / 3 - inset * 2, 1 - 4 / 724); texture.anisotropy = 4;
    return () => { if (disposed) return; disposed = true; fallback.dispose(); texture.dispose(); };
}
