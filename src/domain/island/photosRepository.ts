import { db, type SansuDatabase } from '../../db';
import { canonicalIslandPhotoAction, hasMatchingIslandPhotoBlobs, hasValidIslandPhotoMetadata, hasValidIslandPhotoReceipt,
    ISLAND_PHOTO_ALBUM_BYTES, ISLAND_PHOTO_LIMIT, IslandPhotoConflict, islandPhotoIntentDigest, islandPhotoReceiptId,
    normalizeIslandPhotoAlbum, normalizeIslandPhotoInput, validateIslandPhotoBlobs, validateIslandPhotoThumbnail,
    type IslandPhotoAction, type IslandPhotoAlbumSnapshot, type IslandPhotoBlobPair, type IslandPhotoInput, type IslandPhotoWriteResult } from './photos';

const invalid = () => new IslandPhotoConflict('invalid', 'しゃしんの きろくを たしかめてね');
const conflict = () => new IslandPhotoConflict('conflict', 'アルバムが かわったよ。もういちど ひらいてね');
/** Photos have their own small transaction boundary; never add these stores to learning/island writers. */
export const islandPhotoTables = (database: SansuDatabase) => [database.appData, database.islandPhotoAlbums,
    database.islandPhotos, database.islandPhotoBlobs, database.islandEvents];
