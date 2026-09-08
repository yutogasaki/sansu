import * as THREE from 'three';
import { batch, curve, cylinder, ellipsoid, mesh, pole, star, type IslandMaterials } from './primitives';

/** All decorative silhouettes stay on the existing house or above the rooted
 * tree. They do not introduce pretend furniture in walkable/arrangeable space. */
export function crystalShard(parent: THREE.Object3D, m: IslandMaterials, at: [number, number, number],
    radius: number, height: number, color = '#a8e9ed') {
    const group = new THREE.Group(); group.position.set(...at); parent.add(group);
    const material = m.surface(color, .3, .12);
    cylinder(group, material, [0, height * .34, 0], radius, height * .68, radius, 6);
    cylinder(group, material, [0, height * .84, 0], radius, height * .32, 0, 6);
    return group;
}

function candyDisc(parent: THREE.Object3D, m: IslandMaterials, at: [number, number, number], radius: number, color: string) {
    const disc = new THREE.Group(); disc.position.set(...at); parent.add(disc);
    const sweet = cylinder(disc, m.surface(color, .55), [0, 0, 0], radius, radius * .5, radius, 24);
    sweet.rotation.x = Math.PI / 2;
    const spiral: [number, number, number][] = [];
    for (let i = 0; i <= 42; i++) {
        const a = i / 42 * Math.PI * 4.7, r = radius * (.045 + i / 42 * .79);
        spiral.push([Math.cos(a) * r, Math.sin(a) * r, radius * .258]);
    }
    curve(disc, m.surface('#fff7de', .55), spiral, radius * .065);
    return disc;
}

export function addThemeCanopy(crown: THREE.Group, m: IslandMaterials) {
    if (m.artDirection === 'starry') {
        for (const [x, y, z, radius] of [[-.77, .54, .06, .69], [.72, .58, -.05, .72], [-.25, 1, -.28, .77], [.25, .81, .38, .68]]) {
            ellipsoid(crown, m.surface(x < 0 ? '#4e8843' : '#76a84d', .83), [x, y, z], [radius, radius * .7, radius * .8], 20);
        }
        const orbit = mesh(crown, new THREE.TorusGeometry(1.42, .035, 6, 56), m.surface('#ffe5a5', .4, .12), [0, .57, .05]);
        orbit.rotation.x = 1.04; orbit.rotation.y = -.18;
        star(crown, m.surface('#fff3ae', .55, 0, true), [.07, 1.55, .16], .31);
        for (const [x, y, z, size] of [[-.86, .67, .66, .14], [.67, .85, .61, .18], [-.09, .86, .93, .11]]) {
            star(crown, m.surface('#fff3ae', .55, 0, true), [x, y, z], size);
        }
    } else if (m.artDirection === 'candy') {
        const pieces: [number, number, number, number, string][] = [
            [-.79, .57, .05, .73, '#ed367d'], [.68, .63, -.08, .72, '#ffbe3d'],
            [-.21, 1.06, -.2, .74, '#16cba4'], [.23, .54, .57, .66, '#ab47d7'],
        ];
        for (const [x, y, z, radius, color] of pieces) {
            const disc = candyDisc(crown, m, [x, y, z], radius, color);
            disc.rotation.y = x * .28; disc.rotation.z = x * .2;
        }
    } else if (m.artDirection === 'crystal') {
        for (const [x, y, z, radius, height] of [[0, -.17, -.17, .52, 1.94], [-.79, -.16, .08, .42, 1.39],
            [.76, -.14, -.03, .46, 1.55], [-.29, -.12, .57, .42, 1.31], [.45, -.13, .6, .4, 1.2]]) {
            const shard = crystalShard(crown, m, [x, y, z], radius, height, x < 0 ? '#9550e2' : x > .4 ? '#38c7dc' : '#d9ceff');
            shard.rotation.z = -x * .32;
        }
        const ring = mesh(crown, new THREE.TorusGeometry(1.17, .033, 6, 48), m.surface('#f7f4ff', .4, .1), [0, .37, .14]);
        ring.rotation.x = Math.PI / 2;
    } else return false;
    // Early growth keeps its smaller crown, while its themed silhouette still
    // spans the branches rather than reading as a tiny object on a bare stick.
    for (const child of crown.children) {
        child.position.x *= 1.13; child.position.z *= 1.13;
        child.scale.x *= 1.13; child.scale.z *= 1.13;
    }
    return true;
}

