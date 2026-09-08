import type { UserProfile } from '../types';
import type { RandomSource } from '../../utils/random';
import { ENGLISH_WORDS } from './words';

export function isVocabLevelEnabled(profile: UserProfile, level: number): boolean {
    const state = profile.vocabLevels?.find(item => item.level === level);
    return Number.isInteger(level) && level >= 1 && level <= profile.vocabMaxUnlocked
        && (!state || (state.unlocked && state.enabled));
}

export function getEligibleVocabWords(profile: UserProfile, skippedIds: readonly string[] = []) {
    const skipped = new Set(skippedIds);
    return ENGLISH_WORDS.filter(word => isVocabLevelEnabled(profile, word.level) && !skipped.has(word.id));
}

export interface VocabSelectionOptions {
    cooldownIds?: readonly string[];
    recentIds?: readonly string[];
    blockCounts?: ReadonlyMap<string, number>;
    random?: RandomSource;
}

/** Balanced reuse is a last resort after every eligible candidate was used.
 * Coverage priority only applies within the least-used, cooled candidates, so
 * an unanswered or repeatedly missed word cannot occupy an entire section. */
export function pickVocabWordId(
    candidates: readonly string[],
    options: VocabSelectionOptions,
    memory?: UserProfile['vocabWords'],
): string | undefined {
    if (candidates.length === 0) return undefined;
    const counts = options.blockCounts ?? new Map<string, number>();
    const minCount = Math.min(...candidates.map(id => counts.get(id) ?? 0));
    let pool = candidates.filter(id => (counts.get(id) ?? 0) === minCount);
    const recent = new Set([...(options.cooldownIds ?? []), ...(options.recentIds ?? [])]);
    const cooled = pool.filter(id => !recent.has(id));
    if (cooled.length > 0) pool = cooled;
    const unmet = memory ? pool.filter(id => !(memory[id]?.correctAnswers > 0)) : [];
    if (unmet.length > 0) pool = unmet;
    return pool[Math.floor((options.random ?? Math.random)() * pool.length)];
}

/** Due order is meaningful; rotate it before calling when a persisted cursor exists. */
export function pickVocabDueId(candidates: readonly string[], options: VocabSelectionOptions): string | undefined {
    const underLimit = candidates.filter(id => (options.blockCounts?.get(id) ?? 0) < 2);
    const recent = new Set([...(options.cooldownIds ?? []), ...(options.recentIds ?? [])]);
    return underLimit.find(id => !recent.has(id)) ?? underLimit[0];
}

export const vocabPlusOneLimit = (count: number) => count < 2 ? 0 : Math.max(1, Math.floor(count * 0.3));
