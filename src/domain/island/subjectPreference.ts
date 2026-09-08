import { db } from '../../db';
import { assertIslandPlan, IslandConflict, islandTables, ownedIsland } from './repository';
import type { IslandRecord } from './types';

export async function setIslandNextSubject(profileId: string, revision: number, planId: string, enabled: boolean, database = db): Promise<IslandRecord> {
    return database.transaction('rw', islandTables(database), async () => {
        const { island, profile } = await ownedIsland(database, profileId);
        const plan = await database.islandPlans.get(planId);
        if (!plan || island.pendingPlanId !== planId || plan.status !== 'active' || profile.subjectMode !== 'mix') {
            throw new IslandConflict('Subject choice no longer available');
        }
        assertIslandPlan(plan, profileId);
        const selected = island.nextSubjectChoice?.afterPlanId === planId && island.nextSubjectChoice.subject === plan.subject;
        if (selected === enabled) return island;
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        const updated: IslandRecord = { ...island, revision: island.revision + 1, updatedAt: Date.now(),
            nextSubjectChoice: enabled ? { afterPlanId: planId, subject: plan.subject } : undefined };
        await database.islands.put(updated);
        return updated;
    });
}
