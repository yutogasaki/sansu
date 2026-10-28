import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { landBounds } from '../../../src/domain/growingIsland/space';
import { terrainRevision } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { shapeOf, type PlaceShape, type ShapeState } from './directional-field';
import { replacePlace, type Safety } from './model';

// This is a trial data contract, not a production save version. A different
// geometry recipe must not silently reinterpret a saved editable place.
export const LEGACY_TRIAL_PLACE_RECIPE = 'place-outline-platform-v2:H:fixed-two-shear-grid-v1:fixed-core-base-v1:fixed-bilinear-interior-ramp-v1:flat-owner-v1';
export const TRIAL_PLACE_RECIPE = 'place-outline-platform-v3:H:fixed-two-shear-grid-v1:fixed-core-base-v1:fixed-bilinear-interior-ramp-v1:directional-ramp-v1:flat-owner-v1';
export const TRIAL_PLACE_HISTORY_LIMIT = 64;
export interface TrialPlaceEntry { before?: PlaceShape; after?: PlaceShape }
export interface TrialPlaceHistory {
    version: 1;
    recipe: typeof TRIAL_PLACE_RECIPE;
    undo: TrialPlaceEntry[];
    redo: TrialPlaceEntry[];
}
export type PersistentPlaceState = GrowingState & ShapeState & { trialPlaceHistory?: TrialPlaceHistory };
export interface TrialPlaceCommand {
    type: 'place-outline';
    action: 'apply' | 'undo' | 'redo';
    shape?: PlaceShape;
    safety: Safety;
    expectedPlaceRevision: string;
}

const invalid = (): never => { throw Error('この場所の保存をよみこめなかったよ。対応した試作の版でひらいてね。'); };
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const keysWithin = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).every(key => keys.includes(key));
function assertShape(value: unknown, state: GrowingState, legacy = false): asserts value is PlaceShape | undefined {
    if (value === undefined) return;
    const keys = ['center', 'radius', 'height', 'entrance', 'flatRadius', ...(legacy ? [] : ['rampDirection'])];
    if (!object(value) || !keysWithin(value, keys)
        || !object(value.center) || !keysWithin(value.center, ['x', 'z'])) invalid();
    const shape = value as unknown as PlaceShape, bounds = landBounds(state);
    if (![shape.center.x, shape.center.z, shape.radius, shape.height, shape.entrance].every(Number.isFinite)
        || shape.center.x < bounds.minX || shape.center.x > bounds.maxX || shape.center.z < 0 || shape.center.z >= bounds.depth
        || shape.radius < 1 || shape.radius > 3 || shape.height < -.6 || shape.height > 1.4
        || shape.entrance < .3 || shape.entrance > 2.4
        || shape.flatRadius !== undefined && (!Number.isFinite(shape.flatRadius) || shape.flatRadius < .5 || shape.flatRadius > 2)
        || Object.hasOwn(shape, 'rampDirection') && (!['north', 'west', 'east', 'south'].includes(shape.rampDirection!) || shape.height < 0)) invalid();
}
const normalizedShape = (shape: PlaceShape | undefined): PlaceShape | undefined => shape && ({
    center: { x: shape.center.x, z: shape.center.z }, radius: shape.radius, height: shape.height, entrance: shape.entrance,
    ...(shape.flatRadius === undefined ? {} : { flatRadius: shape.flatRadius }),
    ...(shape.rampDirection === undefined ? {} : { rampDirection: shape.rampDirection }),
});
const sameShape = (a: PlaceShape | undefined, b: PlaceShape | undefined) => JSON.stringify(normalizedShape(a)) === JSON.stringify(normalizedShape(b));
export const trialHistoryOf = (state: GrowingState): TrialPlaceHistory | undefined => (state as PersistentPlaceState).trialPlaceHistory;

/** Validate structure and both history chains, without applying historical
 * shapes to today's furniture. Undo/Redo must re-check that live safety later. */
