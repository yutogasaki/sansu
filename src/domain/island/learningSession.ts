import { foundationTables } from '../englishFoundation/repository';
import { resolveIslandLearningEntry, type IslandLearningEntry } from './learningEntry';
import { db } from '../../db';
import { commitIslandLearning } from './commit';
import { IslandConflict, islandTables, ownedIsland } from './repository';
import type { IslandLearningAction, IslandPlan, IslandRecord } from './types';

export interface IslandLearningSessionResult {
    receipt: Awaited<ReturnType<typeof commitIslandLearning>>;
    nextPlan?: IslandPlan;
    nextEntry?: IslandLearningEntry;
    latestIsland?: IslandRecord;
    /** The answer is saved; only opening its next section needs a retry. */
    nextPlanError?: true;
}

export function isFirstIslandPlan(plan: Pick<IslandPlan, 'id' | 'profileId'>) {
    return plan.id === JSON.stringify(['island-plan-v1', plan.profileId, 0]);
}

/** The caller keeps one input lock/PWA hold across both transactions. The
 * existing answer receipt stays committed if the separate reservation fails. */
export async function commitIslandLearningSession(profileId: string, planId: string, revision: number,
    action: IslandLearningAction, database = db, observation?: unknown): Promise<IslandLearningSessionResult> {
    const receipt = await commitIslandLearning(profileId, planId, revision, action, database, observation);
    // A replay returns the current plan/island, not the original snapshots.
    // Only this plan's final revision can continue, and an old first receipt
    // remains introductory even after other sections have been completed.
    if (receipt.plan.status !== 'completed' || receipt.plan.revision !== revision + 1
        || isFirstIslandPlan(receipt.plan) && !receipt.plan.growthTarget) return { receipt };
    try {
        const next = await database.transaction('rw', [...islandTables(database), ...foundationTables(database)], async () => {
            // startIslandPlan joins this second transaction and prefers the
            // actual pending reservation, including another tab's progress.
            const nextEntry = await resolveIslandLearningEntry(profileId, database);
            if (nextEntry.kind !== 'island') return { nextEntry };
            const nextPlan = nextEntry.plan;
            const { island: latestIsland } = await ownedIsland(database, profileId);
            if (latestIsland.pendingPlanId !== nextPlan.id) throw new IslandConflict('Pending plan changed');
            return { nextPlan, latestIsland };
        });
        return { receipt, ...next };
    } catch {
        return { receipt, nextPlanError: true };
    }
}
