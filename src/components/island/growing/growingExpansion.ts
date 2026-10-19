import { landQuote } from '../../../domain/growingIsland/commands';
import { islandLevel } from '../../../domain/growingIsland/community';
import { CAPE_LEVEL, LAND_PRICE } from '../../../domain/growingIsland/rules';
import type { GrowingState } from '../../../domain/growingIsland/types';

export interface GrowingExpansionLock { requiredLevel: number; currentLevel: number; price: number }

/** A missing purchase quote can mean a level gate, not the end of expansion. */
export function growingExpansionLock(state: GrowingState): GrowingExpansionLock | undefined {
    if (state.growth || landQuote(state)) return;
    const cape = state.land.capes.length;
    const requiredLevel = CAPE_LEVEL[cape], price = LAND_PRICE[3 + cape];
    if (requiredLevel === undefined || price === undefined) return;
    return { requiredLevel, currentLevel: islandLevel(state), price };
}
