import type { Cell, GrowingState } from '../../../domain/growingIsland';
import type { SceneLayout } from './sceneLayout';

/** A whole grass/flower/rock cluster has one footprint, checked before batching.
 * Eight edge probes retain its supported roots while leaving a carved shore open. */
export function editableGroundDetailSupported(layout: SceneLayout, cell: Cell, radius: number, state?: GrowingState): boolean {
    if (!layout.world.floorAt(cell)) return false;
    if (state && decorationOwnerCells(state).some(owner => Math.abs(cell.x - owner.x) < .46 + radius && Math.abs(cell.z - owner.z) < .46 + radius)) return false;
    for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        if (!layout.world.floorAt({ x: cell.x + Math.cos(angle) * radius, z: cell.z + Math.sin(angle) * radius })) return false;
    }
    return true;
}


/** Only occupied coordinates affect this scenery mask. Names, receipts and stored
 * owners do not rebuild ground; move/store/unstore and multi-cell facilities do. */
function decorationOwnerCells(state: GrowingState): Cell[] {
    return [...state.plots, ...state.landmarks, ...state.keepsakes].flatMap(owner => {
        if (!owner.cell) return [];
        const cells = [owner.cell];
        if ('kind' in owner && (owner.kind === 'garden-hut' || owner.kind === 'library'))
            cells.push({ x: owner.cell.x + 1, z: owner.cell.z }, { x: owner.cell.x, z: owner.cell.z + 1 }, { x: owner.cell.x + 1, z: owner.cell.z + 1 });
        return cells;
    });
}
export function editableGroundDecorationKey(state: GrowingState): string {
    return [...new Set(decorationOwnerCells(state).map(cell => `${cell.x},${cell.z}`))].sort().join(';');
}
