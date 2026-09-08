import type { AttemptLog } from '../../db';
import { getLearningDayStart } from '../../utils/learningDay';
import { resolveWeakState } from '../learningRepository';
import type { MemoryState, SubjectKey } from '../types';
import { isNormalReviewEligible, isReviewDue } from '../learning/reviewPolicy';

/** Shared admission inputs for a reservation and its subject decision. */
export function parkLearningHistory(subject: SubjectKey, memory: MemoryState[], logs: AttemptLog[], now: number) {
    const itemLogs = logs.filter(log => log.subject === subject).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
    const dayStart = getLearningDayStart(new Date(now)).toISOString();
    const grouped = new Map<string, AttemptLog[]>();
    for (const log of itemLogs) {
        const list = grouped.get(log.itemId) ?? [];
        list.push(log);
        grouped.set(log.itemId, list);
    }
    const skipped = [...grouped].filter(([, list]) => {
        const recent = list.filter(log => log.timestamp >= dayStart).slice(-3);
        return recent.length === 3 && recent.every(log => log.result === 'skipped');
    }).map(([id]) => id);
    const due = memory.filter(state => isReviewDue(state, new Date(now))
        && (subject !== 'math' || isNormalReviewEligible(state)))
        .sort((a, b) => a.nextReview.localeCompare(b.nextReview)).map(state => state.id);
    const weak = memory.filter(state => state.isWeak ?? resolveWeakState((grouped.get(state.id) ?? []).map(log => log.result))).map(state => state.id);
    return { itemLogs, skipped, due, weak };
}
