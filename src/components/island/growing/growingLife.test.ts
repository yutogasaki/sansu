import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { IslandMaterials } from '../three/primitives';
import { applyIntent, newIsland } from '../../../domain/growingIsland';
import { GrowingLife } from './growingLife';
import { buildObjectLayer } from './objectLayer';
import { sceneLayout } from './sceneLayout';

const T0 = Date.UTC(2026, 8, 29, 9);

function island() {
    const state = applyIntent(newIsland('kid', T0), { id: 'first', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }).state;
    state.arrivals = []; state.unopened = [];
    const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
    const pokomoko = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] };
    pokomoko.root.userData.actorId = 'pokomoko';
    const life = new GrowingLife(m, pokomoko), layer = buildObjectLayer(m, state, layout);
    life.sync(state, layout, layer);
    return { state, life, layout, friend: state.villagers[0].id };
}

describe('picking up a friend', () => {
    it('follows the finger and sits on the bench it is dropped on', () => {
        const { life, layout, friend } = island();
        expect(life.pick(friend)).toBe(true);
        life.drag(friend, layout.point({ x: 3, z: 3 }));
        life.drop(friend, 1000);
        life.tick(1100, 16, true, false);
        const actor = life.objects().find(o => o.userData.actorId === friend)!;
        expect(actor.position.x).toBeCloseTo(layout.point({ x: 3, z: 3 }).x, 5);
        expect(actor.position.y).toBeGreaterThan(layout.point({ x: 3, z: 3 }).y + .1);
    });

    it('lands on open ground when dropped anywhere else, and never picks the friend on the boat', () => {
        const { life, layout, friend } = island();
        expect(life.pick('visitor')).toBe(false);
        life.pick(friend); life.drag(friend, layout.point({ x: 4.4, z: 1.2 })); life.drop(friend, 0);
        life.tick(10, 16, true, false);
        const actor = life.objects().find(o => o.userData.actorId === friend)!;
        const cell = layout.cellAt(actor.position);
        expect(Number.isInteger(cell.x) && Number.isInteger(cell.z)).toBe(true);
    });

    it('sends friends home to sleep at night, while Pokomoko stays out', () => {
        const { life, friend } = island();
        life.tick(0, 16, true, true);
        const ids = life.objects().map(o => o.userData.actorId);
        expect(ids).toContain('pokomoko');
        expect(ids).not.toContain(friend);
    });
});
