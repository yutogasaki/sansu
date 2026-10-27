import * as T from 'three';
import type { ThemeId } from '../../../domain/growingIsland/journey';
import type { GardenTime } from '../three/garden/presentation';

/**
 * How a special island dresses the things placed on it (island-journey.md §4): the shapes stay
 * the child's, the materials become the island's. Strong colours stay as small accents.
 */
interface Skin { tone: (color: T.Color) => T.Color; metalness: number; roughness: number; glow?: (color: T.Color) => T.Color }
const hslOf = (color: T.Color) => { const hsl = { h: 0, s: 0, l: 0 }; color.getHSL(hsl); return hsl; };
/** Bright paint (not wood) stays as the island's accent colour. */
const vivid = ({ h, s, l }: { h: number; s: number; l: number }) => s > .6 && l > .2 && l < .8 && (h < .03 || h > .15);
const woody = ({ h, s }: { h: number; s: number }) => h >= .03 && h <= .15 && s > .2;
const c = (hex: string) => new T.Color(hex);
const BRASS = new T.Color('#d9a845'), COPPER = new T.Color('#b5653a'), STEEL = new T.Color('#9aa4ab'), GUNMETAL = new T.Color('#3b4147');
const SKINS: Record<ThemeId, Skin> = {
    // Shells and driftwood: bleached wood, coral paint, pearly white.
    shiokaze: {
        metalness: .15, roughness: .35,
        tone: color => {
            const hsl = hslOf(color);
            if (vivid(hsl)) return color.clone().lerp(c('#ff8f7a'), .35);
            if (woody(hsl)) return c('#c9b293').lerp(c('#efe4cf'), hsl.l);
            return c('#bfe3e3').lerp(c('#fff6ee'), Math.min(1, hsl.l * 1.2));
        },
    },
    // Moss and bark: everything grows over with the forest.
    kodama: {
        metalness: 0, roughness: .95,
        tone: color => {
            const hsl = hslOf(color);
            if (vivid(hsl)) return color.clone().multiplyScalar(.8).lerp(c('#6f9a4c'), .2);
            if (woody(hsl)) return c('#4a3220').lerp(c('#7a5638'), hsl.l);
            return c('#4f7f3c').lerp(c('#a9cf7c'), Math.min(1, hsl.l * 1.1));
        },
    },
    // Glass and crystal: clear aqua with a faint light inside.
    hikari: {
        metalness: .2, roughness: .08,
        tone: color => color.clone().lerp(c('#c4f6f2'), .62),
        glow: color => color.clone().lerp(c('#3fd8d0'), .7).multiplyScalar(.28),
    },
    // Cotton: everything soft and pale, like the clouds.
    watagumo: {
        metalness: 0, roughness: 1,
        tone: color => color.clone().lerp(c('#ffffff'), .55),
    },
    // Night things glow faintly in their own colours.
    hoshi: {
        metalness: .1, roughness: .5,
        tone: color => color.clone().lerp(c('#283070'), .6),
        glow: color => color.clone().lerp(c('#7f8cff'), .5).multiplyScalar(.22),
    },
    karakuri: {
        metalness: .6, roughness: .3,
        tone: color => {
            const hsl = hslOf(color);
            // Bright paint stays as enamel; wood and warm paint turn to brass and copper; pale and grey to steel.
            if (vivid(hsl)) return color.clone().lerp(BRASS, .2);
            if (woody(hsl)) return (hsl.l > .35 ? BRASS : COPPER).clone().multiplyScalar(.7 + hsl.l * .6);
            return GUNMETAL.clone().lerp(STEEL, Math.min(1, hsl.l * 1.4));
        },
    },
};

/** Each special island's own light, laid over the time of day (amount: how far it leans). */
const LIGHTS: Record<ThemeId, { sky: string; ground: string; sun: string; background: string; amount: Record<GardenTime, number> }> = {
    shiokaze: { sky: '#fffbe8', ground: '#f2e0c0', sun: '#fff3d0', background: '#bff3f0', amount: { morning: .6, day: .6, dusk: .5, night: .25 } },
    kodama: { sky: '#bfe6a8', ground: '#2f4a28', sun: '#ffe9a0', background: '#7fae84', amount: { morning: .7, day: .7, dusk: .6, night: .3 } },
    hikari: { sky: '#d8fbff', ground: '#7fd6e0', sun: '#f0ffff', background: '#c6f7fb', amount: { morning: .7, day: .7, dusk: .6, night: .3 } },
    watagumo: { sky: '#ffffff', ground: '#f0e8ff', sun: '#fffaf2', background: '#eef3ff', amount: { morning: .8, day: .8, dusk: .6, night: .3 } },
    // The star island is always night.
    hoshi: { sky: '#5a68c8', ground: '#1c2050', sun: '#9fb0ff', background: '#141a45', amount: { morning: .9, day: .9, dusk: .9, night: .7 } },
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
    if (next instanceof T.MeshStandardMaterial) {
        next.metalness = skin.metalness; next.roughness = skin.roughness;
        if (skin.glow) { next.emissive = skin.glow(colored.color); next.emissiveIntensity = 1; }
    }
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
