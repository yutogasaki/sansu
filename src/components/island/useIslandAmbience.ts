import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createIslandAmbienceAudio, type IslandSoundscape } from './islandAmbienceAudio';

export type IslandAmbienceStatus = 'off' | 'ready' | 'playing' | 'blocked';

export function useIslandAmbience(ambience: IslandSoundscape, soundEnabled: boolean, active: boolean, preview = false) {
    const audio = useMemo(() => createIslandAmbienceAudio(), []);
    const [status, setStatus] = useState<IslandAmbienceStatus>('off');
    const unlocked = useRef(false);
    const mounted = useRef(false);
    const generation = useRef(0);
    const canPlay = active && soundEnabled && ambience !== 'off';
    const once = preview && ambience === 'shell-three-notes';
    const stop = useCallback(() => {
        generation.current += 1;
        audio.stop();
        if (mounted.current) setStatus('off');
    }, [audio]);
    const start = useCallback(async (): Promise<boolean> => {
        if (!canPlay || document.hidden) { stop(); return false; }
        // Direct use of the listen button can unlock browsers that require an active gesture.
        if (navigator.userActivation?.isActive) unlocked.current = true;
        if (!unlocked.current) { setStatus('ready'); return false; }
        const current = ++generation.current;
        const playing = await audio.start(ambience, { once, onEnded: () => {
            if (mounted.current && current === generation.current) setStatus('ready');
        } });
        if (!mounted.current || current !== generation.current) return false;
        setStatus(playing ? 'playing' : 'blocked');
        return playing;
    }, [ambience, audio, canPlay, once, stop]);
    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; generation.current += 1; audio.dispose(); };
    }, [audio]);
    useEffect(() => {
        if (!canPlay || document.hidden) { stop(); return; }
        if (once) { stop(); setStatus('ready'); return stop; }
        if (unlocked.current) void start();
        else setStatus('ready');
        return stop;
    }, [canPlay, once, start, stop]);
    useEffect(() => {
        const gesture = (event: Event) => {
            if (!event.isTrusted) return;
            unlocked.current = true;
            if (canPlay && !once && !document.hidden) void start();
        };
        const visibility = () => { if (document.hidden) stop(); else if (canPlay && !once && unlocked.current) void start(); };
        window.addEventListener('pointerdown', gesture, true);
        window.addEventListener('keydown', gesture, true);
        document.addEventListener('visibilitychange', visibility);
        return () => {
            window.removeEventListener('pointerdown', gesture, true);
            window.removeEventListener('keydown', gesture, true);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [canPlay, once, start, stop]);
    return { status, start, stop };
}
