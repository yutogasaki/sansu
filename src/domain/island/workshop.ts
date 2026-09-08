import { normalizeIslandExperienceName } from './experience';
import type { IslandRecord } from './types';
import { canonicalWorkshopDraftEdit, createEmptyWorkshopLayout, createWorkshopDraft, hasValidWorkshopDraft,
    hasValidWorkshopLayout, normalizeWorkshopLayout, reduceWorkshopDraft, simulateWorkshop,
    type WorkshopDraft, type WorkshopDraftEdit, type WorkshopLayout, type WorkshopPartId } from './workshopLayout';

export const WORKSHOP_NAMESPACE = 'island-workshop:v1:';
export const WORKSHOP_SPECIMEN_IDS = ['driftwood', 'seaglass', 'striped-shell'] as const;
export type WorkshopSpecimenId = typeof WORKSHOP_SPECIMEN_IDS[number];
export const WORKSHOP_TOOL_IDS = ['brush', 'lamp', 'water'] as const;
export type WorkshopToolId = typeof WORKSHOP_TOOL_IDS[number];
export const WORKSHOP_RESULTS = ['clean', 'transmit', 'opaque', 'float', 'sink'] as const;
export type WorkshopObservationResult = typeof WORKSHOP_RESULTS[number];
export const WORKSHOP_SHELF_IDS = ['shelf-1', 'shelf-2', 'shelf-3'] as const;
export type WorkshopShelfId = typeof WORKSHOP_SHELF_IDS[number];
export const WORKSHOP_WORK_IDS = ['work-1', 'work-2'] as const;
export type WorkshopWorkId = typeof WORKSHOP_WORK_IDS[number];
export const WORKSHOP_CREATION_PART_IDS = ['wheel', 'bell'] as const;
export type WorkshopCreationPartId = typeof WORKSHOP_CREATION_PART_IDS[number];
export const WORKSHOP_CLEAN_MASK = 63;
export const WORKSHOP_SPECIMENS = {
    driftwood: { name: 'ながれぎ', lamp: 'opaque', water: 'float', identityResult: 'float', parts: ['straight', 'elbow'] },
    seaglass: { name: 'いろガラス', lamp: 'transmit', water: 'sink', identityResult: 'transmit', parts: ['wheel'] },
    'striped-shell': { name: 'しまもようの かい', lamp: 'opaque', water: 'sink', identityResult: 'opaque', parts: ['bell'] },
} as const satisfies Record<WorkshopSpecimenId, { name: string; lamp: WorkshopObservationResult;
    water: WorkshopObservationResult; identityResult: WorkshopObservationResult; parts: readonly WorkshopPartId[] }>;

interface WorkshopFirstRecord { id: string; observedAt: number; order: number }
export interface WorkshopSpecimenObservation extends WorkshopFirstRecord { result: WorkshopObservationResult }
export interface WorkshopSpecimenState {
    id: string;
    /** Set bits are the six surface regions already brushed by confirmed gestures. */
    cleanedMask: number;
    name?: string;
    observations: WorkshopSpecimenObservation[];
    identity?: WorkshopFirstRecord;
}
export interface WorkshopSavedWork { id: string; name: string; layout: WorkshopLayout; capturedAt: number }
export interface WorkshopDraftCheckpoint {
    draft: WorkshopDraft;
    /** Captured when choosing an idea; later overwriting that saved slot cannot change cancel. */
    baseLayout: WorkshopLayout;
    sourceWorkId?: WorkshopWorkId;
}
export interface WorkshopCreationObservation extends WorkshopFirstRecord { partId: WorkshopCreationPartId; layout: WorkshopLayout }
export interface IslandWorkshopState {
    version: 1;
    specimens: Record<WorkshopSpecimenId, WorkshopSpecimenState>;
    shelves: Record<WorkshopShelfId, WorkshopSpecimenId | null>;
    draftCheckpoint: WorkshopDraftCheckpoint;
    works: Partial<Record<WorkshopWorkId, WorkshopSavedWork>>;
    creations: WorkshopCreationObservation[];
}
export type IslandWorkshopAction =
    | { type: 'brush'; specimenId: WorkshopSpecimenId; section: number }
    | { type: 'observe-specimen'; specimenId: WorkshopSpecimenId; result: WorkshopObservationResult; cleanedMask: number }
    | { type: 'name-specimen'; specimenId: WorkshopSpecimenId; name?: string }
    | { type: 'shelve'; specimenId: WorkshopSpecimenId; shelfId?: WorkshopShelfId }
    | { type: 'edit-draft'; edit: WorkshopDraftEdit }
    | { type: 'save-work'; workId: WorkshopWorkId; name: string }
    | { type: 'load-work'; workId?: WorkshopWorkId }
    | { type: 'cancel-draft' }
    | { type: 'delete-work'; workId: WorkshopWorkId }
    | { type: 'observe-creation'; partId: WorkshopCreationPartId; layoutKey: string };
