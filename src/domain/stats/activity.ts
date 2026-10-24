import { addDays } from 'date-fns';
import type { AttemptLog } from '../../db';
import { getLearningDayStart, toLocaleDateKey } from '../../utils/learningDay';

export type ActivityPeriod = '7' | '30';

export interface ActivitySummary {
    start: Date;
    lastDay: Date;
    count: number;
    days: number;
    math: number;
    vocab: number;
}

/** Read-only activity counts; this does not infer mastery or combine foundation events. */
export function summarizeActivity(logs: AttemptLog[], profileId: string, period: ActivityPeriod, now: Date): ActivitySummary {
    const lastDay = getLearningDayStart(now);
    const start = addDays(lastDay, 1 - Number(period));
    const end = addDays(lastDay, 1).getTime();
    const days = new Set<string>();
    const seenIds = new Set<number>();
    let math = 0;
    let vocab = 0;
    for (const log of logs) {
        const timestamp = new Date(log.timestamp);
        if (log.profileId !== profileId || !Number.isFinite(timestamp.getTime()) || timestamp.getTime() < start.getTime() || timestamp.getTime() >= end) continue;
        if (log.id !== undefined) {
            if (seenIds.has(log.id)) continue;
            seenIds.add(log.id);
        }
        if (log.subject === 'math') math += 1;
        else if (log.subject === 'vocab') vocab += 1;
        else continue;
        days.add(toLocaleDateKey(getLearningDayStart(timestamp)));
    }
    return { start, lastDay, count: math + vocab, days: days.size, math, vocab };
}
