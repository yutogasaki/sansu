import { expect, it } from 'vitest';
import * as T from 'three';
import { walkingPointBlocked } from '../../../domain/growingIsland/space';
import { newIsland } from '../../../domain/growingIsland/island';
import { editableTerrainSegmentSupported } from '../../../domain/growingIsland/editableTerrainWorld';
import { architectureFixture } from '../../../domain/growingIsland/placeArchitecture.fixture';
import type { DerivedPlace, PlacePoint, PlaceUseTarget } from '../../../domain/growingIsland/placeTypes';
import type { Cell } from '../../../domain/growingIsland/types';
import { IslandMaterials } from '../three/primitives';
import { GrowingLife } from './growingLife';
import { sceneLayout } from './sceneLayout';
import { buildObjectLayer } from './objectLayer';

it('cuts a route ahead of a living actor without moving its feet, then uses only actual dry routes', () => {
    const state = newIsland('edited-life', 0);
    state.tutorial = 'done'; state.plots = []; state.landmarks = []; state.keepsakes = [];
    state.terrain = { version: 1, heights: {}, undo: [], redo: [] };
    const m = new IslandMaterials('moon-garden');
    const actor = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] };
    const life = new GrowingLife(m, actor), layout = sceneLayout(state, true), layer = buildObjectLayer(m, state, layout);
    life.sync(state, layout, layer);
    // An explicit diagnostic pose in the middle of an existing edge: no saved user data is fabricated.
    const walker = (life as unknown as { walkers: Map<string, { at: Cell; path: Cell[]; mode: string; until: number }> }).walkers.get('pokomoko')!;
    walker.at = { x: 0, z: 2.25 }; walker.path = [{ x: 0, z: 2.5 }, { x: 0, z: 3 }, { x: 0, z: 4 }]; walker.mode = 'walk';
    life.tick(10, 0, true, false);
    const before = { ...walker.at }, beforePosition = actor.root.position.clone();
    const next = structuredClone(state); next.terrain!.heights = { '0,4': -4, '0,3': -4 };
    const nextLayout = sceneLayout(next, true), nextLayer = buildObjectLayer(m, next, nextLayout);
    try {
        life.sync(next, nextLayout, nextLayer);
        expect(walker.at).toEqual(before);
        expect(actor.root.position.x).toBe(beforePosition.x);
        expect(actor.root.position.z).toBe(beforePosition.z);
        expect(walker.path).toEqual([]);
        let at = { ...walker.at };
        for (let frame = 1; frame <= 300; frame++) {
            life.tick(100 + frame * 16, 16, true, false);
            expect(nextLayout.world.floorAt(walker.at)).toBeDefined();
            if (Math.hypot(walker.at.x - at.x, walker.at.z - at.z) > 1e-8)
                expect(editableTerrainSegmentSupported(nextLayout.world, at, walker.at)).toBe(true);
            expect(Math.hypot(walker.at.x - at.x, walker.at.z - at.z)).toBeLessThan(.03);
            at = { ...walker.at };
        }
    } finally { life.dispose(); layer.dispose(); nextLayer.dispose(); m.dispose(); }
});


interface DiagnosticWalker {
    at: Cell; path: Cell[]; mode: string; until: number;
    placeTarget?: { place: DerivedPlace; target: PlaceUseTarget };
    gallery?: { route: PlacePoint[]; index: number; point: PlacePoint };
}
function galleryFixture() {
    const state = architectureFixture();
    state.plots = []; state.terrain = { version: 1, heights: {}, undo: [], redo: [] };
    state.landmarks = Array.from({ length: 6 }, (_, i) => ({ id: `source-${i}`, kind: 'sapling', cell: { x: i + 1, z: 3 }, growth: 18, maturedAt: 0 }));
    const m = new IslandMaterials('moon-garden'), layout = sceneLayout(state, true);
    const actor = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] };
    const life = new GrowingLife(m, actor), layer = buildObjectLayer(m, state, layout);
    life.sync(state, layout, layer);
    const walker = (life as unknown as { walkers: Map<string, DiagnosticWalker> }).walkers.get('pokomoko')!;
    const place = layer.places.find(place => place.ruleId === 'P02')!;
    const target = place.useTargets.find(target => target.kind === 'gallery')!;
    expect(target?.route?.length).toBeGreaterThan(28);
    return { state, m, layout, actor, life, layer, walker, place, target };
}

