import * as T from 'three';
import { describe, expect, it } from 'vitest';
import { architectureFixture } from '../../../domain/growingIsland/placeArchitecture.fixture';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { key, walkableCells } from '../../../domain/growingIsland/space';
import { buildPlaceGeometry } from './placeGeometry';
import { buildCommunityRoofs } from './placeCommunityRoofGeometry';
import { buildPlaceFlowerRoof } from './placeFlowerGeometry';
import { sceneLayout } from './sceneLayout';
import { GardenGeometry } from '../three/garden/geometry';
import { disposeGeometry } from '../three/primitives';
import { ROOT_ROOM_ACTOR_HEIGHT } from './placeRootRoomGeometry';

describe('full-body clearance of growing architecture', () => {
    it('keeps an established flower roof at its original extent after a fifth flower blooms', () => {
        const state = architectureFixture(); state.plots = [];
        state.landmarks = [[2, 2], [3, 2], [2, 3], [3, 3]].map(([x, z], i) => ({ id: `f${i}`, kind: 'flower', cell: { x, z }, growth: 6 }));
        const layout = sceneLayout(state, true), render = () => {
            const place = derivePlaces(state).find(p => p.ruleId === 'P05')!, g = new GardenGeometry();
            buildPlaceFlowerRoof(g, state, layout, place); g.root.updateMatrixWorld(true); return g;
        };
        const original = render(), bounds = new T.Box3().setFromObject(original.root.getObjectByName('place-flower-canopy')!);
        state.landmarks.push({ id: 'extra', kind: 'flower', cell: { x: 4, z: 3 }, growth: 6 });
        const next = render(), roofs = next.root.getObjectsByProperty('name', 'place-flower-canopy');
        expect(roofs).toHaveLength(1); expect(new T.Box3().setFromObject(roofs[0])).toEqual(bounds);
        expect(roofs[0].userData.ownerIds).toEqual(['f0', 'f1', 'f2', 'f3']);
        expect(next.root.getObjectsByProperty('name', 'place-owned-flower').map(owner => owner.userData.ownerId).sort()).toEqual(['extra', 'f0', 'f1', 'f2', 'f3']);
        roofs[0].traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            const positions = object.geometry.getAttribute('position');
            for (let i = 0; i < positions.count; i++) {
                const point = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                expect(point.y - layout.heightAt(layout.logicalAt(point))).toBeGreaterThan(ROOT_ROOM_ACTOR_HEIGHT);
            }
        });
        original.dispose(); next.dispose();
    });
    for (const curved of [false, true]) it(`keeps the actual shared roof and supports clear of all walkable ground (curved=${curved})`, () => {
        const state = architectureFixture(), before = structuredClone(state), layout = sceneLayout(state, curved), place = derivePlaces(state).find(p => p.ruleId === 'P04')!;
        const g = new GardenGeometry(); buildCommunityRoofs(g, state, layout, place); g.root.updateMatrixWorld(true);
        expect(g.root.getObjectsByProperty('name', 'place-community-roof')).toHaveLength(1);
        const open = walkableCells(state), sourceCells = state.plots.map(home => key(home.cell!));
        g.root.traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            const p = object.geometry.getAttribute('position');
            for (let i = 0; i < p.count; i++) {
                const point = new T.Vector3().fromBufferAttribute(p, i).applyMatrix4(object.matrixWorld);
                const cell = layout.logicalAt(point), height = point.y - layout.heightAt(cell);
                if (height <= ROOT_ROOM_ACTOR_HEIGHT) { expect(sourceCells).toContain(key(layout.cellAt(point))); expect(open.has(key(layout.cellAt(point)))).toBe(false); }
            }
        });
        const panel = g.root.getObjectByName('place-community-pearl-panel') as T.Mesh;
        expect(panel.userData.walkSurface).toBeUndefined();
        for (const id of place.mainIds) expect(g.root.getObjectsByProperty('name', 'place-community-owner-support').some(root => root.userData.ownerId === id)).toBe(true);
        expect(state).toEqual(before); disposeGeometry(g.root); g.dispose();
    });
    it('extends a six-owner flower row as repeated safe arches while preserving every original color', () => {
        const state = architectureFixture(); state.plots = [];
        state.landmarks = Array.from({ length: 6 }, (_, x) => ({ id: `f${x}`, kind: 'flower', cell: { x: x + 1, z: 3 }, growth: 6, color: x % 2 ? 'blue' : 'red' }));
        const before = structuredClone(state), place = derivePlaces(state).find(p => p.ruleId === 'P05')!, layout = sceneLayout(state, true), g = new GardenGeometry();
        expect(place.structure).toBe('P05:arch'); buildPlaceFlowerRoof(g, state, layout, place); g.root.updateMatrixWorld(true);
        const roof = g.root.getObjectByName('place-flower-canopy')!;
        expect(g.root.getObjectsByProperty('name', 'place-owned-flower').map(owner => owner.userData.ownerId).sort()).toEqual(place.mainIds.slice().sort());
        roof.traverse(object => { if (!(object instanceof T.Mesh)) return; const positions = object.geometry.getAttribute('position');
            for (let i = 0; i < positions.count; i++) { const point = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                expect(point.y - layout.heightAt(layout.logicalAt(point))).toBeGreaterThan(ROOT_ROOM_ACTOR_HEIGHT); }
        });
        expect(state).toEqual(before); disposeGeometry(g.root); g.dispose();
    });
    it('draws real boards for six mature trees and keeps the same owned inputs after a split', () => {
        const state = architectureFixture(); state.plots = [];
        state.landmarks = Array.from({ length: 6 }, (_, x) => ({ id: `t${x}`, kind: 'sapling', cell: { x: x + 1, z: 3 }, growth: 18, maturedAt: 0 }));
        const before = structuredClone(state), place = derivePlaces(state).find(p => p.ruleId === 'P02')!, root = buildPlaceGeometry(state, sceneLayout(state), [place]);
        expect(root.getObjectByName('place-physical-gallery')?.userData.floorRoute).toEqual(place.walkSurface);
        expect(root.getObjectsByProperty('name', 'place-owned-tree')).toHaveLength(6); expect(state).toEqual(before);
        state.landmarks[3].cell = undefined;
        state.landmarks[4].cell = undefined;
        expect(derivePlaces(state).filter(p => p.ruleId === 'P02')).toEqual([]);
        const facts = (owners: typeof state.landmarks) => owners.map(owner => { const copy = { ...owner }; delete copy.cell; return copy; });
        expect(facts(state.landmarks)).toEqual(facts(before.landmarks));
        disposeGeometry(root);
    });
});
