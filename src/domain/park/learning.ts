import type { AttemptLog } from '../../db';
import { createSeededRandom } from '../../utils/random';
import { getLearningDayStart } from '../../utils/learningDay';
import { generateMathProblem, planMathProblemSlots } from '../math';
import { getMathSkillMetadata } from '../math/curriculum';
import { generateHissanGrid } from '../math/hissanEngine';
import { isHissanEligible } from '../math/hissanTypes';
import { generateWrittenArithmeticGrid } from '../math/writtenArithmetic';
import { generateVocabProblem } from '../english/generator';
import { ENGLISH_WORDS } from '../english/words';
import { resolveWeakState } from '../learningRepository';
import type { MemoryState, Problem, UserProfile } from '../types';
import type { LearningSlot, ParkPlan } from './types';

export function parkHissanGrid(problem: Problem) {
    if (problem.subject !== 'math' || !problem.questionText || problem.inputType === 'choice') return null;
    if (problem.hissanVersion === 2) {
        return problem.inputType === 'hissan'
            ? generateWrittenArithmeticGrid(problem.questionText, problem.correctAnswer) : null;
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
        mathPendingReviewSkillIds?: readonly string[]; mathDueFirst?: boolean; vocabDueAfterId?: string } = {},
): Pick<ParkPlan, 'subject' | 'slots'> {
    const standardCount = workload.standardCount ?? 3;
    const complexCount = workload.complexCount ?? 2;
    if (!Number.isInteger(standardCount) || standardCount < 1 || !Number.isInteger(complexCount) || complexCount < 1 || complexCount > standardCount) {
        throw new Error('Invalid learning workload');
    }
    const subject = profile.subjectMode === 'mix' ? (sequence % 2 === 0 ? 'math' : 'vocab') : profile.subjectMode;
    const memory = subject === 'math' ? mathMemory : vocabMemory;
    const itemLogs = logs.filter(l => l.subject === subject).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const dayStart = getLearningDayStart(new Date(now)).toISOString();
    const grouped = new Map<string, AttemptLog[]>();
    for (const log of itemLogs) {
        const list = grouped.get(log.itemId) ?? [];
        list.push(log);
        grouped.set(log.itemId, list);
    }
    const skipped = [...grouped].filter(([, list]) => {
        const recent = list.filter(l => l.timestamp >= dayStart).slice(-3);
        return recent.length === 3 && recent.every(l => l.result === 'skipped');
    }).map(([id]) => id);
    const due = memory.filter(m => m.nextReview <= new Date(now).toISOString()
        && (subject !== 'math' || (m.status !== 'retired' && m.status !== 'maintenance')))
        .sort((a, b) => a.nextReview.localeCompare(b.nextReview)).map(m => m.id);
    const weak = memory.filter(m => m.isWeak ?? resolveWeakState((grouped.get(m.id) ?? []).map(l => l.result))).map(m => m.id);
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
            maintenanceSkillIds: memory.filter(m => m.status === 'maintenance').map(m => m.id),
            retiredSkillIds: memory.filter(m => m.status === 'retired').map(m => m.id),
            skippedTodayIds: skipped, cooldownIds: itemLogs.slice(-5).map(l => l.itemId),
            canAddReview: (items) => items.filter(i => i.countsTowardReviewCap).length < Math.max(1, Math.floor((items.length + 1) * 0.6)),
            random,
        });
        slots = planned.map((selection, i) => {
            if (!selection) throw new Error('No learning assignment available');
            const problem: Problem = {
                ...generateMathProblem(selection.skillId, { profile: hydrated, random: createSeededRandom(`${planId}:${i}:${selection.skillId}`) }),
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
                    problem.hissanVersion = 2;
                } else if (parkHissanGrid({ ...problem, inputType: 'hissan' })) {
                    problem.inputType = 'hissan';
                }
            }
            return { problem, source: selection.source === 'due' && remediation.has(selection.skillId) ? 'remediation' : selection.source,
                countsTowardReviewCap: selection.countsTowardReviewCap, assisted: false, completed: false };
        });
    } else {
        const eligible = ENGLISH_WORDS.filter(w => w.level <= profile.vocabMaxUnlocked && !skipped.includes(w.id));
        const weakSet = new Set(weak);
        const main = eligible.filter(w => w.level === profile.vocabMainLevel);
        const plusOne = eligible.filter(w => w.level === profile.vocabMainLevel + 1);
        const eligibleDue = due.filter(id => eligible.some(word => word.id === id));
        const cursor = workload.vocabDueAfterId ? eligibleDue.indexOf(workload.vocabDueAfterId) : -1;
        const orderedDue = cursor < 0 ? eligibleDue : [...eligibleDue.slice(cursor + 1), ...eligibleDue.slice(0, cursor + 1)];
        const used = new Set<string>();
        let reviewCount = 0;
        slots = Array.from({ length: standardCount }, (_, i) => {
            const review = i === 0 ? eligible.find(word => word.id === orderedDue[0]) : undefined;
            const weakWord = !review && reviewCount === 0 && random() < .3 ? eligible.find(w => weakSet.has(w.id) && !used.has(w.id)) : undefined;
            const requested = plusOne.length && random() < .3 ? plusOne : main;
            const pool = requested.filter(w => !used.has(w.id));
            const word = review ?? weakWord ?? pool[Math.floor(random() * pool.length)];
            if (!word) throw new Error('No vocabulary assignment available');
            used.add(word.id);
            if (review || weakWord) reviewCount += 1;
            return {
                problem: { ...generateVocabProblem(word.id, { kanjiMode: profile.kanjiMode }), id: `${planId}:slot-${i}`, subject, isReview: Boolean(review) },
                source: review ? 'due' : weakWord ? 'weak' : word.level > profile.vocabMainLevel ? 'plus-one' : 'main',
                countsTowardReviewCap: Boolean(review || weakWord), assisted: false, completed: false,
            };
        });
    }
    // Reserve a fixed workload before showing a question. Complex/new content gets a shorter section.
    const longForm = slots.some(s => s.problem.inputType === 'multi-number' || parkHissanGrid(s.problem)
        || (subject === 'math' && getMathSkillMetadata(s.problem.categoryId).representation === 'algorithm')
        || !memory.some(m => m.id === s.problem.categoryId && m.totalAnswers > 0));
    return { subject, slots: longForm ? slots.slice(0, complexCount) : slots };
}
