import { describe, expect, it } from 'vitest';
import { generateVocabProblem } from './generator';
import { ENGLISH_WORDS, getWord } from './words';
import { createSeededRandom } from '../../utils/random';

describe('English catalog and choices', () => {
    it('has stable unique identities and preserves every original catalog item', () => {
        expect(ENGLISH_WORDS).toHaveLength(1184);
        expect(new Set(ENGLISH_WORDS.map(word => word.id)).size).toBe(1184);
        expect(new Set(ENGLISH_WORDS.map(word => word.surface ?? word.id)).size).toBe(1173);
        expect(Array.from({ length: 20 }, (_, i) => ENGLISH_WORDS.filter(word => word.level === i + 1).length))
            .toEqual([60, 59, 60, 60, 60, 60, 60, 59, 60, 60, 60, 60, 60, 60, 60, 59, 60, 60, 60, 47]);
        expect(getWord('orange')?.japanese).toBe('オレンジ');
        expect(getWord('orange_lv2')?.japanese).toBe('オレンジいろ');
    });

    it.each([false, true])('every word produces four unique rendered choices (kanji=%s)', kanjiMode => {
        for (const word of ENGLISH_WORDS) {
            // Sweep normal generation and complete cooldown exhaustion.
            for (const cooldownIds of [[], ENGLISH_WORDS.map(item => item.id)]) {
                const problem = generateVocabProblem(word.id, {
                    kanjiMode, cooldownIds, random: createSeededRandom(`${word.id}:${kanjiMode}:${cooldownIds.length}`),
                });
                const choices = problem.inputConfig?.choices ?? [];
                expect(choices, word.id).toHaveLength(4);
                expect(new Set(choices.map(choice => choice.label)).size, word.id).toBe(4);
                expect(new Set(choices.map(choice => choice.value)).size, word.id).toBe(4);
                expect(choices.filter(choice => choice.value === word.id), word.id).toHaveLength(1);
                for (const choice of choices.filter(choice => choice.value !== word.id)) {
                    const distractor = getWord(choice.value)!;
                    expect(distractor.surface ?? distractor.id).not.toBe(word.surface ?? word.id);
                }
                expect(problem.questionText).toBe(word.surface ?? word.id);
                expect(problem.correctAnswer).toBe(word.id);
                expect(choices.find(choice => choice.value === word.id)?.label).toBe(problem.displayAnswer);
            }
        }
    });

    it('keeps an explicit random stream deterministic independent of ambient randomness', () => {
        const make = () => generateVocabProblem('orange_lv2', { random: createSeededRandom('same') });
        expect(make()).toEqual(make());
        expect(make().questionText).toBe('orange');
    });
});
