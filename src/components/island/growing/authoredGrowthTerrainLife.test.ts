import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import nativeManifest from '../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import forestManifest from '../../../../prototypes/place-qa/native-forest-stage4-manifest.json';
import galleryManifest from '../../../../prototypes/place-qa/native-gallery-v5-manifest.json';
import { planAuthoredDistrict } from '../../../domain/growingIsland/authoredDistrictWorld';
import type { AuthoredGrowthTerrainCatalog } from '../../../domain/growingIsland/authoredGrowthTerrain';
import { authoredAccessWorld } from '../../../domain/growingIsland/authoredWorldAccess.fixture';
import { authoredWorldFrame } from '../../../domain/growingIsland/authoredWorldFrame';
import { applyIntent } from '../../../domain/growingIsland/commands';
import { TREE_MATURE_HOURS } from '../../../domain/growingIsland/environment';
import { newLegacyIsland as newIsland } from '../../../domain/growingIsland/legacy.fixture';
import { HOME_CELL, key } from '../../../domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../domain/growingIsland/types';
import { compileWorldDefinition, type IslandWorld } from '../../../domain/growingIsland/worldDefinition';
import { makePokomokoRig } from '../three/islandCharacters';
import { IslandMaterials } from '../three/primitives';
import { actorFootMinY } from './actorScale';
import { wrapPokomoko, type Actor } from './actors';
import type { AuthoredWholeArt } from './authoredWholeArt';
import { GrowingLife } from './growingLife';
import { buildObjectLayer } from './objectLayer';
import { sceneLayout } from './sceneLayout';
import { makeNativeAuthoredForest } from './native/nativeAuthoredForest';
import { makeNativeAuthoredGallery } from './native/nativeAuthoredGallery';
import { makeNativeGrowingKit, type NativeGrowingKit } from './native/nativeGrowingKit';

const friend = 'growth-terrain-friend', treeIds = ['growth-life-tree-a', 'growth-life-tree-b'];
const sha = (value: Uint8Array) => createHash('sha256').update(value).digest('hex');
let catalog: AuthoredGrowthTerrainCatalog, acquired: IslandWorld, initial: GrowingState;
let native: NativeGrowingKit, art: AuthoredWholeArt;

