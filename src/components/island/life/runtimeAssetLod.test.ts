import { describe, expect, it } from 'vitest';
import { OrthographicCamera, PerspectiveCamera } from 'three';
import { projectedDiameter, selectFarAsset } from './runtimeAssetLod';
describe('runtime asset screen-size LOD', () => {
    it('uses zoom, not distance, for the actual orthographic world camera', () => {
        const camera = new OrthographicCamera(-5, 5, 5, -5); camera.zoom = 2;
        expect(projectedDiameter(camera, 1, 10, 800)).toBe(160);
        expect(projectedDiameter(camera, 1, 100, 800)).toBe(160);
    });
    it('accounts for distance in perspective comparisons', () => {
        const camera = new PerspectiveCamera(60);
        expect(projectedDiameter(camera, 1, 20, 800)).toBeCloseTo(projectedDiameter(camera, 1, 10, 800) / 2);
    });
    it('does not oscillate at the switching boundary', () => {
        expect(selectFarAsset(23, false)).toBe(true);
        expect(selectFarAsset(28, true)).toBe(true);
        expect(selectFarAsset(28, false)).toBe(false);
        expect(selectFarAsset(32, true)).toBe(false);
    });
});
