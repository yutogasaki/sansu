import * as T from 'three';
import { connectedWaterChannels } from '../../../domain/islandLife/waterChannels';
import { waterLayout } from '../../../domain/growingIsland/environment';
import { HOME_CELL, key, neighbors, occupant, onLand, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import type { Cell, GrowingState, Landmark } from '../../../domain/growingIsland/types';
import type { DerivedPlace } from '../../../domain/growingIsland/placeTypes';
import { GardenGeometry } from '../three/garden/geometry';
import { placePathEdges } from './placePaths';
import type { SceneLayout } from './sceneLayout';

type WaterOwner = Landmark & { cell: Cell; kind: 'water-bowl' | 'water-channel' };
type Edge = readonly [Cell, Cell];
const SUBDIVISIONS = 12;
const DRY_PATH_RADIUS = .27;
const DRY_SHORE_RADIUS = .28;
const stable = (value: number) => Math.round(value * 1e9) / 1e9;
const hash = (id: string) => [...id].reduce((seed, letter) => Math.imul(seed ^ letter.charCodeAt(0), 16_777_619) >>> 0, 2_166_136_261);

export function pondPointSegmentDistance(point: Cell, a: Cell, b: Cell) {
    const dx = b.x - a.x, dz = b.z - a.z, length = dx * dx + dz * dz;
    const t = length ? T.MathUtils.clamp(((point.x - a.x) * dx + (point.z - a.z) * dz) / length, 0, 1) : 0;
    return Math.hypot(point.x - a.x - dx * t, point.z - a.z - dz * t);
}

function shoreApproach(state: GrowingState, target: Cell, open: Set<string>): Edge[] {
    const queue = [HOME_CELL], previous = new Map<string, Cell | undefined>([[key(HOME_CELL), undefined]]);
    for (let i = 0; i < queue.length && !previous.has(key(target)); i++) for (const next of neighbors(queue[i])) {
        if (!onLand(state, next) || !open.has(key(next)) || previous.has(key(next))) continue;
        previous.set(key(next), queue[i]); queue.push(next);
    }
    const edges: Edge[] = [];
    let at: Cell | undefined = previous.has(key(target)) ? target : undefined;
    while (at) { const before = previous.get(key(at)); if (!before) break; edges.push([before, at]); at = before; }
    return edges;
}

/** The derived wet floor grants no land, navigation, soil effect or new use target. */
export function placePondMask(state: GrowingState, place: DerivedPlace, allPlaces: readonly DerivedPlace[] = [place]) {
    const open = walkableCells(state), reached = reachableFromHome(state, open), supplied = connectedWaterChannels(waterLayout(state));
    const ids = new Set([...place.mainIds, ...place.waterRefs]);
    const owners = state.landmarks.filter((item): item is WaterOwner => ids.has(item.id) && Boolean(item.cell)
        && (item.kind === 'water-bowl' || item.kind === 'water-channel' && supplied.has(key(item.cell!))))
        .sort((a, b) => a.id.localeCompare(b.id));
    const channels = new Set(owners.filter(item => item.kind === 'water-channel').map(item => key(item.cell)));
    const frontDoors = new Set([key(HOME_CELL), key({ x: HOME_CELL.x, z: HOME_CELL.z + 1 }), ...state.plots
        .filter(plot => plot.kind === 'home' && plot.cell).map(plot => key({ x: plot.cell!.x, z: plot.cell!.z + 1 }))]);
    const shores = place.useTargets.filter(target => target.kind === 'shore').map(target => target.cell);
    // The path builder deliberately omits paving on a water-channel crossing.
    // Protect the actual dry ribbons, together with the reachable shore approach.
    const paths = [...placePathEdges(state, allPlaces), ...shores.flatMap(cell => shoreApproach(state, cell, open))]
        .filter(([a, b]) => !channels.has(key(a)) && !channels.has(key(b)));
    const cells = place.footprint.filter(cell => {
        if (!onLand(state, cell) || !open.has(key(cell)) || !reached.has(key(cell)) || frontDoors.has(key(cell))) return false;
        const item = occupant(state, cell);
        return !item || item.type === 'landmark' && channels.has(key(cell)) && owners.some(owner => owner.id === item.id);
    }).sort((a, b) => a.z - b.z || a.x - b.x);
    const allowed = new Set(cells.map(key));
    const blocked = new Map<string, Cell>();
    for (const cell of cells) for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
        const neighbor = { x: cell.x + dx, z: cell.z + dz };
        if (!allowed.has(key(neighbor))) blocked.set(key(neighbor), neighbor);
    }
    const seeds = owners.map(item => ({ ...item.cell, phase: hash(item.id) % 997 / 997 * Math.PI * 2 }));
    const waterField = (point: Cell) => Math.max(-Infinity, ...seeds.map(seed => {
        const x = point.x - seed.x, z = point.z - seed.z, angle = Math.atan2(z, x);
        const radius = 1.13 * (1 + .045 * Math.sin(angle * 3 + seed.phase) + .022 * Math.cos(angle * 5 - seed.phase));
        return radius - Math.hypot(x, z);
    }));
    const field = (point: Cell) => {
        let value = waterField(point);
        for (const cell of blocked.values()) {
            const dx = Math.abs(point.x - cell.x) - .5, dz = Math.abs(point.z - cell.z) - .5;
            value = Math.min(value, Math.hypot(Math.max(dx, 0), Math.max(dz, 0)) + Math.min(Math.max(dx, dz), 0) - .018);
        }
        for (const [a, b] of paths) value = Math.min(value, pondPointSegmentDistance(point, a, b) - DRY_PATH_RADIUS - .015);
        for (const cell of shores) value = Math.min(value, Math.hypot(point.x - cell.x, point.z - cell.z) - DRY_SHORE_RADIUS - .015);
        return value;
    };
    return { owners, cells, allowed, paths, shores, field, waterField,
        grown: place.stage === 'grown' || place.stage === 'lived' };
}

