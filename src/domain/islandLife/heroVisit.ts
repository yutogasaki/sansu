import { shortenCadenceVisit } from './cadence';
import { isRoamVisit, LIFE_RULES, type LifeResident, type LifeState } from './model';

export const HERO_WAIT_MS = 30_000;
export function isHeroTargetVisit(state: LifeState, resident: LifeResident) {
    return resident.id === 'pokomoko' && Boolean(state.target && resident.visit && !resident.visit.observationTest
        && (resident.visit.itemId === state.target || resident.facilityTrip?.facilityId === state.target
            || resident.facilityTrip?.targetId === state.target));
}
export function heroWaitDeadline(state: LifeState) {
    return state.heroVisitVersion && state.target && !isHeroTargetVisit(state, state.residents[0])
        ? state.heroWaitUntil : undefined;
}
export function expireHeroWait(state: LifeState) {
    const deadline = heroWaitDeadline(state);
    if (deadline !== undefined && deadline <= state.now) {
        state.target = undefined; state.heroWaitUntil = undefined;
    }
}
/** The old call remains real until this boundary. Preserve the route, prop and
 * unawarded old use time; only the future stay changes. Other residents stay put. */
export function enableHeroVisits(state: LifeState) {
    state.heroVisitVersion = 1;
    if (!state.target) return;
    state.heroWaitUntil = state.now + HERO_WAIT_MS;
    const hero = state.residents[0], visit = hero.visit;
    if (!visit || !isHeroTargetVisit(state, hero)) return;
    if (!visit.cadence && !isRoamVisit(visit)) {
        const kind = state.items.find(i => i.id === (hero.facilityTrip?.targetId ?? visit.itemId))?.kind;
        if (kind && kind !== 'flower-arch') {
            const elapsed = Math.max(0, state.now - (hero.facilityTrip ? hero.facilityTrip.end - LIFE_RULES.activityMs : visit.start));
            hero.cadence ??= { round: 0, useMs: {} };
            hero.cadence.useMs[kind] = (hero.cadence.useMs[kind] ?? 0) + Math.min(LIFE_RULES.activityMs - 1, elapsed);
        }
    }
    // Already-short calls must not restart their stay on a migration/reload.
    if (!visit.cadence) shortenCadenceVisit(state, hero);
}
