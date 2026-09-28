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
export function sampleBurstGesture(elapsed: number, leap: boolean, reduced: boolean) {
    const rest = { height: 0, squash: 1, arms: 0, tilt: 0 };
    if (reduced || elapsed < 0 || elapsed >= 880) return rest;
    if (!leap) {
        const nod = Math.sin(clamp(elapsed / 420) * Math.PI);
        return { ...rest, squash: 1 - nod * .045, arms: nod * .26 };
    }
    if (elapsed < ACTOR_JUMP_MS) {
        const anticipation = ease(elapsed / ACTOR_JUMP_MS);
        return { height: 0, squash: 1 - anticipation * .11, arms: anticipation * .28, tilt: 0 };
    }
    if (elapsed < ACTOR_LAND_MS) {
        const flight = (elapsed - ACTOR_JUMP_MS) / (ACTOR_LAND_MS - ACTOR_JUMP_MS);
        return {
            height: Math.sin(flight * Math.PI) * .16,
            squash: 1 - .11 * (1 - ease(flight * 5)) + .035 * Math.sin(flight * Math.PI),
            arms: .28 + 1.78 * Math.sin(flight * Math.PI),
            tilt: Math.sin(flight * Math.PI * 2) * .055,
        };
    }
    const landing = Math.sin(clamp((elapsed - ACTOR_LAND_MS) / 320) * Math.PI);
    return { height: 0, squash: 1 - landing * .075, arms: landing * .30, tilt: 0 };
}
