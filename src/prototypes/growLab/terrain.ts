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

/** Steepest rise per unit of run the ground keeps; earth piled steeper slides down. */
export const TALUS = 1.8;

/**
 * Piled earth slides like sand until no slope is steeper than TALUS, so a hill
 * stacked on one spot spreads out at the foot instead of turning into a needle,
 * and its sides stay gentle enough to hold bushes. Only the area near the
 * stroke is touched, which keeps it quick.
 */
export function settleSlopes(h: Heights, x: number, z: number, reach: number) {
    const i0 = Math.max(0, Math.floor(indexOf(x - reach))), i1 = Math.min(N - 1, Math.ceil(indexOf(x + reach)));
    const j0 = Math.max(0, Math.floor(indexOf(z - reach))), j1 = Math.min(N - 1, Math.ceil(indexOf(z + reach)));
    const most = TALUS * RES;
    for (let pass = 0; pass < 24; pass++) {
        let moved = false;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
            const k = i + j * N;
            for (const [di, dj] of [[1, 0], [0, 1]] as const) {
                if (i + di > i1 || j + dj > j1) continue;
                const nk = k + di + dj * N;
                const diff = h[k] - h[nk];
                if (Math.abs(diff) <= most) continue;
                const shift = (Math.abs(diff) - most) / 2 * Math.sign(diff);
                h[k] -= shift; h[nk] += shift;
                moved = true;
            }
        }
        if (!moved) break;
    }
}
