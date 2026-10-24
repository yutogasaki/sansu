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
    daily: DailyActivity[];
    answered: number;
    answeredDays: number;
    answeredMath: number;
    answeredVocab: number;
    skipped: number;
}

export interface DailyActivity {
    date: Date;
    dateKey: string;
    answered: number;
    skipped: number;
    math: number;
    vocab: number;
    logs: AttemptLog[];
}

/** Read-only activity counts; this does not infer mastery or combine foundation events. */
export function summarizeActivity(logs: AttemptLog[], profileId: string, period: ActivityPeriod, now: Date): ActivitySummary {
    const lastDay = getLearningDayStart(now);
    const start = addDays(lastDay, 1 - Number(period));
    const end = addDays(lastDay, 1).getTime();
    const days = new Set<string>();
    const daily: DailyActivity[] = Array.from({ length: Number(period) }, (_, offset) => {
        const date = addDays(lastDay, -offset);
        return { date, dateKey: toLocaleDateKey(date), answered: 0, skipped: 0, math: 0, vocab: 0, logs: [] };
    });
    const byDate = new Map(daily.map(day => [day.dateKey, day]));
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
        const key = toLocaleDateKey(getLearningDayStart(timestamp));
        days.add(key);
        const day = byDate.get(key)!;
        day.logs.push(log);
        if (log.result === 'skipped' || log.skipped) day.skipped += 1;
        else {
            day.answered += 1;
            day[log.subject] += 1;
        }
    }
    for (const day of daily) day.logs.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return { start, lastDay, count: math + vocab, days: days.size, math, vocab, daily,
        answered: daily.reduce((sum, day) => sum + day.answered, 0),
        answeredDays: daily.filter(day => day.answered > 0).length,
        answeredMath: daily.reduce((sum, day) => sum + day.math, 0),
        answeredVocab: daily.reduce((sum, day) => sum + day.vocab, 0),
        skipped: daily.reduce((sum, day) => sum + day.skipped, 0),
    };
}
