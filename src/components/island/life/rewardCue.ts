/** Return a one-time cue amount when a visible wallet value increased. */
export function rewardDelta(current: number, previous: number | undefined): number | undefined {
    if (previous === undefined || current <= previous) return undefined;
    return current - previous;
}
