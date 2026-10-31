import { afterEach, describe, expect, it, vi } from 'vitest';
import { labLookEnabled } from './labLook';
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
