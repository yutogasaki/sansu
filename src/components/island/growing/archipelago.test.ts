import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { islandGifts, neighbors, noteLevels, grantRoutes } from '../../../domain/growingIsland/journey';
import type { GrowingState } from '../../../domain/growingIsland';
import { Archipelago } from './archipelago';
import { sceneLayout } from './sceneLayout';
import { WonderScenery } from './wonderScenery';

const now = 1_800_000_000_000;
const welcomed = (state: GrowingState) => { state.villagers.push({ ...state.pier.visitor, id: 'v1', arrivedAt: 0 } as never); state.arrivals = []; return state; };
/** Home with the old shore island made, and a shoal begun by learning. */
const journeyed = () => {
    const state = welcomed(newIsland('child', now));
    state.journey = { routes: [{ slot: 0, reason: 'first-friend', at: 0 }], chosen: [{ slot: 0, theme: 'shiokaze', islandId: 'shore-id' }], species: [] };
    noteLevels(state, { math: 2, vocab: 0, kokugo: 0 }); grantRoutes(state, undefined, now);
    return state;
};
const named = (root: T.Object3D, name: string) => root.getObjectsByProperty('name', name).length;

describe('one archipelago (island-journey.md §3.4, §3.6)', () => {
    it('sees only the islands made and the growing shoal; islands still to come are not there at all', () => {
        const state = journeyed();
        expect(neighbors(state, 'home').map(n => [n.key, n.mode, n.stage])).toEqual([['shiokaze', 'made', undefined], ['shoal', 'shoal', 1]]);
        expect(neighbors(state, 'home')[0].islandId).toBe('shore-id');
        expect(neighbors(state, 'shiokaze').map(n => n.key)).toEqual(['home', 'shoal']);
        expect(neighbors(welcomed(newIsland('child', now)), 'home')).toEqual([]);
    });

    it('joins home to made islands by bridges; the shoal grows from a shadow to sand to a misty islet', () => {
        const state = journeyed(), scene = new T.Scene(), archipelago = new Archipelago(scene);
        archipelago.build(state, sceneLayout(state), 'home');
        expect(archipelago.targets).toHaveLength(2);
        expect(named(archipelago.root, 'archipelago-bridge')).toBe(1);
        expect(named(archipelago.root, 'archipelago-stone')).toBe(0);
        expect([named(archipelago.root, 'shoal-shadow'), named(archipelago.root, 'shoal-sand'), named(archipelago.root, 'shoal-grass')]).toEqual([1, 0, 0]);
        state.journey!.shoal!.land = true;
        archipelago.build(state, sceneLayout(state), 'home');
        expect([named(archipelago.root, 'shoal-sand'), named(archipelago.root, 'shoal-grass')]).toEqual([1, 0]);
        state.journey!.shoal!.life = true;
        archipelago.build(state, sceneLayout(state), 'home');
        expect([named(archipelago.root, 'shoal-sand'), named(archipelago.root, 'shoal-grass')]).toEqual([1, 1]);
        // Older ordinary islands and visits show no archipelago.
        archipelago.build(state, sceneLayout(state), undefined);
        expect(archipelago.targets).toHaveLength(0);
        archipelago.dispose();
    });

    it('answers a touch with the island under the finger', () => {
        const state = journeyed(), scene = new T.Scene(), archipelago = new Archipelago(scene);
        archipelago.build(state, sceneLayout(state), 'home');
        scene.updateMatrixWorld(true);
        const shore = archipelago.root.getObjectByName('archipelago-shiokaze')!, at = shore.getWorldPosition(new T.Vector3());
        const ray = new T.Raycaster(at.clone().add(new T.Vector3(0, 10, 0)), new T.Vector3(0, -1, 0));
        expect(archipelago.pick(ray)).toEqual({ key: 'shiokaze', mode: 'made', islandId: 'shore-id', stage: undefined });
    });
});

describe('specialties sent to the other islands (island-journey.md §3.5)', () => {
    it('sends each completed island its gift everywhere except to itself', () => {
        const state = journeyed();
        state.discoveries = ['island:kodama', 'island:karakuri'];
        expect(islandGifts(state)).toEqual(['kodama', 'karakuri']);
        expect(islandGifts({ ...state, theme: 'kodama' })).toEqual(['karakuri']);
    });

    it('hangs golden bells on grown trees of another island once the forest is complete', () => {
        const state = journeyed(), scenery = new WonderScenery(new T.Scene()), layout = sceneLayout(state);
        const tree = { id: 't1', kind: 'sapling', cell: { x: 1, z: 1 }, growth: 99, maturedAt: 1 } as never;
        state.landmarks.push(tree);
        scenery.build(state, layout, now);
        expect(named(scenery.root, 'gift-bell')).toBe(0);
        state.discoveries = ['island:kodama'];
        scenery.build(state, layout, now);
        expect(named(scenery.root, 'gift-bell')).toBe(3);
    });
});
