import * as T from 'three';
import { landBounds } from '../../../domain/growingIsland/space';
import { terrainHeightAt } from '../../../domain/growingIsland/placeTerrain';
import type { PlacePoint } from '../../../domain/growingIsland/placeTypes';
import type { Cell, GrowingState } from '../../../domain/growingIsland';
import { landscapeCell, landscapePoint, landscapeRise } from '../../../domain/growingIsland/landscape';

/** The same cell-to-world mapping as the current garden, so saved coordinates look the same. */
export function sceneLayout(state: Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge'>>, curved = false) {
    const bounds = landBounds(state), center = (bounds.minX + bounds.maxX) / 2;
    const shoreCell = (cell: Cell) => state.bridge && cell.x === state.bridge.x && cell.z >= bounds.depth ? { x: cell.x, z: bounds.depth - 1 } : cell;
    const heightAt = (cell: Cell) => terrainHeightAt(state, shoreCell(cell)) + (curved ? landscapeRise(shoreCell(cell)) : 0);
    const projected = (cell: Cell) => curved ? landscapePoint(cell) : cell;
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
    const logicalAt = (world: { x: number; z: number }): Cell => {
        const p = { x: world.x + center, z: world.z + 2 };
        return curved ? landscapeCell(p) : p;
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
    return { bounds, center, point, floorPoint, heightAt, maxHeight, cellAt, logicalAt, projected, curved, pierRoot, pierEnd, dock, far, farther, key, nativeArt: false,
        // The world supplies the actual static models after rebuilding. Camera fit
        // uses their vertices rather than placing a tall imaginary tree on every shore.
        cameraObjects: undefined as (() => readonly T.Object3D[]) | undefined,
        artMargin: bounds.maxX - bounds.minX > 5 || bounds.depth > 5 ? 2.7 : 1.1,
        width: bounds.maxX - bounds.minX + 1, depth: bounds.depth };
}
export type SceneLayout = ReturnType<typeof sceneLayout>;
