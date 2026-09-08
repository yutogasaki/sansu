import * as THREE from 'three';
import { ISLAND_EAST_LAND } from '../../../domain/island/catalog';
import { IslandMaterials, batch, box, curve, cylinder, ellipsoid, mesh, pole, star } from './primitives';
import { makeFlowers, makeFurniture } from './furniture';
import { cottageRoofGeometry, islandGroundGeometry, loftGeometry, organicEllipsoidGeometry,
    roundedBoxGeometry, shoreContour, steppingStoneGeometry, type Size3 } from './geometry';
import { addHouseThemeTrim, addObservatoryRoof, addThemeCanopy } from './themeMotifs';

/** The outer water rim belongs to the island silhouette, including its small height ripple. */
export const ISLAND_SHORE_RIM = { offset: .17, height: -.821, ripple: .023, segments: 64 } as const;

function rounded(parent: THREE.Object3D, material: THREE.Material, position: [number, number, number], size: Size3, radius = .035) {
    return mesh(parent, roundedBoxGeometry(size, radius), material, position);
}

function land(m: IslandMaterials, x: number, z: number, rx: number, rz: number) {
    const group = new THREE.Group();
    group.position.set(x, 0, z);
    // All changes are outside the saved ellipse. No placed object loses its level ground.
    const ring = (rings: [number, number, number][], color: string, roughness: number) => {
        const positions: number[] = [], indices: number[] = [], segments = ISLAND_SHORE_RIM.segments;
        for (const [offset, y, beachWidth] of rings) for (let i = 0; i <= segments; i++) {
            const a = i / segments * Math.PI * 2;
            const beach = Math.pow(.5 + .5 * Math.sin(a - .4), 2);
            const r = shoreContour(a) + offset + beach * beachWidth;
            const height = y + (y < -.12 ? Math.sin(a * 4 + .2) * ISLAND_SHORE_RIM.ripple : 0);
            positions.push(Math.cos(a) * rx * r, height, Math.sin(a) * rz * r);
        }
        for (let row = 0; row < rings.length - 1; row++) for (let i = 0; i < segments; i++) {
            const a = row * (segments + 1) + i, b = a + segments + 1;
            indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setIndex(indices); geometry.computeVertexNormals();
        return mesh(group, geometry, m.surface(color, roughness));
    };
    ring([[-.065, -.84, .01], [.012, -.62, .013], [.015, -.43, .018], [.004, -.2, .018]], '#939d85', .95);
    ring([[.013, -.405, .025], [.019, -.29, .052], [.012, -.19, .045], [-.005, -.112, 0]], '#e4c48a', .98);
    ring([[-.005, -.12, 0], [.003, -.079, 0], [.004, -.033, 0], [0, 0, 0]], '#72ab50', .98);
    const grass = m.surface('#72ab50', .98).clone();
    grass.vertexColors = true; grass.userData.islandOwned = true;
    mesh(group, islandGroundGeometry(rx, rz), grass);
    ring([[ISLAND_SHORE_RIM.offset, ISLAND_SHORE_RIM.height, 0], [.074, -.819, 0]], '#76d3c9', .9);
    return group;
}

function bush(parent: THREE.Group, m: IslandMaterials, x: number, z: number, size: number) {
    ellipsoid(parent, m.get('#5e9d63'), [x, size * .36, z], [size * .7, size * .55, size * .65]);
    ellipsoid(parent, m.get('#75ae66'), [x + size * .35, size * .32, z + .12], [size * .47, size * .42, size * .5]);
}

function cottage(m: IslandMaterials) {
    const group = new THREE.Group();
    group.position.set(-2.6, 0, -1.65);
    const wall = m.surface('#f7e8c6', .91), trim = m.surface('#dfb37b', .84), wood = m.surface('#ba7b49', .84);
    rounded(group, m.surface('#c0bc9f', .96), [0, .08, 0], [1.97, .16, 1.7], .055);
    rounded(group, wall, [0, .77, 0], [1.8, 1.4, 1.45], .065);
    const observatory = m.artDirection === 'starry';
    const gable = new THREE.Shape();
    gable.moveTo(-.9, 0); gable.lineTo(0, .8); gable.lineTo(.9, 0); gable.closePath();
    if (observatory) addObservatoryRoof(group, m);
    else {
    mesh(group, new THREE.ExtrudeGeometry(gable, { depth: 1.45, bevelEnabled: false }), wall, [0, 1.46, -.725]);
    mesh(group, cottageRoofGeometry(), m.surface('#c24f3e', .76));
    // Fewer, connected broad seams leave room for the roof's color and silhouette.
    for (const side of [-1, 1]) {
        curve(group, m.surface('#eb8a5a', .76), [[side * 1.17, 1.44, .99], [side * 1.1, 1.54, .99],
            [side * .55, 1.97, .99], [0, 2.355, .99]], .045);
        for (let row = 0; row < 3; row++) {
            const x = side * (.28 + row * .31), y = 2.33 - (Math.abs(x) - .08) * .769 + .007;
            pole(group, m.surface(row % 2 ? '#de7956' : '#e58259', .76), [x, y, -.94], [x, y, .94], .021);
        }
    }
    pole(group, m.surface('#ed9967', .76), [0, 2.35, -.98], [0, 2.35, .99], .048);
    rounded(group, m.surface('#b4aaa0', .95), [-.48, 2.27, -.4], [.29, .68, .32], .035);
    rounded(group, m.surface('#d2c8b9', .95), [-.48, 2.62, -.4], [.4, .12, .41], .025);
    }
    const door = new THREE.Shape();
    door.moveTo(-.28, 0); door.lineTo(.28, 0); door.lineTo(.28, .69);
    door.absarc(0, .69, .28, 0, Math.PI, false); door.closePath();
    mesh(group, new THREE.ExtrudeGeometry(door, { depth: .045, bevelEnabled: true,
        bevelSegments: 2, bevelSize: .045, bevelThickness: .025 }), wood, [-.18, .13, .77]);
    rounded(group, m.surface('#79b6ac', .38), [-.18, .86, .838], [.31, .3, .02], .009);
    rounded(group, trim, [-.18, .86, .86], [.025, .34, .025], .009);
    rounded(group, trim, [-.18, .86, .86], [.33, .028, .025], .009);
    ellipsoid(group, m.get('#687763'), [.015, .53, .86], [.04, .04, .035]);
    rounded(group, m.surface('#dcceab', .95), [-.18, .055, 1.01], [.86, .11, .37], .035);
    for (const x of [-.68, .57]) rounded(group, trim, [x, .62, .775], [.12, 1.02, .09], .022);
    rounded(group, trim, [.918, .8, -.1], [.045, .6, .65], .018);
    rounded(group, m.surface('#80b5b5', .38), [.949, .8, -.1], [.025, .43, .48], .01);
    rounded(group, trim, [.97, .8, -.1], [.035, .48, .03], .01);
    rounded(group, trim, [.97, .8, -.1], [.035, .03, .48], .01);
    rounded(group, wood, [.99, .49, -.1], [.18, .12, .68], .025);
    const flowerbox = makeFlowers(m, 2); flowerbox.scale.setScalar(.48); flowerbox.position.set(1.02, .55, -.1); group.add(flowerbox);
    const lamp = makeFurniture('lantern', m); lamp.scale.setScalar(.53); lamp.position.set(.64, .56, .87); group.add(lamp);
    addHouseThemeTrim(group, m);
    return group;
}

interface TreeLife {
    glow: THREE.MeshStandardMaterial;
    pendants: THREE.Group[];
    leaves: THREE.Group[];
    anchor: THREE.Vector3;
    crown: THREE.Group;
}
const treeLives = new WeakMap<THREE.Group, TreeLife>();

/** React at the light and attached leaves; the roots, trunk, and crown remain grounded. */
export function applyTreeLife(group: THREE.Group, amount: number, reduced = false) {
    const life = treeLives.get(group);
    if (!life) return;
    const beat = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 1) : 0;
    life.glow.emissiveIntensity = .58 + beat * 1.15;
    life.pendants.forEach((pendant, i) => { pendant.rotation.z = reduced ? 0 : Math.sin(beat * Math.PI) * (i ? -.13 : .11); });
    life.leaves.forEach((leaf, i) => { leaf.rotation.z = reduced ? 0 : Math.sin(beat * Math.PI) * (i ? -.12 : .14); });
}

