import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { IslandLearningFeedback } from './learningFeedback';
import { createLearningMusic } from './learningMusic';

export interface LearningMusicOptions {
    active: boolean;
    /** False for a silent profile and vocabulary, where spoken words take priority. */
    enabled: boolean;
    /** Normalized question progress, independent of the consecutive-correct streak. */
    level: number;
    reach: boolean;
    feedback?: IslandLearningFeedback;
}

export function useLearningMusic({ active, enabled, level, reach, feedback }: LearningMusicOptions) {
    const owner = useRef<ReturnType<typeof createLearningMusic> | undefined>(undefined);
    const allowed = useRef(active && enabled), seen = useRef(feedback?.id), inputRevision = useRef(0);
    useLayoutEffect(() => {
        const audio = createLearningMusic(); owner.current = audio;
        audio.setActive(allowed.current && !document.hidden);
        return () => { owner.current = undefined; audio.dispose(); };
    }, []);
    useLayoutEffect(() => {
        allowed.current = active && enabled;
        if (!allowed.current) inputRevision.current++;
        owner.current?.setActive(allowed.current && !document.hidden);
    }, [active, enabled]);
    useLayoutEffect(() => { owner.current?.setIntensity(level, reach); }, [level, reach]);
    useEffect(() => {
        const visibility = () => { inputRevision.current++; owner.current?.setActive(allowed.current && !document.hidden); };
        document.addEventListener('visibilitychange', visibility);
        return () => document.removeEventListener('visibilitychange', visibility);
    }, []);
    useEffect(() => {
        if (!feedback || seen.current === feedback.id) return;
        seen.current = feedback.id;
        if (!allowed.current || document.hidden) return;
        const peak = feedback.party?.kind === 'ride' || feedback.party?.kind === 'stamp';
        if (feedback.kind === 'correct') owner.current?.cue(peak ? 'peak' : 'correct');
        else if (feedback.kind === 'step') owner.current?.cue('step');
        else if (feedback.kind === 'retry') owner.current?.cue('retry');
        else if (feedback.kind === 'supported') owner.current?.cue('place');
    }, [feedback]);
    const unlock = useCallback(() => {
        if (!allowed.current || document.hidden || navigator.userActivation?.isActive === false) return;
        void owner.current?.unlock();
    }, []);
    const onInput = useCallback((digit: string) => {
        if (!allowed.current || document.hidden) return;
        const audio = owner.current;
        if (!audio || audio.input(digit) || navigator.userActivation?.isActive === false) return;
        const revision = ++inputRevision.current, at = performance.now();
        void audio.unlock().then(ready => {
            // A slow/blocked unlock cannot replay an input after its visible contact.
            if (ready && owner.current === audio && revision === inputRevision.current && performance.now() - at < 180
                && allowed.current && !document.hidden) audio.input(digit);
        });
    }, []);
    const cue = useCallback((kind: 'catch' | 'place' | 'jump' | 'land') => {
        if (allowed.current && !document.hidden) owner.current?.cue(kind);
    }, []);
    const pulse = useCallback(() => allowed.current && !document.hidden ? owner.current?.pulse() ?? 0 : 0, []);
    return { unlock, onInput, cue, pulse };
}
