import { db, type SansuDatabase } from '../../db';
import { getLearningDayStart } from '../../utils/learningDay';
import { writeLearningAttemptInTransaction } from '../learningAttemptWriter';
import type { MemoryState } from '../types';
import { checkEnglishLevelProgression, checkVocabUnlockReadiness } from '../english/service';
import { resolveProfileProgressionAfterAttempt } from '../../hooks/useStudySession.logic';
import { gradeParkAnswer, parkHissanGrid } from './learning';
import { learningBarrierForProblem, learningEvidenceForProblem } from '../learning/attemptContext';
import { ownedPark, parkTables, ParkConflict } from './repository';
import type { ParkEvent, ParkLearningAction } from './types';

/** A shown answer creates an independent-check Due, never a fabricated correct/incorrect log. */
async function keepIndependentCheckDue(database: SansuDatabase, profileId: string, subject: 'math' | 'vocab', itemId: string, now: number) {
    const table = subject === 'math' ? database.memoryMath : database.memoryVocab;
    const app = await database.appData.get('app');
    const profile = app?.profiles[profileId];
    if (!app || !profile) throw new ParkConflict('Profile changed');
    const field = subject === 'math' ? 'mathSkills' : 'vocabWords';
    const existing = await table.get([profileId, itemId]) ?? profile[field][itemId];
    const due = getLearningDayStart(new Date(now)).toISOString();
    const memory: MemoryState = {
        ...(existing ?? { id: itemId, strength: 1, totalAnswers: 0, correctAnswers: 0, incorrectAnswers: 0, skippedAnswers: 0 }),
        profileId, nextReview: existing && existing.nextReview < due ? existing.nextReview : due,
        updatedAt: new Date(now).toISOString(),
        ...(subject === 'math' ? { status: 'active' as const } : {}),
    };
    await table.put(memory);
    const updated = { ...profile, [field]: { ...profile[field], [itemId]: memory } };
    await database.profiles.put(updated);
    await database.appData.put({ ...app, profiles: { ...app.profiles, [profileId]: updated } });
}

export async function commitParkLearning(
    profileId: string, planId: string, revision: number, action: ParkLearningAction, database = db,
) {
    return database.transaction('rw', parkTables(database), async () => {
        const { park } = await ownedPark(database, profileId);
        const plan = await database.parkPlans.get(planId);
        if (!plan || plan.profileId !== profileId || plan.schemaVersion !== 1) throw new ParkConflict('Plan missing');
        const eventId = JSON.stringify(['park-action-v1', profileId, planId, revision]);
        const existing = await database.parkEvents.get(eventId);
        if (existing) {
            if (JSON.stringify(existing.action) !== JSON.stringify(action)) throw new ParkConflict('Answer changed');
            return { plan, event: existing };
        }
        if (plan.revision !== revision || plan.status !== 'active' || park.pendingPlanId !== planId) throw new ParkConflict('Plan changed in another tab');
        const slot = plan.slots[plan.cursor];
        if (!slot || slot.completed || slot.problem.subject !== plan.subject) throw new ParkConflict('Invalid learning slot');
        const now = Date.now();
        const event: ParkEvent = {
            id: eventId, profileId, planId, timestamp: now, type: action.type, action, slotIndex: plan.cursor,
        };
        let result: 'correct' | 'incorrect' | 'skipped' | undefined;
        const assistanceBefore = slot.assisted ? 'assisted' : slot.learningEvidenceAssistance ?? 'unknown';
        let wholeProblem = false;
        if (action.type === 'support_opened') {
            event.learningEvidenceBarrier = learningBarrierForProblem(slot.problem, 'support-opened');
            slot.assisted = true;
            slot.learningEvidenceAssistance = 'assisted';
            await keepIndependentCheckDue(database, profileId, plan.subject, slot.problem.categoryId, now);
        } else if (action.type === 'skipped') {
            wholeProblem = !parkHissanGrid(slot.problem);
            event.learningEvidenceBarrier = learningBarrierForProblem(slot.problem, 'skipped');
            slot.learningEvidenceAssistance = 'assisted';
            result = 'skipped';
            event.result = 'skipped';
        } else {
            const { correct, final, grid } = gradeParkAnswer(slot, action.answer);
            wholeProblem = !grid || (correct && final);
            if (!correct) slot.learningEvidenceAssistance = 'assisted';
            if (!correct && grid) event.learningEvidenceBarrier = learningBarrierForProblem(slot.problem, 'error-correction');
            event.result = slot.assisted ? (correct ? 'assisted-correct' : 'assisted-incorrect') : (correct ? 'correct' : 'incorrect');
            if (!slot.assisted && (!correct || final)) result = correct ? 'correct' : 'incorrect';
            if (correct && grid) {
                const step = grid.steps[slot.hissanStep ?? 0];
                slot.hissanValues = { ...slot.hissanValues };
                step.inputCellIndices.forEach((col, i) => { slot.hissanValues![`${step.rowIndex}-${col}`] = action.answer[i]; });
                slot.hissanStep = (slot.hissanStep ?? 0) + 1;
            }
            if (correct && final) {
                slot.completed = true;
                plan.cursor += 1;
                if (slot.assisted) await keepIndependentCheckDue(database, profileId, plan.subject, slot.problem.categoryId, now);
            }
            if (slot.assisted && wholeProblem) {
                event.learningEvidence = learningEvidenceForProblem(slot.problem, 'assisted');
            }
        }
        if (result) {
            const receipt = await writeLearningAttemptInTransaction(database, {
                profileId, subject: plan.subject, itemId: slot.problem.categoryId, result,
                isReview: slot.problem.isReview, isMaintenanceCheck: Boolean(slot.problem.isMaintenanceCheck),
                timestamp: new Date(now).toISOString(),
                learningEvidence: learningEvidenceForProblem(slot.problem, assistanceBefore, wholeProblem),
            });
            event.learningLogId = receipt.logId;
            if (plan.subject === 'vocab' && receipt.profile) {
                const updated = await resolveProfileProgressionAfterAttempt({
                    currentProfile: receipt.profile, subject: 'vocab', nowIso: new Date(now).toISOString(),
                    checkMathUnlock: async () => false, checkMathPromotion: async () => false,
                    checkVocabUnlockReadiness,
                    checkVocabPromotion: p => checkEnglishLevelProgression(p, p.vocabWords),
                });
                if (updated !== receipt.profile) {
                    const app = (await database.appData.get('app'))!;
                    await database.profiles.put(updated);
                    await database.appData.put({ ...app, profiles: { ...app.profiles, [profileId]: updated } });
                }
            }
        }
        plan.revision += 1;
        await database.parkEvents.add(event);
        if (plan.cursor === plan.slots.length && plan.slots.every(s => s.completed)) {
            plan.status = 'completed';
            plan.completedAt = now;
            if (park.parts.some(p => p.id === plan.rewardId)) throw new ParkConflict('Reward already exists without completion');
            park.parts.push({ id: plan.rewardId, kind: plan.partKind });
            park.pendingPlanId = undefined;
            park.completedPlans += 1;
            park.revision += 1;
            park.updatedAt = now;
            await database.parks.put(park);
            await database.parkEvents.add({ id: `${planId}:completed`, profileId, planId, type: 'plan_completed', timestamp: now, rewardId: plan.rewardId });
        }
        await database.parkPlans.put(plan);
        return { plan, event };
    });
}