export type IslandWorkshopConflictCode = 'invalid-state' | 'invalid-name' | 'invalid-action' | 'workshop-locked'
    | 'result-unavailable' | 'stale-observation' | 'shelf-occupied' | 'work-missing';
export class IslandWorkshopConflict extends Error {
    constructor(public readonly code: IslandWorkshopConflictCode, message: string) { super(message); this.name = 'IslandWorkshopConflict'; }
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));
const member = <T extends string>(values: readonly T[], value: unknown): value is T => values.some(candidate => candidate === value);
const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
function normalizedName(value: unknown): string {
    try { return normalizeIslandExperienceName(value); }
    catch { throw new IslandWorkshopConflict('invalid-name', 'なまえを 1〜16もじで いれてね'); }
}
const validName = (value: unknown) => { try { return normalizedName(value) === value; } catch { return false; } };
const scopedId = (profileId: string, kind: string, key: string) => `${WORKSHOP_NAMESPACE}${kind}:${encodeURIComponent(profileId)}:${key}`;
export const workshopSpecimenIdentity = (profileId: string, specimenId: WorkshopSpecimenId) => scopedId(profileId, 'specimen', specimenId);
export const workshopLayoutKey = (layout: WorkshopLayout) => JSON.stringify(normalizeWorkshopLayout(layout));

function createWorkshop(profileId: string): IslandWorkshopState {
    const specimen = (id: WorkshopSpecimenId): WorkshopSpecimenState => ({ id: workshopSpecimenIdentity(profileId, id), cleanedMask: 0, observations: [] });
    return { version: 1,
        specimens: { driftwood: specimen('driftwood'), seaglass: specimen('seaglass'), 'striped-shell': specimen('striped-shell') },
        shelves: { 'shelf-1': null, 'shelf-2': null, 'shelf-3': null },
        draftCheckpoint: { draft: createWorkshopDraft(), baseLayout: createEmptyWorkshopLayout() }, works: {}, creations: [] };
}
/** A rendering result is eligible only after the tool has shown this actual surface. This helper does not record it. */
export function getWorkshopToolResult(state: IslandWorkshopState, specimenId: WorkshopSpecimenId, tool: WorkshopToolId): WorkshopObservationResult | undefined {
    const clean = state.specimens[specimenId].cleanedMask === WORKSHOP_CLEAN_MASK;
    if (tool === 'brush') return clean ? 'clean' : undefined;
    if (tool === 'lamp') return specimenId === 'seaglass' && !clean ? undefined : WORKSHOP_SPECIMENS[specimenId].lamp;
    return WORKSHOP_SPECIMENS[specimenId].water;
}
export function getWorkshopSpecimenName(state: IslandWorkshopState, specimenId: WorkshopSpecimenId): string {
    const specimen = state.specimens[specimenId];
    return specimen.name ?? (specimen.identity ? WORKSHOP_SPECIMENS[specimenId].name : `すなの かたまり ${WORKSHOP_SPECIMEN_IDS.indexOf(specimenId) + 1}`);
}
export function getWorkshopAssemblableParts(state: IslandWorkshopState): WorkshopPartId[] {
    return WORKSHOP_SPECIMEN_IDS.flatMap(id => state.specimens[id].identity ? [...WORKSHOP_SPECIMENS[id].parts] : []);
}
const allFirstRecords = (state: IslandWorkshopState): WorkshopFirstRecord[] => [
    ...WORKSHOP_SPECIMEN_IDS.flatMap(id => [...state.specimens[id].observations, ...(state.specimens[id].identity ? [state.specimens[id].identity!] : [])]),
    ...state.creations,
];
function nextFirstRecord(state: IslandWorkshopState, id: string, now: number): WorkshopFirstRecord {
    const records = allFirstRecords(state);
    return { id, observedAt: Math.max(now, ...records.map(entry => entry.observedAt)), order: records.length + 1 };
}
function firstRecord(value: Record<string, unknown>, expectedId: string) {
    return value.id === expectedId && integer(value.observedAt) && integer(value.order, 1, 14);
}
function allowedLayout(layout: WorkshopLayout, allowed: readonly WorkshopPartId[]) {
    return Object.entries(layout.parts).every(([id, part]) => !part.assembled || allowed.includes(id as WorkshopPartId));
}

