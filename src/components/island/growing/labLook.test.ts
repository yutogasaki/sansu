import { afterEach, describe, expect, it, vi } from 'vitest';
import { labLookEnabled, learnedOnIsland, learningLook } from './labLook';
import { coastSeaEnabled } from '../three/garden/coastSea';

const at = (search: string) => vi.stubGlobal('location', { search });

describe('grow-lab look on the real island (DEV comparison only)', () => {
    afterEach(() => vi.unstubAllGlobals());

    it('stays off unless the URL asks for it, so the island is unchanged by default', () => {
        at('');
        expect(labLookEnabled()).toBe(false);
        expect(coastSeaEnabled()).toBe(false);
    });

    it('turns on every look-only part, the coast sea with it, from one switch', () => {
        at('?island-look=lab');
        expect(labLookEnabled()).toBe(true);
        expect(coastSeaEnabled()).toBe(true);
    });

    it('still lets the sea alone be compared', () => {
        at('?island-sea=coast');
        expect(labLookEnabled()).toBe(false);
        expect(coastSeaEnabled()).toBe(true);
    });
});

describe('lanterns and boats from learning, counted from what the island already saves', () => {
    it('counts completions from the town hours earned, spent or not', () => {
        expect(learnedOnIsland({ town: { clock: 0, bank: 0 } })).toBe(0);
        // 7 completions of 2 hours: 9 hours already spent by the town, 5 still in the bank.
        expect(learnedOnIsland({ town: { clock: 9, bank: 5 } })).toBe(7);
    });

    it('adds a lantern per completion and a boat per town day, each with a ceiling', () => {
        expect(learningLook(0)).toEqual({ lanterns: 0, boats: 1 });
        expect(learningLook(11)).toEqual({ lanterns: 11, boats: 1 });
        expect(learningLook(12)).toEqual({ lanterns: 12, boats: 2 });
        expect(learningLook(500)).toEqual({ lanterns: 48, boats: 5 });
    });
});
