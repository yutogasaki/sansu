import { routeDuration } from './walkingSpace';
import { type Cell, type LifeItem, type LifeState } from './model';
import { cellKey, homeCell, route, vacant, walkable } from './space';

export const FOOTSTEP_MAGIC_MS = 6000, FOOTSTEP_LIFE_MS = 2000;

export function footstepWalker(state: LifeState, targetId: string) {
    const hero = state.residents.find(r => r.id === 'pokomoko'), visit = hero?.visit;
    return state.footstepMagicVersion && visit?.itemId === targetId && state.target === targetId
        && state.now >= visit.start && state.now < visit.start + routeDuration(visit.path) ? hero : undefined;
}

/** The light and the footprints use this same reachable ground, including walls,
 * occupied cells and the lantern's actual usable access points. */
export function lanternGround(state: LifeState, lamp: LifeItem): Cell[] {
    if (lamp.kind !== 'lantern' || !lamp.cell || !state.items.some(i => i.id === lamp.id && i.cell)) return [];
    const directions = lamp.access === 'front' ? [[0, 1]] : [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const queue = directions.map(([x, z]) => ({ x: lamp.cell!.x + x, z: lamp.cell!.z + z }))
        .filter(p => vacant(state, p) && route(state, homeCell, p)).map(p => ({ p, distance: 0 }));
    const cells = new Map<string, Cell>();
    for (let i = 0; i < queue.length; i++) {
        const { p, distance } = queue[i];
        if (cells.has(cellKey(p))) continue;
        cells.set(cellKey(p), p);
        if (distance === 2) continue;
        for (const [x, z] of [[0, 1], [1, 0], [0, -1], [-1, 0]]) {
            const next = { x: p.x + x, z: p.z + z };
            if (walkable(state, next)) queue.push({ p: next, distance: distance + 1 });
        }
    }
    return [...cells.values()].sort((a, b) => a.z - b.z || a.x - b.x);
}

/** Continuous ground tiles have a shared half-open boundary. The renderer uses
 * the same cell corners, so there is no circular glow beyond reachable ground. */
export function inLanternGround(cells: Cell[], point: readonly number[]) {
    return point.length === 2 && point.every(Number.isFinite)
        && cells.some(c => point[0] >= c.x - .5 && point[0] < c.x + .5 && point[1] >= c.z - .5 && point[1] < c.z + .5);
}
