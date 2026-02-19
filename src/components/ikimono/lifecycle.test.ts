import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { calculateStage, createNewIkimonoState } from './lifecycle';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-02-19T12:00:00.000Z');

const daysAgoIso = (days: number) => new Date(NOW.getTime() - days * DAY_MS).toISOString();

describe('ikimono lifecycle', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(NOW);
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('calculates stage boundaries correctly', () => {
        expect(calculateStage(daysAgoIso(0)).stage).toBe('egg');
        expect(calculateStage(daysAgoIso(2.99)).stage).toBe('egg');
        expect(calculateStage(daysAgoIso(3)).stage).toBe('hatching');
        expect(calculateStage(daysAgoIso(6.99)).stage).toBe('hatching');
        expect(calculateStage(daysAgoIso(7)).stage).toBe('small');
        expect(calculateStage(daysAgoIso(13.99)).stage).toBe('small');
        expect(calculateStage(daysAgoIso(14)).stage).toBe('medium');
        expect(calculateStage(daysAgoIso(21.99)).stage).toBe('medium');
        expect(calculateStage(daysAgoIso(22)).stage).toBe('adult');
        expect(calculateStage(daysAgoIso(27.99)).stage).toBe('adult');
        expect(calculateStage(daysAgoIso(28)).stage).toBe('fading');
        expect(calculateStage(daysAgoIso(30)).stage).toBe('gone');
    });

    it('calculates fading opacity in fading window', () => {
        const atStart = calculateStage(daysAgoIso(28));
        const mid = calculateStage(daysAgoIso(29));
        const nearEnd = calculateStage(daysAgoIso(29.9));

        expect(atStart.stage).toBe('fading');
        expect(atStart.fadeOpacity).toBeCloseTo(1, 5);
        expect(mid.fadeOpacity).toBeCloseTo(0.5, 5);
        expect(nearEnd.fadeOpacity).toBeLessThan(0.1);
    });

    it('creates a new state with current timestamp and generation', () => {
        const state = createNewIkimonoState('p1', 3);
        expect(state.profileId).toBe('p1');
        expect(state.generation).toBe(3);
        expect(state.birthDate).toBe(NOW.toISOString());
    });
});
