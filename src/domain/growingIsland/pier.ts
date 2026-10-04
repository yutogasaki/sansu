import { islandCharacter, richness } from './environment';
import { pick, roll } from './random';
import { AVAILABLE_SPECIES, FAVORED, isKid, KID, KIDS, RARE, RULES } from './rules';
import type { GrowingState, Species, Trait, Visitor } from './types';

const TRAITS: readonly Trait[] = ['lively', 'mellow', 'shy', 'hungry'];

export function rareChance(state: GrowingState) {
    return RULES.rareBase + RULES.rareBonus * Math.min(1, richness(state) / RULES.rareRichness);
}

/**
 * The visitor for a boat ordinal. Species follow the island's character when the boat
 * appears; the sparkle chance follows only the island's richness, never learning volume.
 */
export function rollVisitor(state: GrowingState, ordinal: number, only?: readonly Species[]): Visitor {
    // えま and えいた come once each: on the second and third boats, or soon after on older islands.
    const present = new Set<Species>([...state.villagers.map(v => v.species), state.pier.visitor.species, state.pier.next.species]);
    const missing = KIDS.filter(kid => !present.has(kid));
    if (!only && missing.length && (ordinal === 1 || ordinal === 2)) {
        const first = roll(state.seed, 'kid-order', 'island', 0) < .5 ? 'girl' : 'boy';
        const kid = missing.includes(first) ? first : missing[0];
        return { ordinal, species: kid, variant: { ...KID[kid].variant }, trait: KID[kid].trait };
    }
    const character = islandCharacter(state), favored = character === 'mixed' ? [] : FAVORED[character];
    const pool = (only ?? AVAILABLE_SPECIES).filter(s => !isKid(s) || (ordinal > 0 && missing.includes(s)));
    const weight = (s: Species) => {
        const rare = RARE[s];
        if (rare) return rare.weight * (rare.home === character ? 3 : 1);
        return isKid(s) || favored.includes(s) ? RULES.favoredWeight : 1;
    };
    const species = pick(pool, pool.map(weight), roll(state.seed, 'pier-species', 'boat', ordinal));
    if (isKid(species)) return { ordinal, species, variant: { ...KID[species].variant }, trait: KID[species].trait };
    return {
        ordinal, species,
        variant: {
            color: Math.floor(roll(state.seed, 'pier-color', 'boat', ordinal) * 6),
            accessory: Math.floor(roll(state.seed, 'pier-accessory', 'boat', ordinal) * 4),
            sparkle: roll(state.seed, 'pier-sparkle', 'boat', ordinal) < rareChance(state),
        },
        trait: TRAITS[Math.floor(roll(state.seed, 'pier-trait', 'boat', ordinal) * TRAITS.length)],
    };
}

export function boatInterval(villagers: number) {
    return RULES.boatBaseHours + RULES.boatHoursPerVillager * villagers;
}

export const docked = (state: GrowingState, hour = state.town.clock) => hour >= state.pier.dockAt;

/** How close the boat is, 0 far away to 1 at the pier. Learning moves it closer. */
export function boatProgress(state: GrowingState) {
    if (docked(state)) return 1;
    // This crossing began when the previous resident arrived. Its saved deadline may
    // use an older balance; rendering must not substitute today's boat interval.
    const sailedAt = state.villagers.reduce((latest, v) => Math.max(latest, v.arrivedAt), 0);
    const interval = state.pier.dockAt - sailedAt;
    return interval > 0 ? Math.max(0, Math.min(1, (state.town.clock - sailedAt) / interval)) : 0;
}

/**
 * The waiting visitor comes ashore; the silhouette sails in next. Its crossing takes longer
 * as the village grows, which paces the island without asking for more learning.
 */
export function advancePier(state: GrowingState, hour: number): Visitor {
    const arriving = state.pier.visitor;
    const rolled = state.pier.rolled + 1;
    state.pier = { visitor: state.pier.next, next: rollVisitor(state, rolled), rolled,
        dockAt: hour + boatInterval(state.villagers.length + 1) };
    return arriving;
}
