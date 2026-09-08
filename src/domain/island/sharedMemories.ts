import { getIslandLandAccess, getIslandLands, ISLAND_ITEMS, ISLAND_RESERVED_AREAS } from './catalog';
import { getIslandExperience, ISLAND_RESIDENT_IDS, normalizeIslandExperienceName, type IslandResidentId } from './experience';
import { isIslandHabitatUnlocked } from './growth';
import { getIslandWorkshop, getWorkshopSpecimenName, WORKSHOP_SPECIMENS, WORKSHOP_SPECIMEN_IDS, WORKSHOP_WORK_IDS,
    workshopLayoutKey, workshopSpecimenIdentity, type WorkshopObservationResult, type WorkshopSpecimenId, type WorkshopWorkId } from './workshop';
import { createWorkshopDraft, hasValidWorkshopLayout, normalizeWorkshopLayout, WORKSHOP_PART_IDS,
    type WorkshopLayout, type WorkshopPartId } from './workshopLayout';
import type { IslandPosition, IslandRecord } from './types';
import { SHARED_DISPLAY_RADII, sharedDisplayObstacles } from './sharedDisplayGeometry';
export { SHARED_DISPLAY_RADII, sharedDisplayObstacles } from './sharedDisplayGeometry';

export const SHARED_DISPLAY_IDS = ['display-1', 'display-2', 'display-3'] as const;
export type SharedDisplayId = typeof SHARED_DISPLAY_IDS[number];
export const SHARED_JOB_IDS = ['carry', 'gather', 'illuminate'] as const;
export type SharedJobId = typeof SHARED_JOB_IDS[number];
export const SHARED_RESIDENT_JOBS = { otter: 'carry', rabbit: 'gather', fox: 'illuminate' } as const;
export const SHARED_MEMORY_LIMIT = 12;
export const SHARED_NAMESPACE = 'island-shared:v1';

export type SharedTarget =
    | { kind: 'specimen'; targetKey: string; specimenId: WorkshopSpecimenId }
    | { kind: 'work'; targetKey: string; sourceWorkId: WorkshopWorkId; capturedAt: number; name: string; layout: WorkshopLayout };
export type SharedTargetRef =
    | { kind: 'specimen'; specimenId: WorkshopSpecimenId }
    | { kind: 'work'; workId: WorkshopWorkId; targetKey: string }
    | { kind: 'display'; displayId: SharedDisplayId; targetKey: string }
    | { kind: 'memory'; memoryKey: string };
export interface SharedDisplay {
    target: SharedTarget;
    position: IslandPosition;
    rotation: number;
    arrangement: 'plain' | 'petal-ring';
    placedAt: number;
}
export interface SharedDestination {
    displayId: SharedDisplayId;
    position: IslandPosition;
    rotation: number;
    expectedDisplayKey: string | null;
}
export type SharedVisibleResult = { kind: 'placed' } | { kind: 'petals-arranged'; count: 3 }
    | { kind: 'illuminated'; effect: 'shadow' | 'transmit'; partId?: WorkshopPartId };
export type SharedMemoryOutcome = 'stored' | 'already-stored' | 'not-stored-full';
export interface SharedMemory {
    memoryKey: string;
    residentId: IslandResidentId;
    jobId: SharedJobId;
    target: SharedTarget;
    islandName: string;
    residentName: string;
    targetName: string;
    result: SharedVisibleResult;
    firstAt: number;
    firstOrder: number;
    specimenSnapshot?: { cleanedMask: number; knownResults: WorkshopObservationResult[] };
}
interface SharedRequestBase {
    requestId: string;
    residentId: IslandResidentId;
    jobId: SharedJobId;
    target: SharedTarget;
    visualKey: string;
    source: { kind: 'tray' } | { kind: 'display'; displayId: SharedDisplayId; expectedDisplayKey: string };
    destination: SharedDestination;
    preparedAt: number;
    preparedRevision: number;
}
export type SharedRequest = SharedRequestBase & ({ status: 'prepared' } | {
    status: 'result-seen'; result: SharedVisibleResult; receiptId: string; completedAt: number;
    memoryKey: string; memoryOutcome: SharedMemoryOutcome;
});
export interface IslandSharedMemoriesState {
    version: 1;
    displays: Partial<Record<SharedDisplayId, SharedDisplay>>;
    activeRequest?: SharedRequest;
    memories: SharedMemory[];
    nextMemoryOrder: number;
}
export type IslandSharedMemoriesAction =
    | { type: 'place-display'; displayId: SharedDisplayId; target: SharedTargetRef; position: IslandPosition;
        rotation: number; expectedDisplayKey: string | null }
    | { type: 'remove-display'; displayId: SharedDisplayId; expectedDisplayKey: string }
    | { type: 'arrange-display'; displayId: SharedDisplayId; expectedDisplayKey: string }
    | { type: 'prepare-request'; requestId: string; residentId: IslandResidentId; jobId: SharedJobId;
        target: SharedTargetRef; destination: SharedDestination; expectedRequestId: string | null }
    | { type: 'complete-request'; requestId: string; targetKey: string; visualKey: string;
        destinationKey: string; result: SharedVisibleResult }
    | { type: 'cancel-request'; requestId: string }
    | { type: 'remember-result'; requestId: string }
    | { type: 'remove-memory'; memoryKey: string }
    | { type: 'start-from-work'; target: SharedTargetRef };
