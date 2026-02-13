/**
 * Text-to-Speech Utility for Sansu App (English)
 */

let ttsWarmedUp = false;

/**
 * Warm up the SpeechSynthesis API with a silent utterance.
 * Call this on a user interaction (e.g. page navigation tap) so that
 * subsequent programmatic speak() calls are not blocked by the browser.
 */
export const warmUpTTS = () => {
    if (ttsWarmedUp || !window.speechSynthesis) return;
    const silentUtterance = new SpeechSynthesisUtterance("");
    silentUtterance.volume = 0;
    window.speechSynthesis.speak(silentUtterance);
    ttsWarmedUp = true;
};

export const speakEnglish = (text: string) => {
    if (!window.speechSynthesis) {
        console.warn("TTS not supported");
        return;
    }

    // Cancel any ongoing speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US"; // Default to US English
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    // Optional: Try to find a better voice (e.g. Google US English, Samantha)
    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find(v =>
        (v.name.includes("Google") && v.lang.includes("en-US")) ||
        v.name.includes("Samantha")
    );
    if (preferredVoice) {
        utterance.voice = preferredVoice;
    }

    window.speechSynthesis.speak(utterance);
};
