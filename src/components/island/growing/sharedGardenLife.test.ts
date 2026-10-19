import { expect, it, vi } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland';
import { key, reachableFromHome } from '../../../domain/growingIsland/space';
import { IslandMaterials } from '../three/primitives';
import { GrowingLife } from './growingLife';
import { buildObjectLayer } from './objectLayer';
import { sceneLayout } from './sceneLayout';

it('uses the shared garden with existing actors on reachable ground and cancels an obsolete visit', () => {
    const state = newIsland('garden-life', Date.UTC(2026, 9, 19));
    state.landmarks = []; state.arrivals = []; state.unopened = [];
    state.plots = [1, 3].map(x => ({ id: `home-${x}`, kind: 'home', cell: { x, z: 3 }, stage: 2, plantedAt: 0, growth: 0, origin: 'seed', paid: 4 }));
    state.villagers = [{ id: 'friend', species: 'otter', home: 'home-1', arrivedAt: 0, trait: 'mellow', variant: { color: 2, accessory: 1, sparkle: false } }];
    const saved = structuredClone(state), m = new IslandMaterials('moon-garden'), layout = sceneLayout(state), layer = buildObjectLayer(m, state, layout);
    const life = new GrowingLife(m, { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] });
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
        const garden = layer.places.find(p => p.ruleId === 'P04')!;
        expect(garden.stage).toBe('grown');
        expect(garden.useTargets).toHaveLength(1);
        const target = garden.useTargets[0];
        expect(target.kind).toBe('garden');
        expect(reachableFromHome(state).has(key(target.cell))).toBe(true);
        life.sync(state, layout, layer); life.tick(0, 0, true, false);
        expect(life.takePlaceUses()).toEqual([]);
        const uses = [];
        for (let now = 100; now <= 30000; now += 100) {
            life.tick(now, 100, true, false);
            for (const receipt of life.takePlaceUses()) {
                expect(now).toBeGreaterThanOrEqual(700);
                expect(layout.cellAt(life.positionOf(receipt.actorId)!)).toEqual(target.cell);
                expect(receipt).toMatchObject({ placeId: garden.id, revision: garden.revision, targetId: target.id });
                uses.push(receipt);
            }
        }
        expect(uses.map(use => use.actorId).sort()).toEqual(['friend', 'pokomoko']);
        expect(state).toEqual(saved);
        // Removing a constituent home invalidates the target before another shown use.
        state.plots.pop();
        const nextLayout = sceneLayout(state), nextLayer = buildObjectLayer(m, state, nextLayout);
        try {
            life.sync(state, nextLayout, nextLayer);
            for (let now = 30100; now <= 40000; now += 100) life.tick(now, 100, true, false);
            expect(life.takePlaceUses()).toEqual([]);
            expect(nextLayer.places.some(p => p.ruleId === 'P04')).toBe(false);
            expect(life.actorIds()).toContain('friend');
        } finally { nextLayer.dispose(); }
    } finally { random.mockRestore(); life.dispose(); layer.dispose(); m.dispose(); }
});
