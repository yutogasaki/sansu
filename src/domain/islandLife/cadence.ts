import { isFacility } from './footprint';
import { isRoamVisit, LIFE_RULES, type ItemKind, type LifeResident, type LifeState } from './model';
import { routeDuration } from './walkingSpace';

export const CADENCE_REST_MS = 1800;
export function cadenceStay(resident: LifeResident, kind?: ItemKind) {
    return resident.facilityTrip || kind && isFacility(kind) ? 24_000
        : resident.id === 'rabbit' ? 12_000 : resident.id === 'otter' ? 16_000 : 20_000;
}
export function usesCadence(state: LifeState, resident: LifeResident) {
    return Boolean(state.cadenceVersion && !resident.playTour && !resident.visit?.observationTest
        && !(resident.id === 'pokomoko' && state.target));
}
/** Preserve the current route, including a two-leg delivery. Only the quiet
 * stay is shortened, so a version change never teleports or abandons a prop. */
export function shortenCadenceVisit(state: LifeState, resident: LifeResident) {
    const visit = resident.visit;
    if (!visit || !usesCadence(state, resident)) return;
    const kind = state.items.find(i => i.id === visit.itemId)?.kind;
    if (kind === 'flower-arch' || isRoamVisit(visit) && visit.itemId.startsWith('roam:clear-placement:')) return;
    resident.cadence ??= { round: 0, useMs: {} };
    const arrival = visit.start + routeDuration(visit.path);
    if (isRoamVisit(visit)) {
        visit.end = Math.max(state.now, arrival) + CADENCE_REST_MS;
        return;
    }
    visit.cadence = true;
    if (resident.facilityTrip?.phase === 'collect') {
        resident.facilityTrip.end = visit.end + routeDuration(resident.facilityTrip.path) + cadenceStay(resident, kind);
    } else visit.end = Math.max(state.now, arrival) + cadenceStay(resident, kind);
}
export function enableCadence(state: LifeState) {
    state.cadenceVersion = 1;
    for (const resident of state.residents) {
        const visit = resident.visit;
        if (visit && usesCadence(state, resident) && !isRoamVisit(visit)) {
            const kind = state.items.find(i => i.id === (resident.facilityTrip?.targetId ?? visit.itemId))?.kind;
            if (kind && kind !== 'flower-arch') {
                // Preserve the unfinished old reward window once at the cutover.
                resident.cadence = { round: 0, useMs: { [kind]: Math.min(LIFE_RULES.activityMs - 1, Math.max(0,
                    state.now - (resident.facilityTrip ? resident.facilityTrip.end - LIFE_RULES.activityMs : visit.start))) } };
            }
        }
        shortenCadenceVisit(state, resident);
    }
}
/** Count only time actually at a paid-use destination. Return whole windows
 * to the existing finite-light writer; walking and free observation earn none. */
export function accrueCadenceUse(state: LifeState, resident: LifeResident, from: number, to: number) {
    const visit = resident.visit;
    if (!visit?.cadence || visit.observationTest || resident.facilityTrip?.phase === 'collect') return;
    const kind = state.items.find(i => i.id === visit.itemId)?.kind;
    if (!kind || kind === 'flower-arch') return;
    const elapsed = Math.max(0, Math.min(to, visit.end) - Math.max(from, visit.start + routeDuration(visit.path)));
    const cadence = resident.cadence ??= { round: 0, useMs: {} };
    const total = (cadence.useMs[kind] ?? 0) + elapsed;
    cadence.useMs[kind] = total % LIFE_RULES.activityMs;
    return { kind, count: Math.floor(total / LIFE_RULES.activityMs) };
}
