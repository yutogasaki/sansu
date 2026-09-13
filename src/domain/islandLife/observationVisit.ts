import { activityRelation } from './discovery';
import { isFacility } from './footprint';
import { reservedActivityCells, reservesItem } from './facilityTrips';
import { LIFE_STEP_MS, type LifeState } from './model';
import { pathToActivity } from './space';

/** An optional current-world test uses an existing sitter or a genuinely idle
 * resident. It never cancels another activity or changes the hero destination. */
export function observationVisit(state: LifeState, itemId: string) {
    const item = state.items.find(item => item.id === itemId && (item.kind === 'bench' || item.kind === 'picnic-table' || state.facilityTripVersion && isFacility(item.kind)) && item.cell);
    if (!item) return { kind: 'unavailable' as const };
    const using = state.residents.find(resident => resident.visit && (resident.visit.itemId === itemId || resident.facilityTrip?.facilityId === itemId || state.relationSelectionVersion && resident.facilityTrip?.targetId === itemId) && state.now < resident.visit.end);
    if (using) return { kind: 'existing' as const, residentId: using.id };
    if (state.residents.some(resident => reservesItem(resident, itemId))) return { kind: 'busy' as const };
    const reserved = reservedActivityCells(state);
    const free = state.residents.filter(resident => !resident.visit && !(resident.id === 'pokomoko' && state.target))
        .flatMap(resident => {
            const path = pathToActivity(state, resident.cell, item, reserved);
            return path ? [{ residentId: resident.id, path }] : [];
        }).sort((a, b) => a.path.length - b.path.length || a.residentId.localeCompare(b.residentId));
    if (!free.length) return { kind: 'busy' as const };
    return { kind: 'ready' as const, ...free[0], duration: (free[0].path.length - 1) * LIFE_STEP_MS + (isFacility(item.kind) || state.relationSelectionVersion && item.kind === 'bench' && activityRelation(state, '', itemId)?.ruleId === 'R5' ? 15000 : 6000) };
}
