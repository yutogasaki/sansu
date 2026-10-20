import { key, onLand, reachableFromHome, walkableCells } from './space';
import { terrainHeightAt } from './placeTerrain';
import type { Cell, GrowingState } from './types';
import type { IslandWorld } from './worldDefinition';

export interface CommunityRoofModule {
    ownerIds: [string, string];
    minX: number; maxX: number; minZ: number; maxZ: number;
    groundMax: number; target: Cell;
}

/** A finite front-yard bay repeated between real houses. It grants no new floor or ownership. */
export function communityRoofModules(state: GrowingState, ids: readonly string[], world?: IslandWorld): CommunityRoofModule[] {
    if (!state.growth || world) return [];
    const open = walkableCells(state), reached = reachableFromHome(state, open);
    const homes = state.plots.filter(home => ids.includes(home.id) && home.kind === 'home' && home.stage >= 2 && home.cell && !state.unopened.includes(home.id))
        .sort((a, b) => a.cell!.z - b.cell!.z || a.cell!.x - b.cell!.x || a.id.localeCompare(b.id));
    const used = new Set<string>(), result: CommunityRoofModule[] = [];
    for (let i = 0; i < homes.length; i++) for (let j = i + 1; j < homes.length; j++) {
        const left = homes[i], right = homes[j], a = left.cell!, b = right.cell!, gap = b.x - a.x;
        if (used.has(left.id) || used.has(right.id) || a.z !== b.z || gap < 2 || gap > 4) continue;
        const minX = a.x + .42, maxX = b.x - .42, minZ = a.z + .70, maxZ = a.z + 1.45;
        const target = { x: Math.round((a.x + b.x) / 2), z: a.z + 1 };
        if (!reached.has(key(target))) continue;
        // The entire roof and its margin stay over acquired ground. Foreign
        // plants/buildings keep their own visible space; a low bench may share it.
        let groundMax = Math.max(terrainHeightAt(state, a), terrainHeightAt(state, b)), supported = true;
        for (let z = minZ - .12; z <= maxZ + .12; z += .12) for (let x = minX - .12; x <= maxX + .12; x += .12) {
            if (!onLand(state, { x: Math.round(x), z: Math.round(z) })) supported = false;
            groundMax = Math.max(groundMax, terrainHeightAt(state, { x, z }));
        }
        if (!supported || [...state.plots, ...state.landmarks].some(owner => owner.cell && owner.id !== left.id && owner.id !== right.id
            && owner.kind !== 'bench' && owner.cell.x >= minX - .35 && owner.cell.x <= maxX + .35
            && owner.cell.z >= minZ - .35 && owner.cell.z <= maxZ + .35)) continue;
        used.add(left.id); used.add(right.id);
        result.push({ ownerIds: [left.id, right.id], minX, maxX, minZ, maxZ, groundMax, target });
    }
    return result;
}
