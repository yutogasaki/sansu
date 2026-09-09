import { homeJourneyEnabled, validHomeJourney } from './homeJourney';
import { db, type SansuDatabase } from '../../db';
import { getLearningAttemptTransactionTables } from '../learningAttemptWriter';
import { planParkLearning } from '../park/learning';
import { readRuntimeMathUnitPractice } from '../learning/runtimeUnitPractice';
import { ParkConflict } from '../park/repository';
import { getLevelForSkill } from '../math/curriculum';
import { ENGLISH_WORDS } from '../english/words';
import { getIslandMathRemediationSkillIds } from './learningChecks';
import { hasValidIslandSupportState } from './learningSupport';
import { createIsland, islandRewardChoices, isValidIslandPlacement } from './catalog';
import { getIslandGrowthTarget, initializeIslandGrowth, isIslandHabitatId, isIslandHabitatUnlocked } from './growth';
import { hasValidGrowthItemFields, hasValidIslandGrowth } from './growthValidation';
import { selectIslandSubject } from './subjectSelection';
import { hasValidIslandCustomization } from './customization';
import { hasValidIslandExperience } from './experience';
import { hasValidIslandExpression } from './expression';
import { hasValidIslandWorkshop } from './workshop';
import { hasValidIslandSharedMemories } from './sharedMemories';
import { hasValidIslandFurnitureItems } from './furniture';
import { hasValidIslandRewardGoal } from './rewardGoal';
import { hasValidIslandLearningKeepsakes } from './learningKeepsakes';
import { ISLAND_BASIC_ITEM_KINDS, ISLAND_ITEM_KINDS, type IslandBasicItemKind, type IslandEdit, type IslandPlan, type IslandRecord } from './types';

export class IslandConflict extends ParkConflict {}
export const islandTables = (database: SansuDatabase) => [
    ...getLearningAttemptTransactionTables(database), database.islands, database.islandPlans, database.islandEvents,
];

export function assertIsland(island: IslandRecord) {
    if (!validHomeJourney(island.homeJourney) || island.schemaVersion !== 1 || !Number.isInteger(island.revision) || island.revision < 0
        || !Number.isInteger(island.completedSets) || island.completedSets < 0
        || !Array.isArray(island.items) || !Array.isArray(island.pendingRewards)
        || !hasValidIslandFurnitureItems(island.items)
        || new Set(island.items.map(item => item.id)).size !== island.items.length
        || new Set(island.pendingRewards.map(reward => reward.id)).size !== island.pendingRewards.length
        || island.items.some(item => !ISLAND_ITEM_KINDS.includes(item.kind) || !Number.isFinite(item.rotation)
            || !hasValidGrowthItemFields(item)
            || (item.position && (!Number.isFinite(item.position.x) || !Number.isFinite(item.position.z))))
        || island.pendingRewards.some(reward => reward.choices.length !== 3 || new Set(reward.choices).size !== 3
            || reward.choices.some(kind => !ISLAND_BASIC_ITEM_KINDS.includes(kind)))
        || (island.pendingMathChecks !== undefined && (!Array.isArray(island.pendingMathChecks)
            || island.pendingMathChecks.some(check => !check)
            || new Set(island.pendingMathChecks.map(check => check.skillId)).size !== island.pendingMathChecks.length
            || island.pendingMathChecks.some(check => !check || getLevelForSkill(check.skillId) === null
                || !check.failedProblemId || typeof check.failedProblemId !== 'string'
                || !check.failedQuestionKey || typeof check.failedQuestionKey !== 'string'
                || !['bridge', 'independent'].includes(check.stage) || !Number.isFinite(check.createdAt) || check.createdAt < 0)))
        || (island.mathReviewTurn !== undefined && (!Number.isSafeInteger(island.mathReviewTurn) || island.mathReviewTurn < 0))
        || (island.vocabDueCursor !== undefined && !ENGLISH_WORDS.some(word => word.id === island.vocabDueCursor))
        || (island.nextSubjectChoice !== undefined && (!island.nextSubjectChoice
            || typeof island.nextSubjectChoice.afterPlanId !== 'string' || !island.nextSubjectChoice.afterPlanId
            || !['math', 'vocab'].includes(island.nextSubjectChoice.subject)))
        || !hasValidIslandGrowth(island) || !hasValidIslandCustomization(island) || !hasValidIslandExperience(island)
        || !hasValidIslandExpression(island) || !hasValidIslandRewardGoal(island) || !hasValidIslandLearningKeepsakes(island)
        || !hasValidIslandWorkshop(island) || !hasValidIslandSharedMemories(island)) throw new IslandConflict('Invalid island');
}

