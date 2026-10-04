import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { IslandMaterials } from '../three/primitives';
import { applyIntent, newIsland } from '../../../domain/growingIsland';
import { key, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import { GrowingLife, VISIBLE_WALKERS } from './growingLife';
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

it('finds the home of a resident outside the walker budget or asleep without adding actors or saving changes', () => {
    const { state, life } = island();
    state.land.expanded = 'east';
    state.plots = Array.from({ length: 7 }, (_, x) => ({ ...state.plots[0], id: `home-${x}`, stage: 3, cell: { x, z: 3 } }));
    state.villagers = Array.from({ length: 13 }, (_, i) => ({ ...state.villagers[0], id: `friend-${i}`, arrivedAt: i, home: `home-${Math.floor(i / 2)}` }));
    const before = structuredClone(state), layout = sceneLayout(state), m = new IslandMaterials('moon-garden');
    const layer = buildObjectLayer(m, state, layout);
    life.sync(state, layout, layer); life.tick(0, 0, true, false);
    const ids = life.actorIds();
    expect(ids.filter(id => id.startsWith('friend-'))).toHaveLength(VISIBLE_WALKERS);
    expect(life.positionOf('friend-0')).toBeUndefined();
    expect(life.focusPositionOf('friend-0')).toEqual(layout.point({ x: 0, z: 3 }));
    expect(life.focusPositionOf('friend-12')).toEqual(life.positionOf('friend-12'));
    life.tick(0, 0, true, true);
    expect(life.positionOf('friend-12')).toBeUndefined();
    expect(life.focusPositionOf('friend-12')).toEqual(layout.point({ x: 6, z: 3 }));
    expect(life.focusPositionOf('unknown')).toBeUndefined();
    expect(life.actorIds()).toEqual(ids);
    expect(state).toEqual(before);
    life.dispose(); layer.dispose(); m.dispose();
});


it('starts residents on the doorstep-connected side of a reachable home, not an isolated neighbour', () => {
    const state = newIsland('spawn-regression', T0);
    state.arrivals = []; state.unopened = [];
    state.plots = [
        { id: 'north-home', kind: 'home', cell: { x: 1, z: 0 }, stage: 2, style: 'tree', plantedAt: 0, growth: 0, origin: 'seed', paid: 4 },
        { id: 'east-home', kind: 'home', cell: { x: 4, z: 1 }, stage: 2, style: 'plain', plantedAt: 0, growth: 0, origin: 'seed', paid: 4 },
        { id: 'edge-home', kind: 'home', cell: { x: 5, z: 3 }, stage: 2, style: 'water', plantedAt: 0, growth: 0, origin: 'seed', paid: 4 },
    ];
    state.landmarks.push({ id: 'east-tree', kind: 'sapling', cell: { x: 5, z: 0 }, growth: 18, maturedAt: 0 },
        { id: 'middle-tree', kind: 'sapling', cell: { x: 4, z: 2 }, growth: 18, maturedAt: 0 });
    state.villagers = [{ id: 'north', species: 'girl', home: 'north-home', arrivedAt: 0, trait: 'mellow', variant: { color: 0, accessory: 0, sparkle: false } },
        { id: 'east', species: 'otter', home: 'east-home', arrivedAt: 0, trait: 'mellow', variant: { color: 0, accessory: 0, sparkle: false } }];
    const before = structuredClone(state), m = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
    const life = new GrowingLife(m, { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] });
    life.sync(state, layout, buildObjectLayer(m, state, layout));
    life.tick(0, 0, true, false);
    const open = walkableCells(state), reached = reachableFromHome(state);
    for (const id of ['north', 'east']) {
        const actor = life.objects().find(o => o.userData.actorId === id)!;
        const cell = layout.cellAt(actor.position);
        expect(open.has(key(cell))).toBe(true);
        expect(reached.has(key(cell))).toBe(true);
    }
    expect(state).toEqual(before);
});
