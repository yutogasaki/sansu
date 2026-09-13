import { routeDuration } from './walkingSpace';
import { type LifeState, type ResidentId } from './model';
/** A named, actually settled bench user. No free actor is borrowed for a shadow. */
export function shadowResident(state: LifeState, itemId: string, residentId?: ResidentId) {
    if (!state.shadowMagicVersion || !state.items.some(i => i.id === itemId && i.kind === 'bench' && i.cell)) return undefined;
    return state.residents.find(r => (!residentId || r.id === residentId) && r.visit?.itemId === itemId
        && state.now >= r.visit.start + routeDuration(r.visit.path) + 900 && state.now < r.visit.end);
}
