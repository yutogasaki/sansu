import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IslandResident } from './animals';
import { applyFurnitureUse, getFurnitureAnchors, makeFurniture } from './furniture';
import { sampleFurnitureSwing } from './furnitureVisuals';
import { disposeGeometry, IslandMaterials } from './primitives';
import { planResidentPointRoute, residentGroundHeight, residentGroundIsSafe } from './navigation';
import { chooseReachableResident } from './residentInteraction';
import { FURNITURE_USE_MS, RESIDENT_SCALE, residentFootY, sampleResidentStride, turnResidentToward, type ResidentSpecies } from './residentRig';
import { sampleLearningReaction } from './learningReaction';
import { sampleResidentInterest } from './residentInterest';
import { IslandScene } from './runtime';
import type { IslandStageItem } from './types';

const materials: IslandMaterials[] = [], models: THREE.Object3D[] = [];
const up = new THREE.Vector3(0, 1, 0);
function resident(species: ResidentSpecies = 'otter') {
    const material = new IslandMaterials(); materials.push(material);
    const actor = new IslandResident(species, material, [0, 0, 1.6], () => undefined);
    models.push(actor.group);
    return { actor, material };
}
const target = (kind: IslandStageItem['kind'], rotation = 0): IslandStageItem => ({ id: 'placed', kind, position: { x: 0, z: 1 }, rotation });
const worldAnchor = (item: IslandStageItem, point: { x: number; y: number; z: number }) =>
    new THREE.Vector3(point.x, point.y, point.z).applyAxisAngle(up, item.rotation).add(new THREE.Vector3(item.position!.x, 0, item.position!.z));
afterEach(() => { models.splice(0).forEach(disposeGeometry); materials.splice(0).forEach(material => material.dispose()); });

