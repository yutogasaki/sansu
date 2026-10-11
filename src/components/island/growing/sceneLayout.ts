import * as T from 'three';
import { landBounds } from '../../../domain/growingIsland/space';
import { terrainHeightAt } from '../../../domain/growingIsland/placeTerrain';
import type { PlacePoint } from '../../../domain/growingIsland/placeTypes';
import type { Cell, GrowingState } from '../../../domain/growingIsland';

/** The same cell-to-world mapping as the current garden, so saved coordinates look the same. */
export function sceneLayout(state: Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge'>>) {
    const bounds = landBounds(state), center = (bounds.minX + bounds.maxX) / 2;
    const heightAt = (cell: Cell) => terrainHeightAt(state, state.bridge && cell.x === state.bridge.x && cell.z >= bounds.depth
        ? { x: cell.x, z: bounds.depth - 1 } : cell);
    const point = (cell: { x: number; z: number }, y = .04) => new T.Vector3(cell.x - center, heightAt(cell) + y + (state.bridge && cell.x === state.bridge.x && cell.z >= bounds.depth ? .11 : 0), cell.z - 2);
    const floorPoint = (floor: PlacePoint) => new T.Vector3(floor.x - center, floor.y, floor.z - 2);
    const cellAt = (world: T.Vector3): Cell => ({ x: Math.round(world.x + center), z: Math.round(world.z + 2) });
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
    const key = `${bounds.minX},${bounds.maxX},${bounds.depth}`;
    let maxHeight = 0;
    for (let z = 0; z < bounds.depth; z++) maxHeight = Math.max(maxHeight, heightAt({ x: bounds.minX, z }), heightAt({ x: bounds.maxX, z }));
    return { bounds, center, point, floorPoint, heightAt, maxHeight, cellAt, pierRoot, pierEnd, dock, far, farther, key, nativeArt: false,
        // The world supplies the actual static models after rebuilding. Camera fit
        // uses their vertices rather than placing a tall imaginary tree on every shore.
        cameraObjects: undefined as (() => readonly T.Object3D[]) | undefined,
        artMargin: bounds.maxX - bounds.minX > 5 || bounds.depth > 5 ? 2.7 : 1.1,
        width: bounds.maxX - bounds.minX + 1, depth: bounds.depth };
}
export type SceneLayout = ReturnType<typeof sceneLayout>;
