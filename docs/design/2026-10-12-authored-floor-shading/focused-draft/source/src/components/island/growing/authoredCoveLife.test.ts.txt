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
import { isReachable, key, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import type { Cell, Command, GrowingState } from '../../../domain/growingIsland/types';
import { compileWorldDefinition, type IslandWorld } from '../../../domain/growingIsland/worldDefinition';
import { makePokomokoRig } from '../three/islandCharacters';
import { IslandMaterials } from '../three/primitives';
import { actorFootMinY } from './actorScale';
import { wrapPokomoko, type Actor } from './actors';
import { authoredFlowerWalkSet, measureAuthoredWalkingEnvelope } from './authoredFlowerObstructions';
import { GrowingLife } from './growingLife';
import { buildObjectLayer, type Ghost } from './objectLayer';
import { sceneLayout } from './sceneLayout';
import { makeNativeAuthoredCove, type NativeAuthoredCove } from './native/nativeAuthoredCove';
import { makeNativeAuthoredFlower, type NativeAuthoredFlower, type NativeAuthoredFlowerSkin } from './native/nativeAuthoredFlower';
import { makeNativeGrowingKit, type NativeGrowingKit } from './native/nativeGrowingKit';

const options = { water: true, cove: true }, friend = 'authored-friend-0', play = { x: 8, z: 0 };
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
function fixture(mixed = false, initialGhost?: Ghost) {
    let state = structuredClone(initial), frame = authoredWorldFrame(state, base, options);
    const layoutFor = () => sceneLayout(state, false, frame.world, frame.waterPlan, base, { options, covePlan: frame.covePlan, revision: frame.revision });
    let layout = layoutFor();
    const m = new IslandMaterials('moon-garden'), rig = makePokomokoRig(m), hero = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
    const build = (ghost?: Ghost) => buildObjectLayer(m, state, layout, ghost, undefined, [], kit, mixed ? flowers : undefined, cove);
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
        expect(collisions.poseClear(actor()), 'actual posed actor intersects the native shell, ribs, entrance or flower triangles').toBe(true);
        const walker = walkers.get(friend)!, floor = frame.world.floorAt(walker.mode === 'seat' ? walker.seat!.cell : walker.at);
        expect(floor, `real floor under ${JSON.stringify(walker.at)}`).toBeDefined();
        const sole = actorFootMinY(actor())!;
        expect(sole).toBeGreaterThanOrEqual(floor!.point.y - 1e-6);
        expect(sole).toBeLessThanOrEqual(floor!.point.y + (walker.mode === 'seat' ? .041 : .035 * .45) + 1e-6);
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

describe('actual authored P04 cove life', () => {
    it('keeps every placed owner approachable through a safe p9 move, storage and return', () => {
        const f = fixture(true), saved = structuredClone(f.state), destination = { x: 12, z: -9 };
        const checkAccess = (ownerCount: number, coveCount: number) => {
            const proof = f.life.walkingObstructionProof()!;
            expect(proof).toMatchObject({ stockCount: 4, coveCount });
            expect(proof.triangles).toBeGreaterThan(0);
            expect(proof.ownerAccess).toHaveLength(ownerCount);
            expect(proof.ownerAccess.filter(owner => !owner.reachable).map(owner => owner.id)).toEqual([]);
        };
        try {
            checkAccess(32, 1);
            expect(canPlace(f.state, destination, 'p9', f.world)).toBe(true);
            f.command({ type: 'move', id: 'p9', cell: destination }, 'safe-cove-play-move');
            expect(f.state.plots.find(owner => owner.id === 'p9')!.cell).toEqual(destination);
            checkAccess(32, 0);
            f.command({ type: 'store', id: 'p9' }, 'safe-cove-play-store');
            expect(f.state.plots.find(owner => owner.id === 'p9')!.cell).toBeUndefined();
            checkAccess(31, 0);
            f.command({ type: 'unstore', id: 'p9', cell: play }, 'safe-cove-play-return');
            checkAccess(32, 1);
            expect(f.state.plots).toEqual(saved.plots); expect(f.state.landmarks).toEqual(saved.landmarks);
            expect(f.life.takePlaceUses()).toEqual([]);
        } finally { f.dispose(); }
    });

    it('distinguishes a legal play placement blocking the existing main route from lost shared floor', () => {
        const f = fixture(true), saved = structuredClone(f.state), oldFloors = f.world.floors, choke = { x: 4, z: -4 };
        try {
            expect(f.life.walkingObstructionProof()!.ownerAccess.every(owner => owner.reachable)).toBe(true);
            expect(canPlace(f.state, choke, 'p9', f.world)).toBe(true);
            f.command({ type: 'move', id: 'p9', cell: choke }, 'blocking-cove-play-move');
            const blocked = f.life.walkingObstructionProof()!;
            expect(blocked).toMatchObject({ coveCount: 0, stockCount: 4 });
            expect(blocked.ownerAccess.filter(owner => !owner.reachable).map(owner => owner.id)).toEqual([
                'p3', 'p5', 'p6', 'p7', 'p8', 'l10', 'l11', 'l12', 'l13', 'l16', 'l17', 'l18',
                'l19', 'l20', 'l21', 'l22', 'l23', 'l24', 'l25', 'l26', 'l27', 'l28', 'l31', 'l32',
            ]);
            const upstream = authoredWorldFrame(f.state, base, { water: true, cove: false });
            expect(f.world.floors).toEqual(upstream.world.floors);
            expect(f.world.floors.every(floor => oldFloors.some(old => old.id === floor.id && JSON.stringify(old) === JSON.stringify(floor)))).toBe(true);
            // Keep the failed world's floor and neighbors, changing only p9's
            // occupancy back to its original cell. The main route reconnects.
            const reached = reachableFromHome(saved, walkableCells(saved, f.world), f.world);
            expect([...saved.plots, ...saved.landmarks].filter(owner => owner.cell && !isReachable(owner.cell, reached, f.world)).map(owner => owner.id)).toEqual([]);
            f.command({ type: 'move', id: 'p9', cell: play }, 'blocking-cove-play-return');
            expect(f.life.walkingObstructionProof()!.ownerAccess.every(owner => owner.reachable)).toBe(true);
            expect(f.world.floors).toEqual(oldFloors);
            expect(f.state.plots).toEqual(saved.plots); expect(f.state.landmarks).toEqual(saved.landmarks);
            expect(f.life.takePlaceUses()).toEqual([]);
        } finally { f.dispose(); }
    });

    it('retains committed shell obstruction when the initial layer starts with a disappearance preview, including after cancel', () => {
        const cell = { x: 12, z: -9 }, ghost: Ghost = { ownerId: 'p9', kind: 'play', seed: true, style: 'plain', cell, valid: true, allowed: [cell] };
        const f = fixture(false, ghost), saved = structuredClone(f.state);
        try {
            f.freezeOthers();
            const shell = f.layer.placeRoot.getObjectByName('authored-cove-shell')!;
            expect(shell.visible).toBe(false);
            const before = f.life.walkingObstructionProof()!;
            expect(before).toMatchObject({ coveCount: 1, stockCount: 0, groveCount: 5, triangles: 175136 });
            expect(before.blockedEdges).toBeGreaterThan(0); expect(before.excludedCells.length).toBeGreaterThan(0);
            const blocked = before.excludedCells.find(at => at.x > 6 && at.x < 10 && at.z > -.5 && at.z < 1.5)!;
            expect(blocked).toBeDefined();
            f.layer.updatePreview(); expect(shell.visible).toBe(true);
            expect(f.life.walkingObstructionProof()).toEqual(before);
            f.dropAt(blocked, 20); f.life.tick(21, 0, false, false); safeGround(f);
            expect(f.walkers.get(friend)!.at).not.toEqual(blocked);
            expect(f.life.takePlaceUses().filter(value => value.actorId === friend)).toEqual([]);
            expect(f.state).toEqual(saved);
        } finally { f.dispose(); }
    });

    it.each([false, true])('walks from the shared entrance to p9, earns one use and exits safely with mixed flowers=%s', mixed => {
        const f = fixture(mixed), saved = structuredClone(f.state), ids = f.life.actorIds(), identity = f.actor();
        const random = vi.spyOn(Math, 'random');
        try {
            f.freezeOthers();
            const proof = f.life.walkingObstructionProof()!;
            expect(proof.stockCount).toBe(mixed ? 4 : 0); expect(proof.coveCount).toBe(1);
            expect(proof.triangles).toBeGreaterThanOrEqual(79384); expect(proof.ownerAccess.every(owner => owner.reachable)).toBe(true);
            expect(proof.envelope.bands).toHaveLength(8);
            const entrance = { x: 9.65, z: 1.7 };
            expect(f.dropAt(entrance, 0)).toBeUndefined(); f.life.tick(1, 0, false, false);
            expect(f.walkers.get(friend)!.at).toEqual(entrance); safeGround(f);
            const targets = f.layer.places.filter(place => place.stage === 'grown' || place.stage === 'lived')
                .flatMap(place => place.useTargets.map(target => ({ place, target })));
            const targetIndex = targets.findIndex(({ place, target }) => place.ruleId === 'P04' && target.id === 'p9');
            expect(targetIndex).toBeGreaterThanOrEqual(0);
            random.mockReturnValue(.1).mockImplementationOnce(() => .1).mockImplementationOnce(() => (targetIndex + .5) / targets.length);
            const visited: Cell[] = [], checkedEdges = new Set<string>(); let now = 3000;
            for (let tick = 0; tick < 600 && f.walkers.get(friend)!.mode !== 'seat'; tick++) {
                now = 3000 + tick * 50; f.life.tick(now, 50, false, false);
                visited.push({ ...f.walkers.get(friend)!.at }); f.checkPose();
                const path = f.walkers.get(friend)!.path;
                for (let i = 1; i < path.length; i++) {
                    const edge = `${key(path[i - 1])}|${key(path[i])}`;
                    if (checkedEdges.has(edge)) continue;
                    checkedEdges.add(edge);
                    expect(f.world.neighbors(path[i - 1]).map(key)).toContain(key(path[i]));
                    expect(f.collisions.clearGroundPath(path[i - 1], path[i])).toBe(true);
                }
            }
            expect(f.walkers.get(friend)!.seat?.cell).toEqual(play);
            expect(visited.length).toBeGreaterThan(20);
            expect(checkedEdges.size).toBeGreaterThan(2);
            expect(visited.some(at => !base.floorAt(at) && f.world.floorAt(at)), 'the actor walks on the new shared apron').toBe(true);
            // A seated walker retains its final approach in `at`; the rendered
            // actor uses the real play cell. Inspect that actor, not a guessed
            // intermediate waypoint on one of several valid approach routes.
            const rendered = f.layout.logicalAt(f.actor().root.position);
            expect(rendered.x).toBeCloseTo(play.x, 7); expect(rendered.z).toBeCloseTo(play.z, 7);
            expect(f.collisions.clearGroundPath(f.walkers.get(friend)!.at, play)).toBe(true);
            expect(f.life.takePlaceUses().filter(receipt => receipt.actorId === friend)).toEqual([]);
            f.life.tick(now + 800, 16, false, false); f.checkPose();
            const receipt = f.life.takePlaceUses().find(value => value.actorId === friend && value.ruleId === 'P04')!;
            expect(receipt).toMatchObject({ actorId: friend, ruleId: 'P04', targetId: 'p9' });
            const place = f.layer.places.find(place => place.ruleId === 'P04')!;
            expect(receipt.revision).toBe(place.revision);
            const shown = applyIntent(f.state, { id: `cove-shown-${mixed}`, command: { type: 'place-shown', profileId: f.state.seed,
                expectedRevision: 0, ruleId: receipt.ruleId, revision: receipt.revision } }, epoch, f.world).state;
            const used = applyIntent(shown, { id: `cove-used-${mixed}`, command: { type: 'place-used', profileId: f.state.seed,
                expectedRevision: 0, ...receipt } }, epoch, f.world).state;
            expect(used.placeProgress?.uses.P04?.villager).toMatchObject({ actorId: friend, targetId: 'p9', revision: receipt.revision });
            f.life.tick(now + 6100, 0, false, false); expect(f.walkers.get(friend)!.seat).toBeUndefined(); safeGround(f);
            expect(f.life.takePlaceUses().filter(value => value.actorId === friend)).toEqual([]);
            expect(f.life.walkingPoseProof()).toMatchObject({ evacuations: 0, unplaced: 0 });
            expect(f.life.actorIds()).toEqual(ids); expect(f.actor()).toBe(identity); expect(f.state).toEqual(saved);
        } finally { random.mockRestore(); f.dispose(); }
    });

    it('keeps the cove-only release and final-pose guard active when there are zero flower stocks', () => {
        const f = fixture(), saved = structuredClone(f.state), identity = f.actor();
        try {
            f.freezeOthers();
            expect(f.life.walkingObstructionProof()).toMatchObject({ stockCount: 0, coveCount: 1 });
            const blocked = f.collisions.proof.excludedCells.filter(cell => cell.x > 6 && cell.x < 10 && cell.z > -.5 && cell.z < 1.5).slice(0, 4);
            expect(blocked).toHaveLength(4);
            for (const [index, cell] of blocked.entries()) for (const cancel of [false, true]) {
                expect(f.life.pick(friend)).toBe(true); f.life.drag(friend, f.layout.point(cell));
                if (cancel) f.life.cancelCarry(friend, index * 100); else f.life.drop(friend, index * 100);
                f.life.tick(index * 100 + 1, 0, false, false); safeGround(f);
                expect(f.walkers.get(friend)!.at).not.toEqual(cell);
                expect(f.life.takePlaceUses().filter(value => value.actorId === friend)).toEqual([]);
            }
            expect(f.life.walkingPoseProof()!.checked).toBeGreaterThan(0);
            expect(f.actor()).toBe(identity); expect(f.state).toEqual(saved);
        } finally { f.dispose(); }
    });

    it.each([false, true])('returns an occupant of removed apron to real supported ground and restores owners with mixed flowers=%s', mixed => {
        const f = fixture(mixed), identity = f.actor(), saved = structuredClone(f.state), occupied = { x: 9.65, z: 1.7 };
        try {
            f.freezeOthers();
            const oldWorld = f.world;
            expect(base.floorAt(occupied)).toBeUndefined(); expect(f.world.floorAt(occupied)).toBeDefined();
            f.dropAt(occupied, 0); f.life.tick(1, 0, false, false); expect(f.walkers.get(friend)!.at).toEqual(occupied); safeGround(f);
            f.command({ type: 'store', id: 'l32' }, `occupied-cove-store-${mixed}`); f.life.tick(2, 0, false, false);
            expect(f.world).not.toBe(oldWorld); expect(f.world.floorAt(occupied)).toBeUndefined();
            expect(f.walkers.get(friend)!.at).not.toEqual(occupied); safeGround(f);
            expect(f.life.takePlaceUses().filter(value => value.actorId === friend)).toEqual([]);
            f.command({ type: 'unstore', id: 'l32', cell: { x: 8, z: -2 } }, `occupied-cove-restore-${mixed}`); f.life.tick(3, 0, false, false);
            expect(f.life.walkingObstructionProof()).toMatchObject({ coveCount: 1, stockCount: mixed ? 4 : 0 }); safeGround(f);
            expect(f.actor()).toBe(identity); expect(f.state.plots).toEqual(saved.plots); expect(f.state.landmarks).toEqual(saved.landmarks);
            expect(f.state.villagers).toEqual(saved.villagers); expect(f.state.nature).toEqual(saved.nature); expect(f.state.town).toEqual(saved.town);
            expect(f.life.takePlaceUses().filter(value => value.actorId === friend)).toEqual([]);
        } finally { f.dispose(); }
    });
});
