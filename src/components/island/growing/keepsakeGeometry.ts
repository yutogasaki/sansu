import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';
import type { KeepsakeKind } from '../../../domain/growingIsland';
import { mesh, type Paint } from './plotParts';
import { wonder } from './wonderPaint';

/** Learning keepsakes (§10): one fixed shape per unit family, on a shared stone base. */
export function buildKeepsake(m: IslandMaterials, kind: KeepsakeKind) {
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
        default: add(new T.CylinderGeometry(.03, .03, .3, 8), '#9b7250', [0, .25, 0]); add(new T.SphereGeometry(.17, 16, 12), '#7fb8c8', [0, .52, 0], .5);
            add(new T.TorusGeometry(.19, .015, 6, 24), '#e0b454', [0, .52, 0], .4); break;
    }
    return root;
}

const FLAG_COLORS = ['#d77a86', '#e59a58', '#e0b454', '#78a86a', '#5f9ec4', '#9a7cc4', '#f3ecdc', '#6f6a8e'] as const;
export { FLAG_COLORS };

/** The island flag on the pier (§1 ぬる, §8 Lv7 patterns: plain, stripe, dots, star, heart). */
export function buildFlag(m: IslandMaterials, color = 0, pattern = 0) {
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
    root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
    return root;
}
