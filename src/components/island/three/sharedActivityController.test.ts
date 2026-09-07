import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { IslandMaterials, disposeGeometry } from './primitives';
import { IslandResident } from './animals';
import { chooseSharedActivity, sharedActivityDeliveryPlans, type SharedActivityKind } from './sharedActivities';
import { SharedActivityVisuals } from './sharedActivityVisuals';
import { SharedActivityController } from './sharedActivityController';
import { getFurnitureAnchors, sampleFurnitureSwing } from './furnitureVisuals';
import { residentGroundHeight } from './navigation';
import type { IslandStageItem } from './types';

function fixture(kind: SharedActivityKind = 'flower') {
    const materials = new IslandMaterials(), captions: string[] = [];
    const residents = [new IslandResident('otter', materials, [-2.5, 0, 1.4], text => captions.push(text)),
        new IslandResident('rabbit', materials, [2.7, 0, .3], text => captions.push(text)),
        new IslandResident('fox', materials, [6.4, 0, .9], text => captions.push(text))];
    const kinds = { flower: ['flower', 'bench'], star: ['lantern', 'mushroom'], bubble: ['fountain', 'swing'] } as const;
    const items: IslandStageItem[] = [
        { id: 'source', kind: kinds[kind][0], position: { x: 1.5, z: 1.8 }, rotation: 0 },
        { id: 'seat', kind: kinds[kind][1], position: { x: -.5, z: .7 }, rotation: Math.atan2(2, 1.1) },
    ];
    const visuals = new SharedActivityVisuals(materials), controller = new SharedActivityController(residents, visuals, text => captions.push(text));
    const plan = chooseSharedActivity(items, residents.map(resident => ({
        position: { x: resident.group.position.x, z: resident.group.position.z }, visible: true, itemId: resident.itemId,
    })), 6, 'source')!;
    expect(plan).toBeDefined();
    let clock = 0;
    const tick = (now: number, reduced = false) => {
        clock = now;
        residents.forEach(resident => resident.update(now));
        controller.update(now, reduced);
        return controller.snapshot();
    };
    const until = (phase: string) => {
        while (controller.snapshot()?.phase !== phase && clock < 35000) tick(clock + 32);
        expect(controller.snapshot()?.phase).toBe(phase);
        return clock;
    };
    const dispose = () => {
        controller.cancel(clock); visuals.dispose();
        residents.forEach(resident => disposeGeometry(resident.group)); materials.dispose();
    };
    return { residents, items, visuals, controller, plan, captions, tick, until, dispose };
}

