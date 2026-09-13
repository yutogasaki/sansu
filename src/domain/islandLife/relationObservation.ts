import { activityRelation } from './discovery';
import { isFacility } from './footprint';
import { beginBenchTrip, beginFacilityTrip, reservedActivityCells, reservesItem } from './facilityTrips';
import { LIFE_STEP_MS, type LifeState, type ResidentId } from './model';
import { pathToActivity } from './space';

/** Explain an explicitly requested transport that cannot start, without
 * rewriting a saved observation or evicting its destination's current user. */
export function relationTargetBusy(state: LifeState, itemId?: string, residentId?: ResidentId, targetId?: string) {
    if (!itemId || !residentId || !targetId) return false;
    const rule = activityRelation(state, '', itemId, targetId);
    if (rule?.ruleId !== 'R5' && rule?.ruleId !== 'R6') return false;
    const trip = state.residents.find(r => r.id === residentId)?.facilityTrip;
    if (trip?.phase === 'carry' && rule.participantIds.includes(trip.facilityId) && rule.participantIds.includes(trip.targetId)) return false;
    return state.residents.some(r => r.id !== residentId && reservesItem(r, targetId));
}

/** Explicit, free current-world comparison. Only the named resident already
 * using this subject (or genuinely idle) can participate. No actor substitution,
 * invalid-pair fallback to another target, or mid-walk teleport is permitted. */
export function applyRelationObservation(state: LifeState, itemId: string, residentId: ResidentId, targetId?: string) {
    if (!state.relationSelectionVersion) throw new Error('島を よみなおしてから ためしてね。');
    const item = state.items.find(i => i.id === itemId && i.cell && (i.kind === 'bench' || i.kind === 'picnic-table' || isFacility(i.kind)));
    const resident = state.residents.find(r => r.id === residentId);
    if (!item || !resident || targetId && !state.items.some(i => i.id === targetId && i.cell && i.id !== itemId)) throw new Error('その ものは いま ここに ないよ。');
    const previous = resident.visit;
    const belongs = previous && (previous.itemId === itemId || previous.observationSubjectId === itemId
        || resident.facilityTrip && [resident.facilityTrip.facilityId, resident.facilityTrip.targetId].includes(itemId));
    if (previous && !belongs || !previous && residentId === 'pokomoko' && state.target) throw new Error('いまは、ほかのことを しているよ。');
    if (previous && state.now < previous.start + (previous.path.length - 1) * LIFE_STEP_MS + 900) throw new Error('いまは みちを とおっているよ。');
    const requested = activityRelation(state, '', itemId, targetId);
    const trip = resident.facilityTrip;
    if (trip?.phase === 'carry' && previous?.itemId === trip.targetId && requested
        && (requested.ruleId === 'R5' || requested.ruleId === 'R6')
        && requested.participantIds.includes(trip.facilityId) && requested.participantIds.includes(trip.targetId)) {
        // The exact requested transport has already happened. Keep its real
        // origin/path and pose rather than making the resident fetch it twice.
        const end = state.now + 30000;
        resident.visit = { ...previous, end, observationTest: true, observationSubjectId: itemId,
            relationSelectionVersion: 1, relationTargetId: targetId };
        resident.facilityTrip = { ...trip, end }; resident.discovery = undefined;
        return;
    }
    if ((item.kind === 'bench' || isFacility(item.kind)) && state.residents.some(r => r.id !== residentId && reservesItem(r, itemId))) throw new Error('いまは、ほかのことを しているよ。');
    const actor = structuredClone(resident);
    actor.cell = previous ? { ...previous.path[previous.path.length - 1] } : { ...resident.cell };
    actor.visit = undefined; actor.facilityTrip = undefined; actor.playTour = undefined; actor.discovery = undefined;
    const trial = { ...state, residents: state.residents.map(r => r.id === residentId ? actor : r) };
    const path = pathToActivity(trial, actor.cell, item, reservedActivityCells(trial, residentId));
    if (!path) throw new Error('いまは、ほかのことを しているよ。');
    actor.visit = { itemId, path, from: { ...actor.cell }, start: state.now,
        end: state.now + (path.length - 1) * LIFE_STEP_MS + 30000,
        observationTest: true, observationSubjectId: itemId, relationSelectionVersion: 1,
        ...(targetId ? { relationTargetId: targetId } : {}) };
    const rule = activityRelation(trial, '', itemId, targetId);
    if (rule?.ruleId === 'R5' && item.kind === 'bench') beginBenchTrip(trial, actor, item, targetId);
    else if (rule?.ruleId === 'R5' || rule?.ruleId === 'R6') beginFacilityTrip(trial, actor, item, targetId);
    // Gaze/ordinary comparisons keep the actual existing seat and arrival clock.
    if (!actor.facilityTrip && previous?.itemId === itemId) {
        actor.visit = { ...actor.visit, path: structuredClone(previous.path), from: { ...previous.from }, start: previous.start };
    }
    Object.assign(resident, actor);
}
