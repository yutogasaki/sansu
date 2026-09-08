import { previewIslandCustomization as previewAppearance, type IslandCosmetics, type IslandCustomizationItemId } from '../../domain/island/customization';
import { resolveIslandAppearance, sameIslandAppearance, type IslandAppearanceSlotId } from '../../domain/island/appearance';

/** Trying a look changes only this renderer value, never the saved island. */
export function previewIslandCustomization(current: IslandCosmetics, itemId: IslandCustomizationItemId, slot?: IslandAppearanceSlotId): IslandCosmetics {
    return previewAppearance(current, { type: 'equip', itemId, ...(slot ? { slot } : {}) });
}

export function sameIslandCosmetics(left: IslandCosmetics, right: IslandCosmetics) {
    return left.accentId === right.accentId && sameIslandAppearance(resolveIslandAppearance(left), resolveIslandAppearance(right));
}