beforeAll(async () => {
    const manifest = JSON.parse(readFileSync('prototypes/place-qa/authored-growth-terrain-manifest.json', 'utf8'));
    const compressed = readFileSync(manifest.artifact.path.slice(1)), bytes = gunzipSync(compressed);
    expect(sha(compressed)).toBe(manifest.artifact.sha256); expect(sha(bytes)).toBe(manifest.artifact.expandedSha256);
    catalog = JSON.parse(bytes.toString()); expect(catalog.candidate).toBe(manifest.candidate);

    // The home foundation is an explicit small diagnostic fixture. The acquired
    // district, its connection, growth patches, trees and actor use shipped APIs
    // and assets. This is not evidence of a saved purchase or the whole island.
    const { definition } = authoredAccessWorld();
    const base = compileWorldDefinition({ ...definition, source: catalog.source });
    const parent = { districtId: definition.districts[0].id, portId: 'diagnostic-east' };
    const planned = planAuthoredDistrict(base, { version: 1, candidate: 'growth-life-acquisition-fixture', source: catalog.source,
        templates: [catalog.template], basePorts: [{ ...parent, id: parent.portId, siteId: '5,1', facing: 0 }] }, [],
    { id: 'acquired-growing-shore', templateId: catalog.template.id, parent });
    expect(planned.grant.turn).toBe(0); acquired = planned.world;
    initial = newIsland('growth-terrain-life-diagnostic', 0);
    initial.tutorial = 'done'; initial.guidance!.starter.automatic = false;
    initial.landmarks = [{ x: 2, z: -1 }, { x: 2, z: 0 }].map((cell, i) => ({ id: treeIds[i], kind: 'sapling',
        cell: { x: planned.grant.logicalOrigin.x + cell.x, z: planned.grant.logicalOrigin.z + cell.z },
        growth: TREE_MATURE_HOURS, maturedAt: 0 }));
    initial.soil = {};
    initial.villagers = [{ id: friend, species: 'otter', home: 'pokomoko', arrivedAt: 0, trait: 'mellow',
        variant: { color: 0, accessory: 0, sparkle: false } }];
    expect(initial.landmarks.every(owner => acquired.owns(owner.cell!))).toBe(true);

    const load = async (path: string, gzipSha: string, expandedSha: string, sourceId?: string) => {
        const compressed = readFileSync(path), bytes = gunzipSync(compressed);
        expect(sha(compressed)).toBe(gzipSha); expect(sha(bytes)).toBe(expandedSha);
        const source = (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
        source.userData.sourceId = sourceId; source.userData.sourceSha256 = expandedSha; return source;
    };
    native = makeNativeGrowingKit(await load('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz', nativeManifest.gzipSha256, nativeManifest.sha256), nativeManifest);
    art = {
        forest: makeNativeAuthoredForest(await load(forestManifest.artifact.path.slice(1), forestManifest.artifact.sha256, forestManifest.artifact.expandedSha256, forestManifest.source.id), forestManifest),
        gallery: makeNativeAuthoredGallery(await load(galleryManifest.artifact.path.slice(1), galleryManifest.artifact.sha256, galleryManifest.artifact.expandedSha256, galleryManifest.source.id), galleryManifest),
    };
}, 30_000);

it('walks through the authored outer connection and into the other branch using the normal life route', () => {
    const state = structuredClone(initial), origin = initial.landmarks[0].cell!;
    const ids = [...treeIds, 'growth-life-tree-c', 'growth-life-tree-d'];
    state.landmarks = [{ x: 2, z: -1 }, { x: 2, z: 0 }, { x: 2, z: 1 }, { x: 1, z: 0 }]
        .map((cell, i) => ({ id: ids[i], kind: 'sapling', growth: TREE_MATURE_HOURS, maturedAt: 0,
            cell: { x: origin.x - 2 + cell.x, z: origin.z + 1 + cell.z } }));
    const before = structuredClone(state), options = { water: false, cove: false, growthTerrain: catalog };
    const frame = authoredWorldFrame(state, acquired, options);
    expect(frame.growthTerrainPlan?.rejectedReason).toBeUndefined();
    expect(frame.growthTerrainPlan?.assemblies).toHaveLength(2);
    expect(frame.growthTerrainPlan?.connections).toHaveLength(1);
    const layout = sceneLayout(state, false, frame.world, frame.waterPlan, acquired,
        { options, covePlan: frame.covePlan, revision: frame.revision });
    const materials = new IslandMaterials('moon-garden'), rig = makePokomokoRig(materials);
    const life = new GrowingLife(materials, wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet));
    const layer = buildObjectLayer(materials, state, layout, undefined, undefined, [], native, undefined, undefined, undefined, art);
    const observed = life as unknown as LifeView, walker = () => observed.walkers.get(friend)!;
    const random = vi.spyOn(Math, 'random');
    let now = 0;
    try {
        life.sync(state, layout, layer); life.pick('pokomoko'); life.tick(now, 0, false, false);
        const actor = walker().actor;
        expect(life.walkingObstructionProof()?.obstructionRootCount).toBe(4);
        const connectedId = frame.growthTerrainPlan!.connections[0].id;
        const connectionSites = frame.world.walkSites.filter(site => site.ref.districtId === connectedId && observed.homePaths.has(key(site.cell)));
        expect(connectionSites.length, 'the actual trees must leave a route onto the outer connecting shore').toBeGreaterThan(0);
        const walkTo = (target: Cell) => {
            const open = [...observed.homePaths], index = open.indexOf(key(target));
            expect(index).toBeGreaterThanOrEqual(0);
            // Only the random destination is controlled. No actor, route, mode,
            // body position or floor is replaced to make the trip succeed.
            random.mockReturnValue(.99).mockImplementationOnce(() => .99).mockImplementationOnce(() => (index + .5) / open.length);
            now += 10_000; life.tick(now, 0, false, false);
            expect(walker().mode).toBe('walk'); expect(walker().path.at(-1)).toEqual(target);
            const route = [{ ...walker().at }, ...walker().path.map(cell => ({ ...cell }))];
            for (let i = 0; i < 2400 && walker().mode === 'walk'; i++) {
                now += 50; life.tick(now, 50, false, false);
                expect(walker().actor).toBe(actor); expect(actor.root.visible).toBe(true);
                expect(frame.world.floorAt(walker().at)).toBeDefined();
                expect(life.walkingPoseProof()).toMatchObject({ evacuations: 0, unplaced: 0 });
            }
            expect(walker().at.x).toBeCloseTo(target.x, 6); expect(walker().at.z).toBeCloseTo(target.z, 6);
            return route;
        };
        walkTo(connectionSites[Math.floor(connectionSites.length / 2)].cell);
        const northId = frame.growthTerrainPlan!.assemblies.find(assembly => assembly.socketId === 'north')!.id;
        const otherBranch = frame.world.walkSites.filter(site => site.ref.districtId === northId && observed.homePaths.has(key(site.cell)))
            .sort((a, b) => Math.hypot(b.cell.x - walker().at.x, b.cell.z - walker().at.z) - Math.hypot(a.cell.x - walker().at.x, a.cell.z - walker().at.z));
        expect(otherBranch.length).toBeGreaterThan(0);
        const outerRoute = walkTo(otherBranch[0].cell);
        expect(outerRoute.every(cell => !acquired.floorAt(cell)), 'the resident must use the outer connection, not go back through the acquired base').toBe(true);
        expect(state).toEqual(before);
    } finally { random.mockRestore(); life.dispose(); layer.dispose(); materials.dispose(); }
}, 30_000);
afterAll(() => { art?.forest.dispose(); art?.gallery.dispose(); native?.dispose(); });

