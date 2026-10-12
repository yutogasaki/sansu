import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json';
import nativeManifest from '../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import { authoredWorldFrame } from '../../../domain/growingIsland/authoredWorldFrame';
import { withNative05WaterCarvingScope } from '../../../domain/growingIsland/authoredWaterCarving';
import { applyIntent, canPlace } from '../../../domain/growingIsland/commands';
import { approachCells, HOME_CELL, key, landCells, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import type { Cell, Command, GrowingState } from '../../../domain/growingIsland/types';
import { compileWorldDefinition, type IslandWorld } from '../../../domain/growingIsland/worldDefinition';
import { makePokomokoRig } from '../three/islandCharacters';
import { IslandMaterials } from '../three/primitives';
import { actorFootMinY, actorSeatContact, actorSeatSurface, actorSurfaceY } from './actorScale';
import { wrapPokomoko, type Actor } from './actors';
import { authoredFlowerWalkSet, measureAuthoredWalkingEnvelope } from './authoredFlowerObstructions';
import { GrowingLife } from './growingLife';
import { buildObjectLayer, type Ghost } from './objectLayer';
import { sceneLayout } from './sceneLayout';
import { makeNativeAuthoredCove, type NativeAuthoredCove } from './native/nativeAuthoredCove';
import { makeNativeAuthoredFlower, type NativeAuthoredFlower, type NativeAuthoredFlowerSkin } from './native/nativeAuthoredFlower';
import { makeNativeGrowingKit, type NativeGrowingKit } from './native/nativeGrowingKit';

const options = { water: true, cove: true }, friend = 'authored-friend-0';
const treeCell = { x: 2, z: -4 }, treeEntry = { x: 3, z: -4 }, bench = { x: 2, z: -7 };
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
let base: IslandWorld, initial: GrowingState, epoch: number, kit: NativeGrowingKit, cove: NativeAuthoredCove, flowers: NativeAuthoredFlower;
beforeAll(async () => {
    base = withNative05WaterCarvingScope(compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world.json.gz')).toString())));
    const reference = JSON.parse(readFileSync('prototypes/place-qa/authored-flower-reference-mature.json', 'utf8'));
    initial = reference.state; epoch = reference.epoch;
    const compressed = readFileSync(manifest.artifact.path.slice(1)), bytes = gunzipSync(compressed);
    expect(sha(compressed)).toBe(manifest.artifact.sha256); expect(sha(bytes)).toBe(manifest.source.sha256);
    const source = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
    source.userData.sourceId = manifest.source.id; source.userData.sourceSha256 = sha(bytes);
    cove = makeNativeAuthoredCove(source, manifest);
    const native = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
    kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(native).buffer, '')).scene, nativeManifest);
    flowers = makeNativeAuthoredFlower(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native-flower-support.json.gz')).toString()) as NativeAuthoredFlowerSkin);
}, 20000);
afterAll(() => { cove?.dispose(); flowers?.dispose(); kit?.dispose(); });

