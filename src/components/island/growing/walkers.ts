import type { Cell } from '../../../domain/growingIsland';

const NEIGHBORS = [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }];
const k = (c: Cell) => `${c.x},${c.z}`;

/** Breadth-first walk over open cells; presentation only, never saved. */
export function walkRoute(walkable: Set<string>, from: Cell, to: Cell): Cell[] | undefined {
    const start = { x: Math.round(from.x), z: Math.round(from.z) };
    if (!walkable.has(k(start)) || !walkable.has(k(to))) return undefined;
    const previous = new Map<string, Cell | undefined>([[k(start), undefined]]), queue = [start];
    while (queue.length) {
        const cell = queue.shift()!;
        if (cell.x === to.x && cell.z === to.z) {
            const path: Cell[] = []; let at: Cell | undefined = cell;
            while (at) { path.unshift(at); at = previous.get(k(at)); }
            return path;
        }
        for (const d of NEIGHBORS) {
            const next = { x: cell.x + d.x, z: cell.z + d.z };
            if (walkable.has(k(next)) && !previous.has(k(next))) { previous.set(k(next), cell); queue.push(next); }
        }
    }
}

export function nearestOpen(walkable: Set<string>, point: { x: number; z: number }): Cell | undefined {
    let best: Cell | undefined, bestDistance = Infinity;
    for (const text of walkable) {
        const [x, z] = text.split(',').map(Number), d = (x - point.x) ** 2 + (z - point.z) ** 2;
        if (d < bestDistance) { best = { x, z }; bestDistance = d; }
    }
    return best;
}

/** An open cell next to a target, so walkers stop beside furniture instead of inside it. */
export function besideOpen(walkable: Set<string>, target: Cell): Cell | undefined {
    if (walkable.has(k(target))) return target;
    return NEIGHBORS.map(d => ({ x: target.x + d.x, z: target.z + d.z })).find(c => walkable.has(k(c)));
}
