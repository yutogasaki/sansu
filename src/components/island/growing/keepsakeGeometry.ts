import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';
import type { KeepsakeKind } from '../../../domain/growingIsland';
import { mesh, type Paint } from './plotParts';
import { wonder } from './wonderPaint';
import { SPECIES, type SpeciesId } from '../../../domain/growingIsland/journey';

/**
 * The twelve species of the special islands (island-journey.md §4), standing on the ground
 * like plants and small creatures, not on a keepsake stone.
 */
export function buildSpecies(m: IslandMaterials, id: SpeciesId) {
    const root = new T.Group(); root.name = `species-${id}`;
    const paint = (color: string, roughness = .6) => m.surface(color, roughness);
    const glow = (color: string, opacity = .75) => new T.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .55, transparent: true, opacity, roughness: .3 });
    const add = (g: T.BufferGeometry, material: T.Material | string, p: [number, number, number]) => {
        const part = mesh(root, g, typeof material === 'string' ? paint(material) : material, p);
        if (typeof material !== 'string') part.userData.ownMaterial = true;
        return part;
    };
    const stem = (h: number, color = '#6f9a5a') => add(new T.CylinderGeometry(.018, .025, h, 6), color, [0, h / 2, 0]);
    switch (id) {
        case 'shell-flower': stem(.3);
            for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const petal = add(new T.ConeGeometry(.06, .16, 8), '#f7c7d6', [Math.cos(a) * .08, .34, Math.sin(a) * .08]); petal.rotation.set(Math.sin(a) * .9, 0, -Math.cos(a) * .9); }
            add(new T.SphereGeometry(.05, 10, 8), '#fff3e0', [0, .36, 0]); break;
        case 'leaf-crab': add(new T.SphereGeometry(.12, 12, 8), '#e58b5a', [0, .09, 0]).scale.set(1.3, .6, 1);
            { const leaf = add(new T.SphereGeometry(.16, 12, 8), '#7cbf6a', [0, .2, -.02]); leaf.scale.set(.6, .45, 1.2); leaf.rotation.x = -.3; }
            for (const side of [-1, 1]) { add(new T.SphereGeometry(.035, 8, 6), '#e58b5a', [side * .14, .1, .12]); add(new T.SphereGeometry(.018, 6, 6), '#2d2a33', [side * .05, .17, .1]); } break;
        case 'bell-tree': add(new T.CylinderGeometry(.035, .05, .45, 8), '#8a6146', [0, .22, 0]); add(new T.IcosahedronGeometry(.24, 0), '#86c08a', [0, .58, 0]);
            for (let i = 0; i < 5; i++) { const a = i * 1.26; add(new T.ConeGeometry(.04, .07, 10), '#f2c230', [Math.cos(a) * .2, .44, Math.sin(a) * .2]); } break;
        case 'echo-bird': add(new T.CylinderGeometry(.02, .025, .35, 6), '#8a6146', [0, .17, 0]); add(new T.BoxGeometry(.24, .025, .03), '#8a6146', [0, .35, 0]);
            add(new T.SphereGeometry(.09, 12, 10), '#6fb2e0', [0, .45, 0]); add(new T.ConeGeometry(.025, .06, 6), '#f2c230', [0, .46, .1]).rotation.x = Math.PI / 2;
            for (const side of [-1, 1]) add(new T.SphereGeometry(.015, 6, 6), '#2d2a33', [side * .04, .49, .08]); break;
        case 'glass-weed': for (let i = 0; i < 6; i++) { const blade = add(new T.ConeGeometry(.03, .5 + (i % 3) * .1, 6), glow('#bfefff', .6), [Math.cos(i) * .08, .28, Math.sin(i) * .08]); blade.rotation.z = Math.sin(i * 2) * .25; } break;
        case 'glow-shell': { const shell = add(new T.SphereGeometry(.14, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glow('#ffe8f6', .9), [0, .02, 0]); shell.scale.set(1.2, .7, 1); }
            add(new T.SphereGeometry(.05, 10, 8), glow('#fff6c8', .95), [0, .1, .02]); break;
        case 'balloon-flower': stem(.42); add(new T.SphereGeometry(.13, 16, 12), '#b9a3ec', [0, .55, 0]).scale.y = 1.15;
            add(new T.ConeGeometry(.04, .06, 8), '#b9a3ec', [0, .41, 0]).rotation.x = Math.PI; break;
        case 'fluff-sheep': for (const [x, y, z, r] of [[0, .2, 0, .17], [.12, .22, .05, .12], [-.12, .22, -.03, .12], [0, .3, -.06, .12]]) add(new T.SphereGeometry(r, 12, 10), '#fbf8f2', [x, y, z]);
            add(new T.SphereGeometry(.08, 10, 8), '#5a4c46', [0, .2, .17]);
            for (const x of [-.08, .08]) for (const z of [-.06, .08]) add(new T.CylinderGeometry(.02, .02, .1, 6), '#5a4c46', [x, .05, z]); break;
        case 'key-weed': { stem(.36, '#7a8a6a');
            // A wind-up key blooms at the top of a brass stem and slowly turns.
            const brass = new T.MeshStandardMaterial({ color: '#d0a648', metalness: .6, roughness: .3 });
            const key = new T.Group(); key.name = 'species-turn'; key.position.y = .44; root.add(key);
            for (const side of [-1, 1]) { const loop = new T.Mesh(new T.TorusGeometry(.07, .022, 8, 18), brass); loop.position.x = side * .08; loop.userData.ownMaterial = true; key.add(loop); }
            const shaft = new T.Mesh(new T.CylinderGeometry(.018, .018, .12, 6), brass); shaft.position.y = -.07; key.add(shaft);
            for (let i = 0; i < 2; i++) { const leaf = add(new T.BoxGeometry(.14, .02, .06), '#8fae6a', [0, .16 + i * .1, 0]); leaf.rotation.y = i * 1.4; } break; }
        case 'clock-bird': {
            // A round brass bird with a little key turning in its back.
            const brass = new T.MeshStandardMaterial({ color: '#c9a24a', metalness: .55, roughness: .3 });
            add(new T.SphereGeometry(.12, 14, 10), brass, [0, .2, 0]); add(new T.SphereGeometry(.08, 12, 10), brass, [0, .32, .07]);
            add(new T.ConeGeometry(.025, .07, 6), '#e07a3c', [0, .32, .16]).rotation.x = Math.PI / 2;
            for (const side of [-1, 1]) { add(new T.SphereGeometry(.018, 6, 6), '#2d2a33', [side * .035, .35, .13]); const wing = add(new T.CylinderGeometry(.07, .07, .015, 8), '#8f9aa4', [side * .12, .21, 0]); wing.rotation.z = Math.PI / 2; }
            const key = new T.Group(); key.name = 'species-turn'; key.position.set(0, .22, -.14); root.add(key);
            for (const side of [-1, 1]) { const loop = new T.Mesh(new T.TorusGeometry(.04, .012, 6, 14), brass); loop.position.x = side * .045; key.add(loop); }
            for (const x of [-.04, .04]) add(new T.CylinderGeometry(.01, .01, .1, 4), '#5a4a3c', [x, .05, 0]); break; }
        case 'star-tree': add(new T.CylinderGeometry(.03, .045, .42, 8), '#5a4a6a', [0, .21, 0]); add(new T.IcosahedronGeometry(.22, 0), '#3f5f86', [0, .55, 0]);
            for (let i = 0; i < 5; i++) { const a = i * 1.26; add(new T.OctahedronGeometry(.045), glow('#ffe27a', .95), [Math.cos(a) * .21, .5 + (i % 2) * .1, Math.sin(a) * .21]); } break;
        case 'star-jelly': { const bell = add(new T.SphereGeometry(.14, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glow('#cfe8ff', .7), [0, .45, 0]); bell.scale.y = .8; }
            for (let i = 0; i < 5; i++) add(new T.CylinderGeometry(.008, .004, .25, 4), glow('#e6f3ff', .6), [Math.cos(i * 1.26) * .08, .32, Math.sin(i * 1.26) * .08]);
            add(new T.OctahedronGeometry(.035), glow('#ffe27a', .95), [0, .5, 0]); break;
    }
    // Species are the stars of their island: a size larger than a keepsake, and each one moves.
    root.scale.setScalar(1.7); root.userData.species = id;
    return root;
}