export type IslandSharedMemoriesConflictCode = 'invalid-state' | 'invalid-action' | 'locked' | 'target-missing'
    | 'target-changed' | 'empty-work' | 'display-collision' | 'request-busy' | 'request-missing' | 'result-unavailable' | 'first-fact-missing';
export class IslandSharedMemoriesConflict extends Error {
    constructor(public readonly code: IslandSharedMemoriesConflictCode, message: string) {
        super(message); this.name = 'IslandSharedMemoriesConflict';
    }
}
const conflict = (code: IslandSharedMemoriesConflictCode, message = 'しまの きろくを よみなおしてね'): never => {
    throw new IslandSharedMemoriesConflict(code, message);
};
const record = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === 'object' && !Array.isArray(v));
const keys = (v: Record<string, unknown>, allowed: readonly string[]) => Object.keys(v).every(k => allowed.includes(k));
const member = <T extends string>(all: readonly T[], v: unknown): v is T => all.some(x => x === v);
const integer = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min && v <= max;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 20000;
const nullableKey = (v: unknown): v is string | null => v === null || text(v);
const validName = (v: unknown) => { try { return normalizeIslandExperienceName(v) === v; } catch { return false; } };
const position = (v: unknown): v is IslandPosition => record(v) && keys(v, ['x', 'z']) && finite(v.x) && finite(v.z);
const copyPosition = (v: IslandPosition): IslandPosition => ({ x: v.x || 0, z: v.z || 0 });
const clone = <T>(v: T): T => structuredClone(v);

function savedDisplayKey(value: unknown): boolean {
    if (!text(value)) return false;
    try {
        const parsed: unknown = JSON.parse(value);
        return record(parsed) && keys(parsed, ['targetKey', 'position', 'rotation', 'arrangement', 'placedAt'])
            && text(parsed.targetKey) && position(parsed.position) && finite(parsed.rotation)
            && member(['plain', 'petal-ring'], parsed.arrangement) && integer(parsed.placedAt)
            && value === JSON.stringify({ targetKey: parsed.targetKey, position: copyPosition(parsed.position), rotation: parsed.rotation || 0,
                arrangement: parsed.arrangement, placedAt: parsed.placedAt });
    } catch { return false; }
}
function validVisualKey(target: SharedTarget, value: unknown): boolean {
    if (!text(value)) return false;
    try {
        const tuple = JSON.parse(value);
        return Array.isArray(tuple) && tuple.length === 2 && tuple[0] === target.targetKey
            && (target.kind === 'work' ? tuple[1] === null : integer(tuple[1], 0, 63)) && value === JSON.stringify(tuple);
    } catch { return false; }
}

export const sharedRequestIdentity = (profileId: string, uuid: string) => JSON.stringify([`${SHARED_NAMESPACE}:request`, profileId, uuid]);
export const sharedOperationIdentity = (profileId: string, revision: number) => JSON.stringify([`${SHARED_NAMESPACE}:operation`, profileId, revision]);
export const sharedMemoryIdentity = (profileId: string, residentId: IslandResidentId, jobId: SharedJobId, targetKey: string) =>
    JSON.stringify([`${SHARED_NAMESPACE}:memory`, profileId, residentId, jobId, targetKey]);
export const sharedFirstMemoryIdentity = (memoryKey: string) => JSON.stringify([`${SHARED_NAMESPACE}:first-memory`, memoryKey]);
export function sharedWorkCaptureKey(profileId: string, workId: WorkshopWorkId, work: { capturedAt: number; name: string; layout: WorkshopLayout }) {
    return JSON.stringify([`${SHARED_NAMESPACE}:work-capture`, profileId, workId, work.capturedAt, work.name, workshopLayoutKey(work.layout)]);
}
export const sharedDisplayKey = (display?: SharedDisplay | null) => display ? JSON.stringify({ targetKey: display.target.targetKey,
    position: copyPosition(display.position), rotation: display.rotation || 0, arrangement: display.arrangement, placedAt: display.placedAt }) : null;
