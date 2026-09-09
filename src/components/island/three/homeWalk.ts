export interface HomePoint { x: number; z: number }
export const HOME_WALK_START: HomePoint = { x: .4, z: 1.1 };
/** Clearance includes the small indoor resident's whole body, not only its feet. */
export function isHomeFloorWalkable(p: HomePoint) {
    return Number.isFinite(p.x) && Number.isFinite(p.z) && p.x >= -2.9 && p.x <= 2.9 && p.z >= .85 && p.z <= 3.65
        && !(p.x < -.95 && p.z > 1.15 && p.z < 3.02)
        && Math.hypot(p.x - .55, p.z - 2.52) > 1.1
        && Math.hypot(p.x - 2.74, p.z - 1.95) > .7;
}
export function clearHomeSegment(a: HomePoint, b: HomePoint) {
    const steps = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / .04));
    return Array.from({ length: steps + 1 }, (_, i) => ({ x: a.x + (b.x - a.x) * i / steps, z: a.z + (b.z - a.z) * i / steps })).every(isHomeFloorWalkable);
}
/** Small bounded grid routes around the chair, table, shelf and plant. No persistence. */
export function planHomeWalk(start: HomePoint, end: HomePoint): HomePoint[] | undefined {
    if (!isHomeFloorWalkable(start) || !isHomeFloorWalkable(end)) return;
    if (clearHomeSegment(start, end)) return [{ ...start }, { ...end }];
    const nodes: HomePoint[] = [];
    for (let x = -2.8; x <= 2.81; x += .2) for (let z = 1; z <= 3.61; z += .2) {
        const p = { x, z }; if (isHomeFloorWalkable(p)) nodes.push(p);
    }
    nodes.unshift({ ...start }); nodes.push({ ...end });
    const previous = new Map<number, number>([[0, -1]]), queue = [0], last = nodes.length - 1;
    for (let q = 0; q < queue.length; q++) {
        const i = queue[q];
        if (i === last) {
            const path: HomePoint[] = [];
            for (let j = last; j >= 0; j = previous.get(j)!) path.unshift(nodes[j]);
            // Straighten only segments with full-body clearance.
            const result = [path[0]];
            for (let a = 0; a < path.length - 1;) {
                let b = path.length - 1; while (b > a + 1 && !clearHomeSegment(path[a], path[b])) b--;
                result.push(path[b]); a = b;
            }
            return result;
        }
        for (let j = 1; j < nodes.length; j++) if (!previous.has(j)
            && Math.hypot(nodes[j].x - nodes[i].x, nodes[j].z - nodes[i].z) <= .3 && clearHomeSegment(nodes[i], nodes[j])) {
            previous.set(j, i); queue.push(j);
        }
    }
}
