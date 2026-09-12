const clamp = (value: number) => Math.max(0, Math.min(1, value));
export const smoothArrival = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** Stay on the reserved edge and reach every cell at its original clock time.
 * Only departure and arrival change speed; intermediate straight edges retain
 * constant speed, so a long walk does not stop at every cell. */
export function sampleWalkEdge(progress: number, first: boolean, last: boolean) {
    const t = clamp(progress);
    const fraction = first && last ? smoothArrival(t)
        : first ? t * t * (2 - t) : last ? t + t * t - t * t * t : t;
    const weight = (first ? smoothArrival(t / .28) : 1) * (last ? smoothArrival((1 - t) / .32) : 1);
    return { fraction, weight };
}

/** Cross the ±π seam without spinning all the way around. */
export function turnToward(from: number, to: number, progress: number) {
    const difference = Math.atan2(Math.sin(to - from), Math.cos(to - from));
    return from + difference * smoothArrival(progress);
}