export function assertIslandPlan(plan: IslandPlan, profileId: string) {
    if ((plan.homeJourneyVersion !== undefined && (plan.homeJourneyVersion !== 1 || plan.rewardPacing !== 'answers-v1')) || plan.profileId !== profileId || plan.schemaVersion !== 1 || plan.plannerVersion !== 'island-learning-v1'
        || !Number.isInteger(plan.revision) || plan.revision < 0 || !Number.isInteger(plan.cursor)
        || !Array.isArray(plan.rewardChoices) || plan.rewardChoices.some(kind => !ISLAND_BASIC_ITEM_KINDS.includes(kind))
        || (plan.growthTarget !== undefined && !isIslandHabitatId(plan.growthTarget))
        || (plan.rewardPacing !== undefined && (plan.rewardPacing !== 'answers-v1' || plan.slots?.length > 6))
        || !Array.isArray(plan.slots) || plan.slots.length === 0 || plan.cursor < 0 || plan.cursor > plan.slots.length
        || (plan.introducedItemIds !== undefined && (!Array.isArray(plan.introducedItemIds)
            || plan.introducedItemIds.some(id => typeof id !== 'string' || !plan.slots.some(slot => slot.problem.categoryId === id))))
        || plan.slots.some((slot, index) => slot.problem.subject !== plan.subject || slot.completed !== (index < plan.cursor)
            || !hasValidIslandSupportState(slot))
        || (plan.status === 'active' ? plan.cursor === plan.slots.length : plan.status !== 'completed' || plan.cursor !== plan.slots.length)) {
        throw new IslandConflict('Invalid learning plan');
    }
}

export function assertIslandPlanGrowth(plan: IslandPlan, island: IslandRecord) {
    if (plan.growthTarget && (!island.growth || !isIslandHabitatUnlocked(island, plan.growthTarget))) {
        throw new IslandConflict('Reserved growth place unavailable');
    }
}

export async function ownedIsland(database: SansuDatabase, profileId: string) {
    const app = await database.appData.get('app');
    if (app?.activeProfileId !== profileId || !app.profiles[profileId]) throw new IslandConflict('Profile changed');
    const island = await database.islands.get(profileId);
    if (!island) throw new IslandConflict('Island missing');
    assertIsland(island);
    return { island, profile: app.profiles[profileId] };
}

export async function openIsland(profileId: string, database = db): Promise<IslandRecord> {
    return database.transaction('rw', islandTables(database), async () => {
        const app = await database.appData.get('app');
        if (app?.activeProfileId !== profileId || !app.profiles[profileId]) throw new IslandConflict('Profile changed');
        const stored = await database.islands.get(profileId);
        if (stored) { assertIsland(stored); return stored; }
        const island = createIsland(profileId, Date.now());
        await database.islands.add(island);
        return island;
    });
}

export async function startIslandPlan(profileId: string, database = db): Promise<IslandPlan> {
    return database.transaction('rw', islandTables(database), async () => {
        const { island, profile } = await ownedIsland(database, profileId);
        if (island.pendingPlanId) {
            const pending = await database.islandPlans.get(island.pendingPlanId);
            if (!pending || pending.status !== 'active') throw new IslandConflict('Pending plan missing');
            assertIslandPlan(pending, profileId);
            assertIslandPlanGrowth(pending, island);
            return pending;
        }
        const id = JSON.stringify(['island-plan-v1', profileId, island.completedSets]);
        const [math, vocab, logs] = await Promise.all([
            database.memoryMath.where('profileId').equals(profileId).toArray(),
            database.memoryVocab.where('profileId').equals(profileId).toArray(),
            database.logs.where('profileId').equals(profileId).toArray(),
        ]);
        const merge = (legacy: typeof profile.mathSkills, rows: typeof math) => Object.values({ ...legacy, ...Object.fromEntries(rows.map(memory => [memory.id, memory])) });
        const now = Date.now();
        const mergedMath = merge(profile.mathSkills, math), mergedVocab = merge(profile.vocabWords, vocab);
        const previousPlans = await database.islandPlans.bulkGet([1, 2].filter(offset => island.completedSets >= offset)
            .map(offset => JSON.stringify(['island-plan-v1', profileId, island.completedSets - offset])));
        const subjectSelection = selectIslandSubject({ profile, island, math: mergedMath, vocab: mergedVocab, logs, previousPlans, now });
        const mathUnitPractice = subjectSelection.subject === 'math'
            ? await readRuntimeMathUnitPractice(database, profile, new Date(now).toISOString()) : undefined;
        const growingIsland = initializeIslandGrowth(island, now);
        const mathReviewTurn = island.mathReviewTurn ?? 0;
        const remediation = getIslandMathRemediationSkillIds(island.pendingMathChecks, profile);
        const selectedRemediation = remediation.length ? [remediation[Math.floor(mathReviewTurn / 2) % remediation.length]] : [];
        const learning = planParkLearning(profile, mergedMath, mergedVocab, logs,
            island.completedSets, id, now, { standardCount: island.completedSets === 0 ? 3 : 6, complexCount: 3,
                ...subjectSelection,
                mathUnitPractice,
                mathRemediationSkillIds: selectedRemediation, mathDueFirst: mathReviewTurn % 2 === 1,
                mathPendingReviewSkillIds: [...(island.pendingMathChecks ?? []).map(check => check.skillId), ...remediation],
                vocabDueAfterId: island.vocabDueCursor });
        const plan: IslandPlan = {
            id, profileId, schemaVersion: 1, plannerVersion: 'island-learning-v1', ...learning,
            status: 'active', cursor: 0, revision: 0, startedAt: now,
            rewardId: `${id}:reward`, rewardChoices: islandRewardChoices(island.completedSets),
            growthTarget: getIslandGrowthTarget(growingIsland),
            rewardPacing: 'answers-v1',
            ...(homeJourneyEnabled() ? { homeJourneyVersion: 1 as const } : {}),
            introducedItemIds: [...new Set(learning.slots.filter(slot => !(learning.subject === 'math' ? mergedMath : mergedVocab)
                .some(state => state.id === slot.problem.categoryId && state.totalAnswers > 0)).map(slot => slot.problem.categoryId))],
        };
        await database.islandPlans.add(plan);
        await database.islands.put({ ...growingIsland, pendingPlanId: id, nextSubjectChoice: undefined, revision: island.revision + 1, updatedAt: now,
            ...(learning.subject === 'math' ? { mathReviewTurn: mathReviewTurn + 1 } : {}),
            ...(learning.subject === 'vocab' ? { vocabDueCursor: learning.slots.filter(slot => slot.source === 'due').slice(-1)[0]?.problem.categoryId ?? island.vocabDueCursor } : {}) });
        await database.islandEvents.add({ id: `${id}:started`, profileId, planId: id, type: 'plan_started', timestamp: now });
        return plan;
    });
}

