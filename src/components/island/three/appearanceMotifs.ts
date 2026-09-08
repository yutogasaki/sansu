import * as THREE from 'three';
import { IslandPartMaterials } from './appearanceParts';
import { box, curve, cylinder, ellipsoid, mesh, star, type IslandMaterials } from './primitives';
import { crystalShard } from './themeMotifs';

export function appearanceFamily(m: IslandMaterials) {
    return m instanceof IslandPartMaterials && m.style.version === 'parts-v1' ? m.style.family : undefined;
}

/** Real petals, read both on the planted flower and on its mature branches. */
export function appearanceBlossom(parent: THREE.Group, m: IslandMaterials, x: number, y: number, z: number,
    radius: number, color: string) {
    const family = appearanceFamily(m);
    if (!family || family === 'moon-garden') return false;
    if (family === 'starry') {
        const bloom = star(parent, m.get(color), [x, y, z], radius);
        bloom.rotation.x = -Math.PI / 2;
    } else if (family === 'crystal') {
        for (let i = 0; i < 6; i++) {
            const a = i * Math.PI / 3;
            const petal = mesh(parent, new THREE.OctahedronGeometry(radius * .55), m.surface(color, .35, .08),
                [x + Math.cos(a) * radius * .46, y, z + Math.sin(a) * radius * .46], [1, .35, .55]);
            petal.rotation.y = -a;
        }
    } else {
        for (let i = 0; i < 4; i++) {
            const a = i * Math.PI / 2 + .4;
            const petal = ellipsoid(parent, m.surface(color, .6), [x + Math.cos(a) * radius * .42, y, z + Math.sin(a) * radius * .42],
                [radius * .56, radius * .27, radius * .34], 12);
            petal.rotation.y = -a;
        }
        const icing = mesh(parent, new THREE.TorusGeometry(radius * .32, radius * .09, 5, 16), m.get('#fff7de'), [x, y + radius * .15, z]);
        icing.rotation.x = Math.PI / 2;
    }
    ellipsoid(parent, m.get('#d99635'), [x, y + radius * .18, z], [radius * .23, radius * .16, radius * .23], 10);
    return true;
}

/** Distant shapes have their own ownership and never enter close-up bounds. */
export function addAppearanceSky(group: THREE.Group, m: IslandPartMaterials) {
    const family = appearanceFamily(m);
    if (!family || family === 'moon-garden') return;
    group.name = `appearance-sky-${family}`;
    if (family === 'starry') {
        for (const [x, y, z, radius] of [[-5, 4.2, -5, .28], [-2.9, 4.7, -5.4, .17], [1, 4.4, -5.8, .22], [4.5, 3.9, -5.4, .32]]) {
            star(group, m.surface('#ffe7a0', .75, 0, true), [x, y, z], radius);
        }
        const distant = new THREE.Group(); distant.position.set(-4.7, .12, -5.9); group.add(distant);
        cylinder(distant, m.get('#9495d8'), [0, .4, 0], .43, .8, .43, 12);
        mesh(distant, new THREE.SphereGeometry(.49, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), m.get('#c1b7eb'), [0, .81, 0]);
        box(distant, m.get('#ffe7a0'), [0, .5, .437], [.09, .29, .025]);
    } else if (family === 'candy') {
        for (const [x, y, z, scale] of [[-5.2, 3.1, -5.1, 1], [-1.7, 4.7, -5.4, .8], [3.7, 3.6, -5.5, 1.15]]) {
            for (const [dx, dy, size] of [[-.46, -.05, .55], [0, .16, .69], [.52, -.04, .52]]) {
                ellipsoid(group, m.surface(dx === 0 ? '#fff4d9' : '#ffcade', .95), [x + dx * scale, y + dy * scale, z],
                    [size * scale, size * .61 * scale, size * .4 * scale], 16);
            }
        }
    } else {
        for (const [x, z, height] of [[-5.8, -5.8, 1.35], [-5.1, -6.1, 2.1], [-4.3, -6.3, 1.3], [3.9, -6.2, 1.2], [4.7, -6.4, 1.8]]) {
            crystalShard(group, m, [x, -.4, z], .5, height, x < 0 ? '#c5d4ef' : '#b0dfe4');
        }
    }
    // Keep distant silhouettes inside the established first-island camera.
    // They remain beyond the authored shore and never expand close-up bounds.
    for (const child of group.children) if (child.position.y > 2) child.position.y -= 1.3;
    group.scale.setScalar(.78);
    group.traverse(child => { if (child instanceof THREE.Mesh) { child.castShadow = false; child.receiveShadow = false; } });
}

export function addAppearanceBridge(group: THREE.Group, m: IslandPartMaterials) {
    const family = appearanceFamily(m);
    if (!family || family === 'moon-garden') return;
    for (const x of [4.03, 4.69, 5.38]) for (const z of [-.55, .55]) {
        if (family === 'starry') star(group, m.get('#ffe7a0'), [x, .8, z], .10);
        else if (family === 'crystal') crystalShard(group, m, [x, .67, z], .066, .22, '#b8ebf1');
        else {
            const paper = mesh(group, new THREE.OctahedronGeometry(.105), m.get('#fff2bd'), [x, .79, z], [1, .65, .7]);
            paper.rotation.y = Math.PI / 4;
        }
    }
}

export function addAppearanceWater(group: THREE.Group, m: IslandPartMaterials) {
    const family = appearanceFamily(m);
    if (!family || family === 'moon-garden') return;
    for (const [x, z] of [[-2, 4.4], [2.9, 3.8], [-5.2, -.2]]) {
        const width = family === 'candy' ? .42 : .29;
        curve(group, m.get(family === 'starry' ? '#aeb9ff' : '#d5fff4'),
            [[x - width, -.805, z], [x, -.8, z + (family === 'crystal' ? .19 : .07)], [x + width, -.805, z]], .018);
        if (family === 'crystal') curve(group, m.get('#dbfcf8'), [[x - .2, -.805, z + .12], [x + .1, -.8, z + .26], [x + .4, -.805, z + .12]], .012);
    }
}
