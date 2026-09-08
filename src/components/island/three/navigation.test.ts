import { describe, expect, it } from 'vitest';
import { ISLAND_RESERVED_AREAS } from '../../../domain/island/catalog';
import { planResidentPointRoute, planResidentRoute, residentGroundHeight, residentObstacles, residentPointIsClear, type ResidentRoute } from './navigation';
import type { IslandStageItem } from './types';

const bench = (x: number, z: number): IslandStageItem => ({ id: 'seat', kind: 'bench', position: { x, z }, rotation: 0 });
function inspectPath(route: ResidentRoute | undefined, target: IslandStageItem, expanded: boolean, items: IslandStageItem[] = [target]) {
    expect(route).toBeDefined();
    const obstacles = residentObstacles(items, target.id);
    for (let i = 1; i < route!.points.length; i++) {
        const a = route!.points[i - 1], b = route!.points[i];
        for (let step = 0; step <= 100; step++) {
            const point = { x: a.x + (b.x - a.x) * step / 100, z: a.z + (b.z - a.z) * step / 100 };
            expect(residentPointIsClear(point, expanded, obstacles), `Ground or obstacle clipping at ${JSON.stringify(point)}`).toBe(true);
        }
    }
    return route!;
}

describe('island resident physical routes', () => {
    it('routes around actual display footprints and rejects blocked or invalid extra obstacles', () => {
        const obstacle = { x: 0, z: 1.5, radius: .72 }, from = { x: -2, z: 1.5 }, to = { x: 2, z: 1.5 };
        const route = planResidentPointRoute(from, to, [], 0, { obstacles: [obstacle] });
        expect(route).toBeDefined();
        for (let i = 1; i < route!.points.length; i++) {
            const a = route!.points[i - 1], b = route!.points[i];
            for (let step = 0; step <= 100; step++) {
                const point = { x: a.x + (b.x - a.x) * step / 100, z: a.z + (b.z - a.z) * step / 100 };
                expect(residentPointIsClear(point, 0, [...residentObstacles([], ''), obstacle])).toBe(true);
            }
        }
        expect(planResidentPointRoute(from, obstacle, [], 0, { obstacles: [obstacle] })).toBeUndefined();
        expect(planResidentPointRoute(from, to, [], 0, { obstacles: [{ ...obstacle, radius: -1 }] })).toBeUndefined();
        expect(planResidentPointRoute(from, to, [], 0, { obstacles: [{ ...obstacle, x: NaN }] })).toBeUndefined();
    });
    it('routes around the full body of a stationary resident instead of crossing it', () => {
        const target = bench(1.75, 1.5), occupied = [{ x: 0, z: 1.5 }];
        const route = planResidentRoute({ x: -2, z: 1.5 }, target, [target], 0, undefined, { occupied });
        expect(route).toBeDefined(); expect(route!.points.length).toBeGreaterThan(2);
        for (let i = 1; i < route!.points.length; i++) {
            const a = route!.points[i - 1], b = route!.points[i];
            for (let step = 0; step <= 100; step++) {
                const point = { x: a.x + (b.x - a.x) * step / 100, z: a.z + (b.z - a.z) * step / 100 };
                expect(Math.hypot(point.x, point.z - 1.5)).toBeGreaterThanOrEqual(.84 - 1e-8);
            }
        }
        expect(occupied).toEqual([{ x: 0, z: 1.5 }]);
    });

    it('rejects an occupied arrival and a bridge blocked by a stationary resident', () => {
        const target = bench(6.25, .95), origin = { x: 0, z: 1 };
        expect(planResidentRoute(origin, target, [target], 2, undefined, { occupied: [target.position!] })).toBeUndefined();
        expect(planResidentPointRoute(origin, { x: 6.25, z: 1 }, [], 2, { occupied: [{ x: 4.75, z: 0 }] })).toBeUndefined();
    });

    it('walks to arbitrary safe handoff points with the same bridge and furniture boundaries', () => {
        const origin = { x: 0, z: 1.5 }, destination = { x: 6.25, z: 1 };
        const route = planResidentPointRoute(origin, destination, [], 2, { yaw: Math.PI / 2 });
        expect(route?.points[0]).toEqual(origin); expect(route?.points.at(-1)).toEqual(destination);
        expect(route?.points).toContainEqual({ x: 4.05, z: 0 }); expect(route?.points).toContainEqual({ x: 5.5, z: 0 });
        expect(route?.yaw).toBe(Math.PI / 2);
        expect(planResidentPointRoute(origin, destination, [], 0)).toBeUndefined();
        expect(planResidentPointRoute(origin, { x: 9, z: 3 }, [], 2)).toBeUndefined();
        expect(planResidentPointRoute(origin, { x: NaN, z: 1 }, [], 2)).toBeUndefined();
    });

    it('leaves a source approach but never stands inside that source or the other resident', () => {
        const source: IslandStageItem = { id: 'source', kind: 'flower', position: { x: 1.5, z: .8 }, rotation: 0 };
        const origin = { x: 1.5, z: .8 + .77 }, destination = { x: 0, z: 2.2 }, occupied = [{ x: 0, z: 1 }];
        const route = planResidentPointRoute(origin, destination, [source], 0, { departingId: source.id, occupied });
        expect(route).toBeDefined();
        expect(planResidentPointRoute(origin, source.position!, [source], 0, { departingId: source.id })).toBeUndefined();
        expect(planResidentPointRoute(origin, occupied[0], [source], 0, { departingId: source.id, occupied })).toBeUndefined();
    });

    it('crosses to east furniture along the actual bridge center in both directions', () => {
        const target = bench(6.25, .95);
        const route = inspectPath(planResidentRoute({ x: -.48, z: 1.52 }, target, [target], 2), target, true);
        expect(route.points).toContainEqual({ x: 4.05, z: 0 });
        expect(route.points).toContainEqual({ x: 5.5, z: 0 });
        const home = bench(-.5, 1.1);
        const returning = inspectPath(planResidentRoute(target.position!, home, [home], 2), home, true);
        expect(returning.points.findIndex(point => point.x === 5.5)).toBeLessThan(returning.points.findIndex(point => point.x === 4.05));
    });

    it('takes a clear route around the cottage instead of interpolating through its wall', () => {
        const target = bench(-.2, -2.2);
        const route = inspectPath(planResidentRoute({ x: -3.4, z: .1 }, target, [target], 0), target, false);
        expect(route.points.length).toBeGreaterThan(2);
    });

    it('keeps the full resident footprint on land when an edge flower faces the water', () => {
        for (const position of [{ x: 4.35, z: 0 }, { x: 0, z: 3.1 }, { x: -4.3, z: 0 }]) {
            const target: IslandStageItem = { id: 'flower', kind: 'flower', position, rotation: position.x > 0 ? Math.PI / 2 : position.x < 0 ? -Math.PI / 2 : 0 };
            const route = inspectPath(planResidentRoute({ x: .8, z: 1.6 }, target, [target], 0), target, false);
            const end = route.points[route.points.length - 1];
            expect((end.x / 4.38) ** 2 + (end.z / 3.18) ** 2).toBeLessThanOrEqual(1);
        }
    });

    it('does not use a direct line through the star-tree trunk or roots', () => {
        const target: IslandStageItem = { id: 'flower', kind: 'flower', position: { x: 3.2, z: -1.7 }, rotation: 0 };
        const route = inspectPath(planResidentRoute({ x: .3, z: -2.65 }, target, [target], 0), target, false);
        expect(route.points.length).toBeGreaterThan(2);
        const tree = ISLAND_RESERVED_AREAS[1];
        for (const point of route.points) expect(Math.hypot(point.x - tree.x, point.z - tree.z)).toBeGreaterThanOrEqual(tree.radius + .42);
    });

    it('can leave the furniture it occupied without treating its own seat as a wall', () => {
        const previous = { ...bench(-.5, 1.1), id: 'previous' }, target = bench(1.1, 1.8);
        const route = planResidentRoute(previous.position!, target, [previous, target], 0, previous.id);
        expect(route).toBeDefined();
        expect(route!.points[0]).toEqual(previous.position);
    });

    it('does not let a stale departure token exempt furniture that moved away from the origin', () => {
        const moved = bench(0, 1.5), origin = { x: -2, z: 1.5 }, destination = { x: 2, z: 1.5 };
        const route = planResidentPointRoute(origin, destination, [moved], 0, { departingId: moved.id });
        expect(route).toBeDefined(); expect(route!.points.length).toBeGreaterThan(2);
        const obstacles = residentObstacles([moved], '');
        for (let i = 1; i < route!.points.length; i++) {
            const a = route!.points[i - 1], b = route!.points[i];
            for (let step = 0; step <= 100; step++) expect(residentPointIsClear({
                x: a.x + (b.x - a.x) * step / 100, z: a.z + (b.z - a.z) * step / 100,
            }, false, obstacles)).toBe(true);
        }
    });

    it('can leave multiple actual furniture overlaps while keeping every arrival and stale ID solid', () => {
        const origin = { x: 0, z: 1.5 }, destination = { x: 0, z: 2.75 };
        const items: IslandStageItem[] = [
            { id: 'left', kind: 'flower', position: { x: -.4, z: 1.5 }, rotation: 0 },
            { id: 'right', kind: 'flower', position: { x: .4, z: 1.5 }, rotation: 0 },
            { id: 'moved', kind: 'flower', position: { x: 2, z: 1.5 }, rotation: 0 },
        ];
        expect(planResidentPointRoute(origin, destination, items, 0, { departingId: 'left' })).toBeUndefined();
        const options = { departingIds: ['left', 'right', 'moved', 'removed'], occupied: [{ x: -2, z: 1.5 }] };
        const route = planResidentPointRoute(origin, destination, items, 0, options)!;
        expect(route).toBeDefined(); expect(route.points[0]).toEqual(origin); expect(route.points.at(-1)).toEqual(destination);
        expect(planResidentPointRoute(origin, items[0].position!, items, 0, options)).toBeUndefined();
        expect(planResidentPointRoute(origin, options.occupied[0], items, 0, options)).toBeUndefined();
        const across = planResidentPointRoute(origin, { x: 3.25, z: 1.5 }, items, 0, options)!;
        expect(across).toBeDefined(); expect(across.points.length).toBeGreaterThan(2);
        inspectPath(across, items[0], false, [items[2]]);
        const east = planResidentPointRoute(origin, { x: 6.25, z: 1 }, items, 2, options)!;
        expect(east).toBeDefined(); expect(east.points).toContainEqual({ x: 4.05, z: 0 }); expect(east.points).toContainEqual({ x: 5.5, z: 0 });
        inspectPath(east, items[0], true, [items[2]]);
        expect(planResidentPointRoute(origin, { x: 6.25, z: 1 }, items, 2, { ...options, occupied: [{ x: 4.75, z: 0 }] })).toBeUndefined();
    });

    it('arrives clear of the departed bench so a later furniture visit remains reachable', () => {
        const previous = bench(.25, .5);
        const lamp: IslandStageItem = { id: 'lamp', kind: 'lantern', position: { x: -1, z: .25 }, rotation: Math.PI / 2 };
        const next: IslandStageItem = { id: 'mushroom', kind: 'mushroom', position: { x: -2, z: 1 }, rotation: 0 };
        const items = [previous, lamp, next];
        const visiting = planResidentRoute(previous.position!, lamp, items, 0, previous.id);
        expect(visiting).toBeDefined();
        const arrival = visiting!.points.at(-1)!;
        // The departure exception must not let the new resting pose occupy the old seat.
        expect(residentPointIsClear(arrival, false, residentObstacles(items, lamp.id))).toBe(true);
        const following = planResidentRoute(arrival, next, items, 0, lamp.id);
        expect(following).toBeDefined();
        expect(following!.points[0]).toEqual(arrival);
        expect(following!.points.at(-1)).toEqual(next.position);
    });

    it('still restores the same seat after cancelling a placement preview', () => {
        const seat = bench(.25, .5);
        const route = planResidentRoute(seat.position!, seat, [seat], 0, seat.id);
        expect(route).toBeDefined();
        expect(route!.points[0]).toEqual(seat.position);
        expect(route!.points.at(-1)).toEqual(seat.position);
        expect(route!.yaw).toBe(seat.rotation);
    });

    it('cannot visit an island that has not been unlocked', () => {
        const target = bench(6.25, .95);
        expect(planResidentRoute({ x: 0, z: 1 }, target, [target], 0)).toBeUndefined();
    });

    it('does not tunnel out when another moved object covers the standing origin', () => {
        const target = bench(1, 1.5);
        const covering: IslandStageItem = { id: 'cover', kind: 'flower', position: { x: -1, z: 1.5 }, rotation: 0 };
        expect(planResidentRoute(covering.position!, target, [covering, target], 0)).toBeUndefined();
        expect(planResidentRoute(covering.position!, target, [covering, target], 0, covering.id)).toBeDefined();
    });

    it('puts feet on the raised wooden deck rather than underneath it', () => {
        expect(residentGroundHeight({ x: 4.72, z: 0 }, true)).toBeCloseTo(.34);
        expect(residentGroundHeight({ x: 4.05, z: 0 }, true)).toBeGreaterThan(.19);
        expect(residentGroundHeight({ x: 3, z: 0 }, true)).toBe(0);
        expect(residentGroundHeight({ x: 4.72, z: 0 }, false)).toBe(0);
    });

    it('does not fabricate a walk through blocked furniture', () => {
        const target: IslandStageItem = { id: 'flower', kind: 'flower', position: { x: 0, z: 1 }, rotation: 0 };
        const surrounding: IslandStageItem[] = Array.from({ length: 12 }, (_, i) => ({
            id: `barrier-${i}`, kind: 'bench', position: { x: Math.cos(i * Math.PI / 6) * .8, z: 1 + Math.sin(i * Math.PI / 6) * .8 }, rotation: 0,
        }));
        expect(planResidentRoute({ x: -2, z: 2 }, target, [...surrounding, target], 0)).toBeUndefined();
    });
});
