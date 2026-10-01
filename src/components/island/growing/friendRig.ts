import * as T from 'three';
import { batch, curve, ellipsoid, mesh, type IslandMaterials } from '../three/primitives';
import { makeResidentRig } from '../three/residentRig';
import type { Species } from '../../../domain/growingIsland';

/**
 * Friend bodies for the growing island (spec 52 §7.1, art rules of spec 51). Every species
 * reads by silhouette alone: long ears, pointed ears and snout, low round ears with a
 * tapering tail, a bill, a curled tail, spines, a beak and crest, and two children.
 * The rabbit keeps the established resident rig; Pokomoko is never built here.
 */
export interface FriendRig { pose: T.Group; body: T.Group; head: T.Group; feet: T.Object3D[]; headTop: number; arms?: T.Object3D[] }

type V3 = [number, number, number];
const cone = (parent: T.Object3D, material: T.Material, position: V3, radius: number, height: number, rotation: V3 = [0, 0, 0]) => {
    const m = mesh(parent, new T.ConeGeometry(radius, height, 12), material, position);
    m.rotation.set(...rotation); return m;
};

function face(head: T.Group, m: IslandMaterials, { x, y, z, size = 1 }: { x: number; y: number; z: number; size?: number }) {
    const dark = m.surface('#2b2622', .35), shine = m.get('#fff8ea');
    for (const side of [-1, 1]) {
        ellipsoid(head, dark, [side * x, y, z], [.03 * size, .042 * size, .022 * size], 10);
        ellipsoid(head, shine, [side * x - .006, y + .014 * size, z + .016 * size], [.009, .011, .005], 8);
    }
}

function cheeks(head: T.Group, m: IslandMaterials, x: number, y: number, z: number) {
    const blush = m.surface('#f2a0a0', .9);
    for (const side of [-1, 1]) ellipsoid(head, blush, [side * x, y, z], [.045, .026, .012], 10);
}

function frame(): Pick<FriendRig, 'pose' | 'body' | 'head'> {
    const pose = new T.Group(), body = new T.Group(), head = new T.Group();
    pose.name = 'friend-pose'; body.name = 'friend-body'; head.name = 'friend-head';
    pose.add(body); body.add(head);
    return { pose, body, head };
}

/** Head and body merge into few draws each, but the head stays its own joint. */
function finish(body: T.Group, head: T.Group) {
    // Arms (and wings) stay their own joints so friends can wave; the rest merges into few draws.
    const limbs = body.children.filter(child => child.userData.limb);
    body.remove(head, ...limbs); batch(body); body.add(head, ...limbs); batch(head);
    body.traverse(o => { if (o instanceof T.Mesh) o.castShadow = false; });
}

function feet(pose: T.Group, material: T.Material, scale: V3 = [.14, .1, .19], y = .1, spread = .16) {
    return [-1, 1].map(side => ellipsoid(pose, material, [side * spread, y, .1], scale));
}

/** A limb hangs from a shoulder pivot: rotating the pivot waves the whole arm or wing. */
function limb(body: T.Group, side: number, shoulder: V3, build: (pivot: T.Group) => void) {
    const pivot = new T.Group(); pivot.name = side < 0 ? 'arm-left' : 'arm-right'; pivot.userData.limb = true;
    pivot.position.set(...shoulder); build(pivot); body.add(pivot); return pivot;
}
function arms(body: T.Group, material: T.Material, y: number, x: number, scale: V3 = [.08, .17, .09]) {
    for (const side of [-1, 1]) limb(body, side, [side * (x - .03), y + scale[1] * .7, .06], pivot => {
        const arm = ellipsoid(pivot, material, [side * .03, -scale[1] * .7, 0], scale); arm.rotation.z = side * .35;
    });
}

