import type { Cell } from './types';
import { compileWorldDefinition, type IslandWorld } from './worldDefinition';
import type { WorldDistrict, WorldPoint } from './worldTypes';
import { intersectPolygons, mapTrianglePoint, polygonBounds, polygonBoxesOverlap, polygonHasArea, protectionRectangle, subtractPolygon, triangulateWaterPolygon } from './authoredWaterGeometry';

export interface AuthoredCarvingProtection { cell: Cell; half: number }
interface SourceCover { cells: readonly Cell[]; points: readonly Cell[]; polygon: readonly Cell[]; box: ReturnType<typeof polygonBounds>; logicalBox: ReturnType<typeof polygonBounds> }
interface SourceIndex { buckets: Map<string, SourceCover[]>; identity: boolean }
const indexes = new WeakMap<IslandWorld, Map<string, SourceIndex>>();
const key = (x: number, z: number) => `${x},${z}`;
const compiledId = (districtId: string, floorId: string) => JSON.stringify([districtId, floorId]);
const turn = (cell: Cell, count: number): Cell => count === 1 ? { x: -cell.z, z: cell.x } : count === 2 ? { x: -cell.x, z: -cell.z }
    : count === 3 ? { x: cell.z, z: -cell.x } : { ...cell };
function logicalEnvelope(district: WorldDistrict, envelope: readonly Cell[]) {
    return envelope.map(cell => { const p = turn(cell, district.turn); return { x: p.x + district.logicalOrigin.x, z: p.z + district.logicalOrigin.z }; });
}

/** Explicit DEV constructor. Geometry, rights, anchors and all passage grants stay original. */
export function withNative05WaterCarvingScope(base: IslandWorld): IslandWorld {
    if (base.id !== 'native05-authored-world-m0-v2' || base.definition.source?.sha256 !== '8398eda9ac084a6e80ed22f1a82670c380b017544a177106325aaa7ba7f8f68d')
        throw new Error('Native05 water carving requires the fixed original world');
    const districtId = 'native05-inlet-core', floorId = 'Island / continuous sculpted mature terrain:1';
    const original = base.definition.districts.find(district => district.id === districtId);
    if (!original || !(original.anchorFloors ?? original.floors).some(floor => floor.id === floorId && floor.kind === 'ground'))
        throw new Error('Native05 water carving requires the original hill ground');
    const definition = structuredClone(base.definition);
    definition.districts = definition.districts.map(district => district.id === districtId ? { ...district, waterCarvingScopes: [{
        id: 'native05-hill-water-v1', floorIds: [floorId], envelope: [
            { x: 4.4, z: -10.5 }, { x: 8.6, z: -10.5 }, { x: 8.6, z: -7.4 }, { x: 4.4, z: -7.4 },
        ],
    }] } : district);
    return compileWorldDefinition(definition);
}

/** Compiled original ground IDs which a scoped compositor may cut. Undefined retains the old strict mode. */
export function authoredWaterCarvingFloorIds(base: IslandWorld, districtId: string): readonly string[] | undefined {
    const scopes = base.definition.districts.find(district => district.id === districtId)?.waterCarvingScopes;
    return scopes?.length ? [...new Set(scopes.flatMap(scope => scope.floorIds.map(id => compiledId(districtId, id))))] : undefined;
}

function sourceIndex(base: IslandWorld, districtId: string): SourceIndex {
    let districts = indexes.get(base); if (!districts) { districts = new Map(); indexes.set(base, districts); }
    const existing = districts.get(districtId); if (existing) return existing;
    const buckets = new Map<string, SourceCover[]>(), district = base.definition.districts.find(district => district.id === districtId);
    const index = { buckets, identity: true };
    if (!district) return index;
    const sourceFloors = district.anchorFloors?.length ? base.anchorFloors : base.floors;
    const scopes = district.waterCarvingScopes;
    const strictRectangles = base.sites.filter(site => site.placement && site.ref.districtId === districtId).map(site => protectionRectangle(site.cell, .5));
    for (const floor of sourceFloors) {
        if (floor.kind !== 'ground' || JSON.parse(floor.id)[0] !== districtId) continue;
        const regions = scopes?.length ? scopes.filter(scope => scope.floorIds.some(id => compiledId(districtId, id) === floor.id))
            .map(scope => logicalEnvelope(district, scope.envelope)) : strictRectangles;
        if (!regions.length) continue;
        // Prove the mapping on every compiled vertex, including overlapping
        // source floors. Local equality alone would miss district transforms.
        index.identity &&= floor.vertices.every(vertex => vertex.cell.x === vertex.point.x && vertex.cell.z === vertex.point.z);
        const regionBoxes = regions.map(polygonBounds);
        for (let i = 0; i < floor.indices.length; i += 3) {
            const vertices = floor.indices.slice(i, i + 3).map(id => floor.vertices[id]), cells = vertices.map(vertex => vertex.cell), points = vertices.map(vertex => vertex.point);
            const logicalBox = polygonBounds(cells);
            for (let r = 0; r < regions.length; r++) {
                if (!polygonBoxesOverlap(logicalBox, regionBoxes[r])) continue;
                const logical = intersectPolygons(cells, regions[r]); if (!polygonHasArea(logical)) continue;
                const polygon = logical.map(cell => mapTrianglePoint(cell, cells, points)), box = polygonBounds(polygon);
                const cover: SourceCover = { cells, points, polygon, box, logicalBox };
                for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ); z++) for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX); x++) {
                    const id = key(x, z), list = buckets.get(id) ?? []; list.push(cover); buckets.set(id, list);
                }
            }
        }
    }
    districts.set(districtId, index); return index;
}

