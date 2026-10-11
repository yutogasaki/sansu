import { expect, it, vi } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland';
import { authoredAccessWorld } from '../../../domain/growingIsland/authoredWorldAccess.fixture';
import { compileWorldDefinition } from '../../../domain/growingIsland/worldDefinition';
import { IslandMaterials } from '../three/primitives';
import { makePokomokoRig } from '../three/islandCharacters';
import { wrapPokomoko, type Actor } from './actors';
import { actorFootMinY, actorSeatContact, actorSeatSurface, actorSurfaceY } from './actorScale';
import { GrowingLife } from './growingLife';
import { sceneLayout } from './sceneLayout';
import { buildObjectLayer } from './objectLayer';

function fixture() {
    const state = newIsland('authored-actor-scale', 1000), { definition } = authoredAccessWorld();
    definition.districts[0].floors[0].vertices.forEach(vertex => { vertex.point.y = 1.5; });
    const world = compileWorldDefinition(definition), layout = sceneLayout(state, false, world), m = new IslandMaterials('moon-garden');
    state.plots = [{ id: 'home', kind: 'home', cell: { x: 1, z: 1 }, stage: 2, plantedAt: 0, growth: 0, origin: 'seed', paid: 40 }];
    state.landmarks = [{ id: 'bench', kind: 'bench', cell: { x: 3, z: 2 }, growth: 0 }, { id: 'swing', kind: 'swing', cell: { x: 4, z: 2 }, growth: 0 }];
    state.arrivals = []; state.unopened = [];
    state.villagers = [{ id: 'friend', species: 'rabbit', home: 'home', arrivedAt: 0, trait: 'mellow', variant: { color: 0, accessory: 0, sparkle: false } }];
    const rig = makePokomokoRig(m), hero = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
    const life = new GrowingLife(m, hero), layer = buildObjectLayer(m, state, layout);
    const scene = new T.Scene(); scene.add(layer.root, life.root);
    life.sync(state, layout, layer);
    // Read actor references only; navigation/mode are changed through real methods.
    const actors = () => [...(life as unknown as { walkers: Map<string, { actor: Actor }> }).walkers.values()].map(walker => walker.actor);
    const actor = (id: string) => actors().find(actor => actor.id === id)!;
    return { state, world, layout, m, life, layer, actors, actor, hero, dispose: () => { life.dispose(); layer.dispose(); m.dispose(); } };
}

it('applies .45 to existing hero/resident and every new visitor, restoring legacy1 without world-root scaling or saved writes', () => {
    const f = fixture(), before = structuredClone(f.state), hero = f.hero, friend = f.actor('friend');
    const at = friend.root.position.toArray(), pose = friend.visual!.children[0];
    try {
        for (let i = 0; i < 3; i++) {
            f.life.sync(f.state, f.layout, f.layer);
            expect(f.actor('pokomoko')).toBe(hero); expect(f.actor('friend')).toBe(friend);
            f.actors().forEach(actor => { expect(actor.visual!.scale.toArray()).toEqual([.45, .45, .45]); expect(actor.root.scale.toArray()).toEqual([1, 1, 1]); });
            expect(friend.root.position.toArray()).toEqual(at); expect(pose.scale.toArray()).toEqual([.7, .7, .7]);
        }
        const legacy = sceneLayout(f.state); expect(legacy.actorVisualScale).toBe(1);
        f.life.sync(f.state, legacy, f.layer);
        f.actors().forEach(actor => { expect(actor.visual!.scale.toArray()).toEqual([1, 1, 1]); expect(actor.visual!.position.toArray()).toEqual([0, 0, 0]); });
        expect(f.actor('friend')).toBe(friend); expect(f.actor('pokomoko')).toBe(hero); expect(f.state).toEqual(before);
    } finally { f.dispose(); }
});

it('keeps soles on the actual ground, with actor-relative carry/hop heights and a focus at the scaled visible actor', () => {
    const f = fixture(), before = structuredClone(f.state), random = vi.spyOn(Math, 'random').mockReturnValue(.99);
    try {
        f.life.tick(0, 0, true, false);
        for (const id of ['pokomoko', 'friend']) {
            const actor = f.actor(id), cell = f.layout.logicalAt(actor.root.position);
            expect(actorFootMinY(actor)).toBeCloseTo(f.layout.point(cell, 0).y, 8);
        }
        expect(f.life.pick('friend')).toBe(true); f.life.drag('friend', f.layout.point({ x: 2, z: 2 }));
        f.life.tick(100, 0, true, false);
        expect(f.life.positionOf('friend')!.toArray()).toEqual(f.layout.point({ x: 2, z: 2 }).add(new T.Vector3(0, .55 * .45, 0)).toArray());
        expect(actorFootMinY(f.actor('friend'))).toBeCloseTo(1.5 + .55 * .45, 8);
        const bounds = new T.Box3().setFromObject(f.actor('friend').root, true);
        expect(f.life.focusPositionOf('friend')!.toArray()).toEqual(bounds.getCenter(new T.Vector3()).toArray());
        f.life.cancelCarry('friend', 100); f.life.hop('friend', 100); f.life.tick(360, 0, true, false);
        expect(actorFootMinY(f.actor('friend'))).toBeCloseTo(1.5 + .08 * .45, 8);
        expect(f.state).toEqual(before);
    } finally { random.mockRestore(); f.dispose(); }
});

