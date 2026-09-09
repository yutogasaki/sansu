import { advanceHomeJourney } from './homeJourney';
import { db, type SansuDatabase } from '../../db';
import { beginRelearning } from '../algorithms/srs';
import { writeLearningAttemptInTransaction } from '../learningAttemptWriter';
import { checkEnglishLevelProgression, checkVocabUnlockReadiness } from '../english/service';
import { resolveProfileProgressionAfterAttempt } from '../../hooks/useStudySession.logic';
import { gradeParkAnswer, parkHissanGrid } from '../park/learning';
import { learningBarrierForProblem, learningEvidenceForProblem } from '../learning/attemptContext';
import type { MemoryState } from '../types';
import { assertIslandPlan, assertIslandPlanGrowth, IslandConflict, islandTables, ownedIsland } from './repository';
import type { IslandEvent, IslandLearningAction } from './types';
import { updateIslandMathChecks } from './learningChecks';
import { islandSupportStage } from './learningSupport';
import { normalizeIslandObservation, islandObservationBinding, islandObservationScope } from './learningObservation';
import { growIslandAfterCompletedSet } from './growth';
import { earnIslandCustomizationStars } from './customization';

async function keepIndependentCheckDue(database: SansuDatabase, profileId: string, subject: 'math' | 'vocab', itemId: string, now: number) {
    const table = subject === 'math' ? database.memoryMath : database.memoryVocab;
    const app = await database.appData.get('app');
    const profile = app?.profiles[profileId];
    if (!app || !profile) throw new IslandConflict('Profile changed');
    const field = subject === 'math' ? 'mathSkills' : 'vocabWords';
    const existing = await table.get([profileId, itemId]) ?? profile[field][itemId];
    const memory: MemoryState = {
        ...beginRelearning(existing ?? {
            id: itemId, strength: 1, totalAnswers: 0, correctAnswers: 0, incorrectAnswers: 0, skippedAnswers: 0,
            nextReview: new Date(now).toISOString(), updatedAt: new Date(now).toISOString(),
            ...(subject === 'math' ? { status: 'active' as const } : {}),
        }, new Date(now)),
        profileId,
    };
    await table.put(memory);
    const updated = { ...profile, [field]: { ...profile[field], [itemId]: memory } };
    await database.profiles.put(updated);
    await database.appData.put({ ...app, profiles: { ...app.profiles, [profileId]: updated } });
}

