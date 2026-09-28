import { describe, expect, it, vi } from 'vitest';
import { beginLearningMusicGesture, subscribeLearningMusicGesture, getLearningMusicReady, registerLearningMusicPlayback, subscribeLearningMusicPlayback } from './learningMusicGesture';

describe('the sound button forwards its activation to the mounted learning owner', () => {
    it('unlocks synchronously and cancels a pending attempt when saving or navigation fails', async () => {
        let resolve!: (ready: boolean) => void;
        const cancel = vi.fn(), start = vi.fn(() => ({ result: new Promise<boolean>(done => { resolve = done; }), cancel }));
        const unsubscribe = subscribeLearningMusicGesture(start);
        try {
            const attempt = beginLearningMusicGesture(true);
            expect(start).toHaveBeenCalledOnce(); expect(start).toHaveBeenCalledWith(true);
            // Cancellation is immediate even if the browser has not answered resume.
            attempt.cancel(); expect(cancel).toHaveBeenCalledOnce();
            resolve(false); expect(await attempt.result).toBe(false);
        } finally { unsubscribe(); }
    });

    it('forwards mute immediately and stops forwarding after the learning owner unmounts', async () => {
        const listener = vi.fn(() => undefined), unsubscribe = subscribeLearningMusicGesture(listener);
        expect(await beginLearningMusicGesture(false).result).toBe(true);
        expect(listener).toHaveBeenCalledOnce(); expect(listener).toHaveBeenCalledWith(false);
        unsubscribe();
        expect(await beginLearningMusicGesture(true).result).toBe(true);
        expect(listener).toHaveBeenCalledTimes(1);
    });

    it('reports blocked learning playback even if another audio owner succeeded', async () => {
        const good = subscribeLearningMusicGesture(() => ({ result: Promise.resolve(true), cancel: () => undefined }));
        const blocked = subscribeLearningMusicGesture(() => ({ result: Promise.resolve(false), cancel: () => undefined }));
        try { expect(await beginLearningMusicGesture(true).result).toBe(false); }
        finally { good(); blocked(); }
    });
});


describe('learning playback readiness is independent from the UI sound context', () => {
    it('requires every active music owner, ignores vocabulary, and clears on unmount', () => {
        const changed = vi.fn(), unsubscribe = subscribeLearningMusicPlayback(changed);
        const math = registerLearningMusicPlayback(), vocabulary = registerLearningMusicPlayback();
        try {
            vocabulary.set('inactive'); expect(getLearningMusicReady()).toBe(true);
            math.set('locked'); expect(getLearningMusicReady()).toBe(false);
            math.set('ready'); expect(getLearningMusicReady()).toBe(true);
            math.set('ready'); expect(changed).toHaveBeenCalledTimes(2);
            math.set('locked'); expect(getLearningMusicReady()).toBe(false);
            math.remove(); expect(getLearningMusicReady()).toBe(true);
        } finally { math.remove(); vocabulary.remove(); unsubscribe(); }
    });
});
