import type { Cell } from '../../../src/domain/growingIsland/types';
import type { PlaceShape } from './directional-field';

export const SHOULDER_REVISION = 'north-only-shoulder-v1';
type ShoulderMode = 'off' | 'northWide' | 'northHermite';
let cachedSearch: string | undefined, cachedMode: ShoulderMode = 'off';
const queryString = () => typeof window === 'undefined' ? '' : window.location.search;
export function assertNoShoulderPersistence(): void {
    if (new URLSearchParams(queryString()).has('shoulderTrial'))
        throw Error('肩の比較はメモリ内専用です。保存DBは開けません。');
}
export function shoulderTrialMode(): ShoulderMode {
    const search = queryString();
    if (search === cachedSearch) return cachedMode;
    const query = new URLSearchParams(search), value = query.get('shoulderTrial');
    if (!query.has('shoulderTrial')) { cachedSearch = search; cachedMode = 'off'; return cachedMode; }
    if (query.has('trialSave')) assertNoShoulderPersistence();
    if (value !== 'northWide' && value !== 'northHermite') throw Error('肩の比較方式を確認してください。');
    const required = { terrainTrial: 'H', baseTrial: 'stable', rampTrial: 'linear', growthTrial: 'inherit',
        compileTrial: 'single', trialScene: 'shore', queryTrial: 'frozen', memoTrial: 'samples', edgeTrial: 'memo' };
    if (Object.entries(required).some(([key, expected]) => query.get(key) !== expected)
        || query.has('shoreTrial') && query.get('shoreTrial') !== 'off')
        throw Error('肩の比較は固定の岸データと制作方式で、岸加工offにして開いてください。');
    cachedSearch = search; cachedMode = value; return cachedMode;
}
export const shoulderRevision = () => shoulderTrialMode() === 'northHermite' ? 'north-only-shoulder-hermite-v1' : SHOULDER_REVISION;
/** This one-factor experiment only addresses the declared east fixture. The
 * west place and every other shape retain their existing numeric field. */
export function hasNorthWideShoulder(shape: PlaceShape): boolean {
    return shoulderTrialMode() !== 'off' && shape.center.x === 5 && shape.center.z === 5
        && shape.height === .9 && shape.radius === 1.6 && shape.flatRadius === 1.75
        && shape.entrance === 1.2 && shape.rampDirection === 'west';
}
const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function shoulderWidth(shape: PlaceShape, cell: Cell): number {
    const ordinary = shape.radius * .42;
    if (!hasNorthWideShoulder(shape)) return ordinary;
    // Preserve the entire west-entry strip plus two H lattice cells. The
    // compiled triangle closure must not bleed into its physical body corridor.
    const protectedNorth = shape.entrance / 2 + .5 + 2 / 12;
    const north = shape.center.z - cell.z;
    if (shoulderTrialMode() === 'northHermite') return ordinary * (1 + smooth((north - protectedNorth) / .5));
    // Leave the flat plane plus a conservative H-cell diagonal unchanged.
    // Extending immediately outside the continuous ellipse would otherwise
    // alter interpolated floors just inside that plane's edge.
    const beyondPlane = Math.hypot(cell.x - shape.center.x, (cell.z - shape.center.z) / .8) - shape.flatRadius!;
    return ordinary * (1 + smooth((north - protectedNorth) / .5) * smooth((beyondPlane - .2) / .8));
}
export const maximumShoulderWidth = (shape: PlaceShape) => shape.radius * .42 * (hasNorthWideShoulder(shape) ? 2 : 1);

/** Separate candidate: keep the old profile through the protected .2 margin,
 * then use one C1 cubic tail. Its endpoint slope is zero. Unlike d / w(d),
 * this tail cannot regain slope after an artificial mid-shoulder flattening. */
export function shoulderOutline(shape: PlaceShape, cell: Cell): number {
    const distance = Math.hypot(cell.x - shape.center.x, (cell.z - shape.center.z) / .8) - shape.flatRadius!;
    const ordinary = shape.radius * .42, outer = shoulderWidth(shape, cell);
    if (shoulderTrialMode() !== 'northHermite' || !hasNorthWideShoulder(shape) || outer === ordinary)
        return 1 - smooth(distance / outer);
    if (distance <= .2) return 1 - smooth(distance / ordinary);
    const margin = .2, u = margin / ordinary, start = 1 - smooth(u);
    const derivative = -6 * u * (1 - u) / ordinary;
    const length = outer - margin, t = (distance - margin) / length;
    if (t >= 1) return 0;
    const tangent = derivative * length / start;
    return Math.max(0, Math.min(1, start * ((2 * t ** 3 - 3 * t * t + 1) + tangent * (t ** 3 - 2 * t * t + t))));
}
