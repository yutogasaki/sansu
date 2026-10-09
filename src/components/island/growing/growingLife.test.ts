import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { IslandMaterials } from '../three/primitives';
import { makePokomokoRig } from '../three/islandCharacters';
import { wrapPokomoko } from './actors';
import { applyIntent, newIsland } from '../../../domain/growingIsland';
import { bridgeEnd, key, landBounds, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
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

    it('plays only on an actual seat, cancels without a false use, and can repeat', () => {
        const { state, life, layout, friend } = island();
        const saved = structuredClone(state), bench = layout.point({ x: 3, z: 3 });
        life.pick(friend); life.drag(friend, bench); life.cancelCarry(friend, 100);
        expect(life.drop(friend, 110)).toBeUndefined();
        life.pick(friend); life.drag(friend, layout.point({ x: 4.4, z: 1.2 }));
        expect(life.drop(friend, 200)).toBeUndefined();
        life.pick(friend); life.drag(friend, bench);
        expect(life.drop(friend, 300)).toEqual({ kind: 'bench', cell: { x: 3, z: 3 } });
        life.tick(1400, 16, false, false);
        expect(life.objects().find(o => o.userData.actorId === friend)!.rotation.x).toBeLessThan(-.1);
        life.hop(friend, 1500);
        life.tick(1516, 16, false, false);
        expect(life.positionOf(friend)!.distanceTo(layout.point(bench))).toBeGreaterThan(.5);
        life.pick(friend); life.drag(friend, bench);
        expect(life.drop(friend, 1600)).toEqual({ kind: 'bench', cell: { x: 3, z: 3 } });
        expect(state).toEqual(saved);
    });

    it('moves the existing swing seat with its passenger and resets after play', () => {
        const { state, life, friend } = island();
        state.landmarks.push({ id: 'test-swing', kind: 'swing', cell: { x: 4, z: 3 }, growth: 0 });
        const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state), layer = buildObjectLayer(m, state, layout);
        life.sync(state, layout, layer);
        const seat = layer.swingPivots.get(key({ x: 4, z: 3 }))!;
        life.pick(friend); life.drag(friend, layout.point({ x: 4, z: 3 }));
        expect(life.drop(friend, 0)).toEqual({ kind: 'swing', cell: { x: 4, z: 3 } });
        life.tick(750, 16, false, false);
        expect(Math.abs(seat.rotation.x)).toBeGreaterThan(.1);
        const moving = life.positionOf(friend)!, center = layout.point({ x: 4, z: 3 });
        expect(moving.z - center.z).toBeCloseTo(-1.15 * Math.sin(seat.rotation.x), 4);
        expect(moving.y - center.y).toBeCloseTo(.2 + 1.15 * (1 - Math.cos(seat.rotation.x)), 4);
        life.sync(state, layout, layer);
        life.tick(1500, 16, false, false);
        expect(Math.abs(seat.rotation.x)).toBeGreaterThan(.1);
        life.tick(3900, 16, false, false);
        const leaving = life.positionOf(friend)!;
        expect(leaving.distanceTo(center)).toBeGreaterThan(.2);
        life.tick(4190, 16, false, false);
        const nearEnd = life.positionOf(friend)!;
        expect(Math.abs(seat.rotation.x)).toBeLessThan(.01);
        life.tick(4210, 16, false, false);
        expect(seat.rotation.x).toBe(0);
        expect(life.positionOf(friend)!.distanceTo(center)).toBeGreaterThan(.8);
        expect(life.positionOf(friend)!.distanceTo(nearEnd)).toBeLessThan(.1);
        if (walkableCells(state).has(key({ x: 4, z: 4 }))) expect(life.positionOf(friend)!.distanceTo(layout.point({ x: 4, z: 4 }))).toBeLessThan(.01);
        layer.dispose(); m.dispose();
    });

    it('uses one swing seat at a time, without a false play for a second friend', () => {
        const { state, life, friend } = island();
        state.landmarks.push({ id: 'test-swing', kind: 'swing', cell: { x: 4, z: 3 }, growth: 0 });
        const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state), layer = buildObjectLayer(m, state, layout);
        life.sync(state, layout, layer);
        const target = layout.point({ x: 4, z: 3 });
        life.pick(friend); life.drag(friend, target);
        expect(life.drop(friend, 0)).toEqual({ kind: 'swing', cell: { x: 4, z: 3 } });
        life.pick('pokomoko'); life.drag('pokomoko', target);
        expect(life.drop('pokomoko', 100)).toBeUndefined();
        life.tick(500, 16, false, false);
        expect(life.positionOf('pokomoko')!.distanceTo(target)).toBeGreaterThan(.5);
        expect(Math.abs(layer.swingPivots.get(key({ x: 4, z: 3 }))!.rotation.x)).toBeGreaterThan(.1);
        layer.dispose(); m.dispose();
    });

    it('keeps an ordinary hand-placed table seat for its previous seven seconds', () => {
        const { state, life, friend } = island();
        state.landmarks.push({ id: 'test-table', kind: 'picnic-table', cell: { x: 4, z: 3 }, growth: 0 });
        const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state), layer = buildObjectLayer(m, state, layout);
        life.sync(state, layout, layer);
        life.pick(friend); life.drag(friend, layout.point({ x: 4, z: 3 }));
        expect(life.drop(friend, 500)).toBeUndefined();
        life.tick(7400, 16, false, false);
        const seated = life.positionOf(friend)!;
        expect(seated.y - layout.point({ x: 4, z: 3 }).y).toBeGreaterThan(.04);
        life.tick(7600, 16, false, false);
        expect(life.positionOf(friend)!.y - layout.point({ x: 4, z: 3 }).y).toBeLessThan(.01);
        layer.dispose(); m.dispose();
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

it('lets a resident walk to the saved lookout in ordinary life and brings them ashore when removed', () => {
    const { state, life, friend } = island();
    state.bridge = { x: 2 };
    const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state), layer = buildObjectLayer(m, state, layout);
    life.sync(state, layout, layer);
    const random = vi.spyOn(Math, 'random').mockReturnValue(.01);
    try {
        let reached = false;
        for (let i = 1; i <= 25; i++) {
            life.tick(i * 1000, 1000, true, false);
            const position = life.positionOf(friend);
            if (position && layout.cellAt(position).z === bridgeEnd(state).z) reached = true;
        }
        expect(reached).toBe(true);
        delete state.bridge;
        const nextLayout = sceneLayout(state), nextLayer = buildObjectLayer(m, state, nextLayout);
        life.sync(state, nextLayout, nextLayer); life.tick(26000, 16, true, false);
        expect(nextLayout.cellAt(life.positionOf(friend)!).z).toBeLessThan(landBounds(state).depth);
        nextLayer.dispose();
    } finally { random.mockRestore(); layer.dispose(); life.dispose(); m.dispose(); }
});

