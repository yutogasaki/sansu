import * as T from 'three';
import type { ThemeId } from '../../../domain/growingIsland/journey';
import type { GardenTime } from '../three/garden/presentation';

/**
 * How a special island dresses the things placed on it (island-journey.md §4): the shapes stay
 * the child's, the materials become the island's. Strong colours stay as small accents.
 */
interface Skin { tone: (color: T.Color) => T.Color; metalness: number; roughness: number }
const BRASS = new T.Color('#d9a845'), COPPER = new T.Color('#b5653a'), STEEL = new T.Color('#9aa4ab'), GUNMETAL = new T.Color('#3b4147');
const SKINS: Partial<Record<ThemeId, Skin>> = {
    karakuri: {
        metalness: .6, roughness: .3,
        tone: color => {
            const hsl = { h: 0, s: 0, l: 0 }; color.getHSL(hsl);
            // Bright paint stays as enamel; wood and warm paint turn to brass and copper; pale and grey to steel.
            if (hsl.s > .6 && hsl.l > .2 && hsl.l < .8 && (hsl.h < .03 || hsl.h > .15)) return color.clone().lerp(BRASS, .2);
            if (hsl.h >= .03 && hsl.h <= .15 && hsl.s > .2) return (hsl.l > .35 ? BRASS : COPPER).clone().multiplyScalar(.7 + hsl.l * .6);
            return GUNMETAL.clone().lerp(STEEL, Math.min(1, hsl.l * 1.4));
        },
    },
};

/** Each special island's own light, laid over the time of day (amount: how far it leans). */
const LIGHTS: Partial<Record<ThemeId, { sky: string; ground: string; sun: string; background: string; amount: Record<GardenTime, number> }>> = {
    karakuri: { sky: '#ffc98a', ground: '#4a3626', sun: '#ff9c48', background: '#e8b47e', amount: { morning: .85, day: .9, dusk: .95, night: .45 } },
};

const ORIGINAL = 'themeSkinOriginal';
const dressed = new Map<ThemeId, WeakMap<T.Material, T.Material>>();
type Colored = T.Material & { color: T.Color; metalness?: number; roughness?: number };

function dress(material: T.Material, theme: ThemeId, skin: Skin): T.Material {
    const own = dressed.get(theme) ?? new WeakMap<T.Material, T.Material>(); dressed.set(theme, own);
    const known = own.get(material); if (known) return known;
    // Glows, shadows and see-through effects keep their own look.
    const colored = material as Colored;
    if (!(colored.color instanceof T.Color) || material instanceof T.MeshBasicMaterial || (material.transparent && material.opacity < .6)) { own.set(material, material); return material; }
    const next = material.clone() as Colored;
    next.color = skin.tone(colored.color);
    if (next instanceof T.MeshStandardMaterial) { next.metalness = skin.metalness; next.roughness = skin.roughness; }
    own.set(material, next);
    return next;
}

/** Dress (or undress, with no theme) a placed layer or the house. Characters and species keep their own colours. */
export function skinTheme(root: T.Object3D, theme: ThemeId | undefined) {
    const skin = theme ? SKINS[theme] : undefined;
    const walk = (object: T.Object3D) => {
        if (object.userData.species || object.userData.keepSkin) return;
        if (object instanceof T.Mesh) {
            const original = (object.userData[ORIGINAL] ?? object.material) as T.Material | T.Material[];
            if (!skin || !theme) { if (object.userData[ORIGINAL]) { object.material = original; delete object.userData[ORIGINAL]; } }
            else {
                object.userData[ORIGINAL] = original;
                object.material = Array.isArray(original) ? original.map(m => dress(m, theme, skin)) : dress(original, theme, skin);
            }
        }
        object.children.forEach(walk);
    };
    walk(root);
}

/** Lean the world's light toward the island's own after the time of day was set; returns how to put it back. */
export function toneLight(theme: ThemeId | undefined, time: GardenTime, scene: T.Scene, hemi: T.HemisphereLight, sun: T.DirectionalLight) {
    const light = theme ? LIGHTS[theme] : undefined;
    if (!light) return undefined;
    const background = scene.background instanceof T.Color ? scene.background : undefined;
    const saved = { background: background?.clone(), sky: hemi.color.clone(), ground: hemi.groundColor.clone(), sun: sun.color.clone() };
    const k = light.amount[time];
    background?.lerp(new T.Color(light.background), k);
    hemi.color.lerp(new T.Color(light.sky), k); hemi.groundColor.lerp(new T.Color(light.ground), k); sun.color.lerp(new T.Color(light.sun), k);
    return () => {
        if (background && saved.background) background.copy(saved.background);
        hemi.color.copy(saved.sky); hemi.groundColor.copy(saved.ground); sun.color.copy(saved.sun);
    };
}
