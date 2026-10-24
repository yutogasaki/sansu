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
});
