import { expect, it } from 'vitest';
import { startLifeTiming, timeLifeWork } from './startupTiming';

it('retains only the latest local timing for each phase', () => {
    for (let i = 0; i < 100; i++) startLifeTiming('test-bounded')();
    expect(performance.getEntriesByName('sansu-life:test-bounded')).toHaveLength(1);
    performance.clearMeasures('sansu-life:test-bounded');
});

it('preserves results and thrown errors while measuring work', () => {
    expect(timeLifeWork('test-work', () => 42)).toBe(42);
    const error = new Error('original failure');
    expect(() => timeLifeWork('test-work', () => { throw error; })).toThrow(error);
    expect(performance.getEntriesByName('sansu-life:test-work')).toHaveLength(1);
    performance.clearMeasures('sansu-life:test-work');
});
