/** Rules applied only after an explicit, validated legacy checkpoint. */
export const ECONOMY_V3_VERSION = 'life-v3.0-rc1' as const;
const HOUR_MS = 3_600_000;
export const GROWTH_WINDOW_MS = 24 * HOUR_MS;
export interface LifeEconomyV3 {
    version: typeof ECONOMY_V3_VERSION;
    completionTimes: number[];
    lightRemainingBudget: number;
}

export function growthRateV3(completionTimes: readonly number[], at: number) {
    const count = completionTimes.filter(time => time <= at && time > at - GROWTH_WINDOW_MS).length;
    return .5 + .5 * Math.min(count / 6, 1);
}

/** Integrate starts and expiries; a current speed is never extrapolated forever. */
export function effectiveGrowthHours(completionTimes: readonly number[], from: number, to: number) {
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) throw new Error('Invalid growth interval');
    let count = 0, crossesBoundary = false;
    for (const time of completionTimes) {
        if (!Number.isFinite(time)) throw new Error('Invalid growth interval');
        if (time <= from && time > from - GROWTH_WINDOW_MS) count++;
        const expiry = time + GROWTH_WINDOW_MS;
        if (time > from && time < to || expiry > from && expiry < to) crossesBoundary = true;
    }
    // Most resident ticks cross no learning/expiry boundary. Preserve the exact
    // original arithmetic, without constructing and sorting boundary arrays.
    if (!crossesBoundary) return from === to ? 0 : (to - from) / HOUR_MS * (.5 + .5 * Math.min(count / 6, 1));
    const boundaries = [...new Set([from, to, ...completionTimes.flatMap(time => [time, time + GROWTH_WINDOW_MS])
        .filter(time => time > from && time < to)])].sort((a, b) => a - b);
    return boundaries.slice(1).reduce((total, end, i) => total + (end - boundaries[i]) / HOUR_MS * growthRateV3(completionTimes, boundaries[i]), 0);
}

/** Wall hours to the next stage, assuming no additional learning. */
export function growthHoursRemaining(completionTimes: readonly number[], now: number, effectiveHours: number) {
    if (![now, effectiveHours, ...completionTimes].every(Number.isFinite) || effectiveHours < 0) throw new Error('Invalid growth estimate');
    const known = completionTimes.filter(time => time <= now), expiries = [...new Set(known.map(time => time + GROWTH_WINDOW_MS).filter(time => time > now))].sort((a, b) => a - b);
    let at = now, remaining = effectiveHours;
    for (const end of expiries) {
        const rate = growthRateV3(known, at), available = (end - at) / HOUR_MS * rate;
        if (remaining <= available) return (at - now) / HOUR_MS + remaining / rate;
        remaining -= available; at = end;
    }
    return (at - now) / HOUR_MS + remaining / .5;
}

/** Issued once at cutover. Buying a color must not replenish this budget. */
export function initialLightBudget(light: number, ownedStyles: readonly string[]) {
    if (!Number.isSafeInteger(light) || light < 0) throw new Error('Invalid legacy light');
    const missing = ['sunshine', 'starlight'].filter(style => !ownedStyles.includes(style)).length;
    return Math.max(0, missing * 4 - light);
}
export function issueFiniteLight(light: number, budget: number, eligibleActivities: number) {
    if (![light, budget, eligibleActivities].every(value => Number.isSafeInteger(value) && value >= 0)) throw new Error('Invalid light issuance');
    const issued = Math.min(budget, eligibleActivities);
    return { light: light + issued, lightRemainingBudget: budget - issued, issued };
}
