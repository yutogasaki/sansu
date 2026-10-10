import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { newIsland } from '../../../domain/growingIsland/island';
import { placeGoalCatalog } from '../../../domain/growingIsland/placeCatalog';
import { derivePlaces } from '../../../domain/growingIsland/places';
import { SPECIES } from '../../../domain/growingIsland/rules';
import { key, walkableCells } from '../../../domain/growingIsland/space';
import type { LandmarkKind, SeedKind } from '../../../domain/growingIsland/types';
import { GardenGeometry } from '../three/garden/geometry';
import { makePokomokoRig } from '../three/islandCharacters';
import { disposeGeometry, IslandMaterials } from '../three/primitives';
import { makeVillagerActor, wrapPokomoko } from './actors';
import { sceneLayout } from './sceneLayout';
import { buildPlaceGeometry } from './placeGeometry';
import { buildPlaceRootRoom, ROOT_ROOM_ACTOR_HEIGHT, ROOT_ROOM_ACTOR_RADIUS } from './placeRootRoomGeometry';

function fixture(variant: 'court' | 'lane', sloped = true) {
    const state = newIsland(`root-room-${variant}`, 1_000);
    state.land = { expanded: 'east', extra: ['west', 'south'], capes: ['east', 'west'] };
    state.tutorial = 'done'; state.landmarks = []; state.plots = []; state.unopened = []; state.arrivals = []; state.villagers = []; state.nature.hours = 200;
    const goal = placeGoalCatalog.find(goal => goal.id === 'P02')!;
    for (const [i, entry] of goal.variants.find(entry => entry.id === variant)!.demo.entries()) {
        const [type, kind] = goal.inputs.find(input => input.role === entry.role)!.kind.split(':');
        const id = `owned-${i}`, cell = { x: entry.x + (sloped ? 6 : 0), z: entry.z + 1 };
        if (type === 'landmark') state.landmarks.push({ id, kind: kind as LandmarkKind, cell, growth: 18, maturedAt: 0 });
        else state.plots.push({ id, kind: kind as SeedKind, cell, plantedAt: 0, builtAt: 6, stagedAt: 6, stage: 2,
            style: 'tree', growth: 0, origin: 'seed', paid: 40 });
    }
    return state;
}

function triangles(root: T.Object3D) {
    const result: T.Triangle[] = []; root.updateMatrixWorld(true);
    root.traverse(object => {
        if (!(object instanceof T.Mesh)) return;
        const positions = object.geometry.getAttribute('position'), index = object.geometry.getIndex();
        for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
            const points = [0, 1, 2].map(offset => new T.Vector3().fromBufferAttribute(positions, index ? index.getX(i + offset) : i + offset).applyMatrix4(object.matrixWorld));
            result.push(new T.Triangle(points[0], points[1], points[2]));
        }
    });
    return result;
}

/** Clip real triangles to the full actor height before testing their XZ distance.
 * This checks the complete solid cylindrical passage, stronger than a centre ray. */
function cylinderIntersection(triangle: T.Triangle, floor: T.Vector3) {
    let polygon = [triangle.a, triangle.b, triangle.c];
    for (const [height, above] of [[floor.y - .08, true], [floor.y + ROOT_ROOM_ACTOR_HEIGHT, false]] as const) {
        const clipped: T.Vector3[] = [];
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i], b = polygon[(i + 1) % polygon.length];
            const insideA = above ? a.y >= height : a.y <= height, insideB = above ? b.y >= height : b.y <= height;
            if (insideA) clipped.push(a);
            if (insideA !== insideB) clipped.push(a.clone().lerp(b, (height - a.y) / (b.y - a.y)));
        }
        polygon = clipped;
    }
    if (!polygon.length) return false;
    const center = new T.Vector3(floor.x, 0, floor.z), projected = polygon.map(point => new T.Vector3(point.x, 0, point.z));
    for (let i = 1; i < projected.length - 1; i++) {
        const face = new T.Triangle(projected[0], projected[i], projected[i + 1]);
        if (face.getArea() > 1e-12 && face.containsPoint(center)) return true;
    }
    for (let i = 0; i < projected.length; i++) {
        const closest = new T.Line3(projected[i], projected[(i + 1) % projected.length]).closestPointToPoint(center, true, new T.Vector3());
        if (closest.distanceToSquared(center) <= ROOT_ROOM_ACTOR_RADIUS ** 2) return true;
    }
    return false;
}

