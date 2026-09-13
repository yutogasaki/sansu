import type { LifeAction, LifeRecord } from './model';
import { replayLife } from './simulation';
export interface TourCutover {
    rules: 'gp3-tours-v1'; profileId: string; at: number; actionCount: number;
    priorActions: LifeAction[]; validationHash: string;
}
function payload(cutover: TourCutover) {
    const { validationHash: ignored, ...rest } = cutover; void ignored; return rest;
}
async function digest(cutover: TourCutover) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload(cutover))));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function assertTourCutover(record: LifeRecord) {
    const cutover = record.tourCutover;
    if (!cutover) { if ((record.version === 4 || record.version === 5 || record.version === 6 || record.version === 7)) throw new Error('巡回の切替記録が見つかりません。'); return; }
    if (![4, 5, 6, 7].includes(record.version) || cutover.rules !== 'gp3-tours-v1' || cutover.profileId !== record.profileId
        || !Number.isFinite(cutover.at) || !record.economyCheckpoint || cutover.at < record.economyCheckpoint.cutoverAt || cutover.at > record.now
        || !Number.isInteger(cutover.actionCount) || cutover.actionCount < record.economyCheckpoint.actionCount || cutover.actionCount > record.actions.length
        || cutover.priorActions.length !== cutover.actionCount
        || JSON.stringify(cutover.priorActions) !== JSON.stringify(record.actions.slice(0, cutover.actionCount))
        || cutover.priorActions.some(action => !Number.isFinite(action.at) || action.at > cutover.at)
        || record.actions.slice(cutover.actionCount).some(action => !Number.isFinite(action.at) || action.at < cutover.at)) throw new Error('巡回の切替前の履歴が変わっています。');
}
export async function verifyTourCutover(record: LifeRecord) {
    assertTourCutover(record);
    if (record.tourCutover && record.tourCutover.validationHash !== await digest(record.tourCutover)) throw new Error('巡回の切替記録を確認できません。');
}
/** The action prefix stays intact; the new event orders later same-time actions
 * after the cutover. Existing visits are never restarted at this boundary. */
export async function prepareTourMigration(record: LifeRecord): Promise<LifeRecord> {
    if ((record.version === 4 || record.version === 5 || record.version === 6 || record.version === 7)) { await verifyTourCutover(record); return record; }
    if (record.version !== 3 || record.tourCutover) throw new Error('Unknown tour migration source');
    const before = replayLife(record);
    const cutover: TourCutover = { rules: 'gp3-tours-v1', profileId: record.profileId, at: record.now,
        actionCount: record.actions.length, priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await digest(cutover);
    const next: LifeRecord = { ...record, version: 4, tourCutover: cutover };
    const { tourVersion: ignoredVersion, roamRound: ignoredRound, ...after } = replayLife(next); void ignoredVersion; void ignoredRound;
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('巡回の切替前後で島の状態が違います。');
    return next;
}
