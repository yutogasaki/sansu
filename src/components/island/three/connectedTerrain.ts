import * as THREE from 'three';
import type { IslandExpansionLevel } from '../../../domain/island/expansion';
import { getIslandFloorAreas, ISLAND_CENTRAL_FLOOR, ISLAND_EAST_CONNECTOR, ISLAND_MAIN_LAND, ISLAND_WEST_CONNECTOR,
    type IslandLandArea } from '../../../domain/island/landGeometry';
import { IslandMaterials, mesh } from './primitives';
import { ISLAND_TERRAIN_EDGES, ISLAND_TERRAIN_SEGMENTS, terrainContour, terrainEdge,
    type TerrainEdge } from './terrainProfile';
import { createIslandWaterSurfaceMaterial } from './waterSurface';

export const CONNECTED_TERRAIN_CANDIDATE = 'island-connected-shore-v1';
export const CONNECTED_TERRAIN_BLEND_WIDTH = .18;
export type ConnectedTerrainSlot = 'ground' | 'shore' | 'water';
export interface ConnectedTerrainOptions { connectorRadiusZ?: 2.25 | 2.9 | 3.35 }
export type ConnectedTerrainPoint = readonly [number, number, number];
export type ConnectedTerrainContours = Readonly<Record<TerrainEdge, readonly ConnectedTerrainPoint[]>>;
type Point = { x: number; y: number; z: number };
type Segment = { a: Point; b: Point; area?: number };
type Section = { x: number; upper: Point; lower: Point };
const EPSILON = 1e-10;
const contourCache = new Map<string, ConnectedTerrainContours>();
const envelopeCache = new WeakMap<ConnectedTerrainContours, readonly ConnectedTerrainPoint[]>();
const sortedUnique = (values: number[]) => values.sort((a, b) => a - b)
    .filter((value, i, all) => i === 0 || value - all[i - 1] > EPSILON);

function areaRing(area: IslandLandArea, edge: TerrainEdge, radiusZ: number): Point[] {
    const connector = area === ISLAND_EAST_CONNECTOR || area === ISLAND_WEST_CONNECTOR;
    const central = area === ISLAND_CENTRAL_FLOOR;
    const profile = area.x < 0 ? 'west' : area.x > 0 ? 'east' : 'main';
    const sign = profile === 'west' ? -1 : 1;
    return Array.from({ length: ISLAND_TERRAIN_SEGMENTS }, (_, i) => {
        const angle = i * Math.PI * 2 / ISLAND_TERRAIN_SEGMENTS;
        const sample = terrainEdge(angle, edge, profile);
        // Connecting and central ellipses need no duplicate main lobe. The small outset still
        // contains their exact physical ellipses between the polygon vertices.
        const radius = connector || central ? 1.012 + sample.radius - terrainContour(angle, profile) : sample.radius;
        return { x: area.x + Math.cos(angle) * area.radiusX * radius * sign, y: sample.y,
            z: area.z + Math.sin(angle) * (connector ? radiusZ : area.radiusZ) * radius * sign };
    });
}

const atX = ({ a, b }: Segment, x: number): Point => {
    const t = Math.abs(b.x - a.x) < EPSILON ? 0 : Math.max(0, Math.min(1, (x - a.x) / (b.x - a.x)));
    return { x, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t };
};

/** All supported areas cross z=0 and their x intervals overlap. Their upper
 * and lower envelopes therefore form one closed, hole-free coast. Split at
 * every vertex AND segment crossing: sampling vertices alone cuts off lobes
 * where the outer owner switches between two original polygons. */
