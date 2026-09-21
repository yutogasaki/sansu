import { describe, expect, it } from 'vitest';
import { getParentAttemptLabel, getParentMathSkillLabel, getParentVocabWordLabel } from './parentAttemptLabel';

describe('getParentAttemptLabel', () => {
    const words = new Map([
        ['apple', {}],
        ['orange', { surface: 'orange' }],
        ['legacy-word-id', { surface: 'presented word' }],
    ]);

    it('uses human-readable labels for math skills instead of internal IDs', () => {
        expect(getParentAttemptLabel('math', 'add_finger', words)).toBe('ゆびたしざん');
        expect(getParentMathSkillLabel('add_finger')).toBe('ゆびたしざん');
        expect(getParentMathSkillLabel('legacy_skill')).toBe('学習項目');
        expect(getParentAttemptLabel('math', 'legacy_skill', words)).toBe('学習項目');
    });

    it('uses the displayed vocabulary word and never exposes unknown IDs', () => {
        expect(getParentAttemptLabel('vocab', 'apple', words)).toBe('apple');
        expect(getParentAttemptLabel('vocab', 'orange', words)).toBe('orange');
        expect(getParentVocabWordLabel('legacy-word-id', words)).toBe('presented word');
        expect(getParentAttemptLabel('vocab', 'unknown_word', words)).toBe('単語');
        expect(getParentVocabWordLabel('unknown_word', words)).toBe('単語');
    });
});
