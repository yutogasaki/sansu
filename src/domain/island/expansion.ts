export type IslandExpansionLevel = 0 | 1 | 2;

/** A saved level is authoritative, including zero. Old islands and snapshots
 * retain the land their own completed-set count had already unlocked. */
export function getIslandExpansionLevel(state: { completedSets: number; growth?: { expansionLevel?: IslandExpansionLevel } }): IslandExpansionLevel {
    return state.growth?.expansionLevel ?? (state.completedSets >= 12 ? 2 : state.completedSets >= 2 ? 1 : 0);
}
