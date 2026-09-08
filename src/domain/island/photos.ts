import { normalizeIslandExperienceName } from './experience';

export const ISLAND_PHOTO_LIMIT = 12;
export const ISLAND_PHOTO_ALBUM_BYTES = 24 * 1024 * 1024;
export const ISLAND_PHOTO_IMAGE_BYTES = 2 * 1024 * 1024;
export const ISLAND_PHOTO_THUMBNAIL_BYTES = 128 * 1024;
export const ISLAND_PHOTO_IMAGE_EDGE = 1600;
export const ISLAND_PHOTO_THUMBNAIL_EDGE = 320;
export const ISLAND_PHOTO_COMPOSITIONS = ['island', 'display', 'resident', 'specimen', 'work'] as const;
export type IslandPhotoComposition = typeof ISLAND_PHOTO_COMPOSITIONS[number];
export interface IslandPhotoImageMetadata { mime: 'image/png'; width: number; height: number; bytes: number; sha256: string }
export interface IslandPhotoInput {
    id: string;
    profileId: string;
    capturedAt: number;
    islandName: string;
    targetName?: string;
    targetKey?: string;
    composition: IslandPhotoComposition;
    image: IslandPhotoImageMetadata;
    thumbnail: IslandPhotoImageMetadata;
}
export interface IslandPhotoMetadata extends IslandPhotoInput { version: 1 }
export interface IslandPhotoBlobPair { image: Blob; thumbnail: Blob }
export interface IslandPhotoBlobRecord extends IslandPhotoBlobPair { id: string; profileId: string }
export interface IslandPhotoAlbum { profileId: string; version: 1; revision: number }
export interface IslandPhotoAlbumSnapshot { album: IslandPhotoAlbum; photos: IslandPhotoMetadata[] }
export type IslandPhotoAction = { type: 'save-photo'; photo: IslandPhotoMetadata } | { type: 'delete-photo'; photoId: string };
export interface IslandPhotoReceipt { albumRevision: number; intentDigest: string; photoId: string; result: 'saved' | 'deleted' }
export interface IslandPhotoWriteResult extends IslandPhotoAlbumSnapshot { photoId: string; present: boolean; replayed: boolean }
export type IslandPhotoConflictCode = 'full' | 'quota' | 'conflict' | 'inactive' | 'invalid';
export class IslandPhotoConflict extends Error {
    constructor(public readonly code: IslandPhotoConflictCode, message: string) { super(message); this.name = 'IslandPhotoConflict'; }
}
const invalid = () => new IslandPhotoConflict('invalid', 'しゃしんの きろくを たしかめてね');
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
const profile = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const digest = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const metadataKeys = ['id', 'profileId', 'version', 'capturedAt', 'islandName', 'targetName', 'targetKey', 'composition', 'image', 'thumbnail'];

