import type { LifeAction, LifeRecord } from './model';
import { replayLife } from './simulation';

/** An immutable action prefix separates legacy cadence rules from short autonomous visits. */
export interface CadenceCutover {
    rules: 'resident-cadence-v1'; profileId: string; at: number; actionCount: number;
    priorActions: LifeAction[]; validationHash: string;
}
async function digest(cutover: CadenceCutover) {
    const { validationHash: ignored, ...payload } = cutover; void ignored;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function assertCadenceCutover(record: LifeRecord) {
    const c = record.cadenceCutover;
    if (!c) { if ((record.version === 16 || (record.version === 17 || record.version === 18))) throw new Error('暮らしの切替記録が見つかりません。'); return; }
    if (![16, 17, 18].includes(record.version) || c.rules !== 'resident-cadence-v1' || c.profileId !== record.profileId
        || !record.placementCutover || !Number.isFinite(c.at) || c.at < record.placementCutover.at || c.at > record.now
        || !Number.isInteger(c.actionCount) || c.actionCount < record.placementCutover.actionCount || c.actionCount > record.actions.length
        || c.priorActions.length !== c.actionCount || JSON.stringify(c.priorActions) !== JSON.stringify(record.actions.slice(0, c.actionCount))
        || c.priorActions.some(a => !Number.isFinite(a.at) || a.at > c.at)
        || record.actions.slice(c.actionCount).some(a => !Number.isFinite(a.at) || a.at < c.at)) throw new Error('暮らしの切替前の履歴が変わっています。');
}
export async function verifyCadenceCutover(record: LifeRecord) {
    assertCadenceCutover(record);
    if (record.cadenceCutover && record.cadenceCutover.validationHash !== await digest(record.cadenceCutover)) throw new Error('暮らしの切替記録を確認できません。');
}
export async function prepareCadenceMigration(record: LifeRecord): Promise<LifeRecord> {
    if ((record.version === 16 || (record.version === 17 || record.version === 18))) { await verifyCadenceCutover(record); return record; }
    if (!record.placementCutover || record.cadenceCutover) throw new Error('Unknown cadence migration source');
    const before = replayLife(record);
    const cutover: CadenceCutover = { rules: 'resident-cadence-v1', profileId: record.profileId, at: record.now,
        actionCount: record.actions.length, priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await digest(cutover);
    const next: LifeRecord = { ...record, version: 16, cadenceCutover: cutover };
    const after = replayLife(next);
    if (after.light !== before.light || after.drops !== before.drops
        || JSON.stringify(after.items) !== JSON.stringify(before.items)
        || after.residents.some((r, i) => r.enjoyed !== before.residents[i].enjoyed)) throw new Error('暮らしの切替前後で島の状態が違います。');
    return next;
}
