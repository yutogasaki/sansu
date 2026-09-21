import type { RecentAttempt } from '../../domain/types';
import { MATH_SKILL_LABELS } from '../../domain/math/labels';

type ParentVocabWord = { surface?: string | null; japanese?: string | null };

export function getParentMathSkillLabel(skillId: string): string {
    return MATH_SKILL_LABELS[skillId] ?? '学習項目';
}

export function getParentVocabWordLabel(
    skillId: string,
    vocabWordMap: ReadonlyMap<string, ParentVocabWord>,
): string {
    const word = vocabWordMap.get(skillId);
    if (!word) return '単語';

    // Most catalog IDs are already their visible English spelling; `surface`
    // is only present when the display spelling differs from that ID.
    return word.surface?.trim() || skillId;
}

export function getParentAttemptLabel(
    subject: RecentAttempt['subject'],
    skillId: string,
    vocabWordMap: ReadonlyMap<string, ParentVocabWord>,
): string {
    if (subject === 'math') return getParentMathSkillLabel(skillId);
    return getParentVocabWordLabel(skillId, vocabWordMap);
}