describe('resident local rig and furniture contact', () => {
    it.each(['flower', 'fountain'] as const)('blends the %s lean out before carrying and restores it without accumulation', kind => {
        const { actor } = resident('otter'), source = target(kind);
        expect(actor.visit(source, 0, true, [source], 0)).toBe(true);
        expect(actor.body.rotation.x).toBeCloseTo(.07);
        const body = actor.body.quaternion.clone(), root = actor.group.position.clone(), bodyPosition = actor.body.position.clone();
        const contact = actor.seatContact.getWorldPosition(new THREE.Vector3());
        const feet = actor.feet.map(foot => foot.getWorldPosition(new THREE.Vector3()));
        const look = actor.group.localToWorld(new THREE.Vector3(0, .75, .45));
        for (const mode of ['carry', 'offer'] as const) {
            for (const amount of [0, .25, .5, .75, 1]) {
                actor.setSharedPose(mode, amount, look);
                expect(actor.body.rotation.x).toBeCloseTo(.07 * (1 - amount));
                const firstBody = actor.body.quaternion.clone(), firstHand = actor.handAnchor();
                actor.setSharedPose(mode, amount, look);
                expect(actor.body.quaternion.angleTo(firstBody)).toBeLessThan(1e-7);
                expect(actor.handAnchor().distanceTo(firstHand)).toBeLessThan(1e-8);
                expect(actor.group.position.equals(root)).toBe(true); expect(actor.body.position.equals(bodyPosition)).toBe(true);
                expect(actor.seatContact.getWorldPosition(new THREE.Vector3()).distanceTo(contact)).toBeLessThan(1e-8);
                actor.feet.forEach((foot, i) => expect(foot.getWorldPosition(new THREE.Vector3()).distanceTo(feet[i])).toBeLessThan(1e-8));
            }
            actor.clearSharedPose(); expect(actor.body.quaternion.angleTo(body)).toBeLessThan(1e-7);
        }
        actor.setSharedPose('receive', 1, look); expect(actor.body.quaternion.angleTo(body)).toBeLessThan(1e-7);
        actor.clearSharedPose(); actor.setSharedPose('carry', 1, look);
        const lifted = actor.handAnchor();
        const route = planResidentPointRoute(root, { x: 1.5, z: 2 }, [source], 0, { departingId: source.id, yaw: actor.group.rotation.y })!;
        expect(route).toBeDefined(); expect(actor.walkToPoint(route, 100, false, 0)).toBe(true);
        actor.setSharedPose('carry', 1, look);
        expect(actor.handAnchor().distanceTo(lifted)).toBeLessThan(1e-8);
        actor.clearSharedPose(); expect(actor.body.rotation.x).toBeCloseTo(0);
    });

    it('walks a safe point route across the bridge, arrives idle, and never acquires furniture ownership', () => {
        const { actor } = resident('rabbit');
        const route = planResidentPointRoute(actor.group.position, { x: 6.25, z: 1 }, [], 2, { yaw: -.4 })!;
        expect(actor.walkToPoint(route, 0, false, 2)).toBe(true);
        expect(actor.itemId).toBe(''); expect(actor.action).toBe('walk');
        let crossing = 0;
        for (let now = 20; now <= 8000; now += 20) {
            actor.update(now);
            expect(residentGroundIsSafe(actor.group.position, true)).toBe(true);
            if (actor.group.position.x > 4.4 && actor.group.position.x < 5.15) {
                crossing++; expect(actor.group.position.y).toBeCloseTo(residentGroundHeight(actor.group.position, true));
            }
        }
        expect(crossing).toBeGreaterThan(0); expect(actor.action).toBe('idle'); expect(actor.usePhase).toBe(1);
        expect(actor.group.position.toArray()).toEqual([6.25, 0, 1]); expect(actor.group.rotation.y).toBeCloseTo(-.4);
        expect(actor.itemId).toBe(''); expect(actor.update(20000)).toBe(false);
    });

    it('stops a live walk at the visible position and settles feet without restarting the path', () => {
        const { actor } = resident();
        const route = planResidentPointRoute(actor.group.position, { x: 6.25, z: 1 }, [], 2)!;
        actor.walkToPoint(route, 0, false, 2); actor.update(2300);
        const point = actor.group.position.clone();
        actor.setSharedPose('carry', 1, actor.group.position.clone().add(new THREE.Vector3(0, .8, .3)));
        actor.stopWalking(2300);
        expect(actor.group.position.equals(point)).toBe(true); expect(actor.action).toBe('idle'); expect(actor.itemId).toBe('');
        actor.update(10000);
        expect(actor.group.position.x).toBe(point.x); expect(actor.group.position.z).toBe(point.z);
        expect(actor.group.position.y).toBeCloseTo(residentGroundHeight(point, true));
        for (const foot of actor.feet) expect(new THREE.Box3().setFromObject(foot).min.y).toBeCloseTo(actor.group.position.y, 6);
        const seat = target('bench'); actor.visit(seat, 10000, true, [seat], 2);
        actor.stopWalking(10001); expect(actor.action).toBe('sit'); expect(actor.itemId).toBe(seat.id);
    });

    it('settles reduced point walks immediately but rejects malformed routes', () => {
        const { actor } = resident();
        const route = planResidentPointRoute(actor.group.position, { x: 1, z: 2 }, [], 0)!;
        expect(actor.walkToPoint(route, 0, true, 0)).toBe(true);
        expect(actor.group.position.toArray()).toEqual([1, 0, 2]); expect(actor.action).toBe('idle');
        const point = actor.group.position.clone();
        expect(actor.walkToPoint({ points: [], yaw: 0 }, 100, false, 0)).toBe(false);
        expect(actor.walkToPoint({ points: [point, { x: NaN, z: 0 }], yaw: 0 }, 100, false, 0)).toBe(false);
        expect(actor.group.position.equals(point)).toBe(true);
    });

    it('can leave a cancelled seat approach without claiming its seat or changing the stopped position', () => {
        const { actor } = resident();
        const seat = { ...target('bench'), id: 'seat', position: { x: 2, z: 1.5 } };
        const flower = { ...target('flower'), id: 'flower', position: { x: -1, z: 1.5 } };
        const items = [seat, flower];
        expect(actor.visit(seat, 0, false, items, 0)).toBe(true);
        actor.update(1150);
        const point = actor.group.position.clone();
        expect(actor.action).toBe('walk'); expect(point.distanceTo(new THREE.Vector3(2, 0, 1.5))).toBeLessThan(1.07);
        actor.stopWalking(1150);
        expect(actor.group.position.equals(point)).toBe(true);
        expect(actor.itemId).toBe(''); expect(actor.action).toBe('idle'); expect(actor.departingId).toBe(seat.id);
        actor.update(1500); actor.respondToLearning('correct', 1, 1, new THREE.Vector3(0, 1, 0));
        expect(actor.group.position.x).toBe(point.x); expect(actor.group.position.z).toBe(point.z);
        expect(actor.group.position.y).toBe(0); expect(actor.departingId).toBe(seat.id); expect(actor.itemId).toBe('');
        const candidates = () => [{ position: actor.group.position, visible: true, itemId: actor.itemId, departingId: actor.departingId }];
        expect(chooseReachableResident(candidates(), seat, items, 0)?.replay).toBe(false);
        const choice = chooseReachableResident(candidates(), flower, items, 0)!;
        expect(choice).toBeDefined(); expect(choice.replay).toBe(false);
        expect(choice.route.points[0]).toMatchObject({ x: point.x, z: point.z });
        expect(actor.visit(flower, 1500, false, items, 0, choice.route)).toBe(true);
        expect(actor.departingId).toBeUndefined(); expect(actor.itemId).toBe(flower.id);
        expect(actor.group.position.x).toBe(point.x); expect(actor.group.position.z).toBe(point.z);
        actor.stopWalking(1500); expect(actor.departingId).toBe(seat.id); expect(actor.itemId).toBe('');
        expect(actor.visit(flower, 1600, false, items, 0)).toBe(true);
        actor.update(6000);
        expect(actor.action).toBe('sniff'); expect(actor.departingId).toBeUndefined(); expect(actor.itemId).toBe(flower.id);
        actor.release(6000); expect(actor.departingId).not.toBe(seat.id);
    });

    it('retains a true seat departure through an immediately stopped point walk and clears it after escape', () => {
        const { actor } = resident();
        const seat = { ...target('bench'), id: 'seat' };
        expect(actor.visit(seat, 0, true, [seat], 0)).toBe(true);
        const route = planResidentPointRoute(actor.group.position, { x: 2, z: 1.5 }, [seat], 0, { departingId: actor.itemId })!;
        expect(actor.walkToPoint(route, 100, false, 0)).toBe(true);
        const start = actor.group.position.clone();
        expect(actor.departingId).toBeUndefined(); expect(actor.itemId).toBe('');
        actor.stopWalking(100);
        expect(actor.group.position.equals(start)).toBe(true); expect(actor.departingId).toBe(seat.id);
        expect(actor.walkToPoint(route, 200, false, 0)).toBe(true);
        actor.update(1100); expect(actor.action).toBe('walk'); actor.stopWalking(1100);
        expect(actor.action).toBe('idle'); expect(actor.itemId).toBe(''); expect(actor.departingId).toBeUndefined();
        actor.release(1200); expect(actor.departingId).toBeUndefined();
    });

    it('does not retain a target that the interrupted walk has not yet reached', () => {
        const { actor } = resident();
        const seat = { ...target('bench'), position: { x: 2, z: 1.5 } };
        expect(actor.visit(seat, 0, false, [seat], 0)).toBe(true);
        actor.update(100); actor.stopWalking(100);
        expect(actor.departingId).toBeUndefined(); expect(actor.itemId).toBe('');
    });

    it.each(['otter', 'rabbit', 'fox'] as const)('%s shared poses use real paw contacts and do not change soles or seat contact', species => {
        const { actor } = resident(species), item = target('swing', Math.PI / 2);
        actor.visit(item, 0, false, [item], 0); actor.update(1400);
        const root = actor.group.position.clone(), seat = actor.seatContact.getWorldPosition(new THREE.Vector3());
        const feet = actor.feet.map(foot => foot.getWorldPosition(new THREE.Vector3()));
        const baseHead = actor.head.quaternion.clone();
        const shoulders = ['shoulder-left', 'shoulder-right'].map(name => actor.body.getObjectByName(name)!);
        const hands = ['hand-contact-left', 'hand-contact-right'].map(name => actor.body.getObjectByName(name)!);
        const baseArms = shoulders.map(shoulder => shoulder.quaternion.clone());
        const look = actor.body.localToWorld(new THREE.Vector3(0, .78, .55));
        for (const mode of ['carry', 'offer', 'receive', 'enjoy'] as const) {
            actor.setSharedPose(mode, 1, look);
            const firstHead = actor.head.quaternion.clone(), firstArms = shoulders.map(shoulder => shoulder.quaternion.clone());
            const out = new THREE.Vector3(); expect(actor.handAnchor(out)).toBe(out);
            const midpoint = hands[0].getWorldPosition(new THREE.Vector3()).add(hands[1].getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
            expect(out.distanceTo(midpoint)).toBeLessThan(1e-8);
            for (let index = 0; index < hands.length; index++) {
                const hand = hands[index], joint = shoulders[index].getWorldPosition(new THREE.Vector3());
                expect(hand.parent).toBeInstanceOf(THREE.Mesh);
                expect(hand.position.length()).toBeCloseTo(1, 8);
                const direction = hand.getWorldPosition(new THREE.Vector3()).sub(joint).normalize();
                expect(direction.dot(look.clone().sub(joint).normalize())).toBeGreaterThan(.97);
            }
            const gaze = actor.head.getWorldDirection(new THREE.Vector3());
            expect(gaze.dot(look.clone().sub(actor.head.getWorldPosition(new THREE.Vector3())).normalize())).toBeGreaterThan(.97);
            actor.setSharedPose(mode, 1, look);
            expect(actor.head.quaternion.angleTo(firstHead)).toBeLessThan(1e-7);
            shoulders.forEach((shoulder, i) => expect(shoulder.quaternion.angleTo(firstArms[i])).toBeLessThan(1e-7));
            expect(actor.group.position.equals(root)).toBe(true);
            expect(actor.seatContact.getWorldPosition(new THREE.Vector3()).distanceTo(seat)).toBeLessThan(1e-8);
            actor.feet.forEach((foot, i) => expect(foot.getWorldPosition(new THREE.Vector3()).distanceTo(feet[i])).toBeLessThan(1e-8));
            actor.clearSharedPose(); expect(actor.head.quaternion.angleTo(baseHead)).toBeLessThan(1e-7);
            shoulders.forEach((shoulder, i) => expect(shoulder.quaternion.angleTo(baseArms[i])).toBeLessThan(1e-7));
        }
        actor.setSharedPose('offer', 1, look); actor.respondToLearning('support', 0, 1, look); actor.clearLearningPose();
        expect(actor.head.quaternion.angleTo(baseHead)).toBeLessThan(1e-7);
        actor.setSharedPose('receive', 1, look); actor.update(1400);
        expect(actor.head.quaternion.angleTo(baseHead)).toBeLessThan(1e-7);
    });

    it.each(['otter', 'rabbit', 'fox'] as const)('%s presents either actual outer paw without stretching or moving the planted rig', species => {
        const { actor } = resident(species);
        const shoulders = ['shoulder-left', 'shoulder-right'].map(name => actor.body.getObjectByName(name)!);
        const hands = ['hand-contact-left', 'hand-contact-right'].map(name => actor.body.getObjectByName(name)!);
        const fixed = actor.group.position.clone(), feet = actor.feet.map(foot => foot.getWorldPosition(new THREE.Vector3()));
        const contact = actor.seatContact.getWorldPosition(new THREE.Vector3());
        const original = [actor.body, actor.head, ...shoulders].map(object => object.quaternion.clone());
        const armLengths = hands.map((paw, index) => paw.getWorldPosition(new THREE.Vector3())
            .distanceTo(shoulders[index].getWorldPosition(new THREE.Vector3())));
        const localHands = hands.map(paw => paw.position.clone()), localShoulders = shoulders.map(shoulder => shoulder.position.clone());
        for (const hand of ['left', 'right'] as const) for (const mode of ['carry', 'offer', 'receive', 'enjoy'] as const) {
            const index = hand === 'left' ? 0 : 1, side = index ? 1 : -1;
            const target = actor.body.localToWorld(new THREE.Vector3(side * .55, .65, .35));
            actor.setSharedPose(mode, 1, target, hand);
            const out = new THREE.Vector3(); expect(actor.handAnchor(out, hand)).toBe(out);
            expect(out.distanceTo(hands[index].getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-8);
            const joint = shoulders[index].getWorldPosition(new THREE.Vector3());
            expect(out.clone().sub(joint).normalize().dot(target.clone().sub(joint).normalize())).toBeCloseTo(1, 8);
            expect(out.distanceTo(joint)).toBeCloseTo(armLengths[index], 8);
            expect(Math.hypot(out.x - fixed.x, out.z - fixed.z)).toBeGreaterThan(.65);
            const gaze = actor.head.getWorldDirection(new THREE.Vector3());
            expect(gaze.dot(target.clone().sub(actor.head.getWorldPosition(new THREE.Vector3())).normalize())).toBeGreaterThan(.999);
            const headAngles = new THREE.Euler().setFromQuaternion(actor.head.quaternion, 'YXZ');
            expect(Math.abs(headAngles.y)).toBeLessThanOrEqual(1.05 + 1e-8);
            expect(hands[index].parent).toBeInstanceOf(THREE.Mesh);
            expect(hands[index].position.distanceTo(localHands[index])).toBe(0);
            shoulders.forEach((shoulder, i) => expect(shoulder.position.distanceTo(localShoulders[i])).toBe(0));
            const support = shoulders[1 - index].quaternion.clone();
            const posed = [actor.body, actor.head, ...shoulders].map(object => object.quaternion.clone());
            actor.setSharedPose(mode, 1, target, hand);
            [actor.body, actor.head, ...shoulders].forEach((object, i) => expect(object.quaternion.angleTo(posed[i])).toBeLessThan(1e-7));
            const shiftedTarget = target.clone().add(new THREE.Vector3(.15, -.08, .1));
            actor.setSharedPose(mode, 1, shiftedTarget, hand);
            expect(shoulders[1 - index].quaternion.angleTo(support)).toBeLessThan(1e-7);
            expect(actor.group.position.equals(fixed)).toBe(true);
            expect(actor.seatContact.getWorldPosition(new THREE.Vector3()).distanceTo(contact)).toBeLessThan(1e-8);
            actor.feet.forEach((foot, i) => expect(foot.getWorldPosition(new THREE.Vector3()).distanceTo(feet[i])).toBeLessThan(1e-8));
            actor.clearSharedPose();
            [actor.body, actor.head, ...shoulders].forEach((object, i) => expect(object.quaternion.angleTo(original[i])).toBeLessThan(1e-7));
        }
        // A target behind/above the body remains clamped rather than twisting
        // the face to follow an unreachable gaze direction.
        actor.setSharedPose('offer', 1, actor.body.localToWorld(new THREE.Vector3(3, 3, -1)), 'right');
        const capped = new THREE.Euler().setFromQuaternion(actor.head.quaternion, 'YXZ');
        expect(capped.y).toBeCloseTo(1.05, 8); expect(capped.x).toBeCloseTo(-.45, 8);
    });

    it('restores a single-handed seated pose before base motion, learning, and release', () => {
        const { actor } = resident('fox'), item = target('swing', Math.PI / 2);
        actor.visit(item, 0, false, [item], 0); actor.update(1400);
        const shoulders = ['shoulder-left', 'shoulder-right'].map(name => actor.body.getObjectByName(name)!);
        const objects = [actor.body, actor.head, ...shoulders], original = objects.map(object => object.quaternion.clone());
        const root = actor.group.position.clone(), contact = actor.seatContact.getWorldPosition(new THREE.Vector3());
        const feet = actor.feet.map(foot => foot.getWorldPosition(new THREE.Vector3()));
        const look = actor.body.localToWorld(new THREE.Vector3(-.55, .65, .35));
        for (const amount of [0, .25, .5, 1]) {
            actor.setSharedPose('receive', amount, look, 'left');
            expect(actor.group.position.equals(root)).toBe(true);
            expect(actor.seatContact.getWorldPosition(new THREE.Vector3()).distanceTo(contact)).toBeLessThan(1e-8);
            actor.feet.forEach((foot, i) => expect(foot.getWorldPosition(new THREE.Vector3()).distanceTo(feet[i])).toBeLessThan(1e-8));
        }
        actor.respondToLearning('support', 0, 1, look); actor.clearLearningPose();
        objects.forEach((object, i) => expect(object.quaternion.angleTo(original[i])).toBeLessThan(1e-7));
        actor.setSharedPose('receive', 1, look, 'right'); actor.update(1400);
        objects.forEach((object, i) => expect(object.quaternion.angleTo(original[i])).toBeLessThan(1e-7));
        actor.setSharedPose('enjoy', 1, look, 'left'); actor.release(1400); actor.update(1700);
        expect(actor.action).toBe('idle'); expect(actor.itemId).toBe('');
        expect(actor.head.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-7);
        shoulders.forEach((shoulder, i) => expect(shoulder.rotation.z).toBeCloseTo((i ? 1 : -1) * .2));
    });

    it('plants a stance foot while lifting the returning foot, with a distance-based stride', () => {
        const at = (distance: number) => sampleResidentStride(distance, 4);
        const first = .62, second = .67;
        expect(at(first).feet[0].lift).toBe(0);
        expect(at(first).feet[1].lift).toBeGreaterThan(.03);
        expect(first + at(first).feet[0].z * RESIDENT_SCALE).toBeCloseTo(second + at(second).feet[0].z * RESIDENT_SCALE, 10);
        for (let distance = 0; distance <= 4; distance += .017) {
            const feet = at(distance).feet;
            expect(feet.every(foot => foot.lift >= 0)).toBe(true);
            expect(Math.min(...feet.map(foot => foot.lift))).toBe(0);
        }
        expect(at(0).feet.map(foot => [foot.z, foot.lift])).toEqual([[.12, 0], [.12, 0]]);
        expect(at(4).feet.map(foot => [foot.z, foot.lift])).toEqual([[.12, 0], [.12, 0]]);
    });

    it('turns across the shortest angle without changing the navigation root', () => {
        expect(turnResidentToward(Math.PI - .05, -Math.PI + .05, 10)).toBeCloseTo(Math.PI + .05);
        expect(turnResidentToward(0, Math.PI, 16)).toBeCloseTo(.192);
    });

    it.each(['otter', 'rabbit', 'fox'] as const)('%s soles rest on the ground and the shoulder stays attached when waving', species => {
        const { actor } = resident(species);
        actor.group.updateMatrixWorld(true);
        for (const foot of actor.feet) expect(new THREE.Box3().setFromObject(foot).min.y).toBeCloseTo(0, 6);
        const shoulder = actor.body.getObjectByName('shoulder-left')!;
        const joint = shoulder.getWorldPosition(new THREE.Vector3());
        const hand = shoulder.children[0], center = hand.getWorldPosition(new THREE.Vector3());
        const root = actor.group.position.clone();
        actor.respondToLearning('correct', 1, 1, new THREE.Vector3(-2, 1, 0));
        expect(shoulder.getWorldPosition(new THREE.Vector3()).distanceTo(joint)).toBeLessThan(1e-8);
        expect(hand.getWorldPosition(new THREE.Vector3()).y).toBeGreaterThan(center.y + .05);
        expect(actor.group.position.equals(root)).toBe(true);
        actor.clearLearningPose();
        expect(hand.getWorldPosition(new THREE.Vector3()).distanceTo(center)).toBeLessThan(1e-8);
    });

    it.each(['bench', 'swing', 'mushroom'] as const)('%s supports each resident at the real surface through all rotations', kind => {
        for (const species of ['otter', 'rabbit', 'fox'] as const) for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            const { actor, material } = resident(species), item = target(kind, rotation);
            const furniture = makeFurniture(kind, material); models.push(furniture);
            furniture.position.set(item.position!.x, 0, item.position!.z); furniture.rotation.y = rotation;
            expect(actor.visit(item, 0, true, [item], 0)).toBe(true);
            actor.group.updateMatrixWorld(true); furniture.updateMatrixWorld(true);
            const contact = actor.seatContact.getWorldPosition(new THREE.Vector3());
            expect(contact.distanceTo(worldAnchor(item, getFurnitureAnchors(kind).seat!))).toBeLessThan(1e-8);
            const hits = new THREE.Raycaster(contact.clone().addScaledVector(up, 1), up.clone().negate(), 0, 1.1).intersectObject(furniture, true);
            expect(hits.length).toBeGreaterThan(0);
            expect(Math.min(...hits.map(hit => hit.point.distanceTo(contact)))).toBeLessThan(.003);
            // Check actual torso geometry too, so a correct marker cannot hide a floating body.
            const bodyHits = new THREE.Raycaster(contact.clone().addScaledVector(up, -.03), up, 0, .06).intersectObject(actor.body, true);
            expect(bodyHits.length).toBeGreaterThan(0);
            expect(Math.min(...bodyHits.map(hit => hit.point.distanceTo(contact)))).toBeLessThan(.003);
        }
    });

    it('swings resident and real seat together using the same phase, pivot and rotated contact', () => {
        const { actor, material } = resident('rabbit'), item = target('swing', Math.PI / 2);
        const furniture = makeFurniture('swing', material); models.push(furniture);
        furniture.position.set(item.position!.x, 0, item.position!.z); furniture.rotation.y = item.rotation;
        expect(actor.visit(item, 0, false, [item], 0)).toBe(true);
        for (const phase of [0, .15, .25, .5, .75, 1]) {
            actor.update(1050 + FURNITURE_USE_MS * phase);
            applyFurnitureUse(furniture, actor.usePhase);
            actor.group.updateMatrixWorld(true); furniture.updateMatrixWorld(true);
            const swing = sampleFurnitureSwing(phase), contact = actor.seatContact.getWorldPosition(new THREE.Vector3());
            expect(actor.usePhase).toBeCloseTo(phase);
            expect(actor.pose.rotation.x).toBeCloseTo(swing.angle);
            expect(contact.distanceTo(worldAnchor(item, swing.seat))).toBeLessThan(1e-8);
            expect(actor.group.position.x).toBe(item.position!.x); expect(actor.group.position.z).toBe(item.position!.z);
            const normal = up.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), swing.angle).applyAxisAngle(up, item.rotation);
            const hits = new THREE.Raycaster(contact.clone().addScaledVector(normal, .2), normal.negate(), 0, .25).intersectObject(furniture, true);
            expect(Math.min(...hits.map(hit => hit.point.distanceTo(contact)))).toBeLessThan(.003);
        }
    });

    it('keeps the old bridge path and deck height while visibly lifting feet', () => {
        const { actor } = resident(), item = { ...target('bench'), position: { x: 6.25, z: .95 } };
        expect(actor.visit(item, 0, false, [item], 2)).toBe(true);
        let bridgeSamples = 0, lifted = false;
        for (let now = 20; now < 6500 && actor.action === 'walk'; now += 20) {
            actor.update(now);
            expect(residentGroundIsSafe(actor.group.position, true)).toBe(true);
            for (const foot of actor.feet) {
                if (foot.position.y > residentFootY(actor.species) + .02) lifted = true;
                if (actor.group.position.x > 4.4 && actor.group.position.x < 5.15) {
                    bridgeSamples++;
                    expect(actor.group.position.z).toBeCloseTo(0);
                    expect(actor.group.position.y).toBeCloseTo(residentGroundHeight(actor.group.position, true));
                    expect(foot.position.y).toBeGreaterThanOrEqual(residentFootY(actor.species));
                }
            }
        }
        expect(bridgeSamples).toBeGreaterThan(5); expect(lifted).toBe(true);
    });

    it('releasing a lifted seat returns the full rig to grounded standing without stale learning offsets', () => {
        const { actor } = resident(), item = target('mushroom');
        actor.visit(item, 0, false, [item], 0); actor.update(2500);
        const root = actor.group.position.clone();
        actor.respondToLearning('correct', 1, 1, new THREE.Vector3(1, 1, 0));
        actor.release(2500); actor.clearLearningPose();
        expect(actor.itemId).toBe(''); expect(actor.usePhase).toBe(1);
        expect(actor.update(2610)).toBe(true);
        expect(actor.group.position.y).toBeGreaterThan(0); expect(actor.group.position.y).toBeLessThan(root.y);
        expect(actor.update(2720)).toBe(false);
        expect(actor.group.position.toArray()).toEqual([root.x, 0, root.z]);
        expect(actor.pose.position.length()).toBe(0); expect(actor.pose.rotation.x).toBe(0);
        expect(actor.head.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
        for (const foot of actor.feet) expect(new THREE.Box3().setFromObject(foot).min.y).toBeCloseTo(0, 6);
    });

    it('keeps retry/support neutral, additive learning poses reversible, and reduced furniture stationary', () => {
        const { actor } = resident('rabbit'), item = target('swing');
        actor.visit(item, 0, true, [item], 0);
        const root = actor.group.position.clone(), feet = actor.feet.map(foot => foot.getWorldPosition(new THREE.Vector3()));
        const head = actor.head.rotation.clone(), shoulder = actor.body.getObjectByName('shoulder-right')!.rotation.clone();
        for (const kind of ['correct', 'retry', 'support'] as const) {
            const reaction = sampleLearningReaction(kind, 625, true);
            actor.respondToLearning(kind, reaction.paw, reaction.look, new THREE.Vector3(1, 1, 0));
            expect(actor.group.position.equals(root)).toBe(true);
            actor.feet.forEach((foot, index) => expect(foot.getWorldPosition(new THREE.Vector3()).distanceTo(feet[index])).toBeLessThan(1e-8));
            if (kind !== 'correct') {
                const rotation = actor.body.getObjectByName('shoulder-right')!.rotation;
                expect(rotation.x).toBeCloseTo(shoulder.x, 10);
                expect(rotation.y).toBeCloseTo(shoulder.y, 10);
                expect(rotation.z).toBeCloseTo(shoulder.z, 10);
            }
            actor.clearLearningPose();
            expect(actor.head.rotation.x).toBeCloseTo(head.x); expect(actor.head.rotation.z).toBeCloseTo(head.z);
        }
        expect(actor.usePhase).toBe(1); expect(actor.pose.rotation.x).toBe(0);
        expect(actor.update(20000)).toBe(false);
        actor.release(); expect(actor.group.position.y).toBe(0); expect(actor.update(21000)).toBe(false);
    });

    it('replays from a settled seat without a fake walk or losing physical contact', () => {
        const { actor } = resident('fox'), item = target('bench');
        actor.visit(item, 0, true, [item], 0);
        const root = actor.group.position.clone();
        expect(actor.replayUse(100, false)).toBe(true);
        expect(actor.action).toBe('sit'); expect(actor.usePhase).toBe(0);
        actor.update(500); actor.group.updateMatrixWorld(true);
        expect(actor.usePhase).toBeCloseTo(1 / 3);
        expect(actor.head.rotation.x).toBeLessThan(-.06);
        expect(actor.group.position.equals(root)).toBe(true);
        expect(actor.seatContact.getWorldPosition(new THREE.Vector3()).distanceTo(worldAnchor(item, getFurnitureAnchors('bench').seat!))).toBeLessThan(1e-8);
        expect(actor.update(1300)).toBe(false); expect(actor.usePhase).toBe(1);
        actor.replayUse(2000, true);
        expect(actor.usePhase).toBe(1); expect(actor.group.position.equals(root)).toBe(true);
    });

    it('does not restart an ongoing approach when the same invitation is repeated', () => {
        const { actor } = resident(), item = target('bench');
        actor.visit(item, 0, false, [item], 0); actor.update(300);
        expect(actor.replayUse(300, false)).toBe(true);
        actor.update(1050);
        expect(actor.action).toBe('sit'); expect(actor.usePhase).toBe(0);
    });
});

