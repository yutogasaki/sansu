import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mock = vi.hoisted(() => ({ instances: [] as any[], context: undefined as any, webAudio: true, mute: vi.fn() }));
vi.mock('howler', () => ({
    Howler: { get ctx() { return mock.context; }, get usingWebAudio() { return mock.webAudio; }, mute: mock.mute },
    Howl: class {
        play = vi.fn(() => 1);
        unload = vi.fn();
        constructor(public options: any) { mock.instances.push(this); }
    },
}));

beforeEach(() => {
    vi.resetModules(); vi.useFakeTimers(); mock.instances = []; mock.webAudio = true; mock.mute.mockClear();
    mock.context = Object.assign(new EventTarget(), { state: 'suspended', resume: vi.fn(() => Promise.resolve()) });
});
afterEach(() => { vi.useRealTimers(); });

describe('explicit sound activation', () => {
    it('requests resume and the cue synchronously, and confirms only a started voice on a running context', async () => {
        const audio = await import('./audio');
        const activation = audio.enableSoundFromGesture(), cue = mock.instances[0];
        expect(mock.context.resume).toHaveBeenCalledOnce(); expect(cue.play).toHaveBeenCalledOnce();
        cue.options.onplay();
        expect(audio.getSoundPlaybackStatus()).toBe('blocked');
        mock.context.state = 'running'; mock.context.dispatchEvent(new Event('statechange'));
        expect(await activation.result).toBe(true); expect(audio.getSoundPlaybackStatus()).toBe('ready');
        cue.options.onend(); expect(cue.unload).toHaveBeenCalledOnce();
    });
    it.each(['onplayerror', 'onloaderror'])('keeps a failed %s attempt retryable even if the context is running', async event => {
        const audio = await import('./audio'); mock.context.state = 'running';
        const first = audio.enableSoundFromGesture(); mock.instances[0].options[event]();
        expect(await first.result).toBe(false); expect(audio.getSoundPlaybackStatus()).toBe('blocked');
        const retry = audio.enableSoundFromGesture(); mock.instances[1].options.onplay();
        expect(await retry.result).toBe(true); expect(audio.getSoundPlaybackStatus()).toBe('ready');
        retry.cancel();
    });
    it('bounds an unresolved resume and unloads the queued cue instead of claiming playback', async () => {
        mock.context.resume.mockImplementation(() => new Promise<void>(() => {}));
        const audio = await import('./audio'), activation = audio.enableSoundFromGesture();
        mock.instances[0].options.onplay(); // A library play event alone does not prove native output.
        await vi.advanceTimersByTimeAsync(1500);
        expect(await activation.result).toBe(false); expect(mock.instances[0].unload).toHaveBeenCalledOnce();
        expect(audio.getSoundPlaybackStatus()).toBe('blocked');
    });
    it('handles rejected resume without an unhandled rejection', async () => {
        mock.context.resume.mockRejectedValueOnce(new Error('not allowed'));
        const audio = await import('./audio'), activation = audio.enableSoundFromGesture();
        expect(await activation.result).toBe(false); expect(mock.instances[0].unload).toHaveBeenCalledOnce();
    });
    it('cancels a pending cue on exit without allowing a late callback to change the new mute state', async () => {
        const audio = await import('./audio'), activation = audio.enableSoundFromGesture();
        activation.cancel(); audio.setSoundEnabled(false);
        mock.context.state = 'running'; mock.instances[0].options.onplay();
        expect(await activation.result).toBe(false); expect(audio.getSoundPlaybackStatus()).toBe('off');
        expect(mock.instances[0].unload).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    });
    it('starts the HTML5 fallback on the gesture stack and waits for its actual play event', async () => {
        mock.webAudio = false; mock.context = null;
        const audio = await import('./audio'), activation = audio.enableSoundFromGesture();
        expect(mock.instances[0].play).toHaveBeenCalledOnce(); expect(audio.getSoundPlaybackStatus()).toBe('blocked');
        mock.instances[0].options.onplay(); expect(await activation.result).toBe(true); activation.cancel();
    });
    it('notifies the control after interruption and mute, and supports unsubscribing', async () => {
        const audio = await import('./audio'); mock.context.state = 'running'; audio.setSoundEnabled(true);
        const changed = vi.fn(), unsubscribe = audio.subscribeSoundPlayback(changed);
        mock.context.state = 'interrupted'; mock.context.dispatchEvent(new Event('statechange'));
        expect(audio.getSoundPlaybackStatus()).toBe('blocked'); expect(changed).toHaveBeenCalledOnce();
        audio.setSoundEnabled(false); expect(changed).toHaveBeenCalledTimes(2);
        unsubscribe(); mock.context.dispatchEvent(new Event('statechange')); expect(changed).toHaveBeenCalledTimes(2);
    });
});
