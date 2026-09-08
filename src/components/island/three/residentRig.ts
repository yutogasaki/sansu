import * as THREE from 'three';
import { IslandMaterials, batch, curve, ellipsoid } from './primitives';
import { applyFabricPanel, RESIDENT_VISUAL_CANDIDATE, type FabricPanel } from './residentFabric';

export type ResidentSpecies = 'otter' | 'rabbit' | 'fox';
export const RESIDENT_SCALE = 1.22;
export const SEATED_BODY_Y = -.08;
export const FURNITURE_USE_MS = 1200;
export const RESIDENT_STRIDE = .56;
export const clampUnit = (value: number) => Math.max(0, Math.min(1, value));
export const easeResident = (value: number) => { const t = clampUnit(value); return t * t * (3 - 2 * t); };

const proportions = {
    rabbit: { bodyY: .51, bodyRadiusY: .34, footY: .105 },
    otter: { bodyY: .53, bodyRadiusY: .4, footY: .11 },
    fox: { bodyY: .51, bodyRadiusY: .37, footY: .11 },
} as const;
export const residentFootY = (species: ResidentSpecies) => proportions[species].footY;
export const residentSeatContactY = (species: ResidentSpecies) =>
    proportions[species].bodyY + SEATED_BODY_Y - proportions[species].bodyRadiusY;
export const residentSeatRootY = (species: ResidentSpecies, seatY: number) => seatY - residentSeatContactY(species) * RESIDENT_SCALE;

/** A seated animal brings its actual tail around its hip. The fox's long tail
 * hangs low beside the seat, clear of both the backboard and offered objects.
 * Zero keeps exactly the original standing silhouette. */
export function poseResidentTail(tail: THREE.Group, species: ResidentSpecies, seated: number) {
    const amount = clampUnit(seated);
    if (species === 'fox') tail.rotation.set(.5 * amount, Math.PI * .75 * amount, Math.PI / 2 * amount);
    else tail.rotation.set((species === 'rabbit' ? -Math.PI / 4 : 0) * amount, Math.PI * amount, 0);
}

/** A planted foot travels backwards by exactly the root's forward distance.
 * The return half of each stride lifts the sole, instead of sliding it forward. */
export function sampleResidentStride(distance: number, totalDistance: number) {
    const cycle = distance / RESIDENT_STRIDE;
    const blend = Math.min(1, Math.max(0, distance) / .14, Math.max(0, totalDistance - distance) / .14);
    const amplitude = RESIDENT_STRIDE / (4 * RESIDENT_SCALE);
    const feet = [0, .5].map(offset => {
        const phase = ((cycle + offset) % 1 + 1) % 1;
        const swing = phase >= .5;
        const t = swing ? (phase - .5) * 2 : phase * 2;
        return { z: .12 + blend * amplitude * (swing ? -1 + 2 * easeResident(t) : 1 - 2 * t),
            lift: swing ? Math.sin(t * Math.PI) * .09 * blend : 0,
            arm: Math.sin(phase * Math.PI * 2) * .18 * blend };
    });
    return { feet, bob: Math.sin(cycle * Math.PI * 2) ** 2 * .012 * blend };
}

export function turnResidentToward(current: number, target: number, elapsedMs: number) {
    const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
    const limit = Math.max(0, elapsedMs) * .012;
    return current + Math.max(-limit, Math.min(limit, delta));
}

function makeOtterTail(parent: THREE.Group, material: THREE.Material) {
    return ellipsoid(parent, material, [0, .245, -.28], [.105, .105, .105]);
}

/** One cloth otter lives beside the established rabbit and fox. Articulated
 * pieces and all navigation/seat/hand proportions retain their shared contract. */