interface WalkerView { actor: Actor; at: Cell; path: Cell[]; mode: string; seat?: { cell: Cell }; placeTarget?: unknown }
function fixture(initialGhost?: Ghost) {
    let state = structuredClone(initial), frame = authoredWorldFrame(state, base, options);
    const layoutFor = () => sceneLayout(state, false, frame.world, frame.waterPlan, base, { options, covePlan: frame.covePlan, revision: frame.revision });
    let layout = layoutFor();
    const m = new IslandMaterials('moon-garden'), rig = makePokomokoRig(m), hero = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
    const build = (ghost?: Ghost) => buildObjectLayer(m, state, layout, ghost, undefined, [], kit, flowers, cove);
    let layer = build(initialGhost);
    const life = new GrowingLife(m, hero); life.sync(state, layout, layer); life.tick(0, 0, false, false);
    // Observe retained actors/routes only. Every action uses the public pointer
    // operations or ordinary life tick; no walker state or receipt is injected.
    const walkers = (life as unknown as { walkers: Map<string, WalkerView> }).walkers;
    const actor = () => walkers.get(friend)!.actor;
    const physical = () => authoredFlowerWalkSet(walkableCells(state, frame.world), frame.world, layout, layer.root,
        life.walkingObstructionProof()?.envelope ?? measureAuthoredWalkingEnvelope([...walkers.values()].map(walker => walker.actor)));
    let collisions = physical();
    const checkPose = () => {
        expect(actor().root.visible).toBe(true); expect(actor().visual?.scale.toArray()).toEqual([.45, .45, .45]);
        expect(collisions.poseClear(actor()), 'actual posed actor intersects the native committed tree, shared trunk, branch, cove or flower triangles').toBe(true);
        const walker = walkers.get(friend)!;
        if (walker.mode === 'seat') {
            const surface = actorSeatSurface(layer.objects.get('l25'), 'sit')!, contact = actorSeatContact(actor())!;
            expect(contact.y).toBeCloseTo(actorSurfaceY(surface, contact)!, 7); return;
        }
        const floor = frame.world.floorAt(walker.at);
        expect(floor, `real floor under ${JSON.stringify(walker.at)}`).toBeDefined();
        const sole = actorFootMinY(actor())!;
        expect(sole).toBeGreaterThanOrEqual(floor!.point.y - 1e-6);
        expect(sole).toBeLessThanOrEqual(floor!.point.y + .035 * .45 + 1e-6);
    };
    const refresh = (next: GrowingState) => {
        const old = layer; state = next; frame = authoredWorldFrame(state, base, options); layout = layoutFor(); layer = build();
        life.sync(state, layout, layer); collisions = physical(); old.dispose();
    };
    const command = (command: Command, id: string) => refresh(applyIntent(state, { id, command }, epoch, frame.world).state);
    const freezeOthers = () => { for (const id of life.actorIds()) if (id !== friend) life.pick(id); };
    const dropAt = (cell: Cell, now: number) => { expect(life.pick(friend)).toBe(true); life.drag(friend, layout.point(cell)); return life.drop(friend, now); };
    return { life, walkers, actor, checkPose, command, freezeOthers, dropAt,
        get state() { return state; }, get world() { return frame.world; }, get layout() { return layout; }, get layer() { return layer; }, get collisions() { return collisions; },
        dispose() { life.dispose(); layer.dispose(); m.dispose(); } };
}
function safeGround(f: ReturnType<typeof fixture>) {
    const at = f.walkers.get(friend)!.at;
    expect(f.collisions.walkable.has(key(at))).toBe(true);
    expect(reachableFromHome(f.state, f.collisions.walkable, f.world).has(key(at))).toBe(true);
    f.checkPose();
}

function access(f: ReturnType<typeof fixture>, id: string) { return f.life.walkingObstructionProof()!.ownerAccess.find(owner => owner.id === id)!; }
function reached(f: ReturnType<typeof fixture>) {
    return new Set([...reachableFromHome(f.state, f.collisions.walkable, f.world)].filter(id => f.collisions.walkable.has(id)));
}
function checkPath(f: ReturnType<typeof fixture>, path: readonly Cell[]) {
    for (let i = 1; i < path.length; i++) {
        expect(f.world.neighbors(path[i - 1]).map(key)).toContain(key(path[i]));
        expect(f.collisions.clearGroundPath(path[i - 1], path[i])).toBe(true);
    }
}
function chooseOpen(f: ReturnType<typeof fixture>, random: ReturnType<typeof vi.spyOn>, cell: Cell) {
    const open = [...reached(f)], index = open.indexOf(key(cell)); expect(index).toBeGreaterThanOrEqual(0);
    random.mockReturnValue(.99).mockImplementationOnce(() => .99).mockImplementationOnce(() => (index + .5) / open.length);
}
function walkUntilIdle(f: ReturnType<typeof fixture>, start: number) {
    let now = start, walked = 0;
    for (let frame = 0; frame < 700; frame++) {
        now = start + frame * 50; f.life.tick(now, 50, false, false); f.checkPose();
        const walker = f.walkers.get(friend)!; checkPath(f, walker.path);
        if (walker.mode === 'walk') walked++;
        if (walked && walker.mode === 'idle') break;
    }
    expect(walked).toBeGreaterThan(2); expect(f.walkers.get(friend)!.mode).toBe('idle'); safeGround(f); return now;
}