function actorResources(root: T.Object3D) {
    const geometries = new Map<T.BufferGeometry, number>(), materials = new Map<T.Material, number>();
    root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        if (!geometries.has(object.geometry)) {
            const geometry = object.geometry;
            geometries.set(geometry, 0);
            geometry.addEventListener('dispose', () => geometries.set(geometry, geometries.get(geometry)! + 1));
        }
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            if (materials.has(material)) continue;
            materials.set(material, 0);
            material.addEventListener('dispose', () => materials.set(material, materials.get(material)! + 1));
        }
    });
    const sparkle = root.getObjectByName('growing-sparkle') as T.Mesh | undefined;
    const ownedMaterials = new Set(sparkle ? Array.isArray(sparkle.material) ? sparkle.material : [sparkle.material] : []);
    return {
        geometryDisposals: () => [...geometries.values()],
        ownedMaterialDisposals: () => [...materials].filter(([material]) => ownedMaterials.has(material)).map(([, count]) => count),
        sharedMaterialDisposals: () => [...materials].filter(([material]) => !ownedMaterials.has(material)).map(([, count]) => count),
    };
}

function lifecycleIsland() {
    const state = applyIntent(newIsland('actor-lifecycle-fixture', T0), { id: 'first', command: { type: 'plant', kind: 'home', cell: { x: 1, z: 3 } } }).state;
    state.arrivals = []; state.unopened = [];
    state.villagers[0].species = 'otter';
    state.villagers[0].variant = { color: 0, accessory: 0, sparkle: true };
    state.pier.visitor.species = 'otter';
    state.pier.visitor.variant = { color: 0, accessory: 0, sparkle: true };
    const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state);
    const rig = makePokomokoRig(m), originalWorld = new T.Group();
    originalWorld.add(rig.hero);
    const hero = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
    const life = new GrowingLife(m, hero), layer = buildObjectLayer(m, state, layout);
    const scene = new T.Scene(); scene.add(life.root);
    life.sync(state, layout, layer);
    return { state, m, layout, hero, originalWorld, life, layer, scene };
}