/** A local-space anchor, independent of world position and the reaction's leaf motion. */
export function getTreeLightAnchor(group: THREE.Group): THREE.Vector3 {
    return treeLives.get(group)?.anchor.clone() ?? new THREE.Vector3(0, 1.05, .31);
}

/** Maturity changes the actual outer canopy. The rooted structure and light
 * anchor retain their exact transforms at every appearance, including legacy. */
export function applyTreeGrowth(group: THREE.Group, level?: number) {
    const life = treeLives.get(group);
    if (!life) return false;
    const scale = level === undefined ? [1, 1, 1] : [
        [.64, .66, .64], [.9, .87, .9], [1.17, 1.1, 1.17], [1.5, 1.38, 1.5],
    ][Math.max(0, Math.min(3, Math.floor(level)))];
    if (life.crown.scale.x === scale[0] && life.crown.scale.y === scale[1] && life.crown.scale.z === scale[2]) return false;
    life.crown.scale.set(scale[0], scale[1], scale[2]);
    return true;
}

export function makeStarTree(m: IslandMaterials) {
    const group = new THREE.Group();
    group.position.set(1.6, 0, -1.6);
    const structure = new THREE.Group(); structure.name = 'tree-structure';
    group.add(structure);
    const trunk = m.surface('#bc8a4d', .9);
    mesh(structure, loftGeometry([
        { y: 0, radiusX: .26, radiusZ: .24, lobes: 5, lobeStrength: .48 },
        { y: .075, radiusX: .3, radiusZ: .28, lobes: 5, lobeStrength: .38 },
        { y: .23, radiusX: .37, radiusZ: .34, lobes: 5, lobeStrength: .13 },
        { y: .56, radiusX: .32, radiusZ: .3, lobes: 5, lobeStrength: .025 },
        { y: 1.1, radiusX: .285, radiusZ: .28, centerX: .04, centerZ: -.03 },
        { y: 1.7, radiusX: .22, centerX: -.06, centerZ: .025 },
        { y: 2.23, radiusX: .17, centerX: -.015 },
        { y: 2.55, radiusX: .08, centerX: .01, centerZ: -.03 },
    ], 32), trunk);
    // Branch bases begin inside the trunk. Curved profiles taper into the leaf masses.
    mesh(structure, loftGeometry([
        { y: 1.25, radiusX: .2 }, { y: 1.55, radiusX: .21, centerX: -.17 },
        { y: 1.92, radiusX: .17, centerX: -.4, centerZ: .025 },
        { y: 2.28, radiusX: .115, centerX: -.65, centerZ: .03 },
        { y: 2.66, radiusX: .045, centerX: -.86, centerZ: .06 },
    ], 20), trunk);
    mesh(structure, loftGeometry([
        { y: 1.46, radiusX: .18, centerX: -.015 }, { y: 1.74, radiusX: .19, centerX: .17, centerZ: -.025 },
        { y: 2.05, radiusX: .15, centerX: .48, centerZ: -.03 },
        { y: 2.35, radiusX: .11, centerX: .76, centerZ: -.05 },
        { y: 2.67, radiusX: .045, centerX: .95, centerZ: -.08 },
    ], 20), trunk);
    mesh(structure, loftGeometry([
        { y: 1.8, radiusX: .14, centerX: -.04 }, { y: 2.12, radiusX: .14, centerX: -.08, centerZ: -.15 },
        { y: 2.43, radiusX: .1, centerX: -.13, centerZ: -.32 },
        { y: 2.83, radiusX: .04, centerX: -.17, centerZ: -.48 },
    ], 18), trunk);
    const clumps: { at: [number, number, number]; size: Size3; color: string }[] = [
        { at: [-.9, 2.68, .05], size: [.85, .7, .78], color: '#4e8843' },
        { at: [.88, 2.75, -.13], size: [.88, .72, .76], color: '#649c46' },
        { at: [-.3, 3.18, -.4], size: [.95, .79, .83], color: '#76a84d' },
        { at: [.4, 3.31, -.24], size: [.82, .72, .78], color: '#86b557' },
        { at: [-.65, 3.16, .4], size: [.94, .65, .78], color: '#67994a' },
        { at: [.52, 2.96, .58], size: [.87, .73, .74], color: '#77ab4d' },
    ];
    const crown = new THREE.Group(); crown.name = 'tree-canopy'; crown.position.y = 2.2;
    if (!addThemeCanopy(crown, m)) clumps.forEach(({ at, size, color }, i) => {
        const clump = mesh(crown, organicEllipsoidGeometry(size, i * .9), m.surface(color, .91), [at[0], at[1] - 2.2, at[2]]);
        clump.name = `tree-crown-${i}`;
    });
    batch(structure);
    batch(crown); group.add(crown);
    const glow = m.surface('#ffe093', .55, 0, true).clone();
    glow.userData.islandOwned = true;
    const pendants: THREE.Group[] = [], leaves: THREE.Group[] = [];
    for (const [x, y, z, size, length] of [[-.87, 2.52, .56, .2, .82], [.93, 2.35, .4, .15, .65]]) {
        const pendant = new THREE.Group(); pendant.position.set(x, y, z);
        pole(pendant, m.surface('#b49b64', .9), [0, 0, 0], [0, -length + .1, 0], .015);
        star(pendant, glow, [0, -length, 0], size);
        group.add(pendant); pendants.push(pendant);
        const leaf = new THREE.Group(); leaf.position.set(x * .68, y + .025, z - .025);
        mesh(leaf, organicEllipsoidGeometry([.24, .095, .13], x), m.surface('#7caf4b', .91), [x < 0 ? -.14 : .14, 0, 0]);
        group.add(leaf); leaves.push(leaf);
    }
    // The spiral follows the trunk's front surface; its center is the real light anchor.
    const spiral: [number, number, number][] = [];
    for (let i = 0; i <= 26; i++) {
        const a = i / 26 * Math.PI * 3.1, r = .024 + .18 * i / 26;
        const x = .025 + Math.cos(a) * r, y = 1.05 + Math.sin(a) * r;
        const z = -.025 + Math.sqrt(1 - ((x - .035) / .29) ** 2) * .282 + .012;
        spiral.push([x, y, z]);
    }
    curve(group, glow, spiral, .025);
    treeLives.set(group, { glow, pendants, leaves, crown, anchor: new THREE.Vector3(.025, 1.05, .281) });
    applyTreeLife(group, 0);
    return group;
}

