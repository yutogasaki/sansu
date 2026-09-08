import { describe, expect, it, vi } from 'vitest';
import { createLearningProblemContext, validateLearningEvidenceContext } from './context';
import { generateMathProblem } from '../math';
import { getSkillsForLevel } from '../math/curriculum';
import { generateVocabProblem } from '../english/generator';
import type { Problem } from '../types';
import { validateLearningCatalog } from './catalog';
import { MATH_LEARNING_UNITS } from './mathCatalog';
import { createSeededRandom } from '../../utils/random';

describe('frozen learning context', () => {
    it('does not consume randomness and fingerprints content rather than instance or choice order', () => {
        const problem: Problem = {
            id: 'one', subject: 'math', isReview: false, categoryId: 'add_2d1d_nc',
            questionText: '23 + 4 =', correctAnswer: '27', inputType: 'number',
        };
        const random = vi.spyOn(Math, 'random').mockImplementation(() => { throw new Error('Unexpected RNG'); });
        try {
            const context = createLearningProblemContext('math', problem);
            expect(context).toEqual(createLearningProblemContext('math', { ...problem, id: 'two', isReview: true } as Problem));
            expect(context?.problemKey).not.toBe(createLearningProblemContext('math', { ...problem, questionText: '24 + 4 =', correctAnswer: '28' })?.problemKey);
            expect(random).not.toHaveBeenCalled();
        } finally { random.mockRestore(); }
        const vocab = generateVocabProblem('orange_lv2', { random: () => 0.3 });
        expect(createLearningProblemContext('vocab', vocab)).toEqual(createLearningProblemContext('vocab', {
            ...vocab, inputConfig: { ...vocab.inputConfig, choices: [...vocab.inputConfig!.choices!].reverse() },
        }));
    });

    it('classifies the actual subtraction problem and refuses to guess malformed equations', () => {
        const problem = { categoryId: 'sub_2d2d', questionText: '43 - 12 =', correctAnswer: '31', inputType: 'number' as const };
        expect(createLearningProblemContext('math', problem)?.variant).toBe('no-regroup');
        expect(createLearningProblemContext('math', { ...problem, questionText: '41 - 12 =', correctAnswer: '29' })?.variant).toBe('regroup');
        expect(createLearningProblemContext('math', { ...problem, questionText: 'choose a number' })?.variant).toBe('unknown');
        expect(createLearningProblemContext('math', { ...problem, correctAnswer: '50' })?.variant).toBe('unknown');
    });

    it('records reserved hissan separately and validates all Lv11 generated contexts', () => {
        for (const skill of getSkillsForLevel(11)) {
            const problem = generateMathProblem(skill, { random: createSeededRandom(skill) });
            const context = createLearningProblemContext('math', problem)!;
            expect(validateLearningEvidenceContext({ problem: context, assistance: 'independent', completion: 'whole-problem' }, 'math', skill)).toBeDefined();
            const hissan = createLearningProblemContext('math', { ...problem, inputType: 'hissan' })!;
            expect(hissan.representation).toBe('algorithm');
            expect(validateLearningEvidenceContext({ problem: hissan, assistance: 'independent', completion: 'whole-problem' }, 'math', skill)).toBeDefined();
        }
    });

    it('rejects absent, future-version, mismatched and incomplete evidence', () => {
        const problem = createLearningProblemContext('math', generateMathProblem('add_2d1d_nc'))!;
        const valid = { problem, assistance: 'independent', completion: 'whole-problem' };
        expect(validateLearningEvidenceContext(undefined, 'math', problem.itemId)).toBeUndefined();
        for (const bad of [
            { ...valid, completion: 'one-step' }, { ...valid, assistance: 'probably' },
            { ...valid, problem: { ...problem, catalogVersion: 'future' } },
            { ...valid, problem: { ...problem, unitId: 'math.subtract-two-one-no-regroup' } },
            { ...valid, problem: { ...problem, problemKey: '' } },
            { ...valid, problem: { ...problem, representation: 'recognition' } },
        ]) expect(validateLearningEvidenceContext(bad, 'math', problem.itemId)).toBeUndefined();
        expect(validateLearningEvidenceContext(valid, 'math', 'sub_2d1d_nc')).toBeUndefined();
        expect(validateLearningEvidenceContext(valid, 'vocab', problem.itemId)).toBeUndefined();
    });

    it('binds borrowing, item and input form to the actual frozen content', () => {
        const problem = createLearningProblemContext('math', {
            categoryId: 'sub_2d2d', questionText: '35 - 12 =', correctAnswer: '23', inputType: 'number',
        })!;
        const evidence = { problem, assistance: 'independent', completion: 'whole-problem' };
        for (const forged of [
            { ...problem, variant: 'regroup' },
            { ...problem, problemKey: 'opaque-key' },
            { ...problem, inputType: 'hissan', representation: 'algorithm' },
        ]) expect(validateLearningEvidenceContext({ ...evidence, problem: forged }, 'math', 'sub_2d2d')).toBeUndefined();
    });

    it('detects invalid prerequisite cycles and missing references', () => {
        expect(validateLearningCatalog()).toEqual([]);
        const unit = MATH_LEARNING_UNITS[0];
        expect(validateLearningCatalog([{ ...unit, prerequisites: [unit.id, 'missing'] }], []))
            .toEqual(expect.arrayContaining([`Prerequisite cycle: ${unit.id}`, `Invalid prerequisite: ${unit.id}/missing`]));
    });
});
