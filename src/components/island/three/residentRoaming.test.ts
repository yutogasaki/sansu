import { describe, expect, it } from 'vitest';
import { planResidentPointRoute, planResidentRoute, residentObstacles, residentPointIsClear } from './navigation';
import { planResidentRoam } from './residentRoaming';
import type { IslandStageItem } from './types';

const bench = (id: string, x: number, z: number): IslandStageItem => ({ id, kind: 'bench', position: { x, z }, rotation: 0 });

describe('resident autonomous roaming', () => {
    it('keeps furniture use physically blocked while giving a trapped walker a soft escape route', () => {
        const target = { x: 0, z: 1 }, surrounding = Array.from({ length: 12 }, (_, index) => bench(`barrier-${index}`,
            Math.cos(index * Math.PI / 6) * .8, 1 + Math.sin(index * Math.PI / 6) * .8));
        expect(planResidentRoute({ x: -2, z: 2 }, { id: 'target', kind: 'flower', position: target, rotation: 0 },
            [...surrounding, { id: 'target', kind: 'flower', position: target, rotation: 0 }], 0)).toBeUndefined();
        const route = planResidentPointRoute({ x: 0, z: 1 }, { x: -2, z: 2 }, surrounding, 0, { navigation: 'roam' });
        expect(route?.points[0]).toEqual({ x: 0, z: 1 });
        expect(route?.points.at(-1)).toEqual({ x: -2, z: 2 });
    });

    it('rotates destinations deterministically inside the focused district', () => {
        const first = planResidentRoam({ x: 0, z: 1.5 }, 0, 0, [], 0, { district: 'home' });
        const same = planResidentRoam({ x: 0, z: 1.5 }, 0, 0, [], 0, { district: 'home' });
        const next = planResidentRoam({ x: 0, z: 1.5 }, 0, 1, [], 0, { district: 'home' });
        expect(first).toEqual(same);
        expect(first).toBeDefined();
        expect(next).toBeDefined();
        expect(first?.target.x).toBeGreaterThan(-4.8);
        expect(first?.target.x).toBeLessThan(4.6);
        expect(next?.target.x).toBeGreaterThan(-4.8);
        expect(next?.target.x).toBeLessThan(4.6);
        expect(next?.target).not.toEqual(first?.target);
    });

    it('does not choose a destination inside saved furniture or another resident', () => {
        const items = [bench('seat', 1.5, 1.5)];
        const plan = planResidentRoam({ x: -.5, z: 1.5 }, 1, 0, items, 0, { occupied: [{ x: -2, z: 1.5 }] });
        expect(plan).toBeDefined();
        expect(residentPointIsClear(plan!.target, 0, residentObstacles(items, ''))).toBe(true);
        expect(Math.hypot(plan!.target.x + 2, plan!.target.z - 1.5)).toBeGreaterThanOrEqual(.84 - 1e-8);
    });
});
