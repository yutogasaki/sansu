import { LIFE_STEP_MS, type LifeState } from './model';
import { pathToActivity } from './space';

/** An optional current-world test uses an existing sitter or a genuinely idle
 * resident. It never cancels another activity or changes the hero destination. */
export function observationVisit(state: LifeState, itemId: string) {
    const item = state.items.find(item => item.id === itemId && (item.kind === 'bench' || item.kind === 'picnic-table') && item.cell);
    if (!item) return { kind: 'unavailable' as const };
    const using = state.residents.find(resident => resident.visit?.itemId === itemId && state.now < resident.visit.end);
    if (using) return { kind: 'existing' as const, residentId: using.id };
    const reserved = state.residents.flatMap(resident => resident.visit ? [resident.visit.path[resident.visit.path.length - 1]] : []);
    const free = state.residents.filter(resident => !resident.visit && !(resident.id === 'pokomoko' && state.target))
        .flatMap(resident => {
            const path = pathToActivity(state, resident.cell, item, reserved);
            return path ? [{ residentId: resident.id, path }] : [];
        }).sort((a, b) => a.path.length - b.path.length || a.residentId.localeCompare(b.residentId));
    if (!free.length) return { kind: 'busy' as const };
    return { kind: 'ready' as const, ...free[0], duration: (free[0].path.length - 1) * LIFE_STEP_MS + 6000 };
}
