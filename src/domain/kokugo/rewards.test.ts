import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { newIsland } from '../growingIsland/island';
import { GrowingIslandDatabase, deleteGrowingOwner, sailGrowingIsland } from '../growingIsland/repository';
import { drainKokugoRewards, receiveKokugoCompletion } from '../growingIsland/kokugoReceipts';
import { chooseKokugo, presentKokugo, reserveKokugo, pendingKokugoCompletions } from './repository';
import { actKokugo } from './actions';
const databases: (SansuDatabase | GrowingIslandDatabase)[] = [];
const T = Date.UTC(2026, 9, 25);
async function setup() {
    const source = new SansuDatabase(`kokugo-source-${crypto.randomUUID()}`), island = new GrowingIslandDatabase(`kokugo-island-${crypto.randomUUID()}`);
    databases.push(source, island);
    const child = { ...createInitialProfile('kid', 2, 1, 1, 'math'), id: 'kid' };
    await source.profiles.put(child); await source.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'kid', profiles: { kid: child } });
    const state = newIsland('kid', T); state.drops = 10; state.town.bank = 0;
    await island.islands.put({ profileId: 'kid', version: 5, revision: 3, createdAt: T, updatedAt: T, state });
    await chooseKokugo('kid', 'R01', 2, true, source);
    let plan = await reserveKokugo('kid', 'R01', source, T);
    plan = await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'intro' }, source, T + 1);
    plan = await presentKokugo('kid', plan.id, source, T + 2);
    await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'answer', answer: plan.slots[0].item.answer }, source, T + 3);
    const proof = (await source.kokugoOutbox.toArray())[0];
    return { source, island, proof };
}
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(databases.splice(0).map(database => database.delete())); });
describe('Kokugo verified reward integration', () => {
    it('delivers a real saved completion exactly once under concurrent retries and restart', async () => {
        const { source, island, proof } = await setup();
        const results = await Promise.all([receiveKokugoCompletion(proof, island, source), receiveKokugoCompletion(proof, island, source)]);
        expect(results.filter(row => row.credited)).toHaveLength(1);
        expect((await island.islands.get('kid'))?.state).toMatchObject({ drops: 12, town: { bank: 2 } });
        island.close(); await island.open();
        expect((await drainKokugoRewards('kid', island, source)).credited).toBe(0);
        expect(await pendingKokugoCompletions('kid', source)).toHaveLength(0);
        expect(await island.foundationReceipts.count()).toBe(1);
    });
    it('rolls back both the wallet and receipt, retaining the outbox for retry', async () => {
        const { source, island } = await setup();
        vi.spyOn(island.islands, 'put').mockRejectedValueOnce(new Error('disk-full'));
        await expect(drainKokugoRewards('kid', island, source)).rejects.toThrow('disk-full');
        expect(await island.foundationReceipts.count()).toBe(0);
        expect((await island.islands.get('kid'))?.state.drops).toBe(10);
        expect(await pendingKokugoCompletions('kid', source)).toHaveLength(1);
        expect((await drainKokugoRewards('kid', island, source)).credited).toBe(1);
    });
    it('handles acknowledgement failure without paying twice', async () => {
        const { source, island } = await setup();
        vi.spyOn(source.kokugoOutbox, 'update').mockRejectedValueOnce(new Error('ack-fault'));
        expect(await drainKokugoRewards('kid', island, source)).toMatchObject({ credited: 1, retryPending: true });
        expect(await drainKokugoRewards('kid', island, source)).toMatchObject({ credited: 0, retryPending: false });
        expect((await island.islands.get('kid'))?.state.drops).toBe(12);
    });
    it('rejects forged, changed, deleted and deleting sources without changing the island', async () => {
        const { source, island, proof } = await setup();
        await expect(receiveKokugoCompletion({ ...proof, completedAt: proof.completedAt + 1 }, island, source)).rejects.toThrow();
        await source.foundationOwners.put({ profileId: 'kid', status: 'deleting', updatedAt: T });
        await expect(receiveKokugoCompletion(proof, island, source)).rejects.toThrow();
        await source.foundationOwners.delete('kid');
        await source.kokugoPlans.delete(proof.planId);
        await expect(receiveKokugoCompletion(proof, island, source)).rejects.toThrow();
        expect((await island.islands.get('kid'))?.state.drops).toBe(10);
    });
    it('shares a permanent ledger across island changes and fences a deleted growing owner', async () => {
        const { source, island, proof } = await setup();
        await Promise.all([receiveKokugoCompletion(proof, island, source), sailGrowingIsland('kid', 'main', { id: 'next', create: { name: 'つぎ', start: 'garden' } }, T + 10, island)]);
        const receipt = await island.foundationReceipts.get(['kid', proof.completionId]);
        expect(['main', 'next']).toContain(receipt?.islandId);
        expect((await receiveKokugoCompletion(proof, island, source)).credited).toBe(false);
        expect((await island.islands.get('kid'))?.state.drops).toBe(12);
        await deleteGrowingOwner('kid', island);
        await expect(receiveKokugoCompletion(proof, island, source)).rejects.toThrow();
    });
});
