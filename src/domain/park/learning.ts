import type { AttemptLog } from '../../db';
import { createSeededRandom } from '../../utils/random';
import { generateMathProblem, planMathProblemSlots } from '../math';
import { getMathSkillMetadata } from '../math/curriculum';
import { generateHissanGrid } from '../math/hissanEngine';
import { isHissanEligible } from '../math/hissanTypes';
import { generateWrittenArithmeticGrid } from '../math/writtenArithmetic';
import { generateVocabProblem } from '../english/generator';
import { planVocabProblemSlots } from '../english/planner';
import type { MemoryState, Problem, SubjectKey, UserProfile } from '../types';
import { parkLearningHistory } from './learningHistory';
import type { LearningSlot, ParkPlan } from './types';
import { createLearningProblemContext } from '../learning/context';
import type { MathLevel11Practice } from '../learning/unitPractice';
import { isNormalReviewEligible } from '../learning/reviewPolicy';

export function parkHissanGrid(problem: Problem) {
    if (problem.subject !== 'math' || !problem.questionText || problem.inputType === 'choice') return null;
    if (problem.hissanVersion === 2 || problem.hissanVersion === 3) {
        return problem.inputType === 'hissan'
            ? generateWrittenArithmeticGrid(problem.questionText, problem.correctAnswer,
                problem.hissanVersion === 3 ? { divisionInput: 'compact' } : undefined) : null;
    }
    if (!isHissanEligible(problem.categoryId)) return null;
    if (!problem.categoryId.includes('_hissan') && !problem.categoryId.includes('_algorithm') && problem.inputType !== 'hissan') return null;
    return generateHissanGrid(problem.categoryId, problem.questionText,
        Array.isArray(problem.correctAnswer) ? problem.correctAnswer.join('') : problem.correctAnswer);
}

export function gradeParkAnswer(slot: LearningSlot, answer: string | string[]) {
    const grid = parkHissanGrid(slot.problem);
    const expected = grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer;
    const correct = Array.isArray(expected)
        ? Array.isArray(answer) && expected.length === answer.length && expected.every((v, i) => v === answer[i])
        : typeof answer === 'string' && answer === expected;
    const final = !grid || (slot.hissanStep ?? 0) === grid.steps.length - 1;
    return { correct, final, grid };
}

