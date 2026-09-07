import { getMathSkillMetadata, isMathSkillUnlockedForProfile } from '../math/curriculum';
import type { Problem, UserProfile } from '../types';
import type { LearningSlot } from '../park/types';
import type { IslandMathCheck } from './types';

const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, canonical(child)])) : value;

/** A new reservation ID alone is not evidence of a new question. Choice order is not part of the answer. */
export function mathCheckQuestionKey(problem: Problem): string {
    const visual = problem.questionVisual?.kind === 'reference-choice-grid'
        ? { kind: problem.questionVisual.kind, reference: problem.questionVisual.grid.reference }
        : problem.questionVisual;
    return JSON.stringify(canonical({ skillId: problem.categoryId, text: problem.questionText,
        visual, answer: problem.correctAnswer }));
}

export function updateIslandMathChecks(
    previous: readonly IslandMathCheck[] | undefined,
    slot: LearningSlot,
    outcome: 'needs-support' | 'correct-final' | 'partial',
    now: number,
): IslandMathCheck[] | undefined {
    if (slot.problem.subject !== 'math' || outcome === 'partial') return previous ? [...previous] : undefined;
    const skillId = slot.problem.categoryId;
    if (outcome === 'needs-support') {
        const existing = previous?.find(check => check.skillId === skillId);
        const check: IslandMathCheck = {
            skillId, failedProblemId: slot.problem.id, failedQuestionKey: mathCheckQuestionKey(slot.problem),
            stage: getMathSkillMetadata(skillId).reviewFallbackSkillIds?.length ? 'bridge' : 'independent',
            createdAt: existing?.createdAt ?? now,
        };
        return existing ? previous!.map(item => item.skillId === skillId ? check : item) : [...(previous ?? []), check];
    }
    if (!previous) return undefined;
    return previous.flatMap(check => {
        if (!slot.assisted && check.skillId === skillId && check.failedProblemId !== slot.problem.id
            && check.failedQuestionKey !== mathCheckQuestionKey(slot.problem)) return [];
        // A completed bridge can be guided. It never clears the original independent check.
        if (check.stage === 'bridge' && getMathSkillMetadata(check.skillId).reviewFallbackSkillIds?.includes(skillId)) {
            return [{ ...check, stage: 'independent' as const }];
        }
        return [check];
    });
}

export function getIslandMathRemediationSkillIds(checks: readonly IslandMathCheck[] | undefined, profile: UserProfile): string[] {
    const ids = (checks ?? []).map(check => {
        const bridge = check.stage === 'bridge' ? getMathSkillMetadata(check.skillId).reviewFallbackSkillIds
            ?.find(id => isMathSkillUnlockedForProfile(id, profile)) : undefined;
        return bridge ?? check.skillId;
    }).filter(id => isMathSkillUnlockedForProfile(id, profile));
    return [...new Set(ids)];
}