async function assertOwner(database: SansuDatabase, profileId: string) {
    const app = await database.appData.get('app');
    if (!app || app.activeProfileId !== profileId || !Object.prototype.hasOwnProperty.call(app.profiles ?? {}, profileId) || app.profiles[profileId]?.id !== profileId) {
        throw new IslandPhotoConflict('inactive', 'この しゃしんの なかまに もどってね');
    }
}
const photoBytes = (snapshot: IslandPhotoAlbumSnapshot) => snapshot.photos.reduce((sum, photo) => sum + photo.image.bytes + photo.thumbnail.bytes, 0);
async function readSnapshot(database: SansuDatabase, profileId: string): Promise<IslandPhotoAlbumSnapshot> {
    const stored = await database.islandPhotoAlbums.get(profileId);
    const album = normalizeIslandPhotoAlbum(stored, profileId);
    const photos = await database.islandPhotos.where('profileId').equals(profileId).toArray();
    if (photos.some(photo => !hasValidIslandPhotoMetadata(photo, profileId)) || (!stored && photos.length)
        || photos.length > ISLAND_PHOTO_LIMIT) throw invalid();
    const snapshot = { album, photos: photos.sort((a, b) => b.capturedAt - a.capturedAt || a.id.localeCompare(b.id)) };
    if (photoBytes(snapshot) > ISLAND_PHOTO_ALBUM_BYTES) throw invalid();
    return snapshot;
}
async function assertPairs(database: SansuDatabase, profileId: string, snapshot: IslandPhotoAlbumSnapshot) {
    const blobs = await database.islandPhotoBlobs.where('profileId').equals(profileId).toArray();
    if (blobs.length !== snapshot.photos.length) throw invalid();
    const byId = new Map(blobs.map(blob => [blob.id, blob]));
    if (snapshot.photos.some(photo => !hasMatchingIslandPhotoBlobs(photo, byId.get(photo.id)))) throw invalid();
}
export async function readIslandPhotoAlbum(profileId: string, database = db): Promise<IslandPhotoAlbumSnapshot> {
    return database.transaction('r', [database.appData, database.islandPhotoAlbums, database.islandPhotos], async () => {
        await assertOwner(database, profileId);
        return readSnapshot(database, profileId);
    });
}
async function loadPhotoPair(profileId: string, photoId: string, database: SansuDatabase) {
    canonicalIslandPhotoAction({ type: 'delete-photo', photoId }, profileId);
    return database.transaction('r', [database.appData, database.islandPhotoAlbums, database.islandPhotos, database.islandPhotoBlobs], async () => {
        await assertOwner(database, profileId);
        const snapshot = await readSnapshot(database, profileId);
        const photo = snapshot.photos.find(entry => entry.id === photoId), blob = await database.islandPhotoBlobs.get(photoId);
        if (!photo && !blob) return undefined;
        if (!photo || !hasMatchingIslandPhotoBlobs(photo, blob)) throw invalid();
        return { photo, blobs: { image: blob.image, thumbnail: blob.thumbnail } };
    });
}
export async function loadIslandPhotoThumbnail(profileId: string, photoId: string, database = db): Promise<Blob | undefined> {
    const loaded = await loadPhotoPair(profileId, photoId, database);
    if (!loaded) return undefined;
    await validateIslandPhotoThumbnail(loaded.photo, loaded.blobs.thumbnail);
    return loaded.blobs.thumbnail;
}
export async function loadIslandPhotoBlobs(profileId: string, photoId: string, database = db): Promise<IslandPhotoBlobPair | undefined> {
    const loaded = await loadPhotoPair(profileId, photoId, database);
    if (!loaded) return undefined;
    // Digest and PNG inspection must stay outside the IndexedDB transaction.
    await validateIslandPhotoBlobs(loaded.photo, loaded.blobs);
    return loaded.blobs;
}
function quotaFailure(cause: unknown): boolean {
    const seen = new Set<unknown>();
    while (cause && typeof cause === 'object' && !seen.has(cause)) {
        seen.add(cause);
        if ('name' in cause && cause.name === 'QuotaExceededError') return true;
        cause = 'inner' in cause ? cause.inner : 'cause' in cause ? cause.cause : undefined;
    }
    return false;
}
async function write(profileId: string, expectedAlbumRevision: number, action: IslandPhotoAction,
    blobs: IslandPhotoBlobPair | undefined, database: SansuDatabase): Promise<IslandPhotoWriteResult> {
    const id = islandPhotoReceiptId(profileId, expectedAlbumRevision), intent = canonicalIslandPhotoAction(action, profileId);
    const intentDigest = await islandPhotoIntentDigest(intent);
    const photoId = intent.type === 'save-photo' ? intent.photo.id : intent.photoId;
    try {
        return await database.transaction('rw', islandPhotoTables(database), async () => {
            // Ownership precedes receipts: a deleted or inactive profile cannot replay a historical success.
            await assertOwner(database, profileId);
            const snapshot = await readSnapshot(database, profileId);
            await assertPairs(database, profileId, snapshot);
            const prior = await database.islandEvents.get(id);
            if (prior) {
                if (prior.type !== 'photo_changed' || prior.profileId !== profileId || !hasValidIslandPhotoReceipt(prior.photoReceipt, profileId)
                    || prior.photoReceipt.albumRevision !== expectedAlbumRevision || prior.photoReceipt.intentDigest !== intentDigest
                    || prior.photoReceipt.photoId !== photoId || prior.photoReceipt.result !== (intent.type === 'save-photo' ? 'saved' : 'deleted')
                    || JSON.stringify(canonicalIslandPhotoAction(prior.action, profileId)) !== JSON.stringify(intent)
                    || snapshot.album.revision <= expectedAlbumRevision) throw conflict();
                return { ...snapshot, photoId, present: snapshot.photos.some(photo => photo.id === photoId), replayed: true };
            }
            if (snapshot.album.revision !== expectedAlbumRevision) throw conflict();
            if (snapshot.album.revision === Number.MAX_SAFE_INTEGER) throw invalid();
            if (intent.type === 'save-photo') {
                if (!blobs || !hasMatchingIslandPhotoBlobs(intent.photo, { id: photoId, profileId, ...blobs })) throw invalid();
                // Global IDs must not overwrite an orphan or a foreign-owner row.
                if (await database.islandPhotos.get(photoId) || await database.islandPhotoBlobs.get(photoId)) throw conflict();
                if (snapshot.photos.length >= ISLAND_PHOTO_LIMIT || photoBytes(snapshot) + intent.photo.image.bytes + intent.photo.thumbnail.bytes > ISLAND_PHOTO_ALBUM_BYTES) {
                    throw new IslandPhotoConflict('full', 'アルバムが いっぱいだよ');
                }
                await database.islandPhotos.add(intent.photo);
                await database.islandPhotoBlobs.add({ id: photoId, profileId, image: blobs.image, thumbnail: blobs.thumbnail });
            } else {
                if (!snapshot.photos.some(photo => photo.id === photoId)) throw conflict();
                await database.islandPhotos.delete(photoId);
                await database.islandPhotoBlobs.delete(photoId);
            }
            await database.islandPhotoAlbums.put({ ...snapshot.album, revision: snapshot.album.revision + 1 });
            await database.islandEvents.add({ id, profileId, type: 'photo_changed', timestamp: Date.now(), action: intent,
                photoReceipt: { albumRevision: expectedAlbumRevision, intentDigest, photoId, result: intent.type === 'save-photo' ? 'saved' : 'deleted' } });
            return { ...await readSnapshot(database, profileId), photoId, present: intent.type === 'save-photo', replayed: false };
        });
    } catch (cause) {
        if (quotaFailure(cause)) throw new IslandPhotoConflict('quota', 'ほぞんする ばしょが いっぱいみたい');
        throw cause;
    }
}
export async function saveIslandPhoto(profileId: string, expectedAlbumRevision: number, input: IslandPhotoInput,
    blobs: IslandPhotoBlobPair, database = db): Promise<IslandPhotoWriteResult> {
    const photo = normalizeIslandPhotoInput(input, profileId);
    // Freeze references synchronously. The exact immutable pair and metadata bind every retry.
    const pair = { image: blobs?.image, thumbnail: blobs?.thumbnail };
    await validateIslandPhotoBlobs(photo, pair);
    return write(profileId, expectedAlbumRevision, { type: 'save-photo', photo }, pair, database);
}
export async function deleteIslandPhoto(profileId: string, expectedAlbumRevision: number, photoId: string, database = db): Promise<IslandPhotoWriteResult> {
    return write(profileId, expectedAlbumRevision, { type: 'delete-photo', photoId }, undefined, database);
}
