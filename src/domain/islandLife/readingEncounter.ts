import { LIFE_STEP_MS, type LifeState } from './model';
import { sameCell } from './space';

/** Only the real otter's naturally assigned library-to-bench visit qualifies.
 * Merely placing the pair, requesting a test visit, or choosing another actor does not. */
export function readingOtter(state: LifeState) {
    if (!state.readingEncounterVersion || !state.facilityTripVersion) return undefined;
    const resident = state.residents.find(r => r.id === 'otter'), visit = resident?.visit, trip = resident?.facilityTrip;
    if (!resident || !visit || visit.observationTest || !trip || trip.kind !== 'library' || trip.phase !== 'carry'
        || visit.itemId !== trip.targetId || state.now < visit.start + (visit.path.length - 1) * LIFE_STEP_MS + 900 || state.now >= visit.end
        || JSON.stringify(visit.path) !== JSON.stringify(trip.path)) return undefined;
    const library = state.items.find(i => i.id === trip.facilityId && i.kind === 'library' && i.cell);
    const bench = state.items.find(i => i.id === trip.targetId && i.kind === 'bench' && i.cell);
    if (!library?.cell || !bench?.cell || !sameCell(visit.from, { x: library.cell.x, z: library.cell.z + 2 })) return undefined;
    return { resident, visit, trip, library, bench };
}
