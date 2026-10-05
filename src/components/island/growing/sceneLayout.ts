import * as T from 'three';
import { landBounds } from '../../../domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../domain/growingIsland';

/** The same cell-to-world mapping as the current garden, so saved coordinates look the same. */
export function sceneLayout(state: Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge'>>) {
    const bounds = landBounds(state), center = (bounds.minX + bounds.maxX) / 2;
    const point = (cell: { x: number; z: number }, y = .04) => new T.Vector3(cell.x - center, y + (state.bridge && cell.x === state.bridge.x && cell.z >= bounds.depth ? .11 : 0), cell.z - 2);
    const cellAt = (world: T.Vector3): Cell => ({ x: Math.round(world.x + center), z: Math.round(world.z + 2) });
    // The pier leaves the south shore near the east side; boats come in from the south-east.
    const pierCell = { x: bounds.maxX - 1, z: bounds.depth - 1 };
    const pierRoot = point(pierCell).add(new T.Vector3(0, -.02, .62));
    const pierEnd = pierRoot.clone().add(new T.Vector3(0, .07, 1.2));
    const dock = pierRoot.clone().add(new T.Vector3(.62, -.18, 1.3));
    const far = dock.clone().add(new T.Vector3(3.4, 0, 3.2));
    const farther = dock.clone().add(new T.Vector3(5.6, 0, 5.2));
    const key = `${bounds.minX},${bounds.maxX},${bounds.depth}`;
    return { bounds, center, point, cellAt, pierRoot, pierEnd, dock, far, farther, key,
        width: bounds.maxX - bounds.minX + 1, depth: bounds.depth };
}
export type SceneLayout = ReturnType<typeof sceneLayout>;
