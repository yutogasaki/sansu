/** A display clock: scene construction and its first GPU render are not acting time.
 * The persisted world clock remains authoritative whenever a new snapshot arrives. */
export class LifePresentationClock {
    private snapshot?: { now: number };
    private at = 0;
    private started?: number;
    private firstFrame = true;

    prepare(snapshot: { now: number }, monotonicNow: number) {
        this.at = snapshot === this.snapshot ? this.sample(monotonicNow) : snapshot.now;
        this.snapshot = snapshot;
        this.started = undefined;
        this.firstFrame = true;
    }

    sample(monotonicNow: number) {
        // The first browser frame can still wait on queued GPU work after
        // render() returns. Keep that one startup gap from skipping the pose.
        if (this.started !== undefined && this.firstFrame) {
            this.at += Math.min(100, Math.max(0, monotonicNow - this.started));
            this.started = monotonicNow;
            this.firstFrame = false;
        }
        return this.at + (this.started === undefined ? 0 : Math.max(0, monotonicNow - this.started));
    }

    resume(monotonicNow: number, unavailable = false) {
        if (unavailable) this.firstFrame = false;
        this.started ??= monotonicNow;
    }
}
