import { growthStage, type Cell, type District, type LifeItem, type LifeState } from './model';
export const homeCell: Cell = { x: 2, z: 1 };
export const cellKey = (p: Cell) => `${p.x},${p.z}`;
export const sameCell = (a: Cell, b: Cell) => a.x === b.x && a.z === b.z;
export function landCells(s: Pick<LifeState, 'expanded'>): Cell[] {
    const out: Cell[] = [];
    for (let z = 0; z < 5; z++) for (let x = s.expanded === 'west' ? -3 : 0; x < (s.expanded === 'east' ? 9 : 6); x++) out.push({ x, z });
    return out;
}
export function isHouse(p: Cell) { return p.z === 0 && (p.x === 2 || p.x === 3) || sameCell(p, homeCell); }
export function vacant(s: LifeState, p: Cell, except?: string) {
    return Number.isInteger(p.x) && Number.isInteger(p.z) && !isHouse(p)
        && landCells(s).some(c => sameCell(c, p)) && !s.items.some(i => i.id !== except && i.cell && sameCell(i.cell, p));
}
export function route(s: LifeState, from: Cell, to: Cell): Cell[] | undefined {
    const land = new Set(landCells(s).map(cellKey));
    const blocked = new Set(s.items.filter(i => i.cell).map(i => cellKey(i.cell!)));
    blocked.add('2,0'); blocked.add('3,0');
    const queue: Cell[][] = [[from]], seen = new Set([cellKey(from)]);
    while (queue.length) {
        const path = queue.shift()!, last = path[path.length - 1];
        if (sameCell(last, to)) return path;
        for (const d of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
            const n = { x: last.x + d.x, z: last.z + d.z }, key = cellKey(n);
            if (land.has(key) && !blocked.has(key) && !seen.has(key)) { seen.add(key); queue.push([...path, n]); }
        }
    }
}
export function pathToActivity(s: LifeState, from: Cell, item: LifeItem, reserved: Cell[] = []) {
    if (!item.cell) return undefined;
    const approaches = item.access === 'front' ? [{ x: 0, z: 1 }]
        : [{ x: 0, z: 1 }, { x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: -1 }];
    return approaches
        .map(d => route(s, from, { x: item.cell!.x + d.x, z: item.cell!.z + d.z }))
        .filter((p): p is Cell[] => Boolean(p) && !reserved.some(c => sameCell(c, p![p!.length - 1]))).sort((a, b) => a.length - b.length)[0];
}
export function usablePlacement(s: LifeState, itemId: string, p: Cell) {
    if (!vacant(s, p, itemId)) return false;
    const trial = { ...s, items: s.items.map(i => i.id === itemId ? { ...i, cell: p,
        access: s.activityVersion === 2 && ['bench', 'swing'].includes(i.kind) ? 'front' as const : i.access } : i) };
    return trial.items.every(i => !i.cell || Boolean(pathToActivity(trial, homeCell, i)));
}
export function districts(s: LifeState): District[] {
    const found: District[] = [];
    for (const kind of ['flower', 'swing'] as const) {
        const items = s.items.filter(i => i.cell && i.kind === kind && growthStage(i) === 2);
        const remaining = new Set(items.map(i => i.id));
        while (remaining.size) {
            const group = [items.find(i => i.id === remaining.values().next().value)!]; remaining.delete(group[0].id);
            for (let j = 0; j < group.length; j++) for (const item of items) {
                if (remaining.has(item.id) && Math.abs(item.cell!.x - group[j].cell!.x) + Math.abs(item.cell!.z - group[j].cell!.z) === 1) {
                    remaining.delete(item.id); group.push(item);
                }
            }
            if (group.length < (kind === 'flower' ? 3 : 2)) continue;
            const cells = group.map(i => i.cell!), xs = cells.map(c => c.x), zs = cells.map(c => c.z);
            const wide = Math.max(...xs) - Math.min(...xs) >= 2 && Math.max(...zs) - Math.min(...zs) >= 1;
            found.push({ id: group.map(i => i.id).sort().join('|'), ids: group.map(i => i.id), cells,
                kind: kind === 'flower' ? 'flowers' : 'play',
                label: kind === 'flower' ? group.length >= 6 && wide ? 'おはなばたけ' : 'かだん' : group.length >= 3 ? 'ゆうえんち' : 'あそびば' });
        }
    }
    return found;
}
