import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { authoredAccessWorld } from '../../../domain/growingIsland/authoredWorldAccess.fixture';
import { compileWorldDefinition } from '../../../domain/growingIsland/worldDefinition';
import { newIsland } from '../../../domain/growingIsland/island';
import { placeGoalCatalog } from '../../../domain/growingIsland/placeCatalog';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { key, walkableCells } from '../../../domain/growingIsland/space';
import type { LandmarkKind, SeedKind } from '../../../domain/growingIsland/types';
import { sceneLayout } from './sceneLayout';
import { buildPlacePaths, placePathEdges } from './placePaths';
import { placePondGeometry, placePondMask } from './placePondGeometry';
import { buildPlaceSpring } from './placeSpringGeometry';
import { buildPlaceFlowerRoof } from './placeFlowerGeometry';
import { buildPlaceRootRoom } from './placeRootRoomGeometry';
import { GardenGeometry } from '../three/garden/geometry';
import { disposeGeometry } from '../three/primitives';

function fixture(id: 'P02' | 'P03' | 'P05') {
    const { world, definition } = authoredAccessWorld(), state = newIsland(`authored-surface-${id}`, 0);
    state.landmarks = []; state.plots = []; state.unopened = []; state.arrivals = []; state.nature.hours = 216;
    const goal = placeGoalCatalog.find(goal => goal.id === id)!, variant = goal.variants.find(variant => variant.id === (id === 'P03' ? 'tiered' : 'court'))!;
    variant.demo.forEach((entry, i) => {
        const [type, kind] = goal.inputs.find(input => input.role === entry.role)!.kind.split(':'), cell = { x: entry.x - 1, z: entry.z - 4 };
        if (type === 'landmark') state.landmarks.push({ id: `owned-${i}`, kind: kind as LandmarkKind, cell, growth: 18, maturedAt: 0, color: 'purple' });
        else state.plots.push({ id: `owned-${i}`, kind: kind as SeedKind, cell, stage: 2, style: 'tree', growth: 0, origin: 'seed', paid: 40, plantedAt: 0, builtAt: 0 });
    });
    const places = derivePlaces(state, world), place = places.find(place => place.ruleId === id)!;
    return { world, definition, state, places, place, layout: sceneLayout(state, true, world) };
}
const vertex = (mesh: T.Mesh, index: number) => new T.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), index).applyMatrix4(mesh.matrixWorld);
const release = (g: GardenGeometry) => { disposeGeometry(g.root); g.dispose(); };