function validateState(state: GrowingState, legacy: boolean): void {
    const current = shapeOf(state), history = trialHistoryOf(state);
    assertShape(current, state, legacy);
    if (history === undefined) { if (current !== undefined || legacy) invalid(); return; }
    if (!object(history) || !keysWithin(history, ['version', 'recipe', 'undo', 'redo'])
        || history.version !== 1 || history.recipe !== (legacy ? LEGACY_TRIAL_PLACE_RECIPE : TRIAL_PLACE_RECIPE)
        || !Array.isArray(history.undo) || !Array.isArray(history.redo)
        || history.undo.length + history.redo.length > TRIAL_PLACE_HISTORY_LIMIT) invalid();
    for (const list of [history.undo, history.redo]) for (const entry of list) {
        if (!object(entry) || !keysWithin(entry, ['before', 'after'])) invalid();
        assertShape(entry.before, state, legacy); assertShape(entry.after, state, legacy);
        if (sameShape(entry.before, entry.after)) invalid();
    }
    for (const [list, from, to] of [[history.undo, 'after', 'before'], [history.redo, 'before', 'after']] as const) {
        let cursor = current;
        for (let i = list.length - 1; i >= 0; i--) {
            const entry = list[i];
            if (!sameShape(cursor, entry[from])) invalid();
            cursor = entry[to];
        }
    }
}

export function validateTrialPlaceState(state: GrowingState): void { validateState(state, false); }

/** V2 allowed only the original five shape keys. In particular even an explicit
 * north direction is rejected here, so no v2-tagged direction is silently lost.
 * This is an input validator for the opener's atomic migration, not a reader. */
export function validateLegacyTrialPlaceState(state: GrowingState): void { validateState(state, true); }

/** A repeat of the same geometry with a different undo cursor is still stale. */
export function placeEditingRevision(state: GrowingState): string {
    return JSON.stringify([TRIAL_PLACE_RECIPE, terrainRevision(state), normalizedShape(shapeOf(state)) ?? null, trialHistoryOf(state) ?? null]);
}

/** Called on applyIntent's clone. Only the place and its history change; the
 * repository commits them atomically with its revision and intent identity. */
export function applyTrialPlaceCommand(state: GrowingState, command: TrialPlaceCommand): boolean {
    validateTrialPlaceState(state);
    if (!command || command.type !== 'place-outline' || !['apply', 'undo', 'redo'].includes(command.action)) invalid();
    if (command.expectedPlaceRevision !== placeEditingRevision(state)) throw Error('場所のかたちがかわったよ。いまの島を見てえらびなおそう。');
    const guard = command.safety;
    if (!guard || !Array.isArray(guard.actors) || guard.actors.length > 4096
        || guard.actors.some(cell => !cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.z))
        || !Array.isArray(guard.occupiedPlaceTargets) || guard.occupiedPlaceTargets.length > 32)
        throw Error('なかまの足もとをたしかめてね。');
    assertShape(command.shape, state);
    const history: TrialPlaceHistory = structuredClone(trialHistoryOf(state) ?? { version: 1, recipe: TRIAL_PLACE_RECIPE, undo: [], redo: [] });
    const before = normalizedShape(shapeOf(state));
    const entry = command.action === 'apply' ? { before, after: normalizedShape(command.shape) }
        : (command.action === 'undo' ? history.undo : history.redo).at(-1);
    if (!entry || sameShape(entry.before, entry.after)) return false;
    const next = replacePlace(state, command.action === 'undo' ? entry.before : entry.after, guard);
    if (command.action === 'apply') { history.undo = [...history.undo, entry].slice(-TRIAL_PLACE_HISTORY_LIMIT); history.redo = []; }
    else if (command.action === 'undo') { history.undo.pop(); history.redo.push(entry); }
    else { history.redo.pop(); history.undo.push(entry); }
    const candidate: PersistentPlaceState = { ...next, trialPlaceHistory: history };
    validateTrialPlaceState(candidate);
    const target = state as PersistentPlaceState;
    if (candidate.trialPlace === undefined) delete target.trialPlace;
    else target.trialPlace = candidate.trialPlace;
    target.trialPlaceHistory = history;
    return true;
}