describe('resident interest stays a removable layer on the real rig', () => {
    const shape = (actor: IslandResident) => {
        actor.group.updateMatrixWorld(true);
        return { root: actor.group.position.toArray(), pose: actor.pose.matrix.elements.slice(), body: actor.body.matrix.elements.slice(),
            feet: actor.feet.map(foot => foot.getWorldPosition(new THREE.Vector3()).toArray()),
            seat: actor.seatContact.getWorldPosition(new THREE.Vector3()).toArray() };
    };
    const rotations = (actor: IslandResident) => [actor.head, actor.body.getObjectByName('shoulder-left')!,
        actor.body.getObjectByName('shoulder-right')!].flatMap(part => part.quaternion.toArray());
    const close = (actual: number[], expected: number[]) => actual.forEach((value, index) => expect(value).toBeCloseTo(expected[index], 12));

    it.each(['otter', 'rabbit', 'fox'] as const)('%s keeps real feet, root, seat and shoulder joints on rotated ordinary objects', species => {
        for (const kind of ['flower', 'lantern', 'fountain'] as const) for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            const { actor } = resident(species), item = target(kind, rotation);
            expect(actor.visit(item, 0, true, [item], 0)).toBe(true);
            expect(actor.replayUse(0, false)).toBe(true);
            const look = worldAnchor(item, getFurnitureAnchors(kind).look);
            for (const phase of [0, .25, .44, .47, .66, .85, 1]) {
                actor.update(phase * FURNITURE_USE_MS);
                const fixed = shape(actor), original = rotations(actor);
                const shoulders = ['shoulder-left', 'shoulder-right'].map(name => actor.body.getObjectByName(name)!);
                const joints = shoulders.map(part => part.getWorldPosition(new THREE.Vector3()).toArray());
                const hands = ['left', 'right'].map(hand => actor.handAnchor(undefined, hand as 'left' | 'right'));
                const lengths = hands.map((hand, i) => hand.distanceTo(new THREE.Vector3(...joints[i])));
                const sample = sampleResidentInterest(species, phase, false);
                actor.respondToInterest(sample, look);
                expect(shape(actor)).toEqual(fixed);
                shoulders.forEach((part, i) => close(part.getWorldPosition(new THREE.Vector3()).toArray(), joints[i]));
                for (const [i, hand] of (['left', 'right'] as const).entries()) {
                    const anchor = actor.handAnchor(undefined, hand);
                    expect(anchor.distanceTo(new THREE.Vector3(...joints[i]))).toBeCloseTo(lengths[i], 12);
                    expect(anchor.y).toBeLessThan(actor.group.position.y + .8);
                }
                const posed = rotations(actor);
                actor.respondToInterest(sample, look);
                close(rotations(actor), posed); // Frame repetition cannot accumulate a nod or arm offset.
                actor.clearLearningPose(); close(rotations(actor), original);
                expect(shape(actor)).toEqual(fixed);
            }
        }
    });

    it('uses the same visible head and paw transforms for a visit and a saved-light reply, preserving the base sniff', () => {
        for (const species of ['otter', 'rabbit', 'fox'] as const) {
            const { actor } = resident(species), item = target('flower', Math.PI / 2);
            actor.visit(item, 0, true, [item], 0); actor.replayUse(0, false); actor.update(.66 * FURNITURE_USE_MS);
            const look = worldAnchor(item, getFurnitureAnchors(item.kind).look), original = rotations(actor), fixed = shape(actor);
            expect(actor.body.rotation.x).toBe(.07);
            actor.respondToInterest(sampleResidentInterest(species, actor.usePhase, false), look);
            const ordinary = rotations(actor), hand = actor.handAnchor().toArray();
            actor.clearLearningPose();
            const reply = sampleLearningReaction('correct', 350 + .66 * 550, false);
            actor.respondToInterest(sampleResidentInterest(species, reply.reply, false), look);
            close(rotations(actor), ordinary); close(actor.handAnchor().toArray(), hand); expect(shape(actor)).toEqual(fixed);
            actor.clearLearningPose(); close(rotations(actor), original);
        }
    });

    it('selects only the target-side low fox paw, without crossing the face or moving either shoulder joint', () => {
        for (const x of [-2, 2]) {
            const { actor } = resident('fox'); actor.group.rotation.y = 0;
            const near = actor.body.getObjectByName(x < 0 ? 'shoulder-left' : 'shoulder-right')!;
            const far = actor.body.getObjectByName(x < 0 ? 'shoulder-right' : 'shoulder-left')!;
            const farPose = far.quaternion.clone(), nearPose = near.quaternion.clone();
            actor.respondToInterest(sampleResidentInterest('fox', .66, false), new THREE.Vector3(x, .8, 1));
            expect(far.quaternion.equals(farPose)).toBe(true); expect(near.quaternion.angleTo(nearPose)).toBeGreaterThan(.4);
            const hand = actor.handAnchor(undefined, x < 0 ? 'left' : 'right');
            expect(Math.sign(hand.x)).toBe(Math.sign(x)); expect(hand.y).toBeLessThan(.65);
        }
    });

    it('looks toward the real target height and yaw from a rotated body without doubling the base gaze', () => {
        const { actor } = resident('otter');
        actor.group.rotation.y = Math.PI / 2;
        const head = actor.head.getWorldPosition(new THREE.Vector3());
        const target = head.clone().add(new THREE.Vector3(2, 1, -1));
        const direction = target.clone().sub(head).normalize();
        const gaze = () => new THREE.Vector3(0, 0, 1).applyQuaternion(actor.head.getWorldQuaternion(new THREE.Quaternion()));
        const before = gaze().dot(direction);
        actor.respondToInterest(sampleResidentInterest('otter', .47, false), target);
        expect(gaze().dot(direction)).toBeGreaterThan(before + .07);
        const first = rotations(actor);
        actor.respondToInterest(sampleResidentInterest('otter', .47, false), target);
        close(rotations(actor), first);
    });

    it('clears interest before retry/support, shared holding, reduced changes and release without stale pose offsets', () => {
        for (const species of ['otter', 'rabbit', 'fox'] as const) {
            const { actor } = resident(species), item = target('bench', Math.PI / 2), look = new THREE.Vector3(1, .8, 1);
            actor.visit(item, 0, true, [item], 0);
            const fixed = shape(actor), original = rotations(actor);
            for (const reduced of [false, true, false]) {
                actor.respondToInterest(sampleResidentInterest(species, .66, reduced), look);
                expect(shape(actor)).toEqual(fixed);
                for (const kind of ['retry', 'support'] as const) {
                    actor.respondToLearning(kind, 0, .7, look); actor.clearLearningPose();
                    close(rotations(actor), original);
                }
                actor.respondToInterest(sampleResidentInterest(species, .44, reduced), look);
                actor.setSharedPose('receive', 1, look, 'left'); actor.clearSharedPose();
                close(rotations(actor), original); expect(shape(actor)).toEqual(fixed);
            }
            actor.respondToInterest(sampleResidentInterest(species, 0, true), look);
            const root = actor.group.position.clone(); actor.release(500);
            expect(actor.group.position.x).toBe(root.x); expect(actor.group.position.z).toBe(root.z);
            expect(actor.group.position.y).toBe(0); expect(actor.itemId).toBe('');
            expect(actor.head.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]);
        }
    });
});

