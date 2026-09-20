import type { LifeCommand, LifeRecord } from './model';

/** The latest spatial edit is the boundary, including edits from another tab.
 * Learning, clock refreshes and viewing do not change this editing history. */
export function placementUndo(record: LifeRecord, actionId: string): LifeCommand | undefined {
    const spatial = record.actions.filter(a => ['buy', 'move', 'store', 'remove', 'expand', 'rotate'].includes(a.command.type));
    const last = spatial[spatial.length - 1];
    if (!last || last.id !== actionId || last.undoOf) return undefined;
    const command = last.command;
    if (command.type === 'rotate') {
        const previous = spatial.slice(0, -1).reverse().find(a => a.command.type === 'rotate' && a.command.itemId === command.itemId);
        return { type: 'rotate', itemId: command.itemId, rotation: previous?.command.type === 'rotate' ? previous.command.rotation : 0 };
    }
    if (command.type === 'buy') return { type: 'store', itemId: last.id };
    if (command.type !== 'move' && command.type !== 'store') return undefined;
    // Positions come from immutable edit events; never restore a whole old world.
    const previous = spatial.slice(0, -1).filter(a => a.command.type !== 'rotate').reverse().find(a => a.command.type === 'buy'
        ? a.id === command.itemId : 'itemId' in a.command && a.command.itemId === command.itemId);
    if (!previous) return undefined;
    const before = previous.command;
    if (before.type === 'buy' || before.type === 'move') {
        if (command.type === 'move' && before.cell.x === command.cell.x && before.cell.z === command.cell.z) return undefined;
        return { type: 'move', itemId: command.itemId, cell: { ...before.cell } };
    }
    return before.type === 'store' && command.type === 'move' ? { type: 'store', itemId: command.itemId } : undefined;
}
