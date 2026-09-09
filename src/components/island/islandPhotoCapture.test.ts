import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { islandPhotoDimensions, islandPhotoResizeCandidates, prepareIslandPhoto } from './islandPhotoCapture';

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

/** Native image/canvas substitutes; preparation, cancellation and SHA remain real. */
function photoEncoder(encode: (width: number, height: number, index: number) => Blob,
    dimensions = { width: 900, height: 600 }) {
    const images: FrameImage[] = [];
    class FrameImage {
        src = '';
        naturalWidth = dimensions.width;
        naturalHeight = dimensions.height;
        decode = vi.fn(async () => {});
        constructor() { images.push(this); }
    }
    const calls: { width: number; height: number; blob: Blob }[] = [];
    const drawImage = vi.fn();
    const canvas = {
        width: 0, height: 0,
        getContext: () => ({ drawImage }),
        toBlob(callback: BlobCallback, type: string) {
            expect(type).toBe('image/png');
            const blob = encode(this.width, this.height, calls.length);
            calls.push({ width: this.width, height: this.height, blob });
            callback(blob);
        },
    };
    vi.stubGlobal('Image', FrameImage);
    vi.stubGlobal('document', { createElement: (tag: string) => { expect(tag).toBe('canvas'); return canvas; } });
    return { canvas, images, calls, drawImage };
}
const png = (bytes: number, value = 1) => new Blob([new Uint8Array(bytes).fill(value)], { type: 'image/png' });
const frame = 'data:image/png;base64,c2FtZS1zaHV0dGVy';
const blobHash = async (blob: Blob) => createHash('sha256').update(new Uint8Array(await blob.arrayBuffer())).digest('hex');

describe('actual frame photo preparation', () => {
    afterEach(() => vi.unstubAllGlobals());

    it.each([256, 192, 160])('falls back to %ipx without replacing the original PNG', async edge => {
        const original = png(4096, 7), thumbnail = png(8192, 9);
        const native = photoEncoder((width, _height, index) => index === 0 ? original : width === edge ? thumbnail : png(128 * 1024 + 1));
        const result = await prepareIslandPhoto(frame);
        const expectedEdges = [900, ...[320, 256, 192, 160].filter(value => value >= edge)];
        expect(native.calls.map(call => call.width)).toEqual(expectedEdges);
        expect(result.blobs.image).toBe(original);
        expect(result.blobs.thumbnail).toBe(thumbnail);
        expect(result.image).toEqual({ mime: 'image/png', width: 900, height: 600, bytes: original.size, sha256: await blobHash(original) });
        expect(result.thumbnail).toEqual({ mime: 'image/png', width: edge, height: Math.round(600 * edge / 900), bytes: thumbnail.size, sha256: await blobHash(thumbnail) });
        for (const [index, call] of native.calls.entries()) {
            expect(native.drawImage.mock.calls[index]).toEqual([native.images[0], 0, 0, call.width, call.height]);
        }
        expect(native.images).toHaveLength(1);
        expect(native.images[0].decode).toHaveBeenCalledTimes(1);
        expect(native.images[0].src).toBe('');
        expect([native.canvas.width, native.canvas.height]).toEqual([1, 1]);
    });

    it('keeps 320px when its PNG is within the existing byte limit', async () => {
        const thumbnail = png(128 * 1024);
        const native = photoEncoder((_width, _height, index) => index === 0 ? png(4096) : thumbnail);
        const result = await prepareIslandPhoto(frame);
        expect(native.calls.map(call => call.width)).toEqual([900, 320]);
        expect(result.blobs.thumbnail).toBe(thumbnail);
        expect(result.thumbnail).toMatchObject({ width: 320, height: 213, bytes: 128 * 1024 });
    });

    it('rejects all oversized candidates and releases the temporary frame', async () => {
        const native = photoEncoder((_width, _height, index) => png(index === 0 ? 4096 : 128 * 1024 + 1));
        await expect(prepareIslandPhoto(frame)).rejects.toThrow('Photo thumbnail is too large');
        expect(native.calls.map(call => call.width)).toEqual([900, 320, 256, 192, 160]);
        expect(native.images[0].src).toBe('');
        expect([native.canvas.width, native.canvas.height]).toEqual([1, 1]);
    });

    it('does not return an encoded fallback after the view or owner is cancelled', async () => {
        let current = true;
        const native = photoEncoder((_width, _height, index) => {
            if (index === 2) current = false;
            return png(index === 1 ? 128 * 1024 + 1 : 4096);
        });
        await expect(prepareIslandPhoto(frame, () => current)).rejects.toMatchObject({ name: 'AbortError' });
        expect(native.calls.map(call => call.width)).toEqual([900, 320, 256]);
        expect(native.images[0].src).toBe('');
        expect([native.canvas.width, native.canvas.height]).toEqual([1, 1]);
    });

    it('neither upscales a small frame nor retries duplicate thumbnail dimensions', async () => {
        const native = photoEncoder((_width, _height, index) => png(index === 0 ? 4096 : 128 * 1024 + 1), { width: 100, height: 80 });
        await expect(prepareIslandPhoto(frame)).rejects.toThrow('Photo thumbnail is too large');
        expect(native.calls.map(call => [call.width, call.height])).toEqual([[100, 80], [100, 80]]);
    });
});
