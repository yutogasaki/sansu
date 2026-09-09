import { describe, expect, it } from 'vitest';
import type { LevelState, Problem } from '../types';
import { completeListeningAnswer, emptyListeningSession, LISTENING_SENTENCES } from './listening';
import { ENGLISH_WORDS } from './words';
import { ISLAND_GLYPH_LABELS } from '../../components/island/islandGlyphs';

const levels: LevelState[] = [{ level: 1, enabled: true, unlocked: true, recentAnswersNonReview: [] }];
const problem = (i: number, wordId = 'apple', subject: 'vocab' | 'math' = 'vocab'): Problem => ({
    id: `p${i}`, subject, categoryId: wordId, inputType: 'choice', questionText: wordId, correctAnswer: 'りんご', isReview: false,
});
const six = () => Array.from({ length: 6 }, (_, i) => problem(i)).reduce((s, p) => completeListeningAnswer(s, p, false, levels), emptyListeningSession());

describe('optional listening, outside learning progression', () => {
    it('waits for six whole English answers and a section boundary', () => {
        let state = emptyListeningSession();
        for (let i = 0; i < 5; i++) state = completeListeningAnswer(state, problem(i), true, levels);
        expect(state.sentence).toBeUndefined();
        state = completeListeningAnswer(state, problem(5), false, levels);
        expect(state.sentence).toBeUndefined();
        const offered = completeListeningAnswer(state, problem(6), true, levels);
        expect(offered.sentence?.wordId).toBe('apple');
        expect(offered.open).toBe(false);
        expect(completeListeningAnswer(offered, problem(7), true, levels)).toBe(offered);
    });
    it('does not count duplicate receipts or math; a later mixed section can be the boundary', () => {
        const state = six();
        expect(completeListeningAnswer(state, problem(0), false, levels)).toBe(state);
        const next = completeListeningAnswer(state, problem(8, 'add', 'math'), true, levels);
        expect(next.completedIds).toHaveLength(6);
        expect(next.sentence?.wordId).toBe('apple');
        expect(completeListeningAnswer(emptyListeningSession(), problem(9, 'add', 'math'), true, levels).sentence).toBeUndefined();
    });
    it('omits unsupported, disabled and locked vocabulary without changing the problem or levels', () => {
        const before = JSON.stringify(levels);
        const state = six();
        expect(completeListeningAnswer(state, problem(6), true, []).sentence).toBeUndefined();
        expect(completeListeningAnswer(state, problem(6), true, [{ ...levels[0], enabled: false }]).sentence).toBeUndefined();
        expect(completeListeningAnswer(state, problem(6), true, [{ ...levels[0], unlocked: false }]).sentence).toBeUndefined();
        const unknown = { ...state, recentWordIds: ['unknown'] };
        expect(completeListeningAnswer(unknown, problem(6, 'unknown'), true, levels).sentence).toBeUndefined();
        expect(JSON.stringify(levels)).toBe(before);
        expect(state.sentence).toBeUndefined();
        expect(emptyListeningSession()).toEqual({ completedIds: [], recentWordIds: [], offered: false, open: false });
    });
    it('pairs every authored sentence with an existing sense, illustration, and Japanese sentence', () => {
        expect(new Set(LISTENING_SENTENCES.map(s => s.id)).size).toBe(LISTENING_SENTENCES.length);
        for (const sentence of LISTENING_SENTENCES) {
            expect(ENGLISH_WORDS.some(word => word.id === sentence.wordId)).toBe(true);
            expect(ISLAND_GLYPH_LABELS[sentence.glyph]).toBeTruthy();
            expect(sentence.japanese.endsWith('。')).toBe(true);
            expect(sentence.japaneseKanji.endsWith('。')).toBe(true);
            expect(sentence.english.split(' ').length).toBeGreaterThanOrEqual(3);
            expect(sentence.english.split(' ').length).toBeLessThanOrEqual(7);
        }
    });
});
