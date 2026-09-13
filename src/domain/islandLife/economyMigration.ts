import { ECONOMY_V3_VERSION, GROWTH_WINDOW_MS, initialLightBudget } from './economyRules';
import type { Credit, LifeRecord, LifeState } from './model';
import type { TerminalFact } from './repository';
import { replayLife } from './simulation';

type LegacyRecord = Omit<LifeRecord, 'economyCheckpoint'> & { version: 1 | 2 };
export interface LifeEconomyCheckpoint {
    checkpointId: string;
    sourceRules: 'life-48-v1';
    targetRules: typeof ECONOMY_V3_VERSION;
    originalRecord: LegacyRecord;
    sourceRecord: LegacyRecord;
    sourceFactWatermark: TerminalFact[];
    cutoverAt: number;
    actionCount: number;
    projectedCreditIds: string[];
    legacyCorrections: Credit[];
    initialLightRemainingBudget: number;
    state: LifeState;
    validationHash: string;
    completionStatus: 'complete';
}
async function digest(value: unknown) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}
function payload(checkpoint: LifeEconomyCheckpoint) {
    const { validationHash: _hash, ...rest } = checkpoint; void _hash; return rest;
}
export async function verifyEconomyCheckpoint(checkpoint: LifeEconomyCheckpoint) {
    if (checkpoint.completionStatus !== 'complete' || checkpoint.targetRules !== ECONOMY_V3_VERSION
        || !checkpoint.originalRecord || ![1, 2].includes(checkpoint.originalRecord.version) || checkpoint.originalRecord.profileId !== checkpoint.sourceRecord.profileId
        || checkpoint.sourceRules !== 'life-48-v1' || ![1, 2].includes(checkpoint.sourceRecord.version)
        || checkpoint.cutoverAt !== checkpoint.sourceRecord.now || checkpoint.actionCount !== checkpoint.sourceRecord.actions.length
        || checkpoint.validationHash !== await digest(payload(checkpoint))) throw new Error('島の切替記録を確認できません。');
}
export function assertCheckpointBoundary(record: LifeRecord) {
    const checkpoint = record.economyCheckpoint;
    if (!checkpoint) { if ((record.version === 3 || record.version === 4 || record.version === 5 || record.version === 6 || record.version === 7 || record.version === 8 || record.version === 9 || record.version === 10 || record.version === 11 || record.version === 12 || (record.version === 13 || record.version === 14 || record.version === 15))) throw new Error('島の切替記録が見つかりません。'); return; }
    const known = new Set(checkpoint.projectedCreditIds);
    if (![3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].includes(record.version) || record.profileId !== checkpoint.sourceRecord.profileId
        || checkpoint.checkpointId !== JSON.stringify([record.profileId, ECONOMY_V3_VERSION])
        || JSON.stringify(record.actions.slice(0, checkpoint.actionCount)) !== JSON.stringify(checkpoint.sourceRecord.actions)
        || JSON.stringify(record.credits.filter(credit => known.has(credit.id))) !== JSON.stringify([...checkpoint.sourceRecord.credits.filter(credit => credit.at <= checkpoint.cutoverAt), ...checkpoint.legacyCorrections])
        || record.actions.slice(checkpoint.actionCount).some(action => action.at < checkpoint.cutoverAt)) throw new Error('切替前の島の履歴が変わっています。');
}
export function checkpointLegacyRecord(checkpoint: LifeEconomyCheckpoint): LegacyRecord {
    return { ...checkpoint.sourceRecord, credits: [...checkpoint.sourceRecord.credits, ...checkpoint.legacyCorrections] };
}
function currentBase(legacy: LegacyRecord, budget: number): LifeState {
    const state = replayLife(legacy), seen = new Set<string>();
    const unique = [...legacy.credits].sort((a, b) => a.at - b.at).filter(credit => {
        if (seen.has(credit.id)) return false; seen.add(credit.id); return true;
    });
    return { ...state, economy: { version: ECONOMY_V3_VERSION, lightRemainingBudget: budget,
        completionTimes: unique.filter(credit => credit.at <= state.now && credit.at > state.now - GROWTH_WINDOW_MS).map(credit => credit.at) } };
}

