import { describe, expect, it } from 'vitest';
import { authoredAccessWorld } from '../../../domain/growingIsland/authoredWorldAccess.fixture';
import { newIsland } from '../../../domain/growingIsland/island';
import { key, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import { besideOpen, walkRoute } from './walkers';

describe('authored walkers', () => {
    it('keeps a quarter start intact and follows only actual open edges', () => {
        const { world } = authoredAccessWorld(), state = newIsland('authored-walker', 0), open = walkableCells(state, world);
        const from = { x: 1.25, z: -1 }, to = { x: 2.75, z: -1 }, route = walkRoute(open, from, to, world)!;
        expect(route[0]).toEqual(from);
        expect(route.at(-1)).toEqual(to);
        expect(route.every((cell, i) => !i || world.neighbors(route[i - 1]).some(next => key(next) === key(cell)))).toBe(true);
        expect(walkRoute(open, { x: 100, z: -1 }, to, world)).toBeUndefined();
    });

    it('stops outside a home on a supported and reachable approach', () => {
        const { world } = authoredAccessWorld(), state = newIsland('authored-walker', 0), home = { x: 1, z: -1 };
        state.plots.push({ id: 'native-home', kind: 'home', cell: home, plantedAt: 0, stage: 2, growth: 0, origin: 'seed', paid: 4 });
        const open = walkableCells(state, world), reached = reachableFromHome(state, open, world), target = besideOpen(open, home, reached, world)!;
        expect(target).toEqual({ x: 1, z: -.25 });
        expect(reached.has(key(target))).toBe(true);
        expect(walkRoute(open, { x: 2, z: 1 }, target, world)).toBeDefined();
    });

    it('retains legacy integer start rounding and neighbor preference', () => {
        const open = new Set(['0,0', '1,0', '2,0']);
        expect(walkRoute(open, { x: .1, z: .1 }, { x: 2, z: 0 })).toEqual([{ x: 0, z: 0 }, { x: 1, z: 0 }, { x: 2, z: 0 }]);
        expect(besideOpen(open, { x: 1, z: 1 })).toEqual({ x: 1, z: 0 });
    });
});