/** Unknown versions, keys, foreign identities and inconsistent observation histories are never replaced with defaults. */
export function hasValidIslandWorkshop(island: Pick<IslandRecord, 'profileId' | 'workshop'>): boolean {
    const value: unknown = island.workshop;
    if (value === undefined) return true;
    if (typeof island.profileId !== 'string' || !island.profileId || !record(value)
        || !keys(value, ['version', 'specimens', 'shelves', 'draftCheckpoint', 'works', 'creations']) || value.version !== 1
        || !record(value.specimens) || !keys(value.specimens, WORKSHOP_SPECIMEN_IDS)
        || !record(value.shelves) || !keys(value.shelves, WORKSHOP_SHELF_IDS)
        || !record(value.works) || !keys(value.works, WORKSHOP_WORK_IDS)
        || !Array.isArray(value.creations) || value.creations.length > 2) return false;
    for (const id of WORKSHOP_SPECIMEN_IDS) {
        const specimen = value.specimens[id], definition = WORKSHOP_SPECIMENS[id];
        if (!record(specimen) || !keys(specimen, ['id', 'cleanedMask', 'name', 'observations', 'identity'])
            || specimen.id !== workshopSpecimenIdentity(island.profileId, id) || !integer(specimen.cleanedMask, 0, WORKSHOP_CLEAN_MASK)
            || (specimen.name !== undefined && !validName(specimen.name)) || !Array.isArray(specimen.observations) || specimen.observations.length > 3) return false;
        const observations = specimen.observations;
        for (const observation of observations) {
            if (!record(observation) || !keys(observation, ['id', 'result', 'observedAt', 'order'])
                || !member(['clean', definition.lamp, definition.water], observation.result)
                || !firstRecord(observation, scopedId(island.profileId, 'observation', `${id}:${observation.result}`))
                || (['clean', 'transmit'].includes(observation.result) && specimen.cleanedMask !== WORKSHOP_CLEAN_MASK)) return false;
        }
        if (new Set(observations.map(observation => observation.result)).size !== observations.length
            || observations.some((observation, index) => index > 0 && observation.order <= observations[index - 1].order)) return false;
        const required = ['clean', definition.identityResult].map(result => observations.find(observation => observation.result === result));
        const identified = required.every(Boolean), identity = specimen.identity;
        if (identified !== Boolean(identity)) return false;
        if (identity !== undefined) {
            const last = required.reduce((latest, entry) => entry.order > latest.order ? entry : latest);
            if (!record(identity) || !keys(identity, ['id', 'observedAt', 'order']) || !firstRecord(identity, scopedId(island.profileId, 'identity', id))
                || identity.order !== last.order + 1 || identity.observedAt !== last.observedAt) return false;
        }
    }
    const shelves = WORKSHOP_SHELF_IDS.map(id => value.shelves && (value.shelves as Record<string, unknown>)[id]);
    if (shelves.some(id => id !== null && !member(WORKSHOP_SPECIMEN_IDS, id))
        || new Set(shelves.filter(id => id !== null)).size !== shelves.filter(id => id !== null).length) return false;
    const state = value as unknown as IslandWorkshopState, allowed = getWorkshopAssemblableParts(state), checkpoint = value.draftCheckpoint;
    if (!record(checkpoint) || !keys(checkpoint, ['draft', 'baseLayout', 'sourceWorkId'])
        || !hasValidWorkshopDraft(checkpoint.draft) || !hasValidWorkshopLayout(checkpoint.baseLayout)
        || (checkpoint.sourceWorkId !== undefined && !member(WORKSHOP_WORK_IDS, checkpoint.sourceWorkId))) return false;
    if (![checkpoint.draft.layout, ...checkpoint.draft.undo, ...checkpoint.draft.redo, checkpoint.baseLayout].every(layout => allowedLayout(layout, allowed))) return false;
    for (const id of WORKSHOP_WORK_IDS) {
        const work = value.works[id];
        if (work === undefined) continue;
        if (!record(work) || !keys(work, ['id', 'name', 'layout', 'capturedAt']) || work.id !== scopedId(island.profileId, 'work', id)
            || !validName(work.name) || !integer(work.capturedAt) || !hasValidWorkshopLayout(work.layout) || !allowedLayout(work.layout, allowed)) return false;
    }
    if (checkpoint.sourceWorkId !== undefined && !state.works[checkpoint.sourceWorkId as WorkshopWorkId]) return false;
    for (const creation of value.creations) {
        if (!record(creation) || !keys(creation, ['id', 'partId', 'observedAt', 'order', 'layout'])
            || !member(WORKSHOP_CREATION_PART_IDS, creation.partId) || !firstRecord(creation, scopedId(island.profileId, 'creation', creation.partId))
            || !hasValidWorkshopLayout(creation.layout) || !allowedLayout(creation.layout, allowed)
            || !simulateWorkshop(creation.layout).reachedPartIds.includes(creation.partId)) return false;
        const layout = creation.layout, order = creation.order as number;
        if (WORKSHOP_SPECIMEN_IDS.some(id => WORKSHOP_SPECIMENS[id].parts.some(partId => layout.parts[partId].assembled)
            && (!state.specimens[id].identity || state.specimens[id].identity!.order >= order))) return false;
    }
    if (new Set(state.creations.map(creation => creation.partId)).size !== state.creations.length
        || state.creations.some((creation, index) => index > 0 && creation.order <= state.creations[index - 1].order)) return false;
    const ordered = allFirstRecords(state).sort((a, b) => a.order - b.order);
    return ordered.every((entry, index) => entry.order === index + 1 && (index === 0 || entry.observedAt >= ordered[index - 1].observedAt));
}
export function getIslandWorkshop(island: Pick<IslandRecord, 'profileId' | 'workshop'>): IslandWorkshopState {
    if (!hasValidIslandWorkshop(island)) throw new IslandWorkshopConflict('invalid-state', 'いりえの きろくを よみなおしてね');
    return island.workshop ? structuredClone(island.workshop) : createWorkshop(island.profileId);
}

