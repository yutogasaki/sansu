/** The moon over the island follows the real calendar: a mean synodic month from a known new moon. */
const SYNODIC_DAYS = 29.530588853, NEW_MOON = Date.UTC(2000, 0, 6, 18, 14), DAY_MS = 86_400_000;

/** 0 new moon, .5 full moon, back toward 1. */
export function moonPhase(at: number) {
    const days = (at - NEW_MOON) / DAY_MS;
    return ((days % SYNODIC_DAYS) + SYNODIC_DAYS) % SYNODIC_DAYS / SYNODIC_DAYS;
}

/** About a day and a half either side of the full moon. */
export const fullMoon = (at: number) => Math.abs(moonPhase(at) - .5) * SYNODIC_DAYS <= 1.5;
