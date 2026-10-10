import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { placeGoalCatalog } from '../../../domain/growingIsland/placeCatalog';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { PLACE_GALLERY_WIDTH, placeGalleryRoute, terrainHeightAt } from '../../../domain/growingIsland/placeTerrain';
import { key, onLand, walkableCells } from '../../../domain/growingIsland/space';
import type { GrowingState, LandmarkKind, SeedKind } from '../../../domain/growingIsland/types';
import type { PlacePoint } from '../../../domain/growingIsland/placeTypes';
import { makePokomokoRig } from '../three/islandCharacters';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { wrapPokomoko } from './actors';
import { buildPlaceGeometry } from './placeGeometry';
import { sceneLayout } from './sceneLayout';

// Mature owned layouts isolate physical support. They are not elapsed-time or acquisition evidence.
function fixture(variant: 'lane' | 'court'): GrowingState {
    const state = newIsland(`gallery-${variant}`, 1_000);
    state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
    state.tutorial = 'done'; state.landmarks = []; state.plots = []; state.unopened = []; state.arrivals = []; state.villagers = [];
    state.nature.hours = 200;
    const goal = placeGoalCatalog.find(goal => goal.id === 'P02')!;
    for (const [i, entry] of goal.variants.find(entry => entry.id === variant)!.demo.entries()) {
        const [type, kind] = goal.inputs.find(input => input.role === entry.role)!.kind.split(':');
        const id = `owned-${i}`, cell = { x: entry.x + 6, z: entry.z + 1 };
        if (type === 'landmark') state.landmarks.push({ id, kind: kind as LandmarkKind, cell, growth: kind === 'sapling' ? 18 : 6, maturedAt: 0 });
        else state.plots.push({ id, kind: kind as SeedKind, cell, plantedAt: 0, builtAt: 6, stagedAt: 6, stage: 2,
            style: 'tree', growth: 0, origin: 'seed', paid: 40 });
    }
    return state;
}

/** Extract the actual rendered deck triangles from the batched color attribute.
 * This never substitutes a box or a route-only imaginary floor for the physical boards. */
function physicalFloor(deck: T.Object3D) {
    const color = new T.Color('#cda579'), vertices: number[] = [], point = new T.Vector3();
    deck.updateMatrixWorld(true);
    deck.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const geometry = object.geometry, positions = geometry.getAttribute('position'), colors = geometry.getAttribute('color'), index = geometry.getIndex();
        const material = object.material;
        const matches = (i: number) => colors
            ? Math.abs(colors.getX(i) - color.r) < 1e-5 && Math.abs(colors.getY(i) - color.g) < 1e-5 && Math.abs(colors.getZ(i) - color.b) < 1e-5
            : material instanceof T.MeshStandardMaterial && material.color.equals(color);
        for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
            const face = [0, 1, 2].map(offset => index ? index.getX(i + offset) : i + offset);
            if (!face.every(matches)) continue;
            for (const vertex of face) {
                point.fromBufferAttribute(positions, vertex).applyMatrix4(object.matrixWorld);
                vertices.push(point.x, point.y, point.z);
            }
        }
    });
    const geometry = new T.BufferGeometry(); geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geometry.computeVertexNormals();
    const floor = new T.Mesh(geometry, new T.MeshBasicMaterial()); floor.updateMatrixWorld(true);
    expect(vertices.length).toBeGreaterThan(0);
    return floor;
}

function floorBelow(floor: T.Mesh, point: T.Vector3) {
    const ray = new T.Raycaster(point.clone().add(new T.Vector3(0, .10, 0)), new T.Vector3(0, -1, 0));
    return ray.intersectObject(floor)[0];
}

function release(root: T.Object3D) {
    const materials = new Set<T.Material>();
    root.traverse(object => {
        if (object instanceof T.Mesh) {
            object.geometry.dispose();
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
        }
    });
    for (const material of materials) material.dispose();
}