function release(g: GardenGeometry) { disposeGeometry(g.root); g.dispose(); }

describe('continuous owned hollow root room', () => {
    it('sizes the passage from real all-species standing geometry with every hat and ear', () => {
        const m = new IslandMaterials('moon-garden'), hero = makePokomokoRig(m), poco = wrapPokomoko(hero.hero, hero.heroBody, hero.heroFeet);
        let maximumHeight = 0, maximumRadius = 0;
        const check = (root: T.Object3D) => {
            root.updateMatrixWorld(true);
            let height = -Infinity, bottom = Infinity, radius = 0;
            root.traverse(object => {
                if (!(object instanceof T.Mesh)) return;
                const positions = object.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    const point = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
                    height = Math.max(height, point.y); bottom = Math.min(bottom, point.y); radius = Math.max(radius, Math.hypot(point.x, point.z));
                }
            });
            maximumHeight = Math.max(maximumHeight, height); maximumRadius = Math.max(maximumRadius, radius);
            expect(height).toBeLessThan(ROOT_ROOM_ACTOR_HEIGHT - .09);
            expect(radius).toBeLessThan(ROOT_ROOM_ACTOR_RADIUS - .049);
            expect(bottom).toBeGreaterThan(-.08);
            disposeGeometry(root);
        };
        check(poco.root);
        for (const species of SPECIES) for (let hat = 0; hat <= 5; hat++) for (let accessory = 0; accessory < 4; accessory++) {
            check(makeVillagerActor(m, { id: 'actual-actor', species, variant: { color: 0, accessory, sparkle: false },
                trait: 'mellow', home: 'pokomoko', arrivedAt: 0, outfit: { hat } }).root);
        }
        expect(maximumHeight).toBeCloseTo(1.166671390, 7); expect(maximumRadius).toBeCloseTo(.542376379, 7);
        m.dispose();
    });

    for (const sloped of [false, true]) it(`${sloped ? 'sloped' : 'level'}: has one broad enclosed amber volume and four real bounded roots`, () => {
        const state = fixture('court', sloped), saved = structuredClone(state), layout = sceneLayout(state), open = walkableCells(state);
        const place = derivePlaces(state).find(place => place.ruleId === 'P02')!, savedRoute = structuredClone(place.walkSurface), g = new GardenGeometry();
        expect(buildPlaceRootRoom(g, state, layout, place)).toBe(true);
        const room = g.root.getObjectByName('place-root-room')!, wood = room.getObjectByName('place-living-root-room')!;
        expect(room.userData.supportOwnerIds).toEqual(place.mainIds); expect(room.userData.floorRoute).toEqual(savedRoute);
        const bounds = new T.Box3().setFromObject(wood, true), size = bounds.getSize(new T.Vector3());
        expect(size.x).toBeGreaterThan(2.7); expect(size.x).toBeLessThan(3.10);
        expect(size.z).toBeGreaterThan(2.7); expect(size.z).toBeLessThan(3.10);
        const edges = new Map<string, number>(), adjacency = new Map<string, Set<string>>();
        const idOf = (point: T.Vector3) => point.toArray().map(value => Math.round(value * 1_000_000)).join(',');
        for (const face of triangles(wood)) {
            expect(face.getArea()).toBeGreaterThan(1e-12);
            const ids = [face.a, face.b, face.c].map(idOf);
            for (let i = 0; i < 3; i++) {
                const a = ids[i], b = ids[(i + 1) % 3], edge = [a, b].sort().join(':');
                edges.set(edge, (edges.get(edge) ?? 0) + 1);
                const neighbors = adjacency.get(a) ?? new Set<string>(); neighbors.add(b); adjacency.set(a, neighbors);
            }
        }
        expect([...edges.values()].filter(count => count !== 2)).toEqual([]);
        const visited = new Set<string>(), pending = [adjacency.keys().next().value!];
        for (let i = 0; i < pending.length; i++) for (const id of adjacency.get(pending[i])!) if (!visited.has(id)) { visited.add(id); pending.push(id); }
        expect(visited.size).toBe(adjacency.size);
        wood.traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            const positions = object.geometry.getAttribute('position'), normals = object.geometry.getAttribute('normal');
            for (const attribute of [positions, normals]) expect(Array.from(attribute.array).every(Number.isFinite)).toBe(true);
            for (let i = 0; i < positions.count; i++) {
                const point = new T.Vector3().fromBufferAttribute(positions, i), cell = { x: point.x + layout.center, z: point.z + 2 };
                if (point.y - layout.heightAt(cell) >= ROOT_ROOM_ACTOR_HEIGHT) continue;
                expect(place.mainIds.some(id => {
                    const owner = state.landmarks.find(item => item.id === id)!.cell!;
                    return !open.has(key(owner)) && Math.hypot(cell.x - owner.x, cell.z - owner.z) <= .40;
                })).toBe(true);
            }
            (object.material as T.Material).side = T.DoubleSide;
        });
        const ownedRoots = wood.children.filter(child => child.name === 'place-owned-tree');
        expect(ownedRoots).toHaveLength(4);
        for (const ownerRoot of ownedRoots) {
            const owner = state.landmarks.find(item => item.id === ownerRoot.userData.ownerId)!.cell!, base = layout.point(owner);
            const outward = base.clone().sub(layout.point(room.userData.courtCenter)).setY(0).normalize();
            const origin = base.clone().addScaledVector(outward, .65); origin.y += .55;
            const hit = new T.Raycaster(origin, outward.negate()).intersectObject(ownerRoot, true)[0];
            expect(hit).toBeDefined(); expect(hit.object.userData.objectId).toBe(ownerRoot.userData.ownerId);
        }
        // A head-height interior ray reaches the opposite wood wall through a
        // genuine empty room, and the retained canopy closes above the actor.
        const center = layout.point(room.userData.courtCenter), insideY = Math.max(...place.walkSurface.map(point => point.y)) + ROOT_ROOM_ACTOR_HEIGHT;
        const ray = new T.Raycaster(new T.Vector3(center.x, insideY, center.z), new T.Vector3(0, 1, 0));
        const roof = ray.intersectObject(wood, true)[0]; expect(roof).toBeDefined(); expect(roof.point.y - insideY).toBeGreaterThan(.10);
        const windows = room.children.filter(child => child.name === 'place-root-room-small-window');
        expect(windows).toHaveLength(1); expect(windows[0].position.x - center.x).toBeGreaterThan(.8);
        expect(size.y).toBeGreaterThan(3.3);
        expect(room.children.some(child => child.userData.walkSurface)).toBe(false);
        expect(state).toEqual(saved); expect(place.walkSurface).toEqual(savedRoute); expect(walkableCells(state)).toEqual(open);
        release(g);
    });

    it('keeps every actual wood/window triangle outside the full-body swept gallery passage', () => {
        const state = fixture('court'), layout = sceneLayout(state), place = derivePlaces(state).find(place => place.ruleId === 'P02')!, g = new GardenGeometry();
        expect(buildPlaceRootRoom(g, state, layout, place)).toBe(true);
        const faces = triangles(g.root), boxes = faces.map(face => new T.Box3().setFromPoints([face.a, face.b, face.c]));
        let checked = 0;
        for (let i = 1; i < place.walkSurface.length; i++) {
            const a = layout.floorPoint(place.walkSurface[i - 1]), b = layout.floorPoint(place.walkSurface[i]);
            const steps = Math.max(1, Math.ceil(a.distanceTo(b) / .035));
            for (let step = 0; step <= steps; step++) {
                const floor = a.clone().lerp(b, step / steps);
                for (let face = 0; face < faces.length; face++) {
                    const box = boxes[face], r = ROOT_ROOM_ACTOR_RADIUS;
                    if (box.max.y < floor.y - .08 || box.min.y > floor.y + ROOT_ROOM_ACTOR_HEIGHT
                        || box.min.x > floor.x + r || box.max.x < floor.x - r || box.min.z > floor.z + r || box.max.z < floor.z - r) continue;
                    expect(cylinderIntersection(faces[face], floor), `body/sole collision at route ${i}/${step}, triangle ${face}`).toBe(false); checked++;
                }
            }
        }
        expect(checked).toBeGreaterThan(100); release(g);
    });

    it('retains the four saved jade crowns without putting any new room or leaf triangle in the full-body gallery passage', () => {
        const state = fixture('court'), saved = structuredClone(state), layout = sceneLayout(state), place = derivePlaces(state).find(place => place.ruleId === 'P02')!;
        const world = buildPlaceGeometry(state, layout, [place]), room = world.getObjectByName('place-root-room')!;
        const ownedRoots = room.getObjectByName('place-living-root-room')!.children.filter(child => child.name === 'place-owned-tree');
        expect(ownedRoots.map(root => root.userData.ownerId)).toEqual(place.mainIds);
        for (const owner of ownedRoots) {
            const leaves = owner.children.filter(child => child.name === 'place-root-room-owner-crown' && child instanceof T.Mesh);
            expect(leaves.length).toBeGreaterThanOrEqual(7);
            for (const leaf of leaves) {
                leaf.updateWorldMatrix(true, false);
                const positions = (leaf as T.Mesh).geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    const point = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(leaf.matrixWorld);
                    const cell = { x: point.x + layout.center, z: point.z + 2 };
                    expect(point.y - layout.point(cell).y, 'restored leaf or branch intrudes on standing ears').toBeGreaterThanOrEqual(ROOT_ROOM_ACTOR_HEIGHT);
                }
            }
        }
        const faces = triangles(room), boxes = faces.map(face => new T.Box3().setFromPoints([face.a, face.b, face.c]));
        for (let i = 1; i < place.walkSurface.length; i++) {
            const a = layout.floorPoint(place.walkSurface[i - 1]), b = layout.floorPoint(place.walkSurface[i]), steps = Math.max(1, Math.ceil(a.distanceTo(b) / .035));
            for (let step = 0; step <= steps; step++) {
                const floor = a.clone().lerp(b, step / steps), r = ROOT_ROOM_ACTOR_RADIUS;
                for (let face = 0; face < faces.length; face++) {
                    const box = boxes[face];
                    if (box.max.y < floor.y - .08 || box.min.y > floor.y + ROOT_ROOM_ACTOR_HEIGHT
                        || box.min.x > floor.x + r || box.max.x < floor.x - r || box.min.z > floor.z + r || box.max.z < floor.z - r) continue;
                    expect(cylinderIntersection(faces[face], floor), `room or leaf collision at ${i}/${step}/${face}`).toBe(false);
                }
            }
        }
        expect(state).toEqual(saved); disposeGeometry(world);
    });

    it('uses the unchanged real gallery boards for the actual Poco soles through the room', () => {
        const state = fixture('court'), saved = structuredClone(state), layout = sceneLayout(state), place = derivePlaces(state).find(place => place.ruleId === 'P02')!;
        const gallery = buildPlaceGeometry(state, layout, [place]), deck = gallery.getObjectByName('place-physical-gallery')!, g = new GardenGeometry();
        expect(buildPlaceRootRoom(g, state, layout, place)).toBe(true);
        expect(deck.userData.floorRoute).toEqual(place.walkSurface);
        const woodColor = new T.Color('#cda579'), floorVertices: number[] = [];
        deck.updateMatrixWorld(true);
        deck.traverse(object => {
            if (!(object instanceof T.Mesh)) return;
            const p = object.geometry.getAttribute('position'), c = object.geometry.getAttribute('color'), index = object.geometry.getIndex();
            const material = object.material;
            const isFloor = (vertex: number) => c ? Math.abs(c.getX(vertex) - woodColor.r) < 1e-5 && Math.abs(c.getY(vertex) - woodColor.g) < 1e-5 && Math.abs(c.getZ(vertex) - woodColor.b) < 1e-5
                : material instanceof T.MeshStandardMaterial && material.color.equals(woodColor);
            for (let i = 0; i < (index?.count ?? p.count); i += 3) {
                const face = [0, 1, 2].map(offset => index ? index.getX(i + offset) : i + offset);
                if (!face.every(isFloor)) continue;
                for (const vertex of face) floorVertices.push(...new T.Vector3().fromBufferAttribute(p, vertex).applyMatrix4(object.matrixWorld).toArray());
            }
        });
        const floorGeometry = new T.BufferGeometry(); floorGeometry.setAttribute('position', new T.Float32BufferAttribute(floorVertices, 3));
        const floorMaterial = new T.MeshBasicMaterial({ side: T.DoubleSide }), floor = new T.Mesh(floorGeometry, floorMaterial); floor.updateMatrixWorld(true);
        const m = new IslandMaterials('moon-garden'), rig = makePokomokoRig(m), actor = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
        const soles = actor.feet.map(foot => {
            const p = (foot as T.Mesh).geometry.getAttribute('position'); let lowest = 0;
            for (let i = 1; i < p.count; i++) if (p.getY(i) < p.getY(lowest)) lowest = i;
            return new T.Vector3().fromBufferAttribute(p, lowest);
        });
        for (let i = 1; i < place.walkSurface.length; i++) {
            const a = layout.floorPoint(place.walkSurface[i - 1]), b = layout.floorPoint(place.walkSurface[i]);
            if (Math.hypot(b.x - a.x, b.z - a.z) < .001) continue;
            actor.root.position.copy(a.clone().lerp(b, .5)); actor.root.rotation.y = Math.atan2(b.x - a.x, b.z - a.z); actor.root.updateMatrixWorld(true);
            for (const [side, foot] of actor.feet.entries()) {
                const sole = soles[side].clone().applyMatrix4(foot.matrixWorld);
                const hit = new T.Raycaster(sole.clone().add(new T.Vector3(0, .10, 0)), new T.Vector3(0, -1, 0)).intersectObject(floor)[0];
                expect(hit, `actual sole lost its real board at ${i}/${side}`).toBeDefined(); expect(Math.abs(hit.point.y - sole.y)).toBeLessThanOrEqual(.10);
            }
        }
        expect(state).toEqual(saved); disposeGeometry(actor.root); disposeGeometry(gallery); m.dispose(); floorGeometry.dispose(); floorMaterial.dispose(); release(g);
    });

    it('keeps cached source geometry separate from mutable/disposed worlds and refreshes ownership', () => {
        const state = fixture('court'), layout = sceneLayout(state), place = derivePlaces(state).find(place => place.ruleId === 'P02')!, first = new GardenGeometry(), second = new GardenGeometry();
        expect(buildPlaceRootRoom(first, state, layout, place)).toBe(true);
        const original = first.root.getObjectByName('place-root-room-shell') as T.Mesh, positions = original.geometry.getAttribute('position');
        const firstPoint = [positions.getX(0), positions.getY(0), positions.getZ(0)]; positions.setXYZ(0, 100, 100, 100); release(first);
        const renamed = { ...state, landmarks: state.landmarks.map(item => ({ ...item, id: `new-${item.id}` })) };
        const next = { ...place, stage: 'lived' as const, mainIds: place.mainIds.map(id => `new-${id}`) };
        expect(buildPlaceRootRoom(second, renamed, layout, next)).toBe(true);
        const restored = (second.root.getObjectByName('place-root-room-shell') as T.Mesh).geometry.getAttribute('position');
        expect([restored.getX(0), restored.getY(0), restored.getZ(0)]).toEqual(firstPoint);
        expect(second.root.getObjectByName('place-root-room')!.userData.supportOwnerIds).toEqual(next.mainIds);
        release(second);
    });

    it('falls back without mutation for lanes, missing owners, incomplete loops or immature places', () => {
        const court = fixture('court'), lane = fixture('lane'), layout = sceneLayout(court), place = derivePlaces(court).find(place => place.ruleId === 'P02')!;
        const lanePlace = derivePlaces(lane).find(place => place.ruleId === 'P02')!;
        const cases = [{ state: lane, place: lanePlace }, { state: { ...court, landmarks: court.landmarks.filter(item => item.id !== place.mainIds[0]) }, place },
            { state: court, place: { ...place, walkSurface: place.walkSurface.slice(0, 28) } }, { state: court, place: { ...place, stage: 'connected' as const } }];
        for (const entry of cases) {
            const saved = structuredClone(entry.state), g = new GardenGeometry();
            expect(buildPlaceRootRoom(g, entry.state, layout, entry.place)).toBe(false); expect(g.root.children).toHaveLength(0);
            expect(entry.state).toEqual(saved); release(g);
        }
    });
});
