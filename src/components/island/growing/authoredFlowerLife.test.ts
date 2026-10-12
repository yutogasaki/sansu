import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import { applyIntent } from '../../../domain/growingIsland/commands';
import { advanceNature } from '../../../domain/growingIsland/nature';
import { approachCells, key, landCells, reachableFromHome, walkableCells } from '../../../domain/growingIsland/space';
import { compileWorldDefinition, type IslandWorld } from '../../../domain/growingIsland/worldDefinition';
import type { Cell, Command, GrowingState } from '../../../domain/growingIsland/types';
import { IslandMaterials } from '../three/primitives';
import { makePokomokoRig } from '../three/islandCharacters';
import { wrapPokomoko, type Actor } from './actors';
import { actorFootMinY, actorSeatContact, actorSeatSurface, actorSurfaceY } from './actorScale';
import { authoredFlowerWalkSet, measureAuthoredWalkingEnvelope } from './authoredFlowerObstructions';
import { DROP_PLAY_MS } from './growingDropPlay';
import { GrowingLife } from './growingLife';
import { buildObjectLayer } from './objectLayer';
import { sceneLayout } from './sceneLayout';
import { makeNativeGrowingKit, type NativeGrowingKit } from './native/nativeGrowingKit';
import { makeNativeAuthoredFlower, type NativeAuthoredFlower, type NativeAuthoredFlowerSkin } from './native/nativeAuthoredFlower';

let world: IslandWorld, kit: NativeGrowingKit, support: NativeAuthoredFlower, mature: GrowingState, epoch: number;
const members = ['l17', 'l18', 'l19', 'l31'];
const bench = { x: 12, z: -4 }, fourth = { x: 8, z: -4 };
const friend = 'authored-friend-0';

beforeAll(async () => {
    const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
    kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, manifest);
    support = makeNativeAuthoredFlower(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native-flower-support.json.gz')).toString()) as NativeAuthoredFlowerSkin);
    // Use the actual source dry ground and grants. Water composition and browser
    // rendering are separate integrated checks, rather than substitute fixtures.
    world = compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world.json.gz')).toString()));
    const fixture = JSON.parse(readFileSync('prototypes/place-qa/authored-water-fixture.json', 'utf8'));
    epoch = fixture.epoch; mature = structuredClone(fixture.state);
    const commands: Command[] = [
        { type: 'place', kind: 'sapling', cell: { x: 1, z: -4 } },
        { type: 'place', kind: 'sapling', cell: { x: 4, z: -3 } },
        { type: 'place', kind: 'bench', cell: { x: 4, z: -2 } },
        { type: 'place', kind: 'flower', color: 'white', cell: fourth },
        { type: 'place', kind: 'water-bowl', cell: { x: 8, z: -2 } },
    ];
    for (const [i, command] of commands.entries()) mature = applyIntent(mature, { id: `life-flower-purchase-${i}`, command }, epoch, world).state;
    advanceNature(mature, epoch + 6 * 3_600_000, world);
    expect([...mature.plots, ...mature.landmarks]).toHaveLength(32);
    expect(mature.drops).toBe(9230);
    expect(mature.landmarks.find(owner => owner.id === 'l31')).toMatchObject({ kind: 'flower', color: 'white', cell: fourth, growth: 6 });
}, 20000);
afterAll(() => { support?.dispose(); kit?.dispose(); });

interface WalkerView { actor: Actor; at: Cell; path: Cell[]; mode: string; seat?: { cell: Cell }; play?: { exit: Cell }; placeTarget?: unknown; gallery?: unknown }
function fixture() {
    let state = structuredClone(mature), layout = sceneLayout(state, false, world);
    const m = new IslandMaterials('moon-garden'), rig = makePokomokoRig(m), hero = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
    let layer = buildObjectLayer(m, state, layout, undefined, undefined, [], kit, support);
    const life = new GrowingLife(m, hero);
    life.sync(state, layout, layer); life.tick(0, 0, false, false);
    // Read actual actors and retained routes; all interactions below use the same
    // public operations as the pointer UI, rather than injecting a fake walker.
    const walkers = (life as unknown as { walkers: Map<string, WalkerView> }).walkers;
    const actor = (id = friend) => walkers.get(id)!.actor;
    const physical = () => {
        const envelope = life.walkingObstructionProof()?.envelope ?? measureAuthoredWalkingEnvelope([...walkers.values()].map(walker => walker.actor));
        return authoredFlowerWalkSet(walkableCells(state, world), world, layout, layer.root, envelope);
    };
    let collisions = physical();
    const checkPose = (id = friend) => {
        const value = actor(id); expect(value.root.visible, `${id} is present`).toBe(true);
        expect(collisions.poseClear(value), `${id} intersects a rendered source stock/support/crown triangle`).toBe(true);
        expect(value.visual?.scale.toArray()).toEqual([.45, .45, .45]);
    };
    const refresh = (next: GrowingState) => {
        const previous = layer;
        state = next; layout = sceneLayout(state, false, world);
        layer = buildObjectLayer(m, state, layout, undefined, undefined, [], kit, support);
        life.sync(state, layout, layer); collisions = physical(); previous.dispose();
    };
    const command = (command: Command, id: string) => refresh(applyIntent(state, { id, command }, epoch + 6 * 3_600_000, world).state);
    const freezeOthers = () => { for (const id of life.actorIds()) if (id !== friend) life.pick(id); };
    const dropAt = (cell: Cell, now: number) => {
        expect(life.pick(friend)).toBe(true); life.drag(friend, layout.point(cell)); return life.drop(friend, now);
    };
    return { life, walkers, actor, checkPose, command, refresh, freezeOthers, dropAt,
        get state() { return state; }, get layout() { return layout; }, get layer() { return layer; }, get collisions() { return collisions; },
        dispose() { life.dispose(); layer.dispose(); m.dispose(); } };
}

