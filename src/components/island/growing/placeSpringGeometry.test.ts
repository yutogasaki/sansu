import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { placeGoalCatalog } from '../../../domain/growingIsland/placeCatalog';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { waterLayout } from '../../../domain/growingIsland/environment';
import { key, walkableCells } from '../../../domain/growingIsland/space';
import { connectedWaterChannels } from '../../../domain/islandLife/waterChannels';
import type { LandmarkKind } from '../../../domain/growingIsland/types';
import { GardenGeometry } from '../three/garden/geometry';
import { makePokomokoRig } from '../three/islandCharacters';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { wrapPokomoko } from './actors';
import { buildPlaceSpring } from './placeSpringGeometry';
import { sceneLayout } from './sceneLayout';

function fixture(slope: boolean) {
    const state = newIsland('wide-spring', 1_000);
    state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
    state.landmarks = []; state.plots = []; state.unopened = []; state.arrivals = []; state.villagers = [];
    const goal = placeGoalCatalog.find(goal => goal.id === 'P03')!;
    for (const [i, entry] of goal.variants.find(variant => variant.id === 'tiered')!.demo.entries()) {
        state.landmarks.push({ id: `water-${i}`, kind: goal.inputs.find(input => input.role === entry.role)!.kind.split(':')[1] as LandmarkKind,
            cell: { x: entry.x + (slope ? 6 : 0), z: entry.z + 1 }, growth: 6 });
    }
    const place = derivePlaces(state).find(place => place.ruleId === 'P03')!;
    expect(place.stage).toBe('grown');
    return { state, place, layout: sceneLayout(state) };
}

function meshes(root: T.Object3D, name: string) {
    const result: T.Mesh[] = []; root.traverse(object => { if (object instanceof T.Mesh && object.name === name) result.push(object); }); return result;
}

function vertex(mesh: T.Mesh, index: number) {
    return new T.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), index).applyMatrix4(mesh.matrixWorld);
}

function release(g: GardenGeometry) {
    const materials = new Set<T.Material>();
    g.root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        object.geometry.dispose();
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    for (const material of materials) material.dispose(); g.dispose();
}

