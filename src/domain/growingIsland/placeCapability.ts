import { placeGoalCatalog } from './placeCatalog';
import type { Cell } from './types';

const footprint = (cells: readonly Cell[]) => {
    if (!cells.length) return '';
    const x = Math.min(...cells.map(c => c.x)), z = Math.min(...cells.map(c => c.z));
    return cells.map(c => `${c.x - x},${c.z - z}`).sort().join('|');
};

/** Finite, previously authored profiles only. Shape classification alone grants no architecture. */
export function supportedPlaceVariant(id: 'P02' | 'P05', cells: readonly Cell[]): string | undefined {
    const goal = placeGoalCatalog.find(g => g.id === id)!;
    const kind = id === 'P02' ? 'landmark:sapling' : 'landmark:flower';
    const roles = new Set(goal.inputs.filter(input => input.kind === kind).map(input => input.role));
    return goal.variants.find(variant => footprint(variant.demo.filter(item => roles.has(item.role))) === footprint(cells))?.id;
}
