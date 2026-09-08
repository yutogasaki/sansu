import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('remembered confirmation guidance', () => {
    it('writes only its own device preference once, then remembers it after module reload', async () => {
        const values = new Map([['unrelated', 'kept']]);
        const setItem = vi.fn((key: string, value: string) => { values.set(key, value); });
        vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem });
        const first = await import('./answerConfirmGuidance');
        first.acknowledgeAnswerConfirmation(); first.acknowledgeAnswerConfirmation();
        expect(setItem).toHaveBeenCalledTimes(1);
        expect(values).toEqual(new Map([['unrelated', 'kept'], ['sansu_answer_confirmation_demonstrated_v1', '1']]));
        vi.resetModules();
        const reopened = await import('./answerConfirmGuidance'); reopened.acknowledgeAnswerConfirmation();
        expect(setItem).toHaveBeenCalledTimes(1);
    });
    it('does not block an answer when reading or writing the optional preference fails', async () => {
        vi.stubGlobal('localStorage', { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } });
        const guidance = await import('./answerConfirmGuidance');
        expect(() => guidance.acknowledgeAnswerConfirmation()).not.toThrow();
        expect(() => guidance.acknowledgeAnswerConfirmation()).not.toThrow();
    });
});
