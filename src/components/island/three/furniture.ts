import * as THREE from 'three';
import { IslandMaterials, batch, cylinder, ellipsoid, mesh, pole, star } from './primitives';
import { roundedBoxGeometry } from './geometry';
import { sampleFurnitureSwing } from './furnitureVisuals';
import type { IslandItemKind } from './types';
import { appearanceBlossom, appearanceFamily } from './appearanceMotifs';
import { isOptionalFurniture, makeOptionalFurniture } from './optionalFurnitureGeometry';
export { getFurnitureAnchors } from './furnitureVisuals';

export const ITEM_CAPTIONS: Record<IslandItemKind, string> = {
    bench: 'カワウソが ベンチに すわった',
    flower: 'ウサギが おはなの においを くんくん',
    lantern: 'カワウソが あかりを みあげた',
    swing: 'ウサギが ブランコに すわった',
    mushroom: 'カワウソが きのこの いすで ひとやすみ',
    fountain: 'ウサギが ふんすいを のぞいた',
    telescope: 'ぼうえんきょうで そらを のぞいた', hammock: 'ハンモックで ひとやすみ', 'tea-table': 'おちゃを いっしょに',
};

function softBox(parent: THREE.Object3D, material: THREE.Material, position: [number, number, number], size: [number, number, number], radius = .035) {
    return mesh(parent, roundedBoxGeometry(size, radius, 2), material, position);
}

function profile(parent: THREE.Object3D, material: THREE.Material, points: [number, number][], segments = 24) {
    const area = points.reduce((sum, point, index) => {
        const next = points[(index + 1) % points.length];
        return sum + point[0] * next[1] - next[0] * point[1];
    }, 0);
    const ordered = area < 0 ? [...points].reverse() : points;
    return mesh(parent, new THREE.LatheGeometry(ordered.map(([radius, height]) => new THREE.Vector2(radius, height)), segments), material);
}

function part(parent: THREE.Group, name: string, position: [number, number, number] = [0, 0, 0]) {
    const group = new THREE.Group();
    group.name = name;
    group.position.set(...position);
    parent.add(group);
    return group;
}

export function makeFlowers(m: IslandMaterials, count = 3) {
    const group = new THREE.Group(), fixed = part(group, 'furniture-static');
    const leaves = part(group, 'flower-leaves', [0, .2, 0]), blooms = part(group, 'flower-blooms', [0, .42, 0]);
    // A low, irregular leaf bed grounds the stems without reading as a thick green disk.
    for (const [x, z, angle] of [[-.15, -.06, -.4], [.13, .06, .5], [-.03, .14, -.7]]) {
        const leaf = ellipsoid(fixed, m.get('#638f48'), [x, .035, z], [.15, .035, .11], 10);
        leaf.rotation.y = angle;
    }
    const spots: [number, number, number, string][] = [
        [-.13, .37, .045, '#fff0c0'], [.1, .52, -.085, '#f39482'], [.125, .31, .115, '#ffd06c'],
    ];
    spots.slice(0, count).forEach(([x, height, z, color]) => {
        pole(fixed, m.get('#467343'), [x, .035, z], [x, height, z], .018);
        for (const side of [-1, 1]) {
            const leaf = ellipsoid(leaves, m.get(side < 0 ? '#4d8c50' : '#76a85b'),
                [x + side * .042, height * .44 - .2, z], [.075, .019, .035], 10);
            leaf.rotation.z = side * .48;
        }
        const styled = appearanceBlossom(blooms, m, x, height - .42, z, .14, color);
        if (!styled) {
        for (let i = 0; i < 5; i++) {
            const a = i * Math.PI * 2 / 5;
            const petal = ellipsoid(blooms, m.get(color), [x + Math.cos(a) * .066, height - .42, z + Math.sin(a) * .066], [.073, .031, .046], 10);
            petal.rotation.y = -a;
        }
        ellipsoid(blooms, m.get('#d99635'), [x, height - .389, z], [.042, .025, .042], 10);
        ellipsoid(blooms, m.get('#ffe599'), [x - .012, height - .37, z - .008], [.018, .008, .017], 8);
        }
    });
    [fixed, leaves, blooms].forEach(section => batch(section, m.painted));
    return group;
}

