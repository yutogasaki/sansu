import type { LifeAction, LifeRecord } from './model';
import { replayLife } from './simulation';

/** An immutable action prefix separates legacy placement rules from permissive placement. */
export interface PlacementCutover {
    rules: 'placement-access-v1'; profileId: string; at: number; actionCount: number;
    priorActions: LifeAction[]; validationHash: string;
}
async function digest(cutover: PlacementCutover) {
    const { validationHash: ignored, ...payload } = cutover; void ignored;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function assertPlacementCutover(record: LifeRecord) {
    const c = record.placementCutover;
    if (!c) { if (record.version === 15) throw new Error('配置の切替記録が見つかりません。'); return; }
    if (![15].includes(record.version) || c.rules !== 'placement-access-v1' || c.profileId !== record.profileId
        || !record.relationCutover || !Number.isFinite(c.at) || c.at < record.relationCutover.at || c.at > record.now
        || !Number.isInteger(c.actionCount) || c.actionCount < record.relationCutover.actionCount || c.actionCount > record.actions.length
        || c.priorActions.length !== c.actionCount || JSON.stringify(c.priorActions) !== JSON.stringify(record.actions.slice(0, c.actionCount))
        || c.priorActions.some(a => !Number.isFinite(a.at) || a.at > c.at)
        || record.actions.slice(c.actionCount).some(a => !Number.isFinite(a.at) || a.at < c.at)) throw new Error('配置の切替前の履歴が変わっています。');
}
export async function verifyPlacementCutover(record: LifeRecord) {
    assertPlacementCutover(record);
    if (record.placementCutover && record.placementCutover.validationHash !== await digest(record.placementCutover)) throw new Error('配置の切替記録を確認できません。');
}
export async function preparePlacementMigration(record: LifeRecord): Promise<LifeRecord> {
    if (record.version === 15) { await verifyPlacementCutover(record); return record; }
    if (!record.relationCutover || record.placementCutover) throw new Error('Unknown placement migration source');
    const before = replayLife(record);
    const cutover: PlacementCutover = { rules: 'placement-access-v1', profileId: record.profileId, at: record.now,
        actionCount: record.actions.length, priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await digest(cutover);
    const next: LifeRecord = { ...record, version: 15, placementCutover: cutover };
    const { placementVersion: ignored, ...after } = replayLife(next); void ignored;
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('配置の切替前後で島の状態が違います。');
    return next;
}
