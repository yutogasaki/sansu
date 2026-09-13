import { expect, it } from 'vitest';
import * as T from 'three';
import { coastDistanceField } from './canopyShoreStudy';

function sample(field: ReturnType<typeof coastDistanceField>, x: number, z: number) {
    const { width, height, data } = field.texture.image;
    const ix = Math.max(0, Math.min(width - 1, Math.floor((x - field.min.x) / field.span.x * width)));
    const iz = Math.max(0, Math.min(height - 1, Math.floor((z - field.min.y) / field.span.y * height)));
    return Number(data[iz * width + ix]) / 255 * 4;
}
it('measures the coast edge including translation, corners and the far-sea clamp', () => {
    const points = [[-2,-2],[2,-2],[2,2],[-2,2],[-2,-2]].map(([x,y]) => new T.Vector2(x,y));
    const before = points.map(p => p.toArray()), field = coastDistanceField(points, 1.5);
    try {
        expect(sample(field, 0, 1.5)).toBe(0);
        expect(Math.abs(sample(field, 3, 1.5) - 1)).toBeLessThan(.1);
        expect(Math.abs(sample(field, 3, 4.5) - Math.SQRT2)).toBeLessThan(.1);
        expect(sample(field, 100, 100)).toBe(4);
        expect(points.map(p => p.toArray())).toEqual(before);
        expect(field.texture.image.data.byteLength).toBe(128 * 128);
    } finally { field.texture.dispose(); }
});
it('keeps an inlet outside land instead of filling the polygon bounding rectangle', () => {
    const points = [[-3,-3],[3,-3],[3,3],[1,3],[1,-1],[-1,-1],[-1,3],[-3,3]].map(([x,y]) => new T.Vector2(x,y));
    const field = coastDistanceField(points, 0);
    try {
        expect(Math.abs(sample(field, 0, 1) - 1)).toBeLessThan(.1);
        expect(sample(field, 2, 1)).toBe(0);
    } finally { field.texture.dispose(); }
});
