import { islandCharacter, richness } from './environment';
import { pick, roll } from './random';
import { AVAILABLE_SPECIES, FAVORED, RULES } from './rules';
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
    const character = islandCharacter(state), favored = character === 'mixed' ? [] : FAVORED[character];
    const pool = only ?? AVAILABLE_SPECIES;
    const species = pick(pool, pool.map(s => favored.includes(s) ? RULES.favoredWeight : 1), roll(state.seed, 'pier-species', 'boat', ordinal));
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
    const interval = boatInterval(state.villagers.length - 1);
    return Math.max(0, Math.min(1, 1 - (state.pier.dockAt - state.town.clock) / interval));
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