describe('wide owned stone springs', () => {
    it('makes broad organic water, a closed stone hollow and a bottom inside each owner cell', () => {
        for (const slope of [true, false]) {
        const { state, place, layout } = fixture(slope), saved = structuredClone(state), g = new GardenGeometry();
        buildPlaceSpring(g, state, layout, place); g.root.updateMatrixWorld(true);
        const pools = g.root.children.filter(group => group.name === 'place-owned-basin'); expect(pools).toHaveLength(3);
        const outlines: number[][] = [];
        for (const group of pools) {
            const id = group.userData.ownerId, item = state.landmarks.find(item => item.id === id)!;
            expect(place.memberIds).toContain(id); expect(group.userData.objectId).toBe(id);
            const box = new T.Box3().setFromObject(group), p = layout.point(item.cell!);
            expect(Math.max(Math.abs(box.min.x - p.x), Math.abs(box.max.x - p.x), Math.abs(box.min.z - p.z), Math.abs(box.max.z - p.z))).toBeLessThanOrEqual(.49);
            group.traverse(object => {
                if (!(object instanceof T.Mesh)) return;
                for (let i = 0; i < object.geometry.getAttribute('position').count; i++) {
                    const point = vertex(object, i);
                    expect(Math.hypot(point.x - p.x, point.z - p.z)).toBeLessThanOrEqual(.49);
                }
            });
            const surface = group.getObjectByName('place-connected-water') as T.Mesh, positions = surface.geometry.getAttribute('position'), index = surface.geometry.getIndex()!;
            let area = 0; const a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3();
            for (let i = 0; i < index.count; i += 3) {
                a.fromBufferAttribute(positions, index.getX(i)); b.fromBufferAttribute(positions, index.getX(i + 1)); c.fromBufferAttribute(positions, index.getX(i + 2));
                area += Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).y) / 2;
            }
            expect(area).toBeGreaterThan(.54); outlines.push(Array.from(positions.array));
            const radii = Array.from({ length: positions.count - 1 }, (_, i) => Math.hypot(positions.getX(i + 1), positions.getZ(i + 1)));
            expect(Math.max(...radii)).toBeLessThanOrEqual(.46);
            expect(Math.max(...radii) / Math.min(...radii)).toBeGreaterThan(1.12);
            for (let i = 0; i < positions.count; i++) {
                const point = vertex(surface, i), cell = { x: point.x + layout.center, z: point.z + 2 };
                expect(point.y).toBeCloseTo(layout.point(cell, .03).y, 6);
            }
            const ray = new T.Raycaster(p.clone().add(new T.Vector3(0, 1, 0)), new T.Vector3(0, -1, 0));
            expect(ray.intersectObject(surface)[0].point.y).toBeCloseTo(layout.point(item.cell!, .03).y, 6);
            const bottom = group.getObjectByName('place-basin-bottom') as T.Mesh;
            expect(ray.intersectObject(bottom)[0].point.y).toBeCloseTo(layout.point(item.cell!, .015).y, 6);
            for (let i = 0; i < bottom.geometry.getAttribute('position').count; i++) {
                const point = vertex(bottom, i);
                expect(point.y).toBeCloseTo(layout.point({ x: point.x + layout.center, z: point.z + 2 }, .015).y, 6);
            }
            const basin = group.getObjectByName('place-stone-basin') as T.Mesh, faces = basin.geometry.getIndex()!, edges = new Map<string, number>();
            const stoneVertices = basin.geometry.getAttribute('position');
            for (let vertex = 0; vertex < stoneVertices.count; vertex++) expect(Math.hypot(stoneVertices.getX(vertex), stoneVertices.getZ(vertex))).toBeLessThanOrEqual(.49);
            // The water edge meets the hollow's actual shared water cut, rather than
            // floating above a repeated cylinder or penetrating a solid plate.
            for (let vertex = 0; vertex < 48; vertex++) {
                const cut = 1 + 3 * 48 + vertex;
                expect(stoneVertices.getX(cut)).toBeCloseTo(positions.getX(vertex + 1), 6);
                expect(stoneVertices.getZ(cut)).toBeCloseTo(positions.getZ(vertex + 1), 6);
                expect(stoneVertices.getY(cut)).toBeCloseTo(positions.getY(vertex + 1) + surface.position.y, 6);
            }
            for (let i = 0; i < faces.count; i += 3) {
                const face = [faces.getX(i), faces.getX(i + 1), faces.getX(i + 2)];
                for (let j = 0; j < 3; j++) { const edge = [face[j], face[(j + 1) % 3]].sort((a, b) => a - b).join(':'); edges.set(edge, (edges.get(edge) ?? 0) + 1); }
            }
            expect([...edges.values()].every(count => count === 2)).toBe(true);
            expect(ray.intersectObject(basin)[0].point.y).toBeCloseTo(layout.point(item.cell!, .013).y, 6);
        }
        expect(outlines[0]).not.toEqual(outlines[1]); expect(outlines[1]).not.toEqual(outlines[2]);
        expect(state).toEqual(saved); release(g);
        }
    });

    it('concentrates crystals at the highest owned source and retains stable owner selection', () => {
        const { state, place, layout } = fixture(true), saved = structuredClone(state), g = new GardenGeometry();
        state.landmarks.push({ id: 'unrelated-source', kind: 'water-bowl', cell: { x: 11, z: 6 }, growth: 0 });
        buildPlaceSpring(g, state, layout, place);
        const sources = g.root.children.filter(group => group.name === 'place-owned-basin' && group.userData.source);
        expect(sources).toHaveLength(1); const highest = state.landmarks.filter(item => place.waterRefs.includes(item.id) && item.kind === 'water-bowl')
            .sort((a, b) => layout.heightAt(b.cell!) - layout.heightAt(a.cell!))[0];
        expect(sources[0].userData.ownerId).toBe(highest.id); expect(meshes(sources[0], 'place-source-crystal')).toHaveLength(3);
        expect(meshes(g.root, 'place-source-crystal')).toHaveLength(3);
        expect(g.root.children.some(group => group.userData.ownerId === 'unrelated-source')).toBe(false);
        const reordered = new GardenGeometry(); state.landmarks.reverse(); buildPlaceSpring(reordered, state, layout, place);
        expect(reordered.root.children.map(group => [group.name, group.userData.ownerId, group.userData.source])).toEqual(g.root.children.map(group => [group.name, group.userData.ownerId, group.userData.source]));
        state.landmarks.reverse(); state.landmarks.pop(); expect(state).toEqual(saved);
        release(g); release(reordered);
    });

    it('keeps wide curved water and stone banks on the same real terrain; flat pools add no waterfall', () => {
        for (const slope of [true, false]) {
            const { state, place, layout } = fixture(slope), saved = structuredClone(state), g = new GardenGeometry();
            buildPlaceSpring(g, state, layout, place); g.root.updateMatrixWorld(true);
            const streams = [...meshes(g.root, 'place-descending-stream'), ...meshes(g.root, 'place-supplied-stream')];
            expect(streams).toHaveLength(4); expect(meshes(g.root, 'place-descending-stream').length > 0).toBe(slope);
            for (const stream of streams) {
                const positions = stream.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i += 2) {
                    const a = new T.Vector3().fromBufferAttribute(positions, i), b = new T.Vector3().fromBufferAttribute(positions, i + 1);
                    const width = Math.hypot(a.x - b.x, a.z - b.z);
                    expect(width).toBeGreaterThanOrEqual(.70 - 1e-6); expect(width).toBeLessThanOrEqual(.78 + 1e-6);
                    for (const point of [a, b]) expect(point.y).toBeCloseTo(layout.point({ x: point.x + layout.center, z: point.z + 2 }, .03).y, 5);
                }
                const [highId, lowId] = stream.parent!.userData.waterOwners as string[];
                const high = state.landmarks.find(item => item.id === highId)!, low = state.landmarks.find(item => item.id === lowId)!;
                expect(layout.heightAt(high.cell!)).toBeGreaterThanOrEqual(layout.heightAt(low.cell!));
                expect(place.memberIds).toContain(stream.parent!.userData.ownerId);
                stream.parent!.traverse(object => {
                    if (!(object instanceof T.Mesh)) return;
                    const a = layout.point(high.cell!), b = layout.point(low.cell!);
                    for (let i = 0; i < object.geometry.getAttribute('position').count; i++) {
                        const point = vertex(object, i);
                        expect(point.x).toBeGreaterThanOrEqual(Math.min(a.x, b.x) - .49);
                        expect(point.x).toBeLessThanOrEqual(Math.max(a.x, b.x) + .49);
                        expect(point.z).toBeGreaterThanOrEqual(Math.min(a.z, b.z) - .49);
                        expect(point.z).toBeLessThanOrEqual(Math.max(a.z, b.z) + .49);
                    }
                });
                if (!slope) expect(stream.name).toBe('place-supplied-stream');
            }
            const banks = meshes(g.root, 'place-stream-rock-bank'); expect(banks).toHaveLength(8);
            for (const bank of banks) {
                const positions = bank.geometry.getAttribute('position');
                // Real TubeGeometry ring centres follow the terrain, including the
                // curved border between authored points; there is no tall new pier.
                for (let ring = 0; ring <= 16; ring++) {
                    const center = new T.Vector3();
                    for (let vertex = 0; vertex < 7; vertex++) center.add(new T.Vector3().fromBufferAttribute(positions, ring * 8 + vertex));
                    center.multiplyScalar(1 / 7);
                    const expected = layout.point({ x: center.x + layout.center, z: center.z + 2 }, .045);
                    expect(Math.abs(center.y - expected.y)).toBeLessThan(.005);
                }
            }
            expect(state).toEqual(saved); release(g);
        }
    });

    it('keeps young owners small and never paints an unsupplied channel from stale references', () => {
        const { state, place, layout } = fixture(true), saved = structuredClone(state), young = new GardenGeometry();
        buildPlaceSpring(young, state, layout, { ...place, stage: 'connected' });
        expect(meshes(young.root, 'place-young-basin')).toHaveLength(3);
        expect(meshes(young.root, 'place-connected-water')).toHaveLength(0); expect(meshes(young.root, 'place-source-crystal')).toHaveLength(0);
        expect(young.root.children.every(group => place.memberIds.includes(group.userData.ownerId))).toBe(true);
        state.landmarks.push({ id: 'dry-channel', kind: 'water-channel', cell: { x: -5, z: 6 }, growth: 0 });
        const grown = new GardenGeometry(); buildPlaceSpring(grown, state, layout, { ...place, waterRefs: [...place.waterRefs, 'dry-channel'] });
        expect(grown.root.children.some(group => (group.userData.waterOwners as string[] | undefined)?.includes('dry-channel'))).toBe(false);
        expect(grown.root.children.some(group => group.userData.ownerId === 'dry-channel')).toBe(false);
        state.landmarks.pop(); expect(state).toEqual(saved); release(young); release(grown);
    });

    it('opens low rim joins only toward actual adjacent supplied owners in the current place', () => {
        const { state, place, layout } = fixture(true), g = new GardenGeometry();
        const highest = state.landmarks.filter(item => place.waterRefs.includes(item.id) && item.kind === 'water-bowl')
            .sort((a, b) => layout.heightAt(b.cell!) - layout.heightAt(a.cell!))[0];
        state.landmarks.push({ id: 'outside-place-channel', kind: 'water-channel', cell: { x: highest.cell!.x, z: highest.cell!.z + 1 }, growth: 0 });
        const saved = structuredClone(state), ids = new Set([...place.mainIds, ...place.waterRefs]), reached = connectedWaterChannels(waterLayout(state));
        buildPlaceSpring(g, state, layout, place); g.root.updateMatrixWorld(true);
        for (const group of g.root.children.filter(group => group.name === 'place-owned-basin')) {
            const item = state.landmarks.find(item => item.id === group.userData.ownerId)!;
            const expected = state.landmarks.filter(other => ids.has(other.id) && other.id !== item.id && other.cell
                && (other.kind === 'water-bowl' || other.kind === 'water-channel' && reached.has(key(other.cell)))
                && Math.abs(other.cell.x - item.cell!.x) + Math.abs(other.cell.z - item.cell!.z) === 1)
                .map(other => ({ x: other.cell!.x - item.cell!.x, z: other.cell!.z - item.cell!.z }));
            expect(group.userData.inlets).toEqual(expected);
            const basin = group.getObjectByName('place-stone-basin') as T.Mesh;
            let low = 0, high = 0;
            for (let i = 0; i < 48; i++) {
                const point = vertex(basin, 1 + 4 * 48 + i), radial = point.clone().sub(group.position).setY(0).normalize();
                const alignment = Math.max(0, ...expected.map(direction => radial.x * direction.x + radial.z * direction.z));
                const ground = layout.heightAt({ x: point.x + layout.center, z: point.z + 2 }), level = point.y - ground;
                if (alignment >= .8) { expect(level).toBeCloseTo(.027, 6); low++; }
                if (alignment <= .5) { expect(level).toBeCloseTo(.185, 6); high++; }
                if (level < .185 - 1e-6) expect(alignment).toBeGreaterThan(.5);
            }
            expect(low).toBeGreaterThan(0); expect(high).toBeGreaterThan(0);
        }
        expect(g.root.children.some(group => group.userData.ownerId === 'outside-place-channel')).toBe(false);
        expect(state).toEqual(saved); release(g);
    });

    it('joins supplied walkable tiles into broad shallow inlets beneath their real crossing floor', () => {
        const { state, place, layout } = fixture(true), saved = structuredClone(state), g = new GardenGeometry();
        buildPlaceSpring(g, state, layout, place); g.root.updateMatrixWorld(true);
        const shallows = meshes(g.root, 'place-channel-shallows'); expect(shallows).toHaveLength(2);
        for (const shallow of shallows) {
            const item = state.landmarks.find(item => item.id === shallow.parent!.userData.ownerId)!;
            expect(item.kind).toBe('water-channel'); expect(walkableCells(state).has(key(item.cell!))).toBe(true);
            const positions = shallow.geometry.getAttribute('position'), indices = shallow.geometry.getIndex()!;
            const p = layout.point(item.cell!), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3(); let area = 0;
            for (let i = 0; i < positions.count; i++) {
                const point = vertex(shallow, i);
                expect(Math.hypot(point.x - p.x, point.z - p.z)).toBeLessThan(.49);
                expect(point.y).toBeCloseTo(layout.point({ x: point.x + layout.center, z: point.z + 2 }, .03).y, 6);
            }
            for (let i = 0; i < indices.count; i += 3) {
                a.fromBufferAttribute(positions, indices.getX(i)); b.fromBufferAttribute(positions, indices.getX(i + 1)); c.fromBufferAttribute(positions, indices.getX(i + 2));
                area += Math.abs(b.clone().sub(a).cross(c.clone().sub(a)).y) / 2;
            }
            expect(area).toBeGreaterThan(.54);
            const stone = shallow.parent!.getObjectByName('place-shallow-stepping-stone') as T.Mesh;
            const ray = new T.Raycaster(p.clone().add(new T.Vector3(0, 1, 0)), new T.Vector3(0, -1, 0));
            expect(ray.intersectObject(stone)[0].point.y - ray.intersectObject(shallow)[0].point.y).toBeCloseTo(.01, 6);
            expect((shallow.material as T.MeshPhysicalMaterial).polygonOffset).toBe(true);
        }
        expect(state).toEqual(saved); release(g);
    });
    it('supports real Pokomoko feet on shallow channel stones above shared water without changing navigation or owners', () => {
        for (const slope of [true, false]) {
            const { state, place, layout } = fixture(slope), saved = structuredClone(state), open = walkableCells(state), g = new GardenGeometry();
            buildPlaceSpring(g, state, layout, place); g.root.updateMatrixWorld(true);
            const m = new IslandMaterials('moon-garden'), rig = makePokomokoRig(m), actor = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
            const streams = [...meshes(g.root, 'place-descending-stream'), ...meshes(g.root, 'place-supplied-stream')];
            const stones = meshes(g.root, 'place-shallow-stepping-stone'); expect(stones).toHaveLength(2);
            for (const stone of stones) {
                const group = stone.parent!, item = state.landmarks.find(item => item.id === group.userData.ownerId)!;
                expect(item.kind).toBe('water-channel'); expect(open.has(key(item.cell!))).toBe(true); expect(place.memberIds).toContain(item.id);
                const point = layout.point(item.cell!), ray = new T.Raycaster(point.clone().add(new T.Vector3(0, 1, 0)), new T.Vector3(0, -1, 0));
                const top = ray.intersectObject(stone)[0], water = ray.intersectObjects(streams)[0];
                expect(top.point.y).toBeCloseTo(point.y, 6); expect(point.y - water.point.y).toBeCloseTo(.01, 6);
                ray.set(point.clone().sub(new T.Vector3(0, 1, 0)), new T.Vector3(0, 1, 0));
                expect(ray.intersectObject(stone)[0].point.y).toBeCloseTo(layout.point(item.cell!, .017).y, 6);
                actor.root.position.copy(point); actor.root.updateMatrixWorld(true); expect(rig.hero.scale.x).toBe(.7);
                for (const foot of actor.feet) {
                    const positions = (foot as T.Mesh).geometry.getAttribute('position'); let lowest = 0;
                    for (let i = 1; i < positions.count; i++) if (positions.getY(i) < positions.getY(lowest)) lowest = i;
                    const sole = new T.Vector3().fromBufferAttribute(positions, lowest).applyMatrix4(foot.matrixWorld);
                    ray.set(sole.clone().add(new T.Vector3(0, .10, 0)), new T.Vector3(0, -1, 0));
                    const contact = ray.intersectObject(stone)[0], shallowWater = ray.intersectObjects(streams)[0];
                    expect(contact).toBeDefined(); expect(shallowWater).toBeDefined();
                    expect(Math.abs(contact.point.y - sole.y)).toBeLessThan(.02);
                    expect(contact.point.y - shallowWater.point.y).toBeCloseTo(.01, 5);
                    for (let i = 0; i < positions.count; i++) {
                        if (positions.getY(i) > 0) continue;
                        const footprint = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(foot.matrixWorld);
                        expect(Math.hypot(footprint.x - point.x, footprint.z - point.z)).toBeLessThan(.23);
                    }
                }
            }
            expect(walkableCells(state)).toEqual(open); expect(state).toEqual(saved);
            disposeGeometry(actor.root); m.dispose(); release(g);
        }
    });
});
