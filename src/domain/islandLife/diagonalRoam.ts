import type { Cell, LifeState } from './model';
import { walkingClearance, fineRoute } from './walkingSpace';

// Cache copied results by geometry and all dynamic reservations, never by mutable state identity.
const routes = new Map<string, Cell[] | undefined>();

/** Smooth only newly scheduled strolls. Activity routes keep their original metric. */
export function diagonalRoamRoute(state: LifeState, from: Cell, to: Cell, avoid: Cell[]) {
    const key = JSON.stringify([state.expanded, state.extraLand, state.items.map(item => [item.kind, item.cell]), from, to, avoid]);
    if (!routes.has(key)) {
        routes.set(key, findDiagonalRoamRoute(state, from, to, avoid));
        if (routes.size > 1024) routes.delete(routes.keys().next().value!);
    }
    return routes.get(key)?.map(point => ({ ...point }));
}
function findDiagonalRoamRoute(state: LifeState, from: Cell, to: Cell, avoid: Cell[]) {
    const path = fineRoute(state, from, to);
    if (!path) return;
    const allows = walkingClearance(state);
    const clear = (a: Cell, b: Cell) => {
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .025));
        for (let index = 1; index <= steps; index++) {
            const t = index / steps, p = { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
            if (!allows(p) || Math.hypot(p.x - 2, p.z - 1) < .2 && Math.hypot(a.x - 2, a.z - 1) >= .2
                || avoid.some(other => Math.hypot(other.x - p.x, other.z - p.z) < .2)) return false;
        }
        return true;
    };
    const result: Cell[] = [path[0]];
    for (let index = 0; index < path.length - 1;) {
        let next = path.length - 1;
        while (next > index && !clear(path[index], path[next])) next--;
        if (next === index) return;
        result.push(path[next]); index = next;
    }
    return result;
}
