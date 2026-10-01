import type { UserProfile } from '../types';
import { getLearningItemMapping, getLearningUnit } from '../learning/catalog';
import { independentCorrectCount } from '../learning/independentProgress';
import { isMathFoundation } from './foundationConfig';

/** Select a short introduction without reinterpreting saved progress as mastery. */
export function pendingMathFoundation(skillId: string, profile: UserProfile, eligible: (id: string) => boolean): string | undefined {
    if (isMathFoundation(skillId)) return undefined;
    const attempts = profile.recentAttempts ?? [];
    const latest = [...attempts].reverse().find(attempt => attempt.subject === 'math' && attempt.skillId === skillId);
    const needsRecovery = latest && (latest.result !== 'correct' || latest.assistance === 'assisted');
    if (independentCorrectCount(profile.mathSkills?.[skillId]) >= 3 && !needsRecovery) return undefined;
    const root = getLearningItemMapping('math', skillId)?.unitId;
    if (!root) return undefined;
    const visited = new Set<string>();
    const collect = (unitId: string): string[] => {
        if (visited.has(unitId)) return [];
        visited.add(unitId);
        const unit = getLearningUnit(unitId);
        if (!unit) return [];
        return [...unit.prerequisites.flatMap(collect), ...unit.itemIds.filter(isMathFoundation)];
    };
    const candidates = collect(root);
    for (const id of candidates) {
        if (!eligible(id)) continue;
        if (independentCorrectCount(profile.mathSkills?.[id]) < 3) return id;
    }
    if (needsRecovery) {
        // Once a foundation has been independently answered after the error,
        // return to the calculation. Ring order is authoritative, not clocks.
        const errorIndex = attempts.lastIndexOf(latest!);
        const recovered = attempts.slice(errorIndex + 1).some(attempt => attempt.subject === 'math'
            && candidates.includes(attempt.skillId) && attempt.result === 'correct' && attempt.assistance === 'independent');
        if (!recovered) return [...candidates].reverse().find(eligible);
    }
    return undefined;
}
