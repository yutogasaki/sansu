import { describe, expect, it } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { HOME_CELL, approachCells, key, neighbors, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import { authoredAccessWorld } from '../../../domain/growingIsland/authoredWorldAccess.fixture';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { authoredOwnerApproaches } from './authoredFlowerObstructions';
import { sceneLayout } from './sceneLayout';
import { buildPlacePaths, placePathEdges } from './placePaths';

describe('reachable garden paths', () => {
    it('shares an open network and never crosses a blocked cell or grants access to an isolated home', () => {
        const state = newIsland('paths', 0);
        state.land = { expanded: 'east', extra: ['south'], capes: [] };
        const home = (id: string, x: number, z: number) => ({ id, kind: 'home' as const, cell: { x, z }, stage: 2 as const,
            plantedAt: 0, builtAt: 0, stagedAt: 0, growth: 0, origin: 'seed' as const, paid: 40 });
        state.plots = [home('a', 5, 1), home('b', 7, 3), home('isolated', 7, 6)];
        for (const [i, cell] of neighbors({ x: 7, z: 6 }).entries()) state.landmarks.push({ id: `wall-${i}`, kind: 'bench', cell, growth: 0 });
        const snapshot = structuredClone(state), edges = placePathEdges(state, []), open = walkableCells(state);
        expect(edges.length).toBeGreaterThan(0);
        for (const [a, b] of edges) {
            expect(open.has(key(a)) && open.has(key(b))).toBe(true);
            expect(Math.abs(a.x - b.x) + Math.abs(a.z - b.z)).toBe(1);
        }
        const reached = new Set([key(HOME_CELL)]);
        while (true) { const size = reached.size; for (const [a, b] of edges) if (reached.has(key(a)) || reached.has(key(b))) { reached.add(key(a)); reached.add(key(b)); }
            if (size === reached.size) break; }
        expect([...new Set(edges.flat().map(key))].every(id => reached.has(id))).toBe(true);
        expect(neighbors(state.plots[2].cell!).some(cell => reached.has(key(cell)))).toBe(false);
        expect(state).toEqual(snapshot);
    });

    it('keeps the initial island plain and fits decorative paving to the same sloping floor without covering channels', () => {
        const initial = newIsland('paths', 0);
        expect(placePathEdges(initial, [])).toEqual([]);
        initial.land = { expanded: 'east', extra: [], capes: [] };
        initial.plots.push({ id: 'grown-home', kind: 'home', cell: { x: 8, z: 3 }, stage: 4,
            plantedAt: 0, builtAt: 0, stagedAt: 0, growth: 0, origin: 'seed', paid: 40 });
        initial.landmarks.push({ id: 'channel', kind: 'water-channel', cell: { x: 5, z: 1 }, growth: 0 });
        const layout = sceneLayout(initial), path = buildPlacePaths(initial, layout, []), positions = path.geometry.getAttribute('position');
        expect(positions.count).toBeGreaterThan(0);
        for (let i = 0; i < positions.count; i++) {
            const cell = { x: positions.getX(i) + layout.center, z: positions.getZ(i) + 2 };
            expect(positions.getY(i)).toBeCloseTo(layout.heightAt(cell) + .008, 6);
            expect(Math.abs(cell.x - 5) > .48 || Math.abs(cell.z - 1) > .48).toBe(true);
        }
        expect(path.userData.ownMaterial).toBe(true);
        path.geometry.dispose(); (path.material as import('three').Material).dispose();
    });
});

describe('committed authored path access', () => {
    it('reaches the same fallback owner approach after the ordinary approach ring is rejected', () => {
        const state = newIsland('guarded-owner-path', 0), { world } = authoredAccessWorld(), cell = { x: 4, z: -2 };
        state.landmarks = [];
        state.plots = [{ id: 'home', kind: 'home', cell, stage: 2, plantedAt: 0, growth: 0, origin: 'seed', paid: 40 }];
        const open = walkableCells(state, world);
        for (const at of approachCells(cell, world)) open.delete(key(at));
        const ownerApproaches = authoredOwnerApproaches(state.plots, world, open, reachableFromHome(state, open, world));
        const fallback = ownerApproaches.get(key(cell))!;
        expect(fallback.length).toBeGreaterThan(0);
        expect(fallback.every(at => !approachCells(cell, world).some(before => key(before) === key(at)))).toBe(true);
        expect(placePathEdges(state, [], world, { walkable: open, ownerApproaches: new Map() })).toEqual([]);
        const edges = placePathEdges(state, [], world, { walkable: open, ownerApproaches });
        expect(edges.length).toBeGreaterThan(0);
        expect(edges.flat().every(at => open.has(key(at)))).toBe(true);
        expect(fallback.some(at => edges.flat().some(end => key(end) === key(at)))).toBe(true);
        expect(placePathEdges(state, [], world, { walkable: open, ownerApproaches: new Map([[key(cell), []]]) })).toEqual([]);
    });

    it('does not relocate a designated place entrance to an owner fallback or revive a rejected HOME', () => {
        const state = newIsland('guarded-place-entry', 0), { world } = authoredAccessWorld(), entrance = { x: 4, z: -2 }, fallback = { x: 4, z: -1 };
        state.landmarks = []; state.plots = [];
        const place: DerivedPlace = { id: 'place', ruleId: 'P02', family: 'grove', anchorId: 'tree', memberIds: ['tree'], mainIds: ['tree'],
            variant: 'test', stage: 'grown', footprint: [], entrances: [entrance], walkSurface: [], waterRefs: [], shadeRefs: [], useTargets: [], revision: 'test', missing: [] };
        const open = walkableCells(state, world), ownerApproaches = new Map([[key(entrance), [fallback]]]);
        expect(placePathEdges(state, [place], world, { walkable: open, ownerApproaches }).flat()).toContainEqual(entrance);
        open.delete(key(entrance));
        expect(placePathEdges(state, [place], world, { walkable: open, ownerApproaches })).toEqual([]);
        open.add(key(entrance)); open.delete(key(HOME_CELL));
        expect(placePathEdges(state, [place], world, { walkable: open, ownerApproaches })).toEqual([]);
    });
});
