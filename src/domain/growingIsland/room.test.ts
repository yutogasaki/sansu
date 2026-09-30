import { describe, expect, it } from 'vitest';
import { ENGLISH_WORDS } from '../english/words';
import { applyIntent } from './commands';
import { newIsland } from './island';
import { learnedWords, patternOpen, WORD_GROUPS, wordGroupOf } from './room';

describe('the room drawn with learned words', () => {
    it('sorts every English category into one of eight colours', () => {
        const groups = new Set(ENGLISH_WORDS.map(w => wordGroupOf(w.category)));
        expect([...groups].every(id => WORD_GROUPS.some(g => g.id === id))).toBe(true);
        expect(wordGroupOf('食べ物')).toBe('food');
        expect(wordGroupOf('動詞')).toBe('move');
        // Most words land in a named group, not "other".
        expect(ENGLISH_WORDS.filter(w => wordGroupOf(w.category) === 'other').length).toBeLessThan(ENGLISH_WORDS.length * .15);
    });

    it('turns only words answered on the child\'s own into dots', () => {
        const words = learnedWords({ apple: { strength: 1, independentCorrectAnswers: 1 }, orange: { strength: 1 }, dog: { strength: 3 } },
            [{ id: 'apple', category: '食べ物' }, { id: 'orange', category: '食べ物' }, { id: 'dog', category: '動物' }]);
        expect(words).toEqual([{ id: 'apple', group: 'food' }, { id: 'dog', group: 'nature' }]);
    });

    it('opens wallpaper shapes with math levels and keeps choices free', () => {
        expect(patternOpen('dots', 0)).toBe(true);
        expect(patternOpen('rings', 12)).toBe(false);
        const state = newIsland('kid-r', 0);
        expect(() => applyIntent(state, { id: 'a', command: { type: 'decorate', pattern: 'blocks' } })).toThrow('まだ');
        state.mastery = { math: 13, vocab: 1 };
        const next = applyIntent(state, { id: 'b', command: { type: 'decorate', pattern: 'rings', rug: 2, hidden: ['move'] } }).state;
        expect(next.room).toEqual({ pattern: 'rings', rug: 2, hidden: ['move'] });
        expect(next.drops).toBe(state.drops);
    });
});