function otter(m: IslandMaterials): FriendRig {
    const { pose, body, head } = frame();
    const fur = m.get('#7d5236'), cream = m.get('#f1dfc2'), dark = m.surface('#2b2220', .35);
    // A long, sleek body; the tail is thick at the hip and tapers to a point on the ground.
    ellipsoid(body, fur, [0, .5, 0], [.25, .42, .23]);
    ellipsoid(body, cream, [0, .48, .17], [.16, .3, .07]);
    cone(body, fur, [0, .2, -.42], .13, .6, [-Math.PI / 2 - .25, 0, 0]);
    arms(body, fur, .58, .24, [.07, .15, .08]);
    head.position.y = .98;
    // A wide, flat head with a broad cream muzzle and whiskers; the ears are tiny and low.
    ellipsoid(head, fur, [0, 0, 0], [.33, .25, .28]);
    ellipsoid(head, cream, [0, -.07, .19], [.21, .13, .12]);
    for (const side of [-1, 1]) {
        ellipsoid(head, fur, [side * .27, .09, -.05], [.06, .055, .04]);
        for (const lift of [0, .025]) curve(head, dark, [[side * .09, -.06 + lift, .3], [side * .2, -.05 + lift * 1.6, .3], [side * .3, -.03 + lift * 2, .26]], .004);
    }
    ellipsoid(head, dark, [0, -.035, .31], [.055, .038, .03]);
    face(head, m, { x: .12, y: .05, z: .25 });
    finish(body, head);
    return { pose, body, head, feet: feet(pose, fur, [.15, .07, .22], .07, .15), headTop: .25 };
}

function fox(m: IslandMaterials): FriendRig {
    const { pose, body, head } = frame();
    const fur = m.get('#e27d34'), white = m.get('#fbf2e3'), dark = m.get('#3a2a22');
    ellipsoid(body, fur, [0, .5, 0], [.27, .36, .24]);
    ellipsoid(body, white, [0, .52, .17], [.15, .24, .07]);
    // The big brush tail with its white tip is the fox's silhouette from any side.
    const tail = ellipsoid(body, fur, [.18, .42, -.36], [.16, .15, .36]); tail.rotation.set(.5, .5, 0);
    const tip = ellipsoid(body, white, [.3, .56, -.6], [.1, .1, .12]); tip.rotation.copy(tail.rotation);
    arms(body, fur, .56, .25);
    head.position.y = .98;
    ellipsoid(head, fur, [0, 0, 0], [.3, .27, .27]);
    ellipsoid(head, white, [0, -.08, .12], [.22, .14, .18]);
    // A pointed snout and tall pointed ears with dark tips: never a round bear face.
    cone(head, white, [0, -.07, .33], .09, .22, [Math.PI / 2, 0, 0]);
    ellipsoid(head, dark, [0, -.06, .44], [.035, .03, .03]);
    for (const side of [-1, 1]) {
        cone(head, fur, [side * .16, .3, -.02], .1, .28, [0, 0, -side * .28]);
        cone(head, dark, [side * .2, .42, -.02], .045, .09, [0, 0, -side * .28]);
    }
    face(head, m, { x: .11, y: .06, z: .24 });
    finish(body, head);
    return { pose, body, head, feet: feet(pose, dark, [.12, .09, .17]), headTop: .26 };
}

function duck(m: IslandMaterials): FriendRig {
    const { pose, body, head } = frame();
    const feather = m.get('#f6f1e4'), bill = m.get('#f0a13c'), green = m.get('#4f8f6a');
    const shell = ellipsoid(body, feather, [0, .42, -.04], [.3, .3, .36]); shell.rotation.x = -.2;
    cone(body, feather, [0, .5, -.42], .1, .2, [-Math.PI / 2 - .6, 0, 0]);
    for (const side of [-1, 1]) limb(body, side, [side * .26, .58, -.04], pivot => {
        const wing = ellipsoid(pivot, feather, [side * .02, -.13, 0], [.06, .17, .24]); wing.rotation.z = side * .25;
    });
    head.position.set(0, .86, .08);
    ellipsoid(head, feather, [0, 0, 0], [.22, .22, .21]);
    ellipsoid(head, green, [0, .19, -.02], [.05, .07, .05]);
    // A flat, wide bill and paddle feet say "duck" at a glance.
    ellipsoid(head, bill, [0, -.05, .22], [.12, .04, .12]);
    face(head, m, { x: .1, y: .05, z: .18, size: .85 });
    finish(body, head);
    return { pose, body, head, feet: feet(pose, bill, [.13, .04, .18], .05, .13), headTop: .22 };
}

