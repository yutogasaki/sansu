import { describe, expect, it } from 'vitest';
import { createIsland, ISLAND_ITEMS, isValidIslandPlacement } from '../../../domain/island/catalog';
import { residentObstacles, residentPointIsClear, type GroundPoint, type ResidentRoute } from './navigation';
import { chooseSharedActivity, sharedActivityDeliveryPlans, type SharedActivityKind, type SharedActivityPlan, type SharedActivityReplayPreference, type SharedActivityResident } from './sharedActivities';
import type { IslandStageItem } from './types';

const kinds: Record<SharedActivityKind, [IslandStageItem['kind'], IslandStageItem['kind']]> = {
    flower: ['flower', 'bench'], star: ['lantern', 'mushroom'], bubble: ['fountain', 'swing'],
};
const residents = (): SharedActivityResident[] => [
    { position: { x: -2.5, z: 1.4 }, visible: true },
    { position: { x: 2.7, z: .3 }, visible: true },
    { position: { x: 6.4, z: .9 }, visible: true },
];
function furniture(kind: SharedActivityKind = 'flower'): IslandStageItem[] {
    return [
        { id: 'source', kind: kinds[kind][0], position: { x: 1.5, z: 1.8 }, rotation: 0 },
        { id: 'seat', kind: kinds[kind][1], position: { x: -.5, z: .7 }, rotation: Math.atan2(2, 1.1) },
    ];
}
const distance = (a: GroundPoint, b: GroundPoint) => Math.hypot(a.x - b.x, a.z - b.z);
const end = (route: ResidentRoute) => route.points[route.points.length - 1];
function inspectPath(route: ResidentRoute, items: IslandStageItem[], targetId: string,
    departingId: string | undefined, occupied: GroundPoint[]) {
    const obstacles = residentObstacles(items, targetId, departingId);
    for (let i = 1; i < route.points.length; i++) {
        const a = route.points[i - 1], b = route.points[i];
        for (let step = 0; step <= 100; step++) {
            const point = { x: a.x + (b.x - a.x) * step / 100, z: a.z + (b.z - a.z) * step / 100 };
            expect(residentPointIsClear(point, true, obstacles), `ground or furniture clipping at ${JSON.stringify(point)}`).toBe(true);
            for (const other of occupied) expect(distance(point, other), `resident clipping at ${JSON.stringify(point)}`).toBeGreaterThanOrEqual(.84 - 1e-9);
        }
    }
}
function inspectPlan(plan: SharedActivityPlan, items: IslandStageItem[], actors: SharedActivityResident[]) {
    expect(plan.receiver).not.toBe(plan.carrier);
    expect(actors[plan.receiver].visible).toBe(true);
    expect(actors[plan.carrier].visible).toBe(true);
    const third = actors.filter((actor, index) => actor.visible && index !== plan.receiver && index !== plan.carrier)
        .map(actor => actor.position);
    inspectPath(plan.receiverRoute, items, plan.seat.id, actors[plan.receiver].itemId, [actors[plan.carrier].position, ...third]);
    expect(plan.receiverRoute.points[0]).toEqual(actors[plan.receiver].position);
    expect(end(plan.receiverRoute)).toEqual(plan.seat.position);
    const occupied = [end(plan.receiverRoute), ...third];
    inspectPath(plan.gatherRoute, items, plan.source.id, actors[plan.carrier].itemId, occupied);
    expect(plan.gatherRoute.points[0]).toEqual(actors[plan.carrier].position);
    inspectPath(plan.deliveryRoute, items, '', plan.source.id, occupied);
    expect(plan.deliveryRoute.points[0]).toEqual(end(plan.gatherRoute));
    expect(end(plan.deliveryRoute)).toEqual(plan.handoffPoint);
    expect(residentPointIsClear(plan.handoffPoint, true, residentObstacles(items, ''))).toBe(true);
    expect(distance(plan.handoffPoint, plan.seat.position!)).toBeCloseTo(ISLAND_ITEMS[plan.seat.kind].radius + .54);
    const towardReceiver = Math.atan2(plan.seat.position!.x - plan.handoffPoint.x, plan.seat.position!.z - plan.handoffPoint.z);
    expect(plan.deliveryRoute.yaw).toBeCloseTo(towardReceiver);
}

