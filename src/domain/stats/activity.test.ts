import { describe, expect, it } from 'vitest';
import type { AttemptLog } from '../../db';
import { summarizeActivity } from './activity';

const log = (timestamp: Date, patch: Partial<AttemptLog> = {}): AttemptLog => ({
    profileId: 'p1', subject: 'math', itemId: 'add_1d_1', result: 'correct', timestamp: timestamp.toISOString(), ...patch,
});

describe('activity summary', () => {
    it('includes the first 4am boundary and excludes the next day, over year boundaries', () => {
        const now = new Date(2026, 0, 3, 12);
        const start = new Date(2025, 11, 28, 4);
        const logs = [log(start), log(new Date(start.getTime() - 1)),
            log(new Date(2026, 0, 4, 3, 59, 59)), log(new Date(2026, 0, 4, 4))];
        const summary = summarizeActivity(logs, 'p1', '7', now);
        expect(summary.count).toBe(2);
        expect(summary.days).toBe(2);
        expect(summary.start).toEqual(start);
    });

    it('counts days once across subjects, counts incorrect/skipped, and isolates profiles', () => {
        const today = new Date(2026, 9, 24, 12);
        const logs = [log(today, { id: 1 }), log(today, { id: 2, subject: 'vocab', result: 'incorrect' }),
            log(today, { id: 3, result: 'skipped' }), log(today, { profileId: 'p2' }),
            log(today, { id: 1 }), log(today, { timestamp: 'invalid' })];
        expect(summarizeActivity(logs, 'p1', '7', today)).toMatchObject({ count: 3, days: 1, math: 2, vocab: 1 });
    });

    it('uses 30 learning days instead of calendar month, including leap day', () => {
        const now = new Date(2024, 2, 1, 3, 59);
        const start = new Date(2024, 0, 31, 4);
        const logs = [log(start), log(new Date(2024, 1, 29, 12)), log(new Date(start.getTime() - 1))];
        const month = summarizeActivity(logs, 'p1', '30', now);
        expect(month).toMatchObject({ count: 2, days: 2, start, lastDay: new Date(2024, 1, 29, 4) });
        expect(summarizeActivity(logs, 'p1', '7', now).count).toBe(1);
    });

    it('keeps empty periods at zero without inferring missing history or mastery', () => {
        const now = new Date(2026, 9, 24, 12);
        expect(summarizeActivity([log(new Date(2020, 0, 1))], 'p1', '30', now))
            .toMatchObject({ count: 0, days: 0, math: 0, vocab: 0 });
    });

    it('lists every date newest first and separates real answers from skips per subject', () => {
        const now = new Date(2026, 9, 24, 12);
        const a = log(new Date(2026, 9, 24, 8), { id: 1 });
        const summary = summarizeActivity([a, a,
            log(new Date(2026, 9, 24, 9), { id: 2, subject: 'vocab', result: 'incorrect' }),
            log(new Date(2026, 9, 24, 10), { id: 3, result: 'skipped' }),
            log(now, { profileId: 'other' })], 'p1', '7', now);
        expect(summary.daily).toHaveLength(7);
        expect(summary.daily[0]).toMatchObject({ dateKey: '2026-10-24', answered: 2, skipped: 1, math: 1, vocab: 1 });
        expect(summary.daily[0].logs.map(item => item.id)).toEqual([3, 2, 1]);
        expect(summary.daily[1]).toMatchObject({ dateKey: '2026-10-23', answered: 0, skipped: 0, logs: [] });
        expect(summary.daily[6].dateKey).toBe('2026-10-18');
        expect(summary).toMatchObject({ answered: 2, answeredDays: 1, skipped: 1, answeredMath: 1, answeredVocab: 1 });
    });

    it('does not present a skip-only day as answered questions or an answered day', () => {
        const now = new Date(2026, 9, 24, 12);
        const summary = summarizeActivity([log(now, { result: 'skipped' })], 'p1', '7', now);
        expect(summary).toMatchObject({ answered: 0, answeredDays: 0, skipped: 1 });
        expect(summary.daily[0]).toMatchObject({ answered: 0, skipped: 1 });
    });

    it('keeps the true timestamp when an after-midnight answer belongs to the previous learning day', () => {
        const stamp = new Date(2026, 9, 25, 1, 32);
        const days = summarizeActivity([log(stamp)], 'p1', '30', stamp).daily;
        expect(days).toHaveLength(30);
        expect(days[0].dateKey).toBe('2026-10-24');
        expect(days[0].logs[0].timestamp).toBe(stamp.toISOString());
        expect(days[0].answered).toBe(1);
        expect(days.at(-1)?.dateKey).toBe('2026-09-25');
    });
});
