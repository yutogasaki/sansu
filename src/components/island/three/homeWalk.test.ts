import { describe, expect, it } from 'vitest';
import { clearHomeSegment, HOME_WALK_START, isHomeFloorWalkable, planHomeWalk } from './homeWalk';
import { HomeResident } from './homeResident';
import * as THREE from 'three';

describe('indoor walking', () => {
    it('routes around the table without crossing furniture or walls', () => {
        const end = { x: .55, z: 3.65 }, path = planHomeWalk(HOME_WALK_START, end)!;
        expect(path.length).toBeGreaterThan(2);
        expect(path.at(-1)).toEqual(end);
        for (let i = 1; i < path.length; i++) expect(clearHomeSegment(path[i - 1], path[i])).toBe(true);
        for (const point of [{ x: -2, z: 2 }, { x: .55, z: 2.52 }, { x: 4, z: 1 }, { x: NaN, z: 1 }]) {
            expect(isHomeFloorWalkable(point)).toBe(false); expect(planHomeWalk(HOME_WALK_START, point)).toBeUndefined();
        }
    });
    it('moves the actual rig, accepts a new destination mid-walk and releases on exit', () => {
        const resident = new HomeResident(), room = new THREE.Group(); resident.show(room);
        expect(resident.walkTo({ x: 1.8, z: 1.1 }, 0, false)).toBe(true);
        resident.update(50); expect(resident.describe().position![0]).toBeGreaterThan(HOME_WALK_START.x);
        expect(resident.walkTo(HOME_WALK_START, 50, false)).toBe(true);
        for (let now = 100; now < 3000; now += 50) resident.update(now);
        expect(resident.moving).toBe(false); expect(resident.describe().position![0]).toBeCloseTo(HOME_WALK_START.x);
        resident.hide(); expect(resident.group.children).toHaveLength(0); expect(resident.describe().visible).toBe(false);
    });
    it('moves directly to a valid destination in reduced motion without an idle loop', () => {
        const resident = new HomeResident(); resident.show(new THREE.Group());
        expect(resident.walkTo({ x: 1.8, z: 1.1 }, 0, true)).toBe(true);
        expect(resident.describe().position).toEqual([1.8, .035, 1.1]); expect(resident.update(100)).toBe(false); resident.hide();
    });
});
