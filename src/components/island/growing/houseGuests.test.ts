import { describe, expect, it } from 'vitest';
import { newIsland } from '../../../domain/growingIsland';
import type { Villager } from '../../../domain/growingIsland';
import { houseGuests } from './houseGuests';

const friend = (i: number, patch: Partial<Villager> = {}): Villager => ({ id: `v${i}`, species: 'rabbit', variant: { color: 0, accessory: 0, sparkle: false },
    trait: 'mellow', home: 'pokomoko', arrivedAt: i, ...patch });

describe('friends visiting the house', () => {
    it('are up to three, the same all day and different on other days, never someone who is away', () => {
        const state = newIsland('kid-h', 0);
        state.villagers = Array.from({ length: 8 }, (_, i) => friend(i + 1, { away: i === 0 || undefined }));
        const morning = houseGuests(state, new Date(2026, 9, 1, 8)), evening = houseGuests(state, new Date(2026, 9, 1, 20));
        expect(morning.length).toBeGreaterThanOrEqual(1); expect(morning.length).toBeLessThanOrEqual(3);
        expect(evening).toEqual(morning);
        expect(morning.some(v => v.away)).toBe(false);
        const week = Array.from({ length: 7 }, (_, d) => houseGuests(state, new Date(2026, 9, 2 + d, 9)).map(v => v.id).join());
        expect(new Set(week).size).toBeGreaterThan(2);
        expect(houseGuests({ ...state, villagers: [] }, new Date())).toEqual([]);
    });
});