describe('actual authored grove life with the same physical owner entries', () => {
    it('includes every visible native grove and finds l14 beyond its blocked first ring without altering owners, rigs or floor', () => {
        const f = fixture(), saved = structuredClone(f.state), definition = JSON.stringify(f.world.definition);
        try {
            const proof = f.life.walkingObstructionProof()!;
            expect(proof).toMatchObject({ stockCount: 4, coveCount: 1, groveCount: 5, triangles: 211560 });
            expect(proof.envelope.source.actorIds).toHaveLength(9); expect(proof.envelope.bands).toHaveLength(8);
            expect(proof.envelope.radius).toBeCloseTo(.24406937059140585, 12);
            expect(proof.envelope.height).toBeCloseTo(.5500928879753579, 12);
            expect(proof.ownerAccess).toHaveLength(32); expect(proof.ownerAccess.filter(owner => !owner.reachable)).toEqual([]);
            const entries = access(f, 'l14').approaches;
            expect(entries).toContainEqual(treeEntry); expect(approachCells(treeCell, f.world)).not.toContainEqual(treeEntry);
            for (const entry of entries) {
                expect(Math.hypot(entry.x - treeCell.x, entry.z - treeCell.z)).toBeLessThanOrEqual(1.1);
                expect(f.world.floorAt(entry)).toBeDefined(); expect(reached(f).has(key(entry))).toBe(true);
            }
            for (const z of [-4, -3.75, -4.25]) {
                const blocked = { x: 2.75, z };
                expect(f.collisions.clearGroundPath(blocked, blocked)).toBe(false);
                expect(f.collisions.walkable.has(key(blocked))).toBe(false); expect(entries).not.toContainEqual(blocked);
            }
            const unsafeEndpoint = { x: 2.75, z: -3.5 };
            expect(f.collisions.clearGroundPath(unsafeEndpoint, unsafeEndpoint)).toBe(true);
            expect(f.collisions.walkable.has(key(unsafeEndpoint))).toBe(false); expect(entries).not.toContainEqual(unsafeEndpoint);
            const route = f.world.route(HOME_CELL, treeEntry, reached(f))!;
            expect(route).toHaveLength(33); checkPath(f, route);
            const visibleTree = f.layer.root.getObjectsByProperty('name', 'growing-tree-spread')
                .find(root => root.visible && root.userData.ownerId === 'l14')!;
            expect(visibleTree.scale.toArray()).toEqual([.45 * 1.3, .45 * 1.3, .45 * 1.3]);
            expect(f.state.landmarks.find(owner => owner.id === 'l14')).toMatchObject({ cell: treeCell, growth: 18, maturedAt: 0 });
            expect(landCells(f.state, f.world)).toHaveLength(73); expect(JSON.stringify(f.world.definition)).toBe(definition);
            expect(f.state).toEqual(saved);
        } finally { f.dispose(); }
    });

    it('walks to l14 and leaves through normal life ticks without inventing a tree seat or use receipt', () => {
        const f = fixture(), saved = structuredClone(f.state), random = vi.spyOn(Math, 'random');
        try {
            f.freezeOthers(); expect(f.dropAt(HOME_CELL, 0)).toBeUndefined(); f.life.tick(1, 0, false, false); safeGround(f);
            expect(access(f, 'l14').approaches).toContainEqual(treeEntry);
            expect(f.layer.seats.has(key(treeCell))).toBe(false);
            expect(f.layer.places.flatMap(place => place.useTargets).some(target => target.id === 'l14')).toBe(false);
            chooseOpen(f, random, treeEntry); let now = walkUntilIdle(f, 3000);
            expect(f.walkers.get(friend)!.at).toEqual(treeEntry);
            expect(f.life.takePlaceUses()).toEqual([]);
            chooseOpen(f, random, HOME_CELL); now = walkUntilIdle(f, now + 8000);
            expect(f.walkers.get(friend)!.at).toEqual(HOME_CELL); expect(now).toBeGreaterThan(3000);
            expect(f.life.takePlaceUses()).toEqual([]); expect(f.state).toEqual(saved);
            expect(f.life.walkingPoseProof()).toMatchObject({ evacuations: 0, unplaced: 0 });
        } finally { random.mockRestore(); f.dispose(); }
    });

    it('uses the real grove bench via its resolved entry, produces a valid receipt, and exits on that same safe graph', () => {
        const f = fixture(), random = vi.spyOn(Math, 'random');
        try {
            f.freezeOthers(); f.dropAt(treeEntry, 0); f.life.tick(1, 0, false, false); safeGround(f);
            const targets = f.layer.places.filter(place => place.stage === 'grown' || place.stage === 'lived')
                .flatMap(place => place.useTargets.map(target => ({ place, target })));
            const index = targets.findIndex(({ place, target }) => place.ruleId === 'P02' && target.id === 'l25');
            expect(index).toBeGreaterThanOrEqual(0);
            random.mockReturnValue(.1).mockImplementationOnce(() => .1).mockImplementationOnce(() => (index + .5) / targets.length);
            let now = 3000, walked = 0;
            for (let frame = 0; frame < 700 && f.walkers.get(friend)!.mode !== 'seat'; frame++) {
                now = 3000 + frame * 50; f.life.tick(now, 50, false, false); f.checkPose();
                const walker = f.walkers.get(friend)!; checkPath(f, walker.path); if (walker.mode === 'walk') walked++;
            }
            expect(walked).toBeGreaterThan(2); expect(f.walkers.get(friend)!.seat?.cell).toEqual(bench);
            expect(access(f, 'l25').approaches).toContainEqual(f.walkers.get(friend)!.at);
            expect(f.collisions.clearGroundPath(f.walkers.get(friend)!.at, bench)).toBe(true);
            expect(f.life.takePlaceUses()).toEqual([]);
            f.life.tick(now + 800, 16, false, false); f.checkPose();
            const receipts = f.life.takePlaceUses(), receipt = receipts.find(value => value.actorId === friend && value.ruleId === 'P02')!;
            expect(receipt).toMatchObject({ actorId: friend, targetId: 'l25', revision: targets[index].place.revision });
            expect(receipts.filter(value => value.actorId === friend && value.ruleId === 'P02')).toHaveLength(1);
            const shown = applyIntent(f.state, { id: 'grove-shown', command: { type: 'place-shown', profileId: f.state.seed,
                expectedRevision: 0, ruleId: receipt.ruleId, revision: receipt.revision } }, epoch, f.world).state;
            const used = applyIntent(shown, { id: 'grove-used', command: { type: 'place-used', profileId: f.state.seed,
                expectedRevision: 0, ...receipt } }, epoch, f.world).state;
            expect(used.placeProgress?.uses.P02?.villager).toMatchObject({ actorId: friend, targetId: 'l25', revision: receipt.revision });
            f.life.tick(now + 6100, 0, false, false); safeGround(f);
            expect(access(f, 'l25').approaches).toContainEqual(f.walkers.get(friend)!.at);
            expect(f.life.takePlaceUses()).toEqual([]);
            expect(f.layer.places.filter(place => place.family === 'grove').flatMap(place => place.useTargets).some(target => target.kind === 'gallery')).toBe(false);
            expect(f.life.walkingPoseProof()).toMatchObject({ evacuations: 0, unplaced: 0 });
        } finally { random.mockRestore(); f.dispose(); }
    });

    it('retains a failed destination when a legal placement disconnects every safe local entry', () => {
        const f = fixture(), random = vi.spyOn(Math, 'random'), actorId = 'authored-friend-2';
        try {
            f.command({ type: 'move', id: 'p9', cell: { x: 4, z: -4 } }, 'grove-block-main-route');
            expect(access(f, 'p3')).toMatchObject({ reachable: false, approaches: [] });
            expect(access(f, 'l25')).toMatchObject({ reachable: false, approaches: [] });
            for (const id of f.life.actorIds()) if (id !== actorId) f.life.pick(id);
            expect(f.life.pick(actorId)).toBe(true); f.life.drag(actorId, f.layout.point(HOME_CELL)); f.life.drop(actorId, 0);
            // Normal life may choose another reachable facility. It must not
            // promote the disconnected home's/bench's nearby floor into entry.
            random.mockReturnValue(.2);
            f.life.tick(3000, 50, false, false);
            const walker = f.walkers.get(actorId)!;
            expect(walker.seat?.cell).not.toEqual(bench); checkPath(f, walker.path);
            for (const at of walker.path) expect(reached(f).has(key(at))).toBe(true);
            expect(f.world.floorAt(walker.at)).toBeDefined();
            expect(f.collisions.poseClear(walker.actor)).toBe(true); expect(f.life.takePlaceUses()).toEqual([]);
        } finally { random.mockRestore(); f.dispose(); }
    });

    it('rebuilds tree guards and entry maps on real move, store and restore, and excludes preview shapes', () => {
        const f = fixture(), saved = structuredClone(f.state), destination = { x: 12, z: -9 };
        try {
            f.freezeOthers(); const initialProof = f.life.walkingObstructionProof()!, floors = JSON.stringify(f.world.floors);
            const ghost: Ghost = { ownerId: 'l14', kind: 'sapling', seed: false, cell: destination, valid: true, allowed: [destination], style: 'plain' };
            f.layer.updatePreview(ghost); f.life.sync(f.state, f.layout, f.layer);
            expect(f.life.walkingObstructionProof()!.triangles).toBe(initialProof.triangles);
            expect(access(f, 'l14').approaches).toEqual(initialProof.ownerAccess.find(owner => owner.id === 'l14')!.approaches);
            f.layer.updatePreview();
            expect(canPlace(f.state, destination, 'l14', f.world)).toBe(true);
            f.command({ type: 'move', id: 'l14', cell: destination }, 'grove-tree-move');
            expect(f.state.landmarks.find(owner => owner.id === 'l14')!.cell).toEqual(destination);
            expect(access(f, 'l14').approaches.length).toBeGreaterThan(0);
            expect(access(f, 'l14').approaches).not.toContainEqual(treeEntry);
            for (const entry of access(f, 'l14').approaches) expect(Math.hypot(entry.x - destination.x, entry.z - destination.z)).toBeLessThanOrEqual(1.1);
            const movedTriangles = f.life.walkingObstructionProof()!.triangles;
            f.command({ type: 'store', id: 'l14' }, 'grove-tree-store');
            expect(f.life.walkingObstructionProof()!.ownerAccess.find(owner => owner.id === 'l14')).toBeUndefined();
            expect(f.life.walkingObstructionProof()!.triangles).toBeLessThan(movedTriangles);
            f.command({ type: 'unstore', id: 'l14', cell: treeCell }, 'grove-tree-restore');
            expect(f.life.walkingObstructionProof()!.triangles).toBe(initialProof.triangles);
            expect(access(f, 'l14').approaches).toEqual(initialProof.ownerAccess.find(owner => owner.id === 'l14')!.approaches);
            f.life.tick(2, 0, false, false); f.checkPose();
            expect(JSON.stringify(f.world.floors)).toBe(floors); expect(landCells(f.state, f.world)).toHaveLength(73);
            expect(f.state.plots).toEqual(saved.plots); expect(f.state.landmarks).toEqual(saved.landmarks);
            expect(f.state.nature).toEqual(saved.nature); expect(f.state.villagers).toEqual(saved.villagers);
            expect(f.life.takePlaceUses()).toEqual([]);
        } finally { f.dispose(); }
    });
});
