import { DISCOVERY_RULE_VERSION, evaluateDiscovery, type DiscoveryRuleId, type RuleEligibility } from './discovery';
import { LIFE_STEP_MS, type LifeState, type ResidentId } from './model';

export type SceneSource = 'live' | 'current-context-test' | 'replay' | 'simulated';
export type SceneSnapshot = Pick<LifeState, 'now' | 'activityVersion' | 'items' | 'residents' | 'heroStyle' | 'expanded' | 'target' | 'relationTarget'>;
export interface DiscoveryScene {
    eventId: string; profileId: string; ruleId: DiscoveryRuleId; ruleVersion: typeof DISCOVERY_RULE_VERSION;
    semanticSignature: string; createdAt: number; source: SceneSource; originEventId?: string;
    focalResidentIds: ResidentId[];
    snapshot: { contentVersion: 1; scene: SceneSnapshot; immutableHash: string };
}
export interface PresentationEvidence {
    eventId: string; firstVisibleAt: number; visibleDurationMs: number; coreShown: boolean;
    presentationKind: SceneSource;
}
export interface PresentedScene { event: DiscoveryScene; evidence: PresentationEvidence }
export interface DiscoveryJournal {
    version: 1; revision: number; entries: PresentedScene[]; historyIds: string[]; savedIds: string[];
    firstPresented: { ruleId: DiscoveryRuleId; ruleVersion: string; eventId: string; at: number }[];
}
export const emptyDiscoveryJournal = (): DiscoveryJournal => ({ version: 1, revision: 0, entries: [], historyIds: [], savedIds: [], firstPresented: [] });

export async function sceneDigest(scene: SceneSnapshot) {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(scene)));
    return Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
}

/** Capture from committed state before rendering. This alone never records a discovery. */
export async function createDiscoveryScene(profileId: string, state: LifeState, rule: RuleEligibility,
    source: Exclude<SceneSource, 'replay'>, eventId: string, createdAt: number, focalResidentIds: ResidentId[] = []): Promise<DiscoveryScene> {
    const current = evaluateDiscovery(state, profileId).find(candidate => candidate.semanticSignature === rule.semanticSignature);
    if (!current || current.ruleId !== rule.ruleId || rule.ruleVersion !== DISCOVERY_RULE_VERSION
        || !eventId || !Number.isFinite(createdAt) || createdAt < 0) throw new Error('この場面は もういちど たしかめてね。');
    const focal = [...new Set(focalResidentIds)].sort();
    if (focal.some(id => !state.residents.some(resident => resident.id === id))) throw new Error('Unknown scene resident');
    const scene: SceneSnapshot = structuredClone({ now: state.now, activityVersion: state.activityVersion,
        items: state.items, residents: state.residents, heroStyle: state.heroStyle, expanded: state.expanded, target: state.target, relationTarget: state.relationTarget });
    const residentState = focal.map(id => {
        const resident = scene.residents.find(candidate => candidate.id === id)!;
        return [id, resident.visit?.itemId ?? null,
            resident.visit ? state.now >= resident.visit.start + (resident.visit.path.length - 1) * LIFE_STEP_MS ? 'using' : 'walking' : 'idle'];
    });
    return { eventId, profileId, ruleId: rule.ruleId, ruleVersion: rule.ruleVersion,
        semanticSignature: JSON.stringify([rule.semanticSignature, residentState]), createdAt, source, focalResidentIds: focal,
        snapshot: { contentVersion: 1, scene, immutableHash: await sceneDigest(scene) } };
}

/** A replay keeps the original source event; it cannot be relabeled as live. */
export function replayDiscoveryScene(original: DiscoveryScene, eventId: string, createdAt: number): DiscoveryScene {
    return { ...structuredClone(original), eventId, createdAt, source: 'replay', originEventId: original.originEventId ?? original.eventId };
}

