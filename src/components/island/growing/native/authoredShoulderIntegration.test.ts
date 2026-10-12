import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import nativeManifest from '../../../../../docs/design/2026-10-11-native-owned-island/kit-manifest.json';
import coveManifest from '../../../../../docs/design/2026-10-12-authored-cove-entrance/cove-delivery-manifest.json';
import shoulderManifest from '../../../../../prototypes/place-qa/native-shoulder-manifest.json';
import { authoredWorldFrame } from '../../../../domain/growingIsland/authoredWorldFrame';
import { withNative05WaterCarvingScope } from '../../../../domain/growingIsland/authoredWaterCarving';
import type { AuthoredShoulderProfile } from '../../../../domain/growingIsland/authoredShoulderWorld';
import { applyIntent, canPlace } from '../../../../domain/growingIsland/commands';
import { derivePlaces } from '../../../../domain/growingIsland/places';
import { HOME_CELL, key, landCells, reachableFromHome, walkableCells } from '../../../../domain/growingIsland/space';
import type { Cell, GrowingState } from '../../../../domain/growingIsland/types';
import { compileWorldDefinition, type IslandWorld } from '../../../../domain/growingIsland/worldDefinition';
import { makePokomokoRig } from '../../three/islandCharacters';
import { IslandMaterials } from '../../three/primitives';
import { setActorVisualScale } from '../actorScale';
import { disposeActor, makeVillagerActor, wrapPokomoko } from '../actors';
import { authoredOwnerApproaches, authoredFlowerWalkSet, measureAuthoredWalkingEnvelope } from '../authoredFlowerObstructions';
import { buildObjectLayer, previewGrowingState, type Ghost } from '../objectLayer';
import { sceneLayout } from '../sceneLayout';
import { createWorldScene } from '../worldScene';
import { makeNativeAuthoredCove, type NativeAuthoredCove } from './nativeAuthoredCove';
import { makeNativeAuthoredFlower, type NativeAuthoredFlower, type NativeAuthoredFlowerSkin } from './nativeAuthoredFlower';
import { makeNativeAuthoredShoulder, shoulderFloorFingerprint, type NativeAuthoredShoulder } from './nativeAuthoredShoulder';
import { makeNativeGrowingKit, type NativeGrowingKit } from './nativeGrowingKit';

const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const json = (path: string) => JSON.parse((path.endsWith('.gz') ? gunzipSync(readFileSync(path)) : readFileSync(path)).toString());
const meshes = (root: T.Object3D) => { const result: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) result.push(node); }); return result; };
const triangles = (root: T.Object3D) => meshes(root).reduce((sum, mesh) => sum + mesh.geometry.index!.count / 3, 0);
const roots = (root: T.Object3D) => root.getObjectsByProperty('name', 'authored-tree-root-continuation');
const rootIds = (root: T.Object3D) => roots(root).map(part => part.userData.ownerId as string).sort();
const placeIdentity = (current: GrowingState, world: IslandWorld) => derivePlaces(current, world)
    .filter(place => ['P02', 'P03', 'P04', 'P05'].includes(place.ruleId))
    .map(place => [place.id, place.stage, place.mainIds, place.memberIds, place.waterRefs]);
