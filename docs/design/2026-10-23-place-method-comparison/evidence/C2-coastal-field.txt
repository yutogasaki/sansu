import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { legacyIslandWorld } from '../../../src/domain/growingIsland/legacyWorldDefinition';
import { foundationEditWeight } from '../2026-10-22-place-strategy-trial/foundation';

export const COASTAL_FIELD_REVISION = 'connected-coast-band-v2';
type TerrainState = Pick<GrowingState, 'land'> & Partial<Pick<GrowingState, 'bridge' | 'terrain'>>;
interface Options { minX: number; maxX: number; minZ: number; maxZ: number; detail: number; margin: number; dryLevel: number; curved: boolean }
interface Point extends Cell { y: number }
interface Shore { a: Cell; b: Cell; retreat: number; crest: number }
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
const squaredDistance = (p: Cell, shore: Shore) => {
    const dx = shore.b.x - shore.a.x, dz = shore.b.z - shore.a.z;
    const t = Math.max(0, Math.min(1, ((p.x - shore.a.x) * dx + (p.z - shore.a.z) * dz) / (dx * dx + dz * dz)));
    return (p.x - shore.a.x - dx * t) ** 2 + (p.z - shore.a.z - dz * t) ** 2;
};

/** Derive a connected exterior coast from A's exact sampling lattice, then carve
 * a shared shoulder/slope/toe band inward. No source vertices move horizontally,
 * and every C height is <= A, so the same triangle clipping cannot refill water.
 * Protection depends on all legal acquired sites, never placed owners: moving or
 * storing a bench cannot create or remove terrain. */
