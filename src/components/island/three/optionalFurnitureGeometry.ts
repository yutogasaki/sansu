import * as THREE from 'three';
import type { IslandOptionalFurnitureKind } from '../../../domain/island/types';
import { IslandMaterials, batch, cylinder as makeCylinder, curve, ellipsoid, mesh, pole } from './primitives';

export const OPTIONAL_FURNITURE_CANDIDATE = 'island-life-tools-v2';
export const isOptionalFurniture = (kind: string): kind is IslandOptionalFurnitureKind =>
    kind === 'telescope' || kind === 'hammock' || kind === 'tea-table';
export const HAMMOCK_PIVOT_Y = 1.02;
export const HAMMOCK_SEAT = new THREE.Vector3(0, .44, .12);
export const TEA_SOURCE = new THREE.Vector3(-.20, .745, .62);
export const TEA_TRANSFER = new THREE.Vector3(0, .86, .62);
export const TEA_DESTINATION = new THREE.Vector3(.20, .745, .62);
export const CUP_GRIPS = [new THREE.Vector3(-.12, .012, 0), new THREE.Vector3(.12, .012, 0)] as const;

/** Ground obstacles are the actual legs/posts; the reserved use envelope is
 * removed only for this furniture's own invited users. */
export function optionalFurnitureGroundSupports(kind: IslandOptionalFurnitureKind) {
    return kind === 'telescope' ? [{ x: .42, z: .68, radius: .07 }, { x: .73, z: .36, radius: .07 }, { x: .64, z: -.08, radius: .07 }]
        : kind === 'hammock' ? [{ x: -.82, z: -.08, radius: .065 }, { x: .82, z: -.08, radius: .065 }]
            : [{ x: 0, z: .59, radius: .16 }];
}
export function optionalFurnitureApproach(kind: IslandOptionalFurnitureKind) {
    return kind === 'telescope' ? [{ x: 0, z: .28 }] : kind === 'hammock' ? [{ x: 0, z: .90 }]
        : [{ x: -.52, z: .18 }, { x: .52, z: .18 }];
}
const cylinder = (parent: THREE.Object3D, material: THREE.Material, position: [number, number, number], bottom: number, top: number, height: number) =>
    makeCylinder(parent, material, position, bottom, height, top);
const named = (parent: THREE.Object3D, name: string, position = new THREE.Vector3()) => {
    const group = new THREE.Group(); group.name = name; group.position.copy(position); parent.add(group); return group;
};
function marker(parent: THREE.Object3D, name: string, point: THREE.Vector3) {
    const anchor = new THREE.Object3D(); anchor.name = name; anchor.position.copy(point); parent.add(anchor); return anchor;
}
function adjustablePole(parent: THREE.Group, name: string, material: THREE.Material, radius: number) {
    const object = mesh(parent, new THREE.CylinderGeometry(radius, radius, 1, 12), material);
    object.name = name; return object;
}
function span(object: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3) {
    const direction = to.clone().sub(from); object.position.copy(from).add(to).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize()); object.scale.y = direction.length();
}

/** The suspended cloth dips under the long tail, while the central seat supports
 * the torso. Its actual mesh and the resident use the same pivot transform. */
