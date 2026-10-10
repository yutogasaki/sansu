import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { key, occupant, onLand, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../domain/growingIsland/types';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { GardenGeometry } from '../three/garden/geometry';
import { buildPlacePond, placePondGeometry, placePondMask, pondPointSegmentDistance } from './placePondGeometry';
import { buildPlaceSpring } from './placeSpringGeometry';
import { sceneLayout } from './sceneLayout';

function fixture(slope = true) {
    const state = newIsland('continuous-water-garden', 1_000);
    if (slope) state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
    state.landmarks = []; state.plots = []; state.keepsakes = []; state.unopened = []; state.arrivals = []; state.villagers = [];
    const left = slope ? 6 : 0, z = slope ? 4 : 2;
    for (let i = 0; i < 5; i++) state.landmarks.push({ id: `water-${i}`, kind: i % 2 ? 'water-channel' : 'water-bowl', cell: { x: left + i, z }, growth: 6 });
    state.landmarks.push({ id: 'water-flower', kind: 'flower', cell: { x: left + 2, z: z + 2 }, growth: 6 },
        { id: 'water-seat', kind: 'bench', cell: { x: left + 4, z: z + 2 }, growth: 0 });
    const places = derivePlaces(state), place = places.find(place => place.ruleId === 'P03')!;
    expect(place.stage).toBe('grown');
    return { state, place, places, layout: sceneLayout(state), left, z };
}

function faces(geometry: T.BufferGeometry, layout: ReturnType<typeof sceneLayout>) {
    const vertices = geometry.getAttribute('position'), index = geometry.getIndex()!, result: T.Vector3[][] = [];
    for (let i = 0; i < index.count; i += 3) result.push([0, 1, 2].map(offset => new T.Vector3().fromBufferAttribute(vertices, index.getX(i + offset))
        .add(new T.Vector3(layout.center, 0, 2))));
    return result;
}

function release(g: GardenGeometry) {
    const materials = new Set<T.Material>();
    g.root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        object.geometry.dispose(); for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    for (const material of materials) material.dispose(); g.dispose();
}

const samples = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [.5, .5, 0], [0, .5, .5], [.5, 0, .5], [1 / 3, 1 / 3, 1 / 3], [.2, .2, .6]];

