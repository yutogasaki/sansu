import type { IslandHabitatId, IslandItemKind } from './types';
import { resolveIslandLivingSetting, type IslandLivingScene } from './livingSettings';

export const ISLAND_VISITORS: readonly { id: string; habitatId: IslandHabitatId; kind: IslandItemKind; minLevel: number }[] = [
    { id: 'ribbon-butterfly', habitatId: 'garden', kind: 'flower', minLevel: 2 },
    { id: 'pond-firefly', habitatId: 'waterside', kind: 'fountain', minLevel: 2 },
    { id: 'leaf-bird', habitatId: 'grove', kind: 'mushroom', minLevel: 2 },
];
export function isIslandVisitor(id: string) { return ISLAND_VISITORS.some(visitor => visitor.id === id); }

/** Stable host + visitor, never the clock or a render count. One offer in every
 * four saved section counts, at most three further completions to reappear.
 * Recording is a separate rendered-observation action. Recorded visitors can
 * be replayed at their real host whenever its physical conditions still hold. */
export function islandVisitorAvailability(island: IslandLivingScene, id: string, itemId: string) {
    const definition = ISLAND_VISITORS.find(visitor => visitor.id === id), item = island.items.find(candidate => candidate.id === itemId);
    const discovered = Boolean(island.growth?.discoveries.some(discovery => discovery.id === id));
    const habitatProgress = definition ? island.growth?.progress[definition.habitatId] ?? 0 : 0;
    const eligible = Boolean(definition && item?.position && item.kind === definition.kind && item.habitatId === definition.habitatId
        && (item.growthLevel ?? 0) >= definition.minLevel && habitatProgress >= 3
        && resolveIslandLivingSetting(island, item, id));
    let hash = 2166136261;
    for (const character of `${itemId}:${id}`) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16777619); }
    const offset = (hash >>> 0) % 4, section = Math.max(0, Math.floor(island.completedSets));
    const nextInSets = discovered ? 0 : (offset - section % 4 + 4) % 4;
    return { eligible, offered: eligible && (discovered || nextInSets === 0), discovered, nextInSets };
}

export function availableIslandVisitorIds(island: IslandLivingScene) {
    return ISLAND_VISITORS.filter(visitor => island.items.some(item => islandVisitorAvailability(island, visitor.id, item.id).offered))
        .map(visitor => visitor.id);
}