function settledReplay(kind: SharedActivityKind = 'flower') {
    // The 993 phone flower episode left the carrier beside the seated rabbit
    // and the third resident on the unlocked island. Replay must start there.
    const items: IslandStageItem[] = [
        { id: 'source', kind: kinds[kind][0], position: { x: 1.5, z: 1.75 }, rotation: 0 },
        { id: 'seat', kind: kinds[kind][1], position: { x: -.5, z: .75 }, rotation: Math.PI / 2 },
    ];
    const actors: SharedActivityResident[] = [
        { position: { x: 1.5, z: 2.52 }, visible: true, itemId: 'source' },
        { position: { x: -.5, z: .75 }, visible: true, itemId: 'seat' },
        { position: { x: 6.26, z: .83 }, visible: true },
    ];
    const previous = chooseSharedActivity(items, actors, 6, 'source')!;
    expect(previous).toBeDefined(); expect(previous.carrier).toBe(0); expect(previous.receiver).toBe(1);
    actors[previous.carrier] = { position: { ...previous.handoffPoint }, visible: true };
    actors[previous.receiver].position = { ...end(previous.receiverRoute) };
    return { items, actors, previous };
}

describe('two residents share a saved furniture combination', () => {
    it.each<SharedActivityKind>(['flower', 'star', 'bubble'])('replays settled %s with the same visible roles and newly preflighted routes', kind => {
        const { items, actors, previous } = settledReplay(kind);
        const before = JSON.stringify({ items, actors, previous });
        for (const selectedId of ['source', 'seat']) {
            const replay = chooseSharedActivity(items, actors, 6, selectedId, previous.carrier, previous)!;
            expect(replay).toBeDefined(); expect(replay.carrier).toBe(previous.carrier); expect(replay.receiver).toBe(previous.receiver);
            expect(replay.selectedItemId).toBe(selectedId);
            expect(replay.gatherRoute.points[0]).toEqual(previous.handoffPoint);
            expect(replay.gatherRoute.points).not.toEqual(previous.gatherRoute.points);
            for (const route of ['receiverRoute', 'gatherRoute', 'deliveryRoute'] as const) {
                expect(replay[route]).not.toBe(previous[route]);
                expect(replay[route].points).not.toBe(previous[route].points);
            }
            expect(replay.handoffPoint).not.toBe(previous.handoffPoint);
            for (const candidate of sharedActivityDeliveryPlans(replay, items, actors, 6)) inspectPlan(candidate, items, actors);
            expect(chooseSharedActivity([...items].reverse(), actors, 6, selectedId, previous.carrier, previous)).toEqual(replay);
        }
        expect(JSON.stringify({ items, actors, previous })).toBe(before);
    });

    it('does not leave the prior 993 carrier as a third resident blocking its own replay', () => {
        const { items, actors, previous } = settledReplay();
        expect(previous.handoffPoint.x).toBeCloseTo(.47479093270390016);
        expect(previous.handoffPoint.z).toBeCloseTo(1.432555959257745);
        const ordinary = chooseSharedActivity(items, actors, 6, 'seat', previous.carrier)!;
        expect(ordinary.carrier).toBe(2); expect(ordinary.receiver).toBe(1);
        expect(sharedActivityDeliveryPlans(ordinary, items, actors, 6)).toHaveLength(1);
        const replay = chooseSharedActivity(items, actors, 6, 'seat', previous.carrier, previous)!;
        expect(replay.carrier).toBe(0); expect(replay.receiver).toBe(1);
        expect(sharedActivityDeliveryPlans(replay, items, actors, 6)).toHaveLength(3);
    });

    it('rejects mismatched saved IDs, kinds, positions and rotations before applying the replay preference', () => {
        const { items, actors, previous } = settledReplay();
        const ordinary = chooseSharedActivity(items, actors, 6, 'seat', previous.carrier);
        const mismatches: SharedActivityReplayPreference[] = [
            { ...previous, kind: 'star' },
            ...(['source', 'seat'] as const).flatMap(side => [
                { ...previous, [side]: { ...previous[side], id: `other-${side}` } },
                { ...previous, [side]: { ...previous[side], kind: side === 'source' ? 'lantern' as const : 'mushroom' as const } },
                { ...previous, [side]: { ...previous[side], position: undefined } },
                { ...previous, [side]: { ...previous[side], position: { ...previous[side].position!, x: previous[side].position!.x + .01 } } },
                { ...previous, [side]: { ...previous[side], position: { ...previous[side].position!, z: previous[side].position!.z + .01 } } },
                { ...previous, [side]: { ...previous[side], rotation: previous[side].rotation + .01 } },
            ]),
        ];
        expect(ordinary?.carrier).toBe(2);
        for (const mismatch of mismatches) expect(chooseSharedActivity(items, actors, 6, 'seat', previous.carrier, mismatch)).toEqual(ordinary);
    });

    it('uses ordinary roles when the previous roles are hidden, invalid, or no longer physically reachable', () => {
        const { items, actors, previous } = settledReplay();
        for (const role of ['carrier', 'receiver'] as const) for (const invalid of [-1, 1.5, 99, previous[role === 'carrier' ? 'receiver' : 'carrier']]) {
            expect(chooseSharedActivity(items, actors, 6, 'seat', 0, { ...previous, [role]: invalid }))
                .toEqual(chooseSharedActivity(items, actors, 6, 'seat', 0));
        }
        const hidden = actors.map((actor, index) => ({ ...actor, visible: index !== previous.carrier }));
        expect(chooseSharedActivity(items, hidden, 6, 'seat', 0, previous)).toEqual(chooseSharedActivity(items, hidden, 6, 'seat', 0));
        const blocked = [...items, { id: 'cover', kind: 'fountain' as const, position: { ...actors[0].position }, rotation: 0 }];
        const fallback = chooseSharedActivity(blocked, actors, 6, 'seat', 0, previous)!;
        expect(fallback).toBeDefined(); expect(fallback.carrier).toBe(2); expect(fallback.receiver).toBe(1);
        expect(fallback).toEqual(chooseSharedActivity(blocked, actors, 6, 'seat', 0));
        inspectPlan(fallback, blocked, actors);
    });

    it('does not prefer the old roles when selecting a different matching furniture item', () => {
        const { items, actors, previous } = settledReplay();
        const changed: IslandStageItem[] = [...items, { id: 'other-seat', kind: 'bench', position: { x: 2.75, z: 1 }, rotation: -Math.PI / 2 }];
        const ordinary = chooseSharedActivity(changed, actors, 6, 'other-seat', 0);
        expect(ordinary).toBeDefined();
        expect(chooseSharedActivity(changed, actors, 6, 'other-seat', 0, previous)).toEqual(ordinary);
    });

    it('preflights the remaining cdc5 handoff routes without changing the selected actors or initial routes', () => {
        const items: IslandStageItem[] = [
            { id: 'source', kind: 'lantern', position: { x: 1.5, z: 1.75 }, rotation: 0 },
            { id: 'seat', kind: 'mushroom', position: { x: -.5, z: .75 }, rotation: Math.PI / 2 },
        ];
        const actors: SharedActivityResident[] = [
            { position: { x: .5, z: 2.25 }, visible: true },
            { position: { x: 1.5, z: 2.52 }, visible: true, itemId: 'source' },
            { position: { x: -.5, z: .75 }, visible: true, itemId: 'seat' },
        ];
        const current = chooseSharedActivity(items, actors, 6, 'source')!;
        expect(current.carrier).toBe(1); expect(current.receiver).toBe(2);
        const before = JSON.stringify({ current, items, actors });
        const plans = sharedActivityDeliveryPlans(current, items, actors, 6);
        expect(plans).toHaveLength(3); expect(plans[0]).toBe(current);
        expect(plans[0].handoffPoint.z).toBeCloseTo(1.4038771374401926);
        expect(plans[1].handoffPoint).toEqual({ x: .6400000000000001, z: .7500000000000001 });
        expect(plans[2].handoffPoint.z).toBeCloseTo(.09612286255980729);
        expect(plans[1].deliveryRoute.points).toEqual([{ x: 1.5, z: 2.52 }, { x: 1.25, z: 1.75 }, plans[1].handoffPoint]);
        for (const plan of plans) {
            expect(plan.receiver).toBe(current.receiver); expect(plan.carrier).toBe(current.carrier);
            expect(plan.pairId).toBe(current.pairId); expect(plan.selectedItemId).toBe(current.selectedItemId);
            expect(plan.source).toBe(current.source); expect(plan.seat).toBe(current.seat);
            expect(plan.receiverRoute).toBe(current.receiverRoute); expect(plan.gatherRoute).toBe(current.gatherRoute);
            inspectPlan(plan, items, actors);
        }
        expect(sharedActivityDeliveryPlans(current, [...items].reverse(), actors, 6)).toEqual(plans);
        expect(JSON.stringify({ current, items, actors })).toBe(before);

        // One visible resident blocks both remaining destinations. A hidden
        // resident at the same point must not become a physical obstacle.
        const obstructed = actors.map((actor, index) => index === 0 ? { ...actor, position: { x: .3, z: .1 } } : actor);
        expect(sharedActivityDeliveryPlans(current, items, obstructed, 6)).toEqual([current]);
        obstructed[0].visible = false;
        expect(sharedActivityDeliveryPlans(current, items, obstructed, 6)).toHaveLength(3);
    });

    it.each<SharedActivityKind>(['flower', 'star', 'bubble'])('preflights three physical routes for %s from either selected item', kind => {
        const items = furniture(kind), actors = residents();
        const island = { ...createIsland('test', 0), completedSets: 6, items };
        expect(items.every(item => isValidIslandPlacement(island, item.id, item.position!, item.rotation))).toBe(true);
        for (const selected of items) {
            const plan = chooseSharedActivity(items, actors, 6, selected.id);
            expect(plan).toBeDefined();
            expect(plan!.kind).toBe(kind);
            expect(plan!.selectedItemId).toBe(selected.id);
            inspectPlan(plan!, items, actors);
        }
    });

    it('rejects far, wrong-facing, stored, missing, and unrelated clicked furniture', () => {
        const actors = residents(), items = furniture();
        expect(chooseSharedActivity([{ ...items[0], position: { x: 3, z: 1.8 } }, items[1]], actors, 6, 'seat')).toBeUndefined();
        expect(chooseSharedActivity([items[0], { ...items[1], rotation: items[1].rotation + Math.PI }], actors, 6, 'source')).toBeUndefined();
        for (const stored of [0, 1]) expect(chooseSharedActivity(items.map((item, index) => index === stored ? { ...item, position: undefined } : item), actors, 6, 'seat')).toBeUndefined();
        expect(chooseSharedActivity(items, actors, 6, 'missing')).toBeUndefined();
        expect(chooseSharedActivity([...items, { id: 'unrelated', kind: 'fountain', position: { x: -2, z: 1 }, rotation: 0 }], actors, 6, 'unrelated')).toBeUndefined();
    });

    it('uses the specified distance boundary and rejects a facing direction outside the sixty-degree cone', () => {
        const actors = residents(), items: IslandStageItem[] = [
            { id: 'source', kind: 'flower', position: { x: 1.9, z: .7 }, rotation: 0 },
            { id: 'seat', kind: 'bench', position: { x: -.5, z: .7 }, rotation: Math.PI / 2 },
        ];
        expect(chooseSharedActivity(items, actors, 6, 'source')).toBeDefined();
        expect(chooseSharedActivity([{ ...items[0], position: { x: 1.90001, z: .7 } }, items[1]], actors, 6, 'source')).toBeUndefined();
        const outsideCone = { ...items[1], rotation: Math.PI / 6 - .00001 };
        expect(chooseSharedActivity([items[0], outsideCone], actors, 6, 'source')).toBeUndefined();
    });

    it('keeps a seated occupant as receiver ahead of round-robin order', () => {
        const items = furniture(), actors = residents();
        actors[1] = { visible: true, position: { ...items[1].position! }, itemId: 'seat' };
        const plan = chooseSharedActivity(items, actors, 6, 'source', 1)!;
        expect(plan).toBeDefined(); expect(plan.receiver).toBe(1); expect(plan.carrier).toBe(2);
        inspectPlan(plan, items, actors);
    });

    it('prefers the source occupant as carrier without sharing a body or ignoring the third resident', () => {
        const items = furniture('star'), actors = residents();
        actors[1] = { visible: true, position: { x: items[0].position!.x, z: items[0].position!.z + .77 }, itemId: 'source' };
        const plan = chooseSharedActivity(items, actors, 6, 'seat', 1)!;
        expect(plan).toBeDefined(); expect(plan.carrier).toBe(1); expect(plan.receiver).toBe(2);
        inspectPlan(plan, items, actors);
    });

    it('keeps the source occupant carrying even when their ordinary turn would make them receiver', () => {
        const items = furniture('star'), actors = residents();
        actors[0] = { visible: true, position: { x: items[0].position!.x, z: items[0].position!.z + .77 }, itemId: 'source' };
        const plan = chooseSharedActivity(items, actors, 6, 'seat')!;
        expect(plan).toBeDefined(); expect(plan.carrier).toBe(0); expect(plan.receiver).toBe(1);
        inspectPlan(plan, items, actors);
    });

    it('uses the same round-robin turn including the visible fox, and never selects a hidden resident', () => {
        const items = furniture(), actors = residents();
        expect(chooseSharedActivity(items, actors, 6, 'source', 1)?.receiver).toBe(2);
        actors[2].visible = false;
        const withoutFox = chooseSharedActivity(items, actors, 2, 'source', 1)!;
        expect(withoutFox).toBeDefined(); expect(withoutFox.receiver).toBe(0); expect(withoutFox.carrier).toBe(1);
        actors[1].visible = false;
        expect(chooseSharedActivity(items, actors, 2, 'source')).toBeUndefined();
        expect(chooseSharedActivity(items, [], 2, 'source')).toBeUndefined();
    });

    it('returns no shared plan when only one side of the locked island is reachable', () => {
        const items: IslandStageItem[] = [
            { id: 'source', kind: 'flower', position: { x: 7.1, z: .8 }, rotation: 0 },
            { id: 'seat', kind: 'bench', position: { x: 5.7, z: .85 }, rotation: Math.PI / 2 },
        ];
        expect(chooseSharedActivity(items, residents().slice(0, 2), 0, 'seat')).toBeUndefined();
    });

    it('does not invent a delivery through a ring of obstacles', () => {
        const items = furniture(), actors = residents();
        // A deliberately saturated path boundary tests rejection; saved layout legality is covered above.
        const ring: IslandStageItem[] = Array.from({ length: 12 }, (_, index) => ({
            id: `wall-${index}`, kind: 'mushroom', rotation: 0,
            position: { x: items[1].position!.x + Math.cos(index * Math.PI / 6), z: items[1].position!.z + Math.sin(index * Math.PI / 6) },
        }));
        expect(chooseSharedActivity([...items, ...ring], actors, 6, 'source')).toBeUndefined();
    });

    it('chooses distance independently of item-array order and does not mutate any inputs', () => {
        const actors = residents(), layout: IslandStageItem[] = [
            { id: 'source', kind: 'flower', position: { x: 0, z: 1.8 }, rotation: 0 },
            { id: 'seat-a', kind: 'bench', position: { x: -1.5, z: .4 }, rotation: Math.atan2(1.5, 1.4) },
            { id: 'seat-b', kind: 'bench', position: { x: 1.5, z: .75 }, rotation: Math.atan2(-1.5, 1.05) },
        ];
        const island = { ...createIsland('test', 0), completedSets: 6, items: layout };
        expect(layout.every(item => isValidIslandPlacement(island, item.id, item.position!, item.rotation))).toBe(true);
        const before = JSON.stringify({ layout, actors });
        const plan = chooseSharedActivity(layout, actors, 6, 'source');
        expect(plan).toBeDefined(); expect(plan!.seat.id).toBe('seat-b');
        expect(chooseSharedActivity([...layout].reverse(), actors, 6, 'source')).toEqual(plan);
        inspectPlan(plan!, layout, actors);
        expect(JSON.stringify({ layout, actors })).toBe(before);
    });

    it('breaks equally near partner ties by stable IDs', () => {
        const actors = residents(), layout: IslandStageItem[] = [
            { id: 'source', kind: 'flower', position: { x: 0, z: 1.8 }, rotation: 0 },
            { id: 'seat-b', kind: 'bench', position: { x: -1.5, z: .6 }, rotation: Math.atan2(1.5, 1.2) },
            { id: 'seat-a', kind: 'bench', position: { x: 1.5, z: .6 }, rotation: Math.atan2(-1.5, 1.2) },
        ];
        const plan = chooseSharedActivity(layout, actors, 6, 'source');
        expect(plan).toBeDefined(); expect(plan!.seat.id).toBe('seat-a');
        expect(chooseSharedActivity([...layout].reverse(), actors, 6, 'source')).toEqual(plan);
    });

    it('tries a different pair of residents when the first round-robin actor cannot leave', () => {
        const actors = residents(), items = [...furniture(), {
            id: 'cover', kind: 'fountain' as const, position: { ...actors[0].position }, rotation: 0,
        }];
        const plan = chooseSharedActivity(items, actors, 6, 'source');
        expect(plan).toBeDefined(); expect(plan!.receiver).toBe(1); expect(plan!.carrier).toBe(2);
        inspectPlan(plan!, items, actors);
    });

    it('tries the next matching pair when the nearest legal seat has no safe handoff route', () => {
        const actors = residents(), items: IslandStageItem[] = [
            { id: 'source', kind: 'flower', position: { x: 1, z: 1 }, rotation: 0 },
            { id: 'near-seat', kind: 'bench', position: { x: 2.25, z: 1 }, rotation: -Math.PI / 2 },
            { id: 'far-seat', kind: 'bench', position: { x: -.7, z: 1 }, rotation: Math.PI / 2 },
            ...[[3.5, 1], [3, 2], [1.75, 2], [1.75, 0], [3, 0]].map(([x, z], index) => ({
                id: `ring-${index}`, kind: 'flower' as const, position: { x, z }, rotation: 0,
            })),
        ];
        actors[1].position = { x: -2, z: .45 };
        const island = { ...createIsland('test', 0), completedSets: 6, items };
        expect(items.every(item => isValidIslandPlacement(island, item.id, item.position!, item.rotation))).toBe(true);
        const plan = chooseSharedActivity(items, actors, 6, 'source');
        expect(plan).toBeDefined(); expect(plan!.seat.id).toBe('far-seat');
        inspectPlan(plan!, items, actors);
    });
});