/** Prepare a complete backup + verified projection. The caller must commit this
 * atomically under the same owner/revision lock before enabling new rules. */
export async function prepareEconomyMigration(record: LifeRecord, facts: readonly TerminalFact[], originalRecord: LifeRecord = record): Promise<LifeRecord> {
    if ((record.version === 3 || record.version === 4 || record.version === 5 || record.version === 6 || record.version === 7 || record.version === 8 || record.version === 9 || record.version === 10 || record.version === 11 || record.version === 12 || (record.version === 13 || record.version === 14 || record.version === 15))) {
        if (!record.economyCheckpoint) throw new Error('島の切替記録が見つかりません。');
        assertCheckpointBoundary(record); await verifyEconomyCheckpoint(record.economyCheckpoint); return record;
    }
    if (![1, 2].includes(record.version) || record.economyCheckpoint || ![1, 2].includes(originalRecord.version) || originalRecord.economyCheckpoint || originalRecord.profileId !== record.profileId) throw new Error('Unknown migration source');
    if (record.actions.some(action => !Number.isFinite(action.at) || action.at > record.now)) throw new Error('以前の時間境界を確認できません。');
    const sourceRecord = structuredClone(record) as LegacyRecord, before = replayLife(sourceRecord);
    const budget = initialLightBudget(before.light, before.styles);
    const checkpoint: LifeEconomyCheckpoint = {
        checkpointId: JSON.stringify([record.profileId, ECONOMY_V3_VERSION]), sourceRules: 'life-48-v1', targetRules: ECONOMY_V3_VERSION,
        originalRecord: structuredClone(originalRecord) as LegacyRecord, sourceRecord, sourceFactWatermark: structuredClone([...facts]).sort((a, b) => a.id.localeCompare(b.id)),
        cutoverAt: record.now, actionCount: record.actions.length, projectedCreditIds: record.credits.filter(credit => credit.at <= record.now).map(credit => credit.id),
        legacyCorrections: [], initialLightRemainingBudget: budget, state: currentBase(sourceRecord, budget), validationHash: '', completionStatus: 'complete',
    };
    const { economy: _economy, ...preserved } = checkpoint.state; void _economy;
    if (JSON.stringify(preserved) !== JSON.stringify(before)) throw new Error('島の切替前後で内容が違います。');
    checkpoint.validationHash = await digest(payload(checkpoint));
    return { ...record, version: 3, economyCheckpoint: checkpoint };
}

/** A late pre-cutover terminal is replayed using the unchanged historical
 * prices/time boundaries. The original backup and fixed light budget remain. */
export async function reconcileLegacyCredits(record: LifeRecord): Promise<LifeRecord> {
    const previous = record.economyCheckpoint; if (!previous) return record;
    assertCheckpointBoundary(record); await verifyEconomyCheckpoint(previous);
    const known = new Set(previous.projectedCreditIds);
    const late = record.credits.filter(credit => !known.has(credit.id) && credit.at <= previous.cutoverAt);
    if (!late.length) return record;
    const checkpoint = structuredClone(previous);
    checkpoint.legacyCorrections.push(...structuredClone(late));
    checkpoint.projectedCreditIds.push(...late.map(credit => credit.id));
    const corrected = currentBase(checkpointLegacyRecord(checkpoint), checkpoint.initialLightRemainingBudget);
    // Unknown historical behavior must stop migration rather than invent rights.
    if (corrected.light !== previous.state.light || JSON.stringify(corrected.styles) !== JSON.stringify(previous.state.styles)
        || corrected.items.length !== previous.state.items.length || corrected.items.some(item => {
            const old = previous.state.items.find(candidate => candidate.id === item.id);
            return !old || item.growth < old.growth || JSON.stringify({ ...item, growth: 0 }) !== JSON.stringify({ ...old, growth: 0 });
        })) throw new Error('以前の成長と権利を確認できません。');
    checkpoint.state = corrected; checkpoint.validationHash = await digest(payload(checkpoint));
    return { ...record, economyCheckpoint: checkpoint };
}
