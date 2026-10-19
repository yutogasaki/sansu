import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import manifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import profile from '../../../../../docs/design/2026-10-11-authored-flower-garden/native-flower-support-profile.json';
import { compileWorldDefinition, type IslandWorld } from '../../../../domain/growingIsland/worldDefinition';
import { applyIntent, canPlace } from '../../../../domain/growingIsland/commands';
import { advanceNature } from '../../../../domain/growingIsland/nature';
import { derivePlaces } from '../../../../domain/growingIsland/places';
import { landCells, key, approachCells, reachableFromHome, walkableCells, isReachable, HOME_CELL } from '../../../../domain/growingIsland/space';
import { authoredAccessWorld } from '../../../../domain/growingIsland/authoredWorldAccess.fixture';
import { newLegacyIsland as newIsland } from '../../../../domain/growingIsland/legacy.fixture';
import type { Command, GrowingState } from '../../../../domain/growingIsland/types';
import { GardenGeometry } from '../../three/garden/geometry';
import { IslandMaterials, disposeGeometry } from '../../three/primitives';
import { sceneLayout } from '../sceneLayout';
import { authoredFlowerWalkSet, measureAuthoredWalkingEnvelope } from '../authoredFlowerObstructions';
import { disposeActor, makeVillagerActor, wrapPokomoko } from '../actors';
import { makePokomokoRig } from '../../three/islandCharacters';
import { actorSeatSurface, alignActorContact, alignActorOnSeat, resetActorVisualContact, setActorVisualScale } from '../actorScale';
import { buildObjectLayer, previewGrowingState } from '../objectLayer';
import { buildPlaceFlowerRoof } from '../placeFlowerGeometry';
import { growingHitTarget } from '../growingHitTarget';
import { buildColorFlower } from '../flowerGeometry';
import { makeNativeGrowingKit, type NativeGrowingKit } from './nativeGrowingKit';
import { makeNativeAuthoredFlower, type NativeAuthoredFlower, type NativeAuthoredFlowerSkin } from './nativeAuthoredFlower';

let kit: NativeGrowingKit, support: NativeAuthoredFlower, world: IslandWorld;
let original: GrowingState, young: GrowingState, mature: GrowingState, epoch: number;
const members = ['l17', 'l18', 'l19', 'l31'];
const checksum = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
beforeAll(async () => {
    const bytes = gunzipSync(readFileSync('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz'));
    kit = makeNativeGrowingKit((await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene, manifest);
    const compressed = readFileSync('prototypes/place-qa/native-flower-support.json.gz'), expanded = gunzipSync(compressed);
    expect(checksum(compressed)).toBe(profile.artifact.sha256); expect(checksum(expanded)).toBe(profile.artifact.expandedSha256);
    support = makeNativeAuthoredFlower(JSON.parse(expanded.toString()) as NativeAuthoredFlowerSkin);
    // The P05 region uses its real native dry floor. Wide water composition and
    // browser clock/save evidence are deliberately left to the integrated QA.
    world = compileWorldDefinition(JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native05-world.json.gz')).toString()));
    const fixture = JSON.parse(readFileSync('prototypes/place-qa/authored-water-fixture.json', 'utf8'));
    original = fixture.state; epoch = fixture.epoch; young = structuredClone(original);
    const commands: Command[] = [
        { type: 'place', kind: 'sapling', cell: { x: 1, z: -4 } },
        { type: 'place', kind: 'sapling', cell: { x: 4, z: -3 } },
        { type: 'place', kind: 'bench', cell: { x: 4, z: -2 } },
        { type: 'place', kind: 'flower', color: 'white', cell: { x: 8, z: -4 } },
        { type: 'place', kind: 'water-bowl', cell: { x: 8, z: -2 } },
    ];
    for (const [i, command] of commands.entries()) young = applyIntent(young, { id: `flower-unit-purchase-${i}`, command }, epoch, world).state;
    mature = structuredClone(young); advanceNature(mature, epoch + 6 * 3_600_000, world);
}, 20000);
afterAll(() => { support?.dispose(); kit?.dispose(); });

const meshes = (root: T.Object3D) => { const found: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) found.push(node); }); return found; };
const crownParts = (root: T.Object3D) => { const found: T.Object3D[] = []; root.traverse(node => { if (node.userData.nativePart === 'flower-crown') found.push(node); }); return found; };
const p05 = (state: GrowingState, context = world) => derivePlaces(state, context).find(place => place.ruleId === 'P05' && place.mainIds.includes('l17'))!;
function flowerArt(state: GrowingState) {
    const place = p05(state), layout = sceneLayout(state, false, world), g = new GardenGeometry();
    buildPlaceFlowerRoof(g, state, layout, place, kit, support); g.root.updateMatrixWorld(true);
    return { g, layout, place };
}
function release(g: GardenGeometry) {
    for (const geometry of new Set(meshes(g.root).filter(mesh => !mesh.userData.nativeSharedGeometry).map(mesh => mesh.geometry))) geometry.dispose();
    g.dispose();
}