describe('physical sharing lifecycle', () => {
    it.each<SharedActivityKind>(['flower', 'star', 'bubble'])('%s travels from the source through two actual residents without crossing bodies', kind => {
        const f = fixture(kind), original = JSON.stringify(f.items), phases = new Set<string>();
        try {
            expect(f.controller.start(f.plan, 0, false, f.items, 6)).toBe(true);
            for (let now = 0; now < 35000; now += 32) {
                const current = f.tick(now)!;
                phases.add(current.phase);
                for (let a = 0; a < f.residents.length; a++) for (let b = a + 1; b < f.residents.length; b++) {
                    const x = f.residents[a].group.position, y = f.residents[b].group.position;
                    expect(Math.hypot(x.x - y.x, x.z - y.z)).toBeGreaterThanOrEqual(.84 - 1e-5);
                }
                if (current.phase === 'carry') {
                    expect(current.prop.visible).toBe(true);
                    expect(current.prop.owner).toBe('carrier');
                    expect(new THREE.Vector3(...current.prop.position).distanceTo(f.residents[f.plan.carrier]
                        .handAnchor(new THREE.Vector3(), current.hands.carrier))).toBeLessThan(1e-6);
                }
                if (['share', 'enjoy', 'settled'].includes(current.phase)) {
                    const recipient = f.residents[f.plan.receiver];
                    expect(recipient.itemId).toBe('seat');
                    expect(recipient.action).not.toBe('walk');
                    const anchor = getFurnitureAnchors(f.plan.seat.kind).seat!;
                    const seat = kind === 'bubble' ? sampleFurnitureSwing(recipient.usePhase).seat : anchor;
                    const actualContact = recipient.seatContact.getWorldPosition(new THREE.Vector3());
                    expect(actualContact.y).toBeCloseTo(seat.y, 6);
                }
                if (current.phase === 'settled') {
                    expect(current.prop.visible).toBe(kind !== 'bubble');
                    if (kind !== 'bubble') expect(new THREE.Vector3(...current.prop.position)
                        .distanceTo(f.residents[f.plan.receiver].handAnchor(new THREE.Vector3(), current.hands.receiver))).toBeLessThan(1e-6);
                    break;
                }
            }
            expect([...phases]).toEqual(['receiver-walk', 'gather-walk', 'gather', 'carry', 'share', 'enjoy', 'settled']);
            expect(JSON.stringify(f.items)).toBe(original);
            expect(f.controller.active).toBe(false);
            expect(f.captions.length).toBeGreaterThanOrEqual(2);
        } finally { f.dispose(); }
    });

    it('chooses the actual holding paws once at pickup and retains them through replay of the outcome', () => {
        const f = fixture('star');
        try {
            f.controller.start(f.plan, 0, false, f.items, 6);
            expect(f.controller.setPresentationHands({ carrier: 'left', receiver: 'right' })).toBe(false);
            const now = f.until('gather');
            expect(f.controller.setPresentationHands({ carrier: 'left', receiver: 'right' })).toBe(true);
            f.tick(now);
            expect(f.controller.setPresentationHands({ carrier: 'right', receiver: 'left' })).toBe(false);
            f.until('settled');
            expect(f.controller.presentationHands).toEqual({ carrier: 'left', receiver: 'right' });
            const snapshot = f.controller.snapshot()!, receiver = f.residents[f.plan.receiver];
            expect(new THREE.Vector3(...snapshot.prop.position).distanceTo(receiver
                .handAnchor(new THREE.Vector3(), 'right'))).toBeLessThan(1e-6);
            // The star stays at the seated torso's side, rather than using a
            // standing-height offset added to the raised seat root.
            const local = receiver.body.worldToLocal(new THREE.Vector3(...snapshot.prop.position));
            expect(local.x).toBeGreaterThan(.4);
            expect(local.y).toBeLessThan(.75);
            expect(f.controller.setPresentationHands({ carrier: 'right', receiver: 'left' })).toBe(false);
        } finally { f.dispose(); }
    });

    it('does not change the holding hand after the pickup has already started', () => {
        const f = fixture();
        try {
            f.controller.start(f.plan, 0, false, f.items, 6);
            const now = f.until('gather');
            f.tick(now + 32);
            const hands = f.controller.snapshot()!.hands;
            expect(f.controller.setPresentationHands({ carrier: 'left', receiver: 'right' })).toBe(false);
            expect(f.controller.snapshot()!.hands).toEqual(hands);
        } finally { f.dispose(); }
    });

    it('fixes a legal alternative delivery before pickup without changing actual positions or completed routes', () => {
        const f = fixture('star');
        try {
            const original = JSON.stringify(f.plan);
            f.controller.start(f.plan, 0, false, f.items, 6);
            const now = f.until('gather');
            const plans = sharedActivityDeliveryPlans(f.plan, f.items, f.residents.map(resident => ({
                position: resident.group.position, visible: true, itemId: resident.itemId,
            })), 6);
            expect(plans.length).toBeGreaterThan(1);
            const alternate = plans[1];
            const before = f.residents.map(resident => resident.group.position.toArray());
            expect(f.controller.setPresentation({ ...alternate, carrier: alternate.receiver }, { carrier: 'left', receiver: 'right' })).toBe(false);
            expect(f.controller.setPresentation(alternate, { carrier: 'left', receiver: 'right' })).toBe(true);
            f.tick(now);
            expect(f.residents.map(resident => resident.group.position.toArray())).toEqual(before);
            expect(JSON.stringify(f.plan)).toBe(original);
            expect(f.controller.plan?.receiverRoute).toBe(f.plan.receiverRoute);
            expect(f.controller.plan?.gatherRoute).toBe(f.plan.gatherRoute);
            f.until('share');
            const carrier = f.residents[f.plan.carrier].group.position;
            expect(carrier.x).toBeCloseTo(alternate.handoffPoint.x, 6);
            expect(carrier.z).toBeCloseTo(alternate.handoffPoint.z, 6);
            expect(f.controller.setPresentation(f.plan, { carrier: 'right', receiver: 'left' })).toBe(false);
        } finally { f.dispose(); }
    });

    it('never changes reduced-motion delivery after the outcome has already moved into place', () => {
        const f = fixture('star');
        try {
            const alternate = sharedActivityDeliveryPlans(f.plan, f.items, f.residents.map(resident => ({
                position: resident.group.position, visible: true, itemId: resident.itemId,
            })), 6)[1];
            expect(alternate).toBeDefined();
            f.controller.start(f.plan, 0, true, f.items, 6);
            const before = f.residents.map(resident => resident.group.position.toArray());
            expect(f.controller.setPresentation(alternate, { carrier: 'left', receiver: 'right' })).toBe(false);
            expect(f.residents.map(resident => resident.group.position.toArray())).toEqual(before);
            expect(f.controller.plan).toBe(f.plan);
        } finally { f.dispose(); }
    });

    it.each(['receiver-walk', 'gather-walk'])('locks staging before a motion preference change finishes %s', phase => {
        const f = fixture('star');
        try {
            f.controller.start(f.plan, 0, false, f.items, 6);
            const now = f.until(phase);
            const alternate = sharedActivityDeliveryPlans(f.plan, f.items, f.residents.map(resident => ({
                position: { x: resident.group.position.x, z: resident.group.position.z }, visible: true, itemId: resident.itemId,
            })), 6)[1];
            expect(alternate).toBeDefined();
            const before = f.residents.map(resident => resident.group.position.toArray());
            expect(f.controller.prepareReducedPresentation(alternate, { carrier: 'left', receiver: 'right' })).toBe(true);
            expect(f.residents.map(resident => resident.group.position.toArray())).toEqual(before);
            f.residents.forEach(resident => resident.update(now + 10000));
            f.tick(now, true);
            expect(f.controller.phase).toBe('settled');
            expect(f.controller.plan).toBe(alternate);
            const carrier = f.residents[f.plan.carrier].group.position;
            expect(carrier.x).toBeCloseTo(alternate.handoffPoint.x, 6);
            expect(carrier.z).toBeCloseTo(alternate.handoffPoint.z, 6);
            expect(f.controller.presentationHands).toEqual({ carrier: 'left', receiver: 'right' });
            expect(f.controller.prepareReducedPresentation(f.plan, { carrier: 'right', receiver: 'left' })).toBe(false);
        } finally { f.dispose(); }
    });

    it.each(['receiver-walk', 'gather-walk', 'gather', 'carry', 'share', 'enjoy', 'settled'])('cancels %s at rendered coordinates, hides every prop, and permits learning', phase => {
        const f = fixture();
        try {
            f.controller.start(f.plan, 0, false, f.items, 6);
            const now = f.until(phase);
            const positions = f.residents.map(resident => resident.group.position.clone());
            f.controller.cancel(now);
            expect(f.controller.snapshot()).toBeNull();
            expect(f.visuals.snapshot().meshes.every(mesh => !mesh.visible)).toBe(true);
            for (let step = 0; step <= 10; step++) f.tick(now + step * 32);
            f.residents.forEach((resident, index) => {
                expect(resident.group.position.x).toBe(positions[index].x);
                expect(resident.group.position.z).toBe(positions[index].z);
                expect(resident.action).not.toBe('walk');
                if (!resident.itemId) expect(resident.group.position.y).toBeCloseTo(residentGroundHeight(resident.group.position, true), 6);
                resident.respondToLearning('correct', 1, 1, new THREE.Vector3(1, 1, 0));
                expect(resident.learningFrameBounds().isEmpty()).toBe(false);
            });
        } finally { f.dispose(); }
    });

    it.each<SharedActivityKind>(['flower', 'star', 'bubble'])('reduced %s uses the same roles and route ends in one frame without prop flight', kind => {
        const f = fixture(kind);
        try {
            expect(f.controller.start(f.plan, 0, true, f.items, 6)).toBe(true);
            const current = f.controller.snapshot()!;
            expect(current.phase).toBe('settled');
            expect(current.prop.owner).toBe('receiver');
            expect(current.prop.visible).toBe(true);
            expect(current.carrier).toBe(f.plan.carrier);
            expect(f.residents[f.plan.carrier].group.position.x).toBeCloseTo(f.plan.handoffPoint.x);
            expect(f.residents[f.plan.carrier].group.position.z).toBeCloseTo(f.plan.handoffPoint.z);
            const positions = f.residents.map(resident => resident.group.position.toArray());
            f.tick(100, true);
            expect(f.residents.map(resident => resident.group.position.toArray())).toEqual(positions);
        } finally { f.dispose(); }
    });

    it('continues an in-flight pair, allows replay once settled, and clears the old object on a new visit', () => {
        const f = fixture();
        try {
            f.controller.start(f.plan, 0, false, f.items, 6);
            f.until('share');
            expect(f.controller.continuesFor('seat')).toBe(true);
            expect(f.controller.continuesFor('source')).toBe(true);
            expect(f.controller.continuesFor('other')).toBe(false);
            const now = f.until('settled');
            expect(f.controller.continuesFor('source')).toBe(false);
            const replay = chooseSharedActivity(f.items, f.residents.map(resident => ({ position: resident.group.position, visible: true, itemId: resident.itemId })), 6, 'source');
            expect(replay).toBeDefined();
            expect(f.controller.start(replay!, now + 100, false, f.items, 6)).toBe(true);
            expect(f.controller.active).toBe(true);
            expect(f.visuals.snapshot().visible).toBe(false);
        } finally { f.dispose(); }
    });
});
