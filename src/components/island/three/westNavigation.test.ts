import { describe, expect, it } from 'vitest';
import { ISLAND_RESERVED_AREAS } from '../../../domain/island/catalog';
import { findSafeResidentSpawn, planResidentPointRoute, planResidentRoute, residentGroundHeight,
    residentGroundIsSafe, residentObstacles, residentPointIsClear, type ResidentRoute } from './navigation';
import type { IslandStageItem } from './types';

const seat: IslandStageItem = { id: 'west-seat', kind: 'mushroom', rotation: 0, position: { x: -6.2, z: .8 } };

function inspect(route: ResidentRoute | undefined, items: IslandStageItem[], targetId = '') {
    expect(route).toBeDefined();
    const obstacles = residentObstacles(items, targetId);
    for (let index = 1; index < route!.points.length; index++) {
        const from = route!.points[index - 1], to = route!.points[index];
        const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / .025);
        for (let step = 0; step <= steps; step++) {
            const t = steps ? step / steps : 0;
            const point = { x: from.x + (to.x - from.x) * t, z: from.z + (to.z - from.z) * t };
            expect(residentPointIsClear(point, 12, obstacles), JSON.stringify(point)).toBe(true);
        }
    }
    return route!;
}

describe('western island growth and physical routes', () => {
    it('opens the western shore at the saved twelfth section, keeping legacy boolean callers eastern-only', () => {
        expect(residentGroundIsSafe({ x: -6.2, z: 0 }, 11)).toBe(false);
        expect(residentGroundIsSafe({ x: -6.2, z: 0 }, true)).toBe(false);
        expect(residentGroundIsSafe({ x: -6.2, z: 0 }, 12)).toBe(true);
        expect(residentGroundIsSafe({ x: -4.75, z: 0 }, 12)).toBe(true);
        expect(residentGroundIsSafe({ x: -4.55, z: .1 }, 12)).toBe(false);
        expect(residentGroundIsSafe({ x: -8.5, z: 0 }, 12)).toBe(false);
        expect(residentGroundIsSafe({ x: 6.2, z: 0 }, true)).toBe(true);
    });

    it('walks across the western bridge to a real seat without crossing scenery', () => {
        const before = structuredClone(seat);
        expect(planResidentRoute({ x: 0, z: 1 }, seat, [seat], 11)).toBeUndefined();
        const route = inspect(planResidentRoute({ x: 0, z: 1 }, seat, [seat], 12), [seat], seat.id);
        expect(route.points).toContainEqual({ x: -4.05, z: 0 });
        expect(route.points).toContainEqual({ x: -5.5, z: 0 });
        expect(route.points.at(-1)).toEqual(seat.position);
        expect(seat).toEqual(before);
    });

    it('crosses both bridges between east and west and refuses an occupied bridge', () => {
        const origin = { x: 6.2, z: .8 }, end = { x: -6.2, z: .8 };
        const route = inspect(planResidentPointRoute(origin, end, [], 12), []);
        for (const x of [5.5, 4.05, -4.05, -5.5]) expect(route.points).toContainEqual({ x, z: 0 });
        expect(planResidentPointRoute(origin, end, [], 12, { occupied: [{ x: -4.75, z: 0 }] })).toBeUndefined();
        expect(planResidentPointRoute(end, origin, [], 12, { occupied: [{ x: 4.75, z: 0 }] })).toBeUndefined();
    });

    it('uses the actual reflected deck height and keeps reserved bridges walkable', () => {
        for (const x of [4.05, 4.3, 4.72, 5.1, 5.38]) {
            expect(residentGroundHeight({ x: -x, z: 0 }, 12)).toBeCloseTo(residentGroundHeight({ x, z: 0 }, 2));
            expect(residentGroundHeight({ x: -x, z: 0 }, 11)).toBe(0);
        }
        const obstacles = residentObstacles([], '');
        expect(obstacles).toContainEqual(ISLAND_RESERVED_AREAS[0]);
        expect(obstacles.some(item => Math.abs(item.x) === 4.75)).toBe(false);
    });

    it('restores a blocked western resident on the same land without moving possessions', () => {
        const item: IslandStageItem = { id: 'flower', kind: 'flower', rotation: 0, position: { x: -6.2, z: 0 } };
        const before = structuredClone(item);
        expect(findSafeResidentSpawn(item.position!, [item], 11)).toBeUndefined();
        const point = findSafeResidentSpawn(item.position!, [item], 12);
        expect(point).toBeDefined();
        expect(point!.x).toBeLessThan(-4.6);
        expect(residentPointIsClear(point!, 12, residentObstacles([item], ''))).toBe(true);
        expect(item).toEqual(before);
    });
});