/** Narrow intents prevent stale tabs from replacing a newer observation with a whole old draft or workshop snapshot. */
export function canonicalIslandWorkshopAction(value: unknown): IslandWorkshopAction {
    if (record(value)) {
        const type = value.type;
        if (member(WORKSHOP_SPECIMEN_IDS, value.specimenId)) {
            const specimenId = value.specimenId;
            if (type === 'brush' && keys(value, ['type', 'specimenId', 'section']) && integer(value.section, 0, 5)) return { type, specimenId, section: value.section };
            if (type === 'observe-specimen' && keys(value, ['type', 'specimenId', 'result', 'cleanedMask'])
                && member(WORKSHOP_RESULTS, value.result) && integer(value.cleanedMask, 0, WORKSHOP_CLEAN_MASK)) return { type, specimenId, result: value.result, cleanedMask: value.cleanedMask };
            if (type === 'name-specimen' && keys(value, ['type', 'specimenId', 'name'])) return { type, specimenId, ...(value.name === undefined ? {} : { name: normalizedName(value.name) }) };
            if (type === 'shelve' && keys(value, ['type', 'specimenId', 'shelfId']) && (value.shelfId === undefined || member(WORKSHOP_SHELF_IDS, value.shelfId))) return { type, specimenId, ...(value.shelfId === undefined ? {} : { shelfId: value.shelfId }) };
        }
        if (type === 'edit-draft' && keys(value, ['type', 'edit'])) return { type, edit: canonicalWorkshopDraftEdit(value.edit) };
        if (type === 'save-work' && keys(value, ['type', 'workId', 'name']) && member(WORKSHOP_WORK_IDS, value.workId)) return { type, workId: value.workId, name: normalizedName(value.name) };
        if (type === 'load-work' && keys(value, ['type', 'workId']) && (value.workId === undefined || member(WORKSHOP_WORK_IDS, value.workId))) return { type, ...(value.workId === undefined ? {} : { workId: value.workId }) };
        if (type === 'cancel-draft' && keys(value, ['type'])) return { type };
        if (type === 'delete-work' && keys(value, ['type', 'workId']) && member(WORKSHOP_WORK_IDS, value.workId)) return { type, workId: value.workId };
        if (type === 'observe-creation' && keys(value, ['type', 'partId', 'layoutKey']) && member(WORKSHOP_CREATION_PART_IDS, value.partId) && typeof value.layoutKey === 'string') {
            try {
                const layoutKey = workshopLayoutKey(JSON.parse(value.layoutKey));
                return { type, partId: value.partId, layoutKey };
            } catch { /* An observation must bind a valid, canonical layout. */ }
        }
    }
    throw new IslandWorkshopConflict('invalid-action', 'もういちど ためしてみよう');
}

