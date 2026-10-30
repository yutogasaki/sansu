// Grow lab terrain: a smooth height field the child shapes with a soft brush.
// Roads, houses and trees are all decided from it by the other modules.

export const SIZE = 20;
export const RES = .5;
export const N = SIZE / RES + 1;
export const SEA = 0;

export type Heights = Float32Array;

export const worldX = (i: number) => -SIZE / 2 + i * RES;
export const indexOf = (x: number) => (x + SIZE / 2) / RES;

/** A green island: a high hill with a lower shoulder, falling off to the sea. */
export function sampleIsland(): Heights {
    const h = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = worldX(i), z = worldX(j);
        const hill = 5.4 * Math.exp(-((x + 1) ** 2 + (z + 1.5) ** 2) / 16);
        const shoulder = 2.4 * Math.exp(-((x - 4.5) ** 2 + (z - 3) ** 2) / 7);
        const ripple = .25 * Math.sin(x * 1.3 + z * .7) * Math.cos(z * 1.1 - x * .4);
        const r = Math.hypot(x * 1.05, z);
        const coast = r < 7 ? 0 : r > 9.5 ? 1 : (r - 7) / 2.5;
        h[i + j * N] = (hill + shoulder + ripple + .7) * (1 - coast * coast) - coast * 1.6;
    }
    return h;
}

/** What a child starts with: a small, low, round island and nothing on it. */
export function smallIsland(): Heights {
    const h = new Float32Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const r = Math.hypot(worldX(i), worldX(j));
        h[i + j * N] = r < 3 ? .7 : r < 5 ? .7 - (r - 3) / 2 * 2.3 : -1.6;
    }
    return h;
}

export function heightAt(h: Heights, x: number, z: number): number {
    const fi = Math.max(0, Math.min(N - 1.001, indexOf(x)));
    const fj = Math.max(0, Math.min(N - 1.001, indexOf(z)));
    const i = Math.floor(fi), j = Math.floor(fj), u = fi - i, v = fj - j;
    const a = h[i + j * N], b = h[i + 1 + j * N], c = h[i + (j + 1) * N], d = h[i + 1 + (j + 1) * N];
    return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

/** Rise per unit of run at a point. */
export function slopeAt(h: Heights, x: number, z: number): number {
    const e = RES * .5;
    const dx = (heightAt(h, x + e, z) - heightAt(h, x - e, z)) / (2 * e);
    const dz = (heightAt(h, x, z + e) - heightAt(h, x, z - e)) / (2 * e);
    return Math.hypot(dx, dz);
}

/**
 * A broad round bump (or dent): a smooth dome that fades to nothing at the
 * radius, so stacking on one spot grows a hill, not a spike.
 */
export function brush(h: Heights, x: number, z: number, amount: number, radius = 2.4): boolean {
    let changed = false;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const d2 = (worldX(i) - x) ** 2 + (worldX(j) - z) ** 2;
        if (d2 >= radius * radius) continue;
        const k = i + j * N;
        const fall = 1 - d2 / (radius * radius);
        const next = Math.max(-2, Math.min(9, h[k] + amount * fall * fall));
        if (next !== h[k]) { h[k] = next; changed = true; }
    }
    if (changed) settleSlopes(h, x, z, radius + 2);
    return changed;
}

/**
 * Steepest rise per unit of run the ground keeps; earth piled steeper slides
 * down. About as steep as the sample hill: piling on one spot makes the island
 * wider, not a spike, and leaves slopes gentle enough for houses and roads.
 */
export const TALUS = 1.1;

/**
 * Piled earth slides like sand until no slope is steeper than TALUS, so a hill
 * stacked on one spot spreads out at the foot instead of turning into a needle,
 * and its sides stay gentle enough to hold bushes. A stroke only takes a few
 * passes, which keeps it quick; the island settles fully when the finger lifts.
 */
export function settleSlopes(h: Heights, x: number, z: number, reach: number, passes = 10) {
    // Start near the stroke and widen the area whenever earth reaches its
    // border, so a pile spreads as far as it needs to and never stops along a
    // straight line.
    let i0 = Math.max(0, Math.floor(indexOf(x - reach))), i1 = Math.min(N - 1, Math.ceil(indexOf(x + reach)));
    let j0 = Math.max(0, Math.floor(indexOf(z - reach))), j1 = Math.min(N - 1, Math.ceil(indexOf(z + reach)));
    // Diagonal neighbours too, so a pile spreads round rather than square.
    const pairs = [[1, 0], [0, 1], [1, 1], [1, -1]] as const;
    for (let pass = 0; pass < passes; pass++) {
        let moved = false, edgeMoved = false;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const k = i + j * N;
            for (const [di, dj] of pairs) {
                if (i + di > i1 || j + dj > j1 || j + dj < j0) continue;
                const nk = k + di + dj * N;
                const most = TALUS * RES * Math.hypot(di, dj);
                const diff = h[k] - h[nk];
                // A hair over the limit is left alone, so the sliding comes to rest.
                if (Math.abs(diff) <= most + .005) continue;
                const shift = (Math.abs(diff) - most) / 2 * Math.sign(diff);
                h[k] -= shift; h[nk] += shift;
                moved = true;
                if (i === i0 || i + di === i1 || j === j0 || j === j1 || j + dj === j0 || j + dj === j1) edgeMoved = true;
            }
        }
        if (edgeMoved) { i0 = Math.max(0, i0 - 2); j0 = Math.max(0, j0 - 2); i1 = Math.min(N - 1, i1 + 2); j1 = Math.min(N - 1, j1 + 2); }
        if (!moved) break;
    }
    // Towards the edge of the world the ground slopes into the sea along a
    // circle, so even an island piled up to fill everything keeps a round shore.
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const left = SIZE / 2 - .5 - Math.hypot(worldX(i), worldX(j));
        h[i + j * N] = Math.min(h[i + j * N], -1.6 + Math.max(0, left) * TALUS);
    }
}