export function qualifiesAsPresented(event: DiscoveryScene, evidence: PresentationEvidence) {
    return Boolean(event.eventId) && Number.isFinite(event.createdAt) && event.createdAt >= 0
        && ['live', 'current-context-test', 'replay', 'simulated'].includes(event.source)
        && evidence.eventId === event.eventId && evidence.presentationKind === event.source && evidence.coreShown
        && Number.isFinite(evidence.firstVisibleAt) && evidence.firstVisibleAt >= event.createdAt
        && Number.isFinite(evidence.visibleDurationMs) && evidence.visibleDurationMs >= 1000;
}

function collectUnreferenced(journal: DiscoveryJournal) {
    const retained = new Set([...journal.historyIds, ...journal.savedIds, ...journal.firstPresented.map(first => first.eventId)]);
    for (const entry of journal.entries) if (retained.has(entry.event.eventId) && entry.event.originEventId) retained.add(entry.event.originEventId);
    journal.entries = journal.entries.filter(entry => retained.has(entry.event.eventId));
}

export function appendPresentedScene(previous: DiscoveryJournal, event: DiscoveryScene, evidence: PresentationEvidence): DiscoveryJournal {
    if (previous.version !== 1) throw new Error('この記録は 新しい版でひらいてね。');
    if (!qualifiesAsPresented(event, evidence)) return previous;
    const existing = previous.entries.find(entry => entry.event.eventId === event.eventId);
    if (existing) {
        if (JSON.stringify(existing.event) !== JSON.stringify(event)) throw new Error('同じ場面の内容が変わっています。');
        return previous;
    }
    if (event.source === 'replay') {
        const origin = previous.entries.find(entry => entry.event.eventId === event.originEventId)?.event;
        if (!origin || origin.source === 'replay' || origin.profileId !== event.profileId
            || origin.ruleId !== event.ruleId || origin.ruleVersion !== event.ruleVersion
            || JSON.stringify(origin.focalResidentIds) !== JSON.stringify(event.focalResidentIds)
            || origin.semanticSignature !== event.semanticSignature || origin.snapshot.immutableHash !== event.snapshot.immutableHash) throw new Error('もとの場面が みつからないよ。');
    } else if (event.originEventId) throw new Error('Invalid scene origin');
    const journal = structuredClone(previous);
    const duplicateIds = new Set(journal.entries.filter(entry => entry.event.source === event.source
        && entry.event.semanticSignature === event.semanticSignature).map(entry => entry.event.eventId));
    journal.entries.push({ event: structuredClone(event), evidence: structuredClone(evidence) });
    journal.historyIds = [event.eventId, ...journal.historyIds.filter(id => !duplicateIds.has(id))].slice(0, 20);
    if ((event.source === 'live' || event.source === 'current-context-test')
        && !journal.firstPresented.some(first => first.ruleId === event.ruleId && first.ruleVersion === event.ruleVersion)) {
        journal.firstPresented.push({ ruleId: event.ruleId, ruleVersion: event.ruleVersion, eventId: event.eventId, at: evidence.firstVisibleAt });
    }
    journal.revision++; collectUnreferenced(journal); return journal;
}

export function saveDiscoveryMemory(previous: DiscoveryJournal, eventId: string): DiscoveryJournal {
    if (previous.version !== 1) throw new Error('この記録は 新しい版でひらいてね。');
    if (previous.savedIds.includes(eventId)) return previous;
    if (!previous.entries.some(entry => entry.event.eventId === eventId)) throw new Error('場面が みつからないよ。');
    if (previous.savedIds.length >= 12) throw new Error('おもいでが いっぱいだよ。のこすものを えらんでね。');
    return { ...previous, revision: previous.revision + 1, savedIds: [...previous.savedIds, eventId] };
}

/** Explicitly unpin one selected memory; never evict another to make room. */
export function unpinDiscoveryMemory(previous: DiscoveryJournal, eventId: string): DiscoveryJournal {
    if (previous.version !== 1) throw new Error('この記録は 新しい版でひらいてね。');
    if (!previous.savedIds.includes(eventId)) return previous;
    const journal = structuredClone(previous);
    journal.savedIds = journal.savedIds.filter(id => id !== eventId); journal.revision++;
    collectUnreferenced(journal); return journal;
}
