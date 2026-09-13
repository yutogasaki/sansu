import * as T from 'three';
import { batch, cylinder, ellipsoid, IslandMaterials } from '../three/primitives';
import { growthStage, type LifeItem, type Style } from '../../../domain/islandLife/model';
import type { LifeSeat } from './residentMotion';

export const tint = (style: Style) => style === 'sunshine' ? '#f5bf60' : style === 'starlight' ? '#a998d8' : '#eb8f9e';

/** Shared catalog and placed-item model. Growth is always supplied by the caller. */
export function buildLifeItem(item: LifeItem, materials: IslandMaterials, showSoil = true) {
    const g = new T.Group();
    const result: Partial<LifeSeat> = {};
    const paint = (color: string) => materials.surface(color, .85);
    const box = (parent: T.Object3D, color: string, x: number, y: number, z: number, w: number, h: number, d: number) => {
        const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), paint(color));
        mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    const color = tint(item.style);
    if (item.kind === 'flower') {
        const stage = growthStage(item);
        if (showSoil) ellipsoid(g, paint('#bba178'), [0, -.005, 0], [.37, .028, .34], 12);
        const stems = [[-.20, -.13], [.18, -.17], [0, .02], [-.17, .19], [.19, .18]];
        stems.forEach(([x, z], i) => {
        const h = .13 + stage * .15 + (i % 3) * .045;
        cylinder(g, paint('#478762'), [x, h / 2, z], .015, h);
        for (const side of [-1, 1]) {
            const leaf = ellipsoid(g, paint(side < 0 ? '#4f8a55' : '#80ad65'), [x + side * .07, h * .48, z], [.12, .035, .06], 10);
            leaf.rotation.z = side * .35; leaf.rotation.y = i * .7;
        }
        if (stage === 1) ellipsoid(g, paint(color), [x, h, z], [.06, .085, .06], 12);
        if (stage === 2) {
            for (let j = 0; j < 6; j++) {
            const a = j * Math.PI / 3 + i * .4;
            const petal = ellipsoid(g, paint(color), [x + Math.cos(a) * .087, h, z + Math.sin(a) * .087], [.078, .045, .10], 12);
            petal.rotation.y = -a + Math.PI / 2; petal.rotation.z = Math.cos(a) * .2;
            }
            ellipsoid(g, paint('#ffe895'), [x, h + .041, z], [.052, .033, .052], 12);
        }
        });
        batch(g);
    } else if (item.kind === 'sapling') {
        const stage = growthStage(item), height = [.20, .52, .92][stage];
        if (showSoil) ellipsoid(g, paint('#bba178'), [0, -.005, 0], [.33, .028, .31], 12);
        const trunk = new T.CatmullRomCurve3([new T.Vector3(0, 0, 0), new T.Vector3(.045, height * .45, 0), new T.Vector3(-.035, height, 0)]);
        const wood = new T.Mesh(new T.TubeGeometry(trunk, 14, [.022, .039, .062][stage], 8, false), paint('#a47c4c'));
        wood.castShadow = wood.receiveShadow = true; g.add(wood);
        const leafColor = item.style === 'original' ? '#409b77' : item.style === 'sunshine' ? '#b9be56' : '#8980b1';
        const size = [.16, .25, .34][stage];
        for (const side of [-1, 1]) for (let j = 0; j < (stage === 0 ? 1 : 2); j++) {
            const leaf = ellipsoid(g, paint(j ? '#65bda0' : leafColor), [side * size * .38, height - j * .17, (j - .5) * .09], [size * .68, size * .24, size], 18);
            leaf.rotation.z = side * .42; leaf.rotation.y = side * .45 + j * .8;
        }
        // The mature canopy stays within its own cell; adjacent approaches stay clear.
        batch(g);
    } else if (item.kind === 'water-bowl') {
        const profile = [[.03, .035], [.23, .035], [.32, .10], [.38, .28], [.37, .32], [.33, .32], [.29, .14], [.04, .105]];
        const bowl = new T.Mesh(new T.LatheGeometry(profile.map(([x, y]) => new T.Vector2(x, y)), 40), materials.surface('#ead6af', .48));
        bowl.castShadow = bowl.receiveShadow = true; g.add(bowl);
        const water = new T.Mesh(new T.CircleGeometry(.312, 40), materials.surface('#67c9ce', .22));
        water.rotation.x = -Math.PI / 2; water.position.y = .23; water.name = 'life-bowl-water'; g.add(water);
        const rim = new T.Mesh(new T.TorusGeometry(.349, .028, 10, 40), materials.surface(color, .4));
        rim.rotation.x = Math.PI / 2; rim.position.y = .31; g.add(rim);
    } else if (item.kind === 'bench') {
        const seat = box(g, '#b48258', 0, .29, 0, .7, .10, .35); result.seat = seat; box(g, color, 0, .49, -.14, .7, .33, .08);
        for (const x of [-.26, .26]) box(g, '#b48258', x, .12, 0, .07, .24, .3);
    } else if (item.kind === 'swing') {
        for (const x of [-.31, .31]) for (const z of [-.23, .23]) {
        const leg = box(g, '#b4865d', x, .71, z, .055, 1.43, .055); leg.rotation.x = z * -.45;
        }
        box(g, color, 0, 1.42, 0, .78, .09, .08);
        const pivot = new T.Group(); pivot.position.y = 1.42; g.add(pivot);
        for (const x of [-.24, .24]) cylinder(pivot, paint('#f0e0bb'), [x, -.575, 0], .014, 1.15);
        const seat = box(pivot, color, 0, -1.15, 0, .52, .10, .32); seat.name = 'swing-seat';
        result.seat = seat; result.pivot = pivot;
    } else {
        cylinder(g, paint('#a88054'), [0, .46, 0], .055, .9);
        ellipsoid(g, materials.surface('#fff2a1', .4, 0, true), [0, .92, 0], [.18, .18, .18]);
        for (const x of [-.13, .13]) box(g, '#dab46a', x, .91, 0, .025, .38, .2);
    }
    return { root: g, seat: result.seat, pivot: result.pivot };
}
