import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../2026-10-11-native-owned-island/kit-manifest.json';
import fixtureJSON from './evidence/expanded-fixture-v2.json';
import { applyIntent } from '../../../src/domain/growingIsland/commands';
import { editableIslandWorld, editableTerrainSegmentSupported } from '../../../src/domain/growingIsland/editableTerrainWorld';
import { terrainOwnerSupported, validateTerrain } from '../../../src/domain/growingIsland/terrainEditing';
import { legacyIslandWorld } from '../../../src/domain/growingIsland/legacyWorldDefinition';
import { derivePlaces } from '../../../src/domain/growingIsland/places';
import type { Cell, GrowingState } from '../../../src/domain/growingIsland/types';
import { IslandMaterials } from '../../../src/components/island/three/primitives';
import { makePokomokoRig } from '../../../src/components/island/three/islandCharacters';
import { wrapPokomoko } from '../../../src/components/island/growing/actors';
import { GrowingLife, type PlaceUseReceipt } from '../../../src/components/island/growing/growingLife';
import { sceneLayout, type SceneLayout } from '../../../src/components/island/growing/sceneLayout';
import { buildObjectLayer } from '../../../src/components/island/growing/objectLayer';
import { makeNativeGrowingKit } from '../../../src/components/island/growing/native/nativeGrowingKit';
import { createWorldScene } from '../../../src/components/island/growing/worldScene';
import { rampPlaneOffset } from './ramp-plane-field';
import { convexTerraceOffset } from './terrace-convex-field';
declare const RAMP_AUDIT_MODE: string;
declare const RAMP_FLOWER_X: number;
declare const RAMP_CANONICAL_JSON: string | undefined;
const bounds = { minX: -3, maxX: 8, depth: 8 };
let maxResponse = 0, maxCenterError = 0, minResponse = 0;
for (let h = -4; h <= 12; h++) {
    const heights = { '1,2': h, '2,2': 4, '1,3': -3, '2,3': 8 };
    maxCenterError = Math.max(maxCenterError, Math.abs(rampPlaneOffset(heights, { x: 1, z: 2 }, bounds) - h));
    if (h === 12) continue;
    for (let zi = -5; zi <= 15; zi++) for (let xi = -5; xi <= 15; xi++) {
        const cell = { x: 1 + xi / 10, z: 2 + zi / 10 };
        const delta = (rampPlaneOffset({ ...heights, '1,2': h + 1 }, cell, bounds) - rampPlaneOffset(heights, cell, bounds)) * .18;
        maxResponse = Math.max(maxResponse, delta); minResponse = Math.min(minResponse, delta);
    }
}
assert(maxCenterError < 1e-10 && maxResponse <= .18 + 1e-10 && minResponse >= -1e-10);
const rampInput: Record<string, number> = {};
for (let z = 1; z <= 3; z++) { rampInput[`1,${z}`] = 0; rampInput[`2,${z}`] = 1; rampInput[`3,${z}`] = 2; }
const section = Array.from({ length: 41 }, (_, i) => { const cell = { x: 1 + i / 20, z: 2 };
    return { x: cell.x, F: convexTerraceOffset(rampInput, cell, bounds) * .18, linear: rampPlaneOffset(rampInput, cell, bounds) * .18 }; });
