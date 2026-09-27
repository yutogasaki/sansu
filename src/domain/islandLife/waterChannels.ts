import { growthStage, type Cell, type LifeState } from './model';
import { cellKey, landCells } from './space';

const clamp = (value: number) => Math.max(0, Math.min(1, value));
const distance = (a: Cell, b: Cell) => Math.abs(a.x - b.x) + Math.abs(a.z - b.z);
const MAX_CHANNEL_STEPS = 8;

/** N/E/S/W bits describe the physical trench ends, including a neighboring bowl. */
export function waterChannelConnections(state: LifeState, cell: Cell) {
    return [{ x: 0, z: -1, bit: 1 }, { x: 1, z: 0, bit: 2 },
        { x: 0, z: 1, bit: 4 }, { x: -1, z: 0, bit: 8 }].reduce((mask, { x, z, bit }) =>
        state.items.some(item => item.cell?.x === cell.x + x && item.cell?.z === cell.z + z
            && (item.kind === 'water-channel' || item.kind === 'water-bowl')) ? mask | bit : mask, 0);
}

/** Water bowls feed only adjacent channel pieces. A disconnected ditch remains dry. */
export function connectedWaterChannels(state: LifeState): Set<string> {
    const channels = new Map(state.items.filter(item => item.kind === 'water-channel' && item.cell)
        .map(item => [cellKey(item.cell!), item]));
    const bowls = state.items.filter(item => item.kind === 'water-bowl' && item.cell);
    const reached = new Set<string>();
    let frontier = [...channels.entries()].filter(([key, item]) => {
        if (!item.cell || !bowls.some(bowl => distance(bowl.cell!, item.cell!) === 1)) return false;
        reached.add(key); return true;
    }).map(([key]) => key);
    for (let step = 1; step < MAX_CHANNEL_STEPS && frontier.length; step++) {
        const next: string[] = [];
        for (const key of frontier) {
            const item = channels.get(key)!;
            for (const delta of [{ x: 1, z: 0 }, { x: -1, z: 0 }, { x: 0, z: 1 }, { x: 0, z: -1 }]) {
                const neighbor = cellKey({ x: item.cell!.x + delta.x, z: item.cell!.z + delta.z });
                if (channels.has(neighbor) && !reached.has(neighbor)) { reached.add(neighbor); next.push(neighbor); }
            }
        }
        frontier = next;
    }
    return reached;
}

export function waterInfluence(state: LifeState, cell: Cell, reached = connectedWaterChannels(state)) {
    const sources = state.items.filter(item => item.cell && (item.kind === 'water-bowl'
        || item.kind === 'water-channel' && reached.has(cellKey(item.cell))));
    return Math.max(0, ...sources.map(item => clamp(1 - Math.max(0, distance(item.cell!, cell) - 1) / 3)));
}

export function shadeInfluence(state: LifeState, cell: Cell, elapsedGrowthHours = 0) {
    return Math.max(0, ...state.items.filter(item => item.kind === 'sapling' && item.cell
        && growthStage({ ...item, growth: item.growth + elapsedGrowthHours }) === 2)
        .map(item => clamp(1 - distance(item.cell!, cell) / 3)));
}

/** The current, deterministic moisture target for every owned land cell. */
export function landMoisture(state: LifeState): Record<string, number> {
    const reached = connectedWaterChannels(state);
    return Object.fromEntries(landCells(state).map(cell => [cellKey(cell), clamp(.20
        + .50 * waterInfluence(state, cell, reached) + .08 * shadeInfluence(state, cell))]));
}
