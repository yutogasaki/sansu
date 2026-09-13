import type { DiscoveryScene, PresentationEvidence } from './discoveryJournal';

export interface VisibleSceneFrame {
    rendered: boolean; foreground: boolean; onScreen: boolean; unoccluded: boolean; preview: boolean; coreShown: boolean;
}

/** Sample only after render. Visibility comes from the actual camera/overlay checks,
 * not from structural eligibility. Gaps never stand in for rendered frames. */
export class DiscoveryPresentation {
    private previousVisibleAt?: number;
    private firstVisibleAt?: number;
    private duration = 0;
    private delivered = false;
    private cancelled = false;
    constructor(private readonly event: Pick<DiscoveryScene, 'eventId' | 'source' | 'createdAt'>) {}

    sample(monotonicAt: number, wallAt: number, frame: VisibleSceneFrame): PresentationEvidence | undefined {
        if (this.cancelled || this.delivered) return undefined;
        const visible = Number.isFinite(monotonicAt) && Number.isFinite(wallAt) && frame.rendered && frame.foreground
            && frame.onScreen && frame.unoccluded && !frame.preview && frame.coreShown;
        if (!visible) { this.previousVisibleAt = undefined; return undefined; }
        if (this.firstVisibleAt === undefined) this.firstVisibleAt = Math.max(this.event.createdAt, wallAt);
        if (this.previousVisibleAt !== undefined) {
            const elapsed = monotonicAt - this.previousVisibleAt;
            // A paused callback or backward clock is not evidence of continued display.
            if (elapsed >= 0 && elapsed <= 250) this.duration += elapsed;
        }
        this.previousVisibleAt = monotonicAt;
        if (this.duration < 1000) return undefined;
        this.delivered = true;
        return { eventId: this.event.eventId, firstVisibleAt: this.firstVisibleAt,
            visibleDurationMs: this.duration, coreShown: true, presentationKind: this.event.source };
    }

    cancel() { this.cancelled = true; this.previousVisibleAt = undefined; }
}
