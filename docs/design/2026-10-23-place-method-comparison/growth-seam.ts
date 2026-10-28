import { occupiedCells } from '../../../src/domain/islandLife/footprint';
import type { ItemKind } from '../../../src/domain/islandLife/model';
import { landBounds } from '../../../src/domain/growingIsland/space';
import { terrainOwnerSupported } from '../../../src/domain/growingIsland/terrainEditing';
import { OWN_LANDMARKS, type Cell, type GrowingState } from '../../../src/domain/growingIsland/types';

export const GROWTH_SEAM_REVISION = 'new-adjacent-row-inheritance-v1';
const key = (cell: Cell) => `${cell.x},${cell.z}`;
/** Acquisition initializes only the newly owned row directly touching old land.
 * It never reinterprets old inputs, writes an unowned future cell, or runs as a
 * live geometry rule. Inherited values remain ordinary saved integer offsets. */
export function inheritGrowthBoundary(previous: GrowingState, next: GrowingState): Cell[] {
    if (!previous.terrain || !next.terrain) return [];
    const before = landBounds(previous), after = landBounds(next), inherited: Cell[] = [];
    for (let z = 0; z < after.depth; z++) for (let x = after.minX; x <= after.maxX; x++) {
        const cell = { x, z }, source = { x: Math.max(before.minX, Math.min(before.maxX, x)), z: Math.min(before.depth - 1, z) };
        if (Math.abs(cell.x - source.x) + Math.abs(cell.z - source.z) !== 1) continue;
        const id = key(cell);
        if (Object.hasOwn(previous.terrain.heights, id) || Object.hasOwn(next.terrain.heights, id)) continue;
        const value = previous.terrain.heights[key(source)] ?? 0;
        if (!Number.isInteger(value) || value < -4 || value > 12) throw Error('土地の 高さを たしかめてね。');
        if (value !== 0) { next.terrain.heights[id] = value; inherited.push(cell); }
    }
    return inherited;
}
/** Match the current terrain-edit owner footprint contract. This check runs on
 * applyIntent's private clone immediately before success, so rejection cannot
 * charge currency, append a receipt, or partly expand the previous state.
 * Pre-existing unsupported input is reported separately, never called repaired. */
export function validateGrowthOwnerSupport(previous: GrowingState, next: GrowingState): void {
    const state = previous;
    const cells = [...state.plots.flatMap(owner => owner.cell ? [owner.cell] : []),
        ...state.landmarks.flatMap(owner => !owner.cell ? [] : OWN_LANDMARKS.includes(owner.kind) ? [owner.cell]
            : occupiedCells({ kind: owner.kind as ItemKind, cell: owner.cell })),
        ...state.keepsakes.flatMap(owner => owner.cell ? [owner.cell] : [])];
    if (cells.some(cell => terrainOwnerSupported(previous, cell) && !terrainOwnerSupported(next, cell)))
        throw Error('ものの 足もとを たしかめよう。ひろげる前の 島は そのままだよ。');
}
