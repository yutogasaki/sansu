import { db, type SansuDatabase } from '../../db';
import { growingDb, type GrowingIslandDatabase } from '../../domain/growingIsland/repository';
import { profileStorage } from '../../utils/storage';
import type { AppData } from '../../domain/types';
import { preparePlacePreview, type PlaceCase } from './pack';

interface Databases { app: SansuDatabase; growing: GrowingIslandDatabase }
const defaults = { app: db, growing: growingDb };
const requirePreview = (development: boolean, database: GrowingIslandDatabase) => {
    if (!development || !database.name.startsWith('SansuGrowingIslandPreview')) throw new Error('開発用 Preview DB でのみ使えます。');
};
async function appSnapshot(app: SansuDatabase): Promise<AppData> {
    const current = await app.appData.get('app');
    if (current) return { schemaVersion: current.schemaVersion, activeProfileId: current.activeProfileId, profiles: current.profiles };
    const profiles = Object.fromEntries((await app.profiles.toArray()).map(profile => [profile.id, profile]));
    const mirror = profileStorage.getActiveId();
    return { schemaVersion: 1, activeProfileId: mirror && profiles[mirror] ? mirror : null, profiles };
}
export async function readPlaceSelection(databases: Databases = defaults) {
    return (await appSnapshot(databases.app)).activeProfileId;
}
/** This dedicated DEV file-upload button can only add a new diagnostic owner. */
export async function createPlacePreview(entry: PlaceCase, development = import.meta.env.DEV, databases: Databases = defaults, now = Date.now()) {
    requirePreview(development, databases.growing);
    const id = `qa-place-preview-${crypto.randomUUID()}`, { profile, island } = preparePlacePreview(entry, id, now);
    await databases.growing.islands.add(island);
    try {
        await databases.app.transaction('rw', [databases.app.profiles, databases.app.appData], async () => {
            const current = await appSnapshot(databases.app);
            if (current.profiles[id]) throw new Error('診断 ID が重複しました。');
            await databases.app.profiles.add(profile);
            await databases.app.appData.put({ id: 'app', ...current, profiles: { ...current.profiles, [id]: profile }, activeProfileId: id });
        });
    } catch (error) { await databases.growing.islands.delete(id); throw error; }
    profileStorage.setActiveId(id);
    return id;
}
export async function restorePlaceSelection(id: string | null, development = import.meta.env.DEV, databases: Databases = defaults) {
    requirePreview(development, databases.growing);
    await databases.app.transaction('rw', [databases.app.profiles, databases.app.appData], async () => {
        const current = await appSnapshot(databases.app);
        if (id && !current.profiles[id]) throw new Error('元のプロフィールが見つかりません。');
        await databases.app.appData.put({ id: 'app', ...current, activeProfileId: id });
    });
    if (id) profileStorage.setActiveId(id); else profileStorage.clearActiveId();
}
/** Native reads only. No sync, migration, growth or receipt write is triggered. */
export async function readPlacePreview(id: string, databases: Databases = defaults) {
    if (!/^qa-place-preview-[a-z0-9-]+$/.test(id)) throw new Error('診断プロフィールを選んでください。');
    const [app, record, profile, logs, memoryMath, memoryVocab, islandPlans, islandEvents] = await Promise.all([
        appSnapshot(databases.app), databases.growing.islands.get(id), databases.app.profiles.get(id),
        databases.app.logs.where('profileId').equals(id).toArray(), databases.app.memoryMath.where('profileId').equals(id).toArray(),
        databases.app.memoryVocab.where('profileId').equals(id).toArray(), databases.app.islandPlans.where('profileId').equals(id).toArray(),
        databases.app.islandEvents.where('profileId').equals(id).toArray(),
    ]);
    return { synthetic: true, database: databases.growing.name, table: databases.growing.islands.name, activeProfileId: app.activeProfileId,
        profile, record, logs, memoryMath, memoryVocab, islandPlans, islandEvents };
}