function dock(m: IslandMaterials) {
    const group = new THREE.Group();
    const wood = m.surface('#b78552', .86);
    for (let i = 0; i < 7; i++) rounded(group, m.surface(i % 2 ? '#d9ab6b' : '#e7bb7c', .86),
        [-1.1, -.09 - i * .005, 3.13 + i * .19], [1.2, .13, .16], .018);
    for (const x of [-1.5, -.7]) rounded(group, wood, [x, -.2, 3.7], [.11, .14, 1.4], .016);
    for (const x of [-1.65, -.55]) for (const z of [3.2, 4.3]) {
        cylinder(group, wood, [x, -.425, z], .09, 1.25, .1);
        cylinder(group, m.surface('#ecd5a3', .86), [x, .207, z], .105, .034);
    }
    return group;
}

export function makeScenery(m: IslandMaterials) {
    const group = new THREE.Group();
    group.add(land(m, 0, 0, 4.8, 3.6));
    group.add(cottage(m), dock(m));
    bush(group, m, -3.45, -2.2, .82);
    bush(group, m, -3.58, -.88, .65);
    bush(group, m, 2.97, -2.16, .7);
    bush(group, m, 3.61, -.93, .44);
    for (const [i, [x, z, scale]] of [[-2.25, -.55, .7], [-2.16, -.03, .6], [-1.97, .45, .65], [-1.79, .94, .56], [-1.47, 1.39, .57], [-1.21, 1.9, .49], [-1.1, 2.37, .6]].entries()) {
        const biscuit = m.artDirection === 'candy';
        const stone = mesh(group, biscuit ? roundedBoxGeometry([scale * .79, .042, scale * .61], .06) : steppingStoneGeometry(scale * .45, i * 1.4),
            m.surface('#e5d3a2', .95), [x, 0, z]);
        stone.rotation.y = Math.sin(i * 1.7) * .38;
        if (biscuit) for (const dx of [-.09, .09]) for (const dz of [-.075, .075]) {
            ellipsoid(group, m.get('#b88c63'), [x + dx, .026, z + dz], [.016, .005, .016], 8);
        }
    }
    for (const [x, z, scale] of [[-3, .55, .7], [-3.7, -.1, .48], [-3.34, .12, .53], [2.59, -2.33, .34]]) {
        const flowers = makeFlowers(m, 2); flowers.position.set(x, .008, z); flowers.scale.setScalar(scale * 1.1); group.add(flowers);
    }
    for (const [x, z, size] of [[-4.3, 1.63, .34], [-4.64, .37, .42], [3.29, 2.64, .35], [2.78, 2.95, .23], [3.79, -2.05, .43], [-2.84, -3.13, .24]]) {
        mesh(group, new THREE.DodecahedronGeometry(size, 0), m.get('#b9b9a2'), [x, -.13, z], [1, .65, .8]);
    }
    for (const [x, z, size] of [[-4.6, 1.72, .57], [-4.9, 1.25, .35], [3.55, 2.92, .43], [3.93, 2.52, .56]]) {
        mesh(group, new THREE.DodecahedronGeometry(size, 0), m.get('#9ca99e'), [x, -.4, z], [1, .82, .88]);
    }
    // Sparse grass clover; the front-center is intentionally clear for the child's objects.
    for (const [x, z] of [[-.6, -2.4], [-3.5, 1.4], [3.1, 1.5], [-.5, 2.8], [1.9, 2.68], [.15, -.8]]) {
        for (let i = 0; i < 3; i++) {
            const leaf = ellipsoid(group, m.get('#76aa53'), [x + i * .075, .024, z + (i % 2) * .07], [.12, .025, .055], 8);
            leaf.rotation.y = i * 1.1;
        }
    }
    return batch(group);
}

