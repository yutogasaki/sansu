import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { IslandLearningFeedback } from './learningFeedback';
import { createLearningMusic } from './learningMusic';
import { registerLearningMusicPlayback, subscribeLearningMusicGesture } from './learningMusicGesture';

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
    const available = useRef(active);
    const gestureRevision = useRef(0);
    const publishPlayback = useRef<() => void>(() => undefined);
    useLayoutEffect(() => {
        const status = registerLearningMusicPlayback();
        const audio = createLearningMusic(undefined, () => publishPlayback.current()); owner.current = audio;
        publishPlayback.current = () => status.set(!available.current ? 'inactive' : audio.isReady() ? 'ready' : 'locked');
        audio.setActive(allowed.current && !document.hidden); publishPlayback.current();
        return () => { owner.current = undefined; publishPlayback.current = () => undefined; audio.dispose(); status.remove(); };
    }, []);
    useLayoutEffect(() => {
        available.current = active;
        allowed.current = active && enabled;
        if (!allowed.current) inputRevision.current++;
        owner.current?.setActive(allowed.current && !document.hidden);
        publishPlayback.current();
    }, [active, enabled]);
    useLayoutEffect(() => subscribeLearningMusicGesture(next => {
        const audio = owner.current;
        if (!audio || !available.current || document.hidden) return;
        if (next && navigator.userActivation?.isActive === false) return;
        if (!next) inputRevision.current++;
        audio.setActive(next);
        const revision = ++gestureRevision.current;
        return {
            result: next ? audio.unlock() : Promise.resolve(true),
            cancel: () => {
                if (owner.current !== audio || revision !== gestureRevision.current) return;
                gestureRevision.current++;
                inputRevision.current++;
                audio.stop();
                audio.setActive(allowed.current && !document.hidden);
            },
        };
    }), []);
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
        if ((feedback.kind === 'correct' || feedback.kind === 'supported') && feedback.sectionCompleted) owner.current?.cue('section');
        else if (feedback.kind === 'correct') owner.current?.cue(peak ? 'peak' : 'correct');
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
