import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFoundationAudio } from './foundationAudio';
class AudioFixture {
    static all: AudioFixture[] = [];
    onerror?: () => void;
    pause = vi.fn(); load = vi.fn(); removeAttribute = vi.fn(); play = vi.fn(async () => undefined);
    constructor(public path: string) { AudioFixture.all.push(this); }
}
afterEach(() => { vi.unstubAllGlobals(); AudioFixture.all = []; });
describe('fixed foundation playback ownership', () => {
    it('stops the old clip on replay and ignores late errors from that clip', async () => {
        vi.stubGlobal('Audio', AudioFixture);
        const audio = createFoundationAudio(), failed = vi.fn();
        await audio.play('/A.mp3', failed); const first = AudioFixture.all[0];
        await audio.play('/B.mp3', failed);
        expect(first.pause).toHaveBeenCalledOnce(); expect(first.removeAttribute).toHaveBeenCalledWith('src');
        first.onerror?.(); expect(failed).not.toHaveBeenCalled();
        audio.stop(); expect(AudioFixture.all[1].pause).toHaveBeenCalledOnce();
    });
    it('reports a later media error only for the current clip and releases it', async () => {
        vi.stubGlobal('Audio', AudioFixture);
        const audio = createFoundationAudio(), failed = vi.fn();
        await audio.play('/A.mp3', failed); AudioFixture.all[0].onerror?.();
        expect(failed).toHaveBeenCalledOnce(); expect(AudioFixture.all[0].pause).toHaveBeenCalledOnce();
    });
});