export function makeFurniture(kind: IslandItemKind, m: IslandMaterials, waterMaterials = m) {
    if (isOptionalFurniture(kind)) return makeOptionalFurniture(kind, m);
    if (kind === 'flower') return makeFlowers(m);
    const group = new THREE.Group(), fixed = part(group, 'furniture-static');
    const wood = m.get('#b77640'), cutWood = m.get('#e9b768'), green = m.get('#4d7e62');
    if (kind === 'bench') {
        for (const x of [-.48, .48]) {
            for (const z of [-.18, .19]) softBox(fixed, green, [x, .225, z], [.11, .45, .11], .022);
            softBox(fixed, green, [x, .59, -.23], [.1, .75, .11], .025);
            softBox(fixed, cutWood, [x, .65, -.005], [.12, .09, .52]);
        }
        // One continuous center slat supports the exact seat anchor; darker gaps show the planks.
        for (const z of [-.175, 0, .175]) softBox(fixed, cutWood, [0, .45, z], [1.14, .1, .16]);
        for (const y of [.685, .875]) softBox(fixed, wood, [0, y, -.24], [1.14, .16, .11], .045);
        softBox(fixed, green, [0, .285, -.18], [.97, .09, .08], .02);
        for (const x of [-.46, .46]) for (const y of [.685, .875]) {
            ellipsoid(fixed, m.get('#efd09a'), [x, y, -.182], [.021, .021, .009], 8);
        }
    }
    if (kind === 'lantern') {
        profile(fixed, m.get('#cdd3b9'), [[0, 0], [.21, 0], [.24, .035], [.23, .085], [.17, .125], [0, .125]], 16);
        cylinder(fixed, wood, [-.08, .625, 0], .073, 1.05, .06);
        softBox(fixed, cutWood, [.02, 1.18, 0], [.34, .08, .1]);
        pole(fixed, wood, [-.08, .97, 0], [.16, 1.17, 0], .033);
        const metal = m.surface('#426857', .5, .18);
        pole(fixed, metal, [.12, 1.17, 0], [.12, 1.095, 0], .022);
        const hood = part(fixed, 'lantern-hood', [.12, 0, 0]);
        profile(hood, metal, [[0, 1.15], [.055, 1.15], [.17, 1.065], [.18, 1.035], [.16, 1.025], [0, 1.025]], 16);
        cylinder(fixed, metal, [.12, .727, 0], .135, .055, .16, 16);
        for (const side of [-1, 1]) pole(fixed, metal, [.12 + side * .115, .75, .035], [.12 + side * .135, 1.035, .035], .014);
        const light = part(group, 'lantern-light', [.12, .91, 0]);
        const glow = m.surface('#ffe39a', .38, 0, true).clone();
        glow.userData.islandOwned = true;
        ellipsoid(light, glow, [0, -.01, 0], [.105, .14, .1], 12);
        star(light, m.get('#fff1bd', true), [0, 0, .103], .067);
    }
    if (kind === 'swing') {
        for (const x of [-.66, .66]) {
            pole(fixed, wood, [x, .065, -.29], [x, 1.54, 0], .06);
            pole(fixed, wood, [x, .065, .29], [x, 1.54, 0], .06);
            pole(fixed, cutWood, [x, .6, -.185], [x, .6, .185], .033);
        }
        pole(fixed, cutWood, [-.76, 1.58, 0], [.76, 1.58, 0], .075);
        const moving = part(group, 'swing-moving', [0, 1.55, 0]);
        for (const x of [-.29, .29]) {
            pole(moving, m.get('#e6d6a2'), [x, 0, 0], [x, -1.05, 0], .025);
            cylinder(fixed, green, [x, 1.55, 0], .04, .075, .04, 10);
        }
        softBox(moving, green, [0, -1.1, 0], [.78, .1, .4], .04);
        softBox(moving, cutWood, [0, -1.075, .155], [.73, .025, .045], .008);
        batch(moving, m.painted);
    }
    if (kind === 'mushroom') {
        profile(fixed, m.get('#e8d9ac'), [[0, 0], [.18, 0], [.205, .055], [.16, .25], [.19, .44], [0, .44]], 18);
        profile(fixed, m.get('#cbbd94'), [[0, .37], [.23, .385], [.43, .415], [.49, .46], [.43, .49], [0, .49]], 24);
        // Flat small crown gives a real, known sitting surface, surrounded by a rounded cap.
        profile(fixed, m.get('#dc795d'), [[0, .64], [.19, .64], [.31, .615], [.43, .565], [.50, .485], [.49, .46], [0, .46]], 24);
        for (const [x, z, s] of [[-.3, -.04, .077], [.09, .29, .068], [.25, -.16, .066]]) {
            ellipsoid(fixed, m.get('#fff0c8'), [x, .613, z], [s, .009, s], 10);
        }
    }
    if (kind === 'mushroom' && appearanceFamily(m) === 'crystal') {
        const edge = mesh(fixed, new THREE.CylinderGeometry(.47, .50, .055, 8), m.surface('#b3eff4', .35, .08), [0, .488, 0]);
        edge.rotation.y = Math.PI / 8;
    }
    if (kind === 'mushroom' && appearanceFamily(m) === 'starry') for (const x of [-.32, .32]) {
        const mark = star(fixed, m.get('#fff0c8'), [x, .557, .14], .06); mark.rotation.x = -Math.PI / 2;
    }
    if (kind === 'fountain') {
        profile(fixed, m.get('#8eaaa3'), [[0, .015], [.61, .015], [.69, .07], [.69, .14], [.65, .18], [0, .18]], 28);
        profile(fixed, m.get('#d5dac3'), [[.52, .17], [.64, .17], [.68, .235], [.68, .3], [.65, .34], [.56, .34], [.53, .30], [.52, .17]], 28);
        profile(fixed, m.get('#bdcbb7'), [[0, .27], [.18, .27], [.19, .32], [.13, .43], [.12, .58], [.17, .6], [.17, .64], [0, .64]], 20);
        const surface = part(group, 'fountain-surface');
        cylinder(surface, waterMaterials.surface('#67c9bf', .24, .06), [0, .292, 0], .537, .015, .537, 28);
        const water = part(group, 'fountain-water', [0, .64, 0]);
        ellipsoid(water, waterMaterials.surface('#b3efde', .2, .04, true), [0, .09, 0], [.06, .145, .06], 12);
        for (let i = 0; i < 3; i++) {
            const angle = i * Math.PI * 2 / 3;
            ellipsoid(water, waterMaterials.surface('#b3efde', .2, .04, true), [Math.cos(angle) * .22, -.16, Math.sin(angle) * .22], [.037, .055, .037], 10);
        }
        batch(water);
        const ripple = part(group, 'fountain-ripple', [0, .309, 0]);
        const ring = mesh(ripple, new THREE.TorusGeometry(.30, .01, 5, 28), waterMaterials.surface('#c0eee1', .3, .04));
        ring.rotation.x = -Math.PI / 2;
    }
    batch(fixed, m.painted);
    return group;
}