export function makeExpansion(m: IslandMaterials) {
    const group = new THREE.Group();
    group.add(land(m, ISLAND_EAST_LAND.x, ISLAND_EAST_LAND.z, ISLAND_EAST_LAND.radiusX, ISLAND_EAST_LAND.radiusZ));
    const wood = m.surface('#d6a76e', .86);
    for (let i = 0; i < 9; i++) {
        const x = 4 + i * .18, y = .14 + Math.sin(i / 8 * Math.PI) * .15;
        rounded(group, wood, [x, y, 0], [.155, .1, .95], .016);
    }
    for (const z of [-.31, .31]) curve(group, m.surface('#a97b4b', .86),
        [[3.94, .085, z], [4.31, .18, z], [4.72, .225, z], [5.1, .17, z], [5.48, .078, z]], .045);
    for (const z of [-.49, .49]) {
        for (const x of [4.03, 4.69, 5.38]) {
            const deck = .19 + Math.sin((x - 4) / 1.44 * Math.PI) * .15;
            cylinder(group, m.surface('#a97b4b', .86), [x, (deck + .53) / 2, z], .048, deck + .53, .052);
        }
        curve(group, m.surface('#ecd2a0', .86), [[4.03, .73, z], [4.35, .69, z], [4.69, .865, z], [5.04, .69, z], [5.38, .74, z]], .03);
    }
    bush(group, m, 7, -1.32, .72);
    const flowers = makeFlowers(m); flowers.position.set(6.98, 0, .82); flowers.scale.setScalar(.7); group.add(flowers);
    return batch(group);
}

