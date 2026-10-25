import { describe, expect, it } from 'vitest';
import { architectureFixture } from './placeArchitecture.fixture';
import { derivePlaces } from './places';
import { applyIntent } from './commands';
import { communityRoofModules } from './communityRoof';
import { editableIslandWorld } from './editableTerrainWorld';
import { placeGalleryRoute } from './placeTerrain';
import type { GrowingState } from './types';

const remoteEdit = (state: GrowingState) => applyIntent(state, { id: 'remote', command: { type: 'terrain-edit', cell: { x: -2, z: 6 }, delta: 1 } }, 0).state;
const identity = (place: ReturnType<typeof derivePlaces>[number]) => ({ id: place.id, ruleId: place.ruleId, mainIds: place.mainIds, stage: place.stage, structure: place.structure, flowerRoofs: place.flowerRoofs });

describe('earned native architecture on edited terrain', () => {
    it('retains an existing long tree gallery after a remote edit and samples its deck from the actual floor', () => {
        const state = architectureFixture(); state.plots = [];
        state.landmarks = Array.from({ length: 6 }, (_, i) => ({ id: `tree-${i}`, kind: 'sapling', cell: { x: i + 2, z: 2 }, growth: 18, maturedAt: 0 }));
        const before = derivePlaces(state).find(place => place.ruleId === 'P02')!;
        expect(before.stage).toBe('grown'); expect(before.walkSurface.length).toBeGreaterThan(30);
        const next = remoteEdit(state), world = editableIslandWorld(next)!;
        const after = derivePlaces(next).find(place => place.ruleId === 'P02')!;
        expect(identity(after)).toEqual(identity(before)); expect(after.walkSurface.length).toBeGreaterThan(30);
        const target = after.useTargets.find(target => target.kind === 'gallery')!;
        expect(target.route).toEqual(after.walkSurface);
        for (const point of after.walkSurface) expect(world.floorAt(point)).toBeDefined();
        expect(after.walkSurface[0].y).toBeCloseTo(world.floorAt(after.walkSurface[0])!.point.y + .04, 8);
        expect(next.landmarks).toEqual(state.landmarks);
    });

    it('retains existing flower-roof modules and the shared-home roof after a remote edit', () => {
        const state = architectureFixture();
        state.landmarks = Array.from({ length: 6 }, (_, i) => ({ id: `flower-${i}`, kind: 'flower', cell: { x: i, z: 5 }, growth: 6 }));
        const before = derivePlaces(state).filter(place => place.ruleId === 'P05' || place.ruleId === 'P04');
        expect(before.every(place => place.structure)).toBe(true);
        const next = remoteEdit(state), after = derivePlaces(next).filter(place => place.ruleId === 'P05' || place.ruleId === 'P04');
        expect(after.map(identity)).toEqual(before.map(identity));
        expect(communityRoofModules(next, state.plots.map(plot => plot.id))).toHaveLength(1);
    });

    it('does not grant gallery or roof support over an edited hole just because the land is still owned', () => {
        const state = architectureFixture(); state.terrain = { version: 1, heights: { '8,4': -4, '9,4': -4, '8,5': -4, '9,5': -4 }, undo: [], redo: [] };
        // Lower the expanded hillside enough to cross the sea where the structure would sit.
        state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east'] };
        state.plots = state.plots.map((home, i) => ({ ...home, cell: { x: i * 3, z: 3 } }));
        state.terrain.heights = { '1,4': -4, '2,4': -4, '1,5': -4, '2,5': -4 };
        expect(editableIslandWorld(state)!.owns({ x: 1, z: 4 })).toBe(true);
        expect(communityRoofModules(state, state.plots.map(plot => plot.id))).toEqual([]);
        expect(placeGalleryRoute(state, { footprint: [{ x: 1, z: 4 }], entrances: [{ x: 1, z: 4 }] }, { x: 1, z: 4 })).toEqual([]);
    });
});
