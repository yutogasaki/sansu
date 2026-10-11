import * as T from 'three';
import { landBounds } from '../../../domain/growingIsland/space';
import { terrainHeightAt } from '../../../domain/growingIsland/placeTerrain';
import type { PlacePoint } from '../../../domain/growingIsland/placeTypes';
import type { Cell, GrowingState } from '../../../domain/growingIsland';
import { landscapeCell, landscapePoint, landscapeRise } from '../../../domain/growingIsland/landscape';
import { legacyIslandWorld } from '../../../domain/growingIsland/legacyWorldDefinition';
import type { IslandWorld as CompiledWorld } from '../../../domain/growingIsland/worldDefinition';
import type { AuthoredWaterPlan } from '../../../domain/growingIsland/authoredWaterWorld';
import { AUTHORED_ACTOR_VISUAL_SCALE } from './actorScale';

/** The same cell-to-world mapping as the current garden, so saved coordinates look the same. */
export function sceneLayout(state: Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge'>>, curved = false, authored?: CompiledWorld, waterPlan?: AuthoredWaterPlan, baseWorld?: CompiledWorld) {
    if (authored) return authoredSceneLayout(authored, waterPlan, baseWorld);
    const bounds = landBounds(state), center = (bounds.minX + bounds.maxX) / 2;
    const world = legacyIslandWorld(state, curved);
    const groundFloor = world.floors.find(floor => floor.kind === 'ground')!;
    const shoreCell = (cell: Cell) => state.bridge && cell.x === state.bridge.x && cell.z >= bounds.depth ? { x: cell.x, z: bounds.depth - 1 } : cell;
    const heightAt = (cell: Cell) => {
        const height = world.floorAt(shoreCell(cell), groundFloor.id)?.point.y
            ?? terrainHeightAt(state, shoreCell(cell)) + (curved ? landscapeRise(shoreCell(cell)) : 0);
        return Math.round(height * 1e9) / 1e9;
    };
    const projected = (cell: Cell) => {
        const floor = world.floorAt(cell, groundFloor.id);
        return floor ? { x: floor.point.x, z: floor.point.z } : curved ? landscapePoint(cell) : cell;
    };
    const point = (cell: Cell, y = .04) => {
        const p = projected(cell);
        const deck = state.bridge && Math.abs(cell.x - state.bridge.x) <= .36 && cell.z >= bounds.depth - .695;
        const floor = deck ? heightAt({ x: state.bridge!.x, z: bounds.depth - 1 }) : heightAt(cell);
        return new T.Vector3(p.x - center, floor + y + (deck ? .1525 : 0), p.z - 2);
    };
    const floorPoint = (floor: PlacePoint) => {
        const p = projected(floor);
        return new T.Vector3(p.x - center, floor.y + (curved ? landscapeRise(floor) : 0), p.z - 2);
    };
    const logicalAt = (position: { x: number; z: number }): Cell => {
        const p = { x: position.x + center, z: position.z + 2 };
        return world.logicalAt(p) ?? (curved ? landscapeCell(p) : p);
    };
    const cellAt = (world: T.Vector3): Cell => { const cell = logicalAt(world); return { x: Math.round(cell.x), z: Math.round(cell.z) }; };
    // The pier leaves the south shore near the east side; boats come in from the south-east.
    const pierCell = { x: bounds.maxX - 1, z: bounds.depth - 1 };
    const pierRoot = point(pierCell).add(new T.Vector3(0, -.02, .62));
    const pierEnd = pierRoot.clone().add(new T.Vector3(0, .07, 1.2));
    const dock = pierRoot.clone().add(new T.Vector3(.62, -.18, 1.3));
    // The sea does not rise with a new district. A physical stair-pier descends from
    // the real shore to the same low waiting platform and floating boat.
    pierEnd.y = .09; dock.y = -.16;
    const far = dock.clone().add(new T.Vector3(3.4, 0, 3.2));
    const farther = dock.clone().add(new T.Vector3(5.6, 0, 5.2));
    const key = `${bounds.minX},${bounds.maxX},${bounds.depth}:${curved ? 'curved-owned-v1' : 'linear'}`;
    let maxHeight = 0;
    for (let z = 0; z < bounds.depth; z++) maxHeight = Math.max(maxHeight, heightAt({ x: bounds.minX, z }), heightAt({ x: bounds.maxX, z }));
    return { bounds, center, world, point, floorPoint, heightAt, maxHeight, cellAt, logicalAt, projected, curved, authored: false, actorVisualScale: 1, pierRoot, pierEnd, dock, far, farther, key, nativeArt: false,
        // The world supplies the actual static models after rebuilding. Camera fit
        // uses their vertices rather than placing a tall imaginary tree on every shore.
        cameraObjects: undefined as (() => readonly T.Object3D[]) | undefined,
        authoredWaterPlan: undefined as AuthoredWaterPlan | undefined, authoredBaseWorld: undefined as CompiledWorld | undefined,
        artMargin: bounds.maxX - bounds.minX > 5 || bounds.depth > 5 ? 2.7 : 1.1,
        width: bounds.maxX - bounds.minX + 1, depth: bounds.depth };
}

