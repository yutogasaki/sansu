import type { WorldPoint } from './worldTypes';

export type WaterOutline = readonly WorldPoint[];
const EPS = 1e-9;
const cross = (a: WorldPoint, b: WorldPoint, c: WorldPoint) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
const same = (a: WorldPoint, b: WorldPoint) => Math.abs(a.x - b.x) < EPS && Math.abs(a.z - b.z) < EPS;
export const outlineArea = (outline: WaterOutline) => outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length]; return sum + p.x * q.z - p.z * q.x;
}, 0) / 2;
export function pointInWaterOutline(point: WorldPoint, outline: WaterOutline): boolean {
    let inside = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
        const a = outline[j], b = outline[i], length = Math.hypot(b.x - a.x, b.z - a.z);
        if (length > EPS && Math.abs(cross(a, b, point)) <= EPS * length
            && point.x >= Math.min(a.x, b.x) - EPS && point.x <= Math.max(a.x, b.x) + EPS
            && point.z >= Math.min(a.z, b.z) - EPS && point.z <= Math.max(a.z, b.z) + EPS) return true;
        if ((a.z > point.z) !== (b.z > point.z) && point.x < (b.x - a.x) * (point.z - a.z) / (b.z - a.z) + a.x) inside = !inside;
    }
    return inside;
}
const isConvex = (p: WaterOutline) => p.every((a, i) => cross(a, p[(i + 1) % p.length], p[(i + 2) % p.length]) >= -EPS);
/** Ear clipping followed by convex merging. The source's small concavities are
 * retained; no convex hull or fan across an outside notch is substituted. */
export function decomposeWaterOutline(outline: WaterOutline): WorldPoint[][] {
    if (outline.length < 3 || outline.length > 128 || !outline.every(p => [p.x, p.y, p.z].every(Number.isFinite))) return [];
    const vertices = [...outlineArea(outline) < 0 ? [...outline].reverse() : outline];
    const pieces: WorldPoint[][] = [];
    while (vertices.length > 3) {
        let clipped = false;
        for (let i = 0; i < vertices.length; i++) {
            const a = vertices[(i + vertices.length - 1) % vertices.length], b = vertices[i], c = vertices[(i + 1) % vertices.length];
            if (cross(a, b, c) <= EPS) continue;
            if (vertices.some(p => p !== a && p !== b && p !== c && cross(a, b, p) >= -EPS && cross(b, c, p) >= -EPS && cross(c, a, p) >= -EPS)) continue;
            pieces.push([a, b, c]); vertices.splice(i, 1); clipped = true; break;
        }
        if (!clipped) return [];
    }
    if (outlineArea(vertices) <= EPS) return [];
    pieces.push(vertices);
    for (let changed = true; changed;) {
        changed = false;
        merge: for (let a = 0; a < pieces.length; a++) for (let b = a + 1; b < pieces.length; b++) {
            const left = pieces[a], right = pieces[b];
            for (let i = 0; i < left.length; i++) for (let j = 0; j < right.length; j++) {
                if (!same(left[i], right[(j + 1) % right.length]) || !same(left[(i + 1) % left.length], right[j])) continue;
                const joined = [...Array.from({ length: left.length }, (_, k) => left[(i + 1 + k) % left.length]),
                    ...Array.from({ length: right.length - 2 }, (_, k) => right[(j + 2 + k) % right.length])];
                if (!isConvex(joined)) continue;
                pieces[a] = joined; pieces.splice(b, 1); changed = true; break merge;
            }
        }
    }
    return pieces;
}
/** Distance to the first real boundary crossing on a ray from inside a pool. */
export function waterRayExit(origin: WorldPoint, dx: number, dz: number, outline: WaterOutline): number | undefined {
    if (!pointInWaterOutline(origin, outline)) return;
    let nearest = Infinity;
    for (let i = 0; i < outline.length; i++) {
        const a = outline[i], b = outline[(i + 1) % outline.length], ex = b.x - a.x, ez = b.z - a.z;
        const determinant = dx * ez - dz * ex;
        if (Math.abs(determinant) < EPS) continue;
        const ax = a.x - origin.x, az = a.z - origin.z, t = (ax * ez - az * ex) / determinant, u = (ax * dz - az * dx) / determinant;
        if (t >= -EPS && u >= -EPS && u <= 1 + EPS) nearest = Math.min(nearest, t);
    }
    return Number.isFinite(nearest) ? nearest : undefined;
}
/** Actual intersections of a segment and a concave stencil, used to leave
 * mouths open in all rim bands rather than drawing a wall over the stream. */
