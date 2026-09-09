export const DELIVERY_ROUTE = [[-1.8, 0, -2.1], [-2.65, 0, -1.5], [-2.65, 0, 1.65], [.7, 0, 1.65], [1.2, .24, .72]] as const;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
export function deliverySample(seconds: number, reduced = false) {
    const t = reduced ? 13 : Math.max(0, Number.isFinite(seconds) ? seconds : 0) % 35;
    const returning = t >= 16, progress = returning ? 1 - clamp((t - 16) / 10) : clamp(t / 10);
    const lengths = DELIVERY_ROUTE.slice(1).map((end, i) => Math.hypot(...end.map((v, axis) => v - DELIVERY_ROUTE[i][axis])));
    const total = lengths.reduce((a, b) => a + b, 0);
    let distance = progress * total, index = 0;
    while (index < lengths.length - 1 && distance > lengths[index]) distance -= lengths[index++];
    const a = DELIVERY_ROUTE[index], b = DELIVERY_ROUTE[index + 1], ratio = clamp(distance / lengths[index]);
    const position = a.map((v, axis) => v + (b[axis] - v) * ratio) as [number, number, number];
    const f = clamp((t - 10) / 2), placing = f * f * (3 - 2 * f);
    return { t, position, heading: Math.atan2(b[0] - a[0], b[2] - a[2]) + (returning ? Math.PI : 0),
        placing, carrying: t < 10, walking: t < 10 || t >= 16 && t < 26,
        phase: t < 10 ? 'delivery-carry' : t < 12 ? 'delivery-place' : t < 16 ? 'delivery-arrived' : t < 26 ? 'delivery-return' : 'delivery-rest' };
}