assert(section.every(sample => Math.abs(sample.linear - (sample.x - 1) * .18) < 1e-10));
const initial = structuredClone(fixtureJSON.state) as GrowingState;
let replay = initial; const moves = [];
for (const [id, cell] of [['starter-flower', { x: RAMP_FLOWER_X, z: 5 }], ['starter-bench', { x: 1, z: 6 }]] as const) {
    const command = { type: 'move' as const, id, cell }, before = structuredClone(replay);
    try { replay = applyIntent(replay, { id: `ramp-move-${id}`, command }).state; moves.push({ command, accepted: true }); }
    catch (error) { assert.deepEqual(replay, before); moves.push({ command, accepted: false, reason: String(error) }); }
}
assert.deepEqual(replay.terrain, initial.terrain, 'Moves must not change floor or saved heights');
const state: GrowingState = RAMP_CANONICAL_JSON ? JSON.parse(RAMP_CANONICAL_JSON) : replay;
validateTerrain(state);
const world = editableIslandWorld(state)!, layout = sceneLayout(state, true);
const place = derivePlaces(state).find(place => place.ruleId === 'P05'); assert(place);
const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
const kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, manifest);
const m = new IslandMaterials('moon-garden'), layer = buildObjectLayer(m, state, layout, undefined, undefined, [], kit);
const floorAtPhysical = (point: T.Vector3, frame: SceneLayout = layout) => {
    const logical = frame.world.logicalAt({ x: point.x + frame.center, z: point.z + 2 });
    return logical ? frame.world.floorAt(logical) : undefined;
};
function contact(root: T.Object3D) {
    root.updateWorldMatrix(true, true); let count = 0, absent = 0, min = Infinity, max = -Infinity;
    root.traverseVisible(object => {
        if (!(object instanceof T.Mesh) || object.userData.placementHitOnly) return;
        const positions = object.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            const p = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
            if (p.y < root.position.y - .12 || p.y > root.position.y + .08) continue;
            count++; const logical = world.logicalAt({ x: p.x + layout.center, z: p.z + 2 }), floor = logical && world.floorAt(logical);
            if (!floor) { absent++; continue; } min = Math.min(min, p.y - floor.point.y); max = Math.max(max, p.y - floor.point.y);
        }
    });
    return { samples: count, absent, minGap: Number.isFinite(min) ? min : null, maxGap: Number.isFinite(max) ? max : null };
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
function supportTilt(cell: Cell) {
    const base = legacyIslandWorld({ land: state.land, bridge: state.bridge }, true), center = world.floorAt(cell), originalCenter = base.floorAt(cell);
    let max = 0, worst: Cell | undefined;
    for (const dx of [-.46, -.23, 0, .23, .46]) for (const dz of [-.46, -.23, 0, .23, .46]) {
        const p = { x: cell.x + dx, z: cell.z + dz }, y = world.floorAt(p), old = base.floorAt(p);
        if (!y || !old || !center || !originalCenter) continue;
        const tilt = Math.abs((y.point.y - center.point.y) - (old.point.y - originalCenter.point.y));
        if (tilt > max) { max = tilt; worst = p; }
    }
    return { maxAdditionalTilt: max, worst };
}
const owners = [...state.plots, ...state.landmarks, ...state.keepsakes].flatMap(owner => owner.cell ? [{
    id: owner.id, cell: owner.cell, supported: terrainOwnerSupported(state, owner.cell), supportTilt: supportTilt(owner.cell), physical: contact(layer.objects.get(owner.id)!) }] : []);
const scene = createWorldScene({} as T.WebGLRenderer); scene.layout(state);
const cottage = kit.cottage(); cottage.position.copy(scene.house.position); const nativeCottage = contact(cottage);
scene.dispose(); layer.dispose(); m.dispose();
const life = [runLife('garden', 'pokomoko'), runLife('garden', 'v2'), runLife('autonomous')];
const actualSection = Array.from({ length: 61 }, (_, i) => { const cell = { x: -2 + i / 10, z: 5.5 };
    return { cell, y: world.floorAt(cell)?.point.y ?? null }; });
const coves = [{ x: 0, z: 4 }, { x: 8, z: 5 }].map(cell => ({ cell, saved: state.terrain!.heights[`${cell.x},${cell.z}`] ?? 0, dry: Boolean(world.floorAt(cell)) }));
kit.dispose();
console.log(JSON.stringify({ mode: RAMP_AUDIT_MODE, status: 'DIAGNOSTIC', pure: { maxResponse, minResponse, maxCenterError, section }, moves,
    sameRawHeights: true, sameFinalOwners: true, finalFixtureOrigin: 'First F-default normal moves; other modes project the same final state even when their own moves reject', state, owners, nativeCottage, life, actualSection, coves,
    limits: ['same expanded-v2 fixture; normal owner moves only', 'CPU model/rig samples, not WebGL art acceptance',
        'bilinear does not promise legal placement on arbitrary slopes', 'tail clearance is sampled and separate from floor route support',
        'stable base variants labelled separately; no attribution of base fixes to ramp basis'] }, null, 2));