function outerSections(rings: Point[][]): Section[] {
    const perArea = rings.map((ring, area) => ring.map((a, i) => ({ a, b: ring[(i + 1) % ring.length], area })));
    const segments = perArea.flat(), width = CONNECTED_TERRAIN_BLEND_WIDTH;
    const xs = rings.flatMap(ring => ring.map(point => point.x));
    for (let i = 0; i < segments.length; i++) for (let j = i + 1; j < segments.length; j++) {
        const a = segments[i], b = segments[j];
        if (a.area === b.area) continue;
        const lo = Math.max(Math.min(a.a.x, a.b.x), Math.min(b.a.x, b.b.x));
        const hi = Math.min(Math.max(a.a.x, a.b.x), Math.max(b.a.x, b.b.x));
        if (hi - lo < EPSILON) continue;
        const first = atX(a, lo).z - atX(b, lo).z, last = atX(a, hi).z - atX(b, hi).z;
        for (const threshold of [-width, 0, width]) if ((first - threshold) * (last - threshold) < 0) {
            xs.push(lo + (hi - lo) * (first - threshold) / (first - last));
        }
    }
    const sectionAt = (x: number) => {
        const extreme = (upper: boolean) => {
            // One value per area: duplicate edges at a polygon vertex must not
            // make a single island inflate itself through repeated blending.
            const points = perArea.flatMap(area => {
                const hits = area.filter(({ a, b }) => x >= Math.min(a.x, b.x) - EPSILON && x <= Math.max(a.x, b.x) + EPSILON)
                    .flatMap(segment => Math.abs(segment.a.x - segment.b.x) < EPSILON
                        ? [segment.a, segment.b] : [atX(segment, x)]);
                if (!hits.length) return [];
                const z = (upper ? Math.max : Math.min)(...hits.map(point => point.z));
                const tied = hits.filter(point => Math.abs(point.z - z) < EPSILON);
                return [{ x, z, y: tied.reduce((sum, point) => sum + point.y, 0) / tied.length }];
            });
            if (!points.length) throw new Error('Connected terrain has an unsupported empty cross section');
            let blending = false;
            const point = points.reduce((a, b) => {
                const high = (upper ? a.z >= b.z : a.z <= b.z) ? a : b, low = high === a ? b : a;
                const h = Math.max(0, 1 - Math.abs(a.z - b.z) / width);
                blending ||= h > 0;
                return { x, z: high.z + (upper ? 1 : -1) * width * h * h / 4,
                    y: high.y * (1 - h / 2) + low.y * h / 2 };
            });
            return { point, blending };
        };
        const upper = extreme(true), lower = extreme(false);
        return { x, upper: upper.point, lower: lower.point, blending: upper.blending || lower.blending };
    };
    const breaks = sortedUnique(xs), samples = [...breaks];
    for (let i = 0; i < breaks.length - 1; i++) {
        const a = breaks[i], b = breaks[i + 1];
        if (sectionAt((a + b) / 2).blending) for (const t of [.25, .5, .75]) samples.push(a + (b - a) * t);
    }
    const result: Section[] = [];
    for (const x of sortedUnique(samples)) {
        const next = sectionAt(x);
        while (result.length >= 2) {
            const a = result[result.length - 2], b = result[result.length - 1];
            const t = (b.x - a.x) / (next.x - a.x);
            const redundant = (['upper', 'lower'] as const).every(side => (['y', 'z'] as const).every(axis =>
                Math.abs(b[side][axis] - (a[side][axis] + (next[side][axis] - a[side][axis]) * t)) < EPSILON));
            if (!redundant) break;
            result.pop();
        }
        result.push(next);
    }
    return result;
}

function sampleSection(sections: Section[], x: number, side: 'upper' | 'lower'): ConnectedTerrainPoint {
    let lo = 0, hi = sections.length - 1;
    while (hi - lo > 1) {
        const middle = (lo + hi) >> 1;
        if (sections[middle].x <= x) lo = middle; else hi = middle;
    }
    const a = sections[lo][side], b = sections[hi][side], point = atX({ a, b }, x);
    return Object.freeze([point.x, point.y, point.z] as const);
}

/** Plain immutable coordinates only; no shared BufferGeometry or material.
 * The cache is bounded to three stages × three explicit visual comparisons. */
