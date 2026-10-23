export interface EnglishSpeechCallbacks {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (error: SpeechSynthesisErrorCode | 'unsupported' | 'timeout') => void;
}

let current: SpeechSynthesisUtterance | undefined;
let startTimeout: ReturnType<typeof setTimeout> | undefined;

/** Request the voice list early. An empty utterance cannot grant autoplay permission. */
export const warmUpTTS = () => { window.speechSynthesis?.getVoices(); };

export const stopEnglishSpeech = () => {
    const speaking = current;
    current = undefined;
    clearTimeout(startTimeout);
    startTimeout = undefined;
    if (speaking) window.speechSynthesis?.cancel();
};

/** Manual callers invoke this directly in the click, preserving browser activation. */
const speak = (text: string, lang: 'en-US' | 'ja-JP', callbacks: EnglishSpeechCallbacks = {}): (() => void) => {
    stopEnglishSpeech();
    const synth = window.speechSynthesis;
    if (!synth || typeof SpeechSynthesisUtterance === 'undefined') {
        callbacks.onError?.('unsupported');
        return () => {};
    }
    if (!text.trim()) return () => {};
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = lang;
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    // Prefer installed English voices so supported devices also work offline.
    const english = synth.getVoices().filter(voice => (lang === 'en-US' ? /^en[-_]/i : /^ja[-_]/i).test(voice.lang));
    const voice = english.find(voice => voice.localService && voice.name === 'Samantha')
        ?? english.find(voice => voice.localService && voice.default)
        ?? english.find(voice => voice.localService && /^en[-_]US$/i.test(voice.lang))
        ?? english.find(voice => voice.localService)
        ?? english.find(voice => /^en[-_]US$/i.test(voice.lang)) ?? english[0];
    if (voice) { utterance.voice = voice; utterance.lang = voice.lang; }
    current = utterance;
    const stop = () => { if (current === utterance) stopEnglishSpeech(); };
    utterance.onstart = () => {
        if (current !== utterance) return;
        clearTimeout(startTimeout);
        callbacks.onStart?.();
    };
    utterance.onend = () => {
        if (current !== utterance) return;
        current = undefined;
        clearTimeout(startTimeout);
        callbacks.onEnd?.();
    };
    utterance.onerror = event => {
        if (current !== utterance) return;
        current = undefined;
        clearTimeout(startTimeout);
        callbacks.onError?.(event.error);
    };
    startTimeout = setTimeout(() => {
        if (current !== utterance) return;
        stop();
        callbacks.onError?.('timeout');
    }, 3000);
    try {
        if (synth.paused) synth.resume();
        synth.speak(utterance);
    } catch {
        stop();
        callbacks.onError?.('synthesis-failed');
    }
    return stop;
};

export const speakEnglish = (text: string, callbacks: EnglishSpeechCallbacks = {}) => speak(text, 'en-US', callbacks);
/** The returned stop only cancels this utterance, never a newer owner's voice. */
export const speakJapanese = (text: string) => speak(text, 'ja-JP');
