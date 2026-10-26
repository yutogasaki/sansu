import { occupiedCells } from '../islandLife/footprint';
import type { ItemKind } from '../islandLife/model';
import { TERRAIN_DRY_LEVEL, TERRAIN_STEP, editableIslandWorld, editableTerracePlan, terracePlanOf, terrainRevision } from './editableTerrainWorld';
import { landscapeRise } from './landscape';
import { baseTerrainHeightAt } from './placeTerrain';
import { legacyIslandWorld } from './legacyWorldDefinition';
import { HOUSE_CELLS, bridgeAnchor, key, landBounds } from './space';
import { OWN_LANDMARKS, type Cell, type GrowingState, type OccupiedPlaceTarget, type TerrainCommand, type TerrainEdit } from './types';
import type { IslandWorld } from './worldDefinition';
import { derivePlaces } from './places';

export const TERRAIN_MIN = -4;
export const TERRAIN_MAX = 12;
export const TERRAIN_HISTORY_LIMIT = 64;
/** Geometry can return to the same shape while undo now refers to a different action. */
export const terrainEditingRevision = (state: GrowingState) => JSON.stringify([
    terrainRevision(state), state.terrain?.undo ?? [], state.terrain?.redo ?? [],
]);
const finiteCell = (cell: Cell) => cell && Number.isFinite(cell.x) && Number.isFinite(cell.z);
const acquired = (state: GrowingState, cell: Cell) => {
    if (!finiteCell(cell) || !Number.isInteger(cell.x) || !Number.isInteger(cell.z)) return false;
    const b = landBounds(state);
    return cell.x >= b.minX && cell.x <= b.maxX && cell.z >= 0 && cell.z < b.depth;
};
const validHeight = (height: number) => Number.isInteger(height) && height >= TERRAIN_MIN && height <= TERRAIN_MAX;
const fail = (text: string): never => { throw new Error(text); };
const writeHeight = (heights: Record<string, number>, cell: Cell, value: number) => {
    if (value === 0) delete heights[key(cell)]; else heights[key(cell)] = value;
};

const validGroup = (group: unknown) => group === undefined || typeof group === 'string' && group.length > 0 && group.length <= 64;

/** The highest step at which this cell lies under the sea (a cove or a pond). */
export function seaLevelAt(state: GrowingState, cell: Cell) {
    const base = baseTerrainHeightAt(state, cell) + landscapeRise(cell);
    for (let level = 0; level >= TERRAIN_MIN; level--) if (base + level * TERRAIN_STEP < TERRAIN_DRY_LEVEL) return level;
    return TERRAIN_MIN;
}
/** Cells whose ground a stroke may not take away: the home, the pier, the bridge and every owner. */
function heldCells(state: GrowingState) {
    const b = landBounds(state), held = new Set<string>([...HOUSE_CELLS.map(key), key({ x: b.maxX - 1, z: b.depth - 1 })]);
    const anchor = bridgeAnchor(state); if (anchor) held.add(key(anchor));
    for (const p of state.plots) if (p.cell) held.add(key(p.cell));
    for (const k of state.keepsakes) if (k.cell) held.add(key(k.cell));
    for (const l of state.landmarks) if (l.cell) (OWN_LANDMARKS.includes(l.kind) ? [l.cell] : occupiedCells({ kind: l.kind as ItemKind, cell: l.cell })).forEach(c => held.add(key(c)));
    return held;
}

