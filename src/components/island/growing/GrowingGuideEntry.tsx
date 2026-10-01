import { useEffect, useRef } from 'react';
import type { AchievementId, GuidanceEvidence, StarterStepId } from '../../../domain/growingIsland';

export type GrowingGuideAction = { kind: 'goal'; id: AchievementId } | { kind: 'starter'; step: StarterStepId }
    | { kind: 'memory'; evidence: GuidanceEvidence } | { kind: 'resume' };
export interface GrowingGuideRequest { id: string; action: GrowingGuideAction }

/** House choices wait for the actual island renderer before addressing its objects. */
export function GrowingGuideEntry({ request, ready, onEnter }: {
    request: GrowingGuideRequest; ready: boolean; onEnter: (action: GrowingGuideAction) => void;
}) {
    const consumed = useRef<string | undefined>(undefined);
    useEffect(() => {
        if (!ready || consumed.current === request.id) return;
        consumed.current = request.id;
        onEnter(request.action);
    }, [request, ready, onEnter]);
    return null;
}