/** Learning keepsakes (§10): one fixed shape per unit family, on a shared stone base. */
export function buildKeepsake(m: IslandMaterials, kind: KeepsakeKind) {
    if ((SPECIES as readonly string[]).includes(kind)) return buildSpecies(m, kind as SpeciesId);
    const paint: Paint = (color, roughness = .6) => m.surface(color, roughness);
    const root = new T.Group(); root.name = `keepsake-${kind}`;
    const add = (g: T.BufferGeometry, color: string, p: [number, number, number], rough?: number) => mesh(root, g, paint(color, rough), p);
    add(new T.CylinderGeometry(.34, .38, .1, 16), '#d9ccb0', [0, .05, 0]);
    switch (kind) {
        case 'blocks': [['#e59a58', 0, .16], ['#5f9ec4', .1, .3], ['#78a86a', -.02, .44]].forEach(([c, x, y]) =>
            add(new T.BoxGeometry(.16, .14, .16), c as string, [x as number, y as number, 0]).rotation.y = (y as number) * 2); break;
        case 'balance': add(new T.CylinderGeometry(.03, .04, .5, 8), '#9b7250', [0, .35, 0]); add(new T.BoxGeometry(.5, .03, .03), '#9b7250', [0, .6, 0]);
            for (const x of [-.24, .24]) add(new T.CylinderGeometry(.1, .08, .04, 12), '#e0b454', [x, .5, 0], .4); break;
        case 'fountain': mesh(root, new T.CylinderGeometry(.28, .28, .1, 16), wonder('blocks'), [0, .15, 0]); add(new T.CylinderGeometry(.24, .24, .02, 16), '#7fb8c8', [0, .2, 0], .2);
            add(new T.CylinderGeometry(.05, .06, .3, 8), '#cfd9dd', [0, .35, 0]); add(new T.SphereGeometry(.09, 12, 8), '#9fd3e4', [0, .55, 0], .2); break;
        case 'clock': add(new T.BoxGeometry(.26, .6, .26), '#f0e4c6', [0, .4, 0]); add(new T.ConeGeometry(.22, .22, 4), '#a2644e', [0, .81, 0]).rotation.y = Math.PI / 4;
            add(new T.CylinderGeometry(.09, .09, .02, 16), '#fff8ea', [0, .55, .135], .4).rotation.x = Math.PI / 2; add(new T.BoxGeometry(.012, .07, .01), '#3a2a22', [0, .58, .148]); break;
        case 'windmill': add(new T.CylinderGeometry(.1, .16, .55, 10), '#f0e4c6', [0, .37, 0]); add(new T.ConeGeometry(.13, .15, 10), '#a2644e', [0, .72, 0]);
            for (let i = 0; i < 4; i++) { const blade = add(new T.BoxGeometry(.05, .3, .01), '#f3ecdc', [0, .6, .12]); blade.rotation.z = i * Math.PI / 2; blade.translateY(.15); } break;
        case 'star': add(new T.CylinderGeometry(.04, .05, .38, 8), '#d9ccb0', [0, .28, 0]); add(new T.OctahedronGeometry(.15), '#f0cf6a', [0, .58, 0], .3); break;
        case 'flowerbed': add(new T.CylinderGeometry(.3, .3, .1, 16), '#8a6a48', [0, .14, 0]);
            for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .6; add(new T.SphereGeometry(.07, 10, 8), ['#f6c6d4', '#fff1b0', '#b9d9ef', '#cfe8b8'][i], [Math.cos(a) * .15, .24, Math.sin(a) * .15], .8); } break;
        case 'tower': mesh(root, new T.CylinderGeometry(.07, .15, .7, 4), wonder('dots-yellow'), [0, .45, 0]); add(new T.OctahedronGeometry(.07), '#9a7cc4', [0, .86, 0], .3); break;
        case 'book': { const cover = add(new T.BoxGeometry(.36, .05, .26), '#5f9ec4', [0, .32, 0]); cover.rotation.z = .1;
            add(new T.BoxGeometry(.33, .04, .23), '#fff8ea', [0, .35, 0]).rotation.z = .1; add(new T.CylinderGeometry(.04, .05, .2, 8), '#d9ccb0', [0, .18, 0]); break; }
        case 'abc': [['#e2574c', -.11, .17, 0], ['#f2c14b', .11, .17, .3], ['#4f9bd9', 0, .33, -.2]].forEach(([c, x, y, r]) => {
            const block = add(new T.BoxGeometry(.18, .16, .18), c as string, [x as number, y as number, 0]); block.rotation.y = r as number;
            add(new T.BoxGeometry(.08, .1, .005), '#fff8ec', [x as number, y as number, .092]).rotation.y = r as number;
        }); break;
        case 'balloon': add(new T.CylinderGeometry(.04, .05, .14, 8), '#d9ccb0', [0, .15, 0]);
            [['#e2574c', -.12, .72], ['#4f9bd9', .1, .8], ['#f2c14b', 0, .95]].forEach(([c, x, y]) => {
                add(new T.SphereGeometry(.1, 12, 10), c as string, [x as number, y as number, 0], .4).scale.y = 1.2;
                add(new T.CylinderGeometry(.004, .004, (y as number) - .2, 4), '#6f6a8e', [(x as number) / 2, ((y as number) + .2) / 2, 0]);
            }); break;
        case 'telescope': add(new T.CylinderGeometry(.03, .03, .3, 8), '#9b7250', [0, .25, 0]);
            { const tube = add(new T.CylinderGeometry(.06, .08, .42, 12), '#4f6a9b', [0, .48, 0], .4); tube.rotation.z = .9;
              add(new T.CylinderGeometry(.065, .065, .03, 12), '#f0cf6a', [.15, .58, 0], .3).rotation.z = .9; } break;
        default: add(new T.CylinderGeometry(.03, .03, .3, 8), '#9b7250', [0, .25, 0]); add(new T.SphereGeometry(.17, 16, 12), '#7fb8c8', [0, .52, 0], .5);
            add(new T.TorusGeometry(.19, .015, 6, 24), '#e0b454', [0, .52, 0], .4); break;
    }
    return root;
}