interface WalkerView { actor: Actor; at: Cell; path: Cell[]; mode: string }
interface LifeView { walkers: Map<string, WalkerView>; homePaths: Set<string>; walkable: Set<string> }

it('walks autonomously onto the grown shore and evacuates the same resident when its tree is stored', () => {
    let state = structuredClone(initial);
    const before = structuredClone(state), acquiredBefore = JSON.stringify(acquired.definition);
    const options = { water: false, cove: false, growthTerrain: catalog };
    let frame = authoredWorldFrame(state, acquired, options);
    const makeLayout = () => sceneLayout(state, false, frame.world, frame.waterPlan, acquired,
        { options, covePlan: frame.covePlan, revision: frame.revision });
    let layout = makeLayout();
    const materials = new IslandMaterials('moon-garden'), rig = makePokomokoRig(materials);
    const life = new GrowingLife(materials, wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet));
    const build = () => buildObjectLayer(materials, state, layout, undefined, undefined, [], native, undefined, undefined, undefined, art);
    let layer = build();
    // Read-only observation of the actual candidate set and retained route.
    // No actor coordinate, route, mode or target is injected into GrowingLife.
    const observed = life as unknown as LifeView;
    const walker = () => observed.walkers.get(friend)!;
    const random = vi.spyOn(Math, 'random');
    try {
        expect(frame.growthTerrainPlan?.assemblies).toMatchObject([{ shape: 'parallel', ownerIds: treeIds }]);
        expect(layer.root.getObjectsByProperty('name', 'authored-forest-tree').map(tree => tree.userData.ownerId).sort()).toEqual(treeIds);
        life.sync(state, layout, layer); life.pick('pokomoko'); life.tick(0, 0, false, false);
        const actor = walker().actor, start = { ...walker().at };
        const proof = life.walkingObstructionProof()!;
        expect(proof.obstructionRootCount).toBe(2); expect(proof.triangles).toBeGreaterThan(0);
        expect(observed.homePaths.has(key(HOME_CELL))).toBe(true);
        expect(acquired.floorAt(start)).toBeDefined();
        const open = [...observed.homePaths];
        const destinations = frame.world.walkSites.filter(site => !acquired.floorAt(site.cell) && observed.homePaths.has(key(site.cell)))
            .sort((a, b) => Math.hypot(b.cell.x - start.x, b.cell.z - start.z) - Math.hypot(a.cell.x - start.x, a.cell.z - start.z));
        expect(destinations.length, 'the shipped tree obstructions must leave a HOME route to the grown shore').toBeGreaterThan(0);
        const target = destinations[0].cell, targetIndex = open.indexOf(key(target));
        expect(targetIndex).toBeGreaterThanOrEqual(0);
        // Control only the ordinary random destination choice. Route discovery
        // and every interpolated step still run through the unmodified life code.
        random.mockReturnValue(.99).mockImplementationOnce(() => .99).mockImplementationOnce(() => (targetIndex + .5) / open.length);
        life.tick(2000, 0, false, false);
        expect(walker().mode).toBe('walk'); expect(walker().path.at(-1)).toEqual(target);
        const originalRoute = [{ ...walker().at }, ...walker().path.map(cell => ({ ...cell }))];
        expect(originalRoute.some(cell => !acquired.floorAt(cell))).toBe(true);
        for (let i = 1; i < originalRoute.length; i++)
            expect(frame.world.neighbors(originalRoute[i - 1]).map(key)).toContain(key(originalRoute[i]));

        const visited: Cell[] = []; let now = 2000;
        for (let i = 0; i < 1200; i++) {
            now += 50; life.tick(now, 50, false, false);
            const at = { ...walker().at }; visited.push(at);
            expect(actor.root.visible).toBe(true);
            const floor = frame.world.floorAt(at); expect(floor, `support under ${key(at)}`).toBeDefined();
            const shown = layout.logicalAt(actor.root.position);
            expect(shown.x).toBeCloseTo(at.x, 6); expect(shown.z).toBeCloseTo(at.z, 6);
            expect(actorFootMinY(actor)!).toBeGreaterThanOrEqual(floor!.point.y - 1e-6);
            expect(actorFootMinY(actor)!).toBeLessThanOrEqual(floor!.point.y + .035 * layout.actorVisualScale + 1e-6);
            expect(life.walkingPoseProof()).toMatchObject({ evacuations: 0, unplaced: 0 });
            if (!acquired.floorAt(at)) break;
        }
        expect(visited.length).toBeGreaterThan(20);
        expect(acquired.floorAt(walker().at), 'the resident must actually reach a disappearing patch before storage').toBeUndefined();
        expect(walker().mode).toBe('walk'); expect(walker().path.length).toBeGreaterThan(0);
        const removedPosition = { ...walker().at }, stalePath = walker().path.map(cell => ({ ...cell }));
        expect(state).toEqual(before); expect(life.takePlaceUses()).toEqual([]);

        const stored = applyIntent(state, { id: 'growth-life-store', command: { type: 'store', id: treeIds[0] } }, 0, frame.world).state;
        const storedBeforeLife = structuredClone(stored), oldLayer = layer;
        state = stored; frame = authoredWorldFrame(state, acquired, options); layout = makeLayout(); layer = build();
        life.sync(state, layout, layer); oldLayer.dispose();
        expect(frame.growthTerrainPlan?.assemblies).toEqual([]); expect(frame.world).toBe(acquired);
        expect(frame.world.floorAt(removedPosition)).toBeUndefined();
        expect(stalePath.some(cell => !frame.world.floorAt(cell))).toBe(true);
        expect(walker().actor).toBe(actor); expect(walker().path).toEqual([]); expect(walker().mode).toBe('idle');
        expect(observed.homePaths.has(key(walker().at))).toBe(true);
        expect(observed.walkable.has(key(walker().at))).toBe(true);
        expect(acquired.floorAt(walker().at)).toBeDefined();
        life.tick(now + 1, 0, false, false);
        expect(walker().actor).toBe(actor); expect(actor.root.visible).toBe(true);
        expect(walker().path.every(cell => observed.homePaths.has(key(cell)) && acquired.floorAt(cell))).toBe(true);
        const rendered = layout.logicalAt(actor.root.position), support = acquired.floorAt(rendered);
        expect(support).toBeDefined();
        expect(actorFootMinY(actor)!).toBeGreaterThanOrEqual(support!.point.y - 1e-6);
        expect(actorFootMinY(actor)!).toBeLessThanOrEqual(support!.point.y + .035 * layout.actorVisualScale + 1e-6);
        expect(life.walkingPoseProof()?.unplaced).toBe(0);
        expect(state).toEqual(storedBeforeLife); expect(life.takePlaceUses()).toEqual([]);
        expect(state.landmarks.find(owner => owner.id === treeIds[0])).toEqual({ ...before.landmarks[0], cell: undefined });
        expect(state.landmarks.find(owner => owner.id === treeIds[1])).toEqual(before.landmarks[1]);
        expect([state.villagers, state.drops, state.land, state.nextId]).toEqual([before.villagers, before.drops, before.land, before.nextId]);
        expect(JSON.stringify(acquired.definition)).toBe(acquiredBefore);
    } finally { random.mockRestore(); life.dispose(); layer.dispose(); materials.dispose(); }
}, 30_000);