it('keeps an approaching actor at its real fractional position when its place target revision is invalidated', () => {
    const { state, m, layout, actor, life, layer, walker, place, target } = galleryFixture();
    try {
        // Explicit diagnostic of the invalidation branch: a place revision can change
        // while its walker is still on the ground rather than occupying its deck.
        walker.at = { x: 0, z: 2.25 }; walker.path = [{ x: 0, z: 2.5 }]; walker.mode = 'walk';
        walker.placeTarget = { place: { ...place, revision: 'previous-place-revision' }, target };
        life.tick(10, 0, true, false);
        const before = { ...walker.at }, position = actor.root.position.clone();
        life.sync(state, layout, layer);
        expect(walker.at).toEqual(before); expect(actor.root.position).toEqual(position);
        expect(walker.placeTarget).toBeUndefined(); expect(walker.path).toEqual([]);
        life.tick(26, 16, true, false);
        expect(Math.hypot(walker.at.x - before.x, walker.at.z - before.z)).toBeLessThan(.03);
    } finally { life.dispose(); layer.dispose(); m.dispose(); }
});

it('keeps an occupied identical gallery across revision changes and reports its exact deck for atomic terrain protection', () => {
    const { state, m, layout, actor, life, layer, walker, place, target } = galleryFixture();
    try {
        const route = target.route!, point = { ...route[Math.min(24, route.length - 1)] };
        walker.at = { x: point.x, z: point.z }; walker.mode = 'gallery';
        walker.placeTarget = { place: { ...place, revision: 'previous-place-revision' }, target };
        walker.gallery = { route, index: Math.min(25, route.length - 1), point };
        actor.root.position.copy(layout.floorPoint(point));
        const position = actor.root.position.clone(), at = { ...walker.at }, gallery = walker.gallery;
        const snapshot = life.occupiedTerrainPlaceTargets();
        expect(snapshot).toEqual([{ placeId: place.id, targetId: target.id, route }]);
        const entryY = route[0].y; snapshot[0].route[0].y += 10; expect(walker.gallery.route[0].y).toBe(entryY);
        expect(life.terrainTransitionSafe(state)).toBe(true);
        life.sync(state, layout, layer);
        expect(walker.gallery).toBe(gallery); expect(walker.at).toEqual(at); expect(actor.root.position).toEqual(position);
        expect(walker.placeTarget?.place.revision).toBe(place.revision);
        const removed = structuredClone(state); removed.landmarks = [];
        expect(life.terrainTransitionSafe(removed)).toBe(false);
    } finally { life.dispose(); layer.dispose(); m.dispose(); }
});


it('escapes a moved house only across continuous dry ground and keeps unaffected fractional poses', () => {
    const state = newIsland('edited-owner-overlap', 0);
    state.tutorial = 'done'; state.plots = []; state.landmarks = []; state.keepsakes = [];
    state.terrain = { version: 1, heights: { '0,4': -4, '0,3': -4 }, undo: [], redo: [] };
    const m = new IslandMaterials('moon-garden');
    const actor = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] };
    const life = new GrowingLife(m, actor), layout = sceneLayout(state, true), layer = buildObjectLayer(m, state, layout);
    life.sync(state, layout, layer);
    const walker = (life as unknown as { walkers: Map<string, DiagnosticWalker> }).walkers.get('pokomoko')!;
    walker.at = { x: 0, z: 2.25 }; walker.path = []; walker.mode = 'idle';
    const before = { ...walker.at };
    const next = structuredClone(state);
    next.plots = [{ id: 'moved-home', kind: 'home', cell: { x: 0, z: 2 }, stage: 2, growth: 0, plantedAt: 0, paid: 4, origin: 'seed' }];
    const nextLayout = sceneLayout(next, true), nextLayer = buildObjectLayer(m, next, nextLayout);
    try {
        expect(walkingPointBlocked(next, before)).toBe(true);
        life.sync(next, nextLayout, nextLayer);
        expect(walker.at).not.toEqual(before);
        expect(walkingPointBlocked(next, walker.at)).toBe(false);
        expect(editableTerrainSegmentSupported(nextLayout.world, before, walker.at)).toBe(true);
        expect(actor.root.visible).toBe(true);
        life.tick(10, 0, true, false);
        expect(actor.root.position.x).toBe(nextLayout.point(walker.at).x);
        expect(actor.root.position.z).toBe(nextLayout.point(walker.at).z);
        // This legal point is closer to a blocked half-cell site than an open one.
        // Owner clearance must use the actual fractional position, not rounded sites.
        walker.at = { x: .7, z: 2 }; walker.path = []; walker.mode = 'idle';
        expect(walkingPointBlocked(next, walker.at)).toBe(false);
        const fractional = { ...walker.at };
        life.sync(next, nextLayout, nextLayer);
        expect(walker.at).toEqual(fractional);
    } finally { life.dispose(); layer.dispose(); nextLayer.dispose(); m.dispose(); }
});
