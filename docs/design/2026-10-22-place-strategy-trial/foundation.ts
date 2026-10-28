import { HOUSE_CELLS, landBounds } from '../../../src/domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';

/** Experimental physical interpolation, not a visual skin. Keep each fixed
 * support plus one triangulation cell intact, then join to the user's height. */
export function foundationEditWeight(state: Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge'>>, point: Cell) {
    const bounds = landBounds(state);
    // Same anchor formula as space.bridgeAnchor, accepting the floor's narrow
    // state contract rather than asserting that it contains a full game save.
    const pins = [...HOUSE_CELLS, { x: bounds.maxX - 1, z: bounds.depth - 1 }, ...(state.bridge ? [{ x: state.bridge.x ?? 2, z: bounds.depth - 1 }] : [])];
    const distance = Math.min(...pins.map(pin => Math.max(Math.abs(point.x - pin.x), Math.abs(point.z - pin.z))));
    const t = Math.max(0, Math.min(1, (distance - .66) / .34));
    return t * t * (3 - 2 * t);
}
