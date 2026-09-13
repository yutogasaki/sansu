import type { LifeAction, LifeRecord } from './model';
import { replayLife } from './simulation';

/** An immutable action prefix separates entrance-only visits from transport. */
export interface FacilityCutover {
    rules: 'facility-trips-v1'; profileId: string; at: number; actionCount: number;
    priorActions: LifeAction[]; validationHash: string;
}
async function digest(cutover: FacilityCutover) {
    const { validationHash: ignored, ...payload } = cutover; void ignored;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function assertFacilityCutover(record: LifeRecord) {
    const c = record.facilityCutover;
    if (!c) { if ((record.version === 11 || record.version === 12 || record.version === 13)) throw new Error('運搬の切替記録が見つかりません。'); return; }
    if (![11, 12, 13].includes(record.version) || c.rules !== 'facility-trips-v1' || c.profileId !== record.profileId
        || !record.tourCutover || !Number.isFinite(c.at) || c.at < record.tourCutover.at || c.at > record.now
        || !Number.isInteger(c.actionCount) || c.actionCount < record.tourCutover.actionCount || c.actionCount > record.actions.length
        || c.priorActions.length !== c.actionCount || JSON.stringify(c.priorActions) !== JSON.stringify(record.actions.slice(0, c.actionCount))
        || c.priorActions.some(a => !Number.isFinite(a.at) || a.at > c.at)
        || record.actions.slice(c.actionCount).some(a => !Number.isFinite(a.at) || a.at < c.at)) throw new Error('運搬の切替前の履歴が変わっています。');
}
export async function verifyFacilityCutover(record: LifeRecord) {
    assertFacilityCutover(record);
    if (record.facilityCutover && record.facilityCutover.validationHash !== await digest(record.facilityCutover)) throw new Error('運搬の切替記録を確認できません。');
}
export async function prepareFacilityMigration(record: LifeRecord): Promise<LifeRecord> {
    if ((record.version === 11 || record.version === 12 || record.version === 13)) { await verifyFacilityCutover(record); return record; }
    if (!record.tourCutover || record.facilityCutover) throw new Error('Unknown facility migration source');
    const before = replayLife(record);
    const cutover: FacilityCutover = { rules: 'facility-trips-v1', profileId: record.profileId, at: record.now,
        actionCount: record.actions.length, priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await digest(cutover);
    const next: LifeRecord = { ...record, version: 11, facilityCutover: cutover };
    const { facilityTripVersion: ignored, ...after } = replayLife(next); void ignored;
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('運搬の切替前後で島の状態が違います。');
    return next;
}