describe('continuous shallow place water', () => {
    it('makes a broad organic water garden from current supplied owners, with a single large surface', () => {
        const { state, place, places, layout, left, z } = fixture(), pond = placePondGeometry(state, layout, place, places)!;
        const points = pond.geometry.getAttribute('position'); pond.geometry.computeBoundingBox();
        expect(pond.geometry.boundingBox!.max.z - pond.geometry.boundingBox!.min.z).toBeGreaterThan(1.8);
        const mesh = new T.Mesh(pond.geometry, new T.MeshBasicMaterial({ side: T.DoubleSide })); mesh.updateMatrixWorld(true);
        // The broad inlet occupies both sides of a supplied crossing, beyond the old .9m circle.
        for (const offset of [-.95, .95]) {
            const cell = { x: left + 3, z: z + offset }, point = layout.point(cell, 2);
            expect(new T.Raycaster(point, new T.Vector3(0, -1, 0)).intersectObject(mesh)).not.toHaveLength(0);
        }
        const colors = pond.geometry.getAttribute('color'); expect(colors.count).toBe(points.count);
        expect(new Set(Array.from(colors.array).map(value => value.toFixed(2))).size).toBeGreaterThan(15);
        const g = new GardenGeometry(); buildPlacePond(g, state, layout, place, places);
        expect(g.root.children).toHaveLength(1); expect(g.root.children[0].name).toBe('place-continuous-water-garden');
        expect(g.root.children[0].userData.waterOwners).toEqual(['water-0', 'water-1', 'water-2', 'water-3', 'water-4']);
        expect(state.landmarks.some(item => item.id === g.root.children[0].userData.ownerId && item.kind === 'water-bowl')).toBe(true);
        pond.geometry.dispose(); (mesh.material as T.Material).dispose(); release(g);
    });

    it('keeps all actual triangle samples inside owned, home-reachable, free place cells and off dry paths', () => {
        const { state, place, places, layout } = fixture(), pond = placePondGeometry(state, layout, place, places)!;
        const footprint = new Set(place.footprint.map(key)), reached = reachableFromHome(state), open = walkableCells(state);
        for (const face of faces(pond.geometry, layout)) for (const weights of samples) {
            const point = new T.Vector3(); face.forEach((vertex, i) => point.addScaledVector(vertex, weights[i]));
            const cell = { x: Math.round(point.x), z: Math.round(point.z) }, item = occupant(state, cell);
            expect(onLand(state, cell) && footprint.has(key(cell)) && reached.has(key(cell)) && open.has(key(cell))).toBe(true);
            expect(!item || item.type === 'landmark' && pond.mask.owners.some(owner => owner.id === item.id && owner.kind === 'water-channel')).toBe(true);
            for (const [a, b] of pond.mask.paths) expect(pondPointSegmentDistance(point, a, b)).toBeGreaterThanOrEqual(.27 - 1e-6);
            for (const shore of pond.mask.shores) expect(Math.hypot(point.x - shore.x, point.z - shore.z)).toBeGreaterThanOrEqual(.28 - 1e-6);
        }
        pond.geometry.dispose();
    });

    it('matches the real shared ground at vertices and triangle interiors, keeping actual foot level one centimetre above water', () => {
        for (const slope of [true, false]) {
            const { state, place, places, layout } = fixture(slope), pond = placePondGeometry(state, layout, place, places)!;
            const g = new GardenGeometry(); buildPlacePond(g, state, layout, place, places); g.root.updateMatrixWorld(true);
            const mesh = g.root.getObjectByName('place-wide-shallow-water') as T.Mesh;
            const allFaces = faces(pond.geometry, layout);
            for (let i = 0; i < allFaces.length; i += 7) {
                const face = allFaces[i];
                for (const weights of samples) {
                    const point = new T.Vector3(); face.forEach((vertex, j) => point.addScaledVector(vertex, weights[j]));
                    expect(point.y).toBeCloseTo(layout.heightAt(point) + .03, 5);
                    expect(layout.point(point).y - point.y).toBeCloseTo(.01, 5);
                }
                const center = face.reduce((sum, vertex) => sum.add(vertex), new T.Vector3()).multiplyScalar(1 / 3);
                const hit = new T.Raycaster(layout.point(center, 2), new T.Vector3(0, -1, 0)).intersectObject(mesh)[0];
                expect(hit.point.y).toBeCloseTo(layout.heightAt(center) + .03, 5);
            }
            pond.geometry.dispose(); release(g);
        }
    });

    it('excludes farm soil, wild plants, other owners, home fronts and bridge shore without changing walkable rules', () => {
        const { state, place, places, layout, left, z } = fixture();
        const obstacles: Cell[] = [{ x: left + 1, z: z - 1 }, { x: left + 3, z: z + 1 }, { x: left, z: z + 1 }, { x: left + 4, z: z - 1 }];
        state.plots.push({ id: 'farm', kind: 'farm', cell: obstacles[0], plantedAt: 0, stage: 1, growth: 6, origin: 'seed', paid: 20 },
            { id: 'wild', kind: 'wild', cell: obstacles[1], plantedAt: 0, stage: 1, growth: 6, origin: 'spread', paid: 0 },
            { id: 'home', kind: 'home', cell: { x: left, z }, plantedAt: 0, stage: 2, growth: 6, origin: 'seed', paid: 40 });
        state.keepsakes.push({ id: 'keepsake', unitId: 'test', cell: obstacles[3] });
        state.landmarks.push({ id: 'unrelated-flower', kind: 'flower', cell: { x: left + 2, z: z - 1 }, growth: 6 });
        const before = structuredClone(state), open = walkableCells(state), mask = placePondMask(state, place, places);
        expect(open.has(key(obstacles[0])) && open.has(key(obstacles[1]))).toBe(true);
        for (const cell of [...obstacles, { x: left + 2, z: z - 1 }]) expect(mask.allowed.has(key(cell))).toBe(false);
        const pond = placePondGeometry(state, layout, place, places)!;
        for (const face of faces(pond.geometry, layout)) {
            const center = face.reduce((sum, point) => sum.add(point), new T.Vector3()).multiplyScalar(1 / 3);
            expect(mask.allowed.has(key({ x: Math.round(center.x), z: Math.round(center.z) }))).toBe(true);
        }
        const shoreState = structuredClone(state); shoreState.bridge = { x: left + 1 };
        const bridgeCell = { x: left + 1, z: 7 }, shorePlace = { ...place, footprint: [...place.footprint, bridgeCell] };
        expect(placePondMask(shoreState, shorePlace, places).allowed.has(key(bridgeCell))).toBe(false);
        expect(state).toEqual(before); expect(walkableCells(state)).toEqual(open); pond.geometry.dispose();
    });

    it('keeps the actual current path network for all places and the shore actor approach dry', () => {
        const { state, place, layout, left, z } = fixture();
        const otherPlace: DerivedPlace = { ...place, id: 'other-place', ruleId: 'P05', family: 'flowers', entrances: [{ x: left + 2, z: z + 1 }], useTargets: [] };
        const allPlaces = [place, otherPlace], mask = placePondMask(state, place, allPlaces);
        expect(mask.paths.some(([a, b]) => a.z === z + 1 || b.z === z + 1)).toBe(true);
        for (const [a, b] of mask.paths) for (const t of [0, .25, .5, .75, 1]) {
            const point = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
            expect(mask.field(point)).toBeLessThan(0);
        }
        for (const shore of mask.shores) expect(mask.field(shore)).toBeLessThan(0);
        const pond = placePondGeometry(state, layout, place, allPlaces)!;
        expect(pond.mask.paths).toEqual(mask.paths); pond.geometry.dispose();
    });

    it('does not extend from dry channels or young places and preserves save, soil and the complete place projection', () => {
        const { state, place, places, layout } = fixture(), before = structuredClone(state), projection = structuredClone(derivePlaces(state));
        const dry = { id: 'dry-channel', kind: 'water-channel' as const, cell: { x: 1, z: 7 }, growth: 0 };
        state.landmarks.push(dry);
        const expanded = { ...place, mainIds: [...place.mainIds, dry.id], waterRefs: [...place.waterRefs, dry.id], footprint: [...place.footprint, dry.cell] };
        const mask = placePondMask(state, expanded, places);
        expect(mask.owners.some(owner => owner.id === dry.id)).toBe(false);
        expect(mask.field(dry.cell)).toBeLessThan(0);
        for (const stage of ['seeded', 'connected'] as const) expect(placePondGeometry(state, layout, { ...place, stage }, places)).toBeUndefined();
        const withoutSources: GrowingState = { ...state, landmarks: state.landmarks.filter(item => item.kind !== 'water-bowl') };
        expect(placePondGeometry(withoutSources, layout, expanded, places)).toBeUndefined();
        state.landmarks.pop(); const g = new GardenGeometry(); buildPlaceSpring(g, state, layout, place, places);
        expect(g.root.getObjectByName('place-wide-shallow-water')).toBeDefined();
        const channelGroups = g.root.children.filter(group => group.name === 'place-channel-crossing');
        expect(channelGroups.map(group => group.userData.ownerId)).toEqual(['water-1', 'water-3']);
        expect(state).toEqual(before); expect(derivePlaces(state)).toEqual(projection);
        const reversed = { ...state, landmarks: [...state.landmarks].reverse() };
        const a = placePondGeometry(state, layout, place, places)!, b = placePondGeometry(reversed, layout, place, places)!;
        expect(Array.from(a.geometry.getAttribute('position').array)).toEqual(Array.from(b.geometry.getAttribute('position').array));
        expect(Array.from(a.geometry.getIndex()!.array)).toEqual(Array.from(b.geometry.getIndex()!.array));
        a.geometry.dispose(); b.geometry.dispose(); release(g);
    });
});