it.each(['bench', 'swing'] as const)('uses the unchanged actual %s seat surface, keeps its world trajectory, and exits to ground', kind => {
    const f = fixture(), cell = { x: kind === 'bench' ? 3 : 4, z: 2 }, random = vi.spyOn(Math, 'random').mockReturnValue(.99);
    try {
        f.life.pick('friend'); f.life.drag('friend', f.layout.point(cell));
        expect(f.life.drop('friend', 0)).toEqual({ kind, cell }); f.life.tick(750, 0, false, false);
        const actor = f.actor('friend'), contact = actorSeatContact(actor)!, seat = actorSeatSurface(f.layer.objects.get(kind), kind === 'bench' ? 'sit' : 'swing')!, seatY = actorSurfaceY(seat, contact)!;
        expect(contact.y).toBeCloseTo(seatY, 8);
        assertFeetOutsideSeat(actor, seat);
        const center = f.layout.point(cell);
        if (kind === 'swing') {
            const angle = f.layer.swingPivots.get(`${cell.x},${cell.z}`)!.rotation.x;
            expect(actor.root.position.z - center.z).toBeCloseTo(-1.15 * Math.sin(angle), 8);
            expect(actor.root.position.y - center.y).toBeCloseTo(.2 + 1.15 * (1 - Math.cos(angle)), 8);
        } else expect(actor.root.position.y - center.y).toBeCloseTo(.16, 8);
        f.life.tick(4190, 0, false, false); expect(Number.isFinite(actorFootMinY(actor))).toBe(true);
        f.life.tick(4210, 0, true, false); expect(actorFootMinY(actor)).toBeCloseTo(1.5, 8);
    } finally { random.mockRestore(); f.dispose(); }
});

function assertFeetOutsideSeat(actor: Actor, seat: T.Mesh) {
    seat.geometry.computeBoundingBox(); const bounds = seat.geometry.boundingBox!, inverse = seat.matrixWorld.clone().invert();
    for (const foot of actor.feet) foot.traverse(node => {
        if (!(node instanceof T.Mesh)) return;
        const positions = node.geometry.getAttribute('position'), transform = inverse.clone().multiply(node.matrixWorld), point = new T.Vector3();
        for (let i = 0; i < positions.count; i++) {
            point.fromBufferAttribute(positions, i).applyMatrix4(transform);
            expect(point.y).toBeGreaterThan(bounds.max.y);
        }
    });
}

it.each(['bench', 'swing'] as const)('uses the real %s seat in reduced motion and keeps feet clear through the existing play poses', kind => {
    const f = fixture(), cell = { x: kind === 'bench' ? 3 : 4, z: 2 }, random = vi.spyOn(Math, 'random').mockReturnValue(.99);
    try {
        const actor = f.actor('friend'), neutralFeet = actor.feet.map(foot => foot.position.toArray());
        f.life.pick('friend'); f.life.drag('friend', f.layout.point(cell)); f.life.drop('friend', 0);
        for (const [time, reduced] of [[0, true], [500, false], [1800, false], [3000, true]] as const) {
            f.life.tick(time, 0, reduced, false);
            const seat = actorSeatSurface(f.layer.objects.get(kind), kind === 'bench' ? 'sit' : 'swing')!, contact = actorSeatContact(actor)!;
            expect(contact.y).toBeCloseTo(actorSurfaceY(seat, contact)!, 8);
            assertFeetOutsideSeat(actor, seat);
        }
        f.life.tick(4199, 0, true, false);
        expect(actorFootMinY(actor)).toBeCloseTo(1.5, 4);
        actor.feet.forEach((foot, i) => foot.position.toArray().forEach((value, axis) => expect(value).toBeCloseTo(neutralFeet[i][axis], 4)));
        f.life.tick(4210, 0, true, false);
        expect(actor.feet.map(foot => foot.position.toArray())).toEqual(neutralFeet);
    } finally { random.mockRestore(); f.dispose(); }
});

it('anchors the small visitor to actual boat and pier faces without rescaling either world model', () => {
    const f = fixture();
    try {
        f.state.town.clock = 0; f.state.pier.dockAt = 100; f.life.sync(f.state, f.layout, f.layer);
        f.layer.visitorBoat.position.copy(f.layout.dock); f.layer.visitorBoat.visible = true;
        f.life.tick(0, 0, true, false);
        const visitor = f.actor('visitor'), surfaceY = actorSurfaceY(f.layer.visitorBoat, visitor.root.position)!;
        expect(actorFootMinY(visitor)).toBeCloseTo(surfaceY, 8);
        expect(visitor.root.position.toArray()).toEqual(f.layer.visitorBoat.position.clone().add(new T.Vector3(0, .12, 0)).toArray());
        f.state.town.clock = 100; f.life.sync(f.state, f.layout, f.layer); f.life.tick(0, 0, true, false);
        const waiting = f.actor('visitor'), pierY = actorSurfaceY(f.layer.root.getObjectByName('growing-pier'), f.layout.pierEnd)!;
        expect(actorFootMinY(waiting)).toBeCloseTo(pierY, 8); expect(waiting.visual!.scale.x).toBe(.45);
        expect(waiting.root.position.toArray()).toEqual(f.layout.pierEnd.toArray());
    } finally { f.dispose(); }
});
