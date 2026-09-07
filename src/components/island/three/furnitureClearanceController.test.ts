import * as THREE from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { IslandResident } from './animals';
import * as clearance from './furnitureClearance';
import { FurnitureClearanceController } from './furnitureClearanceController';
import { residentGroundHeight, RESIDENT_FOOTPRINT } from './navigation';
import { disposeGeometry, IslandMaterials } from './primitives';
import type { IslandStageItem } from './types';

const cleanup: (() => void)[] = [];
function fixture() {
    const materials = new IslandMaterials();
    const residents = [new IslandResident('otter', materials, [-.5, 0, 1.5], () => {}),
        new IslandResident('rabbit', materials, [.5, 0, 1.5], () => {}),
        new IslandResident('fox', materials, [6.25, 0, .8], () => {})];
    const items: IslandStageItem[] = [{ id: 'new-fountain', kind: 'fountain', position: { x: 0, z: 1.5 }, rotation: 0 }];
    const caption = vi.fn(), controller = new FurnitureClearanceController(residents, caption);
    cleanup.push(() => { controller.cancel(30000); residents.forEach(resident => disposeGeometry(resident.group)); materials.dispose(); });
    return { residents, items, caption, controller };
}
function planFor(residents: IslandResident[], items: IslandStageItem[]) {
    return clearance.planFurnitureClearance(items, residents.map(resident => ({ position: resident.group.position,
        visible: resident.group.visible, itemId: resident.itemId, departingId: resident.departingId })), 6);
}
afterEach(() => { cleanup.splice(0).forEach(dispose => dispose()); vi.restoreAllMocks(); });