export const sharedDestinationKey = (destination: SharedDestination) => JSON.stringify({ displayId: destination.displayId,
    position: copyPosition(destination.position), rotation: destination.rotation || 0, expectedDisplayKey: destination.expectedDisplayKey });

function validRequestId(profileId: string, value: unknown) {
    if (!text(value)) return false;
    try {
        const tuple = JSON.parse(value);
        return Array.isArray(tuple) && tuple.length === 3 && tuple[0] === `${SHARED_NAMESPACE}:request` && tuple[1] === profileId
            && typeof tuple[2] === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(tuple[2]) && value === JSON.stringify(tuple);
    } catch { return false; }
}
function validOperationId(profileId: string, value: unknown) {
    if (!text(value)) return false;
    try { const tuple = JSON.parse(value); return Array.isArray(tuple) && tuple.length === 3 && integer(tuple[2]) && value === sharedOperationIdentity(profileId, tuple[2]); }
    catch { return false; }
}
export function hasValidSharedTarget(profileId: string, value: unknown): value is SharedTarget {
    if (!record(value)) return false;
    if (value.kind === 'specimen') return keys(value, ['kind', 'targetKey', 'specimenId']) && member(WORKSHOP_SPECIMEN_IDS, value.specimenId)
        && value.targetKey === workshopSpecimenIdentity(profileId, value.specimenId);
    return value.kind === 'work' && keys(value, ['kind', 'targetKey', 'sourceWorkId', 'capturedAt', 'name', 'layout'])
        && member(WORKSHOP_WORK_IDS, value.sourceWorkId) && integer(value.capturedAt) && validName(value.name)
        && hasValidWorkshopLayout(value.layout) && WORKSHOP_PART_IDS.some(id => value.layout && (value.layout as WorkshopLayout).parts[id].assembled && (value.layout as WorkshopLayout).parts[id].position)
        && value.targetKey === sharedWorkCaptureKey(profileId, value.sourceWorkId, value as unknown as SharedTarget & { kind: 'work' });
}
function validResult(value: unknown): value is SharedVisibleResult {
    if (!record(value)) return false;
    return value.kind === 'placed' && keys(value, ['kind'])
        || value.kind === 'petals-arranged' && keys(value, ['kind', 'count']) && value.count === 3
        || value.kind === 'illuminated' && keys(value, ['kind', 'effect', 'partId']) && member(['shadow', 'transmit'], value.effect)
            && (value.partId === undefined || member(WORKSHOP_PART_IDS, value.partId));
}
function validDestination(value: unknown): value is SharedDestination {
    return record(value) && keys(value, ['displayId', 'position', 'rotation', 'expectedDisplayKey']) && member(SHARED_DISPLAY_IDS, value.displayId)
        && position(value.position) && finite(value.rotation) && nullableKey(value.expectedDisplayKey);
}
function validDisplay(profileId: string, value: unknown): value is SharedDisplay {
    return record(value) && keys(value, ['target', 'position', 'rotation', 'arrangement', 'placedAt'])
        && hasValidSharedTarget(profileId, value.target) && position(value.position) && finite(value.rotation)
        && member(['plain', 'petal-ring'], value.arrangement) && integer(value.placedAt);
}
function correctJobResult(jobId: SharedJobId, result: SharedVisibleResult) {
    return result.kind === ({ carry: 'placed', gather: 'petals-arranged', illuminate: 'illuminated' } as const)[jobId];
}
export function sharedIlluminationResult(target: SharedTarget, cleanedMask = 0, partId?: WorkshopPartId): SharedVisibleResult {
    if (target.kind === 'specimen') {
        if (partId !== undefined) return conflict('result-unavailable');
        return { kind: 'illuminated', effect: target.specimenId === 'seaglass' && cleanedMask === 63 ? 'transmit' : 'shadow' };
    }
    const selected = partId ?? (target.layout.parts.wheel.assembled && target.layout.parts.wheel.position ? 'wheel'
        : WORKSHOP_PART_IDS.find(id => target.layout.parts[id].assembled && target.layout.parts[id].position));
    if (!selected || !target.layout.parts[selected].assembled || !target.layout.parts[selected].position) return conflict('result-unavailable');
    return { kind: 'illuminated', effect: selected === 'wheel' ? 'transmit' : 'shadow', partId: selected };
}
export function hasValidSharedMemory(profileId: string, value: unknown): value is SharedMemory {
    if (!record(value) || !keys(value, ['memoryKey', 'residentId', 'jobId', 'target', 'islandName', 'residentName', 'targetName', 'result', 'firstAt', 'firstOrder', 'specimenSnapshot'])
        || !member(ISLAND_RESIDENT_IDS, value.residentId) || !member(SHARED_JOB_IDS, value.jobId)
        || SHARED_RESIDENT_JOBS[value.residentId] !== value.jobId || !hasValidSharedTarget(profileId, value.target)
        || value.memoryKey !== sharedMemoryIdentity(profileId, value.residentId, value.jobId, value.target.targetKey)
        || ![value.islandName, value.residentName, value.targetName].every(validName) || !validResult(value.result)
        || !correctJobResult(value.jobId, value.result) || !integer(value.firstAt) || !integer(value.firstOrder, 1)) return false;
    const snapshot = value.specimenSnapshot;
    if (value.target.kind === 'specimen') {
        const definition = WORKSHOP_SPECIMENS[value.target.specimenId];
        if (!record(snapshot) || !keys(snapshot, ['cleanedMask', 'knownResults']) || !integer(snapshot.cleanedMask, 0, 63)
            || !Array.isArray(snapshot.knownResults) || snapshot.knownResults.length > 3
            || !snapshot.knownResults.every(result => member(['clean', definition.lamp, definition.water], result))
            || new Set(snapshot.knownResults).size !== snapshot.knownResults.length
            || snapshot.knownResults.some(result => ['clean', 'transmit'].includes(result) && snapshot.cleanedMask !== 63)) return false;
    } else if (snapshot !== undefined) return false;
    if (value.result.kind !== 'illuminated') return true;
    try { return JSON.stringify(value.result) === JSON.stringify(sharedIlluminationResult(value.target, (snapshot as SharedMemory['specimenSnapshot'])?.cleanedMask, value.result.partId)); }
    catch { return false; }
}
function validRequest(profileId: string, value: unknown): value is SharedRequest {
    if (!record(value) || !keys(value, ['requestId', 'residentId', 'jobId', 'target', 'visualKey', 'source', 'destination', 'preparedAt', 'preparedRevision',
        'status', 'result', 'receiptId', 'completedAt', 'memoryKey', 'memoryOutcome']) || !validRequestId(profileId, value.requestId)
        || !member(ISLAND_RESIDENT_IDS, value.residentId) || !member(SHARED_JOB_IDS, value.jobId) || SHARED_RESIDENT_JOBS[value.residentId] !== value.jobId
        || !hasValidSharedTarget(profileId, value.target) || !validVisualKey(value.target, value.visualKey) || !validDestination(value.destination)
        || (value.destination.expectedDisplayKey !== null && !savedDisplayKey(value.destination.expectedDisplayKey))
        || !integer(value.preparedAt) || !integer(value.preparedRevision) || !record(value.source)) return false;
    const source = value.source;
    if (!(source.kind === 'tray' && keys(source, ['kind']) || source.kind === 'display' && keys(source, ['kind', 'displayId', 'expectedDisplayKey'])
        && member(SHARED_DISPLAY_IDS, source.displayId) && savedDisplayKey(source.expectedDisplayKey))) return false;
    if (value.jobId !== 'carry' && (source.kind !== 'display' || source.displayId !== value.destination.displayId
        || value.destination.expectedDisplayKey !== source.expectedDisplayKey)) return false;
    if (value.status === 'prepared') return ['result', 'receiptId', 'completedAt', 'memoryKey', 'memoryOutcome'].every(key => value[key] === undefined);
    if (!(value.status === 'result-seen' && validResult(value.result) && correctJobResult(value.jobId, value.result)
        && validOperationId(profileId, value.receiptId) && integer(value.completedAt)
        && value.memoryKey === sharedMemoryIdentity(profileId, value.residentId, value.jobId, value.target.targetKey)
        && member(['stored', 'already-stored', 'not-stored-full'], value.memoryOutcome))) return false;
    if (value.result.kind !== 'illuminated') return true;
    try {
        const mask = JSON.parse(value.visualKey as string)[1] as number | null;
        return JSON.stringify(canonicalResult(value.result)) === JSON.stringify(sharedIlluminationResult(value.target, mask ?? 0, value.result.partId));
    } catch { return false; }
}
export function hasValidIslandSharedMemories(island: Pick<IslandRecord, 'profileId' | 'sharedMemories'>): boolean {
    const state: unknown = island.sharedMemories;
    if (state === undefined) return true;
    if (!text(island.profileId) || !record(state) || !keys(state, ['version', 'displays', 'activeRequest', 'memories', 'nextMemoryOrder']) || state.version !== 1
        || !record(state.displays) || !keys(state.displays, SHARED_DISPLAY_IDS) || !Array.isArray(state.memories)
        || state.memories.length > SHARED_MEMORY_LIMIT || !integer(state.nextMemoryOrder, 1)
        || !Object.values(state.displays).every(display => validDisplay(island.profileId, display))
        || !state.memories.every(memory => hasValidSharedMemory(island.profileId, memory) && memory.firstOrder < (state.nextMemoryOrder as number))
        || new Set(state.memories.map(memory => memory.memoryKey)).size !== state.memories.length
        || new Set(state.memories.map(memory => memory.firstOrder)).size !== state.memories.length
        || (state.activeRequest !== undefined && !validRequest(island.profileId, state.activeRequest))) return false;
    const targets = Object.values(state.displays).map(display => (display as SharedDisplay).target.targetKey);
    return new Set(targets).size === targets.length;
}
export function getIslandSharedMemories(island: Pick<IslandRecord, 'profileId' | 'sharedMemories'>): IslandSharedMemoriesState {
    if (!hasValidIslandSharedMemories(island)) return conflict('invalid-state');
    return island.sharedMemories ? clone(island.sharedMemories) : { version: 1, displays: {}, memories: [], nextMemoryOrder: 1 };
}

