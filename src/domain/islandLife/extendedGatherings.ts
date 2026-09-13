import { growthStage, type LifeState } from './model';
import { itemComponents } from './itemComponents';

/** A presentation version keeps pre-grove memories on their original ground.
 * These groups never feed the historical simulation's visit weights or rewards. */
export function extendedGatherings(state: LifeState) {
    if (state.landscapeVersion !== 'groves-water-v1') return [];
    return (['sapling', 'water-bowl'] as const).flatMap(kind => {
        const minimum = kind === 'sapling' ? 3 : 2;
        return itemComponents(state.items.filter(item => item.kind === kind && item.cell && growthStage(item) === 2))
            .filter(items => items.length >= minimum).map(items => {
                const cells = items.map(item => item.cell!), xs = cells.map(cell => cell.x), zs = cells.map(cell => cell.z);
                return { kind: kind === 'sapling' ? 'trees' as const : 'water' as const, items, cells,
                    wide: items.length >= 6 && Math.max(...xs) - Math.min(...xs) >= 2 && Math.max(...zs) - Math.min(...zs) >= 1 };
            });
    });
}