/** Authored terrain owns both the physical map and its placement sites. Bounds
 * are only a framing extent; an inlet inside them never acquires a floor. */
function authoredSceneLayout(world: CompiledWorld, waterPlan?: AuthoredWaterPlan, baseWorld?: CompiledWorld) {
    const center = (world.bounds.min.x + world.bounds.max.x) / 2;
    const bounds = { minX: Math.floor(world.bounds.min.x), maxX: Math.ceil(world.bounds.max.x), depth: Math.ceil(world.bounds.max.z - world.bounds.min.z) };
    // A layout belongs to one immutable compiled world. Geometry builders ask
    // for the same floor through point, projection and height; reuse that answer
    // locally, while keeping their returned vectors and objects independent.
    const floorPoints = new Map<string, { x: number; y: number; z: number } | undefined>();
    const floorPointAt = (cell: Cell & { y?: number }) => {
        if (!Number.isFinite(cell.x) || !Number.isFinite(cell.z) || ('y' in cell && !Number.isFinite(cell.y))) return undefined;
        const id = `${cell.x},${cell.z}`;
        if (floorPoints.has(id)) return floorPoints.get(id);
        const floor = world.floorAt(cell)?.point, point = floor ? { ...floor } : undefined;
        floorPoints.set(id, point);
        // Arbitrary pointer and curve samples must not accumulate for the
        // lifetime of an island. Eviction changes work, never floor semantics.
        if (floorPoints.size > 16_384) floorPoints.delete(floorPoints.keys().next().value!);
        return point;
    };
    const heightAt = (cell: Cell) => floorPointAt(cell)?.y ?? world.anchorAt(cell)?.y ?? 0;
    const projected = (cell: Cell) => { const floor = floorPointAt(cell); return floor ? { x: floor.x, z: floor.z } : cell; };
    const point = (cell: Cell, y = .04) => {
        const floor = floorPointAt(cell) ?? world.anchorAt(cell);
        return new T.Vector3((floor?.x ?? cell.x) - center, (floor?.y ?? 0) + y, (floor?.z ?? cell.z) - 2);
    };
    // PlacePoint.y is supplied by the same authored floor evaluator, including
    // a derived gallery's actual clearance above that floor.
    const floorPoint = (floor: PlacePoint) => {
        const p = projected(floor); return new T.Vector3(p.x - center, floor.y, p.z - 2);
    };
    const logicalAt = (position: { x: number; z: number; y?: number }): Cell => world.logicalAt({ x: position.x + center, z: position.z + 2,
        ...(position.y === undefined ? {} : { y: position.y }) })
        ?? { x: Number.NaN, z: Number.NaN };
    const cellAt = (position: T.Vector3): Cell => {
        const site = world.siteAt({ x: position.x + center, y: position.y, z: position.z + 2 });
        return site ? { ...site.cell } : { x: Number.NaN, z: Number.NaN };
    };
    // The diagnostic native05 template keeps its original south-facing home
    // approach as a shore port. Other templates may supply an explicit port.
    const port = world.definition.districts.flatMap(district => district.ports.map(port => world.sites.find(site => site.ref.districtId === district.id && site.ref.siteId === port.siteId)))
        .find(site => site);
    const approach = port?.cell ?? { x: 2, z: 1 };
    const pierRoot = point(approach, -.02).add(new T.Vector3(.22, 0, .75));
    const pierEnd = pierRoot.clone().add(new T.Vector3(0, 0, 1.2)); pierEnd.y = .09;
    const dock = pierRoot.clone().add(new T.Vector3(.62, 0, 1.3)); dock.y = -.16;
    const far = dock.clone().add(new T.Vector3(3.4, 0, 3.2)), farther = dock.clone().add(new T.Vector3(5.6, 0, 5.2));
    return { bounds, center, world, point, floorPoint, heightAt, maxHeight: world.bounds.max.y, cellAt, logicalAt, projected, curved: false, authored: true, actorVisualScale: AUTHORED_ACTOR_VISUAL_SCALE,
        pierRoot, pierEnd, dock, far, farther, key: `${world.id}:${world.definition.revision ?? 'base'}`, nativeArt: false,
        authoredWaterPlan: waterPlan, authoredBaseWorld: baseWorld,
        cameraObjects: undefined as (() => readonly T.Object3D[]) | undefined, artMargin: .1,
        width: world.bounds.max.x - world.bounds.min.x, depth: world.bounds.max.z - world.bounds.min.z };
}
export type SceneLayout = ReturnType<typeof sceneLayout>;