function canonicalRef(value: unknown): SharedTargetRef {
    if (record(value)) {
        if (value.kind === 'specimen' && keys(value, ['kind', 'specimenId']) && member(WORKSHOP_SPECIMEN_IDS, value.specimenId)) return { kind: value.kind, specimenId: value.specimenId };
        if (value.kind === 'work' && keys(value, ['kind', 'workId', 'targetKey']) && member(WORKSHOP_WORK_IDS, value.workId) && text(value.targetKey)) return { kind: value.kind, workId: value.workId, targetKey: value.targetKey };
        if (value.kind === 'display' && keys(value, ['kind', 'displayId', 'targetKey']) && member(SHARED_DISPLAY_IDS, value.displayId) && text(value.targetKey)) return { kind: value.kind, displayId: value.displayId, targetKey: value.targetKey };
        if (value.kind === 'memory' && keys(value, ['kind', 'memoryKey']) && text(value.memoryKey)) return { kind: value.kind, memoryKey: value.memoryKey };
    }
    return conflict('invalid-action', 'もういちど えらんでね');
}
const canonicalDestination = (value: SharedDestination): SharedDestination => ({ displayId: value.displayId, position: copyPosition(value.position),
    rotation: value.rotation || 0, expectedDisplayKey: value.expectedDisplayKey });
