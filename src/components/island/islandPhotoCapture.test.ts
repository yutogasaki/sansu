import { describe, expect, it } from 'vitest';
import { islandPhotoDimensions, islandPhotoResizeCandidates } from './islandPhotoCapture';

describe('actual frame photo sizing', () => {
    it('keeps portrait and landscape composition with a bounded long edge', () => {
        expect(islandPhotoDimensions(3600, 2400, 1600)).toEqual({ width: 1600, height: 1067 });
        expect(islandPhotoDimensions(2400, 3600, 1600)).toEqual({ width: 1067, height: 1600 });
    });
    it('does not upscale small actual frames or retry an identical resolution', () => {
        expect(islandPhotoResizeCandidates(390, 600)).toEqual([{ width: 390, height: 600 }]);
        expect(islandPhotoDimensions(200, 150, 320)).toEqual({ width: 200, height: 150 });
    });
    it('retains the original first when between two fallback resolutions', () => {
        expect(islandPhotoResizeCandidates(900, 600)).toEqual([{ width: 900, height: 600 }, { width: 800, height: 533 }]);
    });
    it('rejects empty and invalid frames instead of creating a placeholder photo', () => {
        for (const width of [0, -1, Infinity, NaN, .5]) expect(() => islandPhotoDimensions(width, 300, 1600)).toThrow();
    });
});