export function addObservatoryRoof(parent: THREE.Group, m: IslandMaterials) {
    cylinder(parent, m.surface('#dfb37b', .7, .12), [0, 1.51, 0], 1.15, .16, 1.15, 32);
    mesh(parent, new THREE.SphereGeometry(1.09, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
        m.surface('#c24f3e', .65, .12), [0, 1.57, 0]);
    // One broad gold observation slit reads at phone size without a text label.
    const slit: [number, number, number][] = [];
    for (let i = 0; i <= 18; i++) {
        const a = i / 18 * Math.PI * .47;
        slit.push([.12, 1.57 + Math.cos(a) * 1.1, Math.sin(a) * 1.1]);
    }
    curve(parent, m.surface('#ffdca0', .55, .08), slit, .075);
    const telescope = new THREE.Group(); telescope.position.set(.14, 2.15, .56); telescope.rotation.x = .77; parent.add(telescope);
    cylinder(telescope, m.surface('#f4d99e', .45, .12), [0, 0, 0], .13, .72, .15, 16);
    cylinder(telescope, m.surface('#314573', .3, .15), [0, .37, 0], .155, .055, .155, 16);
}

export function addHouseThemeTrim(parent: THREE.Group, m: IslandMaterials) {
    if (m.artDirection === 'candy') {
        // Icing follows the existing gable edges; candy buttons remain attached.
        curve(parent, m.surface('#fff7de', .58), [[-1.13, 1.51, 1.01], [-.62, 1.94, 1.01], [0, 2.38, 1.01], [.62, 1.94, 1.01], [1.13, 1.51, 1.01]], .079);
        for (const [x, y] of [[-.86, 1.8], [-.47, 2.1], [0, 2.43], [.47, 2.1], [.86, 1.8]]) {
            ellipsoid(parent, m.surface(x < 0 ? '#b3e9dd' : '#f694b6', .5), [x, y, 1.04], [.11, .11, .07], 12);
        }
        candyDisc(parent, m, [.57, 1.19, .81], .18, '#f694b6');
    } else if (m.artDirection === 'crystal') {
        for (const [x, height] of [[-.73, .38], [0, .66], [.73, .4]]) {
            crystalShard(parent, m, [x, 2.36 - Math.abs(x) * .77, -.05], .16, height, x === 0 ? '#9856e6' : '#4dccdd');
        }
        curve(parent, m.surface('#f1f1ff', .38, .1), [[-1.13, 1.51, 1], [0, 2.38, 1], [1.13, 1.51, 1]], .055);
    }
}

export function addThemeEnvironment(parent: THREE.Group, m: IslandMaterials) {
    const theme = m.artDirection;
    if (theme !== 'starry' && theme !== 'candy' && theme !== 'crystal') return;
    parent.name = 'theme-environment';
    // Marks sit on the sea below the physical island, never on a walking route.
    if (theme === 'starry') {
        for (const [x, z, size] of [[-4.45, 2.75, .18], [-3.65, 3.28, .12], [-2.8, 3.75, .17], [3.7, 3.1, .19], [4.3, 2.28, .12]]) {
            const light = star(parent, m.surface('#fff0b0', .7, 0, true), [x, -.79, z], size);
            light.rotation.x = -Math.PI / 2;
        }
        curve(parent, m.get('#a9b4e5'), [[-4.45, -.78, 2.75], [-3.65, -.78, 3.28], [-2.8, -.78, 3.75]], .014);
    } else if (theme === 'candy') {
        for (const [x, z, radius] of [[-4.35, 2.85, .29], [-3.7, 3.28, .19], [3.69, 2.96, .23]]) {
            const ring = mesh(parent, new THREE.TorusGeometry(radius, .052, 8, 24), m.surface('#fff6dc', .6), [x, -.78, z]);
            ring.rotation.x = Math.PI / 2;
        }
    } else {
        for (const [x, z, scale] of [[-3.92, 2.96, .65], [-3.16, 3.24, .51], [3.92, 2.96, .62], [3.16, 3.24, .36]]) {
            // Front-facing shore only. The west/east-side banks become usable
            // land after expansion, so those banks cannot carry extra obstacles.
            for (const [dx, dz, ratio] of [[0, 0, 1], [.17, .05, .68], [-.14, -.04, .48]]) {
                crystalShard(parent, m, [x + dx, -.25, z + dz], scale * .21, scale * ratio, dx < 0 ? '#9655df' : '#57d7e5');
            }
        }
    }
    batch(parent);
}

export function addAccentMotifs(group: THREE.Group, m: IslandMaterials, accent: 'star-lanterns' | 'candy-flags' | 'crystal-charms' | null) {
    if (!accent) return;
    group.name = `accent-${accent}`;
    const cable = m.surface('#f6dcad', .8);
    curve(group, cable, [[-3.46, 1.49, -.56], [-2.6, 1.31, -.52], [-1.72, 1.49, -.56]], .018);
    const positions: [number, number, number][] = [[-3.3, 1.37, -.51], [-2.91, 1.28, -.48], [-2.53, 1.26, -.48], [-2.14, 1.31, -.5], [-1.86, 1.38, -.53]];
    for (const [i, at] of positions.entries()) {
        if (accent === 'star-lanterns') star(group, m.surface('#ffe7a0', .55, 0, true), at, .155);
        else if (accent === 'crystal-charms') {
            const shard = crystalShard(group, m, [at[0], at[1] - .27, at[2]], .087, .28, i % 2 ? '#c5b4eb' : '#9fe4ee');
            shard.rotation.z = i % 2 ? .13 : -.13;
        } else {
            const shape = new THREE.Shape(); shape.moveTo(-.135, 0); shape.lineTo(.135, 0); shape.lineTo(0, -.25); shape.closePath();
            mesh(group, new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false }), m.get(i % 2 ? '#ff9dbd' : '#b0e7d9'), at);
            pole(group, m.get('#fff4cc'), [at[0] - .08, at[1] - .08, at[2] + .03], [at[0] + .08, at[1] - .08, at[2] + .03], .021);
        }
    }
    for (const [x, y, z] of [[.62, 2.09, -.89], [2.59, 1.93, -.97]]) {
        pole(group, cable, [x, y + .25, z], [x, y, z], .017);
        if (accent === 'star-lanterns') star(group, m.surface('#ffe7a0', .55, 0, true), [x, y - .12, z], .22);
        else if (accent === 'crystal-charms') crystalShard(group, m, [x, y - .4, z], .14, .39, '#b5dcf7');
        else {
            candyDisc(group, m, [x, y - .12, z], .19, '#ff9dbc');
            for (const side of [-1, 1]) {
                const wrap = mesh(group, new THREE.ConeGeometry(.13, .2, 4), m.get('#fff1bd'), [x + side * .27, y - .12, z]);
                wrap.rotation.z = side * Math.PI / 2;
            }
        }
    }
    batch(group);
}