function canonicalResult(value: SharedVisibleResult): SharedVisibleResult {
    return value.kind === 'placed' ? { kind: 'placed' } : value.kind === 'petals-arranged' ? { kind: value.kind, count: 3 }
        : { kind: value.kind, effect: value.effect, ...(value.partId === undefined ? {} : { partId: value.partId }) };
}
export function canonicalIslandSharedMemoriesAction(value: unknown): IslandSharedMemoriesAction {
    if (record(value)) {
        const type = value.type;
        if (type === 'place-display' && keys(value, ['type', 'displayId', 'target', 'position', 'rotation', 'expectedDisplayKey'])
            && member(SHARED_DISPLAY_IDS, value.displayId) && position(value.position) && finite(value.rotation) && nullableKey(value.expectedDisplayKey)) {
            return { type, displayId: value.displayId, target: canonicalRef(value.target), position: copyPosition(value.position), rotation: value.rotation || 0, expectedDisplayKey: value.expectedDisplayKey };
        }
        if ((type === 'remove-display' || type === 'arrange-display') && keys(value, ['type', 'displayId', 'expectedDisplayKey'])
            && member(SHARED_DISPLAY_IDS, value.displayId) && text(value.expectedDisplayKey)) return { type, displayId: value.displayId, expectedDisplayKey: value.expectedDisplayKey };
        if (type === 'prepare-request' && keys(value, ['type', 'requestId', 'residentId', 'jobId', 'target', 'destination', 'expectedRequestId'])
            && text(value.requestId) && member(ISLAND_RESIDENT_IDS, value.residentId) && member(SHARED_JOB_IDS, value.jobId)
            && validDestination(value.destination) && nullableKey(value.expectedRequestId)) return { type, requestId: value.requestId, residentId: value.residentId,
                jobId: value.jobId, target: canonicalRef(value.target), destination: canonicalDestination(value.destination), expectedRequestId: value.expectedRequestId };
        if (type === 'complete-request' && keys(value, ['type', 'requestId', 'targetKey', 'visualKey', 'destinationKey', 'result'])
            && text(value.requestId) && text(value.targetKey) && text(value.visualKey) && text(value.destinationKey) && validResult(value.result)) {
            return { type, requestId: value.requestId, targetKey: value.targetKey, visualKey: value.visualKey, destinationKey: value.destinationKey, result: canonicalResult(value.result) };
        }
        if ((type === 'cancel-request' || type === 'remember-result') && keys(value, ['type', 'requestId']) && text(value.requestId)) return { type, requestId: value.requestId };
        if (type === 'remove-memory' && keys(value, ['type', 'memoryKey']) && text(value.memoryKey)) return { type, memoryKey: value.memoryKey };
        if (type === 'start-from-work' && keys(value, ['type', 'target'])) return { type, target: canonicalRef(value.target) };
    }
    return conflict('invalid-action', 'もういちど えらんでね');
}
export function resolveSharedTarget(island: IslandRecord, ref: SharedTargetRef): SharedTarget {
    const intent = canonicalRef(ref), state = getIslandSharedMemories(island);
    if (intent.kind === 'specimen') return { kind: 'specimen', specimenId: intent.specimenId, targetKey: workshopSpecimenIdentity(island.profileId, intent.specimenId) };
    if (intent.kind === 'work') {
        const work = getIslandWorkshop(island).works[intent.workId];
        if (!work) return conflict('target-missing', 'この さくひんは まだ のこしていないよ');
        const target: SharedTarget = { kind: 'work', sourceWorkId: intent.workId, targetKey: sharedWorkCaptureKey(island.profileId, intent.workId, work),
            name: work.name, capturedAt: work.capturedAt, layout: normalizeWorkshopLayout(work.layout) };
        if (target.targetKey !== intent.targetKey) return conflict('target-changed', 'いまの さくひんを もういちど えらんでね');
        if (!hasValidSharedTarget(island.profileId, target)) return conflict('empty-work', 'ぶひんを おいたら かざれるよ');
        return target;
    }
    const target = intent.kind === 'display' ? state.displays[intent.displayId]?.target : state.memories.find(memory => memory.memoryKey === intent.memoryKey)?.target;
    if (!target) return conflict('target-missing', 'かざる ものを えらんでね');
    if (intent.kind === 'display' && target.targetKey !== intent.targetKey) return conflict('target-changed');
    return clone(target);
}
export function sharedTargetVisualKey(island: IslandRecord, target: SharedTarget): string {
    if (!hasValidSharedTarget(island.profileId, target)) return conflict('invalid-state');
    return JSON.stringify([target.targetKey, target.kind === 'specimen' ? getIslandWorkshop(island).specimens[target.specimenId].cleanedMask : null]);
}
export function sharedTargetName(island: IslandRecord, target: SharedTarget): string {
    return target.kind === 'work' ? target.name : getWorkshopSpecimenName(getIslandWorkshop(island), target.specimenId);
}
export const isSharedResidentAvailable = (island: IslandRecord, residentId: IslandResidentId) => island.completedSets >= 1
    && (residentId !== 'fox' || island.completedSets >= 4 && isIslandHabitatUnlocked(island, 'waterside'));

