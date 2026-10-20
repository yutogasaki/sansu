import { placeGoalCatalog } from './placeCatalog';
import type { Cell } from './types';

const footprint = (cells: readonly Cell[]) => {
    if (!cells.length) return '';
    const x = Math.min(...cells.map(c => c.x)), z = Math.min(...cells.map(c => c.z));
    return cells.map(c => `${c.x - x},${c.z - z}`).sort().join('|');
};

/** Finite, previously authored profiles only. Shape classification alone grants no architecture. */
export function supportedPlaceVariant(id: 'P02' | 'P05', cells: readonly Cell[], repeated = false): string | undefined {
    const goal = placeGoalCatalog.find(g => g.id === id)!;
    const kind = id === 'P02' ? 'landmark:sapling' : 'landmark:flower';
    const roles = new Set(goal.inputs.filter(input => input.kind === kind).map(input => input.role));
    const fixed = goal.variants.find(variant => footprint(variant.demo.filter(item => roles.has(item.role))) === footprint(cells))?.id;
    if (fixed || !repeated || cells.length < 4) return fixed;
    const axis = cells.every(cell => cell.x === cells[0].x) ? 'z' : cells.every(cell => cell.z === cells[0].z) ? 'x' : undefined;
    if (!axis) return;
    const ordered = cells.map(cell => cell[axis]).sort((a, b) => a - b);
    if (ordered.some((value, i) => i > 0 && (value - ordered[i - 1] < 1 || value - ordered[i - 1] > 2))) return;
    return id === 'P02' ? 'lane' : 'arch';
}
