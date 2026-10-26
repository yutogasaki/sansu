import { db, type SansuDatabase } from '../../db';
import { holdPwaUpdateForCriticalPersistence } from '../../pwa';
export const kokugoTables = (d: SansuDatabase) => [d.profiles, d.appData, d.foundationOwners, d.kokugoCourses,
    d.kokugoProgress, d.kokugoPlans, d.kokugoEvents, d.kokugoOutbox, d.kokugoWorks];
export async function assertKokugoOwner(profileId: string, d: SansuDatabase, requireActive = true) {
    const profile = await d.profiles.get(profileId), owner = await d.foundationOwners.get(profileId);
    if (!profile || owner?.status === 'deleting') throw new Error('プロフィールを えらびなおしてね。');
    if (requireActive) {
        const app = await d.appData.get('app');
        if (app?.activeProfileId !== profileId || !app.profiles[profileId]) throw new Error('プロフィールを えらびなおしてね。');
    }
}
export async function writeKokugo<T>(profileId: string, d: SansuDatabase, work: () => Promise<T>) {
    const release = holdPwaUpdateForCriticalPersistence();
    try { return await d.transaction('rw', kokugoTables(d), async () => { await assertKokugoOwner(profileId, d); return work(); }); }
    finally { release(); }
}
export async function prefersKokugo(d: SansuDatabase = db) {
    const app = await d.appData.get('app');
    if (!app?.activeProfileId) return false;
    return (await d.kokugoCourses.get(app.activeProfileId))?.preferred === true;
}
