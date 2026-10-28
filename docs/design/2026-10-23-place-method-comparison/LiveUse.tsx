import { useSyncExternalStore } from 'react';
import type { PlaceUseReceipt } from '../../../src/domain/growingIsland/placeGoals';
import { candidateId } from './candidate';

export interface TrialLiveUseObservation {
    observedAtMs: number;
    observedFrameTimeMs: number;
    delivery: 'fresh-life-receipt' | 'retry';
    receipt: PlaceUseReceipt;
    worldId: string;
    worldRevision: string | null;
    actorPosition: { x: number; y: number; z: number };
    target: { id: string; kind: string; cell: { x: number; z: number } } | undefined;
    currentPlaceRevisionMatches: boolean;
    documentVisibility: string;
    active: boolean;
    playActive: boolean;
    inFrustum: boolean;
    renderSucceeded: boolean;
}

interface TrialLiveUseEvent extends TrialLiveUseObservation {
    sequence: number;
    observedAt: string;
    candidate: string;
    handlerAccepted: true;
}

interface TrialLiveUseSnapshot {
    scope: 'rendered-live-receipts-not-save-history';
    sessionId: string | null;
    pageStartedAtMs: number | null;
    candidate: string | null;
    queryCandidate: string | null;
    count: number;
    retained: number;
    latest: TrialLiveUseEvent[];
}

// Module-local observation only: no window global, timer, app state or persistence.
const listeners = new Set<() => void>();
let snapshot: TrialLiveUseSnapshot = {
    scope: 'rendered-live-receipts-not-save-history', sessionId: null,
    pageStartedAtMs: null, candidate: null, queryCandidate: null,
    count: 0, retained: 0, latest: [],
};

function enabled() {
    return typeof location !== 'undefined' && new URLSearchParams(location.search).has('trialEvidence');
}

function getSnapshot() {
    if (enabled() && snapshot.sessionId === null) {
        snapshot = { ...snapshot, sessionId: crypto.randomUUID(),
            pageStartedAtMs: performance.timeOrigin, candidate: candidateId(),
            queryCandidate: new URLSearchParams(location.search).get('terrainTrial') };
    }
    return snapshot;
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}

/** Called only after the existing UI receipt handler accepts a rendered use. */
export function recordTrialLiveUse(observation: TrialLiveUseObservation) {
    if (!enabled() || observation.delivery !== 'fresh-life-receipt'
        || !observation.currentPlaceRevisionMatches || !observation.target
        || !observation.active || !observation.playActive
        || observation.documentVisibility !== 'visible'
        || !observation.inFrustum || !observation.renderSucceeded
        || !Number.isFinite(observation.observedAtMs)) return;
    const previous = getSnapshot();
    const event: TrialLiveUseEvent = {
        ...observation, receipt: { ...observation.receipt },
        actorPosition: { ...observation.actorPosition },
        target: { ...observation.target, cell: { ...observation.target.cell } },
        sequence: previous.count + 1, observedAt: new Date(observation.observedAtMs).toISOString(),
        candidate: candidateId(), handlerAccepted: true,
    };
    const latest = [...previous.latest, event].slice(-20);
    snapshot = { ...previous, count: event.sequence, retained: latest.length, latest };
    listeners.forEach(listener => listener());
}

/** Trial-only visible evidence. No control here can grant or replay a use. */
export function LiveUse() {
    const value = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    if (!enabled()) return null;
    const json = JSON.stringify(value, null, 2);
    return <section aria-label="描画後の利用観測">
        <p><strong>このページの利用受理：{value.count} 件</strong>（直近 {value.retained} 件を表示）</p>
        <p>描画後の新しい利用だけを観測します。再送・保存履歴の件数ではありません。自然利用の判定には操作記録も使います。</p>
        <pre data-trial-live-uses={json} style={{ maxHeight: 240, overflow: 'auto', fontSize: 10, whiteSpace: 'pre-wrap' }}>{json}</pre>
    </section>;
}
