import { routeDuration } from '../../../domain/islandLife/walkingSpace';
import { isRoamVisit, ROAM_VISIT_PREFIX, type LifeState } from '../../../domain/islandLife/model';
import { planLifeResidentRoam } from '../../../domain/islandLife/simulation';

export const ROAM_REST_MS = 1800;
type Schedule = { frames: LifeState[]; next: number; turn: number; resident: number; end: number };
const schedules = new WeakMap<LifeState, Schedule>();

/** Display-only walks. The reward replay and saved records never receive these
 * visits. Only the current activity window is reconstructed after a refresh. */
export function sampleLifeRoaming(source: LifeState, now: number): LifeState {
    // Placement checks the saved world's walkers. Never replace their visible
    // paths with unrelated presentation-only strolls under the new contract.
    if (source.placementVersion === 1) return source;
    const anchor = source.residents.find(r => isRoamVisit(r.visit))?.visit;
    if (source.activityVersion !== 2 || !anchor || !Number.isFinite(now) || now < anchor.start || now >= anchor.end) return source;
    let schedule = schedules.get(source);
    if (!schedule) {
        const initial = { ...source, now: anchor.start, residents: source.residents.map(r =>
            isRoamVisit(r.visit) ? { ...r, visit: undefined } : r) };
        schedule = { frames: [initial], next: anchor.start, turn: 0,
            resident: source.residents.findIndex(r => r.visit === anchor), end: anchor.end };
        schedules.set(source, schedule);
    }
    while (schedule.next <= now && schedule.next < schedule.end) {
        const previous = schedule.frames[schedule.frames.length - 1];
        const state = { ...previous, now: schedule.next, residents: previous.residents.map(r =>
            isRoamVisit(r.visit) ? { ...r, cell: r.visit!.path[r.visit!.path.length - 1], visit: undefined } : r) };
        let planned = false;
        for (let offset = 0; offset < state.residents.length; offset++) {
            const index = (schedule.resident + offset) % state.residents.length;
            const resident = state.residents[index];
            if (resident.visit || resident.id === 'pokomoko' && state.target) continue;
            const plan = planLifeResidentRoam(state, resident, schedule.turn);
            if (!plan) continue;
            const end = state.now + routeDuration(plan.path) + ROAM_REST_MS;
            state.residents[index] = { ...resident, visit: {
                itemId: `${ROAM_VISIT_PREFIX}display:${resident.id}:${schedule.turn}`, from: resident.cell,
                path: plan.path, start: state.now, end,
            } };
            schedule.resident = (index + 1) % state.residents.length;
            schedule.next = end;
            planned = true;
            break;
        }
        schedule.turn++;
        schedule.frames.push(state);
        if (!planned) { schedule.next = schedule.end; break; }
    }
    // A screenshot or reduced-motion render may request an earlier timestamp.
    for (let i = schedule.frames.length - 1; i >= 0; i--) {
        if (schedule.frames[i].now <= now) return schedule.frames[i];
    }
    return source;
}
