import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../2026-10-11-native-owned-island/kit-manifest.json';
import observedJSON from './evidence/42-H-redone-state.json';
import recipeJSON from './evidence/high-garden-recipe.json';
import { newIsland } from '../../../src/domain/growingIsland/island';
import { applyIntent, canPlace } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import type { Cell, Command, GrowingState } from '../../../src/domain/growingIsland/types';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import { makePokomokoRig } from '../../../src/components/island/three/islandCharacters';
import { wrapPokomoko } from '../../../src/components/island/growing/actors';
import { GrowingLife, type PlaceUseReceipt } from '../../../src/components/island/growing/growingLife';
import { sceneLayout, type SceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';
import { makeNativeGrowingKit } from '../../../src/components/island/growing/native/nativeGrowingKit';
import { createWorldScene } from '../../../src/components/island/growing/worldScene';

declare const HIGH_AUDIT_MODE: 'A' | 'F' | 'H';
declare const HIGH_CANONICAL_JSON: string | undefined;
const fields = ['land', 'terrain', 'plots', 'landmarks', 'villagers', 'keepsakes', 'placeProgress', 'town', 'drops', 'character'] as const;
const observed = observedJSON as unknown as Pick<GrowingState, typeof fields[number]>;
const initial: GrowingState = { ...newIsland('high-garden-independent', 1000),
    ...structuredClone(Object.fromEntries(fields.map(field => [field, observed[field]]))) };
const recipe = recipeJSON.commands as Command[];
let replay = structuredClone(initial), replayFailure: { index: number; command: Command; reason: string } | undefined;
const replaySteps = [];
for (const [index, command] of recipe.filter(command => command.type !== 'place-used').entries()) {
    const before = structuredClone(replay);
    try {
        replay = applyIntent(replay, { id: `audit-recipe-${index}`, command }, 1000 + index).state;
        validateTerrain(replay);
        const owners = [...replay.plots, ...replay.landmarks, ...replay.keepsakes].filter(owner => owner.cell);
        replaySteps.push({ command, unsupportedOwners: owners.filter(owner => !terrainOwnerSupported(replay, owner.cell!)).map(owner => owner.id) });
    } catch (error) { assert.deepEqual(replay, before); replayFailure = { index, command, reason: String(error) }; break; }
}
const state: GrowingState = HIGH_CANONICAL_JSON ? JSON.parse(HIGH_CANONICAL_JSON) : replay;
assert(HIGH_CANONICAL_JSON || !replayFailure, 'F must produce canonical state by ordinary commands');
validateTerrain(state);
assert.deepEqual(state.terrain!.heights, recipeJSON.heights);
const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
const kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, manifest);
const world = editableIslandWorld(state)!, layout = sceneLayout(state, true);
const places = derivePlaces(state), place = places.find(place => place.ruleId === 'P05')!;
assert(place);
const floorAtPhysical = (point: T.Vector3, frame: SceneLayout = layout) => {
    const logical = frame.world.logicalAt({ x: point.x + frame.center, z: point.z + 2 });
    return logical ? frame.world.floorAt(logical) : undefined;
};
function physicalFootprint(root: T.Object3D, frame: SceneLayout = layout) {
    root.updateWorldMatrix(true, true); let vertices = 0, absent = 0, minGap = Infinity, maxGap = -Infinity, maxLogicalRadius = 0;
    const nativeParts = new Set<string>(), center = frame.logicalAt(root.position);
    root.traverseVisible(object => {
        if (typeof object.userData.nativePart === 'string') nativeParts.add(object.userData.nativePart);
        if (!(object instanceof T.Mesh) || object.userData.placementHitOnly) return;
        const positions = object.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            if (p.y < root.position.y - .12 || p.y > root.position.y + .08) continue;
            vertices++; const floor = floorAtPhysical(p, frame);
            if (!floor) { absent++; continue; }
            const logical = frame.logicalAt(p);
            maxLogicalRadius = Math.max(maxLogicalRadius, Math.abs(logical.x - center.x), Math.abs(logical.z - center.z));
            minGap = Math.min(minGap, p.y - floor.point.y); maxGap = Math.max(maxGap, p.y - floor.point.y);
        }
    });
    return { nativeParts: [...nativeParts], vertices, absent, minGap: Number.isFinite(minGap) ? minGap : null,
        maxGap: Number.isFinite(maxGap) ? maxGap : null, maxLogicalRadius };
}
const materials = new IslandMaterials('moon-garden');
const ownerLayer = buildObjectLayer(materials, state, layout, undefined, undefined, [], kit);
const owners = [...state.plots, ...state.landmarks, ...state.keepsakes].flatMap(owner => !owner.cell ? [] : [{
    id: owner.id, cell: owner.cell, supported: terrainOwnerSupported(state, owner.cell),
    canPlaceAgain: canPlace(state, owner.cell, owner.id), physical: physicalFootprint(ownerLayer.objects.get(owner.id)!),
}]);
const scene = createWorldScene({} as T.WebGLRenderer); scene.layout(state);
const cottage = kit.cottage(); cottage.position.copy(scene.house.position);
const nativeCottage = physicalFootprint(cottage); scene.dispose(); ownerLayer.dispose(); materials.dispose();
function ownerPhysicalAt(input: GrowingState) {
    const frame = sceneLayout(input, true), m = new IslandMaterials('moon-garden');
    const layer = buildObjectLayer(m, input, frame, undefined, undefined, [], kit);
    try { return [...input.plots, ...input.landmarks, ...input.keepsakes].flatMap(owner => owner.cell ? [{
        id: owner.id, supported: terrainOwnerSupported(input, owner.cell), physical: physicalFootprint(layer.objects.get(owner.id)!, frame) }] : []); }
    finally { layer.dispose(); m.dispose(); }
}
const initialPhysicalOwners = ownerPhysicalAt(initial);
const corrections = [];
for (const command of [
    { type: 'terrain-edit', cell: { x: 1, z: 2 }, delta: -1 },
    { type: 'terrain-edit', cell: { x: 0, z: 1 }, delta: 1 },
] as Command[]) {
    try {
        const revised: GrowingState = applyIntent(state, { id: `diagnostic-p1-correction-${corrections.length}`, command }).state;
        corrections.push({ command, accepted: true, owners: ownerPhysicalAt(revised) });
    } catch (error) { corrections.push({ command, accepted: false, reason: String(error) }); }
}


