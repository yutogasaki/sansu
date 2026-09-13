import { routeDuration, routeLength } from './walkingSpace';
import { isFacility } from './footprint';
import { activityRelation, discoveryAccessPoints } from './discovery';
import { type Cell, type LifeItem, type LifeResident, type LifeState } from './model';
import { pathToActivity, route, sameCell } from './space';

export interface FacilityTrip {
    facilityId: string; targetId: string; kind: 'library' | 'garden-hut';
    phase: 'collect' | 'carry'; path: Cell[]; end: number;
}
export function reservesItem(resident: LifeResident, itemId: string) {
    return resident.visit?.itemId === itemId || resident.facilityTrip?.targetId === itemId;
}
export function reservedActivityCells(state: LifeState, exceptId?: string): Cell[] {
    return state.residents.filter(r => r.id !== exceptId).flatMap(r => [
        ...(r.visit ? [r.visit.path[r.visit.path.length - 1]] : []),
        ...(r.facilityTrip ? [r.facilityTrip.path[r.facilityTrip.path.length - 1]] : []),
    ]);
}
/** Reserve the destination role before collecting. A busy destination is never
 * evicted; without a free reachable partner, the ordinary entrance use remains. */
export function beginFacilityTrip(state: LifeState, resident: LifeResident, facility: LifeItem, targetId?: string) {
    if (!state.facilityTripVersion || !isFacility(facility.kind) || !resident.visit) return;
    const from = resident.visit.path[resident.visit.path.length - 1];
    const reserved = reservedActivityCells(state, resident.id);
    const selectedId = targetId ?? (state.relationSelectionVersion ? activityRelation(state, '', facility.id)?.participantIds.find(id => id !== facility.id) : undefined);
    if (state.relationSelectionVersion && !selectedId) return;
    const choices = state.items.filter(i => i.cell && (facility.kind === 'library' ? i.kind === 'bench' : i.kind === 'flower' || i.kind === 'sapling'))
        .filter(i => (!selectedId || i.id === selectedId) && !state.residents.some(r => r !== resident && reservesItem(r, i.id)))
        .flatMap(item => discoveryAccessPoints(state, item).filter(to => !reserved.some(p => sameCell(p, to))).flatMap(to => {
            const path = route(state, from, to);
            return path && routeLength(path) <= 4 ? [{ item, path }] : [];
        })).sort((a, b) => routeLength(a.path) - routeLength(b.path) || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0));
    const selected = choices[0]; if (!selected) return;
    resident.facilityTrip = { facilityId: facility.id, targetId: selected.item.id, kind: facility.kind,
        phase: 'collect', path: selected.path, end: resident.visit.end };
    resident.visit.end = resident.visit.start + routeDuration(resident.visit.path) + 2000;
}
/** One resident retains the prop and reservation across the two visit legs.
 * Collection and transport never award separate use credit or plant growth. */
export function departFacilityTrip(state: LifeState, resident: LifeResident) {
    const trip = resident.facilityTrip, visit = resident.visit;
    if (!trip || !visit || trip.phase !== 'collect') return false;
    resident.cell = visit.path[visit.path.length - 1];
    trip.phase = 'carry';
    resident.visit = { ...(visit.observationSubjectId ? { observationSubjectId: visit.observationSubjectId } : {}), ...(visit.relationTargetId ? { relationTargetId: visit.relationTargetId } : {}), ...(visit.relationSelectionVersion ? { relationSelectionVersion: visit.relationSelectionVersion } : {}), itemId: trip.targetId, from: { ...resident.cell }, path: trip.path,
        start: state.now, end: trip.end, ...(visit.observationTest ? { observationTest: true } : {}) };
    return true;
}

/** A bench relation starts at the real library entrance, carrying back to this
 * same reserved bench. No book appears merely because a library is nearby. */
export function beginBenchTrip(state: LifeState, resident: LifeResident, bench: LifeItem, targetId?: string) {
    if (!state.relationSelectionVersion || bench.kind !== 'bench' || !resident.visit) return;
    const rule = activityRelation(state, '', bench.id, targetId);
    if (rule?.ruleId !== 'R5') return;
    const facility = state.items.find(i => i.id !== bench.id && rule.participantIds.includes(i.id));
    if (!facility || state.residents.some(r => r !== resident && reservesItem(r, facility.id))) return;
    const path = pathToActivity(state, resident.cell, facility, reservedActivityCells(state, resident.id));
    if (!path) return;
    const original = resident.visit;
    resident.visit = { ...original, itemId: facility.id, path };
    beginFacilityTrip(state, resident, facility, bench.id);
    if (!resident.facilityTrip) resident.visit = original;
}
