import { describe, expect, it } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { HOME_CELL, key, neighbors, walkableCells } from '../../../domain/growingIsland/space';
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
