import { terrainRevision, editableIslandWorld } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainFootingError, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { landBounds, walkableCells, reachableFromHome } from '../../../src/domain/growingIsland/space';
import type { GrowingState } from '../../../src/domain/growingIsland/types';
import { reachablePlacePlatform, type Safety } from './model';
import { compositeEnabled, compositeOf, normalizedSet, COMPOSITE_RECIPE, type CompositeState, type PlaceSet, type PlaceSlot } from './composite-field';
import type { PlaceShape } from './directional-field';
import { assemblyEnabled, coastSetEnabled, connectivityGuardEnabled } from './assembly-mode';

interface CompositeEntry { before: PlaceSet; after: PlaceSet }
export interface CompositeHistory { version: 1; undo: CompositeEntry[]; redo: CompositeEntry[] }
export type CompositeGrowingState = GrowingState & CompositeState & { trialPlaceSetHistory?: CompositeHistory };
export interface CompositeCommand { type: 'place-set'; action: 'apply' | 'undo' | 'redo'; slot: PlaceSlot;
    shape?: PlaceShape; safety: Safety; expectedPlaceRevision: string }
export const compositeHistoryOf = (state: object) => (state as CompositeGrowingState).trialPlaceSetHistory;
const same = (a: PlaceSet, b: PlaceSet) => JSON.stringify(normalizedSet(a)) === JSON.stringify(normalizedSet(b));
const invalid = (): never => { throw Error('2つの場所の比較データが正しくありません。再読込してください。'); };
function assertSet(set: PlaceSet | undefined, state: GrowingState): asserts set is PlaceSet {
    if (!set || typeof set !== 'object' || Array.isArray(set) || Object.keys(set).some(key => !['west', 'east', ...(assemblyEnabled() ? ['bay'] : []), ...(coastSetEnabled() ? ['bay2'] : [])].includes(key))) return invalid();
    const b = landBounds(state);
    for (const [slot, shape] of Object.entries(set)) {
        if (!shape || typeof shape !== 'object' || !shape.center || Object.keys(shape).some(key => !['center', 'radius', 'height', 'entrance', 'flatRadius', 'rampDirection', ...(slot.startsWith('bay') ? ['bayDepth'] : [])].includes(key))
            || Object.keys(shape.center).some(key => !['x', 'z'].includes(key))
            || ![shape.center.x, shape.center.z, shape.radius, shape.height, shape.entrance].every(Number.isFinite)
            || shape.center.x < b.minX || shape.center.x > b.maxX || shape.center.z < 0 || shape.center.z >= b.depth
            || shape.radius < 1 || shape.radius > 3 || (slot.startsWith('bay') ? shape.height !== -.55 || shape.flatRadius !== undefined || shape.rampDirection !== undefined : shape.height < 0 || shape.height > 1.4) || shape.entrance < .3 || shape.entrance > 2.4
            || shape.flatRadius !== undefined && (!Number.isFinite(shape.flatRadius) || shape.flatRadius < .5 || shape.flatRadius > 2)
            || shape.bayDepth !== undefined && (!Number.isFinite(shape.bayDepth) || shape.bayDepth < .4 || shape.bayDepth > 2.4)
            || shape.rampDirection !== undefined && !['north', 'west', 'east', 'south'].includes(shape.rampDirection)) invalid();
    }
}
export function validateCompositeState(state: GrowingState): void {
    const set = compositeOf(state); assertSet(set, state);
    if ((state as { trialPlace?: unknown }).trialPlace !== undefined) invalid();
    const history = compositeHistoryOf(state);
    if (!history || history.version !== 1 || !Array.isArray(history.undo) || !Array.isArray(history.redo)
        || history.undo.length + history.redo.length > 64) return invalid();
    for (const list of [history.undo, history.redo]) for (const entry of list) {
        if (!entry || typeof entry !== 'object') invalid(); assertSet(entry.before, state); assertSet(entry.after, state);
        if (same(entry.before, entry.after)) invalid();
    }
    for (const [list, from, to] of [[history.undo, 'after', 'before'], [history.redo, 'before', 'after']] as const) {
        let cursor = set;
        for (let i = list.length - 1; i >= 0; i--) { if (!same(cursor, list[i][from])) invalid(); cursor = list[i][to]; }
    }
}
export const compositeEditingRevision = (state: GrowingState) => JSON.stringify([COMPOSITE_RECIPE, terrainRevision(state),
    normalizedSet(compositeOf(state) ?? {}), compositeHistoryOf(state)]);