describe('GrowingLife resource ownership', () => {
    it('releases each replaced visitor while keeping the resident, hero and shared paint across 20 syncs', () => {
        const { state, m, layout, life, layer } = lifecycleIsland();
        const before = structuredClone(state), resident = life.objects().find(o => o.userData.actorId === state.villagers[0].id)!;
        const hero = life.objects().find(o => o.userData.actorId === 'pokomoko')!;
        const residentResources = actorResources(resident), heroResources = actorResources(hero);
        const visitors: ReturnType<typeof actorResources>[] = [];
        try {
            for (let i = 0; i < 20; i++) {
                const visitor = life.objects().find(o => o.userData.actorId === 'visitor')!;
                visitors.push(actorResources(visitor));
                life.sync(state, layout, layer);
                expect(visitor.parent).toBeNull();
                expect(life.objects()).toContain(resident);
                expect(life.objects()).toContain(hero);
                expect(life.actorIds()).toHaveLength(3);
            }
            for (const resources of visitors) {
                expect(resources.geometryDisposals().length).toBeGreaterThan(0);
                expect(resources.geometryDisposals().every(count => count === 1)).toBe(true);
                expect(resources.ownedMaterialDisposals()).toEqual([1]);
                expect(resources.sharedMaterialDisposals().every(count => count === 0)).toBe(true);
            }
            expect(residentResources.geometryDisposals().every(count => count === 0)).toBe(true);
            expect(heroResources.geometryDisposals().every(count => count === 0)).toBe(true);
            expect(state).toEqual(before);
        } finally { life.dispose(); layer.dispose(); m.dispose(); }
    });

    it.each(['removed', 'away'] as const)('releases a %s resident and its sparkle without releasing shared materials', reason => {
        const { state, m, layout, life, layer } = lifecycleIsland();
        const id = state.villagers[0].id, resident = life.objects().find(o => o.userData.actorId === id)!;
        const resources = actorResources(resident);
        if (reason === 'away') state.villagers[0].away = true;
        else state.villagers = [];
        try {
            life.sync(state, layout, layer);
            expect(life.actorIds()).not.toContain(id);
            expect(resident.parent).toBeNull();
            expect(resources.geometryDisposals().length).toBeGreaterThan(0);
            expect(resources.geometryDisposals().every(count => count === 1)).toBe(true);
            expect(resources.ownedMaterialDisposals()).toEqual([1]);
            expect(resources.sharedMaterialDisposals().every(count => count === 0)).toBe(true);
        } finally { life.dispose(); layer.dispose(); m.dispose(); }
    });

    it('releases final walkers and the reparented Pokomoko exactly once without disposing shared materials', () => {
        const { life, hero, originalWorld, m, layer, scene } = lifecycleIsland();
        const roots = life.objects(), resources = roots.map(actorResources);
        // One actor may use a geometry in more than one mesh; it still has one owner.
        const sharedGeometry = new T.BoxGeometry(1, 1, 1), sharedMaterial = m.surface('#123456', .7);
        hero.root.add(new T.Mesh(sharedGeometry, sharedMaterial), new T.Mesh(sharedGeometry, sharedMaterial));
        const geometryDispose = vi.spyOn(sharedGeometry, 'dispose'), materialDispose = vi.spyOn(sharedMaterial, 'dispose');
        try {
            expect(originalWorld.children).toHaveLength(0);
            expect(scene.children).toContain(life.root);
            life.dispose(); life.dispose();
            expect(life.actorIds()).toEqual([]);
            expect(life.root.parent).toBeNull();
            expect(life.root.children.length).toBe(0);
            for (const [index, actor] of resources.entries()) {
                expect(roots[index].parent).toBeNull();
                expect(actor.geometryDisposals().length).toBeGreaterThan(0);
                expect(actor.geometryDisposals().every(count => count === 1)).toBe(true);
                expect(actor.ownedMaterialDisposals().every(count => count === 1)).toBe(true);
                expect(actor.sharedMaterialDisposals().every(count => count === 0)).toBe(true);
            }
            expect(geometryDispose).toHaveBeenCalledTimes(1);
            expect(materialDispose).not.toHaveBeenCalled();
        } finally { life.dispose(); layer.dispose(); m.dispose(); }
    });
});