export async function commitIslandLearning(profileId: string, planId: string, revision: number, action: IslandLearningAction, database = db, observation?: unknown) {
    return database.transaction('rw', islandTables(database), async () => {
        let { island } = await ownedIsland(database, profileId);
        const plan = await database.islandPlans.get(planId);
        if (!plan) throw new IslandConflict('Plan missing');
        assertIslandPlan(plan, profileId);
        assertIslandPlanGrowth(plan, island);
        const id = JSON.stringify(['island-action-v1', profileId, planId, revision]);
        const existing = await database.islandEvents.get(id);
        if (existing) {
            if (JSON.stringify(existing.action) !== JSON.stringify(action)) throw new IslandConflict('Answer changed');
            return { plan, event: existing, island };
        }
        if (plan.revision !== revision || plan.status !== 'active' || island.pendingPlanId !== planId) throw new IslandConflict('Plan changed in another tab');
        const slot = plan.slots[plan.cursor];
        const supportStage = islandSupportStage(slot);
        const observationBinding = islandObservationBinding(plan), observationScope = islandObservationScope(slot, action);
        // Replayed receipts returned above remain idempotent; a fresh revision must
        // obey the same progression as the UI, including at most one actual skip.
        if ((action.type === 'support_opened' || action.type === 'skipped') && supportStage
            || action.type === 'model_opened' && supportStage !== 'hint'
            || action.type === 'supported_completed' && supportStage !== 'model'
            || action.type === 'answer' && supportStage === 'model') throw new IslandConflict('Support stage changed');
        const now = Date.now();
        // Optional metadata is normalized before any write; storage errors below still abort the transaction.
        const normalizedObservation = normalizeIslandObservation(observation, observationBinding);
        const event: IslandEvent = { id, profileId, planId, timestamp: now, type: action.type, action, slotIndex: plan.cursor };
        let result: 'correct' | 'incorrect' | 'skipped' | undefined;
        const assistanceBefore = slot.assisted ? 'assisted' : slot.learningEvidenceAssistance ?? 'unknown';
        let wholeProblem = false;
        let checkOutcome: 'needs-support' | 'correct-final' | 'supported-final' | 'partial' = 'partial';
        if (action.type === 'support_opened' || action.type === 'skipped') {
            event.learningEvidenceBarrier = learningBarrierForProblem(slot.problem, action.type === 'skipped' ? 'skipped' : 'support-opened');
            checkOutcome = 'needs-support';
            slot.assisted = true;
            slot.learningEvidenceAssistance = 'assisted';
            slot.supportStage = 'hint';
            if (action.type === 'skipped') {
                wholeProblem = !parkHissanGrid(slot.problem);
                result = 'skipped'; event.result = 'skipped';
            }
        } else if (action.type === 'model_opened') {
            slot.supportStage = 'model';
        } else if (action.type === 'supported_completed') {
            // This is session progress after viewing a model, never an answer.
            // In particular, do not grade or fill Hissan cells to manufacture success.
            event.result = 'supported-completion';
            event.learningEvidence = learningEvidenceForProblem(slot.problem, 'assisted');
            observationScope.wholeCompleted = true;
            checkOutcome = 'supported-final';
            slot.completed = true;
            plan.cursor += 1;
        } else {
            const { correct, final, grid } = gradeParkAnswer(slot, action.answer);
            wholeProblem = !grid || (correct && final);
            if (!correct) slot.learningEvidenceAssistance = 'assisted';
            if (!correct && grid) event.learningEvidenceBarrier = learningBarrierForProblem(slot.problem, 'error-correction');
            observationScope.answerScope = grid ? 'hissan-step' : 'whole';
            if (grid) observationScope.stepIndexBefore = slot.hissanStep ?? 0;
            observationScope.wholeCompleted = correct && final;
            checkOutcome = !correct ? 'needs-support' : final ? 'correct-final' : 'partial';
            event.result = slot.assisted ? (correct ? 'assisted-correct' : 'assisted-incorrect') : (correct ? 'correct' : 'incorrect');
            if (!slot.assisted && (!correct || final)) result = correct ? 'correct' : 'incorrect';
            if (correct && grid) {
                const step = grid.steps[slot.hissanStep ?? 0];
                slot.hissanValues = { ...slot.hissanValues };
                step.inputCellIndices.forEach((column, index) => { slot.hissanValues![`${step.rowIndex}-${column}`] = action.answer[index]; });
                slot.hissanStep = (slot.hissanStep ?? 0) + 1;
            }
            if (correct && final) { slot.completed = true; plan.cursor += 1; }
            if (slot.assisted && wholeProblem) {
                event.learningEvidence = learningEvidenceForProblem(slot.problem, 'assisted');
            }
        }
        if (result) {
            const receipt = await writeLearningAttemptInTransaction(database, {
                profileId, subject: plan.subject, itemId: slot.problem.categoryId, result,
                isReview: slot.problem.isReview, isMaintenanceCheck: Boolean(slot.problem.isMaintenanceCheck), timestamp: new Date(now).toISOString(),
                learningEvidence: learningEvidenceForProblem(slot.problem, assistanceBefore, wholeProblem),
            });
            event.learningLogId = receipt.logId;
            if (plan.subject === 'vocab' && receipt.profile) {
                const updated = await resolveProfileProgressionAfterAttempt({
                    currentProfile: receipt.profile, subject: 'vocab', nowIso: new Date(now).toISOString(),
                    checkMathUnlock: async () => false, checkMathPromotion: async () => false, checkVocabUnlockReadiness,
                    checkVocabPromotion: profile => checkEnglishLevelProgression(profile, profile.vocabWords),
                });
                if (updated !== receipt.profile) {
                    const app = (await database.appData.get('app'))!;
                    await database.profiles.put(updated);
                    await database.appData.put({ ...app, profiles: { ...app.profiles, [profileId]: updated } });
                }
            }
        }
        // Support never manufactures mastery. Keep the independent check after the actual skip write too.
        if (slot.assisted) await keepIndependentCheckDue(database, profileId, plan.subject, slot.problem.categoryId, now);
        // Older assisted v1 plans predate pendingMathChecks. Their model completion
        // creates the missing follow-up without resetting an existing obligation.
        const previousChecks = action.type === 'supported_completed' && slot.supportStage === undefined
            && !island.pendingMathChecks?.some(check => check.skillId === slot.problem.categoryId)
            ? updateIslandMathChecks(island.pendingMathChecks, slot, 'needs-support', now) : island.pendingMathChecks;
        const nextChecks = updateIslandMathChecks(previousChecks, slot, checkOutcome, now);
        const checksChanged = JSON.stringify(nextChecks) !== JSON.stringify(island.pendingMathChecks);
        if (checksChanged) island.pendingMathChecks = nextChecks;
        plan.revision += 1;
        event.observation = { version: 1, problemId: observationBinding.problemId, revisionBefore: observationBinding.revisionBefore,
            ...observationScope, ...normalizedObservation };
        await database.islandEvents.add(event);
        if (plan.cursor === plan.slots.length && plan.slots.every(candidate => candidate.completed)) {
            plan.status = 'completed';
            plan.completedAt = now;
            if (!plan.growthTarget) {
                if (island.pendingRewards.some(reward => reward.id === plan.rewardId)) throw new IslandConflict('Reward already exists without completion');
                island.pendingRewards.push({ id: plan.rewardId, planId, choices: [...plan.rewardChoices], earnedAt: now });
            }
            island.pendingPlanId = undefined;
            island.customization = earnIslandCustomizationStars(island, plan);
            island.completedSets += 1;
            if (plan.homeJourneyVersion === 1) island.homeJourney = advanceHomeJourney(island.homeJourney, plan.slots.length);
            if (plan.growthTarget) island = growIslandAfterCompletedSet(island, plan.growthTarget, now,
                plan.rewardPacing === 'answers-v1' ? plan.slots.length : undefined);
            await database.islandEvents.add({ id: `${planId}:completed`, profileId, planId, type: 'plan_completed', timestamp: now,
                ...(plan.growthTarget ? { habitatId: plan.growthTarget } : { rewardId: plan.rewardId }) });
        }
        if (checksChanged || plan.status === 'completed') {
            island.revision += 1;
            island.updatedAt = now;
            await database.islands.put(island);
        }
        await database.islandPlans.put(plan);
        return { plan, event, island };
    });
}
