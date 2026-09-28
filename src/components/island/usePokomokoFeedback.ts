import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import type { IslandLearningFeedback } from './learningFeedback';
import { advanceLearningShow, learningShowLevel, type LearningShow } from './learningShow';

export type PokomokoBurst = { id: string; kind: 'answer' | 'section' | 'step' | 'jump' | 'ride' | 'stamp'; variant: number; startedAt: number; light: number; riding: boolean; origin?: PokomokoInputCue };
export type PokomokoInputCue = { id: number; digit: string; problemId?: string; startedAt: number; fromX: number; fromY: number; x: number; y: number; destinationX: number; destinationY: number };
const visible = () => document.visibilityState === 'visible';
const subscribe = (listener: () => void) => {
    document.addEventListener('visibilitychange', listener);
    return () => document.removeEventListener('visibilitychange', listener);
};

/** Ephemeral presentation only. Timers never submit, advance, award, or delay input. */
export function usePokomokoFeedback(feedback: IslandLearningFeedback | undefined, active: boolean, root: RefObject<HTMLElement | null>, problemId?: string) {
    const inForeground = useSyncExternalStore(subscribe, visible, () => true);
    const seen = useRef<string | undefined>(feedback?.id);
    const digit = useRef(0);
    const latestInput = useRef<PokomokoInputCue | undefined>(undefined);
    const [burst, setBurst] = useState<PokomokoBurst>();
    const [inputCue, setInputCue] = useState<PokomokoInputCue>();
    const [show, setShow] = useState<LearningShow>({ completed: 0, receipt: feedback?.id });

    useEffect(() => {
        setBurst(undefined);
        const fresh = feedback?.id !== seen.current;
        seen.current = feedback?.id;
        if (!active || !fresh || !feedback) return;
        setShow(current => advanceLearningShow(current, feedback));
        if (!inForeground) return;
        if (feedback.kind === 'retry' || feedback.kind === 'support') setInputCue(undefined);
        const origin = latestInput.current;
        latestInput.current = undefined;
        const moment = feedback.party;
        const kind = feedback.kind === 'step' ? 'step'
            : feedback.kind === 'correct' || feedback.kind === 'supported'
                ? moment && moment.kind !== 'catch' ? moment.kind : feedback.sectionCompleted ? 'section' : 'answer' : undefined;
        if (!kind) return;
        setBurst({ id: feedback.id, kind, startedAt: performance.now(), variant: (moment?.streak ?? digit.current) % 3, light: moment?.light ?? 0, riding: moment?.riding ?? false, origin });
        const timer = window.setTimeout(() => setBurst(undefined), ['ride', 'stamp', 'jump'].includes(kind) ? 1600 : kind === 'section' ? 1250 : kind === 'step' ? 500 : 950);
        return () => window.clearTimeout(timer);
    }, [feedback, active, inForeground]);

    useEffect(() => {
        if (!active || !inForeground) { setInputCue(undefined); latestInput.current = undefined; }
        if (!inputCue) return;
        const timer = window.setTimeout(() => setInputCue(undefined), 450);
        return () => window.clearTimeout(timer);
    }, [inputCue, active, inForeground]);

    useEffect(() => {
        // A fast saved answer may replace the problem before the handoff ends.
        // Retire its digit instead of placing it in the new question's blank.
        setInputCue(current => current?.problemId === problemId ? current : undefined);
    }, [problemId]);

    useEffect(() => { if (!active) setShow({ completed: 0 }); }, [active]);

    const onDigitInput = (value: string) => {
        if (!active || !inForeground || !root.current) return;
        // This callback runs after an accepted input, before React paints the next
        // cursor, so the ring marks the cell just edited, including physical keys.
        const cell = root.current.querySelector('.answer-cell[data-active="true"], .written-cell[data-active="true"]')
            ?? root.current.querySelector('.park-input[aria-pressed="true"]');
        if (!cell) return;
        const bounds = cell.getBoundingClientRect(), stage = root.current.getBoundingClientRect();
        if (!bounds.width || !bounds.height) return;
        const actor = root.current.querySelector('.pokomoko-learning-actor')?.getBoundingClientRect();
        if (!actor) return;
        const key = root.current.querySelector(`.park-keypad button[aria-label="${value === '.' ? 'しょうすうてん' : value}"]`)?.getBoundingClientRect();
        const cue = { id: ++digit.current, digit: value, problemId, startedAt: performance.now(), fromX: key ? key.left + key.width / 2 - stage.left : bounds.left + bounds.width / 2 - stage.left, fromY: key ? key.top + key.height / 2 - stage.top : bounds.top + bounds.height / 2 - stage.top, x: bounds.left + bounds.width / 2 - stage.left, y: bounds.top + bounds.height / 2 - stage.top,
            destinationX: actor.left + actor.width * .28 - stage.left, destinationY: actor.top + actor.height * .56 - stage.top };
        latestInput.current = cue; setInputCue(cue);
    };
    return { level: learningShowLevel(show.completed), completed: show.completed, burst: active && inForeground ? burst : undefined, inputCue: active && inForeground ? inputCue : undefined, onDigitInput };
}