describe('runtime owns the ordinary-interest window', () => {
    // Use the actual runtime methods and actual rigs/furniture without creating
    // a renderer. Only the scene's already-existing state dependencies are set.
    const sceneFor = (actor: IslandResident, item: IslandStageItem, group: THREE.Group) => {
        const scene = Object.create(IslandScene.prototype) as {
            state: { learning: boolean; preview?: IslandStageItem };
            items: Map<string, { item: IslandStageItem; group: THREE.Group }>;
            motion: { matches: boolean }; sharedActivity: { plan?: object }; furnitureClearance: { active: boolean };
            ordinaryInterest?: unknown; interestObservation?: { context: string; species: string; phase: number };
            beginOrdinaryInterest(resident: IslandResident, item: IslandStageItem): void;
            clearOrdinaryInterest(): void; applyOrdinaryInterest(): boolean;
        };
        Object.assign(scene, { state: { learning: false }, items: new Map([[item.id, { item, group }]]),
            motion: { matches: false }, sharedActivity: {}, furnitureClearance: { active: false } });
        scene.beginOrdinaryInterest(actor, item);
        return scene;
    };

    it('does not pose a walker or a shared source, and clears the actual flower after context cancellation', () => {
        const { actor, material } = resident('rabbit'), item = target('flower');
        const furniture = makeFurniture(item.kind, material); models.push(furniture);
        furniture.position.set(item.position!.x, 0, item.position!.z);
        actor.visit(item, 0, false, [item], 0);
        const scene = sceneFor(actor, item, furniture), before = actor.head.quaternion.clone();
        expect(scene.applyOrdinaryInterest()).toBe(false); expect(actor.head.quaternion.equals(before)).toBe(true);
        actor.update(10000); actor.replayUse(10000, false); actor.update(10000 + .44 * FURNITURE_USE_MS);
        expect(scene.applyOrdinaryInterest()).toBe(true);
        expect(scene.interestObservation).toMatchObject({ context: 'visit', species: 'rabbit', phase: .44 });
        expect(furniture.getObjectByName('flower-blooms')!.scale.x).toBeGreaterThan(1);
        expect(furniture.getObjectByName('flower-leaves')!.scale.toArray()).toEqual([1, 1, 1]);
        scene.sharedActivity.plan = {};
        expect(scene.applyOrdinaryInterest()).toBe(false); expect(scene.ordinaryInterest).toBeUndefined();
        expect(scene.interestObservation).toBeUndefined();
        expect(furniture.getObjectByName('flower-blooms')!.scale.toArray()).toEqual([1, 1, 1]);
        expect(furniture.getObjectByName('flower-leaves')!.scale.toArray()).toEqual([1, 1, 1]);
        const base = actor.head.quaternion.clone();
        scene.beginOrdinaryInterest(actor, item);
        expect(scene.ordinaryInterest).toBeUndefined(); expect(actor.head.quaternion.equals(base)).toBe(true);
    });

    it('shows a single reduced state and removes it for learning, preview and an invalidated model', () => {
        const { actor, material } = resident('fox'), item = target('fountain');
        const furniture = makeFurniture(item.kind, material); models.push(furniture);
        furniture.position.set(item.position!.x, 0, item.position!.z); actor.visit(item, 0, true, [item], 0);
        const scene = sceneFor(actor, item, furniture); scene.motion.matches = true;
        expect(scene.applyOrdinaryInterest()).toBe(true); const posed = actor.head.quaternion.clone();
        expect(furniture.getObjectByName('fountain-ripple')!.scale.x).toBeGreaterThan(1);
        expect(furniture.getObjectByName('fountain-water')!.scale.toArray()).toEqual([1, 1, 1]);
        expect(scene.applyOrdinaryInterest()).toBe(true); expect(actor.head.quaternion.equals(posed)).toBe(true);
        for (const reason of ['learning', 'preview', 'model'] as const) {
            scene.state.learning = false; scene.state.preview = undefined;
            scene.items.set(item.id, { item, group: furniture }); scene.beginOrdinaryInterest(actor, item);
            expect(scene.applyOrdinaryInterest()).toBe(true);
            expect(furniture.getObjectByName('fountain-ripple')!.scale.x).toBeGreaterThan(1);
            expect(furniture.getObjectByName('fountain-water')!.scale.toArray()).toEqual([1, 1, 1]);
            if (reason === 'learning') scene.state.learning = true;
            if (reason === 'preview') scene.state.preview = item;
            if (reason === 'model') scene.items.delete(item.id);
            expect(scene.applyOrdinaryInterest()).toBe(false); expect(scene.ordinaryInterest).toBeUndefined();
            expect(furniture.getObjectByName('fountain-ripple')!.scale.toArray()).toEqual([1, 1, 1]);
            expect(furniture.getObjectByName('fountain-water')!.scale.toArray()).toEqual([1, 1, 1]);
        }
    });
});