/** A corrupt history must never be interpreted as permission to erase another cell. */
export function validateTerrain(state: GrowingState) {
    const terrain = state.terrain;
    if (terrain === undefined) return;
    const invalid = () => fail('しまの かたちを よみこめなかったよ。あたらしい版で ひらいてね。');
    if (!terrain || terrain.version !== 1 || !terrain.heights || typeof terrain.heights !== 'object' || Array.isArray(terrain.heights)
        || !Array.isArray(terrain.undo) || !Array.isArray(terrain.redo)
        || terrain.undo.length + terrain.redo.length > TERRAIN_HISTORY_LIMIT) invalid();
    for (const [id, value] of Object.entries(terrain.heights)) {
        const [x, z] = id.split(',').map(Number), cell = { x, z };
        if (key(cell) !== id || !acquired(state, cell) || !validHeight(value) || value === 0) invalid();
    }
    for (const history of [terrain.undo, terrain.redo]) for (const entry of history) {
        // A single edit is one step; a stroke may move a cell several steps at once.
        if (!entry || !acquired(state, entry.cell) || !validHeight(entry.before) || !validHeight(entry.after) || !validGroup(entry.group)
            || entry.after === entry.before || entry.group === undefined && Math.abs(entry.after - entry.before) !== 1) invalid();
    }
    for (const [history, from, to] of [[terrain.undo, 'after', 'before'], [terrain.redo, 'before', 'after']] as const) {
        const heights = { ...terrain.heights };
        for (const entry of [...history].reverse()) {
            if ((heights[key(entry.cell)] ?? 0) !== entry[from]) invalid();
            writeHeight(heights, entry.cell, entry[to]);
        }
    }
}

function probes(cell: Cell, radius: number): Cell[] {
    return [-radius, -radius / 2, 0, radius / 2, radius].flatMap(x =>
        [-radius, -radius / 2, 0, radius / 2, radius].map(z => ({ x: cell.x + x, z: cell.z + z })));
}

/** Actual floor probes, including the footprint rim, not just the owner's centre. */
function supported(before: IslandWorld, after: IslandWorld, cell: Cell, radius: number, pinned = false): boolean {
    const center = after.floorAt(cell)?.point.y;
    if (center === undefined) return false;
    const oldCenter = before.floorAt(cell)?.point.y;
    return probes(cell, radius).every(point => {
        const old = before.floorAt(point)?.point.y, next = after.floorAt(point)?.point.y;
        if (next === undefined) return false;
        if (pinned) return old !== undefined && Math.abs(next - old) <= .02;
        // Existing hillside slopes are legal; reject newly introduced tilt or a hole.
        return old !== undefined && oldCenter !== undefined
            && Math.abs((next - center) - (old - oldCenter)) <= .13;
    });
}

/** Placement and later edits use the same full native-owner footprint contract. */
export function terrainOwnerSupported(state: GrowingState, cell: Cell): boolean {
    const world = editableIslandWorld(state);
    if (!world) return true;
    const legacy = legacyIslandWorld({ land: state.land, bridge: state.bridge }, true), plan = terracePlanOf(world);
    // DEV terrace form: an owner set on a stair's foot moves the stair, when another edge
    // keeps every occupied terrace reachable; it is never set on a stranding cell.
    // An owner is never set where residents could not walk to it: a terrace three or
    // more steps up, or one walled off, would hold it with no way up.
    if (plan && !plan.reached.has(key(cell))) {
        const probe = editableTerracePlan({ ...state, keepsakes: [...state.keepsakes, { id: 'terrace-reach-probe', unitId: 'terrace-reach-probe', cell: { ...cell } }] });
        if (!probe || probe.stranded > plan.stranded) return false;
    }
    if (plan?.stairs.some(stair => stair.lower.x === cell.x && stair.lower.z === cell.z)) {
        const probe = { ...state, keepsakes: [...state.keepsakes, { id: 'terrace-footing-probe', unitId: 'terrace-footing-probe', cell: { ...cell } }] };
        const moved = editableIslandWorld(probe)!;
        return terracePlanOf(moved)!.stranded <= plan.stranded && supported(legacy, moved, cell, .46);
    }
    return supported(legacy, world, cell, .46);
}

export function terrainFootingError(previous: GrowingState, next: GrowingState, actors: readonly Cell[] = []): string | undefined {
    const before = editableIslandWorld(previous) ?? legacyIslandWorld(previous, true);
    const after = editableIslandWorld(next) ?? legacyIslandWorld(next, true);
    const bounds = landBounds(next);
    const fixed = [...HOUSE_CELLS, { x: bounds.maxX - 1, z: bounds.depth - 1 }, ...(next.bridge ? [bridgeAnchor(next)] : [])];
    if (fixed.some(cell => !supported(before, after, cell, .46, true)))
        return 'おうちと ふなつきばの 足もとは そのままに しよう。';
    const owned = [...next.plots.flatMap(plot => plot.cell ? [plot.cell] : []),
        ...next.landmarks.flatMap(owner => !owner.cell ? [] : OWN_LANDMARKS.includes(owner.kind) ? [owner.cell]
            : occupiedCells({ kind: owner.kind as ItemKind, cell: owner.cell })),
        ...next.keepsakes.flatMap(owner => owner.cell ? [owner.cell] : [])];
    if (owned.some(cell => !terrainOwnerSupported(next, cell)))
        return 'ものの 足もとだよ。さきに うごかしてみよう。';
    if (actors.some(cell => !finiteCell(cell) || !supported(before, after, cell, .18, true)))
        return 'なかまが いるよ。すこし はなれた ところを えらぼう。';
}

