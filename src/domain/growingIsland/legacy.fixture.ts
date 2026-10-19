/** Explicit pre-v0.4 fixtures for the retained legacy mechanics and authored kit contracts. */
import { newIsland } from './island';
import { refreshUnlocks } from './community';
export function newLegacyIsland(profileId: string, now: number) {
    const state = newIsland(profileId, now);
    delete state.growth;
    state.unlocked = [];
    refreshUnlocks(state);
    return state;
}
