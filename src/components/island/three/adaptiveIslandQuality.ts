/** Frame cadence is a conservative signal, not a measurement of free GPU memory. */
export class AdaptiveIslandQuality {
    private readonly levels: number[];
    private index = 0;
    private ceiling: number;
    private last?: number;
    private elapsed = 0;
    private frames = 0;
    private slow = 0;
    private fast = 0;

    constructor(maxRatio: number) {
        this.levels = [.65, .8, 1, 1.25].filter(value => value <= Math.max(.65, Math.min(1.25, Number.isFinite(maxRatio) ? maxRatio : .65)));
        this.ceiling = this.levels.length - 1;
    }
    get ratio() { return this.levels[this.index]; }
    get ceilingRatio() { return this.levels[this.ceiling]; }
    reset() { this.last = undefined; this.elapsed = this.frames = this.slow = this.fast = 0; }

    sample(now: number, visible: boolean): number {
        if (!visible || !Number.isFinite(now)) { this.reset(); return this.ratio; }
        const gap = this.last === undefined ? 0 : now - this.last;
        this.last = now;
        if (gap <= 0 || gap > 1000) { this.reset(); this.last = now; return this.ratio; }
        this.elapsed += gap; this.frames++;
        if (gap > 50) this.slow++;
        if (gap <= 40) this.fast++;
        if (this.elapsed >= 1000 && this.frames >= 20 && this.slow / this.frames >= .25) {
            if (this.index > 0) {
                this.index--;
                this.ceiling = this.index; // Do not retry a quality level that proved too expensive.
            } // Slow startup at the floor may warm up; it has not disproved any higher level yet.
            this.reset();
        } else if (this.elapsed >= 3000 && this.frames >= 60) {
            if (this.fast / this.frames >= .9 && this.elapsed / this.frames <= 36) this.index = Math.min(this.ceiling, this.index + 1);
            this.reset();
        }
        return this.ratio;
    }
    /** The parent may recreate a lost context, but only below the failed quality level. */
    fallbackCeiling(): number | undefined {
        if (this.index === 0) return undefined;
        return this.levels[this.index - 1];
    }
}
