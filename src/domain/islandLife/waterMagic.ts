export const WATER_RADIUS = .312;
export function validWaterPoint(point: unknown): point is [number, number] {
    return Array.isArray(point) && point.length === 2 && point.every(Number.isFinite) && Math.hypot(point[0], point[1]) <= WATER_RADIUS;
}

/** Rim/body taps belong to the bowl; put their origin on its nearest water edge. */
export function waterSurfacePoint(x: number, z: number): [number, number] {
    const length = Math.hypot(x, z), factor = length > WATER_RADIUS * .98 ? WATER_RADIUS * .98 / length : 1;
    return [x * factor, z * factor];
}