let base: IslandWorld, state: GrowingState, baseline: GrowingState, epoch: number, profile: AuthoredShoulderProfile;
let native: NativeGrowingKit, cove: NativeAuthoredCove, flowers: NativeAuthoredFlower, shoulder: NativeAuthoredShoulder;
beforeAll(async () => {
    profile = json('prototypes/place-qa/authored-shoulder-profile.json.gz');
    base = withNative05WaterCarvingScope(compileWorldDefinition(json('prototypes/place-qa/native05-world-source-shading.json.gz')));
    const fixture = json('prototypes/place-qa/authored-shoulder-reference-mature.json');
    state = fixture.state; epoch = fixture.epoch ?? state.nature.realAt;
    baseline = json('prototypes/place-qa/authored-flower-reference-mature.json').state;
    const load = async (path: string, gzipSha: string, expandedSha: string) => {
        const compressed = readFileSync(path), bytes = gunzipSync(compressed);
        expect(sha(compressed)).toBe(gzipSha); expect(sha(bytes)).toBe(expandedSha);
        return (await new GLTFLoader().parseAsync(Uint8Array.from(bytes).buffer, '')).scene;
    };
    const treeSource = await load('docs/design/2026-10-11-native-owned-island/native05-owned-kit.glb.gz', nativeManifest.gzipSha256, nativeManifest.sha256);
    native = makeNativeGrowingKit(treeSource, nativeManifest);
    const coveSource = await load(coveManifest.artifact.path.slice(1), coveManifest.artifact.sha256, coveManifest.source.sha256);
    coveSource.userData.sourceId = coveManifest.source.id; coveSource.userData.sourceSha256 = coveManifest.source.sha256;
    cove = makeNativeAuthoredCove(coveSource, coveManifest);
    const shoulderSource = await load(shoulderManifest.artifact.path.slice(1), shoulderManifest.artifact.sha256, shoulderManifest.artifact.expandedSha256);
    shoulderSource.userData.sourceId = shoulderManifest.source.id; shoulderSource.userData.sourceSha256 = shoulderManifest.artifact.expandedSha256;
    shoulder = makeNativeAuthoredShoulder(shoulderSource, shoulderManifest);
    flowers = makeNativeAuthoredFlower(json('prototypes/place-qa/native-flower-support.json.gz') as NativeAuthoredFlowerSkin);
}, 30_000);
afterAll(() => { shoulder?.dispose(); flowers?.dispose(); cove?.dispose(); native?.dispose(); });

const options = () => ({ water: true, cove: true, shoulder: profile });
function setup(current = state, ghost?: Ghost) {
    const frame = authoredWorldFrame(current, base, options());
    const layout = sceneLayout(current, false, frame.world, frame.waterPlan, base, { options: options(), covePlan: frame.covePlan, revision: frame.revision });
    const m = new IslandMaterials('moon-garden');
    const layer = buildObjectLayer(m, current, layout, ghost, undefined, [], native, flowers, cove, shoulder);
    layer.root.updateMatrixWorld(true);
    return { frame, layout, m, layer, dispose() { layer.dispose(); m.dispose(); } };
}
const sceneFor = () => createWorldScene({} as T.WebGLRenderer, undefined, base, undefined, true, undefined, true, profile, shoulder);

// Independent projected-union check of the actual compiled dry triangles. The
// box uses the measured actor width plus the archived 4 cm support margin; a
// centre-line or corner-only floor sample would miss holes between triangles.
function uncoveredActorBox(world: IslandWorld, from: Cell, to: Cell, radius: number) {
    const minX = Math.min(from.x, to.x) - radius, maxX = Math.max(from.x, to.x) + radius;
    const minZ = Math.min(from.z, to.z) - radius, maxZ = Math.max(from.z, to.z) + radius;
    const signedArea = (poly: Cell[]) => poly.reduce((sum, p, i) => {
        const q = poly[(i + 1) % poly.length]; return sum + p.x * q.z - p.z * q.x;
    }, 0) / 2;
    const clip = (poly: Cell[], distance: (point: Cell) => number) => {
        const result: Cell[] = [];
        for (const [i, p] of poly.entries()) {
            const q = poly[(i + 1) % poly.length], d = distance(p), e = distance(q);
            if (d >= 0) result.push(p);
            if ((d >= 0) !== (e >= 0)) {
                const t = d / (d - e); result.push({ x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t });
            }
        }
        return Math.abs(signedArea(result)) > 1e-12 ? result : [];
    };
    let pieces: Cell[][] = [[{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }]];
    for (const floor of world.floors.filter(value => value.kind === 'ground' || value.kind === 'deck')) {
        for (let i = 0; i < floor.indices.length && pieces.length; i += 3) {
            const triangle = floor.indices.slice(i, i + 3).map(index => floor.vertices[index].point);
            if (Math.max(...triangle.map(p => p.x)) < minX || Math.min(...triangle.map(p => p.x)) > maxX
                || Math.max(...triangle.map(p => p.z)) < minZ || Math.min(...triangle.map(p => p.z)) > maxZ) continue;
            if (signedArea(triangle) < 0) triangle.reverse();
            pieces = pieces.flatMap(poly => {
                let inside = poly; const outside: Cell[][] = [];
                for (let edge = 0; edge < 3 && inside.length; edge++) {
                    const p = triangle[edge], q = triangle[(edge + 1) % 3];
                    const distance = (at: Cell) => (q.x - p.x) * (at.z - p.z) - (q.z - p.z) * (at.x - p.x);
                    const remainder = clip(inside, at => -distance(at)); if (remainder.length) outside.push(remainder);
                    inside = clip(inside, distance);
                }
                return outside;
            });
        }
    }
    return pieces.reduce((sum, poly) => sum + Math.abs(signedArea(poly)), 0);
}