describe('saved furniture clearance runs physical moves in sequence', () => {
    it('moves only the current resident, keeps waiting occupancy, and reaches each preflighted endpoint', () => {
        const { residents, items, caption, controller } = fixture(), plan = planFor(residents, items);
        expect(plan.moves.map(move => move.index)).toEqual([0, 1]);
        const savedItems = JSON.stringify(items), original = residents.map(resident => resident.group.position.clone());
        expect(controller.start(items, 6, 0, false)).toBe(true);
        expect(residents.map(resident => resident.group.position.toArray())).toEqual(original.map(point => point.toArray()));
        expect(controller.snapshot()?.current?.index).toBe(0);
        expect(controller.snapshot()?.queue.map(move => move.index)).toEqual([1]);
        let previous = original;
        const sawMoving = new Set<number>();
        for (let now = 50; now < 16000 && controller.active; now += 50) {
            for (const resident of residents) resident.update(now);
            controller.update(now, false);
            const changed = residents.flatMap((resident, index) => resident.group.position.distanceTo(previous[index]) > .000001 ? [index] : []);
            expect(changed.length).toBeLessThanOrEqual(1);
            for (const index of changed) sawMoving.add(index);
            for (let a = 0; a < residents.length; a++) for (let b = a + 1; b < residents.length; b++) {
                const first = residents[a].group.position, second = residents[b].group.position;
                expect(Math.hypot(first.x - second.x, first.z - second.z)).toBeGreaterThanOrEqual(RESIDENT_FOOTPRINT * 2 - 1e-6);
            }
            if (!sawMoving.has(1)) expect(residents[1].group.position.toArray()).toEqual(original[1].toArray());
            previous = residents.map(resident => resident.group.position.clone());
        }
        expect([...sawMoving]).toEqual([0, 1]);
        expect(controller.active).toBe(false);
        for (const move of plan.moves) {
            const end = move.route.points[move.route.points.length - 1];
            expect(residents[move.index].group.position.toArray()).toEqual([end.x, residentGroundHeight(end, true), end.z]);
        }
        expect(controller.snapshot()).toMatchObject({ active: false, phase: 'settled', current: null, queue: [], completed: [0, 1], blocked: [] });
        expect(caption.mock.calls).toEqual([['すこし よけるね']]);
        expect(JSON.stringify(items)).toBe(savedItems);
        expect(residents[2].group.position.toArray()).toEqual(original[2].toArray());
    });

    it('leaves an ordinary resumed walk running when the saved layout needs no clearance', () => {
        const { residents, controller } = fixture(), actor = residents[0];
        actor.walkToPoint({ points: [{ x: -.5, z: 1.5 }, { x: -1.5, z: 1.5 }], yaw: -Math.PI / 2 }, 0, false, 6);
        actor.update(200);
        const before = actor.group.position.clone();
        expect(controller.start([], 6, 200, false)).toBe(false);
        expect(actor.action).toBe('walk');
        expect(actor.group.position.toArray()).toEqual(before.toArray());
        actor.update(400);
        expect(actor.group.position.distanceTo(before)).toBeGreaterThan(0);
        expect(controller.snapshot()).toBeNull();
    });

    it('keeps a legitimate user on their own seat', () => {
        const { residents, controller } = fixture();
        const seat: IslandStageItem = { id: 'own-bench', kind: 'bench', position: { x: -.5, z: 1.5 }, rotation: 0 };
        residents[1].group.position.set(2.5, 0, .5);
        expect(residents[0].visit(seat, 0, true, [seat], 6)).toBe(true);
        const before = residents[0].group.position.toArray();
        expect(controller.start([seat], 6, 100, false)).toBe(false);
        expect(residents[0].action).toBe('sit');
        expect(residents[0].itemId).toBe(seat.id);
        expect(residents[0].group.position.toArray()).toEqual(before);
    });

    it('cancels at the current ground point, clears future moves, and leaves unrelated walks alone', () => {
        const { residents, items, controller } = fixture();
        controller.start(items, 6, 0, false);
        residents[0].update(300);
        const stopped = residents[0].group.position.clone(), waiting = residents[1].group.position.clone();
        residents[2].walkToPoint({ points: [{ x: 6.25, z: .8 }, { x: 6.8, z: .8 }], yaw: Math.PI / 2 }, 300, false, 6);
        controller.cancel(300);
        expect(controller.snapshot()).toBeNull(); expect(controller.active).toBe(false);
        expect(residents[0].action).not.toBe('walk'); expect(residents[2].action).toBe('walk');
        for (let now = 350; now <= 3000; now += 50) { residents.forEach(resident => resident.update(now)); controller.update(now, false); }
        expect(residents[0].group.position.toArray()).toEqual(stopped.toArray());
        expect(residents[1].group.position.toArray()).toEqual(waiting.toArray());
        expect(residents[2].group.position.x).toBe(6.8);
    });

    it.each([false, true])('completes the same routes in order under reduced motion, toggled during walk: %s', toggleDuringWalk => {
        const { residents, items, controller } = fixture(), plan = planFor(residents, items), order: number[] = [];
        residents.forEach((resident, index) => {
            const walk = resident.walkToPoint.bind(resident);
            vi.spyOn(resident, 'walkToPoint').mockImplementation((...args) => { order.push(index); return walk(...args); });
        });
        const active = controller.start(items, 6, 0, !toggleDuringWalk);
        if (toggleDuringWalk) {
            expect(active).toBe(true);
            residents[0].update(200);
            expect(controller.update(200, true)).toBe(false);
        } else expect(active).toBe(false);
        expect(order).toEqual(plan.moves.map(move => move.index));
        expect(controller.active).toBe(false);
        for (const move of plan.moves) {
            const end = move.route.points[move.route.points.length - 1];
            expect(residents[move.index].group.position.toArray()).toEqual([end.x, residentGroundHeight(end, true), end.z]);
        }
        expect(controller.snapshot()).toMatchObject({ reduced: true, completed: [0, 1], current: null, queue: [] });
    });

    it('reports a blocked layout without moving anyone or repeatedly issuing captions', () => {
        const { residents, controller, caption } = fixture();
        residents[0].group.position.set(0, 0, 1.5); residents[1].group.position.set(.3, 0, 1.5); residents[2].group.visible = false;
        const items: IslandStageItem[] = [{ id: 'flower', kind: 'flower', position: { x: 0, z: 1.5 }, rotation: 0 }];
        const before = residents.map(resident => resident.group.position.toArray());
        expect(controller.start(items, 0, 0, false)).toBe(false);
        expect(controller.blocked).toEqual([0, 1]);
        const count = caption.mock.calls.length;
        for (let time = 0; time <= 1000; time += 50) controller.update(time, false);
        expect(caption.mock.calls.length).toBe(count);
        expect(residents.map(resident => resident.group.position.toArray())).toEqual(before);
        expect(controller.snapshot()).toMatchObject({ active: false, phase: 'blocked', current: null, queue: [], blocked: [0, 1] });
        controller.blocked.splice(0);
        expect(controller.blocked).toEqual([0, 1]);
    });

    it('contains the whole current bodies and every future route before the second resident starts', () => {
        const { residents, controller } = fixture();
        // The navigation suite validates routes. This controller-boundary fixture
        // exposes the future long route, including the bridge, before walkToPoint
        // has given that path to the second actor's own learning-frame method.
        const plan: clearance.FurnitureClearancePlan = { blocked: [], moves: [
            { index: 0, route: { points: [{ x: -.5, z: 1.5 }, { x: -1.5, z: 1.5 }], yaw: -Math.PI / 2 } },
            { index: 1, route: { points: [{ x: .5, z: 1.5 }, { x: 3.8, z: 0 }, { x: 4.7, z: 0 }, { x: 5.5, z: 0 }, { x: 6.5, z: -.6 }], yaw: 0 } },
        ] };
        vi.spyOn(clearance, 'planFurnitureClearance').mockImplementation(() => structuredClone(plan));
        controller.start([], 6, 0, false);
        expect(residents[1].action).toBe('idle');
        const frozen = controller.learningFrameBounds(), frozenCoordinates = frozen.map(bounds => [...bounds.min.toArray(), ...bounds.max.toArray()]);
        for (let now = 0; now <= 10000; now += 40) {
            residents.forEach(resident => resident.update(now));
            controller.update(now, false);
            for (const resident of residents) {
                const actual = new THREE.Box3().setFromObject(resident.group, true);
                expect(frozen.some(bounds => bounds.containsBox(actual)), `${resident.species} escapes the frozen learning envelope at ${now}`).toBe(true);
            }
        }
        expect(controller.active).toBe(false);
        expect(frozen.map(bounds => [...bounds.min.toArray(), ...bounds.max.toArray()])).toEqual(frozenCoordinates);
        expect(residents[1].group.position.toArray()).toEqual([6.5, 0, -.6]);
    });

    it('stops the queue when its current actor was externally interrupted away from the planned arrival', () => {
        const { residents, items, controller } = fixture();
        controller.start(items, 6, 0, false);
        residents[0].update(150); residents[0].stopWalking(150);
        const first = residents[0].group.position.toArray(), second = residents[1].group.position.toArray();
        expect(controller.update(150, false)).toBe(false);
        expect(controller.blocked).toContain(0);
        expect(controller.snapshot()?.queue.map(move => move.index)).toContain(1);
        for (let now = 200; now <= 3000; now += 50) { residents.forEach(resident => resident.update(now)); controller.update(now, false); }
        expect(residents[0].group.position.toArray()).toEqual(first);
        expect(residents[1].group.position.toArray()).toEqual(second);
    });
});