export function isValidSharedDisplayPlacement(island: IslandRecord, displayId: SharedDisplayId, target: SharedTarget, point: IslandPosition): boolean {
    if (!position(point) || !member(SHARED_DISPLAY_IDS, displayId) || !hasValidSharedTarget(island.profileId, target)) return false;
    const radius = SHARED_DISPLAY_RADII[target.kind];
    if (!getIslandLands(getIslandLandAccess(island)).some(land => ((point.x - land.x) / (land.radiusX - radius)) ** 2
        + ((point.z - land.z) / (land.radiusZ - radius)) ** 2 <= 1)) return false;
    if (ISLAND_RESERVED_AREAS.some(area => Math.hypot(point.x - area.x, point.z - area.z) < radius + area.radius)) return false;
    if (island.items.some(item => item.position && Math.hypot(point.x - item.position.x, point.z - item.position.z) < radius + ISLAND_ITEMS[item.kind].radius + .08)) return false;
    return sharedDisplayObstacles(island).every(other => other.displayId === displayId
        || island.sharedMemories?.displays[other.displayId]?.target.targetKey === target.targetKey
        || Math.hypot(point.x - other.x, point.z - other.z) >= radius + other.radius + .08);
}
function expectDisplay(state: IslandSharedMemoriesState, displayId: SharedDisplayId, expectedKey: string | null) {
    if (sharedDisplayKey(state.displays[displayId]) !== expectedKey) return conflict('target-changed', 'いまの かざりを もういちど えらんでね');
}
function place(island: IslandRecord, state: IslandSharedMemoriesState, destination: SharedDestination, target: SharedTarget, now: number) {
    expectDisplay(state, destination.displayId, destination.expectedDisplayKey);
    if (!isValidSharedDisplayPlacement({ ...island, sharedMemories: state }, destination.displayId, target, destination.position)) {
        return conflict('display-collision', 'ここは ぶつかるよ。ばしょを かえてみよう');
    }
    const existing = Object.values(state.displays).find(display => display?.target.targetKey === target.targetKey);
    for (const id of SHARED_DISPLAY_IDS) if (state.displays[id]?.target.targetKey === target.targetKey) delete state.displays[id];
    state.displays[destination.displayId] = { target: clone(target), position: copyPosition(destination.position), rotation: destination.rotation,
        arrangement: existing?.arrangement ?? 'plain', placedAt: now };
}
function validateFirstFact(island: IslandRecord, request: SharedRequest, fact: SharedMemory) {
    const key = sharedMemoryIdentity(island.profileId, request.residentId, request.jobId, request.target.targetKey);
    if (!hasValidSharedMemory(island.profileId, fact) || fact.memoryKey !== key || fact.target.targetKey !== request.target.targetKey
        || fact.firstOrder >= getIslandSharedMemories(island).nextMemoryOrder) return conflict('invalid-state');
}
function storeMemory(state: IslandSharedMemoriesState, memory: SharedMemory): SharedMemoryOutcome {
    if (state.memories.some(entry => entry.memoryKey === memory.memoryKey)) return 'already-stored';
    if (state.memories.length >= SHARED_MEMORY_LIMIT) return 'not-stored-full';
    state.memories.push(clone(memory)); state.memories.sort((a, b) => a.firstOrder - b.firstOrder);
    return 'stored';
}
export interface SharedMemoriesReduction { island: IslandRecord; firstFact?: SharedMemory }

