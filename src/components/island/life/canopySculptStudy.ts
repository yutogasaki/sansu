import * as T from 'three';
import { canopyShoreStudy } from './canopyShoreStudy';
import { canopyGroundVariant } from './canopyGroundStudy';

export type SculptStudy = 'traced' | 'buttress' | 'recess';
const requested = import.meta.env.VITE_CANOPY_SCULPT_STUDY;
export const canopySculptStudy: SculptStudy | undefined = canopyShoreStudy === 'lagoon' && canopyGroundVariant === 'turf'
    && (requested === 'traced' || requested === 'buttress' || requested === 'recess') ? requested : undefined;

/** Keep the original timber until the authored offline geometry is ready. */
export function loadCanopySculpt(root: T.Group, timber: T.Group, material: T.Material, variant: SculptStudy) {
    let disposed = false;
    root.userData.visualCandidate = `canopy-sculpt-${variant}-study-v2`;
    root.userData.sculptStatus = 'loading';
    new T.BufferGeometryLoader().load(`/docs/design/2026-09-14-canopy-sculpt/meshes/${variant}.json`, geometry => {
        if (disposed) { geometry.dispose(); return; }
        const mesh = new T.Mesh(geometry, material);
        mesh.name = 'life-canopy-sculpt'; mesh.castShadow = mesh.receiveShadow = true;
        root.add(mesh); timber.visible = false; root.userData.sculptStatus = 'ready';
    }, undefined, () => { if (!disposed) root.userData.sculptStatus = 'fallback'; });
    // The parent scene owns attached geometries and the existing wood material.
    return () => { disposed = true; };
}
