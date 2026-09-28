export const ACTOR_CATCH_MS = 150;
export const ACTOR_PLACE_MS = 300;
export const ACTOR_JUMP_MS = 110;
export const ACTOR_LAND_MS = 560;

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const ease = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };

/** The hand holds its contact pose while the numeral rests in the paw. */
export function sampleInputGesture(elapsed: number, reduced: boolean) {
    if (reduced || elapsed < 0 || elapsed >= 620) return { reach: 0, look: 0, follow: 0 };
    const reach = elapsed < ACTOR_CATCH_MS ? ease(elapsed / ACTOR_CATCH_MS)
        : elapsed <= ACTOR_PLACE_MS ? 1 : 1 - ease((elapsed - ACTOR_PLACE_MS) / 180);
    return {
        reach,
        look: elapsed < ACTOR_PLACE_MS ? ease(elapsed / 100) : 1 - ease((elapsed - ACTOR_PLACE_MS) / 320),
        follow: ease((elapsed - ACTOR_CATCH_MS) / (ACTOR_PLACE_MS - ACTOR_CATCH_MS)),
    };
}

/** Squash belongs to the body; the feet remain planted until an earned leap. */
export function sampleBurstGesture(elapsed: number, leap: boolean, reduced: boolean, big = false) {
    const rest = { height: 0, squash: 1, arms: 0, tilt: 0, turn: 0, kick: 0, spread: 0, smile: 0 };
    if (reduced || elapsed < 0 || elapsed >= (big ? 1520 : 880)) return rest;
    if (!leap) {
        const nod = Math.sin(clamp(elapsed / 420) * Math.PI);
        return { ...rest, squash: 1 - nod * .06, arms: nod * .38 };
    }
    if (elapsed < ACTOR_JUMP_MS) {
        const anticipation = ease(elapsed / ACTOR_JUMP_MS);
        return { ...rest, squash: 1 - anticipation * (big ? .17 : .13), arms: anticipation * .25 };
    }
    if (elapsed < ACTOR_LAND_MS) {
        const flight = (elapsed - ACTOR_JUMP_MS) / (ACTOR_LAND_MS - ACTOR_JUMP_MS);
        const arc = Math.sin(flight * Math.PI);
        const open = ease(flight * 5);
        return {
            height: arc * (big ? .18 : .145),
            squash: 1 - (big ? .17 : .13) * (1 - open) + .014 * arc,
            arms: .25 + (big ? 1.36 * open : 1.55 * arc),
            tilt: big ? Math.sin(flight * Math.PI * 2) * .055 : -arc * .10,
            turn: big ? Math.sin(flight * Math.PI * 2) * .12 : arc * .18,
            kick: big ? 0 : arc * .075,
            spread: big ? arc * .055 : 0,
            smile: open,
        };
    }
    const landing = Math.sin(clamp((elapsed - ACTOR_LAND_MS) / 320) * Math.PI);
    // Five streak ends in a readable arms-wide portrait after the landing.
    // Hold the smile without another bounce while the large 5 remains on stage.
    const hold = big ? 1 - ease((elapsed - 1160) / 360) : 1 - ease((elapsed - ACTOR_LAND_MS) / 320);
    return { ...rest, squash: 1 - landing * .085, arms: big ? 1.61 * hold : landing * .38, smile: big ? hold : hold * .60 };
}
