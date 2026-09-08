import type { UserProfile } from '../types';
import type { RandomSource } from '../../utils/random';
import { resolveReviewBudget } from '../learning/reviewBudget';
import { getEligibleVocabWords, pickVocabWordId, vocabPlusOneLimit } from './selection';

export interface VocabPlanSelection {
    wordId: string;
    source: 'due' | 'weak' | 'plus-one' | 'main';
    isReview: boolean;
    countsTowardReviewCap: boolean;
}

export function planVocabProblemSlots(options: {
    profile: UserProfile;
    count: number;
    shortestCount?: number;
    dueIds?: readonly string[];
    /** One main-level slot may continue a word introduced in the previous section. */
    practiceWordIds?: readonly string[];
    dueAfterId?: string;
    weakIds?: readonly string[];
    skippedIds?: readonly string[];
    cooldownIds?: readonly string[];
    random?: RandomSource;
}): VocabPlanSelection[] {
    const { profile, count, random = Math.random } = options;
    const eligible = getEligibleVocabWords(profile, options.skippedIds);
    const allowed = new Set(eligible.map(word => word.id));
    const due = [...new Set(options.dueIds ?? [])].filter(id => allowed.has(id));
    const cursor = options.dueAfterId ? due.indexOf(options.dueAfterId) : -1;
    const orderedDue = cursor < 0 ? due : [...due.slice(cursor + 1), ...due.slice(0, cursor + 1)];
    const weak = [...new Set(options.weakIds ?? [])].filter(id => allowed.has(id));
    const main = eligible.filter(word => word.level === profile.vocabMainLevel).map(word => word.id);
    const plus = eligible.filter(word => word.level === profile.vocabMainLevel + 1).map(word => word.id);
    // The whole reservation may later shorten for new content. A prefix must
    // already respect that shorter workload's challenge ceiling.
    const plusLimit = Math.min(vocabPlusOneLimit(count), vocabPlusOneLimit(options.shortestCount ?? count));
    const shortestCount = Math.max(1, Math.min(count, options.shortestCount ?? count));
    const budget = resolveReviewBudget({ count, dueCount: due.length });
    const prefixBudget = resolveReviewBudget({ count: shortestCount, dueCount: due.length });
    const counts = new Map<string, number>();
    const reviewedDue = new Set<string>();
    const slots: VocabPlanSelection[] = [];
    let plusCount = 0;
    let reviewCount = 0;
    let mainCount = 0;
    let continuedPractice = false;
    for (let index = 0; index < count; index += 1) {
        const selectionOptions = {
            blockCounts: counts, cooldownIds: options.cooldownIds,
            recentIds: slots.map(item => item.wordId).slice(-5), random,
        };
        const activeBudget = index < shortestCount ? prefixBudget : budget;
        const activeCount = index < shortestCount ? shortestCount : count;
        const mustLeaveMain = activeCount > 1 && mainCount === 0 && index === activeCount - 1;
        let source: VocabPlanSelection['source'] = 'main';
        let wordId = !mustLeaveMain && reviewCount < activeBudget.reviewLimit
            ? orderedDue.find(id => !reviewedDue.has(id) && (counts.get(id) ?? 0) < 2) : undefined;
        if (wordId) {
            source = 'due';
            reviewedDue.add(wordId);
        }
        if (!wordId && !mustLeaveMain && reviewCount === 0 && weak.length > 0 && random() < 0.3) {
            wordId = pickVocabWordId(weak, selectionOptions);
            if (wordId) source = 'weak';
        }
        if (!wordId && !continuedPractice && options.practiceWordIds?.length) {
            wordId = pickVocabWordId(options.practiceWordIds.filter(id => main.includes(id) && (counts.get(id) ?? 0) < 2), selectionOptions);
            if (wordId) continuedPractice = true;
        }
        if (!wordId && !mustLeaveMain && !activeBudget.suppressPlusOne
            && plusCount < plusLimit && plus.length > 0 && random() < 0.3) {
            wordId = pickVocabWordId(plus, selectionOptions, profile.vocabWords);
            if (wordId) source = 'plus-one';
        }
        wordId ??= pickVocabWordId(main, selectionOptions, profile.vocabWords);
        if (!wordId) throw new Error('No vocabulary assignment available');
        const isReview = source === 'due' || source === 'weak';
        if (isReview) reviewCount += 1;
        if (source === 'plus-one') plusCount += 1;
        if (source === 'main') mainCount += 1;
        counts.set(wordId, (counts.get(wordId) ?? 0) + 1);
        slots.push({ wordId, source, isReview, countsTowardReviewCap: isReview });
    }
    return slots;
}