function squirrel(m: IslandMaterials): FriendRig {
    const { pose, body, head } = frame();
    const fur = m.get('#b8683a'), cream = m.get('#f3dcb8'), dark = m.surface('#2b2220', .35);
    ellipsoid(body, fur, [0, .44, 0], [.22, .3, .2]);
    ellipsoid(body, cream, [0, .44, .14], [.13, .21, .07]);
    // The tall curled tail rises behind the whole body.
    const tail: V3[] = [[.06, .3, -.22], [.12, .56, -.44], [.16, .9, -.5], [.16, 1.18, -.38], [.12, 1.3, -.16]];
    tail.forEach((p, i) => ellipsoid(body, fur, p, [.2 - i * .01, .19, .19 - i * .01]));
    ellipsoid(body, cream, [.12, 1.34, -.08], [.1, .08, .08]);
    arms(body, fur, .5, .2, [.06, .13, .07]);
    head.position.y = .86;
    ellipsoid(head, fur, [0, 0, 0], [.25, .23, .23]);
    ellipsoid(head, cream, [0, -.07, .14], [.14, .1, .1]);
    for (const side of [-1, 1]) {
        cone(head, fur, [side * .13, .25, -.03], .06, .18, [0, 0, -side * .18]);
        cone(head, cream, [side * .15, .36, -.03], .025, .08, [0, 0, -side * .18]);
    }
    ellipsoid(head, dark, [0, -.04, .24], [.03, .024, .02]);
    face(head, m, { x: .1, y: .05, z: .2, size: .9 });
    finish(body, head);
    return { pose, body, head, feet: feet(pose, fur, [.1, .08, .15], .08, .12), headTop: .26 };
}

function hedgehog(m: IslandMaterials): FriendRig {
    const { pose, body, head } = frame();
    const spine = m.get('#6d5240'), skin = m.get('#e9d2b0'), dark = m.surface('#2b2220', .35);
    ellipsoid(body, skin, [0, .42, .04], [.28, .3, .26]);
    // A dome of spines over the back and head.
    ellipsoid(body, spine, [0, .52, -.08], [.33, .36, .3]);
    for (let ring = 0; ring < 3; ring++) for (let i = 0; i < 7; i++) {
        const a = -Math.PI * .85 + i / 6 * Math.PI * .7 + ring * .12, lift = .35 + ring * .22;
        const p: V3 = [Math.cos(a) * .3 * (1 - ring * .18), .52 + lift * .5, -.08 + Math.sin(a) * .28 * (1 - ring * .18)];
        const c = cone(body, spine, p, .045, .16);
        c.lookAt(new T.Vector3(p[0] * 3, p[1] + .6, p[2] * 3 - .2)); c.rotateX(Math.PI / 2);
    }
    arms(body, skin, .42, .26, [.06, .11, .07]);
    head.position.set(0, .7, .18);
    ellipsoid(head, skin, [0, 0, 0], [.2, .18, .19]);
    cone(head, skin, [0, -.03, .2], .08, .18, [Math.PI / 2, 0, 0]);
    ellipsoid(head, dark, [0, -.03, .3], [.03, .026, .024]);
    for (const side of [-1, 1]) ellipsoid(head, skin, [side * .15, .13, -.02], [.05, .05, .03]);
    face(head, m, { x: .08, y: .04, z: .16, size: .8 });
    cheeks(head, m, .12, -.02, .14);
    finish(body, head);
    return { pose, body, head, feet: feet(pose, skin, [.1, .07, .14], .07, .14), headTop: .5 };
}

function bird(m: IslandMaterials): FriendRig {
    const { pose, body, head } = frame();
    const blue = m.get('#6fa9d8'), belly = m.get('#fbe7a8'), beak = m.get('#f0a13c');
    ellipsoid(body, blue, [0, .45, 0], [.26, .3, .25]);
    ellipsoid(body, belly, [0, .43, .15], [.17, .22, .1]);
    for (const side of [-1, 1]) limb(body, side, [side * .22, .64, -.02], pivot => {
        const wing = ellipsoid(pivot, blue, [side * .03, -.14, 0], [.05, .2, .15]); wing.rotation.z = side * .4;
    });
    for (const side of [-1, 0, 1]) {
        const feather = ellipsoid(body, blue, [side * .06, .32, -.3], [.05, .03, .16]); feather.rotation.x = -.5;
    }
    head.position.y = .86;
    ellipsoid(head, blue, [0, 0, 0], [.21, .2, .2]);
    // A short pointed beak and a crest feather on top.
    cone(head, beak, [0, -.02, .23], .05, .12, [Math.PI / 2, 0, 0]);
    for (const tilt of [-.3, 0, .3]) cone(head, blue, [tilt * .1, .24, -.02], .03, .14, [-.3, 0, tilt]);
    face(head, m, { x: .09, y: .05, z: .17, size: .85 });
    cheeks(head, m, .13, -.03, .14);
    finish(body, head);
    return { pose, body, head, feet: feet(pose, beak, [.06, .04, .12], .05, .09), headTop: .3 };
}

