import { describe, expect, it } from 'vitest';
import { LifePresentationClock } from './presentationClock';
import { residentReaction } from '../../../domain/islandLife/activity';
import { learningDay, newLife } from '../../../domain/islandLife/model';
import { commandLife, replayLife } from '../../../domain/islandLife/simulation';

describe('scene preparation does not consume an earned reaction', () => {
    const placed = () => {
        const record = newLife('display-clock', 100);
        record.credits = [{ id: 'credit', at: 100, day: learningDay(100) }];
        return replayLife(commandLife(record, { type: 'buy', kind: 'flower', cell: { x: 0, z: 2 } }, 'flower', 100));
    };

    it('keeps the real discovery hop after a slow build and first GPU render', () => {
        const state = placed(), saved = structuredClone(state), clock = new LifePresentationClock();
        clock.prepare(state, 0);
        expect(clock.sample(850)).toBe(state.now);
        clock.resume(1700);
        clock.sample(1716);
        const reaction = residentReaction(state, state.residents[1], clock.sample(2025));
        expect(reaction).toMatchObject({ symbol: '!', hop: .09 });
        expect(state).toEqual(saved);
    });

    it('pauses a same-snapshot rebuild without restarting or extending the acting sequence', () => {
        const state = placed(), clock = new LifePresentationClock();
        clock.prepare(state, 0); clock.resume(1000);
        clock.sample(1016);
        clock.prepare(state, 1200);
        expect(clock.sample(3000)).toBe(state.now + 200);
        clock.resume(3000);
        clock.sample(3016);
        clock.resume(3100); // Ordinary frames must not continually restart time.
        expect(clock.sample(3500)).toBe(state.now + 700);
        expect(residentReaction(state, state.residents[1], clock.sample(3500))?.hop).toBe(0);
    });

    it('uses the new saved time on refresh and does not replay an expired discovery', () => {
        const state = placed(), clock = new LifePresentationClock();
        clock.prepare(state, 0); clock.resume(1000);
        const refreshed = { ...state, now: state.now + 15000 };
        clock.prepare(refreshed, 2000); clock.resume(3000);
        expect(clock.sample(3100)).toBe(refreshed.now + 100);
        expect(residentReaction(refreshed, refreshed.residents[1], clock.sample(3100))?.symbol).not.toBe('!');
    });

    it('ages a pending reaction while hidden or context-lost before the first frame', () => {
        const state = placed(), clock = new LifePresentationClock();
        clock.prepare(state, 0);
        clock.resume(200, true); // The display became unavailable during preparation.
        clock.resume(60000); // Becoming visible must not restart it.
        expect(clock.sample(60000)).toBe(state.now + 59800);
        expect(residentReaction(state, state.residents[1], clock.sample(60000))?.symbol).not.toBe('!');
    });

    it('does not skip the hop when the first browser frame waits on GPU work', () => {
        const state = placed(), clock = new LifePresentationClock();
        clock.prepare(state, 0); clock.resume(1000);
        const first = residentReaction(state, state.residents[1], clock.sample(2000));
        expect(first?.hop).toBeGreaterThan(.02);
        expect(clock.sample(2225)).toBe(state.now + 325);
        expect(residentReaction(state, state.residents[1], clock.sample(2550))?.hop).toBe(0);
    });
});
