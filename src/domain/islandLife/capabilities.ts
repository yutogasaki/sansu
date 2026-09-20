import { CATALOG, lifeEnabled, type ItemKind, type LifeItem } from './model';

/** Release capability is independent of DEV scenery and diagnostic ownership. */
export function lifeDiscoveryEnabled() {
    return lifeEnabled() && (import.meta.env.VITE_ISLAND_LIFE_DISCOVERY_ENABLED === 'true'
        || import.meta.env.DEV && import.meta.env.VITE_ISLAND_LIFE_PREVIEW === 'true');
}
const baseKinds: ItemKind[] = ['flower', 'bench', 'swing', 'lantern', 'fence', 'planter'];
export function lifeCatalogKinds(): ItemKind[] {
    return lifeDiscoveryEnabled() ? Object.keys(CATALOG) as ItemKind[] : [...baseKinds];
}
export function lifeDiscoveryPresentation(items: readonly Pick<LifeItem, 'kind'>[] = []) {
    // A rollout switch cannot strip the use of already-owned additional items.
    return lifeDiscoveryEnabled() || items.some(item => !baseKinds.includes(item.kind)) ? {
        readingEncounterVersion: 1 as const, encounterVersion: 1 as const,
        footstepMagicVersion: 1 as const, shadowMagicVersion: 1 as const, waterMagicVersion: 1 as const,
        facilityPresentation: 'carry-care-v1' as const, landscapeVersion: 'groves-water-v1' as const,
        relationVersion: 'water-bench-v1' as const,
    } : {};
}