/** えま and えいた: their own designs, never recoloured into a different child. */
function child(m: IslandMaterials, girl: boolean, clothes?: string): FriendRig {
    const { pose, body, head } = frame();
    const skin = m.get('#f4d3ba'), hair = m.get(girl ? '#4a3024' : '#2c221d');
    const shirt = m.get(clothes ?? (girl ? '#e58ea3' : '#5f9ec4')), shoes = m.get(girl ? '#c94f5a' : '#e0b454');
    if (girl) {
        // A flared dress over a small body.
        mesh(body, new T.CylinderGeometry(.14, .3, .42, 18), shirt, [0, .34, 0]);
        ellipsoid(body, shirt, [0, .58, 0], [.17, .12, .15]);
        for (const side of [-1, 1]) ellipsoid(body, skin, [side * .08, .12, .02], [.05, .1, .05]);
    } else {
        ellipsoid(body, shirt, [0, .5, 0], [.21, .22, .18]);
        mesh(body, new T.CylinderGeometry(.19, .2, .16, 16), m.get('#3f4f72'), [0, .3, 0]);
        for (const side of [-1, 1]) ellipsoid(body, skin, [side * .08, .17, .02], [.055, .09, .055]);
    }
    for (const side of [-1, 1]) {
        limb(body, side, [side * .17, .63, .02], pivot => {
            const arm = ellipsoid(pivot, shirt, [side * .03, -.07, 0], [.06, .1, .06]); arm.rotation.z = side * .4;
            ellipsoid(pivot, skin, [side * .08, -.18, .02], [.045, .05, .045]);
        });
    }
    head.position.y = .93;
    ellipsoid(head, skin, [0, 0, 0], [.26, .25, .24]);
    for (const side of [-1, 1]) ellipsoid(head, skin, [side * .25, -.01, 0], [.04, .06, .04]);
    face(head, m, { x: .09, y: .0, z: .22 });
    cheeks(head, m, .15, -.06, .19);
    curve(head, m.surface('#a05050', .6), [[-.04, -.09, .225], [0, -.105, .232], [.04, -.09, .225]], .007);
    // Hair: a soft cap with a fringe; えま has two bunches with ribbons, えいた a small tuft.
    const cap = ellipsoid(head, hair, [0, .06, -.03], [.28, .24, .26]); cap.scale.y = .23;
    ellipsoid(head, hair, [0, .15, .14], [.22, .08, .1]);
    if (girl) {
        const ribbon = m.get('#f7d9e0');
        for (const side of [-1, 1]) {
            ellipsoid(head, hair, [side * .29, -.02, -.08], [.09, .13, .09]);
            ellipsoid(head, ribbon, [side * .26, .09, -.06], [.05, .035, .035]);
        }
        ellipsoid(head, hair, [0, -.02, -.2], [.24, .2, .08]);
    } else {
        cone(head, hair, [.04, .3, .02], .05, .12, [.3, 0, -.3]);
        ellipsoid(head, hair, [0, -.04, -.18], [.24, .17, .09]);
    }
    finish(body, head);
    return { pose, body, head, feet: feet(pose, shoes, [.08, .06, .12], .06, .09), headTop: .28 };
}

function penguin(m: IslandMaterials): FriendRig {
    const { pose, body, head } = frame();
    const navy = m.get('#2f3a52'), white = m.get('#f7f4ec'), beak = m.get('#f0a13c');
    ellipsoid(body, navy, [0, .46, -.02], [.27, .4, .25]);
    ellipsoid(body, white, [0, .44, .1], [.2, .32, .17]);
    for (const side of [-1, 1]) limb(body, side, [side * .25, .62, 0], pivot => {
        const flipper = ellipsoid(pivot, navy, [side * .03, -.16, 0], [.05, .2, .1]); flipper.rotation.z = side * .25;
    });
    head.position.y = .9;
    ellipsoid(head, navy, [0, 0, 0], [.23, .21, .22]);
    ellipsoid(head, white, [0, -.03, .1], [.16, .14, .13]);
    cone(head, beak, [0, -.05, .25], .045, .12, [Math.PI / 2, 0, 0]);
    face(head, m, { x: .08, y: .03, z: .2, size: .85 });
    cheeks(head, m, .13, -.05, .16);
    finish(body, head);
    return { pose, body, head, feet: feet(pose, beak, [.1, .035, .14], .04, .1), headTop: .22 };
}

