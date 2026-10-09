import { useCallback, useEffect, useRef, useState } from 'react';
import { pendingAchievements, starterStep } from '../../../domain/growingIsland/guidance';
import { LANDMARK_PRICE, SEED_PRICE } from '../../../domain/growingIsland/rules';
import type { AchievementId, Command, GrowingState, StarterStepId } from '../../../domain/growingIsland/types';
import { growingTownSeed, hasPurchasedFlower, starterBench, starterPlayChoices } from './growingGuideTargets';

export const STARTER_COPY: Record<StarterStepId, { title: string; hint: string; action: string }> = {
    S1: { title: 'たねを おこう', hint: 'すむの たねを おいてみよう', action: 'たねを えらぶ' },
    S2: { title: 'おうちを ひらこう', hint: 'ひかる つぼみを さわってみよう', action: 'つぼみを みる' },
    S3: { title: 'なかまを むかえよう', hint: 'ふねの こを さわってみよう', action: 'ふねを みる' },
    S4: { title: 'つぎは なにを する？', hint: 'しまの なかで すきなことを えらぼう', action: 'あそびを えらぶ' },
    S5: { title: 'つぎの たねを そだてよう', hint: 'つぎは どこに おこう？', action: 'たねを えらぶ' },
};

export function starterFlowerReady(state: GrowingState) {
    return Boolean(state.guidance?.starter.steps.S4 && !state.plots.some(p => !p.starter && p.paid > 0 && p.cell)
        && !hasPurchasedFlower(state)
        && state.unlocked.includes('landmark:flower') && state.drops >= (LANDMARK_PRICE.flower ?? Infinity));
}

export function starterCopy(state: GrowingState, step: StarterStepId) {
    if (step === 'S4') {
        if (state.guidance?.starter.legacy)
            return { title: 'まなんで もどろう', hint: 'まなぶと しずくが たまるよ', action: 'まなぶ' };
        const chosen = state.guidance?.selected;
        if ((chosen === 'A3' || chosen === 'A4') && !state.guidance?.achievements[chosen])
            return chosen === 'A3'
                ? { title: 'はたの いろを かえよう', hint: 'いま できるよ。すきな いろに してみよう', action: 'はたを みる' }
                : starterBench(state)?.cell
                    ? { title: 'ベンチを うごかそう', hint: 'いま できるよ。おきたい ばしょを えらぼう', action: 'ベンチを みる' }
                    : { title: 'ベンチを だそう', hint: 'もちものから ベンチを だしてみよう', action: 'もちものを みる' };
        if (chosen === 'A3' || chosen === 'A4' || starterPlayChoices(state).length === 0)
            return { title: 'まなんで もどろう', hint: 'しまでも あそべるよ。まなぶと しずくが たまるよ', action: 'まなぶ' };
    }
    if (step === 'S5') {
        const waiting = growingTownSeed(state);
        if (waiting) return { title: 'つぎの たねを そだてよう', hint: state.unopened.includes(waiting.id) ? 'そだった つぼみを さわってみよう' : 'たねが まってるよ。いまは しまを ながめてみよう', action: 'たねを みる' };
        if (starterFlowerReady(state)) return { title: 'はなの なえを おこう', hint: `しずくは ${state.drops}こ。はなの なえは ${LANDMARK_PRICE.flower}こで おけるよ`, action: 'はなの なえを えらぶ' };
        const nextSeed = Math.min(...(['home', 'farm', 'play', 'market', 'festival'] as const)
            .filter(kind => state.unlocked.includes(`seed:${kind}`)).map(kind => SEED_PRICE[kind]));
        if (state.drops < nextSeed) return { title: 'しまを ながめよう', hint: `しずくは ${state.drops}こ。ベンチや なかまと あそべるよ`, action: 'しまへ もどる' };
    }
    return STARTER_COPY[step];
}

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
    const cue = automatic ? { id: step!, ...starterCopy(state!, step!) } : undefined;
    return { visible, cue, notice: active && visible && noticeSafe ? notice : undefined, pause, resume,
        dismissNotice: () => setNotice(undefined), selected: state?.guidance?.selected };
}
