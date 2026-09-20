import { isFacility } from './footprint';
import { landBounds } from './landRules';
import { LIFE_STEP_MS, type Cell, type LifeState } from './model';

/** Distances are island cells, independently of navigation mesh resolution. */
export function routeLength(path: Cell[]) {
    return path.slice(1).reduce((length, point, index) => length + Math.hypot(point.x - path[index].x, point.z - path[index].z), 0);
}
export const routeDuration = (path: Cell[]) => routeLength(path) * LIFE_STEP_MS;
export function remainingRoute(path: Cell[], elapsed: number): Cell[] {
    let remaining = Math.max(0, elapsed / LIFE_STEP_MS);
    for (let index = 0; index < path.length - 1; index++) {
        const a = path[index], b = path[index + 1], length = Math.hypot(b.x - a.x, b.z - a.z);
        if (remaining < length) return [sampleRoute(path, elapsed), ...path.slice(index + 1)];
        remaining -= length;
    }
    return path.slice(-1);
}
export function sampleRoute(path: Cell[], elapsed: number) {
    let remaining = Math.max(0, elapsed / LIFE_STEP_MS);
    for (let index = 0; index < path.length - 1; index++) {
        const a = path[index], b = path[index + 1], length = Math.hypot(b.x - a.x, b.z - a.z);
        if (remaining < length) return { x: a.x + (b.x - a.x) * remaining / length, z: a.z + (b.z - a.z) * remaining / length };
        remaining -= length;
    }
    return { ...path[path.length - 1] };
}
/** Footprint clearance includes a small resident radius; foliage may overhang a walking gap. */
function geometryAllows(state: LifeState, p: Cell) {
    const { minX, maxX, depth } = landBounds(state);
    if (p.x < minX - .25 || p.x > maxX + .25 || p.z < -.25 || p.z > depth - .75) return false;
    const inside = (x: number, z: number, w: number, d: number) => Math.abs(p.x - x) < w - 1e-8 && Math.abs(p.z - z) < d - 1e-8;
    if (inside(2.5, 0, 1.06, .56)) return false;
    return !state.items.some(item => {
        if (!item.cell) return false;
        // The diagonal posts in windArchGeometry leave both cardinal crossing axes open.
        if (item.kind === 'flower-arch') return [-.43, .43].some(offset => inside(item.cell!.x + offset, item.cell!.z + offset, .1, .1));
        if (isFacility(item.kind)) return inside(item.cell.x + .5, item.cell.z + .5, 1.06, 1.06);
        const radius = item.kind === 'flower' ? .43 : item.kind === 'lantern' ? .24 : item.kind === 'sapling' ? .2 : .56;
        return inside(item.cell.x, item.cell.z, radius, radius);
    });
}
// Geometry is immutable for the lifetime of each cache entry, even though replay mutates state.
const meshes = new Map<string, { stand: (p: Cell) => boolean; geometry: (p: Cell) => boolean; edges: Map<string, boolean>; paths: Map<string, Cell[] | undefined> }>();
// Replay repeatedly asks for routes while only clocks and resident positions change.
// Compare a small copied layout first; identity alone is unsafe for mutable replay states.
let lastLayout: {
    expanded: LifeState['expanded']; extraLand: NonNullable<LifeState['extraLand']>;
    items: { kind: LifeState['items'][number]['kind']; x: number | undefined; z: number | undefined }[];
    mesh: NonNullable<ReturnType<typeof meshes.get>>;
} | undefined;
function meshFor(state: LifeState) {
    const last = lastLayout, extra = state.extraLand ?? [];
    if (last && last.expanded === state.expanded && last.extraLand.length === extra.length
        && last.extraLand.every((side, i) => side === extra[i]) && last.items.length === state.items.length
        && last.items.every((item, i) => item.kind === state.items[i].kind
            && item.x === state.items[i].cell?.x && item.z === state.items[i].cell?.z)) return last.mesh;
    const signature = JSON.stringify([state.expanded, state.extraLand, state.items.filter(i => i.cell).map(i => [i.kind, i.cell])]);
    let mesh = meshes.get(signature);
    if (!mesh) {
        const geometry = { ...state, extraLand: state.extraLand && [...state.extraLand], items: state.items.map(i => ({ ...i, cell: i.cell && { ...i.cell } })) };
        const points = new Map<string, boolean>();
        mesh = { geometry: p => geometryAllows(geometry, p), edges: new Map(), paths: new Map(), stand: p => {
            const key = `${p.x},${p.z}`;
            if (!points.has(key)) points.set(key, geometryAllows(geometry, p));
            return points.get(key)!;
        } };
        meshes.set(signature, mesh);
        if (meshes.size > 8) meshes.delete(meshes.keys().next().value!);
    }
    lastLayout = { expanded: state.expanded, extraLand: [...extra],
        items: state.items.map(i => ({ kind: i.kind, x: i.cell?.x, z: i.cell?.z })), mesh };
    return mesh;
}
/** Direct clearance against one immutable layout, for dense segment checks. */
export const walkingClearance = (state: LifeState) => meshFor(state).geometry;
export const canStand = (state: LifeState, point: Cell) => meshFor(state).stand(point);
export function fineRoute(state: LifeState, from: Cell, to: Cell, avoid: Cell[] = []): Cell[] | undefined {
    const mesh = meshFor(state), signature = `${from.x},${from.z}>${to.x},${to.z}|${avoid.map(p => `${p.x},${p.z}`).join(';')}`;
    if (!mesh.paths.has(signature)) {
        mesh.paths.set(signature, findFineRoute(state, from, to, avoid));
        if (mesh.paths.size > 512) mesh.paths.delete(mesh.paths.keys().next().value!);
    }
    return mesh.paths.get(signature)?.map(p => ({ ...p }));
}
function findFineRoute(state: LifeState, from: Cell, to: Cell, avoid: Cell[]): Cell[] | undefined {
    const mesh = meshFor(state);
    const allowed = (p: Cell) => mesh.stand(p) && !avoid.some(a => Math.hypot(a.x - p.x, a.z - p.z) < .2);
    if (!allowed(from) || !allowed(to)) return;
    const key = (p: Cell) => `${p.x},${p.z}`;
    const clear = (a: Cell, b: Cell) => {
        const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .04));
        const edgeKey = `${key(a)}>${key(b)}`;
        const points = () => Array.from({ length: steps }, (_, i) => (i + 1) / steps).map(t => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }));
        if (!mesh.edges.has(edgeKey)) mesh.edges.set(edgeKey, points().every(mesh.stand));
        return mesh.edges.get(edgeKey)! && (!avoid.length || points().every(allowed));
    };
    const queue: Cell[] = [from], previous = new Map<string, Cell | undefined>([[key(from), undefined]]);
    for (let index = 0; index < queue.length; index++) {
        const current = queue[index];
        if (Math.hypot(current.x - to.x, current.z - to.z) <= .251 && clear(current, to)) {
            const path = key(current) === key(to) ? [] : [to];
            for (let p: Cell | undefined = current; p; p = previous.get(key(p))) path.push(p);
            return path.reverse();
        }
        const neighbors = index === 0 && (from.x * 4 % 1 || from.z * 4 % 1)
            ? [Math.floor(from.x * 4) / 4, Math.ceil(from.x * 4) / 4].flatMap(x => [Math.floor(from.z * 4) / 4, Math.ceil(from.z * 4) / 4].map(z => ({ x, z })))
            : [{ x: current.x + .25, z: current.z }, { x: current.x - .25, z: current.z }, { x: current.x, z: current.z + .25 }, { x: current.x, z: current.z - .25 }];
        for (const next of neighbors) if (!previous.has(key(next)) && clear(current, next)) { previous.set(key(next), current); queue.push(next); }
    }
}
