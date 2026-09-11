import { describe, expect, it } from 'vitest';
import { ENGLISH_EXAMPLE_SENTENCES, getEnglishExampleSentence } from './examples';
import { ENGLISH_WORDS } from './words';

describe('vocabulary example catalog', () => {
    it('covers every level 1–3 vocabulary item with a short fixed English sentence', () => {
        const coveredWords = ENGLISH_WORDS.filter(word => word.level <= 3);
        const coveredWordIds = new Set(coveredWords.map(word => word.id));
        const wordIds = new Set(ENGLISH_WORDS.map(word => word.id));

        expect(ENGLISH_EXAMPLE_SENTENCES).toHaveLength(coveredWords.length);
        expect(new Set(ENGLISH_EXAMPLE_SENTENCES.map(sentence => sentence.wordId)).size)
            .toBe(ENGLISH_EXAMPLE_SENTENCES.length);

        for (const sentence of ENGLISH_EXAMPLE_SENTENCES) {
            expect(sentence.wordId).toMatch(/^[a-z][a-z0-9_]*$/);
            expect(wordIds.has(sentence.wordId)).toBe(true);
            expect(coveredWordIds.has(sentence.wordId)).toBe(true);
            expect(sentence.english.endsWith('.')).toBe(true);
            expect(sentence.english.split(/\s+/).length).toBeGreaterThanOrEqual(3);
            expect(sentence.english.split(/\s+/).length).toBeLessThanOrEqual(7);
        }

        for (const word of coveredWords) expect(getEnglishExampleSentence(word.id)).toBeTruthy();
    });

    it('does not invent text for an unlisted or non-vocabulary item', () => {
        expect(getEnglishExampleSentence('not-a-word')).toBeUndefined();
        expect(getEnglishExampleSentence('add')).toBeUndefined();
    });
});