function validateOccupiedTargets(state: GrowingState, targets: OccupiedPlaceTarget[] | undefined) {
    if (targets === undefined) return;
    const bad = () => fail('なかまの いる ばしょを たしかめてね。');
    if (!Array.isArray(targets) || targets.length > 32) bad();
    const bounds = landBounds(state), ids = new Set<string>();
    let count = 0;
    for (const target of targets) {
        if (!target || typeof target.placeId !== 'string' || !target.placeId || target.placeId.length > 512
            || typeof target.targetId !== 'string' || !target.targetId || target.targetId.length > 512
            || !Array.isArray(target.route) || target.route.length < 2 || target.route.length > 8192) bad();
        const id = JSON.stringify([target.placeId, target.targetId]);
        if (ids.has(id)) bad(); ids.add(id);
        count += target.route.length;
        if (count > 32768) bad();
        for (const point of target.route) if (!finiteCell(point) || !Number.isFinite(point.y) || Math.abs(point.y) > 1000
            || point.x < bounds.minX - 2 || point.x > bounds.maxX + 2 || point.z < -2 || point.z > bounds.depth + 2) bad();
    }
}

function retainsOccupiedTargets(state: GrowingState, targets: readonly OccupiedPlaceTarget[]): boolean {
    const places = derivePlaces(state);
    return targets.every(snapshot => {
        const place = places.find(place => place.id === snapshot.placeId && (place.stage === 'grown' || place.stage === 'lived'));
        const route = place?.useTargets.find(target => target.id === snapshot.targetId && target.kind === 'gallery')?.route;
        return route?.length === snapshot.route.length && route.every((point, index) => {
            const current = snapshot.route[index];
            return Math.abs(point.x - current.x) <= 1e-6 && Math.abs(point.y - current.y) <= 1e-6 && Math.abs(point.z - current.z) <= 1e-6;
        });
    });
}

/** Mutates the cloned command state only after validating the complete candidate. */
export function applyTerrainCommand(state: GrowingState, command: TerrainCommand): boolean {
    if (command.type !== 'terrain-stroke') return applyTerrainCandidate(state, command);
    // A stroke keeps every cell the rules allow: when the whole stroke would break a rule (a
    // footing by the home, a stranded terrace), each crossed cell is tried on its own, in one group.
    const group = `stroke:${state.terrain?.undo.length ?? 0}:${terrainRevision(state).length}`;
    try { return applyTerrainCandidate(state, command, group); } catch (whole) {
        const cells = [...new Map(command.cells.map(cell => [key(cell), cell])).values()];
        if (cells.length < 2 || cells.length > 16) throw whole;
        let shaped = false;
        for (const cell of cells) try { shaped = applyTerrainCandidate(state, { ...command, cells: [cell], expectedTerrainRevision: undefined }, group) || shaped; } catch { /* this cell stays */ }
        if (!shaped) throw whole;
        return true;
    }
}

