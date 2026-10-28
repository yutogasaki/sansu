/** Local comparison only. A is the existing continuous interpolation; B forms
 * a shoulder and toe around a steeper, continuously joined central slope. */
export type TerrainMethod = 'A' | 'B' | 'C' | 'D' | 'F' | 'G' | 'H';
export const SECTION_PROFILE_REVISION = 'shoulder-slope-toe-v1';
export const SECTION_SHOULDER = .18;
export const SECTION_TOE = .82;

/** Node callers pass a query or a generator mode explicitly. No storage, env or
 * mutable global overrides participate in the physical world. */
export function terrainMethod(search = typeof window === 'undefined' ? '' : window.location.search): TerrainMethod {
    const requested = new URLSearchParams(search).get('terrainTrial');
    return requested === 'B' || requested === 'C' || requested === 'D' || requested === 'F' || requested === 'G' || requested === 'H' ? requested : 'A';
}

export function sectionBlend(t: number, mode: TerrainMethod): number {
    if (!Number.isFinite(t)) throw Error('Terrain section parameter must be finite');
    if (!['A', 'B', 'C', 'D', 'F', 'G', 'H'].includes(mode)) throw Error('Unknown terrain method');
    const x = Math.max(0, Math.min(1, mode === 'B' ? (t - SECTION_SHOULDER) / (SECTION_TOE - SECTION_SHOULDER) : t));
    return x * x * (3 - 2 * x);
}

/** Four immutable acquired-cell height offsets in units of the saved edit step.
 * Negative edits never become shallower than A. Boundary cells never gain a
 * taller interpolation, so the identical outer shore fade cannot add dry land.
 * Both constraints act before clipping/triangulation, never as a visual mask. */
export function sectionOffset(corners: readonly [number, number, number, number], x: number, z: number, mode: TerrainMethod, raiseWeight = 1): number {
    if (!corners.every(Number.isFinite)) throw Error('Terrain section heights must be finite');
    const interpolate = (method: TerrainMethod) => {
        const u = sectionBlend(x, method), v = sectionBlend(z, method);
        return ((1 - u) * corners[0] + u * corners[1]) * (1 - v)
            + ((1 - u) * corners[2] + u * corners[3]) * v;
    };
    const a = interpolate('A');
    if (mode !== 'B') return a;
    const b = interpolate(mode), difference = b - a;
    const weight = corners.some(height => height < 0) ? 0 : Math.max(0, Math.min(1, raiseWeight));
    // A C1 limiter avoids a new crease where the no-fill constraint activates.
    const shaped = difference * Math.abs(difference) / (Math.abs(difference) + .025);
    return a + (shaped > 0 ? shaped * weight : shaped);
}

/** A full inner-cell band absorbs the B/A boundary; all exterior samples retain
 * A or lower heights. The shared triangulation then cannot expand exterior dry area. */
export function sectionRaiseWeight(cell: { x: number; z: number }, bounds: { minX: number; maxX: number; depth: number }): number {
    const interior = Math.min(cell.x - bounds.minX, bounds.maxX - cell.x, cell.z, bounds.depth - 1 - cell.z);
    return sectionBlend(interior / .5, 'A');
}
