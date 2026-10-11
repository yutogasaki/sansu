import { expect, it, vi } from 'vitest';
import * as T from 'three';
import { applyIntent } from '../../../domain/growingIsland/commands';
import { newIsland } from '../../../domain/growingIsland/island';
import { IslandMaterials } from '../three/primitives';
import { GrowingLife } from './growingLife';
import { growingSceneStateKey } from './growingSceneInputs';
import { buildObjectLayer } from './objectLayer';
import { sceneLayout } from './sceneLayout';

it('adopts saved receipts without replacing actors, resetting visitor motion or interrupting a real seat use', () => {
    const state = newIsland('receipt-life-continuity', 1000);
    state.tutorial = 'done'; state.guidance!.starter.automatic = false;
    state.plots = [{ id: 'home', kind: 'home', cell: { x: 1, z: 3 }, stage: 2, plantedAt: 0, growth: 0, origin: 'seed', paid: 4 }];
    state.villagers = [{ id: 'friend', species: 'otter', home: 'home', arrivedAt: 0, trait: 'mellow',
        variant: { color: 0, accessory: 0, sparkle: true } }];
    state.landmarks = [{ id: 't1', kind: 'sapling', cell: { x: 3, z: 2 }, growth: 18, maturedAt: 0 },
        { id: 't2', kind: 'sapling', cell: { x: 5, z: 2 }, growth: 18, maturedAt: 0 },
        { id: 'seat', kind: 'bench', cell: { x: 4, z: 3 }, growth: 0 }];
    const before = structuredClone(state), m = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
    const layer = buildObjectLayer(m, state, layout);
    const life = new GrowingLife(m, { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] });
    const random = vi.spyOn(Math, 'random').mockReturnValue(.99);
    try {
        life.sync(state, layout, layer);
        expect(life.pick('friend')).toBe(true);
        life.drag('friend', layout.point({ x: 4, z: 3 }));
        expect(life.drop('friend', 0)).toEqual({ kind: 'bench', cell: { x: 4, z: 3 } });
        life.hop('visitor', 700); life.tick(800, 16, false, false);
        const receipts = life.takePlaceUses(), receipt = receipts.find(receipt => receipt.actorId === 'friend')!;
        expect(receipt).toMatchObject({ ruleId: 'P01', targetId: 'seat' });
        const shown = applyIntent(state, { id: 'shown', command: { type: 'place-shown', profileId: state.seed,
            expectedRevision: 0, ruleId: receipt.ruleId, revision: receipt.revision } }, 1000).state;
        const used = applyIntent(shown, { id: 'used', command: { type: 'place-used', profileId: state.seed,
            expectedRevision: 0, ...receipt } }, 1001).state;
        expect(growingSceneStateKey(used)).toBe(growingSceneStateKey(state));
        const actors = life.objects(), ids = life.actorIds();
        const visitor = actors.find(actor => actor.userData.actorId === 'visitor')!;
        const friend = actors.find(actor => actor.userData.actorId === 'friend')!;
        const transforms = actors.map(actor => ({ position: actor.position.toArray(), rotation: actor.rotation.toArray() }));
        const geometries = new Set<T.BufferGeometry>();
        actors.forEach(actor => actor.traverse(object => { if (object instanceof T.Mesh) geometries.add(object.geometry); }));
        const disposal = [...geometries].map(geometry => vi.spyOn(geometry, 'dispose'));
        expect(visitor.position.y - layout.pierEnd.y).toBeGreaterThan(.1);
        for (const next of [shown, used]) {
            life.adoptState(next);
            expect(life.actorIds()).toEqual(ids);
            const current = life.objects();
            expect(current).toHaveLength(actors.length);
            actors.forEach((actor, i) => {
                expect(current[i]).toBe(actor);
                expect(actor.position.toArray()).toEqual(transforms[i].position);
                expect(actor.rotation.toArray()).toEqual(transforms[i].rotation);
            });
        }
        expect(disposal.every(spy => spy.mock.calls.length === 0)).toBe(true);
        life.tick(816, 16, false, false);
        expect(life.objects()).toContain(visitor); expect(life.objects()).toContain(friend);
        expect(visitor.position.y - layout.pierEnd.y).toBeGreaterThan(.1);
        expect(friend.position.x).toBeCloseTo(layout.point({ x: 4, z: 3 }).x, 6);
        expect(friend.position.y).toBeGreaterThan(layout.point({ x: 4, z: 3 }).y + .1);
        expect(life.takePlaceUses().filter(receipt => receipt.actorId === 'friend')).toEqual([]);
        expect(used.placeProgress!.shown.P01).toBe(receipt.revision);
        expect(used.placeProgress!.uses.P01!.villager).toMatchObject({ actorId: 'friend', targetId: 'seat' });
        expect(state).toEqual(before);
    } finally { random.mockRestore(); life.dispose(); layer.dispose(); m.dispose(); }
});