function lifeAmount(amount: number) {
    return Math.max(0, Math.min(1.3, Number.isFinite(amount) ? amount : 0));
}

function applySurfaceResponse(group: THREE.Group, value: number, reduced: boolean) {
    const blooms = group.getObjectByName('flower-blooms');
    if (blooms) { blooms.scale.set(1 + value * .06, 1 + value * .06, 1 + value * .06); blooms.rotation.y = reduced ? 0 : value * .045; }
    const matureBloom = group.getObjectByName('growth-blooms');
    if (matureBloom) { matureBloom.scale.setScalar(1 + value * .06); matureBloom.rotation.y = reduced ? 0 : value * .045; }
    group.getObjectByName('lantern-light')?.traverse(object => {
        if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshStandardMaterial && object.material.userData.islandOwned) {
            object.material.emissiveIntensity = .65 + value * .6;
        }
    });
    const ripple = group.getObjectByName('fountain-ripple');
    if (ripple) ripple.scale.setScalar(1 + value * .3);
}

/** An ordinary visit responds only through blooms, emitted light and the surface ripple. */
export function applyFurnitureInterest(group: THREE.Group, amount: number, reduced = false) {
    applySurfaceResponse(group, lifeAmount(amount), reduced);
}

/** A saved answer retains its broader living response, including leaves and falling water. */
export function applyFurnitureLife(group: THREE.Group, amount: number, reduced = false) {
    const value = lifeAmount(amount);
    applySurfaceResponse(group, value, reduced);
    const leaves = group.getObjectByName('flower-leaves');
    if (leaves) leaves.scale.set(1 + value * .06, 1, 1 + value * .06);
    const water = group.getObjectByName('fountain-water');
    if (water) water.scale.y = 1 + value * .28;
}

export function applyFurnitureUse(group: THREE.Group, phase: number) {
    const moving = group.getObjectByName('swing-moving');
    if (moving) moving.rotation.x = sampleFurnitureSwing(phase).angle;
}

export function makeSelection(preview = false) {
    const geometry = new THREE.RingGeometry(.67, .72, 40);
    geometry.rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color: preview ? '#fff6c9' : '#ffffff',
        transparent: true, opacity: .92, depthWrite: false, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(geometry, material);
    ring.position.y = .045;
    return ring;
}

export function makeLightArrival(m: IslandMaterials) {
    const group = new THREE.Group();
    star(group, m.get('#ffdf7c', true), [0, 0, 0], .18);
    return group;
}
