import { readableLifeVersion } from './model';
import { lifeDb, type IslandLifeDatabase } from './repository';
import { appendPresentedScene, emptyDiscoveryJournal, qualifiesAsPresented, saveDiscoveryMemory, sceneDigest,
    unpinDiscoveryMemory, type DiscoveryScene, type PresentationEvidence } from './discoveryJournal';

/** Async hash work finishes before opening the IndexedDB transaction. A delayed
 * save cannot recreate an owner deleted while that work was in flight. */
export async function recordPresentedScene(profileId: string, input: DiscoveryScene, inputEvidence: PresentationEvidence, database: IslandLifeDatabase = lifeDb) {
    const event = structuredClone(input), evidence = structuredClone(inputEvidence);
    if (event.profileId !== profileId) throw new Error('この場面の持ち主が違います。');
    if (!qualifiesAsPresented(event, evidence)) return undefined;
    if (event.snapshot.contentVersion !== 1 || await sceneDigest(event.snapshot.scene) !== event.snapshot.immutableHash) throw new Error('場面の内容を確認できません。');
    return database.transaction('rw', database.worlds, async () => {
        const world = await database.worlds.get(profileId);
        if (!world || !readableLifeVersion(world.version)) throw new Error('この島が みつからないよ。');
        const previous = world.discoveryJournal ?? emptyDiscoveryJournal();
        const next = appendPresentedScene(previous, event, evidence);
        if (next !== previous) await database.worlds.put({ ...world, discoveryJournal: next });
        return next;
    });
}

export async function editDiscoveryMemory(profileId: string, eventId: string, action: 'save' | 'unpin', revision: number, database: IslandLifeDatabase = lifeDb) {
    return database.transaction('rw', database.worlds, async () => {
        const world = await database.worlds.get(profileId);
        if (!world || !readableLifeVersion(world.version)) throw new Error('この島が みつからないよ。');
        const previous = world.discoveryJournal ?? emptyDiscoveryJournal();
        if (previous.version !== 1) throw new Error('この記録は 新しい版でひらいてね。');
        const isSaved = previous.savedIds.includes(eventId);
        if (action === 'save' && isSaved || action === 'unpin' && !isSaved) return previous;
        if (previous.revision !== revision) throw new Error('きろくが かわったよ。もういちど えらんでね。');
        const next = action === 'save' ? saveDiscoveryMemory(previous, eventId) : unpinDiscoveryMemory(previous, eventId);
        await database.worlds.put({ ...world, discoveryJournal: next }); return next;
    });
}