export function createCoastalField(state: TerrainState, sourceHeight: (state: TerrainState, cell: Cell) => number, options: Options) {
    // Carve from the non-positive reference only. For a fixed excavation input,
    // positive edit contributions pass through unchanged, so raising cannot
    // lower a vertex by moving a shoreline or disabling a support reservation.
    const reference: TerrainState = { ...state, terrain: state.terrain && { ...state.terrain,
        heights: Object.fromEntries(Object.entries(state.terrain.heights).filter(([, height]) => height < 0)) } };
    const baselineHeight = (cell: Cell) => sourceHeight(reference, cell);
    const { minX, maxX, minZ, maxZ, detail, margin, dryLevel } = options;
    const nx = Math.round((maxX - minX + margin * 2) * detail), nz = Math.round((maxZ - minZ + margin * 2) * detail);
    const width = nx + 1, startX = minX - margin, startZ = minZ - margin;
    const points: Point[] = [];
    for (let iz = 0; iz <= nz; iz++) for (let ix = 0; ix <= nx; ix++) {
        const cell = { x: startX + ix / detail, z: startZ + iz / detail };
        points.push({ ...cell, y: baselineHeight(cell) });
    }
    // Only wet nodes connected to the outside seed a coast. Closed inland holes
    // remain untouched rather than receiving a fabricated sea-facing terrace.
    const outside = new Uint8Array(points.length), queue: number[] = [];
    const addWet = (i: number) => { if (!outside[i] && points[i].y < dryLevel) { outside[i] = 1; queue.push(i); } };
    for (let ix = 0; ix <= nx; ix++) { addWet(ix); addWet(nz * width + ix); }
    for (let iz = 0; iz <= nz; iz++) { addWet(iz * width); addWet(iz * width + nx); }
    for (let q = 0; q < queue.length; q++) {
        const i = queue[q], x = i % width, z = Math.floor(i / width);
        if (x > 0) addWet(i - 1); if (x < nx) addWet(i + 1); if (z > 0) addWet(i - width); if (z < nz) addWet(i + width);
    }
    const cuts = Object.entries(state.terrain?.heights ?? {}).filter(([, height]) => height < 0).map(([key, height]) => {
        const [x, z] = key.split(',').map(Number); return { x, z, amount: -height / 4 };
    });
    const shores: Shore[] = [];
    const contour = (ids: number[]) => {
        const triangle = ids.map(i => points[i]);
        if (!ids.some(i => outside[i]) || triangle.every(p => p.y < dryLevel)) return;
        const intersections: Cell[] = [];
        for (let i = 0; i < 3; i++) {
            const a = triangle[i], b = triangle[(i + 1) % 3];
            if ((a.y < dryLevel) === (b.y < dryLevel)) continue;
            const t = (dryLevel - a.y) / (b.y - a.y);
            intersections.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
        }
        if (intersections.length !== 2) return;
        const [a, b] = intersections, length = Math.hypot(b.x - a.x, b.z - a.z); if (length < 1e-9) return;
        const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, tx = (b.x - a.x) / length, tz = (b.z - a.z) / length;
        let normalX = -tz, normalZ = tx;
        const dry = triangle.find(p => p.y >= dryLevel)!;
        if ((dry.x - mid.x) * normalX + (dry.z - mid.z) * normalZ < 0) { normalX *= -1; normalZ *= -1; }
        // A long tangent samples a shared bay/cape, not individual cell corners.
        const tangentHeight = (baselineHeight({ x: mid.x + tx * .8, z: mid.z + tz * .8 })
            + baselineHeight({ x: mid.x - tx * .8, z: mid.z - tz * .8 })) / 2;
        const bay = smooth((tangentHeight - dryLevel) / .35);
        const excavation = 1 - Math.exp(-cuts.reduce((sum, cut) => {
            const d2 = (cut.x - mid.x) ** 2 + (cut.z - mid.z) ** 2;
            return sum + cut.amount * Math.exp(-d2 / 2.88) * smooth(1 - d2 / 5.76);
        }, 0));
        const crest = Math.max(dryLevel + .14, baselineHeight({ x: mid.x + normalX * 1.25, z: mid.z + normalZ * 1.25 }));
        shores.push({ a, b, retreat: .12 + .24 * bay + .16 * excavation, crest });
    };
    for (let iz = 0; iz < nz; iz++) for (let ix = 0; ix < nx; ix++) {
        const a = iz * width + ix, b = a + 1, c = a + width, d = c + 1;
        contour([a, c, b]); contour([b, c, d]);
    }
    // A sampler matching the actual A triangles, used to reserve every cell
    // that the existing .46 footprint/.13 relative-tilt contract can accept.
    const sampledA = (cell: Cell) => {
        const gx = (cell.x - startX) * detail, gz = (cell.z - startZ) * detail;
        const ix = Math.floor(gx), iz = Math.floor(gz); if (ix < 0 || iz < 0 || ix >= nx || iz >= nz) return undefined;
        const u = gx - ix, v = gz - iz, a = points[iz * width + ix].y, b = points[iz * width + ix + 1].y;
        const c = points[(iz + 1) * width + ix].y, d = points[(iz + 1) * width + ix + 1].y;
        const y = u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
        return y;
    };
    const original = legacyIslandWorld({ land: state.land, bridge: state.bridge }, options.curved), protectedSites: (Cell & { strength: number })[] = [];
    for (const site of original.sites.filter(site => site.placement)) {
        const cell = site.cell, center = sampledA(cell), oldCenter = original.floorAt(cell)?.point.y;
        if (center === undefined || oldCenter === undefined) continue;
        let deviation = 0, lowest = center;
        for (const dx of [-.46, -.23, 0, .23, .46]) for (const dz of [-.46, -.23, 0, .23, .46]) {
            const at = { x: cell.x + dx, z: cell.z + dz }, current = sampledA(at), old = original.floorAt(at)?.point.y;
            if (current === undefined || old === undefined) { deviation = Infinity; continue; }
            deviation = Math.max(deviation, Math.abs((current - center) - (old - oldCenter))); lowest = Math.min(lowest, current);
        }
        const excess = Math.max(0, deviation - .130000001, dryLevel - lowest);
        const strength = 1 - smooth(excess / .28);
        if (strength > 0) protectedSites.push({ ...cell, strength });
    }
    const protectionRadius = .46 + 1 / detail + 1e-8;
    const carve = (cell: Cell) => {
        const a = baselineHeight(cell);
        if (a < dryLevel || !shores.length) return a;
        const foundation = foundationEditWeight(state, cell); if (!foundation) return a;
        let protection = 0;
        for (const site of protectedSites) {
            const distance = Math.max(Math.abs(cell.x - site.x), Math.abs(cell.z - site.z));
            protection = Math.max(protection, site.strength * (1 - smooth((distance - protectionRadius) / .25)));
        }
        const free = 1 - protection; if (!free) return a;
        let nearest = Infinity;
        for (const shore of shores) nearest = Math.min(nearest, squaredDistance(cell, shore));
        const distance = Math.sqrt(nearest); if (distance >= 1.7) return a;
        // Blend nearby sections, so the nearest-segment identity cannot make a
        // seam or jump at a bay's centre or where two shores face each other.
        let weights = 0, retreat = 0, crest = 0;
        for (const shore of shores) {
            const d2 = squaredDistance(cell, shore); if (d2 > nearest + .25) continue;
            const length = Math.hypot(shore.b.x - shore.a.x, shore.b.z - shore.a.z);
            const w = Math.exp(-(d2 - nearest) / .07) * smooth(1 - (d2 - nearest) / .25) * length;
            weights += w; retreat += shore.retreat * w; crest += shore.crest * w;
        }
        retreat /= weights; crest /= weights;
        const inset = distance - retreat;
        const target = inset <= 0 ? dryLevel + inset * .7
            : inset < .25 ? dryLevel + .10 * smooth(inset / .25)
                : dryLevel + .10 + (crest - dryLevel - .10) * smooth((inset - .25) / .9);
        const fade = 1 - smooth((distance - 1.2) / .5);
        return a - Math.max(0, a - target) * fade * foundation * free;
    };
    const heightAt = (cell: Cell) => sourceHeight(state, cell) - (baselineHeight(cell) - carve(cell));
    return { heightAt, proof: { revision: COASTAL_FIELD_REVISION, contourSegments: shores.length, exteriorWetSamples: queue.length,
        protectedSites, protectionRadius, ownerIndependent: true, positiveContributionPreserved: true, continuousSupportReservation: true, maxBandWidth: 1.7 } };
}
