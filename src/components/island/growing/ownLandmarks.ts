import * as T from 'three';
import type { IslandMaterials } from '../three/primitives';
import type { WonderForm } from '../../../domain/growingIsland/environment';
import { mesh } from './plotParts';
import { wonder } from './wonderPaint';

const painter = (m: IslandMaterials) => (color: string, roughness = .8) => m.surface(color, roughness);
const done = (root: T.Group) => { root.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; }); return root; };

/** すべりだい: steps up one side, a bright chute down the other (§4). */
export function buildSlide(m: IslandMaterials) {
    const paint = painter(m), root = new T.Group(); root.name = 'growing-slide';
    for (const x of [-.18, .18]) mesh(root, new T.BoxGeometry(.04, .62, .04), paint('#f3ecdc'), [x, .31, -.22]);
    mesh(root, new T.BoxGeometry(.42, .04, .2), paint('#5f9ec4'), [0, .6, -.22]);
    for (let i = 0; i < 4; i++) mesh(root, new T.BoxGeometry(.36, .03, .05), paint('#c89b62'), [0, .14 + i * .14, -.36 - i * .02]);
    const chute = mesh(root, new T.BoxGeometry(.32, .03, .72), paint('#f2c14b', .5), [0, .32, .14]); chute.rotation.x = .78;
    for (const x of [-.17, .17]) { const rail = mesh(root, new T.BoxGeometry(.03, .08, .74), paint('#e2574c'), [x, .36, .14]); rail.rotation.x = .78; }
    return done(root);
}

/** トランポリン: a round bouncy bed in colour blocks; friends who sit there bounce. */
export function buildTrampoline(m: IslandMaterials) {
    const paint = painter(m), root = new T.Group(); root.name = 'growing-trampoline';
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4; mesh(root, new T.CylinderGeometry(.025, .025, .18, 6), paint('#6f6a8e'), [Math.cos(a) * .32, .09, Math.sin(a) * .32]); }
    mesh(root, new T.TorusGeometry(.36, .04, 8, 28), paint('#e2574c'), [0, .19, 0]).rotation.x = Math.PI / 2;
    mesh(root, new T.CylinderGeometry(.34, .34, .02, 24), wonder('blocks'), [0, .18, 0]).name = 'trampoline-bed';
    return done(root);
}

/** ふんすい: a stone basin with a tall jet; counts as water for the island and its friends. */
export function buildFountain(m: IslandMaterials) {
    const paint = painter(m), root = new T.Group(); root.name = 'growing-fountain';
    mesh(root, new T.CylinderGeometry(.4, .42, .14, 20), paint('#d8d2c4'), [0, .07, 0]);
    mesh(root, new T.CylinderGeometry(.34, .34, .02, 20), paint('#7fb8c8', .2), [0, .14, 0]);
    mesh(root, new T.CylinderGeometry(.06, .08, .32, 10), paint('#d8d2c4'), [0, .3, 0]);
    mesh(root, new T.CylinderGeometry(.16, .12, .05, 14), paint('#d8d2c4'), [0, .47, 0]);
    const jet = mesh(root, new T.ConeGeometry(.05, .34, 10), new T.MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: .75, roughness: .1 }), [0, .66, 0]);
    jet.name = 'fountain-jet'; jet.userData.ownMaterial = true;
    return done(root);
}

/** パンやさん: a little shop with a striped awning and loaves in the window; feeds three. */
export function buildBakery(m: IslandMaterials) {
    const paint = painter(m), root = new T.Group(); root.name = 'growing-bakery';
    mesh(root, new T.BoxGeometry(.66, .5, .56), paint('#f6e7cf'), [0, .25, 0]);
    const awning = mesh(root, new T.BoxGeometry(.72, .04, .26), wonder('blocks'), [0, .5, .36]); awning.rotation.x = .35;
    const roof = mesh(root, new T.ConeGeometry(.52, .32, 4), paint('#a2644e'), [0, .66, 0]); roof.rotation.y = Math.PI / 4;
    mesh(root, new T.PlaneGeometry(.3, .18), paint('#ffe39a', .4), [.12, .28, .285]);
    for (const x of [.04, .12, .2]) mesh(root, new T.SphereGeometry(.035, 8, 6), paint('#d08a3c'), [x, .25, .3]).scale.set(1.4, .8, 1);
    mesh(root, new T.BoxGeometry(.14, .26, .02), paint('#865a3f'), [-.18, .13, .29]);
    return done(root);
}

