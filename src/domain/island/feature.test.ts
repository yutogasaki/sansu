import { afterEach, describe, expect, it, vi } from 'vitest';
import { islandAvailable, islandEnabled } from './feature';

afterEach(() => vi.unstubAllEnvs());

describe('Island delivery availability', () => {
    it.each([undefined, 'false', 'TRUE', '1'])('keeps production unavailable without the explicit true flag (%s)', flag => {
        vi.stubEnv('DEV', false);
        vi.stubEnv('VITE_ISLAND_ENABLED', flag);
        expect(islandEnabled()).toBe(false);
        expect(islandAvailable()).toBe(false);
    });

    it('allows direct development access without changing the configured launch mode', () => {
        vi.stubEnv('DEV', true);
        vi.stubEnv('VITE_ISLAND_ENABLED', undefined);
        expect(islandAvailable()).toBe(true);
        expect(islandEnabled()).toBe(false);
    });

    it('enables production access and launch only with the explicit flag', () => {
        vi.stubEnv('DEV', false);
        vi.stubEnv('VITE_ISLAND_ENABLED', 'true');
        expect(islandAvailable()).toBe(true);
        expect(islandEnabled()).toBe(true);
    });
});
