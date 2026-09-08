import type { IslandStageItem, IslandStageState } from './types';
import type { SharedActivityPlan } from './sharedActivities';
import { getIslandExpansionLevel } from '../../../domain/island/expansion';

export type LivingNature = 'butterfly' | 'boat';
export interface LivingVisit { item: IslandStageItem; discoveryId: string; nature?: LivingNature; shared?: boolean }

const level = (item: IslandStageItem) => Math.max(0, Math.min(3, item.growthLevel ?? 0));

/** This lists opportunities, never observations. Only the rendered activity is
 * allowed to call the persistent discovery callback. Appearance is not ability. */
export function livingVisitsForItem(item: IslandStageItem): LivingVisit[] {
    if (!item.position || !item.habitatId || level(item) < 1) return [];
    const choices: Omit<LivingVisit, 'item'>[] = [];
    if (item.habitatId === 'garden') {
        if (item.kind === 'flower') {
            choices.push({ discoveryId: 'flower-scent' });
            if (level(item) >= 2) choices.push({ discoveryId: 'butterfly-visit', nature: 'butterfly' });
        }
        if (['flower', 'bench'].includes(item.kind) && level(item) >= 3) choices.push({ discoveryId: 'flower-sharing', shared: true });
    }
    if (item.habitatId === 'waterside' && ['fountain', 'swing'].includes(item.kind)) {
        choices.push({ discoveryId: 'water-gazing' });
        if (level(item) >= 2) choices.push({ discoveryId: 'water-sharing', shared: true });
        if (item.kind === 'fountain' && level(item) >= 3) choices.push({ discoveryId: 'leaf-boat', nature: 'boat' });
    }
    if (item.habitatId === 'grove') {
        if (item.kind === 'mushroom') choices.push({ discoveryId: 'shade-rest' });
        if (['mushroom', 'lantern'].includes(item.kind) && level(item) >= 2) choices.push({ discoveryId: 'lantern-sharing', shared: true });
    }
    if (item.habitatId === 'village' && item.kind === 'lantern') {
        choices.push({ discoveryId: 'home-visit' });
        if (level(item) >= 2) choices.push({ discoveryId: 'lantern-sharing', shared: true });
        if (level(item) >= 3) choices.push({ discoveryId: 'terrace-time' });
    }
    return choices.map(choice => ({ item, ...choice }));
}

export function canRunLivingActivities(state: IslandStageState | undefined, visible = true) {
    return Boolean(state?.growth && !state.learning && !state.preview && !state.readOnly && visible);
}

export function livingVisitHasSetting(state: IslandStageState, visit: LivingVisit) {
    const position = visit.item.position;
    if (!position) return false;
    if (visit.discoveryId === 'water-gazing' && visit.item.kind === 'swing') return state.items.some(item => {
        if (item.kind !== 'fountain' || !item.position) return false;
        const dx = item.position.x - position.x, dz = item.position.z - position.z, distance = Math.hypot(dx, dz);
        return distance <= 2.9 && (Math.sin(visit.item.rotation) * dx + Math.cos(visit.item.rotation) * dz) / Math.max(.01, distance) >= .5;
    });
    if (visit.discoveryId === 'shade-rest') return [{ x: 1.6, z: -1.6 }, ...(getIslandExpansionLevel(state) >= 2 ? [{ x: -6.7, z: -1.2 }] : [])]
        .some(tree => Math.hypot(position.x - tree.x, position.z - tree.z) <= 2.8);
    return true;
}

export function livingCandidates(state: IslandStageState, turn: number): LivingVisit[] {
    const district = state.districtFocus ?? 'all';
    const items = state.items.filter(item => item.position && (district === 'all'
        || district === 'home' && item.position.x > -4.8 && item.position.x < 4.6
        || district === 'east' && (item.position.x >= 4.6 || item.habitatId === 'waterside') || district === 'west' && item.position.x <= -4.8));
    const candidates = items.flatMap(livingVisitsForItem).filter(visit => livingVisitHasSetting(state, visit));
    if (!candidates.length) return [];
    const shift = ((turn % candidates.length) + candidates.length) % candidates.length;
    return [...candidates.slice(shift), ...candidates.slice(0, shift)];
}

export function sharedLivingDiscovery(plan: SharedActivityPlan) {
    const id = plan.kind === 'flower' ? 'flower-sharing' : plan.kind === 'bubble' ? 'water-sharing' : 'lantern-sharing';
    return [plan.source, plan.seat].flatMap(livingVisitsForItem).find(visit => visit.discoveryId === id);
}

/** Legacy callers retain their existing free-play combinations. Growth scenes
 * earn the new relationship at the same stage as its visual development. */
export function canStartGrownSharing(state: IslandStageState, plan: SharedActivityPlan) {
    return !state.growth || Boolean(sharedLivingDiscovery(plan));
}