export function makeLighthouse(m: IslandMaterials) {
    const group = new THREE.Group();
    group.position.set(6.35, 0, -1.16);
    cylinder(group, m.get('#bec4ad'), [0, .08, 0], .61, .16, .56, 16);
    cylinder(group, m.get('#f6eacb'), [0, .82, 0], .35, 1.42, .26, 16);
    cylinder(group, m.get('#dc7c62'), [0, .8, 0], .318, .3, .3, 16);
    cylinder(group, m.get('#687c71'), [0, 1.56, 0], .4, .12, .4, 16);
    cylinder(group, m.get('#ffe59a', true), [0, 1.8, 0], .24, .4, .24, 12);
    for (let i = 0; i < 4; i++) {
        const angle = i * Math.PI / 2;
        pole(group, m.get('#687c71'), [Math.cos(angle) * .24, 1.57, Math.sin(angle) * .24], [Math.cos(angle) * .24, 2.02, Math.sin(angle) * .24], .025);
    }
    cylinder(group, m.get('#dc7c62'), [0, 2.09, 0], .41, .24, .035, 16);
    box(group, m.get('#ad8055'), [0, .36, .35], [.25, .46, .05]);
    return batch(group);
}

export function makeOcean(m: IslandMaterials) {
    const group = new THREE.Group();
    const geometry = new THREE.PlaneGeometry(100, 100, 64, 64);
    geometry.rotateX(-Math.PI / 2);
    const positions = geometry.attributes.position;
    const colors: number[] = [], near = new THREE.Color(m.color('#78d5d5')), deep = new THREE.Color(m.color('#43a9c5'));
    for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), z = positions.getZ(i);
        const distance = Math.sqrt((x / 5.2) ** 2 + (z / 4.1) ** 2);
        const color = near.clone().lerp(deep, Math.min(1, Math.max(0, (distance - 1) / 2.4)));
        colors.push(color.r, color.g, color.b);
    }
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    // Clear shallow water retains its blue material color; opaque land shadows stop at the shore.
    const seaMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
    seaMaterial.userData.islandOwned = true;
    const sea = mesh(group, geometry, seaMaterial, [0, -.86, 0]);
    sea.castShadow = false;
    sea.receiveShadow = false;
    for (const [x, z, width] of [[-4.8, 3.2, .55], [1.8, 4.4, .66], [-5.5, -.4, .44], [4.7, 2.8, .5], [2.6, -4.7, .59], [-2.6, 4.65, .43], [7.1, 3.2, .4], [-4.4, -3.1, .5]]) {
        curve(group, m.get('#c3eeDF'), [[x - width, -.81, z], [x, -.81, z + .09], [x + width, -.81, z]], .021);
    }
    const result = batch(group);
    result.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = false; });
    return result;
}