export function waterSegmentIntervals(a: WorldPoint, b: WorldPoint, outline: WaterOutline): [number, number][] {
    const dx = b.x - a.x, dz = b.z - a.z, values = [0, 1];
    for (let i = 0; i < outline.length; i++) {
        const p = outline[i], q = outline[(i + 1) % outline.length], ex = q.x - p.x, ez = q.z - p.z, det = dx * ez - dz * ex;
        if (Math.abs(det) < EPS) continue;
        const px = p.x - a.x, pz = p.z - a.z, t = (px * ez - pz * ex) / det, u = (px * dz - pz * dx) / det;
        if (t > EPS && t < 1 - EPS && u >= -EPS && u <= 1 + EPS) values.push(t);
    }
    values.sort((x, y) => x - y);
    return values.slice(1).flatMap((end, i) => {
        const start = values[i], t = (start + end) / 2;
        return end - start > EPS && pointInWaterOutline({ x: a.x + dx * t, y: a.y, z: a.z + dz * t }, outline) ? [[start, end] as [number, number]] : [];
    });
}
/** Remove convex stencil pieces from an actual surface triangle. Inserted
 * points interpolate its full xyz, so a sloping rim keeps its original plane. */
export function subtractWaterConvexPieces(polygon: WaterOutline, pieces: readonly WaterOutline[]): WorldPoint[][] {
    let remaining = [[...polygon]];
    const box = (points: WaterOutline) => ({ minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)),
        minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) });
    const sourceBox = box(polygon);
    for (const piece of pieces) {
        const cutBox = box(piece);
        if (sourceBox.maxX < cutBox.minX - EPS || sourceBox.minX > cutBox.maxX + EPS || sourceBox.maxZ < cutBox.minZ - EPS || sourceBox.minZ > cutBox.maxZ + EPS) continue;
        remaining = remaining.flatMap(input => {
            let inside = input; const outside: WorldPoint[][] = [];
            for (let i = 0; i < piece.length && inside.length; i++) {
                const a = piece[i], b = piece[(i + 1) % piece.length];
                const split = (keepInside: boolean) => {
                    const result: WorldPoint[] = [];
                    for (let j = 0; j < inside.length; j++) {
                        const p = inside[j], q = inside[(j + 1) % inside.length], dp = cross(a, b, p), dq = cross(a, b, q);
                        const keepP = keepInside ? dp >= -EPS : dp <= EPS, keepQ = keepInside ? dq >= -EPS : dq <= EPS;
                        if (keepP) result.push(p);
                        if (keepP !== keepQ && Math.abs(dp - dq) > EPS) {
                            const t = Math.max(0, Math.min(1, dp / (dp - dq)));
                            result.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t, z: p.z + (q.z - p.z) * t });
                        }
                    }
                    const clean = result.filter((point, index) => !same(point, result[(index + result.length - 1) % result.length]));
                    return clean.length >= 3 && Math.abs(outlineArea(clean)) > 1e-12 ? clean : [];
                };
                const removed = split(false); if (removed.length) outside.push(removed);
                inside = split(true);
            }
            return outside;
        });
    }
    return remaining;
}
/** Adapt the actual native contour along and across a connection separately.
 * The fixed owner anchor is never translated to a source beauty-scene centre. */
export function adaptWaterContour(source: readonly { x: number; z: number }[], center: WorldPoint,
    along: number, across: number, yaw: number, negativeAlong = along, negativeAcross = across): WorldPoint[] {
    const maxX = Math.max(...source.map(p => p.x)), minX = -Math.min(...source.map(p => p.x)),
        maxZ = Math.max(...source.map(p => p.z)), minZ = -Math.min(...source.map(p => p.z));
    const outline = source.map(p => {
        const x = p.x * (p.x < 0 ? negativeAlong / minX : along / maxX), z = p.z * (p.z < 0 ? negativeAcross / minZ : across / maxZ);
        return { x: center.x + x * Math.cos(yaw) - z * Math.sin(yaw), y: center.y,
            z: center.z + x * Math.sin(yaw) + z * Math.cos(yaw) };
    });
    return outlineArea(outline) < 0 ? outline.reverse() : outline;
}