function expectSafeGround(f: ReturnType<typeof fixture>) {
    const at = f.walkers.get(friend)!.at;
    expect(f.collisions.walkable.has(key(at)), 'release uses an allowed quarter walking point').toBe(true);
    expect(reachableFromHome(f.state, f.collisions.walkable, world).has(key(at))).toBe(true);
    const floor = world.floorAt(at)!;
    expect(floor).toBeDefined();
    const sole = actorFootMinY(f.actor())!;
    expect(sole).toBeGreaterThanOrEqual(floor.point.y - 1e-7);
    expect(sole).toBeLessThanOrEqual(floor.point.y + .035 * .45 + 1e-7);
    f.checkPose();
}

describe('actual authored P05 flower life', () => {
    it('excludes every owned stock centre but preserves an actual safe walk, bench use receipt and exit', () => {
        const f = fixture(), saved = structuredClone(f.state), definition = JSON.stringify(world.definition), ids = f.life.actorIds();
        const random = vi.spyOn(Math, 'random');
        try {
            f.freezeOthers();
            const proof = f.life.walkingObstructionProof()!;
            expect(proof.stockCount).toBe(4); expect(proof.triangles).toBeGreaterThan(0); expect(proof.blockedEdges).toBeGreaterThan(0);
            expect(proof.envelope.source.walkBob).toBe(.035 * .45);
            for (const id of members) {
                const cell = f.state.landmarks.find(owner => owner.id === id)!.cell!;
                expect(proof.excludedCells.map(key), `${id} is a real stock obstruction`).toContain(key(cell));
                expect(f.collisions.walkable.has(key(cell))).toBe(false);
            }
            const reached = reachableFromHome(f.state, f.collisions.walkable, world);
            expect(approachCells(bench, world).some(cell => reached.has(key(cell)))).toBe(true);
            expect(f.dropAt({ x: 7, z: -4 }, 0)).toBeUndefined();
            const targets = f.layer.places.filter(place => place.stage === 'grown' || place.stage === 'lived')
                .flatMap(place => place.useTargets.map(target => ({ place, target })));
            const index = targets.findIndex(({ place, target }) => place.ruleId === 'P05' && target.id === 'l27');
            expect(index).toBeGreaterThanOrEqual(0);
            random.mockReturnValue(.1).mockImplementationOnce(() => .1).mockImplementationOnce(() => (index + .5) / targets.length);
            const visited: Cell[] = []; let now = 3000;
            for (let frame = 0; frame < 600 && f.walkers.get(friend)!.mode !== 'seat'; frame++) {
                now = 3000 + frame * 50; f.life.tick(now, 50, false, false);
                visited.push({ ...f.walkers.get(friend)!.at }); f.checkPose();
                const path = f.walkers.get(friend)!.path;
                for (let i = 1; i < path.length; i++) expect(world.neighbors(path[i - 1]).map(key)).toContain(key(path[i]));
            }
            expect(f.walkers.get(friend)!.seat?.cell, JSON.stringify({ mode: f.walkers.get(friend)!.mode, at: f.walkers.get(friend)!.at, path: f.walkers.get(friend)!.path })).toEqual(bench);
            expect(visited.some(at => at.x > 8 && at.x < 11 && Math.abs(at.z + 4) > .5), 'ordinary life detours around owned stocks').toBe(true);
            f.life.tick(now + 800, 16, false, false); f.checkPose();
            const receipt = f.life.takePlaceUses().find(receipt => receipt.actorId === friend && receipt.ruleId === 'P05')!;
            expect(receipt).toMatchObject({ actorId: friend, targetId: 'l27' });
            expect(receipt.revision).toBe(f.layer.places.find(place => place.ruleId === 'P05' && place.mainIds.includes('l17'))!.revision);
            const shown = applyIntent(f.state, { id: 'life-flower-shown', command: { type: 'place-shown', profileId: f.state.seed,
                expectedRevision: 0, ruleId: receipt.ruleId, revision: receipt.revision } }, epoch + 6 * 3_600_000, world).state;
            const used = applyIntent(shown, { id: 'life-flower-used', command: { type: 'place-used', profileId: f.state.seed,
                expectedRevision: 0, ...receipt } }, epoch + 6 * 3_600_000, world).state;
            expect(used.placeProgress?.uses.P05?.villager).toMatchObject({ actorId: friend, targetId: 'l27', revision: receipt.revision });
            const seat = actorSeatSurface(f.layer.objects.get('l27'), 'sit')!, contact = actorSeatContact(f.actor())!;
            expect(contact.y).toBeCloseTo(actorSurfaceY(seat, contact)!, 7);
            f.life.tick(now + 6100, 0, false, false); expectSafeGround(f);
            expect(f.life.takePlaceUses().filter(receipt => receipt.actorId === friend)).toEqual([]);
            expect(f.life.actorIds()).toEqual(ids); expect(f.state).toEqual(saved);
            expect(landCells(f.state, world)).toHaveLength(73); expect(JSON.stringify(world.definition)).toBe(definition);
        } finally { random.mockRestore(); f.dispose(); }
    });

    it('lands release and gesture cancellation safely from all four occupied stock centres without a false use', () => {
        const f = fixture(), saved = structuredClone(f.state), identity = f.actor();
        try {
            f.freezeOthers();
            for (const [i, id] of members.entries()) {
                const cell = f.state.landmarks.find(owner => owner.id === id)!.cell!;
                for (const cancel of [false, true]) {
                    expect(f.life.pick(friend)).toBe(true); f.life.drag(friend, f.layout.point(cell));
                    if (cancel) f.life.cancelCarry(friend, i * 100); else expect(f.life.drop(friend, i * 100)).toBeUndefined();
                    f.life.tick(i * 100 + 1, 0, false, false);
                    expectSafeGround(f); expect(f.walkers.get(friend)!.at).not.toEqual(cell);
                    expect(f.life.takePlaceUses().filter(receipt => receipt.actorId === friend)).toEqual([]);
                }
            }
            expect(f.actor()).toBe(identity); expect(f.state).toEqual(saved);
        } finally { f.dispose(); }
    });

    it('keeps the same seated resident safe through split, store and reconnect, then safely leaves a removed bench', () => {
        const f = fixture(), identity = f.actor(), villagers = structuredClone(f.state.villagers), clocks = { nature: structuredClone(f.state.nature), town: structuredClone(f.state.town) };
        try {
            f.freezeOthers();
            expect(f.dropAt(bench, 0)).toEqual({ kind: 'bench', cell: bench });
            f.life.tick(900, 0, false, false); f.checkPose();
            expect(f.life.takePlaceUses().some(receipt => receipt.actorId === friend && receipt.ruleId === 'P05')).toBe(true);
            const steps: Command[] = [
                { type: 'move', id: 'l31', cell: { x: 12, z: -9 } },
                { type: 'store', id: 'l31' },
                { type: 'unstore', id: 'l31', cell: fourth },
            ];
            for (const [i, action] of steps.entries()) {
                f.command(action, `occupied-flower-${i}`); f.life.tick(1000 + i * 200, 0, false, false); f.checkPose();
                expect(f.actor()).toBe(identity); expect(f.walkers.get(friend)!.seat?.cell).toEqual(bench);
                expect(f.life.walkingObstructionProof()!.stockCount).toBe(i === 2 ? 4 : 3);
            }
            expect(f.layer.placeRoot.getObjectByName('authored-flower-main-crown')).toBeDefined();
            f.command({ type: 'store', id: 'l27' }, 'occupied-bench-store');
            f.life.tick(1800, 0, false, false); expect(f.walkers.get(friend)!.seat).toBeUndefined(); expectSafeGround(f);
            expect(f.life.takePlaceUses().filter(receipt => receipt.actorId === friend)).toEqual([]);
            expect(f.state.villagers).toEqual(villagers); expect(f.state.nature).toEqual(clocks.nature); expect(f.state.town).toEqual(clocks.town);
        } finally { f.dispose(); }
    });

    it('relocates an existing ground occupant when its stored flower reconnects, and completes safe hand-placed bench play', () => {
        const f = fixture(), identity = f.actor();
        try {
            f.freezeOthers();
            const grownAllowed = new Set(f.collisions.walkable);
            for (const id of members) f.command({ type: 'store', id }, `vacant-flower-store-${id}`);
            expect(f.layer.placeRoot.getObjectByName('authored-flower-support')).toBeUndefined();
            expect(f.collisions.walkable.has(key(fourth))).toBe(true);
            const available = [...reachableFromHome(f.state, f.collisions.walkable, world)].filter(id => !grownAllowed.has(id))
                .map(id => { const [x, z] = id.split(',').map(Number); return { x, z }; })
                .filter(cell => f.collisions.clearGroundPath(cell, cell))
                .sort((a, b) => Math.hypot(a.x - fourth.x, a.z - fourth.z) - Math.hypot(b.x - fourth.x, b.z - fourth.z));
            expect(available.length, 'a real reachable quarter point opens when the fourth stock is stored').toBeGreaterThan(0);
            const occupied = available[0];
            expect(f.dropAt(occupied, 0)).toBeUndefined(); f.life.tick(1, 0, false, false);
            expect(f.walkers.get(friend)!.at).toEqual(occupied); f.checkPose();
            for (const [i, id] of ['l31', 'l17', 'l18', 'l19'].entries()) {
                const cell = mature.landmarks.find(owner => owner.id === id)!.cell!;
                f.command({ type: 'unstore', id, cell }, `occupied-flower-reconnect-${id}`);
                f.life.tick(2 + i, 0, false, false); f.checkPose();
            }
            expectSafeGround(f);
            expect(f.collisions.walkable.has(key(occupied))).toBe(false);
            expect(f.walkers.get(friend)!.at).not.toEqual(occupied); expect(f.actor()).toBe(identity);
            expect(f.state.landmarks).toEqual(mature.landmarks); expect(f.state.villagers).toEqual(mature.villagers);
            expect(f.state.nature).toEqual(mature.nature); expect(f.state.town).toEqual(mature.town);
            expect(f.dropAt(bench, 100)).toEqual({ kind: 'bench', cell: bench });
            for (let now = 100; now <= 100 + DROP_PLAY_MS; now += 100) { f.life.tick(now, 0, false, false); f.checkPose(); }
            f.life.tick(101 + DROP_PLAY_MS, 0, false, false); expectSafeGround(f);
            expect(f.life.takePlaceUses().filter(receipt => receipt.actorId === friend && receipt.ruleId === 'P05')).toHaveLength(1);
        } finally { f.dispose(); }
    });

    it('keeps an unplaced resident hidden across ticks with no source walking refs and recovers the same actor when refs return', () => {
        const f = fixture(), identity = f.actor(), saved = structuredClone(f.state), ids = f.life.actorIds();
        try {
            expect(f.collisions.poseClear(identity)).toBe(true);
            // A diagnostic restriction removes only existing walking refs. The
            // source floors, placements, methods, grants and live flower meshes
            // stay exactly the same; there is no invented floor or fake guard.
            const closed: IslandWorld = { ...world, walkSites: [] };
            expect(closed.floors).toBe(world.floors); expect(closed.definition).toBe(world.definition);
            expect(closed.sites).toBe(world.sites); expect(closed.floorAt(f.walkers.get(friend)!.at)).toEqual(world.floorAt(f.walkers.get(friend)!.at));
            expect(landCells(f.state, closed)).toEqual(landCells(f.state, world));
            expect(walkableCells(f.state, closed).size).toBe(0);
            const sourceSupport = f.layer.placeRoot.getObjectByName('authored-flower-support');
            f.life.sync(f.state, sceneLayout(f.state, false, closed), f.layer);
            expect(f.layer.placeRoot.getObjectByName('authored-flower-support')).toBe(sourceSupport);
            expect(f.life.walkingObstructionProof()!.stockCount).toBe(4);
            expect(f.life.walkingObstructionProof()!.triangles).toBeGreaterThan(0);
            let unplaced = f.life.walkingPoseProof()!.unplaced;
            expect(unplaced).toBeGreaterThan(0);
            for (const now of [100, 200, 300, 1600, 3100]) {
                f.life.tick(now, 16, false, false);
                expect(identity.root.visible).toBe(false); expect(f.life.positionOf(friend)).toBeUndefined();
                expect(f.life.objects()).not.toContain(identity.root);
                expect(f.life.walkingPoseProof()!.unplaced).toBeGreaterThan(unplaced);
                unplaced = f.life.walkingPoseProof()!.unplaced;
                expect(f.life.takePlaceUses().filter(receipt => receipt.actorId === friend)).toEqual([]);
            }
            f.life.sync(f.state, f.layout, f.layer); f.life.tick(3200, 0, false, false);
            expect(f.actor()).toBe(identity); expect(f.life.actorIds()).toEqual(ids);
            expectSafeGround(f); expect(f.life.walkingPoseProof()!.unplaced).toBe(0);
            expect(f.state).toEqual(saved);
        } finally { f.dispose(); }
    });
});