function owl(m: IslandMaterials): FriendRig {
    const { pose, body, head } = frame();
    const brown = m.get('#9a7352'), cream = m.get('#f1dfc2'), gold = m.get('#e9b949'), beak = m.get('#d08a3c');
    ellipsoid(body, brown, [0, .44, 0], [.3, .34, .27]);
    ellipsoid(body, cream, [0, .42, .14], [.2, .25, .12]);
    for (const side of [-1, 1]) limb(body, side, [side * .27, .6, -.02], pivot => {
        const wing = ellipsoid(pivot, brown, [side * .03, -.16, 0], [.07, .22, .17]); wing.rotation.z = side * .2;
    });
    head.position.y = .86;
    ellipsoid(head, brown, [0, 0, 0], [.29, .25, .25]);
    for (const side of [-1, 1]) {
        // Big round eye rings and ear tufts: unmistakably an owl.
        ellipsoid(head, cream, [side * .11, .02, .19], [.1, .1, .06], 14);
        ellipsoid(head, gold, [side * .11, .02, .235], [.05, .05, .02], 12);
        cone(head, brown, [side * .17, .25, -.02], .06, .16, [0, 0, -side * .35]);
    }
    face(head, m, { x: .11, y: .02, z: .25, size: .9 });
    cone(head, beak, [0, -.07, .25], .03, .08, [Math.PI, 0, 0]);
    finish(body, head);
    return { pose, body, head, feet: feet(pose, gold, [.07, .04, .1], .04, .11), headTop: .28 };
}

function frog(m: IslandMaterials): FriendRig {
    const { pose, body, head } = frame();
    const green = m.get('#6dbb5f'), belly = m.get('#e8f3c4'), white = m.get('#fbf9f0');
    ellipsoid(body, green, [0, .38, 0], [.27, .28, .25]);
    ellipsoid(body, belly, [0, .36, .13], [.18, .2, .12]);
    arms(body, green, .42, .25, [.06, .12, .07]);
    head.position.y = .72;
    ellipsoid(head, green, [0, 0, 0], [.3, .2, .25]);
    for (const side of [-1, 1]) {
        // Eyes on top of the head.
        ellipsoid(head, green, [side * .14, .17, .05], [.09, .09, .09], 14);
        ellipsoid(head, white, [side * .14, .19, .12], [.06, .06, .04], 12);
    }
    face(head, m, { x: .14, y: .19, z: .155, size: .8 });
    cheeks(head, m, .19, -.03, .19);
    curve(head, m.surface('#3d6f3a', .6), [[-.12, -.06, .22], [0, -.09, .245], [.12, -.06, .22]], .008);
    finish(body, head);
    return { pose, body, head, feet: feet(pose, green, [.13, .05, .17], .05, .17), headTop: .3 };
}

function rabbit(m: IslandMaterials): FriendRig {
    const rig = makeResidentRig('rabbit', m, 'natural');
    return { pose: rig.pose, body: rig.body, head: rig.head, feet: rig.feet, headTop: .3, arms: rig.shoulders };
}

export function makeFriendRig(species: Species, m: IslandMaterials, clothes?: string): FriendRig {
    const rig = buildRig(species, m, clothes);
    return { ...rig, arms: rig.arms ?? rig.body.children.filter(child => child.userData.limb) };
}

function buildRig(species: Species, m: IslandMaterials, clothes?: string): FriendRig {
    switch (species) {
        case 'penguin': return penguin(m);
        case 'owl': return owl(m);
        case 'frog': return frog(m);
        case 'otter': return otter(m);
        case 'fox': return fox(m);
        case 'duck': return duck(m);
        case 'squirrel': return squirrel(m);
        case 'hedgehog': return hedgehog(m);
        case 'bird': return bird(m);
        case 'girl': return child(m, true, clothes);
        case 'boy': return child(m, false, clothes);
        default: return rabbit(m);
    }
}