/** ポスト: a red post box; friends' letters come home through it (§13.2). */
export function buildPostbox(m: IslandMaterials) {
    const paint = painter(m), root = new T.Group(); root.name = 'growing-postbox';
    mesh(root, new T.CylinderGeometry(.03, .03, .3, 8), paint('#6f6a8e'), [0, .15, 0]);
    mesh(root, new T.BoxGeometry(.22, .2, .18), paint('#e2574c', .6), [0, .38, 0]);
    const lid = mesh(root, new T.CylinderGeometry(.11, .11, .18, 14, 1, false, 0, Math.PI), paint('#e2574c', .6), [0, .48, 0]); lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2;
    mesh(root, new T.BoxGeometry(.1, .015, .01), paint('#2b2622'), [0, .42, .095]);
    const flag = mesh(root, new T.BoxGeometry(.012, .1, .04), paint('#f2c14b'), [.115, .5, 0]); flag.name = 'postbox-flag';
    return done(root);
}

/**
 * ふしぎの たね grown (§3.5): a polka-dot pumpkin house, a heart tree in colour blocks, or a
 * glowing polka-dot arch. They are the island's centrepieces, in Pokomoko's lineage.
 */
export function buildWonder(m: IslandMaterials, form: WonderForm, stage: number) {
    const paint = painter(m), root = new T.Group(); root.name = `growing-wonder-${form}`;
    if (stage === 0) {
        const sprout = mesh(root, new T.SphereGeometry(.12, 14, 10), wonder('dots-pastel'), [0, .12, 0]); sprout.scale.y = 1.3;
        mesh(root, new T.OctahedronGeometry(.05), paint('#fff2a6', .3), [0, .32, 0]);
        return done(root);
    }
    if (form === 'pumpkin') {
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3, lobe = mesh(root, new T.SphereGeometry(.24, 16, 12), wonder('dots-yellow'), [Math.cos(a) * .14, .3, Math.sin(a) * .14]);
            lobe.scale.set(.75, 1, .75);
        }
        mesh(root, new T.CylinderGeometry(.05, .07, .16, 8), paint('#5f7f3e'), [0, .66, 0]);
        mesh(root, new T.BoxGeometry(.14, .2, .02), paint('#865a3f'), [0, .12, .31]);
        mesh(root, new T.CircleGeometry(.05, 12), paint('#ffe39a', .3), [.12, .36, .33]);
    } else if (form === 'heart-tree') {
        mesh(root, new T.CylinderGeometry(.06, .09, .55, 8), paint('#a47c4c'), [0, .27, 0]);
        const heart = new T.Shape();
        heart.moveTo(0, -.3); heart.bezierCurveTo(-.45, .05, -.3, .38, 0, .2); heart.bezierCurveTo(.3, .38, .45, .05, 0, -.3);
        const shape = mesh(root, new T.ExtrudeGeometry(heart, { depth: .2, bevelEnabled: true, bevelSize: .05, bevelThickness: .05, bevelSegments: 3 }), wonder('blocks'), [0, .82, -.1]);
        shape.scale.setScalar(1.15);
    } else {
        const arch = mesh(root, new T.TorusGeometry(.38, .07, 10, 28, Math.PI), wonder('dots-red'), [0, .02, 0]);
        arch.scale.y = 1.3;
        for (let i = 0; i < 5; i++) {
            const a = (i + .5) / 5 * Math.PI, light = mesh(root, new T.SphereGeometry(.035, 8, 6), paint('#fff2a6', .3), [Math.cos(a) * .38, Math.sin(a) * .5 + .02, .08]);
            light.name = 'wonder-light';
        }
    }
    return done(root);
}
