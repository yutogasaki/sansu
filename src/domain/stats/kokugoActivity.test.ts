import { describe, expect, it } from 'vitest';
import { kokugoActivity } from './kokugoActivity';
import { summarizeActivity } from './activity';
import type { KokugoEvent, KokugoWork } from '../kokugo/types';

const at = new Date(2026, 9, 27, 12).getTime();
const event = (id: string, action: KokugoEvent['action'], patch: Partial<KokugoEvent> = {}): KokugoEvent => ({
    id, profileId: 'p', planId: 'plan', revision: 1, at, action, ...patch,
});
const work = (patch: Partial<KokugoWork> = {}): KokugoWork => ({ id: 'p:work', profileId: 'p', unitId: 'E05', text: '作品', saved: true, updatedAt: at, ...patch });

describe('read-only national-language activity', () => {
    it('counts actual answers including unscorable submissions, not support, presentations or drafts', () => {
        const input = ['answer', 'hint', 'model', 'draft', 'heard', 'present', 'intro', 'introduction', 'next', 'skip', 'complete-supported'] as const;
        const rows = input.map((action, i) => event(String(i), action));
        const entries = kokugoActivity(rows, []);
        expect(entries.map(row => row.kind).sort()).toEqual(['answer', 'practice', 'skip']);
        expect(rows).toEqual(input.map((action, i) => event(String(i), action)));
    });
    it('deduplicates event ids, preserves owner separation, and keeps repeated answers with distinct ids', () => {
        const entries = kokugoActivity([event('1', 'answer'), event('1', 'answer'), event('2', 'answer'), event('1', 'answer', { profileId: 'other' })], []);
        expect(entries).toHaveLength(3);
        expect(summarizeActivity([], 'p', '7', new Date(at), entries)).toMatchObject({ answered: 2, answeredKokugo: 2, activeDays: 1 });
    });
    it('retains saved revision dates despite later drafts and excludes unsaved works', () => {
        const yesterday = at - 86400000;
        const entries = kokugoActivity([], [work({ saved: false, updatedAt: at, revisions: [{ text: '前の作品', at: yesterday }] }), work({ id: 'p:draft', saved: false })]);
        expect(entries).toHaveLength(1);
        expect(entries[0]).toMatchObject({ at: yesterday, kind: 'work' });
        const summary = summarizeActivity([], 'p', '7', new Date(at), entries);
        expect(summary).toMatchObject({ answered: 0, activeDays: 1, savedWorks: 1 });
        expect(summary.daily[0].works ?? 0).toBe(0);
        expect(summary.daily[1].works).toBe(1);
    });
    it('separates books, works and supported practice from question totals and excludes invalid timestamps', () => {
        const entries = kokugoActivity([event('a', 'answer', { correct: false }), event('b', 'complete-supported'), event('bad', 'answer', { at: NaN })], [
            work(), work({ id: 'p:reading:book' }), work({ id: 'p:bad', updatedAt: NaN }),
        ]);
        expect(summarizeActivity([], 'p', '7', new Date(at), entries)).toMatchObject({ answered: 1, answeredKokugo: 1, savedBooks: 1, savedWorks: 1, supported: 1, activeDays: 1 });
    });
    it('deduplicates stored revisions but retains the last explicit resave, including a reread on a later day', () => {
        const saved = work({ id: 'p:reading:book', updatedAt: at + 86400000, revisions: [{ text: '読んだ本', at }, { text: '読んだ本', at }] });
        const entries = kokugoActivity([], [saved, saved]);
        expect(entries).toHaveLength(2);
        expect(entries.map(entry => entry.at)).toEqual([at + 86400000, at]);
        expect(summarizeActivity([], 'p', '7', new Date(at + 86400000), entries)).toMatchObject({ savedBooks: 2, activeDays: 2, answered: 0 });
    });
    it('uses the same 4am learning-day and date boundaries for both answer stores, including midnight', () => {
        const boundary = new Date(2026, 9, 27, 4).getTime();
        const entries = kokugoActivity([event('before', 'answer', { at: boundary - 1 }), event('after', 'answer', { at: boundary }),
            event('future', 'answer', { at: boundary + 86400000 })], []);
        const summary = summarizeActivity([], 'p', '7', new Date(at), entries);
        expect(summary).toMatchObject({ answered: 2, activeDays: 2 });
        expect(summary.daily[0].kokugo).toBe(1);
        expect(summary.daily[1].kokugo).toBe(1);
        expect(summary.daily[1].entries?.[0].at).toBe(boundary - 1);
    });
});
