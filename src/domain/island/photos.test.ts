import { describe, expect, it } from 'vitest';
import { canonicalIslandPhotoAction, hasValidIslandPhotoMetadata, islandPhotoId, islandPhotoIntentDigest, islandPhotoReceiptId,
    normalizeIslandPhotoAlbum, normalizeIslandPhotoInput, validateIslandPhotoBlobs, type IslandPhotoInput } from './photos';
import { photoInput, photoPng } from './photos.testSupport';

describe('strict small photo metadata and immutable image facts', () => {
    it('defaults only absent albums and gives each owner a canonical capture and operation namespace', () => {
        expect(normalizeIslandPhotoAlbum(undefined, 'child')).toEqual({ profileId: 'child', version: 1, revision: 0 });
        for (const value of [null, {}, { profileId: 'child', version: 2, revision: 0 }, { profileId: 'other', version: 1, revision: 1 }, { profileId: 'child', version: 1, revision: 0, future: true }]) {
            expect(() => normalizeIslandPhotoAlbum(value, 'child')).toThrow();
        }
        const uuid = crypto.randomUUID();
        expect(JSON.parse(islandPhotoId('child', uuid))).toEqual(['island-photo:v1', 'child', uuid]);
        expect(islandPhotoId('child', uuid)).not.toEqual(islandPhotoId('other', uuid));
        expect(JSON.parse(islandPhotoReceiptId('child', 2))).toEqual(['island-photo:v1:operation', 'child', 2]);
        expect(() => islandPhotoReceiptId('child', -1)).toThrow();
    });
    it('binds canonical names, actual image digests and metadata to intent regardless of input field order', async () => {
        const { input, blobs } = await photoInput();
        const photo = normalizeIslandPhotoInput({ ...input, islandName: ' か\u3099らす ' }, 'child');
        expect(photo.islandName).toBe('がらす'); expect(hasValidIslandPhotoMetadata(photo, 'child')).toBe(true);
        const a = canonicalIslandPhotoAction({ type: 'save-photo', photo }, 'child');
        const b = canonicalIslandPhotoAction({ photo: { ...input, islandName: 'がらす' }, type: 'save-photo' }, 'child');
        expect(await islandPhotoIntentDigest(a)).toEqual(await islandPhotoIntentDigest(b));
        await expect(validateIslandPhotoBlobs(input, blobs)).resolves.toBeUndefined();
        input.image.width = 2;
        await expect(validateIslandPhotoBlobs(input, blobs)).rejects.toMatchObject({ code: 'invalid' });
    });
    it('rejects unknown fields, foreign ownership, invalid dimensions, oversized bytes and non-PNG or wrong digest bytes', async () => {
        const { input, blobs } = await photoInput();
        const invalids = [{ ...input, url: 'data:image/png;base64,x' }, { ...input, layout: {} }, { ...input, profileId: 'other' },
            { ...input, image: { ...input.image, width: 1601 } }, { ...input, thumbnail: { ...input.thumbnail, width: 321 } },
            { ...input, image: { ...input.image, bytes: 2097153 } }, { ...input, targetName: 'a\n' }, { ...input, version: 2 }];
        for (const value of invalids) expect(() => normalizeIslandPhotoInput(value, 'child')).toThrow();
        await expect(validateIslandPhotoBlobs({ ...input, image: { ...input.image, sha256: '0'.repeat(64) } }, blobs)).rejects.toMatchObject({ code: 'invalid' });
        const broken = new Uint8Array(await blobs.image.arrayBuffer()); broken[0] = 0;
        await expect(validateIslandPhotoBlobs(input, { ...blobs, image: new Blob([broken], { type: 'image/png' }) })).rejects.toMatchObject({ code: 'invalid' });
        await expect(validateIslandPhotoBlobs(input, { ...blobs, image: new Blob([broken]) })).rejects.toMatchObject({ code: 'invalid' });
        await expect(validateIslandPhotoBlobs(null as unknown as IslandPhotoInput, blobs)).rejects.toMatchObject({ code: 'invalid' });
        expect(photoPng(200).size).toBe(200);
    });
});
