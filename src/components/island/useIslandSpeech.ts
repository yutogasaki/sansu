import { useCallback, useEffect, useRef, useState } from 'react';
import { speakEnglish, warmUpTTS } from '../../utils/tts';

type SpeechStatus = 'idle' | 'starting' | 'speaking' | 'blocked' | 'unavailable' | 'error';

/** Owned by the slot, outside the draft reset, so retry/help cannot auto-repeat a word. */
export function useIslandSpeech(text: string | undefined, autoRead: boolean, disabled: boolean) {
    const [status, setStatus] = useState<SpeechStatus>('idle');
    const cancelSpeech = useRef<() => void>(() => {});
    const pending = useRef<ReturnType<typeof setTimeout>>(undefined);
    const stop = useCallback(() => {
        clearTimeout(pending.current);
        cancelSpeech.current();
        setStatus('idle');
    }, []);
    const play = useCallback(() => {
        if (!text || document.hidden) return;
        clearTimeout(pending.current);
        cancelSpeech.current();
        setStatus('starting');
        cancelSpeech.current = speakEnglish(text, {
            onStart: () => setStatus('speaking'),
            onEnd: () => setStatus('idle'),
            onError: error => setStatus(error === 'not-allowed' || error === 'timeout' ? 'blocked'
                : error === 'unsupported' || error === 'language-unavailable' || error === 'voice-unavailable' ? 'unavailable' : 'error'),
        });
    }, [text]);
    useEffect(() => {
        stop();
        if (text) warmUpTTS();
        // Let the result cue finish while the next answer is already operable.
        if (text && autoRead && !document.hidden) pending.current = setTimeout(play, 600);
        const hide = () => { if (document.hidden) stop(); };
        document.addEventListener('visibilitychange', hide);
        return () => {
            clearTimeout(pending.current);
            cancelSpeech.current();
            document.removeEventListener('visibilitychange', hide);
        };
    }, [text, autoRead, play, stop]);
    useEffect(() => { if (disabled) stop(); }, [disabled, stop]);
    return { play, status };
}
