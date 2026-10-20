import { waterLayout } from './environment';
import { connectedWaterChannels } from '../islandLife/waterChannels';
import { placeConnected } from './places';
import { key, neighbors, onLand, walkableCells } from './space';
import type { Cell, GrowingState } from './types';
import type { IslandWorld } from './worldDefinition';

export interface PlaceReply { id: string; cell: Cell; step: number; delay: number }
export interface PlacePlay { kind: 'leaves' | 'water' | 'petals'; source: string; replies: PlaceReply[] }

/** Read current physical connections. This never advances water, nature or learning. */
export function placePlay(state: GrowingState, id: string, world?: IslandWorld): PlacePlay | undefined {
    const source = state.landmarks.find(owner => owner.id === id && owner.cell && onLand(state, owner.cell, world));
    if (!source?.cell) return;
    const water = waterLayout(state, world), wet = connectedWaterChannels(water), open = walkableCells(state, world);
    const kind = source.kind === 'sapling' ? 'leaves' : source.kind === 'flower' ? 'petals'
        : source.kind === 'water-bowl' || source.kind === 'water-channel' && wet.has(key(source.cell)) ? 'water' : undefined;
    if (!kind) return;
    const owners = state.landmarks.filter(owner => owner.cell && onLand(state, owner.cell, world) && (kind === 'leaves' ? owner.kind === 'sapling'
        : kind === 'petals' ? owner.id === id : owner.kind === 'water-bowl' || owner.kind === 'water-channel' && wet.has(key(owner.cell))))
        .sort((a, b) => a.id.localeCompare(b.id));
    const steps = new Map([[id, 0]]), queue = [source];
    for (let index = 0; index < queue.length; index++) {
        const from = queue[index], step = steps.get(from.id)!;
        if (kind === 'water' && step >= 8) continue;
        for (const next of owners) {
            if (steps.has(next.id)) continue;
            const joined = kind === 'leaves' ? placeConnected(from.cell!, next.cell!, open, world)
                : (water.neighbors?.(from.cell!) ?? neighbors(from.cell!)).some(cell => key(cell) === key(next.cell!)
                    && Math.abs(cell.x - from.cell!.x) + Math.abs(cell.z - from.cell!.z) === 1);
            if (!joined) continue;
            steps.set(next.id, step + 1); queue.push(next);
        }
    }
    const longest = Math.max(1, ...steps.values());
    return { kind, source: id, replies: queue.map(owner => ({ id: owner.id, cell: { ...owner.cell! }, step: steps.get(owner.id)!, delay: 500 * steps.get(owner.id)! / longest })) };
}
