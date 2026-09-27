import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import type { IslandLearningFeedback } from './learningFeedback';

export type PokomokoBurst = { id: string; kind: 'answer' | 'section' | 'step' };
export type PokomokoInputCue = { id: number; x: number; y: number };
const visible = () => document.visibilityState === 'visible';
const subscribe = (listener: () => void) => {
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
};

/** Ephemeral presentation only. Timers never submit, advance, award, or delay input. */
export function usePokomokoFeedback(feedback: IslandLearningFeedback | undefined, active: boolean, root: RefObject<HTMLElement | null>) {
    const inForeground = useSyncExternalStore(subscribe, visible, () => true);
    const seen = useRef<string | undefined>(feedback?.id);
    const digit = useRef(0);
    const [burst, setBurst] = useState<PokomokoBurst>();
    const [inputCue, setInputCue] = useState<PokomokoInputCue>();

    useEffect(() => {
        setBurst(undefined);
        const fresh = feedback?.id !== seen.current;
        seen.current = feedback?.id;
        if (!active || !inForeground || !fresh || !feedback) return;
        setInputCue(undefined);
        const kind = feedback.kind === 'step' ? 'step'
            : feedback.kind === 'correct' || feedback.kind === 'supported' ? feedback.sectionCompleted ? 'section' : 'answer' : undefined;
        if (!kind) return;
        setBurst({ id: feedback.id, kind });
        const timer = window.setTimeout(() => setBurst(undefined), kind === 'section' ? 1250 : kind === 'step' ? 500 : 950);
        return () => window.clearTimeout(timer);
    }, [feedback, active, inForeground]);

    useEffect(() => {
        if (!active || !inForeground) setInputCue(undefined);
        if (!inputCue) return;
        const timer = window.setTimeout(() => setInputCue(undefined), 280);
        return () => window.clearTimeout(timer);
    }, [inputCue, active, inForeground]);

    const onDigitInput = () => {
        if (!active || !inForeground || !root.current) return;
        // This callback runs after an accepted input, before React paints the next
        // cursor, so the ring marks the cell just edited, including physical keys.
        const cell = root.current.querySelector('.answer-cell[data-active="true"], .written-cell[data-active="true"]')
            ?? root.current.querySelector('.park-input[aria-pressed="true"]');
        if (!cell) return;
        const bounds = cell.getBoundingClientRect(), stage = root.current.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        setInputCue({ id: ++digit.current, x: bounds.left + bounds.width / 2 - stage.left, y: bounds.top + bounds.height / 2 - stage.top });
    };
    return { burst: active && inForeground ? burst : undefined, inputCue: active && inForeground ? inputCue : undefined, onDigitInput };
}
