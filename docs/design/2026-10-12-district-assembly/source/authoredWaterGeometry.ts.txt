import type { Cell } from './types';

export const polygonArea = (polygon: readonly Cell[]) => polygon.reduce((sum, point, i) => {
    const next = polygon[(i + 1) % polygon.length]; return sum + point.x * next.z - next.x * point.z;
}, 0) / 2;
export const polygonHasArea = (polygon: readonly Cell[]) => polygon.length >= 3 && Math.abs(polygonArea(polygon)) > 1e-12;
const cross = (a: Cell, b: Cell, point: Cell) => (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
export const polygonBounds = (polygon: readonly Cell[]) => ({ minX: Math.min(...polygon.map(p => p.x)), maxX: Math.max(...polygon.map(p => p.x)),
    minZ: Math.min(...polygon.map(p => p.z)), maxZ: Math.max(...polygon.map(p => p.z)) });
export const polygonBoxesOverlap = (a: ReturnType<typeof polygonBounds>, b: ReturnType<typeof polygonBounds>) =>
    a.minX <= b.maxX && a.maxX >= b.minX && a.minZ <= b.maxZ && a.maxZ >= b.minZ;

export function clipPolygon(polygon: readonly Cell[], distance: (point: Cell) => number): Cell[] {
    const result: Cell[] = [];
    for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i], b = polygon[(i + 1) % polygon.length], da = distance(a), db = distance(b);
        if (da >= 0) result.push(a);
        if ((da >= 0) !== (db >= 0)) {
            const t = da / (da - db); result.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        }
    }
    return result;
}
export function intersectPolygons(polygon: readonly Cell[], convex: readonly Cell[]): Cell[] {
    let result = [...polygon]; const orientation = Math.sign(polygonArea(convex));
    for (let i = 0; i < convex.length && polygonHasArea(result); i++) {
        const a = convex[i], b = convex[(i + 1) % convex.length];
        result = clipPolygon(result, p => orientation * cross(a, b, p));
    }
    return result;
}
export function subtractPolygon(polygon: readonly Cell[], convex: readonly Cell[]): Cell[][] {
    const result: Cell[][] = [], orientation = Math.sign(polygonArea(convex)); let inside = [...polygon];
    for (let i = 0; i < convex.length && polygonHasArea(inside); i++) {
        const a = convex[i], b = convex[(i + 1) % convex.length], distance = (p: Cell) => orientation * cross(a, b, p);
        const outside = clipPolygon(inside, p => -distance(p)); if (polygonHasArea(outside)) result.push(outside);
        inside = clipPolygon(inside, distance);
    }
    return result;
}

/** Simple polygons only: rejecting a crossing is safer than inventing an interior. */
export function triangulateWaterPolygon(input: readonly Cell[]): Cell[][] | undefined {
    if (input.length < 3 || input.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z))) return;
    let points = input.filter((p, i) => Math.hypot(p.x - input[(i + input.length - 1) % input.length].x, p.z - input[(i + input.length - 1) % input.length].z) > 1e-10);
    for (let i = points.length - 1; i >= 0 && points.length >= 3; i--) {
        if (Math.abs(cross(points[(i + points.length - 1) % points.length], points[(i + 1) % points.length], points[i])) <= 1e-12) points.splice(i, 1);
    }
    if (!polygonHasArea(points)) return;
    const onSegment = (a: Cell, b: Cell, p: Cell) => Math.abs(cross(a, b, p)) <= 1e-12
        && p.x >= Math.min(a.x, b.x) - 1e-12 && p.x <= Math.max(a.x, b.x) + 1e-12 && p.z >= Math.min(a.z, b.z) - 1e-12 && p.z <= Math.max(a.z, b.z) + 1e-12;
    for (let i = 0; i < points.length; i++) for (let j = i + 1; j < points.length; j++) {
        if (j === i + 1 || i === 0 && j === points.length - 1) continue;
        const a = points[i], b = points[(i + 1) % points.length], c = points[j], d = points[(j + 1) % points.length];
        if (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0
            || onSegment(a, b, c) || onSegment(a, b, d) || onSegment(c, d, a) || onSegment(c, d, b)) return;
    }
    const result: Cell[][] = [], orientation = Math.sign(polygonArea(points)); points = [...points];
    while (points.length > 3) {
        const ear = points.findIndex((b, i) => {
            const a = points[(i + points.length - 1) % points.length], c = points[(i + 1) % points.length];
            return orientation * cross(a, b, c) > 1e-12 && !points.some((p, j) => j !== i && j !== (i + points.length - 1) % points.length && j !== (i + 1) % points.length
                && orientation * cross(a, b, p) >= -1e-12 && orientation * cross(b, c, p) >= -1e-12 && orientation * cross(c, a, p) >= -1e-12);
        });
        if (ear < 0) return;
        result.push([points[(ear + points.length - 1) % points.length], points[ear], points[(ear + 1) % points.length]]); points.splice(ear, 1);
    }
    result.push(points); return result;
}

export function mapTrianglePoint(point: Cell, from: readonly Cell[], to: readonly Cell[]): Cell {
    const [a, b, c] = from, determinant = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z);
    const u = ((b.z - c.z) * (point.x - c.x) + (c.x - b.x) * (point.z - c.z)) / determinant;
    const v = ((c.z - a.z) * (point.x - c.x) + (a.x - c.x) * (point.z - c.z)) / determinant;
    return { x: to[0].x * u + to[1].x * v + to[2].x * (1 - u - v), z: to[0].z * u + to[1].z * v + to[2].z * (1 - u - v) };
}
export const protectionRectangle = (cell: Cell, half: number): Cell[] => [
    { x: cell.x - half, z: cell.z - half }, { x: cell.x + half, z: cell.z - half },
    { x: cell.x + half, z: cell.z + half }, { x: cell.x - half, z: cell.z + half },
];
