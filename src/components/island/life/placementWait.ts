/** A pending placement belongs to one screen selection and one rendered world clock. */
export class PlacementWait {
    private epoch = 0;
    private pending?: { end: number; resolve: (completed: boolean) => void };
    begin() { this.cancel(); return this.epoch; }
    current(token: number) { return token === this.epoch; }
    cancel() { this.epoch++; this.pending?.resolve(false); this.pending = undefined; }
    wait(token: number, end: number) {
        if (!this.current(token)) return Promise.resolve(false);
        return new Promise<boolean>(resolve => { this.pending = { end, resolve }; });
    }
    frame(now: number, visible: boolean) {
        if (visible && this.pending && now >= this.pending.end) {
            this.pending.resolve(true); this.pending = undefined;
        }
    }
}