function candidatesIn(index: SourceIndex, box: ReturnType<typeof polygonBounds>): Set<SourceCover> {
    const candidates = new Set<SourceCover>();
    for (let z = Math.floor(box.minZ); z <= Math.floor(box.maxZ); z++) for (let x = Math.floor(box.minX); x <= Math.floor(box.maxX); x++)
        for (const source of index.buckets.get(key(x, z)) ?? []) if (polygonBoxesOverlap(box, source.box)) candidates.add(source);
    return candidates;
}

/** Prove the whole physical polygon lies on permitted original ground and does
 * not intersect any protected logical footprint through that ground's mapping. */
export function isAuthoredWaterCarvingSafe(base: IslandWorld, districtId: string, outline: readonly WorldPoint[], protections: readonly AuthoredCarvingProtection[]): boolean {
    if (outline.some(point => !Number.isFinite(point.y)) || protections.some(p => !Number.isFinite(p.cell.x) || !Number.isFinite(p.cell.z) || !Number.isFinite(p.half) || p.half <= 0)) return false;
    const triangles = triangulateWaterPolygon(outline); if (!triangles) return false;
    if (triangles.some(triangle => { const box = polygonBounds(triangle);
        // A small bbox beyond safe integers can still make x++/z++ stop
        // advancing. Reject it before either coverage or protection queries.
        return ![box.minX, box.maxX, box.minZ, box.maxZ].every(value => Number.isSafeInteger(Math.floor(value)))
            || (Math.floor(box.maxX) - Math.floor(box.minX) + 1) * (Math.floor(box.maxZ) - Math.floor(box.minZ) + 1) > 100_000; })) return false;
    const index = sourceIndex(base, districtId), protectedRegions = protections.map(p => ({ polygon: protectionRectangle(p.cell, p.half), box: polygonBounds(protectionRectangle(p.cell, p.half)) }));
    if (index.identity) {
        // Keep the original ears and clipping order: their individual area
        // threshold must not become an area summed across a convex union.
        // Once this independent protection proof passes, complete coverage
        // can stop without visiting later, identically mapped source floors.
        for (const triangle of triangles) {
            const box = polygonBounds(triangle);
            for (const protection of protectedRegions) {
                if (!polygonBoxesOverlap(box, protection.box)) continue;
                const joint = { minX: Math.max(box.minX, protection.box.minX), maxX: Math.min(box.maxX, protection.box.maxX),
                    minZ: Math.max(box.minZ, protection.box.minZ), maxZ: Math.min(box.maxZ, protection.box.maxZ) };
                for (const source of candidatesIn(index, joint)) {
                    if (!polygonBoxesOverlap(source.logicalBox, protection.box)) continue;
                    const overlap = intersectPolygons(triangle, source.polygon); if (!polygonHasArea(overlap)) continue;
                    const logical = overlap.map(point => mapTrianglePoint(point, source.points, source.cells));
                    if (polygonHasArea(intersectPolygons(logical, protection.polygon))) return false;
                }
            }
        }
    }
    for (const triangle of triangles) {
        const box = polygonBounds(triangle);
        let uncovered = [{ polygon: triangle, box }];
        for (const source of candidatesIn(index, box)) {
            if (index.identity && !uncovered.some(piece => polygonBoxesOverlap(piece.box, source.box))) continue;
            const overlap = intersectPolygons(triangle, source.polygon); if (!polygonHasArea(overlap)) continue;
            if (!index.identity) {
                const logical = overlap.map(point => mapTrianglePoint(point, source.points, source.cells));
                if (protectedRegions.some(p => polygonBoxesOverlap(source.logicalBox, p.box) && polygonHasArea(intersectPolygons(logical, p.polygon)))) return false;
            }
            uncovered = uncovered.flatMap(piece => polygonBoxesOverlap(piece.box, source.box)
                ? subtractPolygon(piece.polygon, source.polygon).map(polygon => ({ polygon, box: polygonBounds(polygon) })) : [piece]);
            if (index.identity && !uncovered.length) break;
            // Do not stop at full coverage: another triangle of the same raw
            // source can still expose an overlap with a protected footprint.
        }
        if (uncovered.length) return false;
    }
    return true;
}
