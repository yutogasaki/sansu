import { describe, expect, it } from 'vitest';
import { ENGLISH_EXAMPLE_SENTENCES, getEnglishExampleSentence } from './examples';
import { ENGLISH_WORDS } from './words';

describe('vocabulary example catalog', () => {
    it.each([
        ['hard', 'This stone is hard.'], ['apply', 'I apply for a new job.'],
        ['measure', 'This measure keeps children safe.'], ['present', 'We live in the present.'],
        ['age', 'This was an age of discovery.'], ['heart', 'She has a kind heart.'],
        ['sound', 'Your idea can sound good.'], ['free', 'I am free after school.'],
        ['step', 'This is the next step in learning.'], ['sense', 'I have a good sense of smell.'],
        ['potential', 'This is a potential problem.'], ['cold', 'I feel cold in winter.'],
        ['back', 'The garden is back there.'], ['atmosphere', 'The atmosphere surrounds the earth.'],
        ['pick', 'I pick a coin off the floor.'], ['act', 'We act to protect the forest.'],
        ['form', 'The cloud has a round form.'], ['clear', 'The meaning is clear to me.'],
        ['secure', 'We secure seats for the show.'], ['establish', 'They establish a new school.'],
    ])('keeps the reviewed example for the adopted sense of %s', (id, sentence) => {
        expect(getEnglishExampleSentence(id)).toBe(sentence);
    });
    it('covers every vocabulary item with a short fixed English sentence', () => {
        const coveredWords = ENGLISH_WORDS;
        const coveredWordIds = new Set(coveredWords.map(word => word.id));
        const wordIds = new Set(ENGLISH_WORDS.map(word => word.id));

        expect(ENGLISH_EXAMPLE_SENTENCES).toHaveLength(coveredWords.length);
        expect(new Set(ENGLISH_EXAMPLE_SENTENCES.map(sentence => sentence.wordId)).size)
            .toBe(ENGLISH_EXAMPLE_SENTENCES.length);

        for (const sentence of ENGLISH_EXAMPLE_SENTENCES) {
            expect(sentence.wordId).toMatch(/^[A-Za-z][A-Za-z0-9_ ]*$/);
            expect(wordIds.has(sentence.wordId)).toBe(true);
            expect(coveredWordIds.has(sentence.wordId)).toBe(true);
            const word = coveredWords.find(candidate => candidate.id === sentence.wordId);
            const surface = word?.surface ?? word?.id;
            expect(surface).toBeTruthy();
            if (!surface) continue;
            const surfacePattern = surface.split(/\s+/).map(part => `\\b${part}\\b`).join('\\s+');
            expect(sentence.english).toMatch(new RegExp(surfacePattern, 'i'));
            expect(sentence.english.endsWith('.')).toBe(true);
            expect(sentence.english.split(/\s+/).length).toBeGreaterThanOrEqual(3);
            expect(sentence.english.split(/\s+/).length).toBeLessThanOrEqual(7);
        }

        for (const word of coveredWords) expect(getEnglishExampleSentence(word.id)).toBeTruthy();
    });

    it('keeps separate contexts for repeated display spellings', () => {
        const examplesBySurface = new Map<string, string[]>();

        for (const word of ENGLISH_WORDS) {
            const sentence = getEnglishExampleSentence(word.id);
            expect(sentence).toBeTruthy();
            if (!sentence) continue;

            const surface = word.surface ?? word.id;
            examplesBySurface.set(surface, [
                ...(examplesBySurface.get(surface) ?? []),
                sentence,
            ]);
        }

        for (const sentences of examplesBySurface.values()) {
            if (sentences.length > 1) expect(new Set(sentences).size).toBe(sentences.length);
        }
    });

    it('does not invent text for an unlisted or non-vocabulary item', () => {
        expect(getEnglishExampleSentence('not-a-word')).toBeUndefined();
        expect(getEnglishExampleSentence('add')).toBeUndefined();
    });
});