export async function claimIslandReward(profileId: string, revision: number, rewardId: string, kind: IslandBasicItemKind, database = db): Promise<IslandRecord> {
    if (!ISLAND_BASIC_ITEM_KINDS.includes(kind)) throw new IslandConflict('Reward kind unavailable');
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = `${rewardId}:claimed`;
        const prior = await database.islandEvents.get(id);
        if (prior) {
            if (prior.type !== 'reward_claimed' || prior.profileId !== profileId || prior.kind !== kind || prior.rewardId !== rewardId) throw new IslandConflict('Reward choice changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        const reward = island.pendingRewards.find(candidate => candidate.id === rewardId);
        if (!reward || !reward.choices.includes(kind)) throw new IslandConflict('Reward not available');
        const now = Date.now();
        const itemId = `${rewardId}:item`;
        if (island.items.some(item => item.id === itemId)) throw new IslandConflict('Reward already exists');
        const updated: IslandRecord = {
            ...island, revision: island.revision + 1, updatedAt: now,
            items: [...island.items, { id: itemId, kind, rotation: 0 }],
            pendingRewards: island.pendingRewards.filter(candidate => candidate.id !== rewardId),
        };
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, planId: reward.planId, type: 'reward_claimed', timestamp: now, rewardId, itemId, kind });
        return updated;
    });
}

export async function saveIslandEdit(profileId: string, revision: number, edit: IslandEdit, database = db): Promise<IslandRecord> {
    return database.transaction('rw', islandTables(database), async () => {
        const { island } = await ownedIsland(database, profileId);
        const id = JSON.stringify(['island-edit-v1', profileId, revision]);
        const prior = await database.islandEvents.get(id);
        if (prior) {
            if (JSON.stringify(prior.action) !== JSON.stringify(edit)) throw new IslandConflict('Edit changed');
            return island;
        }
        if (island.revision !== revision) throw new IslandConflict('Island changed in another tab');
        if (!island.items.some(item => item.id === edit.itemId)) throw new IslandConflict('Item missing');
        if (edit.type === 'place' && !isValidIslandPlacement(island, edit.itemId, edit.position, edit.rotation)) throw new IslandConflict('Position occupied or outside island');
        const now = Date.now();
        const updated: IslandRecord = {
            ...island, revision: island.revision + 1, updatedAt: now,
            items: island.items.map(item => item.id !== edit.itemId ? item : edit.type === 'store'
                ? { ...item, position: undefined, autoPlacementBlocked: undefined }
                : { ...item, position: { ...edit.position }, autoPlacementBlocked: undefined,
                    rotation: ((edit.rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) }),
        };
        await database.islands.put(updated);
        await database.islandEvents.add({ id, profileId, type: 'item_edited', timestamp: now, itemId: edit.itemId, action: edit });
        return updated;
    });
}
