import type { LifeAction, LifeRecord } from './model';
import { replayLife } from './simulation';

/** An immutable action prefix separates legacy diagonal rules from short autonomous visits. */
export interface DiagonalCutover {
    rules: 'diagonal-roam-v1'; profileId: string; at: number; actionCount: number;
    priorActions: LifeAction[]; validationHash: string;
}
async function digest(cutover: DiagonalCutover) {
    const { validationHash: ignored, ...payload } = cutover; void ignored;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function assertDiagonalCutover(record: LifeRecord) {
    const c = record.diagonalCutover;
    if (!c) { if ((record.version === 18 || record.version === 19)) throw new Error('斜め散歩の切替記録が見つかりません。'); return; }
    if (![18, 19].includes(record.version) || c.rules !== 'diagonal-roam-v1' || c.profileId !== record.profileId
        || !record.heroVisitCutover || !Number.isFinite(c.at) || c.at < record.heroVisitCutover.at || c.at > record.now
        || !Number.isInteger(c.actionCount) || c.actionCount < record.heroVisitCutover.actionCount || c.actionCount > record.actions.length
        || c.priorActions.length !== c.actionCount || JSON.stringify(c.priorActions) !== JSON.stringify(record.actions.slice(0, c.actionCount))
        || c.priorActions.some(a => !Number.isFinite(a.at) || a.at > c.at)
        || record.actions.slice(c.actionCount).some(a => !Number.isFinite(a.at) || a.at < c.at)) throw new Error('斜め散歩の切替前の履歴が変わっています。');
}
export async function verifyDiagonalCutover(record: LifeRecord) {
    assertDiagonalCutover(record);
    if (record.diagonalCutover && record.diagonalCutover.validationHash !== await digest(record.diagonalCutover)) throw new Error('斜め散歩の切替記録を確認できません。');
}
export async function prepareDiagonalMigration(record: LifeRecord): Promise<LifeRecord> {
    if ((record.version === 18 || record.version === 19)) { await verifyDiagonalCutover(record); return record; }
    if (!record.heroVisitCutover || record.diagonalCutover) throw new Error('Unknown diagonal migration source');
    const before = replayLife(record);
    const cutover: DiagonalCutover = { rules: 'diagonal-roam-v1', profileId: record.profileId, at: record.now,
        actionCount: record.actions.length, priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await digest(cutover);
    const next: LifeRecord = { ...record, version: 18, diagonalCutover: cutover };
    const after = replayLife(next);
    if (after.light !== before.light || after.drops !== before.drops
        || JSON.stringify(after.items) !== JSON.stringify(before.items)
        || after.residents.some((r, i) => r.enjoyed !== before.residents[i].enjoyed)) throw new Error('斜め散歩の切替前後で島の状態が違います。');
    return next;
}
