import { describe, expect, it } from 'vitest';
import { generateMathProblem } from './index';
import { createSeededRandom } from '../../utils/random';
import { MATH_CONTENT_VARIANTS } from './contentVariants';
import { createLearningProblemContext, validateLearningEvidenceContext } from '../learning/context';
import { buildPeriodicTestSet } from '../test/testSet';
import { createInitialProfile } from '../user/profile';
import { getSkillsForLevel } from './curriculum';
import { getLearningItemMapping } from '../learning/catalog';
import { evaluateFinishCoverage, isRepresentativeMathContent } from '../finishCoverage';
import type { AttemptLog } from '../../db';
import { planMathProblems } from './planner';

describe('reviewed content and finish facets', () => {
    it('keeps quotient-one at one in five in the actual normal planner too', () => {
        const profile = { ...createInitialProfile('audit', 1, 18, 1, 'math'), mathMainLevel: 18, mathMaxUnlocked: 18 };
        const plan = planMathProblems({ profile, count: 10, random: () => 0,
            isSkillEligible: id => id === 'div_2d2d_exact' });
        expect(plan).toHaveLength(10);
        expect(plan.filter(item => item.preferredVariant === 'quotient-one')).toHaveLength(2);
        expect(plan.filter(item => item.preferredVariant === 'quotient-many')).toHaveLength(8);
    });
    it('rejects malformed versions and content outside the typed exercise range', () => {
        const problem = generateMathProblem('speed_basic', { random: () => 0 });
        expect(validateLearningEvidenceContext({ problem: { ...problem.learningContext, catalogVersion: ['curriculum-v2'] },
            assistance: 'independent', completion: 'whole-problem' }, 'math', 'speed_basic')).toBeUndefined();
        expect(createLearningProblemContext('math', { categoryId: 'div_2d2d_exact', inputType: 'number', questionText: '00 ÷ 10 =', correctAnswer: '0' })?.variant).toBe('unknown');
        expect(createLearningProblemContext('math', { categoryId: 'average_basic', inputType: 'number', questionText: '1、1、2 の へいきんは？', correctAnswer: String(4 / 3) })?.variant).toBe('unknown');
    });
    it.each(Object.entries(MATH_CONTENT_VARIANTS))('generates and validates every requested facet of %s', (id, variants) => {
        const random = createSeededRandom(id);
        for (const variant of variants) for (let i = 0; i < 60; i++) {
            const problem = generateMathProblem(id, { random, preferredLearningVariant: variant });
            expect(problem.learningContext?.variant, problem.questionText).toBe(variant);
            expect(validateLearningEvidenceContext({ problem: problem.learningContext, assistance: 'independent', completion: 'whole-problem' }, 'math', id)).toBeDefined();
            const wrong = createLearningProblemContext('math', { ...problem, correctAnswer: 'wrong' });
            expect(wrong?.variant).toBe('unknown');
        }
    });

    it('uses non-midpoint averages with exact integer or one-place decimal answers', () => {
        const random = createSeededRandom('averages-audit');
        const answers = new Set<string>();
        for (let i = 0; i < 1200; i++) {
            const problem = generateMathProblem('average_basic', { random });
            const numbers = problem.questionText!.split(' の ')[0].split('、').map(Number);
            expect(numbers.length).toBeGreaterThanOrEqual(3);
            expect(numbers.length).toBeLessThanOrEqual(5);
            expect(numbers.every(n => Number.isInteger(n) && n > 0)).toBe(true);
            expect(numbers.reduce((a, b) => a + b, 0) / numbers.length).toBeCloseTo(Number(problem.correctAnswer));
            expect(isRepresentativeMathContent('average_basic', problem.questionText)).toBe(true);
            answers.add(problem.learningContext!.variant);
        }
        expect(answers).toEqual(new Set(['integer', 'decimal']));
    });

    it('balances quotient one while retaining valid two-digit dividends and divisors', () => {
        const random = createSeededRandom('division-distribution');
        let ones = 0;
        const quotients = new Set<number>();
        for (let i = 0; i < 5000; i++) {
            const problem = generateMathProblem('div_2d2d_exact', { random });
            const [a, b] = problem.questionText!.match(/\d+/g)!.map(Number);
            const q = Number(problem.correctAnswer);
            expect(a >= 10 && a <= 99 && b >= 10 && b <= 99 && a === b * q).toBe(true);
            quotients.add(q);
            if (q === 1) ones++;
        }
        expect(ones / 5000).toBeGreaterThan(0.17);
        expect(ones / 5000).toBeLessThan(0.23);
        expect(quotients).toEqual(new Set([1, 2, 3, 4, 5, 6, 7, 8, 9]));
    });

    it.each([13, 14, 18, 24, 25, 26, 27, 28])('includes all required content facets in the frozen Lv%s finish set', level => {
        const profile = { ...createInitialProfile('audit', 1, level, 1, 'math'), mathMainLevel: level, mathMaxUnlocked: level };
        const set = buildPeriodicTestSet(profile, 'math');
        const required = new Set(getSkillsForLevel(level).flatMap(id => {
            const mapping = getLearningItemMapping('math', id)!;
            return mapping.variants.map(variant => `${mapping.unitId}/${variant}`);
        }));
        const actual = new Set(set.problems.map(problem => `${problem.learningContext!.unitId}/${problem.learningContext!.variant}`));
        expect(actual).toEqual(required);
        expect(set.problems).toHaveLength(20);
    });

    it('preserves v1 frozen evidence without upgrading default into specific v2 facets', () => {
        const profile = { ...createInitialProfile('audit', 1, 28, 1, 'math'), mathMainLevel: 28, mathMaxUnlocked: 28 };
        const random = createSeededRandom('legacy-speed');
        const logs: AttemptLog[] = Array.from({ length: 20 }, (_, i) => {
            const problem = generateMathProblem('speed_basic', { random });
            const context = createLearningProblemContext('math', problem, 'curriculum-v1')!;
            const learningEvidence = { problem: context, assistance: 'independent' as const, completion: 'whole-problem' as const };
            expect(validateLearningEvidenceContext(learningEvidence, 'math', 'speed_basic')?.problem.catalogVersion).toBe('curriculum-v1');
            return { id: i + 1, profileId: profile.id, subject: 'math', itemId: 'speed_basic', result: 'correct', isReview: false,
                timestamp: '2026-10-01T00:00:00Z', learningEvidence } as AttemptLog;
        });
        const readiness = evaluateFinishCoverage(profile, 'math', logs, '2026-10-01T01:00:00Z');
        expect(readiness).toMatchObject({ coverageReady: false, coveredCount: 0, requiredCount: 3, recentCount: 20, recentCorrect: 20 });
    });
});