function clippedTriangle(triangle: Cell[], field: (cell: Cell) => number): Cell[] {
    const result: Cell[] = [];
    for (let i = 0; i < triangle.length; i++) {
        const a = triangle[i], b = triangle[(i + 1) % triangle.length], fa = field(a), fb = field(b);
        if (fa >= 0) result.push(a);
        if ((fa >= 0) !== (fb >= 0)) {
            const t = fa / (fa - fb);
            result.push({ x: stable(a.x + (b.x - a.x) * t), z: stable(a.z + (b.z - a.z) * t) });
        }
    }
    return result;
}

function cross(a: Cell, b: Cell, p: Cell) { return (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x); }
function insideTriangle(p: Cell, triangle: Cell[]) {
    const signs = triangle.map((a, i) => cross(a, triangle[(i + 1) % 3], p));
    return signs.every(value => value >= -1e-10) || signs.every(value => value <= 1e-10);
}
function triangleDistance(point: Cell, triangle: Cell[]) {
    return insideTriangle(point, triangle) ? 0 : Math.min(...triangle.map((a, i) => pondPointSegmentDistance(point, a, triangle[(i + 1) % 3])));
}
function edgeDistance(a: Cell, b: Cell, c: Cell, d: Cell) {
    if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0) return 0;
    return Math.min(pondPointSegmentDistance(a, c, d), pondPointSegmentDistance(b, c, d),
        pondPointSegmentDistance(c, a, b), pondPointSegmentDistance(d, a, b));
}
function dryTriangle(triangle: Cell[], paths: Edge[], shores: Cell[]) {
    // Exact planar distances keep a clipped arc's chord outside the dry floor too.
    return paths.every(([a, b]) => !insideTriangle(a, triangle) && !insideTriangle(b, triangle)
        && triangle.every((c, i) => edgeDistance(a, b, c, triangle[(i + 1) % 3]) >= DRY_PATH_RADIUS - 1e-9))
        && shores.every(cell => triangleDistance(cell, triangle) >= DRY_SHORE_RADIUS - 1e-9);
}

/** A broad continuous shallow surface follows each actual ground triangle. */
export function placePondGeometry(state: GrowingState, layout: SceneLayout, place: DerivedPlace, allPlaces: readonly DerivedPlace[] = [place]) {
    const mask = placePondMask(state, place, allPlaces);
    if (!mask.grown || !mask.owners.some(owner => owner.kind === 'water-bowl')) return undefined;
    const positions: number[] = [], colors: number[] = [], indices: number[] = [], vertices = new Map<string, number>();
    const deep = new T.Color('#398aaf'), shallow = new T.Color('#82d1dc'), color = new T.Color();
    const add = (cell: Cell) => {
        const id = `${stable(cell.x)},${stable(cell.z)}`, existing = vertices.get(id);
        if (existing !== undefined) return existing;
        const index = positions.length / 3, point = layout.point(cell, .03);
        positions.push(point.x, point.y, point.z);
        color.copy(shallow).lerp(deep, T.MathUtils.smoothstep(mask.waterField(cell), 0, .8));
        colors.push(color.r, color.g, color.b); vertices.set(id, index); return index;
    };
    for (const cell of mask.cells) for (let z = 0; z < SUBDIVISIONS; z++) for (let x = 0; x < SUBDIVISIONS; x++) {
        const a = { x: cell.x - .5 + x / SUBDIVISIONS, z: cell.z - .5 + z / SUBDIVISIONS };
        const b = { x: a.x + 1 / SUBDIVISIONS, z: a.z }, c = { x: a.x, z: a.z + 1 / SUBDIVISIONS };
        const d = { x: b.x, z: c.z };
        // This diagonal also divides the shared terrain's integer-cell triangles.
        for (const triangle of [[a, b, c], [c, b, d]]) {
            const polygon = clippedTriangle(triangle, mask.field);
            for (let i = 1; i < polygon.length - 1; i++) {
                const face = [polygon[0], polygon[i], polygon[i + 1]];
                if (Math.abs(cross(face[0], face[1], face[2])) < 1e-10 || !dryTriangle(face, mask.paths, mask.shores)) continue;
                indices.push(add(face[0]), add(face[2]), add(face[1]));
            }
        }
    }
    if (!indices.length) return undefined;
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return { geometry, mask };
}

export function buildPlacePond(g: GardenGeometry, state: GrowingState, layout: SceneLayout, place: DerivedPlace, allPlaces: readonly DerivedPlace[] = [place]) {
    const pond = placePondGeometry(state, layout, place, allPlaces);
    if (!pond) return;
    const source = pond.mask.owners.filter(item => item.kind === 'water-bowl')
        .sort((a, b) => layout.heightAt(b.cell) - layout.heightAt(a.cell) || a.id.localeCompare(b.id))[0];
    const group = new T.Group(); group.name = 'place-continuous-water-garden';
    group.userData.ownerId = source.id; group.userData.objectId = source.id;
    group.userData.waterOwners = pond.mask.owners.map(item => item.id); g.root.add(group);
    const material = new T.MeshPhysicalMaterial({ color: '#ffffff', vertexColors: true, roughness: .18, metalness: .035,
        clearcoat: .95, clearcoatRoughness: .12, side: T.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const water = g.mesh(pond.geometry, material, [0, 0, 0], group); water.name = 'place-wide-shallow-water';
    water.castShadow = false; water.userData.waterOwners = group.userData.waterOwners;
    water.userData.shallowFloorOffset = .03; water.userData.dryPathEdges = pond.mask.paths;
}
