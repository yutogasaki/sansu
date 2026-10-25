import { placeGoalCatalog } from './placeCatalog';
import type { Cell } from './types';
import type { GrowingState } from './types';
import type { IslandWorld } from './worldDefinition';
import { editableIslandWorld } from './editableTerrainWorld';

/** Editing the normal game's floor does not switch its earned architecture to
 * the smaller authored-study kit. Arbitrary authored worlds retain their gates. */
export function supportsNativePlaceArchitecture(state: GrowingState, world?: IslandWorld): boolean {
    if (!world) return true;
    const edited = editableIslandWorld(state);
    return Boolean(edited && edited.id === world.id && edited.revision === world.revision);
}

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

/** Extract existing modules from a larger garden; do not resize a module to its neighbours. */
export function supportedPlaceGroups<T extends { id: string; cell: Cell }>(id: 'P02' | 'P05', owners: readonly T[],
    connects: (a: Cell, b: Cell) => boolean): { variant: string; owners: T[] }[] {
    const whole = supportedPlaceVariant(id, owners.map(owner => owner.cell), true);
    if (whole) return [{ variant: whole, owners: [...owners] }];
    const at = new Map(owners.map(owner => [`${owner.cell.x},${owner.cell.z}`, owner]));
    const candidates: { variant: string; owners: T[] }[] = [], seen = new Set<string>();
    const add = (variant: string, group: T[], connected = false) => {
        const signature = group.map(owner => owner.id).sort().join('|');
        if (group.length < 4 || seen.has(signature)) return;
        if (!connected) {
            const reached = new Set([group[0].id]), queue = [group[0]];
            for (let i = 0; i < queue.length; i++) for (const owner of group)
                if (!reached.has(owner.id) && connects(queue[i].cell, owner.cell)) { reached.add(owner.id); queue.push(owner); }
            if (reached.size !== group.length) return;
        }
        seen.add(signature); candidates.push({ variant, owners: group });
    };
    const goal = placeGoalCatalog.find(goal => goal.id === id)!, role = id === 'P02' ? 'tree' : 'flower';
    for (const variant of goal.variants.filter(variant => !['lane', 'arch'].includes(variant.id))) {
        const template = variant.demo.filter(item => item.role === role), first = template[0];
        for (const origin of owners) {
            const group = template.map(item => at.get(`${origin.cell.x + item.x - first.x},${origin.cell.z + item.z - first.z}`));
            if (group.every((owner): owner is T => Boolean(owner))) add(variant.id, group);
        }
    }
    // A side branch does not invalidate the straight run that was already supported.
    for (const axis of ['x', 'z'] as const) {
        const other = axis === 'x' ? 'z' : 'x';
        const lines = new Map<number, T[]>();
        for (const owner of owners) {
            const line = lines.get(owner.cell[other]) ?? [];
            line.push(owner); lines.set(owner.cell[other], line);
        }
        for (const line of lines.values()) {
            line.sort((a, b) => a.cell[axis] - b.cell[axis]);
            let run: T[] = [];
            for (const owner of line) {
                const previous = run[run.length - 1];
                if (previous && !connects(previous.cell, owner.cell)) { add(id === 'P02' ? 'lane' : 'arch', run, true); run = []; }
                run.push(owner);
            }
            add(id === 'P02' ? 'lane' : 'arch', run, true);
        }
    }
    const rank = (variant: string) => variant === 'court' ? 0 : ['canopy', 'cluster'].includes(variant) ? 1 : 2;
    // Saved landmark IDs are allocated monotonically. Prefer the established
    // owners before a competing shape made possible by newly added supports.
    const signature = (group: T[]) => group.map(owner => owner.id).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('|');
    candidates.sort((a, b) => signature(a.owners).localeCompare(signature(b.owners), undefined, { numeric: true })
        || rank(a.variant) - rank(b.variant) || b.owners.length - a.owners.length);
    const used = new Set<string>();
    return candidates.filter(candidate => {
        if (candidate.owners.some(owner => used.has(owner.id))) return false;
        candidate.owners.forEach(owner => used.add(owner.id)); return true;
    });
}
