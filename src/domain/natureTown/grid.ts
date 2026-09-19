import type { Cell, CellPos, Prop, WorldState } from './types';
import balance from './balance.json';
export const key = (p: CellPos) => `${p[0]},${p[1]}`;
export const equal = (a: CellPos, b: CellPos) => key(a) === key(b);
export const distance = (a: CellPos, b: CellPos) => Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1]);
export const neighbors = ([x,y]: CellPos): CellPos[] => [[x-1,y],[x,y-1],[x,y+1],[x+1,y]];
export const activeProps = (w: WorldState) => w.props.filter(p => !p.stored).sort((a,b) => a.id.localeCompare(b.id));
export const cells = (w: WorldState) => w.chunks.filter(c => c.opened).flatMap(c => c.cells);
export const at = (w: WorldState, p: CellPos) => w.chunks.find(c => c.opened && c.coordinate[0] === Math.floor(p[0]/balance.scope.chunkSide) && c.coordinate[1] === Math.floor(p[1]/balance.scope.chunkSide))?.cells.find(c => equal(c.position,p));
export function entrance(p: Prop): CellPos { return 'entrance' in p ? p.entrance : p.position; }
export function validBridges(w: WorldState): Set<string> {
    const map = new Map(cells(w).map(c => [key(c.position),c])), valid = new Set<string>();
    for (const c of map.values()) if (c.bridge && c.terrain === 'water') {
        for (const axis of [0,1]) {
            const banks = [-1,1].every(sign => {
                const p = [...c.position] as [number,number];
                for (let i = 0; i < map.size; i++) {
                    p[axis] += sign; const next = map.get(key(p));
                    if (!next) return false;
                    if (next.terrain === 'ground') return !activeProps(w).some(prop => prop.kind !== 'flowers' && equal(prop.position,p));
                    if (!next.bridge) return false;
                }
                return false;
            });
            if (banks) valid.add(key(c.position));
        }
    }
    return valid;
}
export function graph(w: WorldState, roadsOnly = false) {
    const bridges = validBridges(w), blocked = new Set(activeProps(w).filter(p => p.kind !== 'flowers').map(p => key(p.position)));
    return new Map(cells(w).filter(c => !blocked.has(key(c.position)) && (c.terrain === 'ground' || bridges.has(key(c.position))) && (!roadsOnly || c.path || bridges.has(key(c.position)))).map(c => [key(c.position),c]));
}
export function cellCost(c: Cell) {
    const t=balance.transport;
    return (c.path || c.bridge ? t.roadSecondsPerCell : t.groundSecondsPerCell)*(1+t.trafficCostWeight*Math.min(1,c.traffic/t.trafficReference));
}
export interface Route { path: CellPos[]; cost: number }
export function routeOn(g: Map<string,Cell>, start: CellPos, end: CellPos): Route | undefined {
    if (!g.has(key(start)) || !g.has(key(end))) return;
    const costs = new Map([[key(start),0]]), previous = new Map<string,string>(), pending = new Set([key(start)]);
    while (pending.size) {
        let current = ''; let best = Infinity;
        for (const k of pending) if (costs.get(k)! < best) { current=k; best=costs.get(k)!; }
        pending.delete(current);
        if (current === key(end)) {
            const path: CellPos[] = []; let k=current;
            while (k !== key(start)) { path.unshift(g.get(k)!.position); k=previous.get(k)!; }
            return {path,cost:best};
        }
        for (const p of neighbors(g.get(current)!.position)) {
            const k=key(p), c=g.get(k); if (!c) continue;
            const cost=best+cellCost(c);
            if (cost < (costs.get(k) ?? Infinity)) { costs.set(k,cost); previous.set(k,current); pending.add(k); }
        }
    }
}
export const route = (w: WorldState, a: CellPos, b: CellPos, roadsOnly=false) => routeOn(graph(w,roadsOnly),a,b);

/** Reuse searches only while graph membership and cell costs are unchanged.
 * Equal costs retain first discovery order, matching routeOn's pending Set.
 * Each result owns its path array: residents consume paths with shift().
 */
export function routesFrom(g: Map<string, Cell>, start: CellPos) {
    interface Entry { key: string; cost: number; order: number }
    const heap: Entry[] = [], costs = new Map<string, number>(), previous = new Map<string, string>();
    const orders = new Map<string, number>(), settled = new Set<string>(), startKey = key(start);
    const before = (a: Entry, b: Entry) => a.cost < b.cost || a.cost === b.cost && a.order < b.order;
    const push = (entry: Entry) => {
        let i = heap.length; heap.push(entry);
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (!before(entry, heap[parent])) break;
            heap[i] = heap[parent]; i = parent;
        }
        heap[i] = entry;
    };
    const pop = () => {
        const first = heap[0], last = heap.pop()!;
        if (heap.length) {
            let i = 0;
            while (i * 2 + 1 < heap.length) {
                let child = i * 2 + 1;
                if (child + 1 < heap.length && before(heap[child + 1], heap[child])) child++;
                if (!before(heap[child], last)) break;
                heap[i] = heap[child]; i = child;
            }
            heap[i] = last;
        }
        return first;
    };
    if (g.has(startKey)) { costs.set(startKey, 0); orders.set(startKey, 0); push({ key: startKey, cost: 0, order: 0 }); }
    return (end: CellPos): Route | undefined => {
        const endKey = key(end);
        if (!g.has(endKey)) return;
        while (!settled.has(endKey) && heap.length) {
            const current = pop();
            if (settled.has(current.key) || current.cost !== costs.get(current.key)) continue;
            settled.add(current.key);
            // Expand even the requested endpoint so a later query can resume here.
            for (const position of neighbors(g.get(current.key)!.position)) {
                const next = key(position), cell = g.get(next);
                if (!cell || settled.has(next)) continue;
                const cost = current.cost + cellCost(cell);
                if (cost < (costs.get(next) ?? Infinity)) {
                    if (!orders.has(next)) orders.set(next, orders.size);
                    costs.set(next, cost); previous.set(next, current.key);
                    push({ key: next, cost, order: orders.get(next)! });
                }
            }
        }
        if (!settled.has(endKey)) return;
        const path: CellPos[] = []; let current = endKey;
        while (current !== startKey) { path.push(g.get(current)!.position); current = previous.get(current)!; }
        return { path: path.reverse(), cost: costs.get(endKey)! };
    };
}
