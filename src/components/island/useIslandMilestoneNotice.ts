import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { IslandMilestone } from './IslandMilestone';
import type { IslandLearningAction } from '../../domain/island/types';
import type { useIslandActions } from './useIslandActions';

/** Ephemeral learning feedback owns no saved growth or return-comparison state. */
export function useIslandMilestoneNotice(profileId: string, active: boolean, blocked: boolean) {
    const [milestone, setMilestone] = useState<IslandMilestone>();
    const owner = useRef({ profileId, active, blocked, mounted: false, epoch: 0 });
    const lastReceipt = useRef<string | undefined>(undefined);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const dismiss = useCallback(() => {
        if (timer.current !== undefined) clearTimeout(timer.current);
        timer.current = undefined;
        owner.current.epoch += 1;
        if (owner.current.mounted) setMilestone(undefined);
    }, []);
    useLayoutEffect(() => {
        const previous = owner.current;
        if (previous.profileId !== profileId || previous.active !== active || !previous.blocked && blocked) dismiss();
        if (previous.profileId !== profileId) lastReceipt.current = undefined;
        owner.current = { profileId, active, blocked, mounted: true, epoch: previous.epoch };
    }, [profileId, active, blocked, dismiss]);
    useLayoutEffect(() => {
        const hide = () => { if (document.hidden) dismiss(); };
        document.addEventListener('visibilitychange', hide);
        return () => {
            owner.current.mounted = false;
            dismiss();
            document.removeEventListener('visibilitychange', hide);
        };
    }, [dismiss]);
    // Capture the learning session before an asynchronous save. Leaving and
    // returning cannot let that old completion reclaim the header.
    const receipt = useCallback(() => {
        const started = { ...owner.current };
        return (next: IslandMilestone) => {
            const current = owner.current;
            if (!started.mounted || !started.active || !current.mounted || !current.active || current.blocked
                || document.hidden || current.profileId !== started.profileId || current.epoch !== started.epoch
                || lastReceipt.current === next.id) return;
            if (timer.current !== undefined) clearTimeout(timer.current);
            lastReceipt.current = next.id;
            setMilestone(next);
            timer.current = setTimeout(() => {
                timer.current = undefined;
                if (owner.current.mounted) setMilestone(undefined);
            }, 6000);
        };
    }, []);
    return { milestone: active && !blocked ? milestone : undefined, receipt, dismiss };
}

/** Only a request admitted by the shared synchronous save lock owns feedback.
 * An ignored second key/help action cannot invalidate the first receipt. */
export async function runIslandMilestoneLearningAction<T>(run: ReturnType<typeof useIslandActions>['run'],
    notice: ReturnType<typeof useIslandMilestoneNotice>, action: IslandLearningAction,
    save: () => Promise<T>, minimumMs: number) {
    let announce: ReturnType<typeof notice.receipt> | undefined;
    const result = await run(() => {
        if (action.type === 'support_opened' || action.type === 'model_opened' || action.type === 'skipped') notice.dismiss();
        announce = notice.receipt();
        return save();
    }, action.type === 'support_opened' ? 0 : minimumMs,
    action.type === 'support_opened' ? 'learning-hint' : 'interaction');
    if (announce && !result) notice.dismiss();
    return { result, announce };
}
