import { CUSTOMIZATION_CATALOG, type IslandAccentId, type IslandCosmetics, type IslandCustomizationItemId } from '../../domain/island/customization';

/** Trying a look changes only this renderer value, never the saved island. */
export function previewIslandCustomization(current: IslandCosmetics, itemId: IslandCustomizationItemId): IslandCosmetics {
    const item = CUSTOMIZATION_CATALOG.find(candidate => candidate.id === itemId)!;
    return item.kind === 'theme' ? { ...current, themeId: item.themeId } : { ...current, accentId: item.id as IslandAccentId };
}

export function sameIslandCosmetics(left: IslandCosmetics, right: IslandCosmetics) {
    return left.themeId === right.themeId && left.accentId === right.accentId;
}
