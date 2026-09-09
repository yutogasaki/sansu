export interface CameraPanPoint { x: number; y: number }
export interface CameraPanBounds { minX: number; maxX: number; minY: number; maxY: number }
export interface CameraPanFraming {
    /** Ground coordinates (x/z) projected into camera-space x/y. */
    ground?: { origin: CameraPanPoint; x: CameraPanPoint; z: CameraPanPoint };
    center: CameraPanPoint;
    height: number;
    aspect: number;
    bounds: CameraPanBounds;
    /** Projected earned land silhouettes; these keep a strongly zoomed view near actual land. */
    regions: readonly (readonly CameraPanPoint[])[];
}
export interface CameraPanFrame {
    left: number; right: number; top: number; bottom: number;
    width: number; height: number; pan: CameraPanPoint;
}

const cross = (a: CameraPanPoint, b: CameraPanPoint, c: CameraPanPoint) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
const clamp = (value: number, low: number, high: number) => Math.max(low, Math.min(high, value));

/** Deterministic convex outline, independent of buffer vertex order and duplicate shore samples. */
export function cameraPanHull(points: readonly CameraPanPoint[]): CameraPanPoint[] {
    const sorted = points.filter(point => Number.isFinite(point.x) && Number.isFinite(point.y))
        .map(point => ({ ...point })).sort((a, b) => a.x - b.x || a.y - b.y)
        .filter((point, index, all) => index === 0 || point.x !== all[index - 1].x || point.y !== all[index - 1].y);
    if (sorted.length < 3) return sorted;
    const half = (source: CameraPanPoint[]) => {
        const result: CameraPanPoint[] = [];
        for (const point of source) {
            while (result.length > 1 && cross(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop();
            result.push(point);
        }
        return result.slice(0, -1);
    };
    return [...half(sorted), ...half([...sorted].reverse())];
}

function closestInHull(point: CameraPanPoint, hull: readonly CameraPanPoint[]): CameraPanPoint {
    if (hull.length < 2) return hull[0] ?? point;
    if (hull.length >= 3 && hull.every((a, index) => cross(a, hull[(index + 1) % hull.length], point) >= -1e-9)) return point;
    let closest = hull[0], distance = Infinity;
    for (let index = 0; index < hull.length; index++) {
        const a = hull[index], b = hull[(index + 1) % hull.length], dx = b.x - a.x, dy = b.y - a.y;
        const t = clamp(((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
        const candidate = { x: a.x + dx * t, y: a.y + dy * t };
        const candidateDistance = (point.x - candidate.x) ** 2 + (point.y - candidate.y) ** 2;
        if (candidateDistance < distance) { distance = candidateDistance; closest = candidate; }
    }
    return closest;
}

/** Apply pan AFTER the authored fit. A local district can reach every earned
 * island, while the all-island 1x frame remains the exact original overview. */
export function frameIslandCameraPan(base: CameraPanFraming, zoom: number, pan: CameraPanPoint): CameraPanFrame {
    const height = base.height / zoom, width = height * base.aspect;
    const baseWidth = base.height * base.aspect;
    // Include the original framing margins so the unmodified starting view stays legal.
    const limits = {
        minX: Math.min(base.bounds.minX, base.center.x - baseWidth / 2) + width / 2,
        maxX: Math.max(base.bounds.maxX, base.center.x + baseWidth / 2) - width / 2,
        minY: Math.min(base.bounds.minY, base.center.y - base.height / 2) + height / 2,
        maxY: Math.max(base.bounds.maxY, base.center.y + base.height / 2) - height / 2,
    };
    let center = { x: clamp(base.center.x + pan.x, limits.minX, limits.maxX), y: clamp(base.center.y + pan.y, limits.minY, limits.maxY) };
    // Expanded silhouettes overlap across the short bridges. Keeping a land point
    // within the middle 70% prevents a small 6x viewport from getting lost at a sea corner.
    if (base.regions.length && (pan.x !== 0 || pan.y !== 0)) {
        let nearest = center, distance = Infinity;
        for (const region of base.regions) {
            const allowed = cameraPanHull(region.flatMap(point => [-1, 1].flatMap(x => [-1, 1].map(y => ({
                x: point.x + x * width * .35, y: point.y + y * height * .35,
            })))));
            if (!allowed.length) continue;
            const candidate = closestInHull(center, allowed), nextDistance = (center.x - candidate.x) ** 2 + (center.y - candidate.y) ** 2;
            if (nextDistance < distance) { nearest = candidate; distance = nextDistance; }
        }
        center = { x: clamp(nearest.x, limits.minX, limits.maxX), y: clamp(nearest.y, limits.minY, limits.maxY) };
    }
    return { left: center.x - width / 2, right: center.x + width / 2, top: center.y + height / 2, bottom: center.y - height / 2,
        width, height, pan: { x: center.x - base.center.x, y: center.y - base.center.y } };
}

/** Intersect a camera-space point with the island's level ground plane. */
export function cameraPointOnGround(frame: CameraPanFraming, point: CameraPanPoint): CameraPanPoint | undefined {
    const basis = frame.ground;
    if (!basis) return undefined;
    const determinant = basis.x.x * basis.z.y - basis.z.x * basis.x.y;
    if (Math.abs(determinant) < 1e-8) return undefined;
    const x = point.x - basis.origin.x, y = point.y - basis.origin.y;
    return { x: (x * basis.z.y - basis.z.x * y) / determinant,
        y: (basis.x.x * y - x * basis.x.y) / determinant };
}

export function groundPointInCamera(frame: CameraPanFraming, point: CameraPanPoint): CameraPanPoint | undefined {
    const basis = frame.ground;
    return basis && { x: basis.origin.x + basis.x.x * point.x + basis.z.x * point.y,
        y: basis.origin.y + basis.x.y * point.x + basis.z.y * point.y };
}