export function getConnectedTerrainContours(level: IslandExpansionLevel, options: ConnectedTerrainOptions = {}): ConnectedTerrainContours {
    const radiusZ = options.connectorRadiusZ ?? 3.35;
    if (![0, 1, 2].includes(level) || ![2.25, 2.9, 3.35].includes(radiusZ)) throw new RangeError('Unknown connected terrain candidate');
    const key = `${level}:${radiusZ}`, cached = contourCache.get(key);
    if (cached) return cached;
    const areas = getIslandFloorAreas(level);
    const sections = Object.fromEntries(ISLAND_TERRAIN_EDGES.map(edge => [edge,
        outerSections(areas.map(area => areaRing(area, edge, radiusZ)))])) as Record<TerrainEdge, Section[]>;
    // Each layer has a different x extent. Corresponding normalized positions
    // include every layer's actual breakpoints, so no resampling cuts a chord
    // across an unvisited corner of the original outer envelope.
    const knots = sortedUnique(ISLAND_TERRAIN_EDGES.flatMap(edge => {
        const row = sections[edge], min = row[0].x, span = row[row.length - 1].x - min;
        return row.map(point => (point.x - min) / span);
    }));
    if (knots.length > 4096) throw new Error('Connected terrain exceeded its finite contour budget');
    const contours = Object.fromEntries(ISLAND_TERRAIN_EDGES.map(edge => {
        const row = sections[edge], min = row[0].x, span = row[row.length - 1].x - min;
        const upper = knots.map(u => sampleSection(row, min + u * span, 'upper'));
        const lower = knots.slice(1, -1).reverse().map(u => sampleSection(row, min + u * span, 'lower'));
        return [edge, Object.freeze([...upper, ...lower])];
    })) as Record<TerrainEdge, readonly ConnectedTerrainPoint[]>;
    const result = Object.freeze(contours); contourCache.set(key, result); return result;
}

/** The new cap and every shore/shallow vertex, for fixed camera containment. */
export function connectedTerrainEnvelope(level: IslandExpansionLevel, options: ConnectedTerrainOptions = {}) {
    const contours = getConnectedTerrainContours(level, options);
    let result = envelopeCache.get(contours);
    if (!result) { result = Object.freeze(ISLAND_TERRAIN_EDGES.flatMap(edge => contours[edge])); envelopeCache.set(contours, result); }
    return result;
}

function triangulatedGeometry(outer: readonly ConnectedTerrainPoint[], inner?: readonly ConnectedTerrainPoint[], upward = true) {
    const points = [...outer, ...(inner ?? [])];
    const faces = THREE.ShapeUtils.triangulateShape(outer.map(([x, , z]) => new THREE.Vector2(x, z)),
        inner ? [inner.map(([x, , z]) => new THREE.Vector2(x, z))] : []);
    const indices: number[] = [];
    for (const [a, b, c] of faces) {
        const pa = points[a].map(Math.fround), pb = points[b].map(Math.fround), pc = points[c].map(Math.fround);
        const normalY = (pb[2] - pa[2]) * (pc[0] - pa[0]) - (pb[0] - pa[0]) * (pc[2] - pa[2]);
        if (Math.abs(normalY) < 1e-14) continue;
        indices.push(...((normalY > 0) === upward ? [a, b, c] : [a, c, b]));
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(points.flatMap(([x, , z]) => [x / 1.15 + .5, z / 1.15 + .5]), 2));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
}

