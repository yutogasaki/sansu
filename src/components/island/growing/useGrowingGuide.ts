import { useCallback, useEffect, useRef, useState } from 'react';
import { pendingAchievements, starterStep } from '../../../domain/growingIsland/guidance';
import type { AchievementId, Command, GrowingState, StarterStepId } from '../../../domain/growingIsland/types';

export const STARTER_COPY: Record<StarterStepId, { title: string; hint: string; action: string }> = {
    S1: { title: 'たねを おこう', hint: 'すむの たねを おいてみよう', action: 'たねを えらぶ' },
    S2: { title: 'おうちを ひらこう', hint: 'ひかる つぼみを さわってみよう', action: 'つぼみを みる' },
    S3: { title: 'なかまを むかえよう', hint: 'ふねの こを さわってみよう', action: 'ふねを みる' },
    S4: { title: 'まなんで もどろう', hint: 'まなぶと しまの じかんが すすむよ', action: 'まなぶ' },
    S5: { title: 'つぎの たねを そだてよう', hint: 'つぎは どこに おこう？', action: 'たねを えらぶ' },
};

/** Foreground guidance never controls learning or the world's clocks. */
export function useGrowingGuide({ state, active, safe, dispatch, acknowledge }: {
    state?: GrowingState; active: boolean; safe: boolean;
    dispatch: (command: Command) => Promise<boolean>;
    acknowledge: (type: 'learning-returned' | 'concert-started' | 'ack-achievements', value?: string | AchievementId[]) => Promise<boolean>;
}) {
    const [visible, setVisible] = useState(() => document.visibilityState === 'visible');
    const [stopped, setStopped] = useState(false), [notice, setNotice] = useState<AchievementId[]>();
    const notifiedThisVisit = useRef(false), returning = useRef(false);
    useEffect(() => {
        const update = () => setVisible(document.visibilityState === 'visible');
        document.addEventListener('visibilitychange', update);
        return () => document.removeEventListener('visibilitychange', update);
    }, []);
    const learning = Boolean(state?.guidance?.learning), returned = Boolean(state?.guidance?.starter.steps.S4);
    useEffect(() => {
        if (!active || !visible || !safe || !learning || returned || returning.current) return;
        returning.current = true;
        void acknowledge('learning-returned').finally(() => { returning.current = false; });
    }, [active, visible, safe, learning, returned, state, acknowledge]);

    const pending = state ? pendingAchievements(state).join(',') : '';
    const noticeSafe = safe && !state?.unopened.length && !state?.arrivals.length;
    useEffect(() => {
        if (!active || !visible || !noticeSafe || !pending || notifiedThisVisit.current) return;
        const timeout = window.setTimeout(() => {
            notifiedThisVisit.current = true;
            setNotice(pending.split(',') as AchievementId[]);
        }, 800);
        return () => clearTimeout(timeout);
    }, [active, visible, noticeSafe, pending]);
    useEffect(() => {
        if (!notice || !active || !visible || !noticeSafe) return;
        // A DOM status must have reached an actual foreground frame before it is acknowledged.
        const frame = requestAnimationFrame(() => { void acknowledge('ack-achievements', notice); });
        const timeout = window.setTimeout(() => setNotice(undefined), 5500);
        return () => { cancelAnimationFrame(frame); clearTimeout(timeout); };
    }, [notice, active, visible, noticeSafe, acknowledge]);

    const pause = useCallback(() => {
        setStopped(true);
        if (state?.guidance?.starter.automatic) void dispatch({ type: 'starter-guide', automatic: false });
    }, [state?.guidance?.starter.automatic, dispatch]);
    const resume = useCallback(async () => {
        if (await dispatch({ type: 'starter-guide', automatic: true })) setStopped(false);
    }, [dispatch]);
    const step = state ? starterStep(state) : undefined;
    const automatic = active && visible && safe && !notice && !stopped && state?.guidance?.starter.automatic && step;
    const waiting = step === 'S5' && state?.plots.some(p => !p.starter && p.paid > 0 && p.kind !== 'wild' && p.kind !== 'wonder' && p.cell);
    const cue = automatic ? { id: step!, ...STARTER_COPY[step!], ...(waiting
        ? { hint: state!.unopened.length ? 'そだった つぼみを さわってみよう' : 'たねが まってるよ。いまは しまを ながめてみよう', action: 'たねを みる' }
        : step === 'S5' && state!.drops < 4 ? { hint: 'いまは ベンチで あそべるよ', action: 'あそびかたを みる' } : {}) } : undefined;
    return { visible, cue, notice: active && visible && noticeSafe ? notice : undefined, pause, resume,
        dismissNotice: () => setNotice(undefined), selected: state?.guidance?.selected };
}
