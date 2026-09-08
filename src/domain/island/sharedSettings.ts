import { ISLAND_ITEMS } from './catalog';
import type { IslandItem } from './types';

export type IslandSharingKind = 'flower' | 'star' | 'bubble';
type PlacedItem = IslandItem & { position: { x: number; z: number } };
export interface IslandSharingPair {
    kind: IslandSharingKind;
    source: PlacedItem;
    seat: PlacedItem;
    distance: number;
}
const COMBINATIONS = [
    { kind: 'flower', source: 'flower', seat: 'bench' },
    { kind: 'star', source: 'lantern', seat: 'mushroom' },
    { kind: 'bubble', source: 'fountain', seat: 'swing' },
] as const;
const compareId = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const placed = (item: IslandItem): item is PlacedItem => Boolean(item.position);

/** The guide and real sharing preflight agree on physical pairs. Walking paths
 * and present residents are checked by the runtime immediately before acting. */
export function islandSharingPairs(items: readonly IslandItem[], selectedId: string): IslandSharingPair[] {
    const selected = items.find(item => item.id === selectedId);
    if (!selected || !placed(selected)) return [];
    const combination = COMBINATIONS.find(candidate => candidate.source === selected.kind || candidate.seat === selected.kind);
    if (!combination) return [];
    const pairs: IslandSharingPair[] = [];
    for (const other of items) {
        if (other.id === selectedId || !placed(other)) continue;
        const source: PlacedItem = selected.kind === combination.source ? selected : other;
        const seat: PlacedItem = selected.kind === combination.seat ? selected : other;
        if (source.kind !== combination.source || seat.kind !== combination.seat) continue;
        const d = Math.hypot(source.position.x - seat.position.x, source.position.z - seat.position.z);
        if (!d || d > ISLAND_ITEMS[source.kind].radius + ISLAND_ITEMS[seat.kind].radius + 1.4) continue;
        const facing = (Math.sin(seat.rotation) * (source.position.x - seat.position.x)
            + Math.cos(seat.rotation) * (source.position.z - seat.position.z)) / d;
        if (!Number.isFinite(facing) || facing < .5) continue;
        pairs.push({ kind: combination.kind, source, seat, distance: d });
    }
    return pairs.sort((a, b) => a.distance - b.distance
        || compareId(a.source.id, b.source.id) || compareId(a.seat.id, b.seat.id));
}
