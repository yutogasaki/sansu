import * as THREE from 'three';
import { getIslandLandAccess, islandPlacementCandidates, isValidIslandPlacement, ISLAND_ITEMS } from '../../../domain/island/catalog';
import { sharedDisplayObstacles } from '../../../domain/island/sharedDisplayGeometry';
import type { IslandRecord } from '../../../domain/island/types';
import type { IslandResident } from './animals';
import type { OptionalFurnitureController } from './optionalFurnitureController';
import { optionalFootprintClearsCircle, optionalResidentFootprint } from './optionalFurnitureNavigation';
import type { IslandStageItem } from './types';

export interface OptionalFurnitureTrialResolution {
    item: IslandStageItem;
    ready: boolean;
    checked: number;
    participants: string[];
    blockedBy?: Record<string, number>;
}

/** A borrowed prop needs more than an empty saved footprint: the selected
 * resident and tea partner must be able to approach it with their actual rigs.
 * Omitting a choice retains the all-participant geometry audit.
 * The retained actual Group is positioned before its first visible frame. */
export function* optionalFurnitureTrialSteps(seed: IslandStageItem, group: THREE.Group, residents: readonly IslandResident[],
    controller: OptionalFurnitureController, island: Pick<IslandRecord, 'items' | 'completedSets' | 'growth' | 'sharedMemories'>,
    now: number, reduced: boolean, choice?: { residentId: IslandResident['species']; partnerId?: IslandResident['species'] }): Generator<{ checked: number }, OptionalFurnitureTrialResolution> {
    const visible = residents.filter(resident => resident.group.visible), participants = visible.map(resident => resident.species);
    const fallback = { item: seed, ready: false, checked: 0, participants };
    if (!seed.position || !visible.length || controller.active || seed.kind === 'tea-table' && visible.length < 2) return fallback;
    if (choice && (!visible.some(resident => resident.species === choice.residentId)
        || seed.kind === 'tea-table' && (!choice.partnerId || choice.partnerId === choice.residentId || !visible.some(resident => resident.species === choice.partnerId)))) return fallback;
    const land = getIslandLandAccess(island), preferred = seed.position;
    const candidates = islandPlacementCandidates(land);
    candidates.sort((a, b) => Math.hypot(a.x - preferred.x, a.z - preferred.z) - Math.hypot(b.x - preferred.x, b.z - preferred.z));
    candidates.unshift({ ...preferred });
    const bodies = visible.map(resident => optionalResidentFootprint(resident.group));
    const obstacles = sharedDisplayObstacles(island);
    const tests = choice ? [choice] : visible.flatMap(resident => seed.kind === 'tea-table'
        ? visible.filter(partner => partner !== resident).map(partner => ({ residentId: resident.species, partnerId: partner.species }))
        : [{ residentId: resident.species }]);
    const layout: IslandRecord = { profileId: '', schemaVersion: 1, revision: 0, updatedAt: 0, pendingRewards: [],
        completedSets: island.completedSets, growth: island.growth, sharedMemories: island.sharedMemories,
        items: [...island.items.filter(item => item.id !== seed.id), seed] };
    let checked = 0; const blockedBy: Record<string, number> = {};
    for (const position of candidates) {
        if (!isValidIslandPlacement(layout, seed.id, position, seed.rotation)
            || bodies.some(body => !optionalFootprintClearsCircle(body, { ...position, radius: ISLAND_ITEMS[seed.kind].radius }))) continue;
        for (const rotation of [seed.rotation, seed.rotation + Math.PI / 2, seed.rotation + Math.PI, seed.rotation - Math.PI / 2]) {
            const item = { ...seed, position: { ...position }, rotation };
            group.position.set(position.x, 0, position.z); group.rotation.y = rotation; group.updateWorldMatrix(true, true);
            checked++;
            let ready = true;
            for (const choice of tests) {
                const result = controller.canStart({ item, group, ...choice, requestId: 'trial-preflight', borrowed: true,
                    items: island.items, land, obstacles, now, reduced });
                if (result.status !== 'playing') { const key = `${choice.residentId}/${'partnerId' in choice ? choice.partnerId : ''}`; blockedBy[key] = (blockedBy[key] ?? 0) + 1; }
                yield { checked };
                if (result.status !== 'playing') { ready = false; break; }
            }
            if (ready) return { item, ready: true, checked, participants };
        }
    }
    group.position.set(preferred.x, 0, preferred.z); group.rotation.y = seed.rotation; group.updateWorldMatrix(true, true);
    return { ...fallback, checked, blockedBy };
}

/** Synchronous drain for geometry tests; the runtime advances the same iterator
 * one preflight at a time so input/learning can cancel between candidates. */
export function resolveOptionalFurnitureTrial(...args: Parameters<typeof optionalFurnitureTrialSteps>) {
    const iterator = optionalFurnitureTrialSteps(...args); let next = iterator.next();
    while (!next.done) next = iterator.next();
    return next.value;
}
