import { describe, expect, it } from 'vitest';
import { createInitialProfile } from '../user/profile';
import { createDefaultMemoryState } from '../types';
import { generateMathProblem } from './index';
import { MATH_FOUNDATIONS, isMathFoundation } from './foundationConfig';
import { pendingMathFoundation } from './foundationPlanning';
import { planMathProblems } from './planner';
import { getAvailableSkills, getSkillsForLevel } from './curriculum';
import { createSeededRandom } from '../../utils/random';
import { createLearningProblemContext, validateLearningEvidenceContext } from '../learning/context';
import { buildPrintableMathPrompt } from '../test/printability';

const make = (level: number) => ({ ...createInitialProfile('new', 1, level, 1, 'math'), mathMainLevel: level, mathMaxUnlocked: level });
const complete = (profile: ReturnType<typeof make>, id: string) => {
    profile.mathSkills[id] = { ...createDefaultMemoryState(id, 'math', true), independentCorrectAnswers: 3 };
};

describe('short foundations before calculation', () => {
    it('reserves different introduction steps within a frozen block instead of skipping comparison', () => {
        const profile = make(19);
        complete(profile, 'foundation_tens');
        const plan = planMathProblems({ profile, count: 2, random: () => 0 });
        expect(plan.map(item => item.skillId)).toEqual(['foundation_decimal', 'foundation_decimal']);
        expect(plan.map(item => item.preferredVariant)).toEqual(['intro-0', 'intro-1']);
        const problems = plan.map(item => generateMathProblem(item.skillId, {
            profile, random: () => 0, preferredLearningVariant: item.preferredVariant,
        }));
        expect(problems[0].questionVisual?.kind).toBe('fraction-strips');
        expect(problems[1]).toMatchObject({ inputType: 'choice', questionText: '0.1 □ 0.11', correctAnswer: '<' });
        profile.mathSkills.foundation_decimal = { ...createDefaultMemoryState('foundation_decimal', 'math', true), independentCorrectAnswers: 2 };
        const [next] = planMathProblems({ profile, count: 1, random: () => 0 });
        expect(next.preferredVariant).toBe('intro-2');
        expect(generateMathProblem(next.skillId, { profile, random: () => 0, preferredLearningVariant: next.preferredVariant }).questionText).toBe('0.1 を10倍すると？');
    });
    it('preserves all 118 level memberships and opens supporting content only at its starting level', () => {
        expect(Array.from({ length: 29 }, (_, i) => getSkillsForLevel(i)).flat()).toHaveLength(118);
        expect(getAvailableSkills(28)).toHaveLength(127);
        expect(getAvailableSkills(10).some(isMathFoundation)).toBe(false);
        expect(getAvailableSkills(18)).not.toContain('foundation_decimal');
    });
    it('introduces place value, then decimal quantity before decimal operations', () => {
        const profile = make(19);
        expect(pendingMathFoundation('dec_add', profile, () => true)).toBe('foundation_tens');
        complete(profile, 'foundation_tens');
        expect(pendingMathFoundation('dec_add', profile, () => true)).toBe('foundation_decimal');
        complete(profile, 'foundation_decimal');
        expect(pendingMathFoundation('dec_add', profile, () => true)).toBeUndefined();
    });
    it('leaves existing independently practiced calculations usable and revisits foundations after an error', () => {
        const profile = make(19);
        complete(profile, 'dec_add');
        expect(pendingMathFoundation('dec_add', profile, () => true)).toBeUndefined();
        profile.recentAttempts = [{ id: 'error', timestamp: '', subject: 'math', skillId: 'dec_add', result: 'incorrect' }];
        expect(pendingMathFoundation('dec_add', profile, () => true)).toBe('foundation_tens');
        complete(profile, 'foundation_tens'); complete(profile, 'foundation_decimal');
        expect(pendingMathFoundation('dec_add', profile, () => true)).toBe('foundation_decimal');
        profile.recentAttempts.push({ id: 'recover', timestamp: '', subject: 'math', skillId: 'foundation_decimal', result: 'correct', assistance: 'assisted' });
        expect(pendingMathFoundation('dec_add', profile, () => true)).toBe('foundation_decimal');
        profile.recentAttempts.push({ id: 'independent', timestamp: '', subject: 'math', skillId: 'foundation_decimal', result: 'correct', assistance: 'independent' });
        expect(pendingMathFoundation('dec_add', profile, () => true)).toBeUndefined();
    });
    it('respects due priority, skip, parent disable, caller exclusion and per-block cap', () => {
        const profile = make(19);
        const plan = (options = {}) => planMathProblems({ profile, count: 1, random: () => 0, ...options });
        expect(plan()[0].skillId).toBe('foundation_tens');
        expect(plan({ dueSkillIds: ['count_10'] })[0]).toMatchObject({ skillId: 'count_10', source: 'due' });
        expect(plan({ skippedTodayIds: ['foundation_tens', 'foundation_decimal'] })[0].skillId).toBe('dec_add');
        expect(plan({ isSkillEligible: (id: string) => !isMathFoundation(id) })[0].skillId).toBe('dec_add');
        const bounded = planMathProblems({ profile, count: 6, random: () => 0, sameSkillLimit: 2 });
        expect(bounded.filter(item => item.skillId === 'foundation_tens')).toHaveLength(2);
        profile.mathLevels = profile.mathLevels?.map(level => [11, 19].includes(level.level) ? { ...level, enabled: false } : level);
        expect(plan()).toEqual([]);
    });
    it.each(Object.keys(MATH_FOUNDATIONS))('has bounded, truthful pictures and printable prompts for %s', id => {
        const random = createSeededRandom(id);
        const profile = make(28);
        for (let progress = 0; progress < 3; progress++) {
            profile.mathSkills[id] = { ...createDefaultMemoryState(id, 'math', true), independentCorrectAnswers: progress };
            for (let i = 0; i < 30; i++) {
                const problem = generateMathProblem(id, { random, profile });
                expect(problem.learningContext?.representation).toBe('bridge');
                expect(problem.learningContext?.catalogVersion).toBe('curriculum-v2');
                if (problem.questionVisual) expect(problem.questionVisual.prompt).toBe(problem.questionText);
                if (problem.questionVisual?.kind === 'fraction-strips') {
                    for (const group of problem.questionVisual.groups) expect(group.filled >= 0 && group.filled <= group.parts && group.parts >= 2 && group.parts <= 10).toBe(true);
                }
                expect(buildPrintableMathPrompt(problem)).toContain(problem.questionText!.replace(/□/g, '[   ]'));
                expect(validateLearningEvidenceContext({ problem: problem.learningContext, assistance: 'independent', completion: 'whole-problem' }, 'math', id)).toBeDefined();
                const old = createLearningProblemContext('math', problem, 'curriculum-v1');
                expect(validateLearningEvidenceContext({ problem: old, assistance: 'independent', completion: 'whole-problem' }, 'math', id)).toBeUndefined();
            }
        }
    });
});
