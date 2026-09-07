import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IslandResident } from './animals';
import { applyFurnitureUse, getFurnitureAnchors, makeFurniture } from './furniture';
import { sampleFurnitureSwing } from './furnitureVisuals';
import { disposeGeometry, IslandMaterials } from './primitives';
import { residentGroundHeight, residentGroundIsSafe } from './navigation';
import { FURNITURE_USE_MS, RESIDENT_SCALE, residentFootY, sampleResidentStride, turnResidentToward, type ResidentSpecies } from './residentRig';
import { sampleLearningReaction } from './learningReaction';
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