export function hammockSurface(x: number, z: number) {
    const rear = THREE.MathUtils.clamp((.02 - z) / .86, 0, 1);
    return HAMMOCK_SEAT.y + .22 * (x / .55) ** 2 - .30 * rear ** 1.3;
}
function makeHammockCloth() {
    const points: number[] = [], indices: number[] = [], nx = 16, nz = 28;
    for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
        const z = -.85 + iz / nz * 1.60, width = .55 * (.87 + .13 * Math.sin(iz / nz * Math.PI)), x = (ix / nx * 2 - 1) * width;
        points.push(x, hammockSurface(x, z), z);
        if (ix < nx && iz < nz) {
            const a = iz * (nx + 1) + ix, b = a + nx + 1;
            indices.push(a, b, a + 1, a + 1, b, b + 1);
        }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function makeOptionalFurniture(kind: IslandOptionalFurnitureKind, m: IslandMaterials) {
    const group = new THREE.Group(); group.name = `optional-${kind}`; group.userData.optionalFurnitureKind = kind;
    group.userData.visualCandidate = OPTIONAL_FURNITURE_CANDIDATE;
    const fixed = named(group, 'furniture-static'), wood = m.get('#96663e'), pale = m.get('#e2c18c'), dark = m.get('#5d554b');
    if (kind === 'telescope') {
        const junction = new THREE.Vector3(.53, 1.03, .40);
        for (const [x, z] of [[.42, .68], [.73, .36], [.64, -.08]]) {
            pole(fixed, wood, [x, .05, z], junction.toArray() as [number, number, number], .042);
            ellipsoid(fixed, dark, [x, .035, z], [.068, .035, .065]);
        }
        cylinder(fixed, m.get('#bc9762'), [.53, .72, .40], .075, .075, .15);
        const tube = named(group, 'telescope-tube');
        cylinder(tube, m.get('#397f84'), [0, .30, 0], .115, .092, .60);
        cylinder(tube, pale, [0, .53, 0], .128, .128, .058);
        cylinder(tube, pale, [0, .12, 0], .108, .108, .042);
        cylinder(tube, dark, [0, -.035, 0], .053, .057, .085);
        cylinder(tube, m.get('#233c59'), [0, .603, 0], .103, .103, .008);
        marker(tube, 'optional-eyepiece', new THREE.Vector3(0, -.078, 0));
        marker(tube, 'optional-sky-target', new THREE.Vector3(0, 1.50, 0));
        adjustablePole(group, 'telescope-neck', wood, .033);
        adjustablePole(group, 'telescope-neck-yoke', wood, .033);
        adjustablePole(group, 'telescope-handle-stem', wood, .025);
        for (const side of ['left', 'right']) {
            adjustablePole(group, `telescope-support-${side}`, pale, .018);
            const grip = ellipsoid(group, dark, [0, 0, 0], [.054, .036, .042]); grip.name = `optional-grip-${side}`;
        }
        configureTelescope(group, new THREE.Vector3(-.183, 1.54, .46), new THREE.Vector3(0, .90, .435),
            [new THREE.Vector3(-.34, 1.10, .51), new THREE.Vector3(.34, 1.10, .51)]);
        batch(tube, m.painted);
    } else if (kind === 'hammock') {
        for (const side of [-1, 1]) {
            pole(fixed, wood, [side * .82, .04, -.08], [side * .82, 1.05, -.08], .055);
            for (const z of [-.25, .25]) pole(fixed, wood, [side * .94, .04, z], [side * .82, .37, -.08], .042);
            ellipsoid(fixed, pale, [side * .82, 1.06, -.08], [.071, .045, .07]);
        }
        const moving = named(group, 'optional-hammock-moving', new THREE.Vector3(0, HAMMOCK_PIVOT_Y, 0));
        const cloth = named(moving, 'optional-hammock-cloth', new THREE.Vector3(0, -HAMMOCK_PIVOT_Y, 0));
        const fabric = new THREE.MeshStandardMaterial({ color: '#77aab0', roughness: 1, side: THREE.DoubleSide }); fabric.userData.islandOwned = true;
        const surface = mesh(cloth, makeHammockCloth(), fabric); surface.name = 'optional-support-surface';
        for (const side of [-1, 1]) for (const z of [-.72, .64]) {
            const edgeX = side * .49;
            pole(cloth, pale, [side * .82, 1.01, -.08], [edgeX, hammockSurface(edgeX, z), z], .016);
        }
        for (const x of [-.38, .38]) {
            const points = Array.from({ length: 17 }, (_, i) => { const z = -.79 + i / 16 * 1.50; return [x, hammockSurface(x, z) + .006, z] as [number, number, number]; });
            curve(cloth, m.get('#fff0c9'), points, .012);
        }
        marker(cloth, 'optional-seat', HAMMOCK_SEAT);
    } else {
        cylinder(fixed, wood, [0, .31, .59], .075, .11, .58);
        cylinder(fixed, wood, [0, .045, .59], .15, .16, .07);
        const top = cylinder(fixed, pale, [0, .655, .59], .40, .40, .07); top.scale.z = .76;
        const runner = ellipsoid(fixed, m.get('#a6b9ad'), [0, .695, .59], [.30, .006, .15]); runner.name = 'tea-cloth';
        for (const x of [-.20, .20]) {
            const saucer = cylinder(fixed, m.get('#fff0cf'), [x, .701, .62], .103, .11, .015); saucer.name = x < 0 ? 'tea-source-saucer' : 'tea-destination-saucer';
        }
        ellipsoid(fixed, m.get('#d7a860'), [0, .727, .45], [.06, .021, .05]);
        const cup = named(group, 'optional-tea-cup', TEA_SOURCE);
        cylinder(cup, m.get('#eee3c5'), [0, 0, 0], .067, .055, .077);
        cylinder(cup, m.get('#98693e'), [0, .038, 0], .057, .057, .003);
        for (const side of [-1, 1]) {
            const handle = mesh(cup, new THREE.TorusGeometry(.035, .010, 8, 16), m.get('#eee3c5'), [side * .090, .011, 0]);
            handle.name = side < 0 ? 'cup-handle-left' : 'cup-handle-right';
        }
        CUP_GRIPS.forEach((point, i) => marker(cup, `optional-cup-grip-${i}`, point));
        marker(group, 'optional-tea-transfer', TEA_TRANSFER);
    }
    batch(fixed, m.painted); return group;
}

/** Focus and hand rests are adjustable parts of this actual instrument. */
export function configureTelescope(group: THREE.Group, eye: THREE.Vector3, direction: THREE.Vector3, hands: readonly THREE.Vector3[]) {
    const tube = group.getObjectByName('telescope-tube')!;
    tube.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    tube.position.copy(eye).addScaledVector(direction, .078);
    // The side-mounted fork rises beside the face and meets the upper barrel.
    // A low hand rail joins both real grips; no long rods run from paws through
    // the face to the eyepiece.
    const junction = new THREE.Vector3(.53, 1.03, .4), socket = tube.position.clone().addScaledVector(direction, .25);
    const elbow = new THREE.Vector3(.53, socket.y, socket.z);
    span(group.getObjectByName('telescope-neck')!, junction, elbow);
    span(group.getObjectByName('telescope-neck-yoke')!, elbow, socket);
    span(group.getObjectByName('telescope-handle-stem')!, hands[1], junction);
    const middle = hands[0].clone().add(hands[1]).multiplyScalar(.5);
    hands.forEach((point, i) => {
        const side = i === 0 ? 'left' : 'right'; group.getObjectByName(`optional-grip-${side}`)!.position.copy(point);
        span(group.getObjectByName(`telescope-support-${side}`)!, point, middle);
    });
    group.updateWorldMatrix(true, true);
}
export function hammockAngle(phase: number, reduced = false) {
    const t = THREE.MathUtils.clamp(phase, 0, 1); return reduced ? 0 : .045 * Math.sin(t * Math.PI * 4) * Math.sin(t * Math.PI);
}
export function setHammockAngle(group: THREE.Group, angle: number) { group.getObjectByName('optional-hammock-moving')!.rotation.z = angle; }
export function optionalFurnitureAnchors(group: THREE.Group) {
    group.updateWorldMatrix(true, true);
    const at = (name: string) => group.getObjectByName(name)?.getWorldPosition(new THREE.Vector3());
    return { eye: at('optional-eyepiece'), sky: at('optional-sky-target'), grips: [at('optional-grip-left'), at('optional-grip-right')],
        seat: at('optional-seat'), cup: at('optional-tea-cup'), cupGrips: [at('optional-cup-grip-0'), at('optional-cup-grip-1')], transfer: at('optional-tea-transfer') };
}