const FLAG_COLORS = ['#d77a86', '#e59a58', '#e0b454', '#78a86a', '#5f9ec4', '#9a7cc4', '#f3ecdc', '#6f6a8e'] as const;
export { FLAG_COLORS };

/** The island flag on the pier (§1 ぬる, §8 Lv7 patterns: plain, stripe, dots, star, heart). */
export function buildFlag(m: IslandMaterials, color = 0, pattern = 0, emblem?: string) {
    const root = new T.Group(); root.name = 'growing-flag';
    mesh(root, new T.CylinderGeometry(.02, .025, 1.1, 8), m.surface('#9b7250', .8), [0, .55, 0]);
    mesh(root, new T.SphereGeometry(.035, 8, 6), m.surface('#e0b454', .4), [0, 1.12, 0]);
    const cloth = mesh(root, new T.BoxGeometry(.42, .28, .012), m.surface(FLAG_COLORS[color % FLAG_COLORS.length], .9), [.22, .94, 0]);
    cloth.name = 'growing-flag-cloth';
    const ink = m.surface(color === 6 ? '#d77a86' : '#fff8ea', .9), front = (x: number, y: number) => [.22 + x, .94 + y, .009] as [number, number, number];
    if (pattern === 1) mesh(root, new T.BoxGeometry(.42, .07, .014), ink, front(0, 0));
    else if (pattern === 2) for (const [x, y] of [[-.1, .06], [.1, .06], [0, -.05], [-.12, -.08], [.12, -.08]]) mesh(root, new T.CylinderGeometry(.03, .03, .014, 10), ink, front(x, y)).rotation.x = Math.PI / 2;
    else if (pattern === 3) mesh(root, new T.OctahedronGeometry(.08), ink, front(0, 0)).scale.z = .15;
    else if (pattern === 4) { for (const x of [-.035, .035]) mesh(root, new T.SphereGeometry(.045, 10, 8), ink, front(x, .02)).scale.z = .2;
        const tip = mesh(root, new T.ConeGeometry(.075, .09, 4), ink, front(0, -.04)); tip.rotation.z = Math.PI; tip.scale.z = .2; }
    if (emblem) {
        // A traced letter or number, the child's own drawing, on the front of the flag.
        const texture = new T.TextureLoader().load(emblem); texture.colorSpace = T.SRGBColorSpace;
        const picture = mesh(root, new T.PlaneGeometry(.24, .24), new T.MeshBasicMaterial({ map: texture, transparent: true }), [.22, .94, .012]);
        picture.name = 'growing-flag-emblem'; picture.userData.ownMaterial = true; picture.userData.ownTexture = texture;
    }
    root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
    return root;
}

