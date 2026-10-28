import { HOME_CELL, approachCells, key, passageNeighbors, walkableCells, walkingPointBlocked } from '../../../src/domain/growingIsland/space';
import { editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import type { GrowingState, Cell } from '../../../src/domain/growingIsland/types';
import type { IslandWorld } from '../../../src/domain/growingIsland/worldDefinition';

export function trialGardens(state: GrowingState, world: IslandWorld) {
    const open = walkableCells(state, world), gardens: { owner: string; target: Cell; route: Cell[] }[] = [];
    if (!open.has(key(HOME_CELL))) return gardens;
    for (const bench of state.landmarks.filter(item => item.kind === 'bench' && item.cell)) {
        const target = bench.cell!;
        const approaches = new Set(approachCells(target, world).filter(cell => open.has(key(cell))
            && key(cell) !== key(target) && editableTerrainSegmentSupported(world, cell, target)).map(key));
        const queue: Cell[] = [HOME_CELL], previous = new Map<string, Cell | undefined>([[key(HOME_CELL), undefined]]);
        let end: Cell | undefined;
        for (let i = 0; i < queue.length && !end; i++) {
            if (approaches.has(key(queue[i]))) { end = queue[i]; break; }
            for (const next of passageNeighbors(queue[i], world)) if (open.has(key(next)) && !previous.has(key(next))) {
                previous.set(key(next), queue[i]); queue.push(next);
            }
        }
        if (!end) continue;
        const route: Cell[] = [];
        while (end) { route.unshift(end); end = previous.get(key(end)); }
        // A local courtyard, not an island-wide painted road to every seat.
        const length = route.reduce((sum, point, i) => sum + (i ? Math.hypot(point.x - route[i - 1].x, point.z - route[i - 1].z) : 0), 0);
        if (length <= 4.5) gardens.push({ owner: bench.id, target, route });
    }
    return gardens;
}

export function gardenWeight(cell: Cell, gardens: ReturnType<typeof trialGardens>, state: GrowingState, world: IslandWorld) {
    if (!world.floorAt(cell) || walkingPointBlocked(state, cell)) return 0;
    let weight = 0;
    for (const garden of gardens) for (let i = 0; i < garden.route.length; i++) {
        const a = garden.route[i], b = garden.route[i + 1] ?? a;
        const dx = b.x - a.x, dz = b.z - a.z, length2 = dx * dx + dz * dz;
        const t = length2 ? Math.max(0, Math.min(1, ((cell.x - a.x) * dx + (cell.z - a.z) * dz) / length2)) : 0;
        const nearest = { x: a.x + dx * t, z: a.z + dz * t }, distance = Math.hypot(cell.x - nearest.x, cell.z - nearest.z);
        if (distance > .73 || !editableTerrainSegmentSupported(world, nearest, cell, .08)) continue;
        // The broad floor around the real approach is what is under test. No
        // raised rim, invented owner, bridge or extra walk permission is added.
        weight = Math.max(weight, 1 - Math.max(0, Math.min(1, (distance - .36) / .37)));
    }
    return weight;
}