describe('owned tree-home physical gallery', () => {
    it('takes the free footprint detour instead of crossing furniture or extending onto unowned water', () => {
        const state = newIsland('gallery-safe-detour', 1_000);
        state.landmarks = [{ id: 'bench', kind: 'bench', cell: { x: 2, z: 3 }, growth: 0 }]; state.plots = [];
        const saved = structuredClone(state), open = walkableCells(state), entrance = { x: 1, z: 3 };
        const footprint = [entrance, { x: 2, z: 3 }, { x: 3, z: 3 }, { x: 1, z: 4 }, { x: 2, z: 4 }, { x: 3, z: 4 }, { x: 4, z: 4 }, { x: 7, z: 4 }];
        const route = placeGalleryRoute(state, { footprint, entrances: [entrance] }, { x: 1, z: 2 });
        const upper = route.filter(point => Number.isInteger(point.x) && Number.isInteger(point.z) && point.y > 1);
        expect(upper.some(cell => cell.x >= 3)).toBe(true);
        expect(upper.every(cell => onLand(state, cell) && open.has(key(cell)) && footprint.some(member => key(member) === key(cell)))).toBe(true);
        expect(upper.some(cell => cell.x === 2 && cell.z === 3)).toBe(false);
        expect(upper.some(cell => cell.x === 7)).toBe(false);
        expect(state).toEqual(saved);
    });
    it('adds a closed round upper courtyard only when its full floor fits the reachable open footprint', () => {
        const state = fixture('court'), saved = structuredClone(state), place = derivePlaces(state).find(place => place.ruleId === 'P02')!;
        const route = place.walkSurface, allowed = new Set(place.footprint.filter(cell => walkableCells(state).has(key(cell))).map(key));
        const start = route.findIndex((point, i) => i > 30 && !Number.isInteger(point.x) && !Number.isInteger(point.z));
        expect(start).toBeGreaterThan(30);
        // The first angular step follows the exact east point. Forty-eight angular
        // boards close back at that same point, rather than suggesting a painted ring.
        const circle = route.slice(start - 1, start + 48);
        expect(circle).toHaveLength(49); expect(circle[48]).toEqual(circle[0]);
        const center = { x: (circle[0].x + circle[24].x) / 2, z: circle[0].z };
        const radius = Math.hypot(circle[0].x - center.x, circle[0].z - center.z);
        expect(radius).toBeGreaterThanOrEqual(.46 - 1e-9);
        let circumference = 0;
        for (let i = 0; i < circle.length; i++) {
            const p = circle[i], angle = Math.atan2(p.z - center.z, p.x - center.x);
            expect(Math.hypot(p.x - center.x, p.z - center.z)).toBeCloseTo(radius, 8);
            for (const r of [radius - PLACE_GALLERY_WIDTH / 2, radius + PLACE_GALLERY_WIDTH / 2]) {
                expect(allowed.has(key({ x: Math.round(center.x + Math.cos(angle) * r), z: Math.round(center.z + Math.sin(angle) * r) }))).toBe(true);
            }
            if (i) circumference += Math.hypot(p.x - circle[i - 1].x, p.z - circle[i - 1].z);
        }
        expect(circumference).toBeGreaterThan(2.8); expect(state).toEqual(saved);
        const lane = fixture('lane'), narrow = derivePlaces(lane).find(place => place.ruleId === 'P02')!;
        expect(narrow.walkSurface.slice(30, -30).some(point => !Number.isInteger(point.x) && !Number.isInteger(point.z))).toBe(false);
    });
    for (const variant of ['lane', 'court'] as const) {
        it(`${variant}: follows multiple connected free cells and every walking sample has a real floor`, () => {
            const state = fixture(variant), saved = structuredClone(state), layout = sceneLayout(state), open = walkableCells(state);
            const places = derivePlaces(state), place = places.find(place => place.ruleId === 'P02')!;
            expect(place.variant).toBe(variant); expect(place.stage).toBe('grown');
            const root = buildPlaceGeometry(state, layout, [place]), deck = root.getObjectByName('place-physical-gallery')!, floor = physicalFloor(deck);
            const m = new IslandMaterials('moon-garden'), rig = makePokomokoRig(m), actor = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
            const soles = actor.feet.map(foot => {
                const positions = (foot as T.Mesh).geometry.getAttribute('position');
                let lowest = 0;
                for (let vertex = 1; vertex < positions.count; vertex++) if (positions.getY(vertex) < positions.getY(lowest)) lowest = vertex;
                return new T.Vector3().fromBufferAttribute(positions, lowest);
            });
            expect(deck.userData.floorRoute).toEqual(place.walkSurface);
            const upperCells = place.walkSurface.filter(point => Number.isInteger(point.x) && Number.isInteger(point.z)
                && point.y - terrainHeightAt(state, point) > 1.3);
            expect(new Set(upperCells.map(key)).size).toBeGreaterThanOrEqual(3);
            expect(upperCells.every(cell => place.footprint.some(owned => key(owned) === key(cell)))).toBe(true);
            expect(Math.max(...upperCells.map(cell => Math.abs(cell.x - place.walkSurface[0].x) + Math.abs(cell.z - place.walkSurface[0].z)))).toBeGreaterThanOrEqual(2);
            expect(place.walkSurface[place.walkSurface.length - 1]).toEqual(place.walkSurface[0]);
            for (let i = 1; i < place.walkSurface.length; i++) {
                const a = place.walkSurface[i - 1], b = place.walkSurface[i];
                for (const t of [0, .25, .5, .75, 1]) {
                    const sample: PlacePoint = { x: T.MathUtils.lerp(a.x, b.x, t), z: T.MathUtils.lerp(a.z, b.z, t), y: T.MathUtils.lerp(a.y, b.y, t) };
                    const cell = { x: Math.round(sample.x), z: Math.round(sample.z) };
                    expect(onLand(state, cell)).toBe(true); expect(open.has(key(cell))).toBe(true);
                    const point = layout.floorPoint(sample), hit = floorBelow(floor, point);
                    expect(hit, `missing physical floor at ${i}/${t}`).toBeDefined();
                    expect(Math.abs(hit.point.y - point.y)).toBeLessThanOrEqual(.10);
                }
                if (Math.hypot(b.x - a.x, b.z - a.z) < .01) continue;
                actor.root.position.copy(layout.floorPoint({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, y: (a.y + b.y) / 2 }));
                actor.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); actor.root.updateMatrixWorld(true);
                for (const [footIndex, foot] of actor.feet.entries()) {
                    const sole = soles[footIndex].clone().applyMatrix4(foot.matrixWorld), contact = floorBelow(floor, sole);
                    const diagnostic = contact ? '' : JSON.stringify({ a, b, footIndex, sole: sole.toArray(), higherContact: new T.Raycaster(sole.clone().add(new T.Vector3(0, .3, 0)), new T.Vector3(0, -1, 0)).intersectObject(floor)[0]?.point.toArray() });
                    expect(contact, `unsupported actual foot at segment ${i}: ${diagnostic}`).toBeDefined();
                    // Forward feet can contact the next tread on the small spiral;
                    // this is bounded by two physical rises, never an invisible floor.
                    expect(Math.abs(contact.point.y - sole.y)).toBeLessThanOrEqual(.10);
                }
            }
            expect(state).toEqual(saved);
            expect(state.plots.length + state.landmarks.length).toBe(saved.plots.length + saved.landmarks.length);
            disposeGeometry(actor.root); m.dispose(); release(floor); release(root);
        });

        it(`${variant}: supports both actual 0.7-scale Pokomoko feet across the high straight deck`, () => {
            const state = fixture(variant), saved = structuredClone(state), layout = sceneLayout(state);
            const place = derivePlaces(state).find(place => place.ruleId === 'P02')!, root = buildPlaceGeometry(state, layout, [place]);
            const floor = physicalFloor(root.getObjectByName('place-physical-gallery')!);
            const m = new IslandMaterials('moon-garden'), rig = makePokomokoRig(m), actor = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
            const index = place.walkSurface.findIndex((point, i) => i > 0 && point.y - layout.heightAt(point) > 1.3
                && place.walkSurface[i - 1].y - layout.heightAt(place.walkSurface[i - 1]) > 1.3
                && Math.hypot(point.x - place.walkSurface[i - 1].x, point.z - place.walkSurface[i - 1].z) > .9);
            expect(index).toBeGreaterThan(0);
            const a = layout.floorPoint(place.walkSurface[index - 1]), b = layout.floorPoint(place.walkSurface[index]), centre = a.clone().lerp(b, .5);
            const direction = b.clone().sub(a), tangent = direction.clone().setY(0).normalize(), across = new T.Vector3(tangent.z, 0, -tangent.x);
            actor.root.position.copy(centre); actor.root.rotation.y = Math.atan2(tangent.x, tangent.z); actor.root.updateMatrixWorld(true);
            expect(rig.hero.scale.x).toBe(.7); expect(actor.feet).toHaveLength(2);
            let minimumAcross = Infinity, maximumAcross = -Infinity, checked = 0;
            for (const foot of actor.feet) {
                expect(foot).toBeInstanceOf(T.Mesh);
                const positions = (foot as T.Mesh).geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    // Actual lower-hemisphere vertices span each original foot's full
                    // footprint, including its outer sides and front, after rig scaling.
                    if (positions.getY(i) > 1e-6) continue;
                    const point = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(foot.matrixWorld), delta = point.clone().sub(centre);
                    const lateral = delta.dot(across); minimumAcross = Math.min(minimumAcross, lateral); maximumAcross = Math.max(maximumAcross, lateral);
                    expect(Math.abs(lateral)).toBeLessThan(PLACE_GALLERY_WIDTH / 2);
                    const along = delta.dot(tangent), expected = centre.y + along / Math.hypot(direction.x, direction.z) * direction.y;
                    const hits = new T.Raycaster(new T.Vector3(point.x, expected + .10, point.z), new T.Vector3(0, -1, 0)).intersectObject(floor);
                    expect(hits.length).toBeGreaterThan(0);
                    // The actual straight board must support every original sole
                    // vertex on its exact sloping plane. The round junction overlaps
                    // it by less than half the real wood thickness, never a step/gap.
                    expect(hits.some(hit => Math.abs(hit.point.y - expected) < .00005)).toBe(true);
                    expect(Math.abs(hits[0].point.y - expected)).toBeLessThanOrEqual(.0275);
                    checked++;
                }
            }
            expect(checked).toBeGreaterThan(100);
            expect(maximumAcross - minimumAcross).toBeCloseTo(.308, 3);
            expect(PLACE_GALLERY_WIDTH - (maximumAcross - minimumAcross)).toBeGreaterThan(.10);
            expect(state).toEqual(saved);
            disposeGeometry(actor.root); m.dispose(); release(floor); release(root);
        });

        it(`${variant}: keeps the staircase inside its free entrance and grows supports from blocked owners`, () => {
            const state = fixture(variant), saved = structuredClone(state), layout = sceneLayout(state), open = walkableCells(state);
            const place = derivePlaces(state).find(place => place.ruleId === 'P02')!;
            const entrance = place.walkSurface[0];
            // The same geometry assembler isolates the ascent prefix for exact bounds;
            // the full gallery continues from the identical physical floor positions.
            const stairRoot = buildPlaceGeometry(state, layout, [{ ...place, walkSurface: place.walkSurface.slice(0, 30) }]);
            const stairFloor = physicalFloor(stairRoot.getObjectByName('place-physical-gallery')!), stairBox = new T.Box3().setFromObject(stairFloor);
            const base = layout.floorPoint(entrance);
            expect(Math.max(Math.abs(stairBox.min.x - base.x), Math.abs(stairBox.max.x - base.x),
                Math.abs(stairBox.min.z - base.z), Math.abs(stairBox.max.z - base.z))).toBeLessThan(.5);
            expect(open.has(key(entrance))).toBe(true); expect(onLand(state, entrance)).toBe(true);
            const root = buildPlaceGeometry(state, layout, [place]), supports = root.getObjectByName('place-gallery-branch-supports')!;
            expect(supports).toBeDefined(); root.updateMatrixWorld(true);
            const origins = supports.userData.origins as { x: number; z: number }[];
            const room = root.getObjectByName('place-root-room'), joints = supports.getObjectByName('place-root-floor-connections');
            const branches = joints ? joints.children : supports.children;
            expect(origins.length).toBeGreaterThan(0); expect(branches).toHaveLength(origins.length);
            if (room) expect(branches).toHaveLength(4);
            const ownerCells = new Set([...state.landmarks, ...state.plots].filter(item => item.cell && place.memberIds.includes(item.id)).map(item => key(item.cell!)));
            for (const [i, origin] of origins.entries()) {
                expect(onLand(state, origin)).toBe(true); expect(open.has(key(origin))).toBe(false); expect(ownerCells.has(key(origin))).toBe(true);
                const branch = branches[i] as T.Mesh;
                expect(branch.name).toBe(room ? 'place-root-floor-connector' : 'place-gallery-branch-support'); expect(branch).toBeInstanceOf(T.Mesh);
                const positions = branch.geometry.getAttribute('position'), ring = new T.Vector3();
                // The first actual TubeGeometry ring, excluding its seam duplicate,
                // is centred on the saved owner's high branch attachment.
                const ringVertices = room ? 7 : 12;
                for (let vertex = 0; vertex < ringVertices; vertex++) ring.add(new T.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(branch.matrixWorld));
                ring.multiplyScalar(1 / ringVertices);
                if (room) {
                    expect(layout.cellAt(ring)).toEqual(origin);
                    expect(Math.hypot(ring.x + layout.center - origin.x, ring.z + 2 - origin.z)).toBeLessThan(.25);
                    const end = new T.Vector3();
                    for (let vertex = ringVertices + 1; vertex <= ringVertices * 2; vertex++) end.add(new T.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(branch.matrixWorld));
                    end.multiplyScalar(1 / ringVertices);
                    const floor = physicalFloor(root.getObjectByName('place-physical-gallery')!);
                    const hit = new T.Raycaster(end.clone().add(new T.Vector3(0, 1, 0)), new T.Vector3(0, -1, 0)).intersectObject(floor)[0];
                    expect(hit).toBeDefined(); expect(hit.point.y - end.y).toBeCloseTo(.030, 5); release(floor);
                } else expect(ring.distanceTo(layout.point(origin, 1.1))).toBeLessThan(1e-5);
                for (let vertex = 0; vertex < positions.count; vertex++) {
                    const point = new T.Vector3().fromBufferAttribute(positions, vertex).applyMatrix4(branch.matrixWorld);
                    const cell = { x: point.x + layout.center, z: point.z + 2 };
                    // Even where a branch crosses an open ground cell it stays high:
                    // there is no new support column down through a walking lane.
                    expect(point.y - terrainHeightAt(state, cell)).toBeGreaterThan(.8);
                    if (room && open.has(key(layout.cellAt(point)))) expect(point.y - layout.point(cell).y).toBeGreaterThanOrEqual(1.166671391 + .10);
                }
            }
            expect(state).toEqual(saved);
            release(stairFloor); release(stairRoot); release(root);
        });
    }
});
