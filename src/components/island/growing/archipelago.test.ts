import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { newIsland } from '../../../domain/growingIsland/island';
import { chooseTheme, grantRoutes, islandGifts, neighbors } from '../../../domain/growingIsland/journey';
import type { GrowingState } from '../../../domain/growingIsland';
import { Archipelago } from './archipelago';
import { sceneLayout } from './sceneLayout';
import { WonderScenery } from './wonderScenery';

const now = 1_800_000_000_000;
const welcomed = (state: GrowingState) => { state.villagers.push({ ...state.pier.visitor, id: 'v1', arrivedAt: 0 } as never); state.arrivals = []; return state; };
/** Home with the shore island made and a route open for the next one. */
const journeyed = () => {
    const state = welcomed(newIsland('child', now));
    grantRoutes(state, undefined, now); chooseTheme(state, 'shiokaze', 'shore-id');
    grantRoutes(state, { math: 2, vocab: 0, kokugo: 0 }, now);
    return state;
};
const named = (root: T.Object3D, name: string) => root.getObjectsByProperty('name', name).length;

describe('one archipelago (island-journey.md §3.4)', () => {
    it('sees every island from home, and home plus the others from a special island', () => {
        const state = journeyed();
        expect(neighbors(state, 'home').map(n => [n.key, n.mode])).toEqual([
            ['shiokaze', 'made'], ['kodama', 'open'], ['hikari', 'open'], ['watagumo', 'open'], ['karakuri', 'open'], ['hoshi', 'open']]);
        expect(neighbors(state, 'home')[0].islandId).toBe('shore-id');
        expect(neighbors(state, 'shiokaze').map(n => n.key)).toEqual(['home', 'kodama', 'hikari', 'watagumo', 'karakuri', 'hoshi']);
        expect(neighbors(welcomed(newIsland('child', now)), 'home').every(n => n.mode === 'fog')).toBe(true);
    });

    it('joins home to made islands by bridges and to open ones by stepping stones; mist has neither', () => {
        const state = journeyed(), scene = new T.Scene(), archipelago = new Archipelago(scene);
        archipelago.build(state, sceneLayout(state), 'home');
        expect(archipelago.targets).toHaveLength(6);
        expect(named(archipelago.root, 'archipelago-bridge')).toBe(1);
        expect(named(archipelago.root, 'archipelago-stone')).toBeGreaterThan(5 * 2);
        // From the shore island only the way home has a bridge.
        archipelago.build(state, sceneLayout(state), 'shiokaze');
        expect(named(archipelago.root, 'archipelago-bridge')).toBe(1);
        expect(named(archipelago.root, 'archipelago-stone')).toBe(0);
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
        expect(archipelago.pick(ray)).toEqual({ key: 'shiokaze', mode: 'made', islandId: 'shore-id' });
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
