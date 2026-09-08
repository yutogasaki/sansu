import { describe, expect, it } from 'vitest';
import type { AttemptLog } from '../../db';
import { getLearningDayStart } from '../../utils/learningDay';
import { ENGLISH_WORDS } from '../english/words';
import { getSkillsForLevel } from '../math/curriculum';
import { createInitialProfile } from '../user/profile';
import type { MemoryState, SubjectKey } from '../types';
import { createIsland } from './catalog';
import type { IslandPlan } from './types';
import { selectIslandSubject } from './subjectSelection';

const now = new Date(2026, 8, 8, 12).getTime();
const memory = (id: string, nextReview = '2026-09-01'): MemoryState => ({ id, nextReview, strength: 1,
    totalAnswers: 1, correctAnswers: 1, independentCorrectAnswers: 1, incorrectAnswers: 0, skippedAnswers: 0, updatedAt: '2026-09-01' });
const profile = () => ({ ...createInitialProfile('test', 2, 1, 1, 'mix'), id: 'child', hissanModeEnabled: false });
const mathId = getSkillsForLevel(profile().mathMainLevel)[0];
const wordIds = ENGLISH_WORDS.filter(word => word.level === profile().vocabMainLevel).slice(0, 4).map(word => word.id);
const plan = (subject: SubjectKey, id = 'last', introduced = false): IslandPlan => ({
    id, profileId: 'child', schemaVersion: 1, plannerVersion: 'island-learning-v1', subject,
    status: 'completed', revision: 3, cursor: 1, startedAt: now - 1000, completedAt: now - 100,
    rewardId: 'reward', rewardChoices: ['bench', 'flower', 'lantern'],
    ...(introduced ? { introducedItemIds: [subject === 'math' ? mathId : wordIds[0]] } : {}),
    slots: [{ problem: { id: 'question', categoryId: subject === 'math' ? mathId : wordIds[0], subject,
        correctAnswer: '1', inputType: 'number', isReview: false }, source: 'main', countsTowardReviewCap: false,
        assisted: false, completed: true, learningEvidenceAssistance: 'independent' }],
});
const options = () => ({ profile: profile(), island: createIsland('child', now), math: [] as MemoryState[],
    vocab: [] as MemoryState[], logs: [] as AttemptLog[], previousPlans: [] as IslandPlan[], now });