function applyTerrainCandidate(state: GrowingState, command: TerrainCommand, strokeGroup?: string): boolean {
    validateTerrain(state);
    if (command.expectedTerrainRevision !== undefined && command.expectedTerrainRevision !== terrainEditingRevision(state))
        fail('しまの かたちが かわったよ。いまの しまを みて えらびなおそう。');
    if (command.actors !== undefined && (!Array.isArray(command.actors) || command.actors.length > 4096 || command.actors.some(cell => !finiteCell(cell))))
        fail('なかまの ばしょを たしかめてね。');
    validateOccupiedTargets(state, command.occupiedPlaceTargets);
    const terrain = structuredClone(state.terrain ?? { version: 1 as const, heights: {}, undo: [], redo: [] });
    let entry: TerrainEdit | undefined;
    if (command.type === 'terrain-edit') {
        if (!acquired(state, command.cell) || ![1, -1].includes(command.delta) || !validGroup(command.group)) fail('じぶんの 土地を えらんでね。');
        const before = terrain.heights[key(command.cell)] ?? 0, after = before + command.delta;
        if (!validHeight(after)) return false;
        entry = { cell: { ...command.cell }, before, after, ...(command.group ? { group: command.group } : {}) };
        terrain.undo = [...terrain.undo, entry].slice(-TERRAIN_HISTORY_LIMIT); terrain.redo = [];
        writeHeight(terrain.heights, entry.cell, entry.after);
    } else if (command.type === 'terrain-stroke') {
        // A finger stroke shapes every cell it crossed in one action: up a step, back to the
        // ground, or down below the sea. Things standing there keep their ground.
        // A finger may wander past the shore; only the child's own land is shaped.
        if (!Array.isArray(command.cells) || !command.cells.length || command.cells.length > 64 || !['up', 'flat', 'sea'].includes(command.to)
            || !command.cells.some(cell => acquired(state, cell))) fail('あかるい マスの なかを なぞってね。そこが じぶんの 土地だよ。');
        const group = strokeGroup ?? `stroke:${terrain.undo.length}`, seen = new Set<string>(), held = heldCells(state);
        let kept = false;
        terrain.redo = [];
        for (const cell of command.cells) {
            const id = key(cell); if (seen.has(id) || !acquired(state, cell)) continue; seen.add(id);
            const before = terrain.heights[id] ?? 0;
            if (command.to !== 'up' && held.has(id)) { kept = true; continue; }
            const after = command.to === 'up' ? before + 1 : command.to === 'flat' ? 0 : seaLevelAt(state, cell);
            if (after === before || !validHeight(after)) continue;
            entry = { cell: { x: cell.x, z: cell.z }, before, after, group };
            terrain.undo.push(entry); writeHeight(terrain.heights, cell, after);
        }
        if (!entry) fail(kept ? 'ものが ある ところは、そのままに しておくよ。' : command.to === 'up' ? 'ここは もう じゅうぶん たかいよ。'
            : command.to === 'flat' ? 'ここは もう たいらだよ。' : 'ここは もう うみだよ。');
        terrain.undo = terrain.undo.slice(-TERRAIN_HISTORY_LIMIT);
    } else if (command.type === 'terrain-undo') {
        entry = terrain.undo.pop(); if (!entry) return false;
        // One action, one undo: a grouped run (a raised grove) goes back together.
        for (let step: TerrainEdit | undefined = entry; step; step = step.group && terrain.undo[terrain.undo.length - 1]?.group === step.group ? terrain.undo.pop() : undefined) {
            writeHeight(terrain.heights, step.cell, step.before); terrain.redo.push(step);
        }
    } else {
        entry = terrain.redo.pop(); if (!entry) return false;
        for (let step: TerrainEdit | undefined = entry; step; step = step.group && terrain.redo[terrain.redo.length - 1]?.group === step.group ? terrain.redo.pop() : undefined) {
            writeHeight(terrain.heights, step.cell, step.after); terrain.undo.push(step);
        }
    }
    const next = { ...state, terrain }, error = terrainFootingError(state, next, command.actors);
    if (error) fail(error);
    // DEV terrace form: an edit may not leave something the child placed out of walking reach.
    const terraceBefore = editableTerracePlan(state), terraceAfter = editableTerracePlan(next);
    if (terraceBefore && terraceAfter && terraceAfter.stranded > terraceBefore.stranded)
        fail('ここを かえると、のぼれない ところが できるよ。');
    if (command.occupiedPlaceTargets?.length && (!retainsOccupiedTargets(state, command.occupiedPlaceTargets)
        || !retainsOccupiedTargets(next, command.occupiedPlaceTargets)))
        fail('なかまが 上で あそんでいるよ。おりてから かえてみよう。');
    state.terrain = terrain;
    return true;
}
