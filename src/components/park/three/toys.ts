import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TOY, slideHeight } from './choreography';
import { ToyPrimitives, type ToyMaterials } from './materials';

export function roundedBox(p: ToyPrimitives, parent: THREE.Object3D, m: THREE.Material, dimensions: number[], position: number[], radius = .07) {
    return p.mesh(parent, p.keep(new RoundedBoxGeometry(dimensions[0], dimensions[1], dimensions[2], 3, radius)), m, position);
}
export function createSlide(p: ToyPrimitives, m: ToyMaterials) {
    const group = new THREE.Group(); group.name = 'coral-slide';
    // Extruded closed side profile: genuinely thick curved resin, not a sheet.
    const shape = new THREE.Shape();
    shape.moveTo(TOY.slideEntry, TOY.slideTop);
    for (let i = 1; i <= 32; i++) shape.lineTo(TOY.slideEntry + (TOY.slideExit - TOY.slideEntry) * i / 32, slideHeight(i / 32));
    for (let i = 32; i >= 0; i--) shape.lineTo(TOY.slideEntry + (TOY.slideExit - TOY.slideEntry) * i / 32, slideHeight(i / 32) - .07);
    shape.closePath();
    const geo = p.keep(new THREE.ExtrudeGeometry(shape, { depth: .6, bevelEnabled: true, bevelSize: .025, bevelThickness: .025, bevelSegments: 3, steps: 1, curveSegments: 32 }));
    p.mesh(group, geo, m.coral, [0, 0, -.3]);
    roundedBox(p, group, m.coral, [.25, .07, .6], [-.64, .842, 0], .025);
    for (const z of [-.32, .32]) {
        p.tube(group, m.coralEdge, Array.from({ length: 25 }, (_, i) => new THREE.Vector3(TOY.slideEntry + (TOY.slideExit - TOY.slideEntry) * i / 24, slideHeight(i / 24) + .082, z)), .064);
        roundedBox(p, group, m.wood, [.13, .83, .13], [-.53, .415, z]);
        roundedBox(p, group, m.wood, [.12, .34, .12], [.12, .17, z]);
        p.tube(group, m.coralEdge, [new THREE.Vector3(-.81, .3, z), new THREE.Vector3(-.69, .79, z), new THREE.Vector3(-.55, 1.04, z), new THREE.Vector3(-.34, .97, z)], .054);
    }
    for (let i = 0; i < 4; i++) roundedBox(p, group, m.wood, [.2, .065, .57], [-.84 + i * .085, .12 + i * .212, 0], .026);
    return group;
}
export function createTrampoline(p: ToyPrimitives, m: ToyMaterials) {
    const group = new THREE.Group(); group.name = 'teal-trampoline';
    const ring = p.mesh(group, p.keep(new THREE.TorusGeometry(.48, .105, 14, 48)), m.teal, [0, .235, 0]); ring.rotation.x = Math.PI / 2;
    for (const x of [-.32, .32]) for (const z of [-.32, .32]) p.mesh(group, p.cylinder, m.wood, [x, .087, z], [.07, .174, .07]);
    const membrane = p.keep(new THREE.RingGeometry(0, .465, 48, 8)); membrane.rotateX(-Math.PI / 2);
    const cloth = p.mesh(group, membrane, m.membrane, [0, TOY.trampoline, 0]); cloth.castShadow = false;
    // Fine radial stitched edge, safely away from the feet.
    for (let i = 0; i < 20; i++) {
        const a = i / 20 * Math.PI * 2;
        p.ellipsoid(group, m.seam, [Math.cos(a) * .425, .238, Math.sin(a) * .425], [.018, .008, .018]);
    }
    const positions = membrane.getAttribute('position');
    return { group, compress(amount: number) {
        for (let i = 0; i < positions.count; i++) {
            const radius = Math.hypot(positions.getX(i), positions.getZ(i));
            positions.setY(i, -amount * (1 - Math.min(1, radius / .465) ** 2));
        }
        positions.needsUpdate = true; membrane.computeVertexNormals();
    } };
}
export function createGate(p: ToyPrimitives, m: ToyMaterials) {
    const group = new THREE.Group(); group.name = 'butter-yellow-open-gate';
    // Arch lies in local XY; yaw 50° opens its hole to the fixed camera and +X path.
    group.rotation.y = 50 * Math.PI / 180;
    const points = [new THREE.Vector3(-.54, .1, 0), new THREE.Vector3(-.54, .65, 0)];
    for (let i = 0; i <= 24; i++) {
        const a = Math.PI - i / 24 * Math.PI;
        points.push(new THREE.Vector3(Math.cos(a) * .54, 1.04 + Math.sin(a) * .54, 0));
    }
    points.push(new THREE.Vector3(.54, .65, 0), new THREE.Vector3(.54, .1, 0));
    const arch = p.tube(group, m.yellow, points, .11); arch.scale.z = 1.35;
    for (const x of [-.54, .54]) roundedBox(p, group, m.wood, [.32, .13, .43], [x, .065, 0], .06);
    return group;
}
export function createBase(p: ToyPrimitives, m: ToyMaterials) {
    const group = new THREE.Group(); group.name = 'maple-plinth';
    roundedBox(p, group, m.wood, [6.85, .25, 1.72], [1.68, -.16, 0], .16);
    roundedBox(p, group, m.top, [6.8, .045, 1.68], [1.68, -.021, 0], .15);
    // A small upholstered finish, below the foot plane; no extra gameplay part.
    roundedBox(p, group, m.cream, [.73, .08, 1.0], [TOY.finish, -.028, 0], .16);
    for (let i = 0; i < 3; i++) {
        const ring = p.mesh(group, p.keep(new THREE.TorusGeometry(.46, .009, 6, 48)), m.seam, [i * TOY.spacing, .006, 0]);
        ring.rotation.x = Math.PI / 2;
    }
    return group;
}