describe('Island subject scheduling', () => {
    it('serves eligible overdue work first, can repeat a subject, and caps automatic runs at two sections', () => {
        const input = { ...options(), math: [memory(mathId)], vocab: wordIds.map(id => memory(id)) };
        expect(selectIslandSubject(input).subject).toBe('vocab');
        input.previousPlans = [plan('vocab')];
        expect(selectIslandSubject(input).subject).toBe('vocab');
        input.previousPlans.push(plan('vocab', 'older'));
        expect(selectIslandSubject(input).subject).toBe('math');
        expect(input.previousPlans.map(item => item.subject)).toEqual(['vocab', 'vocab']);
    });

    it('uses oldest due date to break equal loads and rotates settled work when no review is due', () => {
        const input = { ...options(), math: [memory(mathId, '2026-08-01')], vocab: [memory(wordIds[0])] };
        expect(selectIslandSubject(input).subject).toBe('math');
        input.math[0].nextReview = '2026-09-07';
        expect(selectIslandSubject(input).subject).toBe('vocab');
        input.math[0].nextReview = input.vocab[0].nextReview = '2099-01-01';
        expect(selectIslandSubject(input).subject).toBe('math');
        input.previousPlans = [plan('math')];
        expect(selectIslandSubject(input).subject).toBe('vocab');
    });

    it.each(['math', 'vocab'] as const)('continues a newly introduced %s item only with explicit independent evidence', subject => {
        const previous = plan(subject, 'last', true), id = previous.introducedItemIds![0];
        const input = { ...options(), previousPlans: [previous], [subject === 'math' ? 'math' : 'vocab']: [memory(id, '2099-01-01')] };
        expect(selectIslandSubject(input)).toEqual({ subject, practiceItemIds: [id] });
        previous.slots[0].learningEvidenceAssistance = 'assisted';
        expect(selectIslandSubject(input).practiceItemIds).toEqual([]);
        previous.slots[0].learningEvidenceAssistance = 'independent';
        previous.slots[0].assisted = true;
        expect(selectIslandSubject(input).practiceItemIds).toEqual([]);
        previous.slots[0].assisted = false;
        const state = (subject === 'math' ? input.math : input.vocab)[0];
        state.independentCorrectAnswers = 3;
        expect(selectIslandSubject(input).practiceItemIds).toEqual([]);
        state.independentCorrectAnswers = undefined;
        expect(selectIslandSubject(input).practiceItemIds).toEqual([]);
        state.independentCorrectAnswers = 1;
        delete previous.introducedItemIds;
        expect(selectIslandSubject(input).practiceItemIds).toEqual([]);
    });

    it('compares legacy local dates and timestamp deadlines using the same clock as Due eligibility', () => {
        const input = { ...options(), math: [memory(mathId, '2026-09-01')],
            vocab: [memory(wordIds[0], new Date(2026, 8, 1, 1).toISOString())] };
        expect(selectIslandSubject(input).subject).toBe('math');
    });

    it('resets short-term continuity and run limits at the learning-day boundary', () => {
        const input = { ...options(), math: [memory(mathId)], previousPlans: [plan('math', 'last', true), plan('math', 'older')] };
        const boundary = getLearningDayStart(new Date(now)).getTime();
        input.now = boundary;
        input.previousPlans.forEach(item => { item.completedAt = boundary - 1; });
        expect(selectIslandSubject(input)).toEqual({ subject: 'math', practiceItemIds: [] });
        input.now = boundary - 1;
        expect(selectIslandSubject(input).subject).toBe('vocab');
    });

    it('honors only the exact preceding plan choice, even across a new day, and respects single-subject settings', () => {
        const input = { ...options(), previousPlans: [plan('math'), plan('math', 'older')], vocab: wordIds.map(id => memory(id)) };
        input.island.nextSubjectChoice = { afterPlanId: 'last', subject: 'math' };
        expect(selectIslandSubject(input).subject).toBe('math');
        input.previousPlans[0].completedAt = getLearningDayStart(new Date(now)).getTime() - 1;
        expect(selectIslandSubject(input).subject).toBe('math');
        input.island.nextSubjectChoice.afterPlanId = 'stale';
        expect(selectIslandSubject(input).subject).toBe('vocab');
        input.profile.subjectMode = 'math';
        expect(selectIslandSubject(input)).toEqual({ subject: 'math', practiceItemIds: [] });
        input.profile.subjectMode = 'vocab';
        expect(selectIslandSubject(input).subject).toBe('vocab');
    });

    it('does not let unknown, locked, inactive or stopped review items distort subject selection', () => {
        const input = { ...options(), math: [memory(mathId)], vocab: [memory('unknown'),
            memory(ENGLISH_WORDS.find(word => word.level === 20)!.id), memory(wordIds[0])] };
        input.logs = [0, 1, 2].map(index => ({ profileId: 'child', subject: 'vocab', itemId: wordIds[0], result: 'skipped',
            isReview: true, timestamp: new Date(now - 1000 + index).toISOString() }));
        expect(selectIslandSubject(input).subject).toBe('math');
        input.math[0].status = 'maintenance'; input.vocab = [memory(wordIds[1])];
        expect(selectIslandSubject(input).subject).toBe('vocab');
        input.math[0].status = 'retired';
        expect(selectIslandSubject(input).subject).toBe('vocab');
        input.math = [memory('unknown'), memory(getSkillsForLevel(29)[0])];
        expect(selectIslandSubject(input).subject).toBe('vocab');
    });

    it('uses the available main range and fails before scheduling when both ranges are disabled', () => {
        const input = options();
        input.profile.mathLevels!.forEach(level => { level.enabled = false; });
        expect(selectIslandSubject(input).subject).toBe('vocab');
        input.profile.vocabLevels!.forEach(level => { level.enabled = false; });
        expect(() => selectIslandSubject(input)).toThrow('No learning subject available');
    });

    it('counts outstanding math rechecks even when a bridge has no memory row', () => {
        const input = { ...options(), previousPlans: [plan('math')] };
        input.island.pendingMathChecks = [{ skillId: mathId, failedProblemId: 'earlier', failedQuestionKey: 'earlier', stage: 'independent', createdAt: now - 100 }];
        expect(selectIslandSubject(input).subject).toBe('math');
    });
});
