import { describe, expect, it } from 'vitest';
import { applyIntent, canPlace, canReachHomePlacement } from './commands';
import { newIsland } from './island';
import { authoredAccessWorld } from './authoredWorldAccess.fixture';
import { compileWorldDefinition } from './worldDefinition';
import { derivePlaces, placeConnected, placePathDistance, placeWalkPath } from './places';
import { key, walkableCells } from './space';
import { placeGalleryRoute, terrainHeightAt } from './placeTerrain';

const initial = () => {
    const state = newIsland('authored-placement-diagnostic', 1000);
    state.landmarks = []; state.tutorial = 'done'; state.drops = 100;
    return state;
};
describe('authored placement and places use the actual world', () => {
    it('moves the same owner to negative acquired land and rejects sea and walking-only sites atomically', () => {
        const { world } = authoredAccessWorld();
        const state = initial(); state.landmarks.push({ id: 'same-tree', kind: 'sapling', cell: { x: 0, z: 0 }, growth: 18, maturedAt: 0 });
        const before = structuredClone(state);
        const moved = applyIntent(state, { id: 'move-1', command: { type: 'move', id: 'same-tree', cell: { x: 0, z: -2 } } }, 1000, world).state;
        expect(moved.landmarks[0]).toEqual({ ...before.landmarks[0], cell: { x: 0, z: -2 } });
        expect(moved.drops).toBe(before.drops); expect(moved.nature).toEqual(before.nature); expect(state).toEqual(before);
        for (const cell of [{ x: 0, z: -2.25 }, { x: 9, z: -2 }]) {
            expect(canPlace(moved, cell, 'same-tree', world)).toBe(false);
            expect(() => applyIntent(moved, { id: `invalid-${key(cell)}`, command: { type: 'move', id: 'same-tree', cell } }, 1000, world)).toThrow();
        }
        expect(canReachHomePlacement(moved, { x: 4, z: -2 }, undefined, world)).toBe(true);
        expect(terrainHeightAt(moved, { x: 4, z: -2 }, world)).toBeCloseTo(.08);
        expect(placeGalleryRoute(moved, { footprint: [{ x: 4, z: -2 }], entrances: [{ x: 4, z: -2 }] }, { x: 4, z: -2 }, world)).toEqual([]);
    });
    it('limits attachments in logical cells and never invents a removed walk or join edge', () => {
        const { definition, world } = authoredAccessWorld(), state = initial();
        const open = walkableCells(state, world), from = { x: 0, z: -2 }, to = { x: 2, z: -2 };
        const path = placeWalkPath(open, from, to, 2, world)!;
        expect(path.length).toBe(9); expect(placePathDistance(path)).toBe(2);
        expect(placeWalkPath(open, from, to, 1.99, world)).toBeUndefined();
        expect(placeConnected(from, { x: 1, z: -2 }, open, world)).toBe(true);
        definition.edges = definition.edges.filter(edge => !edge.allows.includes('join'));
        expect(placeConnected(from, { x: 1, z: -2 }, open, compileWorldDefinition(definition))).toBe(false);
        definition.edges = definition.edges.filter(edge => {
            const sites = definition.districts[0].sites;
            const a = sites.find(site => site.id === edge.from.siteId)!.cell, b = sites.find(site => site.id === edge.to.siteId)!.cell;
            return !(Math.min(a.x, b.x) <= 1 && Math.max(a.x, b.x) > 1);
        });
        expect(placeWalkPath(open, from, to, Infinity, compileWorldDefinition(definition))).toBeUndefined();
    });
    it('does not authorize an authored tree gallery from an unrelated deck', () => {
        const { definition } = authoredAccessWorld(), floor = definition.districts[0].floors[0];
        definition.districts[0].floors.push({ ...floor, id: 'unrelated-deck', kind: 'deck', vertices: floor.vertices.map(vertex => ({
            cell: { x: vertex.cell.x + 100, z: vertex.cell.z },
            point: { x: vertex.point.x + 100, y: vertex.point.y + 1.4, z: vertex.point.z },
        })) });
        const world = compileWorldDefinition(definition);
        expect(world.floors.some(floor => floor.kind === 'deck')).toBe(true);
        expect(placeGalleryRoute(initial(), { footprint: [{ x: 4, z: -2 }], entrances: [{ x: 4, z: -2 }] }, { x: 4, z: -2 }, world)).toEqual([]);
    });
    it('derives the same owners on authored negative terrain and splits on explicit join removal', () => {
        const { definition, world } = authoredAccessWorld(), state = initial();
        state.landmarks = [{ id: 'a', kind: 'sapling', cell: { x: 0, z: -2 }, growth: 18 },
            { id: 'b', kind: 'sapling', cell: { x: 1, z: -2 }, growth: 18 }, { id: 'seat', kind: 'bench', cell: { x: 0, z: -1 }, growth: 0 }];
        const before = structuredClone(state), grove = derivePlaces(state, world).find(place => place.ruleId === 'P01')!;
        expect(grove.mainIds).toEqual(['a', 'b']); expect(grove.entrances.some(cell => !Number.isInteger(cell.x) || !Number.isInteger(cell.z))).toBe(true);
        definition.edges = definition.edges.filter(edge => !edge.allows.includes('join'));
        expect(derivePlaces(state, compileWorldDefinition(definition)).filter(place => place.ruleId === 'P01').map(place => place.mainIds)).toEqual([['a'], ['b']]);
        expect(state).toEqual(before);
    });
});
