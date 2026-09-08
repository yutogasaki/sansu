import type { IslandRecord } from './types';

export type IslandLearningKeepsakeId = 'first-completion' | 'completed-5' | 'completed-10' | 'completed-20' | 'completed-30'
    | 'completed-50' | 'completed-75' | 'completed-100' | 'completed-150' | 'completed-200' | 'completed-300'
    | 'completed-500' | 'completed-750' | 'completed-1000' | 'certificate-25' | 'certificate-100';
/** Visual kind; it does not impose a one-item display slot. */
export type IslandLearningKeepsakeSlot = 'certificate' | 'trophy';
export interface IslandLearningKeepsakesState {
    version: 1;
    displayed: IslandLearningKeepsakeId[];
}
export type IslandLearningKeepsakeAction =
    | { type: 'display'; keepsakeId: IslandLearningKeepsakeId; displayed: boolean }
    | { type: 'display-earned' };
export const ISLAND_LEARNING_KEEPSAKES = [
    { id: 'first-completion', slot: 'certificate', name: 'はじめの いっぽ', requiredCompletedSets: 1 },
    { id: 'completed-5', slot: 'trophy', name: '5回の がくしゅう', requiredCompletedSets: 5 },
    { id: 'completed-10', slot: 'trophy', name: '10回の がくしゅう', requiredCompletedSets: 10 },
    { id: 'completed-20', slot: 'trophy', name: '20回の がくしゅう', requiredCompletedSets: 20 },
    { id: 'certificate-25', slot: 'certificate', name: '25回の あゆみ', requiredCompletedSets: 25 },
    { id: 'completed-30', slot: 'trophy', name: '30回の がくしゅう', requiredCompletedSets: 30 },
    { id: 'completed-50', slot: 'trophy', name: '50回の がくしゅう', requiredCompletedSets: 50 },
    { id: 'completed-75', slot: 'trophy', name: '75回の がくしゅう', requiredCompletedSets: 75 },
    { id: 'completed-100', slot: 'trophy', name: '100回の がくしゅう', requiredCompletedSets: 100 },
    { id: 'certificate-100', slot: 'certificate', name: '100回の あゆみ', requiredCompletedSets: 100 },
    { id: 'completed-150', slot: 'trophy', name: '150回の がくしゅう', requiredCompletedSets: 150 },
    { id: 'completed-200', slot: 'trophy', name: '200回の がくしゅう', requiredCompletedSets: 200 },
    { id: 'completed-300', slot: 'trophy', name: '300回の がくしゅう', requiredCompletedSets: 300 },
    { id: 'completed-500', slot: 'trophy', name: '500回の がくしゅう', requiredCompletedSets: 500 },
    { id: 'completed-750', slot: 'trophy', name: '750回の がくしゅう', requiredCompletedSets: 750 },
    { id: 'completed-1000', slot: 'trophy', name: '1000回の がくしゅう', requiredCompletedSets: 1000 },
] as const satisfies readonly { id: IslandLearningKeepsakeId; slot: IslandLearningKeepsakeSlot; name: string; requiredCompletedSets: number }[];
export class IslandLearningKeepsakeConflict extends Error {
    constructor(public readonly code: 'invalid-action' | 'invalid-state' | 'not-eligible', message: string) {
        super(message); this.name = 'IslandLearningKeepsakeConflict';
    }
}
type KeepsakeIsland = Pick<IslandRecord, 'learningKeepsakes' | 'completedSets'>;
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const keys = (value: Record<string, unknown>, names: readonly string[]) => Object.keys(value).length === names.length
    && names.every(name => Object.prototype.hasOwnProperty.call(value, name));
const validCount = (value: number) => Number.isSafeInteger(value) && value >= 0;
export function isIslandLearningKeepsakeId(value: unknown): value is IslandLearningKeepsakeId {
    return ISLAND_LEARNING_KEEPSAKES.some(item => item.id === value);
}
/** Eligibility is the person's saved completed sections, never correctness, speed or streaks. */
export function isIslandLearningKeepsakeAvailable(island: Pick<IslandRecord, 'completedSets'>, id: IslandLearningKeepsakeId): boolean {
    const item = ISLAND_LEARNING_KEEPSAKES.find(item => item.id === id);
    return Boolean(item && validCount(island.completedSets) && island.completedSets >= item.requiredCompletedSets);
}
export function canonicalIslandLearningKeepsakeAction(value: unknown): IslandLearningKeepsakeAction {
    if (record(value)) {
        if (value.type === 'display-earned' && keys(value, ['type'])) return { type: 'display-earned' };
        if (value.type === 'display' && keys(value, ['type', 'keepsakeId', 'displayed'])
            && isIslandLearningKeepsakeId(value.keepsakeId) && typeof value.displayed === 'boolean') {
            return { type: 'display', keepsakeId: value.keepsakeId, displayed: value.displayed };
        }
    }
    throw new IslandLearningKeepsakeConflict('invalid-action', 'たなに かざるものを えらびなおしてね');
}
export function hasValidIslandLearningKeepsakes(island: KeepsakeIsland): boolean {
    if (!validCount(island.completedSets)) return false;
    const state = island.learningKeepsakes;
    if (state === undefined) return true;
    if (!record(state) || !keys(state, ['version', 'displayed']) || state.version !== 1 || !Array.isArray(state.displayed)
        || state.displayed.length > ISLAND_LEARNING_KEEPSAKES.length
        || state.displayed.some(id => !isIslandLearningKeepsakeId(id) || !isIslandLearningKeepsakeAvailable(island, id))) return false;
    const canonical = ISLAND_LEARNING_KEEPSAKES.filter(item => state.displayed.includes(item.id)).map(item => item.id);
    return JSON.stringify(state.displayed) === JSON.stringify(canonical);
}
export function getIslandLearningKeepsakes(island: KeepsakeIsland): IslandLearningKeepsakesState {
    if (!hasValidIslandLearningKeepsakes(island)) throw new IslandLearningKeepsakeConflict('invalid-state', 'たなの きろくを たしかめてね');
    return { version: 1, displayed: [...(island.learningKeepsakes?.displayed ?? [])] };
}
export function reduceIslandLearningKeepsakes(island: IslandRecord, action: IslandLearningKeepsakeAction): IslandRecord {
    const intent = canonicalIslandLearningKeepsakeAction(action), state = getIslandLearningKeepsakes(island);
    if (intent.type === 'display-earned') return { ...island, learningKeepsakes: { version: 1,
        displayed: ISLAND_LEARNING_KEEPSAKES.filter(item => isIslandLearningKeepsakeAvailable(island, item.id)).map(item => item.id) } };
    if (intent.displayed && !isIslandLearningKeepsakeAvailable(island, intent.keepsakeId)) {
        throw new IslandLearningKeepsakeConflict('not-eligible', 'がくしゅうを おえると かざれるよ');
    }
    const displayed = new Set(state.displayed);
    if (intent.displayed) displayed.add(intent.keepsakeId); else displayed.delete(intent.keepsakeId);
    return { ...island, learningKeepsakes: { version: 1, displayed: ISLAND_LEARNING_KEEPSAKES.filter(item => displayed.has(item.id)).map(item => item.id) } };
}

export { summarizeIslandLearningKeepsake, type IslandLearningKeepsakeSummary } from './learningKeepsakeSummary';