/** firstFact is loaded/validated by the repository, never part of a client action. No arbitrary state replacement. */
export function reduceIslandSharedMemories(island: IslandRecord, action: IslandSharedMemoriesAction, now: number,
    context: { firstFact?: SharedMemory; receiptId?: string } = {}): SharedMemoriesReduction {
    const intent = canonicalIslandSharedMemoriesAction(action), state = getIslandSharedMemories(island);
    if (island.completedSets < 1) return conflict('locked', 'ひとくぎり あそんだら ひらくよ');
    if (!integer(now)) return conflict('invalid-state');
    let updated = island, firstFact: SharedMemory | undefined;
    if (intent.type === 'place-display') place(island, state, intent, resolveSharedTarget(island, intent.target), now);
    else if (intent.type === 'remove-display' || intent.type === 'arrange-display') {
        expectDisplay(state, intent.displayId, intent.expectedDisplayKey);
        if (intent.type === 'remove-display') delete state.displays[intent.displayId];
        else state.displays[intent.displayId]!.arrangement = 'petal-ring';
    } else if (intent.type === 'prepare-request') {
        if (!validRequestId(island.profileId, intent.requestId) || SHARED_RESIDENT_JOBS[intent.residentId] !== intent.jobId
            || !isSharedResidentAvailable(island, intent.residentId)) return conflict('result-unavailable', 'いま いる なかまを えらんでね');
        if ((state.activeRequest?.requestId ?? null) !== intent.expectedRequestId || state.activeRequest?.status === 'prepared'
            || state.activeRequest?.requestId === intent.requestId) return conflict('request-busy', 'いまの おねがいを かたづけてね');
        const target = resolveSharedTarget(island, intent.target), destination = intent.destination;
        expectDisplay(state, destination.displayId, destination.expectedDisplayKey);
        if (!isValidSharedDisplayPlacement(island, destination.displayId, target, destination.position)) return conflict('display-collision', 'ばしょを かえてみよう');
        const sourceId = SHARED_DISPLAY_IDS.find(id => state.displays[id]?.target.targetKey === target.targetKey);
        if (intent.jobId !== 'carry') {
            const display = state.displays[destination.displayId];
            if (!display || display.target.targetKey !== target.targetKey || JSON.stringify(display.position) !== JSON.stringify(destination.position)
                || display.rotation !== destination.rotation) return conflict('target-changed', 'さきに この ものを かざってね');
        }
        state.activeRequest = { requestId: intent.requestId, residentId: intent.residentId, jobId: intent.jobId, target,
            visualKey: sharedTargetVisualKey(island, target), source: sourceId ? { kind: 'display', displayId: sourceId, expectedDisplayKey: sharedDisplayKey(state.displays[sourceId])! } : { kind: 'tray' },
            destination: clone(destination), status: 'prepared', preparedAt: now, preparedRevision: island.revision };
    } else if (intent.type === 'cancel-request') {
        if (state.activeRequest?.requestId !== intent.requestId) return conflict('request-missing');
        delete state.activeRequest;
    } else if (intent.type === 'remove-memory') {
        if (!state.memories.some(memory => memory.memoryKey === intent.memoryKey)) return conflict('target-missing');
        state.memories = state.memories.filter(memory => memory.memoryKey !== intent.memoryKey);
    } else if (intent.type === 'start-from-work') {
        const target = resolveSharedTarget(island, intent.target);
        if (target.kind !== 'work') return conflict('invalid-action');
        const workshop = getIslandWorkshop(island);
        workshop.draftCheckpoint = { draft: createWorkshopDraft(target.layout), baseLayout: normalizeWorkshopLayout(target.layout) };
        updated = { ...island, workshop };
    } else {
        const request = state.activeRequest;
        if (!request || request.requestId !== intent.requestId) return conflict('request-missing');
        if (intent.type === 'remember-result') {
            if (request.status !== 'result-seen' || !context.firstFact) return conflict('first-fact-missing');
            validateFirstFact(island, request, context.firstFact);
            request.memoryOutcome = storeMemory(state, context.firstFact);
        } else {
            if (request.target.targetKey !== intent.targetKey || request.visualKey !== intent.visualKey || sharedDestinationKey(request.destination) !== intent.destinationKey
                || !correctJobResult(request.jobId, intent.result)) return conflict('target-changed');
            if (request.status === 'result-seen') {
                if (JSON.stringify(request.result) !== JSON.stringify(intent.result)) return conflict('result-unavailable');
                return { island };
            }
            if (sharedTargetVisualKey(island, request.target) !== request.visualKey || !isSharedResidentAvailable(island, request.residentId)) return conflict('target-changed');
            expectDisplay(state, request.destination.displayId, request.destination.expectedDisplayKey);
            if (request.source.kind === 'display') expectDisplay(state, request.source.displayId, request.source.expectedDisplayKey);
            if (!isValidSharedDisplayPlacement(island, request.destination.displayId, request.target, request.destination.position)) return conflict('display-collision');
            if (request.jobId !== 'carry' && state.displays[request.destination.displayId]?.target.targetKey !== request.target.targetKey) return conflict('target-changed');
            const workshop = getIslandWorkshop(island), specimen = request.target.kind === 'specimen' ? workshop.specimens[request.target.specimenId] : undefined;
            if (intent.result.kind === 'illuminated' && JSON.stringify(intent.result) !== JSON.stringify(sharedIlluminationResult(request.target, specimen?.cleanedMask, intent.result.partId))) return conflict('result-unavailable');
            if (request.jobId === 'carry') place(island, state, request.destination, request.target, now);
            else if (request.jobId === 'gather') state.displays[request.destination.displayId]!.arrangement = 'petal-ring';
            let memory = context.firstFact;
            if (memory) validateFirstFact(island, request, memory);
            else {
                if (state.memories.some(entry => entry.memoryKey === sharedMemoryIdentity(island.profileId, request.residentId, request.jobId, request.target.targetKey))) {
                    return conflict('first-fact-missing');
                }
                if (state.nextMemoryOrder === Number.MAX_SAFE_INTEGER) return conflict('invalid-state');
                const experience = getIslandExperience(island);
                memory = { memoryKey: sharedMemoryIdentity(island.profileId, request.residentId, request.jobId, request.target.targetKey),
                    residentId: request.residentId, jobId: request.jobId, target: clone(request.target), islandName: experience.islandName,
                    residentName: experience.residents[request.residentId].name, targetName: sharedTargetName(island, request.target),
                    result: clone(intent.result), firstAt: now, firstOrder: state.nextMemoryOrder++,
                    ...(specimen ? { specimenSnapshot: { cleanedMask: specimen.cleanedMask, knownResults: specimen.observations.map(observation => observation.result) } } : {}) };
                firstFact = clone(memory);
            }
            if (!context.receiptId || !validOperationId(island.profileId, context.receiptId)) return conflict('invalid-state');
            state.activeRequest = { ...request, status: 'result-seen', result: clone(intent.result), receiptId: context.receiptId,
                completedAt: now, memoryKey: memory.memoryKey, memoryOutcome: storeMemory(state, memory) };
        }
    }
    updated = { ...updated, sharedMemories: state };
    if (!hasValidIslandSharedMemories(updated)) return conflict('invalid-state');
    return { island: updated, ...(firstFact ? { firstFact } : {}) };
}