describe('actual authored shoulder source-to-runtime integration', () => {
    it('draws the two source top materials once, attaches all three roots, and keeps closed soil out of pointer support', () => {
        const f = setup(), scene = sceneFor(), layout = scene.layout(state), saved = structuredClone(state);
        try {
            const floor = scene.scene.getObjectByName('authored-evaluated-floor') as T.Mesh;
            expect(scene.scene.getObjectsByProperty('name', 'authored-evaluated-floor')).toHaveLength(1);
            const dry = layout.world.floors.filter(value => value.kind === 'ground' || value.kind === 'deck');
            expect(floor.geometry.index!.count).toBe(dry.reduce((sum, value) => sum + value.indices.length, 0));
            const top = dry.filter(value => value.id.includes(shoulderManifest.extension.districtId));
            expect(top.map(value => value.indices.length / 3)).toEqual([1722, 4893]);
            expect(shoulderFloorFingerprint(top)).toBe(shoulderManifest.extension.topFingerprint);
            const positions = floor.geometry.getAttribute('position'), normals = floor.geometry.getAttribute('normal');
            for (const surface of top) {
                const preceding = dry.slice(0, dry.indexOf(surface)), vertexOffset = preceding.reduce((sum, value) => sum + value.vertices.length, 0);
                const indexOffset = preceding.reduce((sum, value) => sum + value.indices.length, 0);
                expect(Array.from(floor.geometry.index!.array.slice(indexOffset, indexOffset + surface.indices.length)))
                    .toEqual(surface.indices.map(index => index + vertexOffset));
                for (const index of new Set(surface.indices)) {
                    const vertex = surface.vertices[index], output = vertexOffset + index;
                    expect([positions.getX(output), positions.getY(output), positions.getZ(output)])
                        .toEqual([vertex.point.x - layout.center, vertex.point.y, vertex.point.z - 2].map(Math.fround));
                    expect([normals.getX(output), normals.getY(output), normals.getZ(output)])
                        .toEqual([vertex.normal!.x, vertex.normal!.y, vertex.normal!.z].map(Math.fround));
                }
            }
            const soil = scene.shoulderSoil()!;
            expect(soil).toBeDefined(); expect(triangles(soil)).toBe(8569);
            expect(rootIds(f.layer.root)).toEqual(['l33', 'l34', 'l35']);
            for (const root of roots(f.layer.root)) expect(triangles(root)).toBe(36);
            for (const root of shoulderManifest.roots)
                expect(shoulderFloorFingerprint(layout.world.floors, root.binding.localFloor)).toBe(root.binding.localFloor.fingerprint);
            scene.scene.updateMatrixWorld(true);
            const cell = { x: 7, z: -6 }, ray = new T.Raycaster(layout.point(cell, 4), new T.Vector3(0, -1, 0));
            expect(ray.intersectObject(soil, true)).toEqual([]);
            expect(scene.groundAt(ray)!.distanceTo(layout.point(cell, 0))).toBeLessThan(1e-6);
            expect(f.layer.objects.size).toBe(35); expect(landCells(state, layout.world)).toHaveLength(75);
            const oldOwners = [...baseline.plots, ...baseline.landmarks], owners = [...state.plots, ...state.landmarks];
            expect(oldOwners.every(owner => JSON.stringify(owners.find(value => value.id === owner.id)) === JSON.stringify(owner))).toBe(true);
            const oldFrame = authoredWorldFrame(baseline, base, { water: true, cove: true });
            expect(placeIdentity(state, layout.world)).toEqual(placeIdentity(baseline, oldFrame.world));
            expect(state).toEqual(saved);
        } finally { scene.dispose(); f.dispose(); }
    }, 30_000);

    it('indexes the actual 108 root triangles and retains supported guarded home routes for every one of the 35 owners', () => {
        const f = setup(), rig = makePokomokoRig(f.m), hero = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet);
        setActorVisualScale(hero, .45);
        const actors = [hero, ...state.villagers.map(villager => makeVillagerActor(f.m, villager, .45))];
        try {
            const envelope = measureAuthoredWalkingEnvelope(actors), allowed = walkableCells(state, f.frame.world);
            const physical = authoredFlowerWalkSet(allowed, f.frame.world, f.layout, f.layer.root, envelope);
            expect(physical.proof.coveCount).toBe(1); expect(physical.proof.stockCount).toBe(4);
            expect(physical.proof.envelope.source.method).toBe('indexed-source-motion-intervals');
            const reached = reachableFromHome(state, physical.walkable, f.frame.world), owners = [...state.plots, ...state.landmarks];
            const entries = authoredOwnerApproaches(owners, f.frame.world, physical.walkable, reached);
            expect(owners.filter(owner => owner.cell && !entries.get(key(owner.cell))?.length).map(owner => owner.id)).toEqual([]);
            expect(entries.get(key(state.landmarks.find(owner => owner.id === 'l14')!.cell!))!.length).toBeGreaterThan(0);
            for (const owner of owners) {
                const approach = entries.get(key(owner.cell!))![0], route = f.frame.world.route(HOME_CELL, approach, physical.walkable)!;
                expect(route.length).toBeGreaterThan(0);
                for (let i = 1; i < route.length; i++) {
                    expect(f.frame.world.isWalkEdgeSupported(route[i - 1], route[i])).toBe(true);
                    expect(physical.clearGroundPath(route[i - 1], route[i])).toBe(true);
                }
            }
            const sites = new Map(f.frame.world.sites.map(site => [JSON.stringify(site.ref), site.cell]));
            for (const edge of profile.edges.filter(edge => edge.allows.includes('walk'))) {
                const from = sites.get(JSON.stringify(edge.from))!, to = sites.get(JSON.stringify(edge.to))!;
                expect(uncoveredActorBox(f.frame.world, from, to, envelope.radius + .04)).toBeLessThan(1e-8);
            }
            // Eligibility is proven against the real triangle index, rather than
            // inferred from a root's name or its successful visual attachment.
            roots(f.layer.root).forEach(root => { root.visible = false; });
            const withoutRoots = authoredFlowerWalkSet(allowed, f.frame.world, f.layout, f.layer.root, envelope);
            expect(physical.proof.triangles - withoutRoots.proof.triangles).toBe(108);
            expect(physical.proof.obstructionRootCount - withoutRoots.proof.obstructionRootCount).toBe(3);
            roots(f.layer.root).forEach(root => { root.visible = true; });
        } finally { actors.forEach(disposeActor); f.dispose(); }
    }, 30_000);

    it('uses real move/store/restore commands to detach one owner root without removing land, then reconnects the same source', () => {
        const initial = setup(), original = state.landmarks.find(owner => owner.id === 'l34')!, destination = { x: 12, z: -9 };
        const originalRoot = roots(initial.layer.root).find(root => root.userData.ownerId === 'l34')!;
        const matrices = meshes(originalRoot).map(mesh => mesh.matrixWorld.elements.slice());
        let current = state;
        try {
            expect(canPlace(state, destination, original.id, initial.frame.world)).toBe(true);
            const commands = [
                { type: 'move', id: original.id, cell: destination },
                { type: 'move', id: original.id, cell: original.cell! },
                { type: 'store', id: original.id },
                { type: 'unstore', id: original.id, cell: original.cell! },
            ] as const;
            for (const [index, command] of commands.entries()) {
                const before = authoredWorldFrame(current, base, options());
                current = applyIntent(current, { id: `shoulder-lifecycle-${index}`, command }, epoch, before.world).state;
                const f = setup(current), restored = index % 2 === 1;
                try {
                    expect(rootIds(f.layer.root)).toEqual(restored ? ['l33', 'l34', 'l35'] : ['l33', 'l35']);
                    expect(f.frame.world.floors).toEqual(initial.frame.world.floors);
                    expect(f.frame.world.definition.edges).toEqual(initial.frame.world.definition.edges);
                    expect(landCells(current, f.frame.world)).toHaveLength(75);
                    if (restored) {
                        const root = roots(f.layer.root).find(root => root.userData.ownerId === original.id)!;
                        expect(meshes(root).map(mesh => mesh.matrixWorld.elements)).toEqual(matrices);
                        expect(meshes(root)[0].geometry).toBe(meshes(originalRoot)[0].geometry);
                    }
                } finally { f.dispose(); }
            }
            expect(current.landmarks).toEqual(state.landmarks); expect(current.plots).toEqual(state.plots);
            expect(current.drops).toBe(state.drops);
        } finally { initial.dispose(); }
    }, 60_000);

    it('keeps committed root physics through an initial ghost/life sync, and cancels to the identical resources and floor', () => {
        const cell = { x: 12, z: -9 }, ghost: Ghost = { ownerId: 'l34', kind: 'sapling', seed: false, style: 'plain', cell, valid: true, allowed: [cell] };
        const committed = setup(), prospective = setup(state, ghost), scene = sceneFor(), layout = scene.layout(state), saved = structuredClone(state);
        const root = roots(prospective.layer.root).find(value => value.userData.ownerId === 'l34')!;
        const resources = meshes(root).map(mesh => [mesh, mesh.geometry, mesh.material]);
        const coreProof = (proof: ReturnType<typeof scene.life.walkingObstructionProof>) => proof && {
            triangles: proof.triangles, obstructionRootCount: proof.obstructionRootCount, walkableCount: proof.walkableCount,
            reachableCount: proof.reachableCount, ownerAccess: proof.ownerAccess, excludedCells: proof.excludedCells,
        };
        try {
            expect(canPlace(state, cell, 'l34', layout.world)).toBe(true);
            scene.life.sync(state, layout, committed.layer);
            const physicalBefore = coreProof(scene.life.walkingObstructionProof());
            expect(physicalBefore?.triangles).toBeGreaterThan(0);
            expect(root.visible).toBe(false); expect(root.userData.authoredPreviewHidden).toBe(true);
            // A fresh initial sync (e.g. camera rebuild) must read canonical roots
            // even though their prospective draw state hides them.
            scene.life.sync(state, layout, prospective.layer);
            expect(coreProof(scene.life.walkingObstructionProof())).toEqual(physicalBefore);
            const actors = scene.life.objects(), poses = actors.map(actor => actor.position.toArray());
            const ray = new T.Raycaster(layout.point({ x: 7, z: -6 }, 4), new T.Vector3(0, -1, 0));
            scene.scene.updateMatrixWorld(true); const support = scene.groundAt(ray)!.toArray();
            scene.showWaterPreview(previewGrowingState(state, ghost));
            expect(scene.life.objects()).toEqual(actors); expect(actors.map(actor => actor.position.toArray())).toEqual(poses);
            expect(scene.groundAt(ray)!.toArray()).toEqual(support);
            expect(coreProof(scene.life.walkingObstructionProof())).toEqual(physicalBefore);
            prospective.layer.updatePreview(); scene.showWaterPreview();
            expect(root.visible).toBe(true); expect(root.userData.authoredPreviewHidden).toBeUndefined();
            expect(meshes(root).map(mesh => [mesh, mesh.geometry, mesh.material])).toEqual(resources);
            expect(scene.groundAt(ray)!.toArray()).toEqual(support); expect(scene.life.root.visible).toBe(true);
            scene.life.sync(state, layout, prospective.layer);
            expect(coreProof(scene.life.walkingObstructionProof())).toEqual(physicalBefore);
            expect(state).toEqual(saved);
        } finally { scene.dispose(); prospective.dispose(); committed.dispose(); }
    }, 60_000);

    it('retains unchanged source roots when a legal bench purchase previews and confirms a grown wide grove', () => {
        const f = setup(), scene = sceneFor(), layout = scene.layout(state), saved = structuredClone(state);
        const originalRoots = roots(f.layer.root), resources = originalRoots.map(root => meshes(root).map(mesh => [mesh, mesh.geometry, mesh.material]));
        const wide = (current: GrowingState) => derivePlaces(current, f.frame.world).find(place => place.ruleId === 'P01'
            && ['grown', 'lived'].includes(place.stage) && place.mainIds.includes('l34') && place.mainIds.includes('l35'));
        try {
            expect(wide(state)).toBeUndefined();
            // Find a real normal purchase on existing rights. No place, age,
            // attachment or permission result is fabricated for this branch.
            const candidates = landCells(state, f.frame.world).filter(cell => canPlace(state, cell, undefined, f.frame.world))
                .sort((a, b) => Math.hypot(a.x - 7.5, a.z + 6) - Math.hypot(b.x - 7.5, b.z + 6) || a.x - b.x || a.z - b.z);
            let chosen: { cell: Cell; state: GrowingState } | undefined;
            for (const cell of candidates) {
                const result = applyIntent(state, { id: `shoulder-bench-${key(cell)}`, command: { type: 'place', kind: 'bench', cell } }, epoch, f.frame.world).state;
                if (wide(result)) { chosen = { cell, state: result }; break; }
            }
            expect(chosen, 'No ordinary bench purchase produced the requested wide-grove branch').toBeDefined();
            const { cell, state: purchased } = chosen!, bench = purchased.landmarks.find(owner => !state.landmarks.some(old => old.id === owner.id))!;
            expect(bench.kind).toBe('bench'); expect(purchased.drops).toBeLessThan(state.drops);
            const place = wide(purchased)!;
            expect(place.mainIds).toEqual(['l34', 'l35']); expect(place.memberIds).toContain(bench.id);
            const ghost: Ghost = { kind: 'bench', seed: false, style: 'plain', cell, valid: true, allowed: [cell], prospectiveOwnerId: bench.id };
            expect(wide(previewGrowingState(state, ghost)!)).toEqual(place);
            scene.life.sync(state, layout, f.layer);
            const proof = scene.life.walkingObstructionProof()!;
            f.layer.updatePreview(ghost);
            expect(rootIds(f.layer.root)).toEqual(['l33', 'l34', 'l35']);
            for (const root of originalRoots) { expect(root.visible).toBe(true); expect(root.userData.authoredPreviewHidden).toBeUndefined(); }
            scene.life.sync(state, layout, f.layer);
            const during = scene.life.walkingObstructionProof()!;
            expect(during.triangles).toBe(proof.triangles); expect(during.obstructionRootCount).toBe(proof.obstructionRootCount);
            expect(during.ownerAccess).toEqual(proof.ownerAccess); expect(during.excludedCells).toEqual(proof.excludedCells);
            f.layer.updatePreview();
            expect(originalRoots.map(root => meshes(root).map(mesh => [mesh, mesh.geometry, mesh.material]))).toEqual(resources);
            scene.life.sync(state, layout, f.layer);
            expect(scene.life.walkingObstructionProof()!.ownerAccess).toEqual(proof.ownerAccess);
            const confirmed = setup(purchased);
            try {
                expect(wide(purchased)).toEqual(place); expect(rootIds(confirmed.layer.root)).toEqual(['l33', 'l34', 'l35']);
                for (const root of originalRoots) {
                    const joined = roots(confirmed.layer.root).find(value => value.userData.ownerId === root.userData.ownerId)!;
                    expect(joined.matrixWorld.elements).toEqual(root.matrixWorld.elements);
                    expect(meshes(joined)[0].geometry).toBe(meshes(root)[0].geometry);
                }
                expect(confirmed.frame.world.floors).toEqual(f.frame.world.floors);
                expect(landCells(purchased, confirmed.frame.world)).toHaveLength(75);
            } finally { confirmed.dispose(); }
            expect(state).toEqual(saved);
        } finally { scene.dispose(); f.dispose(); }
    }, 60_000);
});
