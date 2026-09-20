import type { LifeAction, LifeRecord } from './model';
import { replayLife } from './simulation';

/** An immutable action prefix separates legacy heroVisit rules from short autonomous visits. */
export interface HeroVisitCutover {
    rules: 'hero-single-visit-v1'; profileId: string; at: number; actionCount: number;
    priorActions: LifeAction[]; validationHash: string;
}
async function digest(cutover: HeroVisitCutover) {
    const { validationHash: ignored, ...payload } = cutover; void ignored;
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function assertHeroVisitCutover(record: LifeRecord) {
    const c = record.heroVisitCutover;
    if (!c) { if ((record.version === 17 || (record.version === 18 || record.version === 19))) throw new Error('呼び出しの切替記録が見つかりません。'); return; }
    if (![17, 18, 19].includes(record.version) || c.rules !== 'hero-single-visit-v1' || c.profileId !== record.profileId
        || !record.cadenceCutover || !Number.isFinite(c.at) || c.at < record.cadenceCutover.at || c.at > record.now
        || !Number.isInteger(c.actionCount) || c.actionCount < record.cadenceCutover.actionCount || c.actionCount > record.actions.length
        || c.priorActions.length !== c.actionCount || JSON.stringify(c.priorActions) !== JSON.stringify(record.actions.slice(0, c.actionCount))
        || c.priorActions.some(a => !Number.isFinite(a.at) || a.at > c.at)
        || record.actions.slice(c.actionCount).some(a => !Number.isFinite(a.at) || a.at < c.at)) throw new Error('呼び出しの切替前の履歴が変わっています。');
}
export async function verifyHeroVisitCutover(record: LifeRecord) {
    assertHeroVisitCutover(record);
    if (record.heroVisitCutover && record.heroVisitCutover.validationHash !== await digest(record.heroVisitCutover)) throw new Error('呼び出しの切替記録を確認できません。');
}
export async function prepareHeroVisitMigration(record: LifeRecord): Promise<LifeRecord> {
    if ((record.version === 17 || (record.version === 18 || record.version === 19))) { await verifyHeroVisitCutover(record); return record; }
    if (!record.cadenceCutover || record.heroVisitCutover) throw new Error('Unknown heroVisit migration source');
    const before = replayLife(record);
    const cutover: HeroVisitCutover = { rules: 'hero-single-visit-v1', profileId: record.profileId, at: record.now,
        actionCount: record.actions.length, priorActions: structuredClone(record.actions), validationHash: '' };
    cutover.validationHash = await digest(cutover);
    const next: LifeRecord = { ...record, version: 17, heroVisitCutover: cutover };
    const after = replayLife(next);
    if (after.light !== before.light || after.drops !== before.drops
        || JSON.stringify(after.items) !== JSON.stringify(before.items)
        || after.residents.some((r, i) => r.enjoyed !== before.residents[i].enjoyed)) throw new Error('呼び出しの切替前後で島の状態が違います。');
    return next;
}
