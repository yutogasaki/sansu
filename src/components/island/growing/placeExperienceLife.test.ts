import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { IslandMaterials } from '../three/primitives';
import { GrowingLife } from './growingLife';
import { sceneLayout } from './sceneLayout';
import { buildObjectLayer } from './objectLayer';
import { experienceFixture } from '../../../prototypes/placeQa/experienceFixture';
import { architectureFixture } from '../../../domain/growingIsland/placeArchitecture.fixture';
import { recordPlaceUse } from '../../../domain/growingIsland/placeGoals';

function fixture() {
    const state = experienceFixture('village'), materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
    const life = new GrowingLife(materials, { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] });
    const layer = buildObjectLayer(materials, state, layout); life.sync(state, layout, layer); life.tick(0, 0, true, false);
    return { state, life, layer, layout, dispose: () => { life.dispose(); layer.dispose(); materials.dispose(); } };
}
describe('real place activity', () => {
    it('enters a six-tree gallery through the explicit place command and saves a genuine elevated use', () => {
        const state = architectureFixture();
        state.plots[0].cell = { x: 0, z: 5 }; state.plots[1].cell = { x: 3, z: 5 };
        state.landmarks = Array.from({ length: 6 }, (_, i) => ({ id: `source-${i}`, kind: 'sapling', cell: { x: i + 1, z: 3 }, growth: 18, maturedAt: 0 }));
        const materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
        const life = new GrowingLife(materials, { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] });
        const layer = buildObjectLayer(materials, state, layout); life.sync(state, layout, layer); life.tick(0, 0, true, false);
        try {
            const place = layer.places.find(place => place.ruleId === 'P02')!;
            expect(life.visitPlace('pokomoko', place.id, 10)).toBe(true);
            let uses: ReturnType<typeof life.takePlaceUses> = [];
            for (let now = 74; now < 60000 && !uses.length; now += 64) { life.tick(now, 64, true, false); uses = life.takePlaceUses(); }
            const use = uses.find(use => use.placeId === place.id)!;
            expect(use).toBeDefined(); recordPlaceUse(state, use, 60000);
            expect(state.placeProgress!.uses.P02?.pokomoko?.targetId).toBe(use.targetId);
        } finally { life.dispose(); layer.dispose(); materials.dispose(); }
    });
    it('walks to an explicitly chosen shared garden and records only actual arrival', () => {
        const state = architectureFixture(), before = structuredClone(state), materials = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
        const life = new GrowingLife(materials, { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] });
        const layer = buildObjectLayer(materials, state, layout); life.sync(state, layout, layer); life.tick(0, 0, true, false);
        try {
            const garden = layer.places.find(place => place.structure === 'P04:shared-roof')!;
            const start = life.positionOf('pokomoko')!.clone();
            expect(life.visitPlace('pokomoko', 'missing', 10)).toBe(false);
            expect(life.visitPlace('pokomoko', garden.id, 10)).toBe(true);
            expect(life.positionOf('pokomoko')).toEqual(start); expect(life.takePlaceUses()).toEqual([]);
            let uses: ReturnType<typeof life.takePlaceUses> = [];
            for (let now = 110; now < 30000 && !uses.length; now += 100) { life.tick(now, 100, true, false); uses = life.takePlaceUses(); }
            expect(uses.some(use => use.actorId === 'pokomoko' && use.placeId === garden.id)).toBe(true);
            expect(state).toEqual(before);
        } finally { life.dispose(); layer.dispose(); materials.dispose(); }
    });
    it('walks to a touched tree without teleporting or changing the saved island', () => {
        const { state, life, layout, dispose } = fixture(), before = structuredClone(state);
        const random = vi.spyOn(Math, 'random').mockReturnValue(.5);
        try {
            const start = life.positionOf('pokomoko')!.clone();
            expect(life.visitOwner('T1', 10)).toBe(true); expect(life.positionOf('pokomoko')).toEqual(start);
            life.tick(110, 100, true, false);
            expect(life.positionOf('pokomoko')!.distanceTo(start)).toBeLessThan(.3);
            for (let now = 210; now < 14000 && !life.nearOwner('T1'); now += 100) life.tick(now, 100, true, false);
            expect(life.nearOwner('T1')).toBe(true); expect(layout.cellAt(life.positionOf('pokomoko')!)).not.toEqual(state.landmarks.find(l => l.id === 'T1')!.cell);
            expect(state).toEqual(before);
        } finally { random.mockRestore(); dispose(); }
    });
    it('invites only reachable actors, requires each touch, and clears actual participation on exit', () => {
        const { state, life, dispose } = fixture(), before = structuredClone(state);
        const random = vi.spyOn(Math, 'random').mockReturnValue(.5);
        try {
            const start = life.positionOf('V1')!.clone();
            life.startConcert({ x: 3, z: 6 }, 10);
            expect(life.positionOf('V1')).toEqual(start); expect(life.sharedConcertActors(10)).toEqual([]);
            expect(life.touchConcert('visitor', 10)).toBe(false);
            for (let now = 110; now < 12000; now += 100) life.tick(now, 100, true, false);
            expect(life.participating('pokomoko', 12000)).toBe(true);
            expect(life.touchConcert('pokomoko', 12000)).toBe(true);
            const participants = state.villagers.filter(friend => life.participating(friend.id, 12000));
            expect(participants.length).toBeGreaterThan(0);
            const id = participants[0].id;
            expect(life.sharedConcertActors(12000)).not.toContain(id);
            expect(life.touchConcert(id, 12000)).toBe(true); expect(life.sharedConcertActors(12000)).toContain(id);
            life.pick(id); expect(life.sharedConcertActors(12001)).not.toContain(id);
            life.stopConcert(); expect(life.participating('pokomoko', 12002)).toBe(false);
            expect(state).toEqual(before);
        } finally { random.mockRestore(); dispose(); }
    });
});