function sampleBody(root: T.Object3D, summary: { frames: number; vertices: number; absent: number; minClearance: number; maxBelowGround: number; worst?: { physical: number[]; logical: Cell; clearance: number; mesh: string; parent: string } }, frame: SceneLayout = layout) {
    root.updateWorldMatrix(true, true); summary.frames++;
    root.traverseVisible(object => {
        if (!(object instanceof T.Mesh) || object.userData.placementHitOnly) return;
        const positions = object.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i += 2) {
            const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            if (p.y > root.position.y + .5) continue;
            summary.vertices++; const floor = floorAtPhysical(p, frame);
            if (!floor) { summary.absent++; continue; }
            const clearance = p.y - floor.point.y;
            if (clearance < summary.minClearance) { summary.minClearance = clearance; summary.worst = { physical: p.toArray(), logical: frame.logicalAt(p), clearance, mesh: object.name || object.geometry.type, parent: object.parent?.name ?? '' }; }
            summary.maxBelowGround = Math.max(summary.maxBelowGround, -clearance);
        }
    });
}
function runLife(kind: 'garden' | 'autonomous', actorId?: string, input: GrowingState = state) {
    const layout = sceneLayout(input, true), world = editableIslandWorld(input)!, place = derivePlaces(input).find(p => p.ruleId === 'P05')!;
    // Fixed RNG affects normal target choice only. No receipt, walker state, route,
    // or actor position is injected; both actual residents remain present.
    const random = Math.random; let seed = 20261023;
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    const m = new IslandMaterials('moon-garden'), rig = makePokomokoRig(m), hero = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
    const layer = buildObjectLayer(m, input, layout, undefined, undefined, [], kit), life = new GrowingLife(m, hero);
    const facts: { at: number; receipt: PlaceUseReceipt; position: number[]; body: ReturnType<typeof bodySummary> }[] = [];
    const stats = new Map<string, ReturnType<typeof bodySummary>>(), arrivals = new Map<string, number>();
    const previous = new Map<string, Cell>(), routeErrors = new Map<string, number>();
    const traces = new Map<string, { at: number; cell: Cell; y: number }[]>();
    let accepted = true;
    try {
        life.sync(input, layout, layer); life.tick(0, 0, true, false);
        if (kind === 'garden') accepted = life.visitPlace(actorId!, place.id, 0, 'garden');
        const maxTime = kind === 'garden' ? 40_000 : 180_000;
        for (let now = 40; now <= maxTime && accepted; now += 40) {
            life.tick(now, 40, false, false); life.tick(now, 0, false, false);
            for (const id of ['pokomoko', 'v2']) {
                const p = life.positionOf(id); if (!p) continue;
                const cell = layout.logicalAt(p), old = previous.get(id);
                if (old && !editableTerrainSegmentSupported(world, old, cell)) routeErrors.set(id, (routeErrors.get(id) ?? 0) + 1);
                previous.set(id, cell);
                for (const target of place.useTargets) if (Math.hypot(cell.x - target.cell.x, cell.z - target.cell.z) < 1e-6) {
                    const key = `${id}:${target.id}`; if (!arrivals.has(key)) arrivals.set(key, now);
                }
                if (now % 200 === 0) {
                    const root = life.objects().find(root => root.userData.actorId === id); assert(root);
                    const summary = stats.get(id) ?? bodySummary(); sampleBody(root, summary, layout); stats.set(id, summary);
                    const trace = traces.get(id) ?? []; if (trace.length < 150) trace.push({ at: now, cell, y: p.y }); traces.set(id, trace);
                }
            }
            for (const receipt of life.takePlaceUses()) {
                if (receipt.placeId !== place.id) continue;
                const root = life.objects().find(root => root.userData.actorId === receipt.actorId)!;
                const summary = bodySummary(); sampleBody(root, summary, layout);
                facts.push({ at: now, receipt, position: life.positionOf(receipt.actorId)!.toArray(), body: summary });
            }
            if (kind === 'garden' && facts.some(f => f.receipt.actorId === actorId && f.receipt.targetId === 'starter-flower:garden')) break;
            if (kind === 'autonomous' && ['pokomoko', 'v2'].every(id => facts.some(f => f.receipt.actorId === id && f.receipt.targetId === 'starter-bench'))) break;
        }
        return { kind, actorId, accepted, seed: 20261023, receipts: facts.map(f => ({ ...f, firstArrival: arrivals.get(`${f.receipt.actorId}:${f.receipt.targetId}`) ?? null })),
            bodies: Object.fromEntries(stats), routeErrors: Object.fromEntries(routeErrors), traces: Object.fromEntries(traces),
            liveActors: life.terrainActors(), occupiedTargets: life.occupiedTerrainPlaceTargets() };
    } finally { life.dispose(); layer.dispose(); m.dispose(); Math.random = random; }
}
function bodySummary() { return { frames: 0, vertices: 0, absent: 0, minClearance: Infinity, maxBelowGround: 0,
    worst: undefined as undefined | { physical: number[]; logical: Cell; clearance: number; mesh: string; parent: string } }; }