export function planParkLearning(
    profile: UserProfile,
    mathMemory: MemoryState[],
    vocabMemory: MemoryState[],
    logs: AttemptLog[],
    sequence: number,
    planId: string,
    now: number,
    workload: { standardCount?: number; complexCount?: number; mathRemediationSkillIds?: readonly string[];
        mathPendingReviewSkillIds?: readonly string[]; mathDueFirst?: boolean; vocabDueAfterId?: string;
        subject?: SubjectKey; practiceItemIds?: readonly string[]; mathUnitPractice?: MathLevel11Practice } = {},
): Pick<ParkPlan, 'subject' | 'slots'> {
    const standardCount = workload.standardCount ?? 3;
    const complexCount = workload.complexCount ?? 2;
    if (!Number.isInteger(standardCount) || standardCount < 1 || !Number.isInteger(complexCount) || complexCount < 1 || complexCount > standardCount) {
        throw new Error('Invalid learning workload');
    }
    const subject = profile.subjectMode === 'mix' ? workload.subject ?? (sequence % 2 === 0 ? 'math' : 'vocab') : profile.subjectMode;
    const memory = subject === 'math' ? mathMemory : vocabMemory;
    const { itemLogs, skipped, due, weak } = parkLearningHistory(subject, memory, logs, now);
    const random = createSeededRandom(planId);
    let slots: LearningSlot[];
    if (subject === 'math') {
        const remediation = new Set(workload.mathRemediationSkillIds ?? []);
        // All Island pending checks belong to its rotating lane, including checks
        // not selected this turn. Otherwise an old unselected Due can bypass the turn.
        const pendingReview = new Set([...remediation, ...(workload.mathPendingReviewSkillIds ?? [])]);
        const ordinaryDue = due.filter(id => !pendingReview.has(id));
        const reviewOrder = workload.mathDueFirst ? [...ordinaryDue, ...remediation] : [...remediation, ...ordinaryDue];
        const hydrated = { ...profile, mathSkills: { ...profile.mathSkills, ...Object.fromEntries(mathMemory.map(m => [m.id, m])) } };
        const planned = planMathProblemSlots({
            // Island's pending rechecks use the same review admission and unlock guards as Due.
            profile: hydrated, count: standardCount, dueSkillIds: [...new Set(reviewOrder)], weakSkillIds: weak,
            maintenanceSkillIds: memory.filter(m => m.status === 'maintenance' && !isNormalReviewEligible(m)).map(m => m.id),
            retiredSkillIds: memory.filter(m => m.status === 'retired' && !isNormalReviewEligible(m)).map(m => m.id),
            skippedTodayIds: skipped, cooldownIds: itemLogs.slice(-5).map(l => l.itemId),
            practiceSkillIds: workload.practiceItemIds,
            unitPractice: workload.mathUnitPractice,
            canAddReview: (items) => items.filter(i => i.countsTowardReviewCap).length < Math.max(1, Math.floor((items.length + 1) * 0.6)),
            random,
        });
        slots = planned.map((selection, i) => {
            if (!selection) throw new Error('No learning assignment available');
            const problem: Problem = {
                ...generateMathProblem(selection.skillId, { profile: hydrated, random: createSeededRandom(`${planId}:${i}:${selection.skillId}`),
                    preferredLearningVariant: selection.preferredVariant }),
                id: `${planId}:slot-${i}`, subject, isReview: selection.isReview,
                isMaintenanceCheck: selection.isMaintenanceCheck,
            };
            if (problem.categoryId !== selection.skillId) throw new Error('Generator changed the reserved skill');
            if ((profile.hissanModeEnabled ?? true) && problem.inputType !== 'choice') {
                const eligible = isHissanEligible(problem.categoryId) || ['div_rem_q1', 'div_rem_q2'].includes(problem.categoryId);
                const written = eligible && /^(mul|div)_/.test(problem.categoryId) && problem.questionText
                    ? generateWrittenArithmeticGrid(problem.questionText, problem.correctAnswer) : null;
                if (written) {
                    problem.inputType = 'hissan';
                    problem.hissanVersion = written.writtenLayout?.kind === 'division' ? 3 : 2;
                } else if (parkHissanGrid({ ...problem, inputType: 'hissan' })) {
                    problem.inputType = 'hissan';
                }
            }
            // This is new-plan construction. Saved reservations are never re-enriched.
            problem.learningContext = createLearningProblemContext('math', problem);
            return { problem, source: selection.source === 'due' && remediation.has(selection.skillId) ? 'remediation' : selection.source,
                countsTowardReviewCap: selection.countsTowardReviewCap, assisted: false, completed: false,
                learningEvidenceAssistance: 'independent' };
        });
    } else {
        const hydrated = { ...profile, vocabWords: { ...profile.vocabWords, ...Object.fromEntries(vocabMemory.map(m => [m.id, m])) } };
        const planned = planVocabProblemSlots({
            profile: hydrated, count: standardCount, shortestCount: complexCount,
            dueIds: due, dueAfterId: workload.vocabDueAfterId, weakIds: weak,
            skippedIds: skipped, cooldownIds: itemLogs.slice(-10).map(log => log.itemId), random,
            practiceWordIds: workload.practiceItemIds,
        });
        slots = planned.map((selection, index) => ({
            problem: {
                ...generateVocabProblem(selection.wordId, {
                    kanjiMode: profile.kanjiMode,
                    cooldownIds: itemLogs.slice(-10).map(log => log.itemId),
                    random: createSeededRandom(`${planId}:${index}:${selection.wordId}`),
                }),
                id: `${planId}:slot-${index}`, subject, isReview: selection.isReview,
            },
            source: selection.source, countsTowardReviewCap: selection.countsTowardReviewCap,
            assisted: false, completed: false, learningEvidenceAssistance: 'independent',
        }));
    }
    // Reserve a fixed workload before showing a question. Complex/new content gets a shorter section.
    const longForm = slots.some(s => s.problem.inputType === 'multi-number' || parkHissanGrid(s.problem)
        || (subject === 'math' && getMathSkillMetadata(s.problem.categoryId).representation === 'algorithm')
        || !memory.some(m => m.id === s.problem.categoryId && m.totalAnswers > 0));
    return { subject, slots: longForm ? slots.slice(0, complexCount) : slots };
}
