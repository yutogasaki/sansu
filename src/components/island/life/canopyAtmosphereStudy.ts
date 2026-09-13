import * as T from 'three';
import { canopySculptStudy } from './canopySculptStudy';

export type AtmosphereStudy = 'garden' | 'shelter' | 'sunroom';
const requested = import.meta.env.VITE_CANOPY_ATMOSPHERE_STUDY;
export const canopyAtmosphereStudy: AtmosphereStudy | undefined = canopySculptStudy === 'buttress'
    && (requested === 'garden' || requested === 'shelter' || requested === 'sunroom') ? requested : undefined;
export const canopyAtmospheres = {
    garden: { offset:[2.6,6,11], floor:4.3, scale:.70, x:.6, y:1.0, sky:'#fff7ea', ground:'#63806c', hemi:1.15, sun:'#fff4e0', strength:2.3, direction:[-3,8,4], fill:0 },
    shelter: { offset:[2.6,5.2,11], floor:4.3, scale:.70, x:.6, y:1.05, sky:'#f2f2e6', ground:'#476e70', hemi:.92, sun:'#fff0d5', strength:2.65, direction:[-4,6,3], fill:.22 },
    sunroom: { offset:[3.2,5.5,11], floor:4.4, scale:.73, x:.7, y:1.1, sky:'#fff5de', ground:'#567b79', hemi:1.05, sun:'#fff0d9', strength:2.4, direction:[-6,7,2], fill:.35 },
} as const;

export function createCanopyLightingStudy(scene:T.Scene, hemi:T.HemisphereLight, sun:T.DirectionalLight) {
    const original={sky:hemi.color.clone(),ground:hemi.groundColor.clone(),hemi:hemi.intensity,sun:sun.color.clone(),strength:sun.intensity,direction:sun.position.clone()};
    const fill=new T.DirectionalLight('#a9d3d0',0);fill.position.set(4,5,-5);scene.add(fill);
    return {
        set(variant?:AtmosphereStudy) {
            if (!variant) {
                hemi.color.copy(original.sky);hemi.groundColor.copy(original.ground);hemi.intensity=original.hemi;
                sun.color.copy(original.sun);sun.intensity=original.strength;sun.position.copy(original.direction);fill.intensity=0;return;
            }
            const p=canopyAtmospheres[variant];
            hemi.color.set(p.sky);hemi.groundColor.set(p.ground);hemi.intensity=p.hemi;
            sun.color.set(p.sun);sun.intensity=p.strength;sun.position.set(p.direction[0],p.direction[1],p.direction[2]);
            fill.intensity=variant?p.fill:0;
        },
        snapshot(){return {sky:hemi.color.getHexString(),ground:hemi.groundColor.getHexString(),hemi:hemi.intensity,sun:sun.color.getHexString(),strength:sun.intensity,direction:sun.position.toArray(),fill:fill.intensity};},
        dispose(){scene.remove(fill);fill.dispose();},
    };
}
