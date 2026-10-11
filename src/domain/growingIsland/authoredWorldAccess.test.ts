import { describe, expect, it } from 'vitest';
import { authoredAccessWorld } from './authoredWorldAccess.fixture';
import { authoredPointBlocked, walkPathDistance } from './authoredWorldAccess';
import { newIsland } from './island';
import { approachCells, HOME_CELL, isReachable, isVacant, key, landCells, onLand, passageNeighbors, reachableFromHome, walkableCells } from './space';
import { compileWorldDefinition } from './worldDefinition';

describe('authored planting and walking access', () => {
    it('grants only explicit integer planting sites, including negative z, without changing a save', () => {
        const state = newIsland('authored-access', 0), before = structuredClone(state), { world } = authoredAccessWorld();
        expect(onLand(state, { x: 1, z: -1 })).toBe(false);
        expect(onLand(state, { x: 1, z: -1 }, world)).toBe(true);
        expect(isVacant(state, { x: 1, z: -1 }, undefined, world)).toBe(true);
        expect(onLand(state, { x: 1.25, z: -1 }, world)).toBe(false);
        expect(onLand(state, { x: 6, z: 1 }, world)).toBe(false);
        expect(landCells(state, world).every(cell => Number.isInteger(cell.x) && Number.isInteger(cell.z))).toBe(true);
        expect(state).toEqual(before);
    });

    it('keeps quarter walks separate from integer join and water grants', () => {
        const { world } = authoredAccessWorld(), cell = { x: 1, z: -1 };
        expect(passageNeighbors(cell, world).every(next => Math.abs(next.x - cell.x) + Math.abs(next.z - cell.z) === .25)).toBe(true);
        expect(passageNeighbors(cell, world, 'join').every(next => Number.isInteger(next.x) && Number.isInteger(next.z))).toBe(true);
        expect(passageNeighbors({ x: 1.25, z: -1 }, world, 'water')).toEqual([]);
    });

    it('routes around an occupied home with its foot band instead of through quarter interior nodes', () => {
        const state = newIsland('authored-access', 0), { world } = authoredAccessWorld(), home = { x: 1, z: -1 };
        state.landmarks = [];
        state.plots.push({ id: 'native-home', kind: 'home', cell: home, plantedAt: 0, stage: 2, growth: 0, origin: 'seed', paid: 4 });
        const open = walkableCells(state, world), reached = reachableFromHome(state, open, world);
        expect(open.has(key(home))).toBe(false);
        expect(open.has('1.5,-1')).toBe(false);
        expect(open.has('1.75,-1')).toBe(true);
        expect(open.has(key(HOME_CELL))).toBe(true);
        expect(open.has('2.5,0')).toBe(false);
        const path = world.route({ x: 0, z: -1 }, { x: 2, z: -1 }, open)!;
        expect(path.length).toBeGreaterThan(9);
        expect(path.every(cell => !authoredPointBlocked(cell, home))).toBe(true);
        expect(isReachable(home, reached, world)).toBe(true);
        expect(approachCells(home, world)[1]).toEqual({ x: 1, z: -.25 });
    });

    it('does not infer passage across a removed district connection', () => {
        const state = newIsland('authored-access', 0), { definition } = authoredAccessWorld();
        definition.edges = definition.edges.filter(edge => {
            const [a] = edge.from.siteId.split(',').map(Number), [b] = edge.to.siteId.split(',').map(Number);
            return !edge.allows.includes('walk') || !(a <= 3.5 && b > 3.5);
        });
        const world = compileWorldDefinition(definition), reached = reachableFromHome(state, undefined, world);
        expect(onLand(state, { x: 4, z: -1 }, world)).toBe(true);
        expect(reached.has('4,-1')).toBe(false);
        expect(isReachable({ x: 5, z: -1 }, reached, world)).toBe(false);
    });

    it('measures the same walking distance at integer and quarter resolutions', () => {
        const quarter = Array.from({ length: 13 }, (_, i) => ({ x: i / 4, z: -1 }));
        expect(walkPathDistance(quarter)).toBe(3);
        expect(walkPathDistance([{ x: 0, z: -1 }, { x: 1, z: -1 }, { x: 2, z: -1 }, { x: 3, z: -1 }])).toBe(3);
    });
});
