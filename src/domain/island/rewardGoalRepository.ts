import { db } from '../../db';
import { canonicalIslandRewardGoalAction, reduceIslandRewardGoal, type IslandRewardGoalAction } from './rewardGoal';
import { assertIsland, IslandConflict, islandTables, ownedIsland } from './repository';
import type { IslandRecord } from './types';

export async function saveIslandRewardGoal(profileId: string, revision: number, action: IslandRewardGoalAction, database = db): Promise<IslandRecord> {
    const intent = canonicalIslandRewardGoalAction(action);
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-reward-goal-v1', profileId, revision]), prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'reward_goal_changed' || prior.profileId !== profileId
                || JSON.stringify(prior.action) !== JSON.stringify(intent)) throw new IslandConflict('Reward goal changed');
            // Do not re-select a fulfilled goal, or erase a later choice, after
            // a native commit whose completion was lost to the caller.
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        const now = Date.now(), updated = { ...reduceIslandRewardGoal(island, intent), revision: island.revision + 1, updatedAt: now };
        assertIsland(updated);
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'reward_goal_changed', timestamp: now, action: intent });
        return updated;
    });
}
