import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { createIslandWorkshopAudio, type WorkshopFeedbackKind } from './islandWorkshopAudio';

/** Parent calls unlock in a trusted pointer/key handler and play after the
 * material contact or visible result. Visibility never unlocks sound itself. */
export function useIslandWorkshopAudio(enabled: boolean) {
    const owner = useRef<ReturnType<typeof createIslandWorkshopAudio> | undefined>(undefined);
    const enabledRef = useRef(enabled);
    useLayoutEffect(() => {
        // A fresh owner per effect lifetime also survives React Strict Mode's cleanup/remount probe.
        const audio = createIslandWorkshopAudio(); owner.current = audio;
        audio.setActive(enabledRef.current && !document.hidden);
        return () => { owner.current = undefined; audio.dispose(); };
    }, []);
    useLayoutEffect(() => { enabledRef.current = enabled; owner.current?.setActive(enabled && !document.hidden); }, [enabled]);
    useEffect(() => {
        const visibility = () => owner.current?.setActive(enabledRef.current && !document.hidden);
        document.addEventListener('visibilitychange', visibility);
        visibility();
        return () => document.removeEventListener('visibilitychange', visibility);
    }, []);
    const unlock = useCallback(() => {
        if (!enabledRef.current || document.hidden || navigator.userActivation?.isActive === false) return Promise.resolve(false);
        return owner.current?.unlock() ?? Promise.resolve(false);
    }, []);
    const play = useCallback((kind: WorkshopFeedbackKind) => {
        if (!enabledRef.current || document.hidden) { owner.current?.stop(); return false; }
        return owner.current?.play(kind) ?? false;
    }, []);
    const stop = useCallback(() => owner.current?.stop(), []);
    return { unlock, play, stop };
}