describe('derived surfaces share authored floor and passage context', () => {
    it('paves actual quarter routes to negative homes and does not invent a removed walk connection', () => {
        const { world, definition } = authoredAccessWorld(), state = newIsland('authored-path', 0);
        state.landmarks = []; state.plots = [{ id: 'north-home', kind: 'home', cell: { x: 4, z: -2 }, stage: 2, growth: 0, origin: 'seed', paid: 40, plantedAt: 0 }];
        const before = structuredClone(state), layout = sceneLayout(state, true, world), edges = placePathEdges(state, [], world), path = buildPlacePaths(state, layout, []);
        expect(edges.length).toBeGreaterThan(0); expect(edges.flat().some(cell => !Number.isInteger(cell.x) || !Number.isInteger(cell.z))).toBe(true);
        for (const [a, b] of edges) expect(world.neighbors(a).map(key)).toContain(key(b));
        const positions = path.geometry.getAttribute('position'); expect(positions.count).toBeGreaterThan(0);
        for (let i = 0; i < positions.count; i++) {
            const cell = { x: positions.getX(i) + layout.center, z: positions.getZ(i) + 2 }, floor = world.floorAt(cell);
            expect(floor).toBeDefined(); expect(positions.getY(i) - floor!.point.y).toBeCloseTo(.008, 6);
        }
        definition.edges = definition.edges.filter(edge => !edge.allows.includes('walk') || !(Math.min(Number(edge.from.siteId.split(',')[0]), Number(edge.to.siteId.split(',')[0])) <= 3
            && Math.max(Number(edge.from.siteId.split(',')[0]), Number(edge.to.siteId.split(',')[0])) > 3));
        expect(placePathEdges(state, [], compileWorldDefinition(definition))).toEqual([]); expect(state).toEqual(before);
        path.geometry.dispose(); (path.material as T.Material).dispose();
    });
    it('keeps open authored ground dry while retaining owned basins and the actual dry channel crossing', () => {
        const { state, world, definition, places, place, layout } = fixture('P03'), before = structuredClone(state), open = walkableCells(state, world);
        expect(place.stage).toBe('grown'); expect(placePondGeometry(state, layout, place, places)).toBeUndefined();
        const mask = placePondMask(state, place, places, world); expect(mask.overlayAllowed).toBe(false);
        expect(mask.owners.filter(owner => owner.kind === 'water-channel')).toHaveLength(2);
        definition.edges = definition.edges.filter(edge => !edge.allows.includes('water'));
        expect(placePondMask(state, place, places, compileWorldDefinition(definition)).owners.some(owner => owner.kind === 'water-channel')).toBe(false);
        const g = new GardenGeometry(); buildPlaceSpring(g, state, layout, place, places); g.root.updateMatrixWorld(true);
        expect(g.root.getObjectByName('place-wide-shallow-water')).toBeUndefined(); expect(g.root.getObjectByName('place-owned-stream')).toBeUndefined();
        const basins = g.root.getObjectsByProperty('name', 'place-owned-basin'); expect(basins).toHaveLength(3);
        basins.forEach(group => expect(open.has(key(group.userData.cell))).toBe(false));
        const crossings = g.root.getObjectsByProperty('name', 'place-channel-crossing'); expect(crossings).toHaveLength(2);
        for (const group of crossings) {
            expect(group.userData.authoredWaterOverlay).toBe('pending'); expect(open.has(key(group.userData.cell))).toBe(true);
            const water = group.getObjectByName('place-channel-shallows') as T.Mesh, stone = group.getObjectByName('place-shallow-stepping-stone') as T.Mesh;
            for (let i = 0; i < water.geometry.getAttribute('position').count; i++) {
                const p = vertex(water, i), floor = world.floorAt({ x: p.x + layout.center, z: p.z + 2 });
                expect(floor).toBeDefined(); expect(p.y - floor!.point.y).toBeCloseTo(-.01, 6);
            }
            const p = layout.point(group.userData.cell, 1), hit = new T.Raycaster(p, new T.Vector3(0, -1, 0)).intersectObject(stone)[0];
            expect(hit.point.y).toBeCloseTo(layout.heightAt(group.userData.cell), 6);
        }
        expect(state).toEqual(before); release(g);
    });
    it('tints only actual unoccupied authored flower ground and preserves owners', () => {
        const { state, world, place, layout } = fixture('P05'), before = structuredClone(state), g = new GardenGeometry();
        expect(place.stage).toBe('grown'); buildPlaceFlowerRoof(g, state, layout, place); g.root.updateMatrixWorld(true);
        const inlay = g.root.getObjectByName('place-flower-garden-inlay') as T.Mesh; expect(inlay).toBeDefined();
        for (let i = 0; i < inlay.geometry.getAttribute('position').count; i++) {
            const p = vertex(inlay, i), floor = world.floorAt({ x: p.x + layout.center, z: p.z + 2 });
            expect(floor).toBeDefined(); expect(p.y - floor!.point.y).toBeCloseTo(.004, 6);
        }
        expect(g.root.getObjectsByProperty('name', 'place-owned-flower').map(group => group.userData.ownerId).sort()).toEqual([...place.mainIds].sort());
        expect(state).toEqual(before); release(g);
    });
    it('validates elevated authored root galleries against their logical dry route, not a planting ray hit', () => {
        const { state, world, place: derived, layout } = fixture('P02'), before = structuredClone(state), g = new GardenGeometry();
        // An explicit supported central court isolates this renderer contract.
        // This does not verify authored deck support or enable gallery use.
        const place = { ...derived, walkSurface: Array.from({ length: 49 }, (_, i) => {
            const angle = i / 48 * Math.PI * 2, cell = { x: 1 + Math.cos(angle) * .52, z: -2 + Math.sin(angle) * .52 };
            return { ...cell, y: world.floorAt(cell)!.point.y + .04 + 1.35 };
        }) };
        expect(place.stage).toBe('grown'); expect(place.variant).toBe('court');
        expect(place.walkSurface.some(point => Number.isNaN(layout.cellAt(layout.floorPoint(point)).x))).toBe(true);
        expect(buildPlaceRootRoom(g, state, layout, place)).toBe(true);
        const room = g.root.getObjectByName('place-root-room')!; expect(room.userData.supportOwnerIds).toEqual(place.mainIds);
        for (const point of room.userData.floorRoute) expect(world.floorAt(point)).toBeDefined();
        expect(state).toEqual(before); release(g);
    });
});