export function islandPhotoId(profileId: string, captureUuid: string): string {
    if (!profile(profileId) || typeof captureUuid !== 'string' || !uuid.test(captureUuid)) throw invalid();
    return JSON.stringify(['island-photo:v1', profileId, captureUuid]);
}
export function isIslandPhotoId(value: unknown, profileId: string): value is string {
    if (typeof value !== 'string') return false;
    try {
        const tuple: unknown = JSON.parse(value);
        return Array.isArray(tuple) && tuple.length === 3 && tuple[0] === 'island-photo:v1' && tuple[1] === profileId
            && typeof tuple[2] === 'string' && islandPhotoId(profileId, tuple[2]) === value;
    } catch { return false; }
}
export function islandPhotoReceiptId(profileId: string, albumRevision: number): string {
    if (!profile(profileId) || !integer(albumRevision)) throw invalid();
    return JSON.stringify(['island-photo:v1:operation', profileId, albumRevision]);
}
function imageMetadata(value: unknown, thumbnail: boolean): IslandPhotoImageMetadata {
    const edge = thumbnail ? ISLAND_PHOTO_THUMBNAIL_EDGE : ISLAND_PHOTO_IMAGE_EDGE;
    const bytes = thumbnail ? ISLAND_PHOTO_THUMBNAIL_BYTES : ISLAND_PHOTO_IMAGE_BYTES;
    if (!record(value) || !keys(value, ['mime', 'width', 'height', 'bytes', 'sha256']) || value.mime !== 'image/png'
        || !integer(value.width, 1, edge) || !integer(value.height, 1, edge) || !integer(value.bytes, 1, bytes) || !digest(value.sha256)) throw invalid();
    return { mime: 'image/png', width: value.width, height: value.height, bytes: value.bytes, sha256: value.sha256 };
}
/** Canonical metadata is detached and small. It never accepts a Blob, URL, layout or arbitrary additional field. */
export function normalizeIslandPhotoInput(value: unknown, profileId: string): IslandPhotoMetadata {
    if (!record(value) || !keys(value, metadataKeys) || (value.version !== undefined && value.version !== 1)
        || value.profileId !== profileId || !isIslandPhotoId(value.id, profileId) || !integer(value.capturedAt)
        || !ISLAND_PHOTO_COMPOSITIONS.some(composition => composition === value.composition)
        || (value.targetKey !== undefined && (typeof value.targetKey !== 'string' || !value.targetKey.length || value.targetKey.length > 4096
            || [...value.targetKey].some(character => character.codePointAt(0)! < 32 || character.codePointAt(0) === 127)))) throw invalid();
    let islandName: string, targetName: string | undefined;
    try {
        islandName = normalizeIslandExperienceName(value.islandName);
        if (value.targetName !== undefined) targetName = normalizeIslandExperienceName(value.targetName);
    } catch { throw invalid(); }
    const image = imageMetadata(value.image, false), thumbnail = imageMetadata(value.thumbnail, true);
    // Resizing may round one pixel, but a thumbnail may not be an upscaled or differently cropped image.
    if (thumbnail.width > image.width || thumbnail.height > image.height
        || Math.abs(thumbnail.width * image.height - thumbnail.height * image.width) > Math.max(image.width, image.height)) throw invalid();
    return { id: value.id, profileId, version: 1, capturedAt: value.capturedAt, islandName,
        ...(targetName === undefined ? {} : { targetName }), ...(value.targetKey === undefined ? {} : { targetKey: value.targetKey as string }),
        composition: value.composition as IslandPhotoComposition, image, thumbnail };
}
export function hasValidIslandPhotoMetadata(value: unknown, profileId: string): value is IslandPhotoMetadata {
    if (!record(value) || value.version !== 1) return false;
    try {
        const canonical = normalizeIslandPhotoInput(value, profileId);
        return value.islandName === canonical.islandName && value.targetName === canonical.targetName;
    } catch { return false; }
}
export function normalizeIslandPhotoAlbum(value: unknown, profileId: string): IslandPhotoAlbum {
    if (!profile(profileId)) throw invalid();
    if (value === undefined) return { profileId, version: 1, revision: 0 };
    if (!record(value) || !keys(value, ['profileId', 'version', 'revision']) || value.profileId !== profileId || value.version !== 1 || !integer(value.revision)) throw invalid();
    return { profileId, version: 1, revision: value.revision };
}
export function canonicalIslandPhotoAction(value: unknown, profileId: string): IslandPhotoAction {
    if (!record(value)) throw invalid();
    if (value.type === 'save-photo' && keys(value, ['type', 'photo'])) return { type: 'save-photo', photo: normalizeIslandPhotoInput(value.photo, profileId) };
    if (value.type === 'delete-photo' && keys(value, ['type', 'photoId']) && isIslandPhotoId(value.photoId, profileId)) return { type: 'delete-photo', photoId: value.photoId };
    throw invalid();
}
export async function islandPhotoIntentDigest(action: IslandPhotoAction): Promise<string> {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(action)));
    return [...new Uint8Array(buffer)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
export function hasValidIslandPhotoReceipt(value: unknown, profileId: string): value is IslandPhotoReceipt {
    return record(value) && keys(value, ['albumRevision', 'intentDigest', 'photoId', 'result']) && integer(value.albumRevision)
        && digest(value.intentDigest) && isIslandPhotoId(value.photoId, profileId) && (value.result === 'saved' || value.result === 'deleted');
}
/** Short transaction checks use immutable Blob descriptors, never arrayBuffer/decode/hash. */
export function hasMatchingIslandPhotoBlobs(metadata: IslandPhotoMetadata, value: unknown): value is IslandPhotoBlobRecord {
    if (!record(value) || !keys(value, ['id', 'profileId', 'image', 'thumbnail']) || value.id !== metadata.id || value.profileId !== metadata.profileId) return false;
    return (['image', 'thumbnail'] as const).every(kind => value[kind] instanceof Blob && value[kind].type === metadata[kind].mime && value[kind].size === metadata[kind].bytes);
}

interface BlobFacts { width: number; height: number; bytes: number; sha256: string }
const blobFacts = new WeakMap<Blob, Promise<BlobFacts>>();
async function inspectPng(blob: Blob): Promise<BlobFacts> {
    const previous = blobFacts.get(blob); if (previous) return previous;
    const pending = (async () => {
        const buffer = await blob.arrayBuffer(), bytes = new Uint8Array(buffer), view = new DataView(buffer);
        if (bytes.length < 45 || ![137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
            || view.getUint32(8) !== 13 || String.fromCharCode(...bytes.subarray(12, 16)) !== 'IHDR'
            || String.fromCharCode(...bytes.subarray(bytes.length - 8, bytes.length - 4)) !== 'IEND' || view.getUint32(bytes.length - 12) !== 0) throw invalid();
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        return { width: view.getUint32(16), height: view.getUint32(20), bytes: bytes.length,
            sha256: [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('') };
    })();
    blobFacts.set(blob, pending);
    try { return await pending; } catch (cause) { blobFacts.delete(blob); throw cause; }
}
/** Capture/resize calls this before taking the common writer lock. Retrying the
 * same immutable Blob pair reuses verified facts; no image work runs in IndexedDB. */
export async function validateIslandPhotoBlobs(input: IslandPhotoInput, blobs: IslandPhotoBlobPair): Promise<void> {
    if (!record(input) || typeof input.profileId !== 'string') throw invalid();
    const metadata = normalizeIslandPhotoInput(input, input.profileId);
    if (!record(blobs) || !keys(blobs, ['image', 'thumbnail'])) throw invalid();
    if (!hasMatchingIslandPhotoBlobs(metadata, { id: metadata.id, profileId: metadata.profileId, ...blobs })) throw invalid();
    const facts = await Promise.all([inspectPng(blobs.image), inspectPng(blobs.thumbnail)]);
    for (const [index, kind] of (['image', 'thumbnail'] as const).entries()) {
        const actual = facts[index], expected = metadata[kind];
        if (actual.width !== expected.width || actual.height !== expected.height || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) throw invalid();
    }
}

/** Album thumbnails verify only the thumbnail bytes; full image facts stay lazy. */
export async function validateIslandPhotoThumbnail(input: IslandPhotoInput, thumbnail: Blob): Promise<void> {
    if (!record(input) || typeof input.profileId !== 'string') throw invalid();
    const metadata = normalizeIslandPhotoInput(input, input.profileId), expected = metadata.thumbnail;
    if (!(thumbnail instanceof Blob) || thumbnail.type !== expected.mime || thumbnail.size !== expected.bytes) throw invalid();
    const actual = await inspectPng(thumbnail);
    if (actual.width !== expected.width || actual.height !== expected.height || actual.bytes !== expected.bytes || actual.sha256 !== expected.sha256) throw invalid();
}