const life = [runLife('garden', 'pokomoko'), runLife('garden', 'v2'), runLife('autonomous')];
let correctedLife;
if (HIGH_AUDIT_MODE !== 'A') {
    const revised = applyIntent(state, { id: 'normal-home-ground-correction', command: { type: 'terrain-edit', cell: { x: 0, z: 1 }, delta: 1 } }).state;
    correctedLife = { command: { type: 'terrain-edit', cell: { x: 0, z: 1 }, delta: 1 },
        oldCoveStillWet: !editableIslandWorld(revised)!.floorAt({ x: 0, z: 4 }),
        runs: [runLife('garden', 'pokomoko', revised), runLife('garden', 'v2', revised), runLife('autonomous', undefined, revised)] };
}

const editChecks = [];
for (const command of [
    { type: 'terrain-undo' },
    { type: 'terrain-edit', cell: { x: 2, z: 3 }, delta: -1 },
    { type: 'terrain-edit', cell: { x: 5, z: 0 }, delta: 1 },
] as Command[]) {
    const before = structuredClone(state);
    try {
        const changed: GrowingState = applyIntent(state, { id: `post-owner-${editChecks.length}`, command }).state;
        validateTerrain(changed); assert.deepEqual(state, before);
        const inverse: Command = command.type === 'terrain-undo' ? { type: 'terrain-redo' } : { type: 'terrain-undo' };
        const restored: GrowingState = applyIntent(changed, { id: `post-owner-inverse-${editChecks.length}`, command: inverse }).state;
        assert.deepEqual(restored.terrain!.heights, state.terrain!.heights);
        editChecks.push({ command, accepted: true, inverseRestoresHeights: true,
            owners: owners.map(owner => ({ id: owner.id, supported: terrainOwnerSupported(changed, owner.cell) })) });
    } catch (error) { assert.deepEqual(state, before); editChecks.push({ command, accepted: false, reason: String(error), fullStateUnchanged: true }); }
}
const coves = [{ x: 0, z: 4 }, { x: 5, z: 1 }, { x: 5, z: 2 }].map(cell => ({ cell,
    initialSaved: initial.terrain!.heights[`${cell.x},${cell.z}`] ?? 0, finalSaved: state.terrain!.heights[`${cell.x},${cell.z}`] ?? 0,
    initialDry: Boolean(editableIslandWorld(initial)!.floorAt(cell)), finalDry: Boolean(world.floorAt(cell)), finalY: world.floorAt(cell)?.point.y ?? null }));
const restore = JSON.parse(JSON.stringify(state)) as GrowingState; validateTerrain(restore);
assert.deepEqual(editableIslandWorld(restore)!.definition, world.definition); assert.deepEqual(derivePlaces(restore), places);
kit.dispose();
console.log(JSON.stringify({ mode: HIGH_AUDIT_MODE, status: 'DIAGNOSTIC', replayFailure: replayFailure ?? null, replaySteps,
    sameSavedFinalFixture: true, canonicalState: state, owners, initialPhysicalOwners, corrections, nativeCottage,
    places: places.map(p => ({ id: p.id, family: p.family, stage: p.stage, variant: p.variant, mainIds: p.mainIds,
        footprint: p.footprint, targets: p.useTargets })), life, correctedLife, editChecks, coves, jsonRestore: true,
    limits: ['fixed RNG is a diagnostic choice fixture, not child input', 'actual CPU native/source model vertices; no WebGL image',
        'near-ground owner vertices and sampled lower body vertices are not continuous collision proofs', 'explicit garden visit and autonomous bench use are separate runs',
        'owner-present edits omit actor snapshots; live actor-protected editor is separately tested in root UI', 'no DB injection or transaction proof'] }, null, 2));