export function assertCompositeGeometry(state: GrowingState): void {
    const set = compositeOf(state); if (set === undefined) return;
    assertSet(set, state); validateTerrain(state);
    const world = editableIslandWorld(state)!, open = walkableCells(state, world);
    for (const shape of Object.values(set)) if (shape!.height >= 0 && !reachablePlacePlatform(world, open, shape!))
        throw Error('どちらの高台にも登れる道が必要です。入口や場所を変えてね。');
}
export function replaceComposite(state: GrowingState, set: PlaceSet, safety: Safety): CompositeGrowingState {
    assertSet(set, state);
    if (!safety || !Array.isArray(safety.actors) || safety.actors.length > 4096
        || safety.actors.some(cell => !cell || !Number.isFinite(cell.x) || !Number.isFinite(cell.z))
        || !Array.isArray(safety.occupiedPlaceTargets)) invalid();
    if (safety.occupiedPlaceTargets.length) throw Error('なかまが上で遊んでいるよ。おりてから変えよう。');
    const next = { ...state, trialPlaceSet: normalizedSet(set) };
    validateTerrain(next);
    const error = terrainFootingError(state, next, safety.actors); if (error) throw Error(error);
    assertCompositeGeometry(next);
    assertCompositeConnectivity(state, next);
    return next;
}

/** Walkability comes from the actual support graph, before reachability filtering.
 * Submerged sites may disappear; retained reachable sites must still have a route.
 * Baseline islands may contain isolated sites: this guard does not disguise or repair them. */
export function compositeConnectivityLoss(before: GrowingState, after: GrowingState): string[] {
    const a = editableIslandWorld(before), b = editableIslandWorld(after);
    if (!a || !b) throw Error('実際の地面を確認できませんでした。');
    const openBefore = walkableCells(before, a), openAfter = walkableCells(after, b);
    const reachedBefore = reachableFromHome(before, openBefore, a), reachedAfter = reachableFromHome(after, openAfter, b);
    return [...openAfter].filter(id => reachedBefore.has(id) && !reachedAfter.has(id));
}
export function assertCompositeConnectivity(before: GrowingState, after: GrowingState): void {
    if (!connectivityGuardEnabled() || compositeOf(after) === undefined) return;
    if (compositeConnectivityLoss(before, after).length)
        throw Error('このかたちだと、行けなくなる地面があるよ。道を残すか、場所や大きさを変えてね。');
}
export function applyCompositeCommand(state: GrowingState, command: CompositeCommand): boolean {
    if (!compositeEnabled()) throw Error('2つの場所の比較専用画面で操作してください。');
    validateCompositeState(state);
    if (!['apply', 'undo', 'redo'].includes(command.action) || !['west', 'east', ...(assemblyEnabled() ? ['bay'] : []), ...(coastSetEnabled() ? ['bay2'] : [])].includes(command.slot)) invalid();
    if (command.shape !== undefined) assertSet({ [command.slot]: command.shape }, state);
    if (command.expectedPlaceRevision !== compositeEditingRevision(state)) throw Error('場所のかたちがかわったよ。いまの島を見てえらびなおそう。');
    const before = normalizedSet(compositeOf(state)!);
    const history = structuredClone(compositeHistoryOf(state)!);
    const after = { ...before }; if (command.shape) after[command.slot] = command.shape; else delete after[command.slot];
    const entry = command.action === 'apply' ? { before, after: normalizedSet(after) } : (command.action === 'undo' ? history.undo : history.redo).at(-1);
    if (!entry || same(entry.before, entry.after)) return false;
    const next = replaceComposite(state, command.action === 'undo' ? entry.before : entry.after, command.safety);
    if (command.action === 'apply') { history.undo = [...history.undo, entry].slice(-64); history.redo = []; }
    else if (command.action === 'undo') { history.undo.pop(); history.redo.push(entry); }
    else { history.redo.pop(); history.undo.push(entry); }
    const candidate = { ...next, trialPlaceSetHistory: history }; validateCompositeState(candidate);
    const target = state as CompositeGrowingState;
    target.trialPlaceSet = next.trialPlaceSet; target.trialPlaceSetHistory = history;
    return true;
}
