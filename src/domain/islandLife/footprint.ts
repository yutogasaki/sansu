import type { Cell, ItemKind, LifeItem } from './model';
export function isFacility(kind: ItemKind): kind is 'garden-hut' | 'library' { return kind === 'garden-hut' || kind === 'library'; }
/** Saved cells remain integer north-west anchors; old one-cell items keep their exact coordinates. */
export function occupiedCells(item: Pick<LifeItem, 'kind' | 'cell'>): Cell[] {
    if (!item.cell) return [];
    return (isFacility(item.kind) ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]])
        .map(([x, z]) => ({ x: item.cell!.x + x, z: item.cell!.z + z }));
}
export function occupiesCell(item: Pick<LifeItem, 'kind' | 'cell'>, cell: Cell) {
    return occupiedCells(item).some(p => p.x === cell.x && p.z === cell.z);
}