export function makeResidentRig(species: ResidentSpecies, m: IslandMaterials) {
    const pose = new THREE.Group(), body = new THREE.Group(), head = new THREE.Group();
    pose.name = 'resident-pose'; body.name = 'resident-body'; head.name = 'resident-head';
    pose.add(body); body.add(head);
    const rabbit = species === 'rabbit', otter = species === 'otter', fox = species === 'fox';
    const cloth = (object: THREE.Mesh, panel: FabricPanel) => {
        if (!otter) return object;
        if (object.geometry instanceof THREE.SphereGeometry) {
            object.geometry.dispose(); object.geometry = new THREE.SphereGeometry(1, 32, 24);
        }
        return applyFabricPanel(object, panel, m.residentFabric());
    };
    if (otter) pose.userData.visualCandidate = RESIDENT_VISUAL_CANDIDATE;
    const fur = m.get(rabbit ? '#f3ead4' : fox ? '#d99753' : '#b38154');
    const cream = m.get('#fff0d4'), dark = m.get('#493e32');
    cloth(ellipsoid(body, fur, [0, proportions[species].bodyY, 0], rabbit ? [.245, .34, .22] : otter ? [.305, .4, .255] : [.33, .37, .265]), 'body');
    if (!otter) ellipsoid(body, cream, [0, .47, .21], rabbit ? [.16, .22, .055] : [.23, .25, .067]);
    batch(body);
    // Keep the existing shape/material at its exact standing transform, but
    // retain one joint instead of baking the tail into the torso material batch.
    const tail = new THREE.Group(); tail.name = 'resident-tail'; tail.userData.visualCandidate = fox ? 'island-tail-seat-joint-v2' : 'island-tail-seat-joint-v1';
    tail.position.set(fox ? -.18 : 0, otter ? .245 : rabbit ? .29 : .19, fox ? .1 : -.1);
    const tailShape = otter ? cloth(makeOtterTail(tail, fur), 'cream')
        : ellipsoid(tail, fur, [0, .19, -.31], rabbit ? [.12, .12, .12] : [.2, .105, .6]);
    if (!otter) tailShape.rotation.x = -.2;
    tailShape.position.sub(tail.position); body.add(tail);
    const shoulders = [-1, 1].map(side => {
        const shoulder = new THREE.Group();
        shoulder.name = side < 0 ? 'shoulder-left' : 'shoulder-right';
        shoulder.position.set(side * (rabbit ? .21 : .27), otter ? .67 : .64, .08);
        shoulder.rotation.z = side * .2;
        body.add(shoulder);
        const paw = cloth(ellipsoid(shoulder, fur, [0, -.15, 0], [.095, .19, .105]), side < 0 ? 'tealDots' : 'roseDots');
        const hand = new THREE.Object3D();
        hand.name = side < 0 ? 'hand-contact-left' : 'hand-contact-right';
        // A point on the actual ellipsoid's forward-facing fingertip surface.
        // It inherits the paw scale and shoulder pose rather than guessing a
        // world-space holding position independently from the visible body.
        hand.position.set(0, -Math.sqrt(1 - .25 ** 2), .25);
        paw.add(hand);
        return shoulder;
    });
    head.position.y = rabbit ? .93 : otter ? 1.01 : .99;
    cloth(ellipsoid(head, fur, [0, 0, 0], rabbit ? [.29, .27, .255] : otter ? [.365, .295, .30] : [.37, .31, .295]), 'head');
    for (const side of [-1, 1]) {
        const earX = rabbit ? .135 : otter ? .285 : .275;
        const earY = rabbit ? .4 : otter ? .20 : .235;
        const ear = cloth(ellipsoid(head, fur, [side * earX, earY, -.02],
            rabbit ? [.079, .34, .079] : otter ? [.105, .105, .072] : [.12, .13, .077]), side < 0 ? 'navyDots' : 'roseDots');
        ear.rotation.z = -side * (rabbit ? .14 : .2);
        const inner = cloth(ellipsoid(head, m.get(rabbit ? '#dba596' : '#d6a679'),
            [side * earX, earY + (rabbit ? .02 : .015), rabbit ? .052 : .048],
            rabbit ? [.038, .245, .028] : otter ? [.058, .057, .023] : [.068, .074, .025]), side < 0 ? 'cream' : 'sole');
        inner.rotation.z = ear.rotation.z;
        cloth(ellipsoid(head, cream, [side * .085, -.085, rabbit ? .221 : otter ? .277 : .263],
            rabbit ? [.106, .074, .047] : otter ? [.15, .082, .067] : [.145, .104, .065]), 'cream');
        ellipsoid(head, otter ? m.surface('#272433', .25) : dark, [side * (rabbit ? .108 : .15), .047, rabbit ? .241 : .27], [.028, .043, .024], 10);
        ellipsoid(head, cream, [side * (rabbit ? .105 : .147), .059, rabbit ? .263 : .292], [.009, .012, .006], 8);
    }
    ellipsoid(head, otter ? m.surface('#302731', .36) : m.get(rabbit ? '#ba836d' : '#51453b'), [0, -.052, rabbit ? .283 : otter ? .354 : .341],
        rabbit ? [.042, .031, .022] : [.058, .043, .03]);
    if (otter) {
        curve(head, dark, [[0, -.085, .360], [0, -.108, .351], [0, -.13, .337]], .006);
        for (const side of [-1, 1]) curve(head, dark, [[0, -.13, .337], [side * .04, -.147, .332], [side * .075, -.126, .342]], .007);
    } else curve(head, dark, [[-.063, -.122, rabbit ? .264 : .317], [0, -.14, rabbit ? .28 : .332], [.062, -.12, rabbit ? .264 : .317]], .01);
    batch(head);
    const feet = [-1, 1].map(side => cloth(ellipsoid(pose, fur, [side * .16, residentFootY(species), .12],
        rabbit ? [.125, .105, .205] : [.15, .11, .195]), side < 0 ? 'tealDots' : 'sole'));
    if (!otter) {
        const scarf = new THREE.Group(), scarfMaterial = m.get(rabbit ? '#9faebf' : '#6baba0');
        ellipsoid(scarf, scarfMaterial, [0, rabbit ? .725 : .735, .04], [.24, .055, .22]);
        ellipsoid(scarf, scarfMaterial, [.09, .635, .252], [.07, .13, .027]);
        body.add(batch(scarf));
    }
    const seatContact = new THREE.Object3D();
    seatContact.name = 'resident-seat-contact';
    seatContact.position.y = residentSeatContactY(species);
    pose.add(seatContact);
    pose.traverse(object => { if (object instanceof THREE.Mesh) object.castShadow = false; });
    const handContacts = shoulders.map(shoulder => shoulder.getObjectByName(shoulder.name === 'shoulder-left' ? 'hand-contact-left' : 'hand-contact-right')!);
    return { pose, body, head, tail, feet, shoulders, handContacts, seatContact };
}