/** おんがくの ひろば: a round stage under a colour-block roof, with notes floating above (§4). */
export function buildBandstand(m: IslandMaterials) {
    const root = new T.Group(); root.name = 'growing-bandstand';
    const paint = (color: string, roughness = .8) => m.surface(color, roughness);
    mesh(root, new T.CylinderGeometry(.42, .44, .08, 20), paint('#c89b62'), [0, .04, 0]);
    for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + Math.PI / 4;
        mesh(root, new T.CylinderGeometry(.025, .025, .62, 8), paint('#f3ecdc'), [Math.cos(a) * .34, .39, Math.sin(a) * .34]);
    }
    const roof = mesh(root, new T.ConeGeometry(.5, .3, 16), wonder('blocks'), [0, .84, 0]); roof.name = 'bandstand-roof';
    mesh(root, new T.SphereGeometry(.05, 10, 8), paint('#f0cf6a', .4), [0, 1.02, 0]);
    const ink = paint('#2b2622', .5);
    for (const [x, y, z] of [[-.18, 1.2, .05], [.2, 1.32, -.04]] as const) {
        const note = new T.Group(); note.name = 'bandstand-note'; note.position.set(x, y, z);
        mesh(note, new T.SphereGeometry(.045, 10, 8), ink, [0, 0, 0]).scale.set(1.2, .85, .7);
        mesh(note, new T.CylinderGeometry(.008, .008, .16, 6), ink, [.045, .08, 0]);
        root.add(note);
    }
    root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
    return root;
}
