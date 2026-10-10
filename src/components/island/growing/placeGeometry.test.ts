import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { placeGoalCatalog } from '../../../domain/growingIsland/placeCatalog';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { derivePlaceRelations } from '../../../domain/growingIsland/placeRelations';
import { terrainHeightAt } from '../../../domain/growingIsland/placeTerrain';
import { key, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import type { GrowingState, LandmarkKind, SeedKind } from '../../../domain/growingIsland/types';
import type { PlaceGoalId } from '../../../domain/growingIsland/placeTypes';
import { IslandMaterials } from '../three/primitives';
import { buildObjectLayer } from './objectLayer';
import { buildPlaceGeometry } from './placeGeometry';
import { buildPlaceGround } from './placeGround';
import { sceneLayout } from './sceneLayout';
import { GrowingLife } from './growingLife';
import { buildPier } from './pierGeometry';

// Explicit mature render fixtures. These do not claim elapsed real time or acquisition.
function fixture(goalId: PlaceGoalId, variantId: string): GrowingState {
    const state = newIsland('place-render-fixture', 1000);
    state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
    state.nature.hours = 200; state.landmarks = []; state.plots = []; state.unopened = []; state.arrivals = [];
    const goal = placeGoalCatalog.find(goal => goal.id === goalId)!;
    const variant = goal.variants.find(variant => variant.id === variantId)!;
    const offset = goalId === 'P03' && variantId !== 'tiered' ? { x: 0, z: variantId === 'shore' ? 3 : 2 } : { x: 6, z: 1 };
    variant.demo.forEach((entry, i) => {
        const [type, kind] = goal.inputs.find(input => input.role === entry.role)!.kind.split(':');
        const cell = { x: entry.x + offset.x, z: entry.z + offset.z }, id = `${goalId}-${i}`;
        if (type === 'landmark') state.landmarks.push({ id, kind: kind as LandmarkKind, cell, growth: kind === 'sapling' ? 18 : 6, maturedAt: 0 });
        else state.plots.push({ id, kind: kind as SeedKind, cell, plantedAt: 0, builtAt: 6, stage: kind === 'home' ? 2 : 1, style: goalId === 'P02' ? 'tree' : 'plain', growth: 0, origin: 'seed', paid: 40 });
    });
    const home = state.plots.find(p => p.kind === 'home');
    if (home) state.villagers = [{ id: 'fixture-resident', species: 'girl', trait: 'mellow', variant: { color: 0, accessory: 0, sparkle: false }, home: home.id, arrivedAt: 0 }];
    else state.villagers = [];
    return state;
}

function meshes(root: T.Object3D) { const result: T.Mesh[] = []; root.traverse(object => { if (object instanceof T.Mesh) result.push(object); }); return result; }

describe('physical place geometry from owned inputs', () => {
    for (const goal of placeGoalCatalog.filter(goal => goal.id !== 'P06')) for (const variant of goal.variants) {
        it(`${goal.id}/${variant.id} produces real volume, per-owner hits and an unchanged inventory`, () => {
            const state = fixture(goal.id, variant.id), saved = structuredClone(state), layout = sceneLayout(state), places = derivePlaces(state);
            const m = new IslandMaterials('moon-garden'), layer = buildObjectLayer(m, state, layout);
            const place = places.find(place => place.ruleId === goal.id)!;
            const model = layer.placeRoot.children.find(child => child.userData.placeId === place.id)!;
            expect(model).toBeDefined();
            const size = new T.Box3().setFromObject(model).getSize(new T.Vector3());
            expect(size.x + size.z).toBeGreaterThan(1.5);
            expect(size.y).toBeGreaterThan(goal.id === 'P03' ? .3 : 1.0);
            expect(meshes(model).every(mesh => mesh.geometry.attributes.position.count > 3)).toBe(true);
            expect(meshes(model).every(mesh => place.memberIds.includes(mesh.userData.objectId))).toBe(true);
            for (const member of place.memberIds) expect(layer.objects.has(member)).toBe(true);
            expect(state).toEqual(saved);
            layer.dispose(); m.dispose();
        });
    }
    it('joins four owned roots and the actual gallery into one broad hollow room while keeping the saved home front', () => {
        const state = fixture('P02', 'court'), saved = structuredClone(state), layout = sceneLayout(state);
        const place = derivePlaces(state).find(place => place.ruleId === 'P02')!, model = buildPlaceGeometry(state, layout, [place]);
        const hero = model.getObjectByName('place-root-room')!;
        expect(hero).toBeDefined(); expect(hero.userData.ownerId).toBe(place.anchorId);
        const box = new T.Box3().setFromObject(hero), span = box.getSize(new T.Vector3());
        expect(span.y).toBeGreaterThan(4); expect(Math.max(span.x, span.z)).toBeGreaterThan(4.2);
        expect(model.getObjectByName('place-hollow-tree-home')).toBeUndefined();
        const trees = model.getObjectsByProperty('name', 'place-owned-tree'); expect(trees).toHaveLength(place.mainIds.length);
        expect(trees.map(tree => tree.userData.ownerId).sort()).toEqual([...place.mainIds].sort());
        const gallery = model.getObjectByName('place-physical-gallery')!;
        expect(gallery.userData.rootRoomConnected).toBe(true); expect(gallery.userData.floorRoute).toEqual(place.walkSurface);
        expect(model.getObjectsByProperty('name', 'place-root-floor-connector')).toHaveLength(4);
        const home = state.plots.find(plot => plot.id === place.anchorId)!, p = layout.point(home.cell!);
        model.updateMatrixWorld(true);
        const ray = new T.Raycaster(p.clone().add(new T.Vector3(0, .72, 2)), new T.Vector3(0, 0, -1), 0, 1.95);
        expect(ray.intersectObject(hero, true)).toHaveLength(0);
        expect(state).toEqual(saved);
    });
    it('canopies/courts and translucent shells have different physical silhouettes', () => {
        const state = fixture('P05', 'court'), layout = sceneLayout(state), places = derivePlaces(state);
        const court = buildPlaceGeometry(state, layout, places);
        expect(court.getObjectByName('growing-place-P05-court')).toBeDefined();
        const clusterState = fixture('P05', 'canopy'), cluster = buildPlaceGeometry(clusterState, sceneLayout(clusterState), derivePlaces(clusterState));
        expect(cluster.getObjectByName('growing-place-P05-canopy')).toBeDefined();
        const community = fixture('P04', 'bay'), shell = buildPlaceGeometry(community, sceneLayout(community), derivePlaces(community));
        expect(shell.getObjectByName('place-translucent-shell')).toBeDefined();
        expect(meshes(shell).some(mesh => {
            const material = mesh.material as T.MeshPhysicalMaterial;
            return material instanceof T.MeshPhysicalMaterial && material.transmission > 0 && material.opacity < .8;
        })).toBe(true);
    });
    it('builds a deep curved shell with open ends and an actual courtyard sky opening', () => {
        for (const variant of ['bay', 'lane', 'court']) {
            const state = fixture('P04', variant), saved = structuredClone(state), layout = sceneLayout(state);
            const place = derivePlaces(state).find(place => place.ruleId === 'P04')!;
            const model = buildPlaceGeometry(state, layout, [place]), roof = model.getObjectByName('place-translucent-shell')!;
            const skin = meshes(roof).filter(mesh => mesh.material instanceof T.MeshPhysicalMaterial);
            roof.updateMatrixWorld(true);
            const box = skin.reduce((box, mesh) => box.union(new T.Box3().setFromObject(mesh)), new T.Box3());
            expect(box.max.y - box.min.y).toBeGreaterThan(.80);
            expect(meshes(roof).some(mesh => mesh.material instanceof T.MeshStandardMaterial && new T.Box3().setFromObject(mesh).getSize(new T.Vector3()).y > .5)).toBe(true);
            const points = place.mainIds.map(id => state.plots.find(plot => plot.id === id)!.cell!);
            const center = points.reduce((sum, cell) => sum.add(layout.point(cell)), new T.Vector3()).multiplyScalar(1 / points.length);
            const ray = new T.Raycaster(new T.Vector3(center.x, box.max.y + 1, center.z), new T.Vector3(0, -1, 0));
            expect(ray.intersectObjects(skin).length > 0).toBe(variant !== 'court');
            expect(state).toEqual(saved);
        }
    });
    it('shows the same hypothetical moved owners without rebuilding or aging saved geometry', () => {
        const state = fixture('P02', 'lane'), layout = sceneLayout(state), m = new IslandMaterials('moon-garden'), layer = buildObjectLayer(m, state, layout);
        const tree = state.landmarks.find(item => item.kind === 'sapling')!, saved = structuredClone(state), holder = layer.objects.get(tree.id);
        layer.updatePreview({ kind: 'sapling', seed: false, ownerId: tree.id, cell: { x: 7, z: 3 }, valid: true, style: 'plain', allowed: [] });
        const overlay = layer.root.getObjectByName('growing-place-preview');
        expect(overlay).toBeDefined(); expect(overlay?.userData.previewRevisions.length).toBeGreaterThan(0);
        const predicted = { ...state, landmarks: state.landmarks.map(l => l.id === tree.id ? { ...l, cell: { x: 7, z: 3 } } : l) };
        expect(overlay?.userData.previewRevisions).toEqual(derivePlaces(predicted).filter(p => !layer.places.some(before => before.id === p.id && before.revision === p.revision)).map(p => p.revision));
        expect(layer.objects.get(tree.id)).toBe(holder); expect(state).toEqual(saved);
        layer.updatePreview(); expect(layer.root.getObjectByName('growing-place-preview')).toBeUndefined(); layer.dispose(); m.dispose();
    });
    it('floor triangles, arbitrary fractional feet and hit points share the same height', () => {
        const state = fixture('P03', 'tiered'), layout = sceneLayout(state), ground = buildPlaceGround(layout);
        ground.root.updateMatrixWorld(true);
        for (const cell of [{ x: 7.2, z: 2.1 }, { x: 9.35, z: 2.5 }, { x: 10.7, z: 3.1 }, { x: 1.3, z: 2.4 }]) {
            const expected = layout.point(cell, 0), ray = new T.Raycaster(expected.clone().add(new T.Vector3(0, 5, 0)), new T.Vector3(0, -1, 0));
            const hit = ray.intersectObject(ground.floor)[0];
            expect(hit).toBeDefined(); expect(hit.point.y).toBeCloseTo(terrainHeightAt(state, cell), 6);
            expect(layout.point(cell).y).toBeCloseTo(hit.point.y + .04, 6);
        }
        expect(layout.point({ x: 2, z: 1 }).y).toBe(.04); ground.dispose();
    });
    it('rounds only the unowned outer bank into the pedestal without a vertical rectangular wall', () => {
        const state = fixture('P03', 'tiered'), layout = sceneLayout(state), ground = buildPlaceGround(layout);
        const bank = ground.root.getObjectByName('growing-terrain-bank') as T.Mesh;
        const position = bank.geometry.attributes.position, { rings, owned } = bank.userData.decorativeBank;
        const [west, east, north, south] = owned as number[], count = position.count / (rings + 1);
        for (let i = 0; i < position.count; i++) {
            const x = position.getX(i) + layout.center, z = position.getZ(i) + 2;
            expect(x <= west + 1e-6 || x >= east - 1e-6 || z <= north + 1e-6 || z >= south - 1e-6).toBe(true);
            if (i >= count * rings) expect(position.getY(i)).toBeCloseTo(-.075, 6);
            if (i < count) {
                expect(position.getY(i)).toBeCloseTo(layout.heightAt({ x, z }), 6);
                const next = i + count;
                // The first drop spreads outward in x/z instead of forming a wall.
                expect(Math.hypot(position.getX(next) - position.getX(i), position.getZ(next) - position.getZ(i))).toBeGreaterThan(.04);
            }
        }
        const widths = Array.from({ length: count }, (_, i) => Math.hypot(position.getX(i + count * rings) - position.getX(i), position.getZ(i + count * rings) - position.getZ(i)));
        expect(Math.max(...widths) - Math.min(...widths)).toBeGreaterThan(.9);
        expect(Math.max(...widths)).toBeGreaterThan(2);
        const rock = ground.root.getObjectByName('growing-rounded-rock-coast') as T.Mesh;
        const rockPositions = rock.geometry.getAttribute('position');
        for (let i = 0; i < count; i++) {
            expect(rockPositions.getX(i)).toBe(position.getX(i + count * rings));
            expect(rockPositions.getZ(i)).toBe(position.getZ(i + count * rings));
            expect(rockPositions.getY(i)).toBeCloseTo(-.075, 6);
        }
        expect(new T.Box3().setFromObject(rock).min.y).toBeCloseTo(-.43, 6);
        const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(), index = bank.geometry.index!;
        for (let i = 0; i < index.count; i += 3) {
            a.fromBufferAttribute(position, index.getX(i)); b.fromBufferAttribute(position, index.getX(i + 1)); c.fromBufferAttribute(position, index.getX(i + 2));
            if (Math.max(a.y, b.y, c.y) - Math.min(a.y, b.y, c.y) > .01) {
                const normal = b.sub(a).cross(c.sub(a)).normalize();
                expect(Math.abs(normal.y)).toBeGreaterThan(.25);
            }
        }
        ground.root.updateMatrixWorld(true);
        for (let x = layout.bounds.minX; x <= layout.bounds.maxX; x++) for (let z = 0; z < layout.depth; z++) {
            const point = layout.point({ x, z }, 0), ray = new T.Raycaster(point.clone().add(new T.Vector3(0, 5, 0)), new T.Vector3(0, -1, 0));
            expect(ray.intersectObject(ground.floor)[0]?.point.y).toBeCloseTo(layout.heightAt({ x, z }), 5);
        }
        ground.dispose();
    });
    it('actual gallery treads support the same route followed by a hero and exit safely on separation', () => {
        const state = fixture('P02', 'court'), layout = sceneLayout(state), m = new IslandMaterials('moon-garden'), layer = buildObjectLayer(m, state, layout);
        const place = layer.places.find(place => place.ruleId === 'P02')!, deck = layer.placeRoot.getObjectByName('place-physical-gallery')!;
        expect(deck.userData.floorRoute).toEqual(place.walkSurface); layer.root.updateMatrixWorld(true);
        for (const floor of place.walkSurface.filter((_, i) => i > 2 && i < 24 && i % 3 === 0)) {
            const p = layout.floorPoint(floor), ray = new T.Raycaster(p.clone().add(new T.Vector3(0, .02, 0)), new T.Vector3(0, -1, 0));
            const hit = ray.intersectObject(deck, true)[0];
            expect(hit).toBeDefined(); expect(Math.abs(hit.point.y - p.y)).toBeLessThan(.03);
        }
        const actor = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] };
        actor.root.userData.actorId = 'pokomoko';
        const life = new GrowingLife(m, actor); life.sync(state, layout, layer);
        life.pick('pokomoko'); life.drag('pokomoko', layout.point(place.useTargets.find(target => target.kind === 'gallery')!.cell)); life.drop('pokomoko', 0);
        let highest = 0;
        for (let t = 0; t < 6000; t += 40) { life.tick(t, 40, true, false); highest = Math.max(highest, actor.root.position.y); }
        expect(highest).toBeGreaterThan(place.walkSurface[0].y + 1.2);
        const uses = life.takePlaceUses();
        expect(uses.filter(use => use.actorId === 'pokomoko')).toEqual([expect.objectContaining({ ruleId: 'P02', actorId: 'pokomoko', targetId: expect.stringContaining(':gallery') })]);
        expect(uses.every(use => use.actorId === 'pokomoko' || state.villagers.some(v => v.id === use.actorId))).toBe(true);
        const savedTree = state.landmarks.find(l => l.kind === 'sapling')!; savedTree.cell = undefined;
        const changedLayout = sceneLayout(state), changed = buildObjectLayer(m, state, changedLayout); life.sync(state, changedLayout, changed); life.tick(6010, 10, true, false);
        const cell = changedLayout.cellAt(actor.root.position);
        expect(walkableCells(state).has(key(cell))).toBe(true); expect(reachableFromHome(state).has(key(cell))).toBe(true);
        expect(actor.root.position.y).toBeCloseTo(changedLayout.point({ x: actor.root.position.x + changedLayout.center, z: actor.root.position.z + 2 }).y, 6);
        const afterSeparation = life.takePlaceUses();
        expect(afterSeparation.some(use => use.actorId === 'pokomoko' && use.placeId === place.id)).toBe(false);
        for (const use of afterSeparation) {
            expect(state.villagers.some(resident => resident.id === use.actorId && !resident.away)).toBe(true);
            const currentPlace = changed.places.find(current => current.id === use.placeId && current.revision === use.revision);
            expect(currentPlace).toBeDefined();
            expect(currentPlace?.useTargets.some(target => target.id === use.targetId)).toBe(true);
        }
        life.dispose(); layer.dispose(); changed.dispose(); m.dispose();
    });
    it('only real seated users emit receipts and a built community play floor can be used', () => {
        const state = fixture('P04', 'bay'), layout = sceneLayout(state), m = new IslandMaterials('moon-garden'), layer = buildObjectLayer(m, state, layout);
        const place = layer.places.find(place => place.ruleId === 'P04')!, target = place.useTargets.find(target => target.kind === 'play')!;
        const actor = { id: 'pokomoko', root: new T.Group(), body: new T.Group(), feet: [] }; actor.root.userData.actorId = 'pokomoko';
        const life = new GrowingLife(m, actor); life.sync(state, layout, layer);
        expect(life.takePlaceUses()).toEqual([]);
        life.pick('pokomoko'); life.drag('pokomoko', layout.point(target.cell)); life.drop('pokomoko', 0);
        life.tick(600, 0, true, false); expect(life.takePlaceUses()).toEqual([]);
        life.tick(800, 0, true, false); expect(life.takePlaceUses()).toEqual([expect.objectContaining({ ruleId: 'P04', actorId: 'pokomoko', targetId: target.id })]);
        life.tick(900, 0, true, false); expect(life.takePlaceUses()).toEqual([]);
        expect(actor.root.position.y).toBeCloseTo(layout.point(target.cell).y + .04, 6);
        life.dispose(); layer.dispose(); m.dispose();
    });
    it('relation meshes are drawn only for the actual derived paths', () => {
        const state = fixture('P01', 'lane'), layout = sceneLayout(state), places = derivePlaces(state), relations = derivePlaceRelations(state, places);
        const model = buildPlaceGeometry(state, layout, places, relations);
        expect(model.userData.relationCount).toBe(relations.length);
        expect(model.children.filter(child => child.userData.placeRelation).map(child => child.userData.placeRelation)).toEqual(relations.filter(r => r.path.length > 1).map(r => r.id));
    });
    it('keeps a raised shore connected to sea-level boats and a level offshore bridge', () => {
        const state = fixture('P03', 'tiered'); state.bridge = { x: 2 };
        const layout = sceneLayout(state), m = new IslandMaterials('moon-garden');
        expect(layout.pierRoot.y).toBeGreaterThan(.2); expect(layout.dock.y).toBe(-.16); expect(layout.far.y).toBe(-.16);
        expect(layout.heightAt({ x: 2, z: layout.depth + 1 })).toBe(layout.heightAt({ x: 2, z: layout.depth - 1 }));
        const pier = buildPier(m, layout.pierRoot.y - .02); pier.position.copy(layout.pierRoot); pier.updateMatrixWorld(true);
        const end = layout.pierEnd.clone().add(new T.Vector3(0, 1, 0));
        const hit = new T.Raycaster(end, new T.Vector3(0, -1, 0)).intersectObject(pier, true)[0];
        expect(hit).toBeDefined(); expect(hit.point.y).toBeCloseTo(.065, 5);
        expect(layout.pierEnd.y).toBeCloseTo(hit.point.y + .025, 5); m.dispose();
    });
});
