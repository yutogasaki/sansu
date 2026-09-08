import { getIslandExpansionLevel } from './expansion';
import { islandSharingPairs } from './sharedSettings';
import type { IslandItem, IslandRecord } from './types';

export type IslandLivingScene = Pick<IslandRecord, 'items' | 'completedSets' | 'growth'>;
export interface IslandLivingSetting {
    sourceItemId: string;
    supportingItemId?: string;
    anchor: { x: number; y: number; z: number };
}

/** One physical partner is selected once by distance and stable ID. Eligibility,
 * the residents' gaze and the visible result all use this same resolver. */
export function resolveIslandLivingSetting(island: IslandLivingScene, item: IslandItem,
    discoveryId: string): IslandLivingSetting | undefined {
    const position = item.position;
    if (!position) return undefined;
    const base = { sourceItemId: item.id, anchor: { ...position, y: .45 } };
    const sharingKind = discoveryId === 'flower-sharing' ? 'flower'
        : discoveryId === 'water-sharing' ? 'bubble' : discoveryId === 'lantern-sharing' ? 'star' : undefined;
    if (sharingKind) {
        const pair = islandSharingPairs(island.items, item.id).find(candidate => candidate.kind === sharingKind);
        return pair ? { ...base, supportingItemId: pair.source.id === item.id ? pair.seat.id : pair.source.id,
            anchor: { ...pair.seat.position, y: .6 } } : undefined;
    }
    if (discoveryId === 'water-gazing' && item.kind === 'swing'
        || discoveryId === 'petal-ripple' || discoveryId === 'lantern-reflection') {
        const combination = discoveryId !== 'water-gazing';
        if (combination && ((item.growthLevel ?? 0) < 2 || (discoveryId === 'petal-ripple'
            ? item.kind !== 'flower' || item.habitatId !== 'garden'
            : item.kind !== 'lantern' || !['grove', 'village'].includes(item.habitatId ?? '')))) return undefined;
        const partners = island.items.filter(other => {
            if (other.id === item.id || other.kind !== 'fountain' || !other.position
                || combination && ((other.growthLevel ?? 0) < 1 || other.habitatId !== 'waterside')) return false;
            const dx = other.position.x - position.x, dz = other.position.z - position.z, distance = Math.hypot(dx, dz);
            return distance <= 2.9 && (combination
                || (Math.sin(item.rotation) * dx + Math.cos(item.rotation) * dz) / Math.max(.01, distance) >= .5);
        }).sort((a, b) => Math.hypot(a.position!.x - position.x, a.position!.z - position.z)
            - Math.hypot(b.position!.x - position.x, b.position!.z - position.z) || a.id.localeCompare(b.id));
        const partner = partners[0];
        return partner ? { sourceItemId: item.id, supportingItemId: partner.id, anchor: { ...partner.position!, y: .327 } } : undefined;
    }
    if (discoveryId === 'shade-rest' || discoveryId === 'leaf-bird') {
        const tree = [{ x: 1.6, z: -1.6 }, ...(getIslandExpansionLevel(island) >= 2 ? [{ x: -6.7, z: -1.2 }] : [])]
            .filter(candidate => Math.hypot(position.x - candidate.x, position.z - candidate.z) <= 2.8)
            .sort((a, b) => Math.hypot(position.x - a.x, position.z - a.z) - Math.hypot(position.x - b.x, position.z - b.z))[0];
        return tree ? { ...base, anchor: { ...tree, y: 1.25 } } : undefined;
    }
    return base;
}
