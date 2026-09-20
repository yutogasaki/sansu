import type { LifeAction, LifeRecord } from './model';
import { replayLife } from './simulation';

/** An immutable action prefix separates legacy activity selection from relation selection. */
export interface RelationCutover {
    rules: 'relation-selection-v1'; profileId: string; at: number; actionCount: number;
    priorActions: LifeAction[]; validationHash: string;
}
async function digest(cutover: RelationCutover) {
    const { validationHash: ignored, ...payload } = cutover; void ignored;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function assertRelationCutover(record: LifeRecord) {
    const c = record.relationCutover;
    if (!c) { if ((record.version === 13 || record.version === 14 || (record.version === 15 || (record.version === 16 || (record.version === 17 || record.version === 18))))) throw new Error('関係選択の切替記録が見つかりません。'); return; }
    if (![13, 14, 15, 16, 17, 18].includes(record.version) || c.rules !== 'relation-selection-v1' || c.profileId !== record.profileId
        || !record.facilityCutover || !Number.isFinite(c.at) || c.at < record.facilityCutover.at || c.at > record.now
        || !Number.isInteger(c.actionCount) || c.actionCount < record.facilityCutover.actionCount || c.actionCount > record.actions.length
        || c.priorActions.length !== c.actionCount || JSON.stringify(c.priorActions) !== JSON.stringify(record.actions.slice(0, c.actionCount))
        || c.priorActions.some(a => !Number.isFinite(a.at) || a.at > c.at)
        || record.actions.slice(c.actionCount).some(a => !Number.isFinite(a.at) || a.at < c.at)) throw new Error('関係選択の切替前の履歴が変わっています。');
}
export async function verifyRelationCutover(record: LifeRecord) {
    assertRelationCutover(record);
    if (record.relationCutover && record.relationCutover.validationHash !== await digest(record.relationCutover)) throw new Error('関係選択の切替記録を確認できません。');
}
export async function prepareRelationMigration(record: LifeRecord): Promise<LifeRecord> {
    if ((record.version === 13 || record.version === 14 || (record.version === 15 || (record.version === 16 || (record.version === 17 || record.version === 18))))) { await verifyRelationCutover(record); return record; }
    if (!record.facilityCutover || record.relationCutover) throw new Error('Unknown relation migration source');
    const before = replayLife(record);
    const cutover: RelationCutover = { rules: 'relation-selection-v1', profileId: record.profileId, at: record.now,
        actionCount: record.actions.length, priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await digest(cutover);
    const next: LifeRecord = { ...record, version: 13, relationCutover: cutover };
    const { relationSelectionVersion: ignored, ...after } = replayLife(next); void ignored;
    if (JSON.stringify(after) !== JSON.stringify(before)) throw new Error('関係選択の切替前後で島の状態が違います。');
    return next;
}
