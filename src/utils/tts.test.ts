import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speakEnglish, stopEnglishSpeech, warmUpTTS } from './tts';

class Utterance {
    constructor(public text: string) {}
    onstart?: () => void;
    onend?: () => void;
    onerror?: (event: { error: string }) => void;
}
const synth = { getVoices: vi.fn(), cancel: vi.fn(), speak: vi.fn(), resume: vi.fn(), paused: false };
const latest = () => synth.speak.mock.lastCall![0] as Utterance;

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    synth.getVoices.mockReturnValue([]);
    synth.paused = false;
    vi.stubGlobal('window', { speechSynthesis: synth });
    vi.stubGlobal('SpeechSynthesisUtterance', Utterance);
});
afterEach(() => { stopEnglishSpeech(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('English pronunciation lifecycle', () => {
    it('speaks in the click immediately and prefers an installed English voice', () => {
        const local = { name: 'English', lang: 'en-US', localService: true };
        synth.getVoices.mockReturnValue([{ name: 'Remote', lang: 'en-US', localService: false }, local]);
        speakEnglish(' orange ');
        expect(latest()).toMatchObject({ text: 'orange', lang: 'en-US', voice: local, volume: 1 });
        expect(synth.speak).toHaveBeenCalledTimes(1);
    });
    it('rechecks voices on replay and can use the system default before voices arrive', () => {
        speakEnglish('school');
        expect(latest()).toMatchObject({ text: 'school', lang: 'en-US' });
        const voice = { name: 'Local', lang: 'en-GB', localService: true };
        synth.getVoices.mockReturnValue([voice]);
        speakEnglish('school');
        expect(latest()).toMatchObject({ voice, lang: 'en-GB' });
    });
    it('replay replaces speech and a stale owner cannot stop the next word', () => {
        const previousError = vi.fn();
        const previousStop = speakEnglish('orange', { onError: previousError });
        const previous = latest();
        speakEnglish('school');
        expect(synth.cancel).toHaveBeenCalledTimes(1);
        previousStop(); previous.onerror?.({ error: 'interrupted' });
        expect(synth.cancel).toHaveBeenCalledTimes(1);
        expect(previousError).not.toHaveBeenCalled();
    });
    it('reports autoplay refusal, unavailable speech, and silent startup failure', () => {
        const error = vi.fn();
        speakEnglish('orange', { onError: error });
        latest().onerror?.({ error: 'not-allowed' });
        expect(error).toHaveBeenLastCalledWith('not-allowed');
        speakEnglish('school', { onError: error });
        vi.advanceTimersByTime(3000);
        expect(error).toHaveBeenLastCalledWith('timeout');
        vi.stubGlobal('window', {});
        speakEnglish('school', { onError: error });
        expect(error).toHaveBeenLastCalledWith('unsupported');
    });
    it('does not time out or cancel after speech has actually started or finished', () => {
        const error = vi.fn(), end = vi.fn();
        speakEnglish('good morning', { onError: error, onEnd: end });
        latest().onstart?.();
        vi.advanceTimersByTime(5000);
        latest().onend?.();
        stopEnglishSpeech();
        expect(end).toHaveBeenCalledTimes(1);
        expect(error).not.toHaveBeenCalled();
        expect(synth.cancel).not.toHaveBeenCalled();
    });
    it('cancels on exit without late callback or a silent warm-up utterance', () => {
        const error = vi.fn();
        warmUpTTS();
        expect(synth.speak).not.toHaveBeenCalled();
        const stop = speakEnglish('orange', { onError: error });
        stop();
        vi.advanceTimersByTime(4000);
        expect(synth.cancel).toHaveBeenCalledTimes(1);
        expect(error).not.toHaveBeenCalled();
    });
});
