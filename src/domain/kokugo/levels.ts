import { itemsForUnit } from './catalog';
import { confirmed, progressId } from './evaluation';
import type { KokugoProgress } from './types';

/** The scored starter units gathered into the shared Lv1–20 (kokugo-levels.md). Free activities are not here. */
export const KOKUGO_LEVEL_UNITS: readonly (readonly string[])[] = [
    ['K01', 'V01'], ['K02'], ['K03', 'V02'], ['S01', 'E01'], ['K04', 'K05'], ['K06', 'H01'], ['S02', 'E02'], ['R01', 'R03'], ['H02', 'V03'], ['S03', 'S04'],
    ['S05', 'R02', 'E03'], ['H03', 'V04'], ['V05', 'R04'], ['S06', 'R05', 'E04'], ['H04', 'V06'], ['S07', 'R06'], ['R07', 'S08'], ['H05', 'V07'], ['R08', 'R09'], ['R10', 'R11'],
];

/**
 * A unit counts as confirmed only when every target/form/mode its scored items ask for has met
 * the existing confirmation (three independent first answers, two context families, required
 * conditions). One form never stands in for the others.
 */
export function unitConfirmed(unitId: string, progress: readonly KokugoProgress[]) {
    const required = new Set(itemsForUnit(unitId).map(progressId));
    if (!required.size) return false;
    const mine = new Map(progress.filter(p => p.unitId === unitId).map(p => [p.id, p]));
    return [...required].every(id => { const p = mine.get(id); return Boolean(p && confirmed(p)); });
}

/** The highest Lv whose units, and every Lv below it, are all confirmed. Read-only. */
export function confirmedKokugoLevel(progress: readonly KokugoProgress[]) {
    let level = 0;
    for (const units of KOKUGO_LEVEL_UNITS) {
        if (!units.every(unit => unitConfirmed(unit, progress))) break;
        level++;
    }
    return level;
}
