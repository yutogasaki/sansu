/** Canonical local clips only. No speech-synthesis fallback changes a saved stimulus. */
export function createFoundationAudio() {
    let current: HTMLAudioElement | undefined;
    const stop = () => { if (current) { current.pause(); current.removeAttribute('src'); current.load(); current = undefined; } };
    return {
        stop,
        async play(path: string, onError?: () => void) {
            stop();
            const audio = new Audio(path); current = audio;
            audio.onerror = () => { if (current === audio) { stop(); onError?.(); } };
            try { await audio.play(); }
            catch (error) { if (current === audio) stop(); throw error; }
        },
    };
}