describe('authored P05 comes from current owned flowers and existing ground', () => {
    it('uses a normal white purchase and natural bloom to unlock exactly one proportional source crown', () => {
        expect([...original.plots, ...original.landmarks]).toHaveLength(27);
        expect([...young.plots, ...young.landmarks]).toHaveLength(32);
        expect(young.landmarks.find(owner => owner.id === 'l31')).toMatchObject({ kind: 'flower', color: 'white', growth: 0, cell: { x: 8, z: -4 } });
        expect(mature.landmarks.find(owner => owner.id === 'l31')?.growth).toBe(6);
        expect(mature.nature.hours - young.nature.hours).toBeCloseTo(6, 8);
        expect(mature.town).toEqual(young.town); expect(mature.drops).toBe(9230); expect(mature.nextId).toBe(33);
        const before = flowerArt(young), after = flowerArt(mature);
        expect(before.place.stage).toBe('connected'); expect(crownParts(before.g.root)).toHaveLength(0);
        expect(before.g.root.getObjectsByProperty('name', 'authored-flower-owned-stock').map(stock => stock.userData.ownerId).sort()).toEqual(members.filter(id => id !== 'l31'));
        expect(after.place.stage).toBe('grown'); expect(after.place.mainIds).toEqual(members);
        expect(crownParts(after.g.root)).toHaveLength(1);
        const crown = after.g.root.getObjectByName('authored-flower-main-crown')!;
        expect(crown.scale.toArray()).toEqual([.45, .45, .45]); expect(crown.userData.ownerIds).toEqual(members);
        const dimensions = new T.Box3().setFromObject(crown).getSize(new T.Vector3());
        dimensions.toArray().forEach((value, axis) => expect(value).toBeCloseTo((manifest.parts['flower-crown'].max[axis] - manifest.parts['flower-crown'].min[axis]) * .45, 5));
        expect(after.g.root.getObjectByName('place-flower-garden-inlay')).toBeUndefined();
        expect(after.place.walkSurface).toEqual([]); expect(after.place.useTargets).toEqual([{ id: 'l27', kind: 'seat', cell: { x: 12, z: -4 } }]);
        release(before.g); release(after.g);
    });

    it('keeps all old owners, P01/P03 conditions, clocks, source floors, anchors, 73 rights and grants unchanged by rendering', () => {
        for (const owner of [...original.plots, ...original.landmarks]) expect([...mature.plots, ...mature.landmarks].find(current => current.id === owner.id)).toEqual(owner);
        const state = structuredClone(mature), saved = structuredClone(state), places = derivePlaces(state, world), definitionHash = checksum(JSON.stringify(world.definition));
        const rights = landCells(state, world), samples = rights.map(cell => [world.siteAt(cell), world.floorAt(cell)]);
        const { g } = flowerArt(state);
        expect(state).toEqual(saved); expect(derivePlaces(state, world)).toEqual(places);
        expect(places.find(place => place.ruleId === 'P03')?.memberIds).toContain('l16');
        expect(p05(state).mainIds).not.toContain('l16'); expect(rights).toHaveLength(73);
        expect(landCells(state, world)).toEqual(rights); expect(rights.map(cell => [world.siteAt(cell), world.floorAt(cell)])).toEqual(samples);
        expect(checksum(JSON.stringify(world.definition))).toBe(definitionHash);
        expect(meshes(g.root).every(mesh => mesh.userData.visualOnly)).toBe(true);
        g.root.traverse(node => { expect(node.userData.floorRoute).toBeUndefined(); expect(node.userData.galleryTarget).toBeUndefined(); });
        release(g);
    });

    it('grounds every thick stock in its actual owned footprint and preserves the original low flower colours', () => {
        const state = structuredClone(mature), { g, layout } = flowerArt(state);
        const stocks = g.root.getObjectsByProperty('name', 'authored-flower-owned-stock'); expect(stocks).toHaveLength(4);
        for (const stock of stocks) {
            const owner = state.landmarks.find(owner => owner.id === stock.userData.ownerId)!;
            expect(stock.userData).toMatchObject({ growth: owner.growth, color: owner.color, sourceScale: .45, visualOnly: true });
            expect(stock.userData.groundPoint).toEqual(layout.point(owner.cell!, 0).toArray());
            let lowest = Infinity, maximumGroundRise = -Infinity;
            // Grounded roots and the low stock stay in the owner's footprint.
            // High tip leaves and the seat bough intentionally reach beyond it;
            // the real-actor path/seat test below covers their physical clearance.
            for (const mesh of meshes(stock).filter(mesh => mesh.name === 'authored-flower-stock')) {
                expect(mesh.userData.sourceSha256).toBe(profile.source.sha256);
                const positions = mesh.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    const point = new T.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld), cell = layout.logicalAt(point), floor = world.floorAt(cell);
                    expect(floor).toBeDefined(); expect(Math.abs(cell.x - owner.cell!.x)).toBeLessThan(.46); expect(Math.abs(cell.z - owner.cell!.z)).toBeLessThan(.46);
                    lowest = Math.min(lowest, point.y - floor!.point.y); maximumGroundRise = Math.max(maximumGroundRise, floor!.point.y - layout.point(owner.cell!, 0).y);
                }
            }
            const sourceMinimum = Math.min(...profile.parts.filter(part => ['trunk', 'root', 'ridge', 'grown-branch'].includes(part.role)).map(part => part.bounds.min[1])) * stock.userData.stockHeight / profile.stockHeight;
            expect(lowest).toBeLessThan(.001); expect(lowest).toBeGreaterThanOrEqual(sourceMinimum - maximumGroundRise - 1e-7);
        }
        const material = new IslandMaterials('moon-garden'), layer = buildObjectLayer(material, state, layout, undefined, undefined, [], kit, support);
        for (const id of members) {
            const owner = state.landmarks.find(owner => owner.id === id)!, ordinary = layer.objects.get(id)!.children[0], expected = buildColorFlower(material, owner.color!, owner.growth);
            expect(ordinary.visible).toBe(true);
            const dimensions = new T.Box3().setFromObject(ordinary).getSize(new T.Vector3()).toArray(), source = new T.Box3().setFromObject(expected).getSize(new T.Vector3()).toArray();
            dimensions.forEach((value, axis) => expect(value).toBeCloseTo(source[axis], 10));
            expect(meshes(ordinary).map(mesh => (mesh.material as T.MeshStandardMaterial).color.getHex())).toEqual(meshes(expected).map(mesh => (mesh.material as T.MeshStandardMaterial).color.getHex()));
            disposeGeometry(expected);
        }
        layer.dispose(); material.dispose(); release(g);
    });

    it('keeps real selectable geometry for every flower ID rather than assigning the whole garden to its anchor', () => {
        const state = structuredClone(mature), material = new IslandMaterials('moon-garden'), layout = sceneLayout(state, false, world);
        const layer = buildObjectLayer(material, state, layout, undefined, undefined, [], kit, support); layer.root.updateMatrixWorld(true);
        const stocks = layer.placeRoot.getObjectsByProperty('name', 'authored-flower-owned-stock');
        for (const id of members) {
            expect(layer.objects.has(id)).toBe(true);
            const stock = stocks.find(stock => stock.userData.ownerId === id)!;
            expect(meshes(stock).every(mesh => mesh.userData.objectId === id)).toBe(true);
            const at = layout.point(state.landmarks.find(owner => owner.id === id)!.cell!, .23);
            const ray = new T.Raycaster(at.clone().add(new T.Vector3(0, 0, .8)), new T.Vector3(0, 0, -1));
            expect(growingHitTarget(ray.intersectObject(layer.root, true), true)?.object.userData.objectId).toBe(id);
        }
        layer.dispose(); material.dispose();
    });

    it('does not turn a fifth young member into a mature stock or canopy support when four other flowers are already grown', () => {
        const { world: context } = authoredAccessWorld(), state = newIsland('young-fifth-source-flower', 1000);
        // Supplied mature ages isolate preservation. The actual purchase/clock
        // test above proves how l31 becomes the required fourth blooming member.
        state.landmarks = Array.from({ length: 5 }, (_, i) => ({ id: `flower-${i}`, kind: 'flower' as const, color: 'white' as const,
            cell: { x: i, z: -2 }, growth: i === 4 ? 0 : 6 }));
        state.landmarks.push({ id: 'flower-seat', kind: 'bench', cell: { x: 3, z: -1 }, growth: 0 });
        const place = derivePlaces(state, context).find(place => place.ruleId === 'P05')!, saved = structuredClone(state), g = new GardenGeometry();
        expect(place.stage).toBe('grown'); buildPlaceFlowerRoof(g, state, sceneLayout(state, false, context), place, kit, support);
        expect(crownParts(g.root)).toHaveLength(1);
        expect(g.root.getObjectsByProperty('name', 'authored-flower-owned-stock').map(stock => stock.userData.ownerId)).toEqual(state.landmarks.slice(0, 4).map(owner => owner.id));
        expect(g.root.getObjectByName('authored-flower-shared-support')!.userData.ownerIds).not.toContain('flower-4');
        expect(state).toEqual(saved); release(g);
    });

    it('splits and stores through commands, restores the same owners and crown, and cancels a preview without changing saved geometry', () => {
        const state = structuredClone(mature), saved = structuredClone(state), cell = { x: 8, z: -4 }, away = { x: 12, z: -9 };
        expect(canPlace(state, away, 'l31', world)).toBe(true);
        const moved = applyIntent(state, { id: 'flower-split', command: { type: 'move', id: 'l31', cell: away } }, epoch, world).state;
        const split = flowerArt(moved); expect(crownParts(split.g.root)).toHaveLength(0); release(split.g);
        const stored = applyIntent(state, { id: 'flower-store', command: { type: 'store', id: 'l31' } }, epoch, world).state;
        expect(stored.landmarks.find(owner => owner.id === 'l31')).toEqual({ ...state.landmarks.find(owner => owner.id === 'l31'), cell: undefined });
        const missing = flowerArt(stored); expect(crownParts(missing.g.root)).toHaveLength(0); release(missing.g);
        const restored = applyIntent(stored, { id: 'flower-restore', command: { type: 'unstore', id: 'l31', cell } }, epoch, world).state;
        expect(restored.landmarks).toEqual(state.landmarks); expect(restored.nature).toEqual(state.nature); expect(restored.town).toEqual(state.town);
        const rejoined = flowerArt(restored); expect(crownParts(rejoined.g.root)).toHaveLength(1); expect(rejoined.place.revision).toBe(p05(state).revision); release(rejoined.g);
        const material = new IslandMaterials('moon-garden'), layout = sceneLayout(state, false, world), layer = buildObjectLayer(material, state, layout, undefined, undefined, [], kit, support);
        const root = layer.placeRoot, geometry = meshes(root).map(mesh => [mesh, mesh.geometry, mesh.material]);
        const ghost = { kind: 'flower' as const, color: 'white' as const, ownerId: 'l31', seed: false, style: 'plain' as const, cell: away, valid: true, allowed: [away] };
        expect(previewGrowingState(state, ghost)!.landmarks.find(owner => owner.id === 'l31')?.growth).toBe(6);
        layer.updatePreview(ghost); expect(layer.root.getObjectByName('growing-ghost')).toBeDefined();
        layer.updatePreview(); expect(layer.root.getObjectByName('growing-ghost')).toBeUndefined(); expect(layer.placeRoot).toBe(root);
        expect(meshes(root).map(mesh => [mesh, mesh.geometry, mesh.material])).toEqual(geometry); expect(state).toEqual(saved);
        const reached = reachableFromHome(state, walkableCells(state, world), world);
        expect(approachCells({ x: 12, z: -4 }, world).some(cell => reached.has(key(cell)))).toBe(true);
        layer.dispose(); material.dispose();
    });
    it('avoids source stocks with actual .45 actors, retains all 32 owner approaches and the real bench pose/exit, and releases stored stock', () => {
        const state = structuredClone(mature), material = new IslandMaterials('moon-garden'), layout = sceneLayout(state, false, world);
        const layer = buildObjectLayer(material, state, layout, undefined, undefined, [], kit, support);
        const rig = makePokomokoRig(material), hero = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet); setActorVisualScale(hero, .45);
        const actors = [hero, ...state.villagers.map(villager => makeVillagerActor(material, villager, .45))], base = walkableCells(state, world), definition = checksum(JSON.stringify(world.definition));
        try {
            const envelope = measureAuthoredWalkingEnvelope(actors), filtered = authoredFlowerWalkSet(base, world, layout, layer.placeRoot, envelope);
            for (const id of members) {
                const cell = state.landmarks.find(owner => owner.id === id)!.cell!;
                expect(base.has(key(cell))).toBe(true); expect(filtered.walkable.has(key(cell))).toBe(false);
            }
            expect(filtered.proof.blockedPoints).toBeGreaterThan(0); expect(filtered.proof.excludedCells).toHaveLength(filtered.proof.excludedRefs);
            const reached = reachableFromHome(state, filtered.walkable, world);
            const missing = [...state.plots, ...state.landmarks].filter(owner => owner.cell && !isReachable(owner.cell, reached, world)).map(owner => owner.id);
            const baselineReached = reachableFromHome(state, base, world), baselineMissing = [...state.plots, ...state.landmarks].filter(owner => owner.cell && !isReachable(owner.cell, baselineReached, world)).map(owner => owner.id);
            expect(baselineMissing).toEqual([]); expect(missing).toEqual([]); expect(checksum(JSON.stringify(world.definition))).toBe(definition); expect(walkableCells(state, world)).toEqual(base);
            const checked = new Set<string>();
            for (const id of filtered.walkable) {
                const [x, z] = id.split(',').map(Number), from = { x, z };
                for (const to of world.neighbors(from)) {
                    if (!filtered.walkable.has(key(to))) continue;
                    const edge = [id, key(to)].sort().join('|'); if (checked.has(edge)) continue; checked.add(edge);
                    expect(filtered.clearGroundPath(from, to)).toBe(true);
                }
            }
            expect(checked.size).toBeGreaterThan(1000);
            const bench = state.landmarks.find(owner => owner.id === 'l27')!, entrance = approachCells(bench.cell!, world).find(cell => reached.has(key(cell)))!;
            const route = world.route(HOME_CELL, entrance, filtered.walkable); expect(route).toBeDefined();
            for (let i = 1; i < route!.length; i++) expect(filtered.clearGroundPath(route![i - 1], route![i])).toBe(true);
            const seat = actorSeatSurface(layer.objects.get('l27')!, 'sit'); expect(seat).toBeDefined();
            for (const actor of actors) {
                actor.root.position.copy(layout.point(bench.cell!, .16)); actor.root.rotation.set(0, 0, 0); actor.body.rotation.x = -.38;
                actor.feet.forEach(foot => foot.rotation.x = .5); resetActorVisualContact(actor); alignActorOnSeat(actor, seat!, layout.point(bench.cell!, 0).y);
                expect(filtered.poseClear(actor)).toBe(true);
                actor.root.position.copy(layout.point(entrance, 0)); actor.root.rotation.set(0, .9, 0); actor.body.rotation.x = 0;
                actor.feet.forEach(foot => foot.rotation.x = 0); resetActorVisualContact(actor); alignActorContact(actor, layout.point(entrance, 0).y);
                expect(filtered.poseClear(actor)).toBe(true);
            }
            expect(filtered.clearGroundPath(entrance, bench.cell!)).toBe(true);
            const stored = applyIntent(state, { id: 'walk-filter-store', command: { type: 'store', id: 'l31' } }, epoch, world).state;
            const missingArt = flowerArt(stored), restored = authoredFlowerWalkSet(walkableCells(stored, world), world, missingArt.layout, missingArt.g.root, envelope);
            expect(restored.walkable.has('8,-4')).toBe(true); expect(restored.proof.stockCount).toBe(3); release(missingArt.g);
        } finally { actors.forEach(disposeActor); layer.dispose(); material.dispose(); }
    });

    it('grows the garden edge toward its current real seat and removes it in a move preview or storage without moving owners', () => {
        const state = structuredClone(mature), saved = structuredClone(state), art = flowerArt(state);
        const edges = art.g.root.getObjectsByProperty('name', 'authored-flower-seat-bough');
        expect(edges).toHaveLength(1); expect(edges[0].userData).toMatchObject({ ownerId: 'l19', seatId: 'l27' });
        expect(edges[0].userData.seatPoint).toEqual(art.layout.point({ x: 12, z: -4 }, 0).toArray());
        const overhead = new T.Raycaster(art.layout.point({ x: 12, z: -4 }, 4), new T.Vector3(0, -1, 0));
        expect(overhead.intersectObject(edges[0], true).some(hit => hit.object.userData.nativeRoles?.includes('leaf'))).toBe(true);
        expect(state).toEqual(saved); release(art.g);
        const away = { x: 12, z: -9 }; expect(canPlace(state, away, 'l27', world)).toBe(true);
        const ghost = { kind: 'bench' as const, ownerId: 'l27', seed: false, style: 'plain' as const, cell: away, valid: true, allowed: [away] };
        const preview = flowerArt(previewGrowingState(state, ghost)!);
        expect(preview.g.root.getObjectsByProperty('name', 'authored-flower-seat-bough')).toHaveLength(0); release(preview.g);
        const moved = applyIntent(state, { id: 'foliage-seat-move', command: { type: 'move', id: 'l27', cell: away } }, epoch, world).state;
        const movedArt = flowerArt(moved);
        expect(movedArt.g.root.getObjectsByProperty('name', 'authored-flower-seat-bough')).toHaveLength(0); release(movedArt.g);
        const stored = applyIntent(state, { id: 'foliage-seat-store', command: { type: 'store', id: 'l27' } }, epoch, world).state;
        const storedArt = flowerArt(stored);
        expect(storedArt.g.root.getObjectsByProperty('name', 'authored-flower-seat-bough')).toHaveLength(0); release(storedArt.g);
        const restored = applyIntent(stored, { id: 'foliage-seat-restore', command: { type: 'unstore', id: 'l27', cell: { x: 12, z: -4 } } }, epoch, world).state;
        const restoredArt = flowerArt(restored);
        expect(restoredArt.g.root.getObjectsByProperty('name', 'authored-flower-seat-bough')).toHaveLength(1);
        expect(restored.landmarks).toEqual(saved.landmarks); expect(restored.nature).toEqual(saved.nature); expect(state).toEqual(saved);
        release(restoredArt.g);
    });

});
