import { describe, expect, it } from 'vitest';
import { ENGLISH_EXAMPLE_SENTENCES, getEnglishExampleSentence } from './examples';
import { ENGLISH_WORDS } from './words';

describe('vocabulary example catalog', () => {
    it('covers every level 1 vocabulary item with a short fixed English sentence', () => {
        const levelOne = ENGLISH_WORDS.filter(word => word.level === 1);
        const wordIds = new Set(ENGLISH_WORDS.map(word => word.id));

        expect(ENGLISH_EXAMPLE_SENTENCES).toHaveLength(levelOne.length);
        expect(new Set(ENGLISH_EXAMPLE_SENTENCES.map(sentence => sentence.wordId)).size)
            .toBe(ENGLISH_EXAMPLE_SENTENCES.length);

        for (const sentence of ENGLISH_EXAMPLE_SENTENCES) {
            expect(sentence.wordId).toMatch(/^[a-z]+$/);
            expect(wordIds.has(sentence.wordId)).toBe(true);
            expect(sentence.english.endsWith('.')).toBe(true);
            expect(sentence.english.split(/\s+/).length).toBeGreaterThanOrEqual(3);
            expect(sentence.english.split(/\s+/).length).toBeLessThanOrEqual(7);
        }

        for (const word of levelOne) expect(getEnglishExampleSentence(word.id)).toBeTruthy();
    });

    it('does not invent text for an unlisted or non-vocabulary item', () => {
        expect(getEnglishExampleSentence('not-a-word')).toBeUndefined();
        expect(getEnglishExampleSentence('add')).toBeUndefined();
    });
});