/** A pure confirmed-gesture / visible-result reducer. It never credits learning, stars or ordinary living discoveries. */
export function reduceIslandWorkshop(island: IslandRecord, action: IslandWorkshopAction, now: number): IslandRecord {
    const intent = canonicalIslandWorkshopAction(action), state = getIslandWorkshop(island);
    if (island.completedSets < 1) throw new IslandWorkshopConflict('workshop-locked', 'ひとくぎり あそんだら ひらくよ');
    if (!integer(now)) throw new IslandWorkshopConflict('invalid-state', 'きろくの じかんを たしかめてね');
    if (intent.type === 'brush') state.specimens[intent.specimenId].cleanedMask |= 1 << intent.section;
    else if (intent.type === 'observe-specimen') {
        const specimen = state.specimens[intent.specimenId];
        if (specimen.cleanedMask !== intent.cleanedMask) throw new IslandWorkshopConflict('stale-observation', 'いまの かたちを もういちど みよう');
        const possible = WORKSHOP_TOOL_IDS.map(tool => getWorkshopToolResult(state, intent.specimenId, tool));
        if (!possible.includes(intent.result)) throw new IslandWorkshopConflict('result-unavailable', 'どうぐで かたちを みてみよう');
        if (!specimen.observations.some(entry => entry.result === intent.result)) {
            specimen.observations.push({ ...nextFirstRecord(state, scopedId(island.profileId, 'observation', `${intent.specimenId}:${intent.result}`), now), result: intent.result });
            if (!specimen.identity && ['clean', WORKSHOP_SPECIMENS[intent.specimenId].identityResult]
                .every(result => specimen.observations.some(entry => entry.result === result))) {
                specimen.identity = nextFirstRecord(state, scopedId(island.profileId, 'identity', intent.specimenId), now);
            }
        }
    } else if (intent.type === 'name-specimen') {
        if (intent.name === undefined) delete state.specimens[intent.specimenId].name;
        else state.specimens[intent.specimenId].name = intent.name;
    } else if (intent.type === 'shelve') {
        if (intent.shelfId && state.shelves[intent.shelfId] && state.shelves[intent.shelfId] !== intent.specimenId) throw new IslandWorkshopConflict('shelf-occupied', 'ここには べつの ものが あるよ');
        for (const id of WORKSHOP_SHELF_IDS) if (state.shelves[id] === intent.specimenId) state.shelves[id] = null;
        if (intent.shelfId) state.shelves[intent.shelfId] = intent.specimenId;
    } else if (intent.type === 'edit-draft') state.draftCheckpoint.draft = reduceWorkshopDraft(state.draftCheckpoint.draft, intent.edit, getWorkshopAssemblableParts(state));
    else if (intent.type === 'save-work') state.works[intent.workId] = { id: scopedId(island.profileId, 'work', intent.workId), name: intent.name,
        layout: normalizeWorkshopLayout(state.draftCheckpoint.draft.layout), capturedAt: now };
    else if (intent.type === 'load-work') {
        const work = intent.workId ? state.works[intent.workId] : undefined;
        if (intent.workId && !work) throw new IslandWorkshopConflict('work-missing', 'さくひんを よみなおしてね');
        const baseLayout = work ? normalizeWorkshopLayout(work.layout) : createEmptyWorkshopLayout();
        state.draftCheckpoint = { draft: createWorkshopDraft(baseLayout), baseLayout, ...(intent.workId ? { sourceWorkId: intent.workId } : {}) };
    } else if (intent.type === 'cancel-draft') state.draftCheckpoint.draft = createWorkshopDraft(state.draftCheckpoint.baseLayout);
    else if (intent.type === 'delete-work') {
        if (!state.works[intent.workId]) throw new IslandWorkshopConflict('work-missing', 'さくひんを よみなおしてね');
        delete state.works[intent.workId];
        // Keep the current private draft and its captured cancel baseline after removing the named shelf entry.
        if (state.draftCheckpoint.sourceWorkId === intent.workId) delete state.draftCheckpoint.sourceWorkId;
    } else {
        const layout = state.draftCheckpoint.draft.layout;
        if (intent.layoutKey !== workshopLayoutKey(layout)) throw new IslandWorkshopConflict('stale-observation', 'いまの つなぎかたを もういちど ためそう');
        if (!simulateWorkshop(layout).reachedPartIds.includes(intent.partId)) throw new IslandWorkshopConflict('result-unavailable', 'つなぎめから みてみよう');
        if (!state.creations.some(entry => entry.partId === intent.partId)) state.creations.push({
            ...nextFirstRecord(state, scopedId(island.profileId, 'creation', intent.partId), now), partId: intent.partId, layout: normalizeWorkshopLayout(layout) });
    }
    const updated = { ...island, workshop: state };
    if (!hasValidIslandWorkshop(updated)) throw new IslandWorkshopConflict('invalid-state', 'いりえの きろくを よみなおしてね');
    return updated;
}