const area = (points: readonly ConnectedTerrainPoint[]) => Math.abs(THREE.ShapeUtils.area(points.map(([x, , z]) => new THREE.Vector2(x, z))));
const cloneSurface = (m: IslandMaterials, color: string, roughness: number) => {
    const source = m.surface(color, roughness), material = source.clone();
    material.onBeforeCompile = source.onBeforeCompile; material.customProgramCacheKey = source.customProgramCacheKey;
    material.vertexColors = true; material.userData.islandOwned = true;
    return material;
};
const paint = (geometry: THREE.BufferGeometry, color: (point: THREE.Vector3, index: number) => number[]) => {
    const positions = geometry.getAttribute('position'), point = new THREE.Vector3(), colors: number[] = [];
    for (let i = 0; i < positions.count; i++) colors.push(...color(point.fromBufferAttribute(positions, i), i));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
};

/** The pool remains caller-owned. disposeGeometry(group) retires only these
 * geometries/material clones; their map/bump textures stay with the pool. */
export function buildConnectedTerrain(m: IslandMaterials, level: IslandExpansionLevel, slot: ConnectedTerrainSlot,
    options: ConnectedTerrainOptions = {}): THREE.Group {
    const contours = getConnectedTerrainContours(level, options), group = new THREE.Group();
    group.name = `connected-terrain-${slot}`;
    group.userData.connectedTerrain = CONNECTED_TERRAIN_CANDIDATE; group.userData.appearanceSlot = slot;
    const ring = (edges: readonly TerrainEdge[], color: string, roughness: number, faceted = false) => {
        const material = slot === 'water' ? createIslandWaterSurfaceMaterial() : cloneSurface(m, color, roughness);
        if (material instanceof THREE.MeshStandardMaterial && color === '#e4c48a') material.color.lerp(new THREE.Color('#fff1cd'), .22);
        for (let row = 0; row < edges.length - 1; row++) {
            const a = contours[edges[row]], b = contours[edges[row + 1]], firstOuter = area(a) > area(b);
            let geometry = triangulatedGeometry(firstOuter ? a : b, firstOuter ? b : a, firstOuter);
            if (faceted) { const source = geometry; geometry = source.toNonIndexed(); source.dispose(); geometry.computeVertexNormals(); }
            paint(geometry, (point, index) => {
                if (slot !== 'water') {
                    const shade = .96 + .04 * Math.sin(point.x * (faceted ? 2 : .7) + point.z * .8 + .4);
                    return [shade, shade, shade];
                }
                const angle = Math.atan2(point.z / ISLAND_MAIN_LAND.radiusZ, point.x / ISLAND_MAIN_LAND.radiusX);
                const distance = Math.hypot(point.x / ISLAND_MAIN_LAND.radiusX, point.z / ISLAND_MAIN_LAND.radiusZ) - terrainContour(angle);
                const sea = new THREE.Color(m.color('#78d5d5')).lerp(new THREE.Color(m.color('#43a9c5')),
                    Math.min(1, Math.max(0, distance / 2.4)));
                const outerCount = (firstOuter ? a : b).length;
                const boundary = index < outerCount ? firstOuter ? row : row + 1 : firstOuter ? row + 1 : row;
                const blend = [0, .28, .58][boundary];
                return sea.lerp(new THREE.Color(m.color('#76d3c9')), blend).toArray();
            });
            const object = mesh(group, geometry, material); object.name = `${edges[row]}-${edges[row + 1]}`;
            if (slot === 'water') object.castShadow = object.receiveShadow = false;
        }
    };
    if (slot === 'ground') {
        const geometry = triangulatedGeometry(contours.cap);
        paint(geometry, point => {
            const shade = .97 + .03 * Math.sin(point.x * .7 + point.z * .4) * Math.cos(point.z * .65);
            return [shade, shade, shade];
        });
        mesh(group, geometry, cloneSurface(m, '#72ab50', .98)).name = 'cap';
    } else if (slot === 'shore') {
        ring(['foot', 'rock', 'beach'], '#939d85', .95, true);
        ring(['beach', 'sand', 'turf'], '#e4c48a', .98);
        ring(['turf', 'cap'], '#72ab50', .98);
    } else ring(['sea', 'shelf', 'wet'], '#76d3c9', .9);
    return group;
}
