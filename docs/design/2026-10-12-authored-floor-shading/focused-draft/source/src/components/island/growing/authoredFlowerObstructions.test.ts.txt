import { describe, expect, it, vi } from 'vitest';
import * as T from 'three';
import { IslandMaterials, disposeGeometry } from '../three/primitives';
import { makePokomokoRig } from '../three/islandCharacters';
import type { Species, Villager } from '../../../domain/growingIsland';
import { compileWorldDefinition } from '../../../domain/growingIsland/worldDefinition';
import { authoredAccessWorld } from '../../../domain/growingIsland/authoredWorldAccess.fixture';
import type { WorldDefinition } from '../../../domain/growingIsland/worldTypes';
import { newIsland } from '../../../domain/growingIsland/island';
import { key } from '../../../domain/growingIsland/space';
import { sceneLayout } from './sceneLayout';
import { actorFootMinY, actorSeatContact, alignActorContact, resetActorVisualContact, setActorVisualScale } from './actorScale';
import { disposeActor, makeVillagerActor, wrapPokomoko, type Actor } from './actors';
import { authoredOwnerApproaches, authoredFlowerWalkSet, hasAuthoredObstructionRoots, measureAuthoredWalkingEnvelope, type AuthoredWalkingEnvelope } from './authoredFlowerObstructions';

const villager = (species: Species): Villager => ({ id: `walk-${species}`, species, home: 'pokomoko', arrivedAt: 0, trait: 'mellow',
    variant: { color: 1, accessory: 3, sparkle: true }, outfit: { color: 2, hat: 1 } });
function hero(m: IslandMaterials) { const rig = makePokomokoRig(m), actor = wrapPokomoko(rig.hero, rig.heroBody, rig.heroFeet); setActorVisualScale(actor, .45); return actor; }
function snapshot(actor: Actor) {
    actor.root.updateWorldMatrix(true, true);
    const nodes: unknown[] = [];
    actor.root.traverse(node => nodes.push([node, node.position.toArray(), node.quaternion.toArray(), node.scale.toArray(), node.matrix.toArray(), node.matrixWorld.toArray()]));
    return { nodes, foot: actorFootMinY(actor), seat: actorSeatContact(actor)?.toArray(), visual: actor.visual?.position.toArray() };
}
function actualVertices(actor: Actor) {
    actor.root.updateWorldMatrix(true, true); const points: T.Vector3[] = []; let meshes = 0;
    actor.root.traverse(node => {
        if (!(node instanceof T.Mesh)) return;
        for (let parent: T.Object3D | null = node; parent && parent !== actor.root; parent = parent.parent) if (parent === actor.sparkle) return;
        meshes++; const position = node.geometry.getAttribute('position'), used = node.geometry.index ? new Set(Array.from({ length: node.geometry.index.count }, (_, i) => node.geometry.index!.getX(i))) : Array.from({ length: position.count }, (_, i) => i);
        for (const i of used) points.push(new T.Vector3().fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld));
    });
    return { points, meshes };
}
const smallEnvelope: AuthoredWalkingEnvelope = { radius: .025, height: .2,
    source: { actorIds: ['test'], visualScales: [[.45, .45, .45]], meshes: 1, vertices: 3, footSwing: .5, armSwing: .6, walkBob: .01575, method: 'indexed-source-motion-intervals' } };
function obstacle(points: readonly T.Vector3[], name = 'authored-flower-owned-stock') {
    const root = new T.Group(), stock = new T.Group(); stock.name = name; root.add(stock);
    const geometry = new T.BufferGeometry().setFromPoints(points); geometry.setIndex([0, 1, 2]);
    stock.add(new T.Mesh(geometry, new T.MeshBasicMaterial())); return root;
}
function free(root: T.Object3D) { disposeGeometry(root); root.traverse(node => { if (node instanceof T.Mesh) (node.material as T.Material).dispose(); }); }
function seamWorld(physicalBend = 0) {
    const xs = [-.5, 0, .125, .25, .75], points = xs.flatMap(x => [-.5, .5].map(z => ({ cell: { x, z }, point: { x: x + (x === .125 ? physicalBend : 0), y: x === .125 ? .2 : 0, z } }))), indices: number[] = [];
    for (let i = 0; i < xs.length - 1; i++) indices.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 2, i * 2 + 1, i * 2 + 3);
    const definition: WorldDefinition = { version: 1, id: 'seam-envelope', districts: [{ id: 'd', templateId: 'test', logicalOrigin: { x: 0, z: 0 }, worldOrigin: { x: 0, y: 0, z: 0 }, turn: 0,
        floors: [{ id: 'f', kind: 'ground', color: '#ffffff', vertices: points, indices }], sites: [0, .25].map(x => ({ id: String(x), cell: { x, z: 0 }, floorId: 'f', placement: Number.isInteger(x) })), ports: [] }],
        edges: physicalBend ? [] : [{ from: { districtId: 'd', siteId: '0' }, to: { districtId: 'd', siteId: '0.25' }, allows: ['walk'] }] };
    return compileWorldDefinition(definition);
}

describe('actual walking source envelope', () => {
    it('includes actual indexed clothing, hats, ears, tail, soles and continuous walking angles with bob, while excluding sparkles', () => {
        const m = new IslandMaterials('moon-garden'), actors = [hero(m), ...(['rabbit', 'fox', 'otter', 'duck', 'squirrel', 'hedgehog', 'penguin', 'owl', 'girl', 'boy'] satisfies Species[]).map(species => makeVillagerActor(m, villager(species), .45))];
        try {
            const envelope = measureAuthoredWalkingEnvelope(actors), actual = actors.map(actualVertices);
            expect(envelope.source.meshes).toBe(actual.reduce((sum, actor) => sum + actor.meshes, 0));
            expect(envelope.source.vertices).toBe(actual.reduce((sum, actor) => sum + actor.points.length, 0));
            expect(envelope.source.walkBob).toBeCloseTo(.035 * .45, 12);
            expect(envelope.radius).toBeGreaterThan(.1); expect(envelope.height).toBeGreaterThan(.3);
            for (const actor of actors) {
                if (actor.sparkle) actor.sparkle.scale.setScalar(1000);
                for (let phase = 0; phase < 21; phase++) {
                    const angle = phase / 20 * Math.PI * 2;
                    actor.root.position.set(4, 1.5, -8); actor.root.rotation.set(0, angle, 0); actor.body.rotation.set(0, 0, 0);
                    actor.feet.forEach((foot, i) => foot.rotation.set(Math.sin(angle + i * Math.PI) * .5, 0, 0));
                    actor.arms?.forEach((arm, i) => arm.rotation.set(Math.sin(angle + i * Math.PI) * .6, 0, 0));
                    resetActorVisualContact(actor); alignActorContact(actor, 1.5 + Math.abs(Math.sin(angle)) * .035 * .45);
                    let maxRadius = 0, minY = Infinity, maxY = -Infinity;
                    for (const point of actualVertices(actor).points) { maxRadius = Math.max(maxRadius, Math.hypot(point.x - 4, point.z + 8)); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y); }
                    expect(maxRadius).toBeLessThanOrEqual(envelope.radius + 1e-8);
                    expect(maxY).toBeLessThanOrEqual(1.5 + envelope.height + 1e-8); expect(minY).toBeGreaterThanOrEqual(1.5 - 1e-8);
                }
            }
            expect(measureAuthoredWalkingEnvelope(actors)).toEqual(envelope);
        } finally { actors.forEach(disposeActor); m.dispose(); }
    });

    it('is independent of held, seat and react transforms, restores every transform/contact, and never accumulates .45 scaling', () => {
        const m = new IslandMaterials('moon-garden'), actor = makeVillagerActor(m, villager('rabbit'), .45);
        try {
            const neutral = measureAuthoredWalkingEnvelope([actor]);
            for (const pose of ['held', 'seat', 'react']) {
                actor.root.position.set(5, pose === 'held' ? 2.6 : 1.2, -7); actor.root.rotation.set(.3, .8, -.2);
                actor.body.rotation.set(-.38, .14, .09); actor.visual!.position.set(.03, -.18, .01);
                actor.feet.forEach((foot, i) => { foot.position.y += .2; foot.rotation.set(.48, i ? -.13 : .13, .07); });
                actor.arms?.forEach((arm, i) => arm.rotation.set(-1.4, .11, i ? -2.6 : 2.6));
                const before = snapshot(actor);
                expect(measureAuthoredWalkingEnvelope([actor])).toEqual(neutral); expect(snapshot(actor)).toEqual(before);
                expect(measureAuthoredWalkingEnvelope([actor])).toEqual(neutral); expect(snapshot(actor)).toEqual(before);
                expect(actor.visual!.scale.toArray()).toEqual([.45, .45, .45]); expect(actor.root.scale.toArray()).toEqual([1, 1, 1]);
            }
        } finally { disposeActor(actor); m.dispose(); }
    });

    it('restores live pose/contact after an indexed geometry read fails', () => {
        const m = new IslandMaterials('moon-garden'), actor = makeVillagerActor(m, villager('fox'), .45);
        try {
            actor.root.rotation.set(.2, -.7, .1); actor.body.rotation.x = -.4; actor.visual!.position.y = .24;
            actor.feet.forEach(foot => { foot.rotation.x = .5; foot.position.y += .3; });
            const before = snapshot(actor), mesh = actor.body.getObjectsByProperty('isMesh', true)[0] as T.Mesh;
            const read = vi.spyOn(mesh.geometry, 'getAttribute').mockImplementation(() => { throw Error('source read failed'); });
            expect(() => measureAuthoredWalkingEnvelope([actor])).toThrow('source read failed'); read.mockRestore();
            expect(snapshot(actor)).toEqual(before);
        } finally { disposeActor(actor); m.dispose(); }
    });
});

describe('source flower obstruction restricts renderer walking only', () => {
    it('blocks a cove-only edge with no flower stock and ignores a supporting floor outside the source shell root', () => {
        const { world } = authoredAccessWorld(), layout = sceneLayout(newIsland('cove-only-guard', 1000), false, world);
        const from = { x: 0, z: -2 }, to = { x: .25, z: -2 }, at = layout.point({ x: .125, z: -2 }, 0);
        const root = obstacle([at.clone().add(new T.Vector3(0, -.1, -.02)), at.clone().add(new T.Vector3(0, .5, -.02)), at.clone().add(new T.Vector3(0, .5, .02))], 'authored-cove-shell');
        const base = new Set([key(from), key(to)]);
        try {
            expect(hasAuthoredObstructionRoots(root)).toBe(true);
            const guarded = authoredFlowerWalkSet(base, world, layout, root, smallEnvelope);
            expect(guarded.proof.stockCount).toBe(0); expect(guarded.proof.coveCount).toBe(1);
            expect(guarded.proof.triangles).toBe(1); expect(guarded.proof.blockedEdges).toBe(1);
            expect(guarded.clearGroundPath(from, to)).toBe(false); expect(guarded.walkable.size).toBe(0);
            root.children[0].name = 'authored-ground-floor';
            expect(hasAuthoredObstructionRoots(root)).toBe(false);
            const floor = authoredFlowerWalkSet(base, world, layout, root, smallEnvelope);
            expect(floor.proof.triangles).toBe(0); expect(floor.walkable).toEqual(base);
        } finally { free(root); }
    });

    it('keeps the same EPS clearance in the broad point box and exact cylinder predicate', () => {
        const { world } = authoredAccessWorld(), layout = sceneLayout(newIsland('point-eps', 1000), false, world), at = layout.point({ x: 2, z: -2 }, 0), radius = smallEnvelope.radius + 5e-9;
        const root = obstacle([at.clone().add(new T.Vector3(radius, 0, -.1)), at.clone().add(new T.Vector3(radius, .3, -.1)), at.clone().add(new T.Vector3(radius, 0, .1))]);
        try { expect(authoredFlowerWalkSet(new Set(['2,-2']), world, layout, root, smallEnvelope).walkable.size).toBe(0); }
        finally { free(root); }
    });

    it('rejects supplied bands outside the declared aggregate before they can bypass obstruction checks', () => {
        const { world } = authoredAccessWorld(), layout = sceneLayout(newIsland('invalid-band', 1000), false, world), at = layout.point({ x: 0, z: -2 }, 0);
        const root = obstacle([at.clone().add(new T.Vector3(.1, 0, -.1)), at.clone().add(new T.Vector3(.1, .5, -.1)), at.clone().add(new T.Vector3(.1, .5, .1))]);
        try {
            const base = new Set(['0,-2']);
            expect(() => authoredFlowerWalkSet(base, world, layout, root, { ...smallEnvelope, bands: [{ radius: .3, minY: 0, maxY: .2 }] })).toThrow('Authored walking bands differ');
            expect(() => authoredFlowerWalkSet(base, world, layout, root, { ...smallEnvelope, bands: [{ radius: .025, minY: 0, maxY: .6 }] })).toThrow('Authored walking bands differ');
            expect(() => authoredFlowerWalkSet(base, world, layout, root, { ...smallEnvelope, radius: 0, bands: [{ radius: .3, minY: 0, maxY: .2 }] })).toThrow('Authored walking bands differ');
            expect(base).toEqual(new Set(['0,-2']));
        } finally { free(root); }
    });

    it('rejects a thin mid-edge collision with clear endpoints and preserves all rights, grants and the caller Set', () => {
        const { world } = authoredAccessWorld(), layout = sceneLayout(newIsland('thin-stock', 1000), false, world), from = { x: 0, z: -2 }, to = { x: .25, z: -2 };
        const at = layout.point({ x: .125, z: -2 }, 0), root = obstacle([at.clone().add(new T.Vector3(0, -.1, -.02)), at.clone().add(new T.Vector3(0, .5, -.02)), at.clone().add(new T.Vector3(0, .5, .02))]);
        const base = new Set([key(from), key(to)]), definition = JSON.stringify(world.definition), sites = world.sites.map(site => [site.ref, site.cell, site.point]);
        try {
            const filtered = authoredFlowerWalkSet(base, world, layout, root, smallEnvelope);
            expect(filtered.proof.blockedPoints).toBe(0); expect(filtered.proof.blockedEdges).toBe(1);
            expect(filtered.walkable.size).toBe(0); expect(filtered.proof.excludedCells).toEqual([from, to]);
            expect(filtered.clearGroundPath(from, to)).toBe(false); expect(filtered.clearGroundPath({ x: 0, z: -2.5 }, { x: .25, z: -2.5 })).toBe(true);
            expect(base).toEqual(new Set([key(from), key(to)])); expect(JSON.stringify(world.definition)).toBe(definition); expect(world.sites.map(site => [site.ref, site.cell, site.point])).toEqual(sites);
            free(root); root.clear(); const released = authoredFlowerWalkSet(base, world, layout, root, smallEnvelope);
            expect(released.walkable).toEqual(base); expect(released.clearGroundPath(from, to)).toBe(true);
        } finally { free(root); }
    });

    it('keeps a high crown clear but refuses its underside at the real walking head/bob height', () => {
        const { world } = authoredAccessWorld(), layout = sceneLayout(newIsland('high-stock', 1000), false, world), cell = { x: 0, z: -2 }, at = layout.point(cell, 0), base = new Set([key(cell)]);
        const root = obstacle([at.clone().add(new T.Vector3(-.1, .201, -.1)), at.clone().add(new T.Vector3(.1, .201, -.1)), at.clone().add(new T.Vector3(0, .201, .1))]);
        try {
            expect(authoredFlowerWalkSet(base, world, layout, root, smallEnvelope).walkable).toEqual(base);
            root.position.y = -.002;
            expect(authoredFlowerWalkSet(base, world, layout, root, smallEnvelope).walkable.size).toBe(0);
        } finally { free(root); }
    });

    it('sweeps current intermediate floor height instead of using endpoints alone', () => {
        const world = seamWorld(), layout = sceneLayout(newIsland('seam-stock', 1000), false, world), from = { x: 0, z: 0 }, to = { x: .25, z: 0 };
        const at = layout.point({ x: .125, z: 0 }, .05), root = obstacle([at.clone().add(new T.Vector3(-.02, 0, -.02)), at.clone().add(new T.Vector3(.02, 0, -.02)), at.clone().add(new T.Vector3(0, 0, .02))]);
        try {
            const filtered = authoredFlowerWalkSet(new Set([key(from), key(to)]), world, layout, root, { ...smallEnvelope, height: .1 });
            expect(filtered.proof.blockedPoints).toBe(0); expect(filtered.proof.blockedEdges).toBe(1); expect(filtered.clearGroundPath(from, to)).toBe(false);
        } finally { free(root); }
    });

    it('includes nonidentity mapped ground within arbitrary paths and tests the actual current posed actor separately', () => {
        const world = seamWorld(.06), layout = sceneLayout(newIsland('mapped-stock', 1000), false, world), from = { x: 0, z: 0 }, to = { x: .25, z: 0 }, at = layout.point({ x: .125, z: 0 }, .05);
        const root = obstacle([at.clone().add(new T.Vector3(-.02, 0, -.02)), at.clone().add(new T.Vector3(.02, 0, -.02)), at.clone().add(new T.Vector3(0, 0, .02))]);
        const m = new IslandMaterials('moon-garden'), actor = makeVillagerActor(m, villager('rabbit'), .45);
        try {
            const filtered = authoredFlowerWalkSet(new Set([key(from), key(to)]), world, layout, root, { ...smallEnvelope, height: .1 });
            expect(filtered.clearGroundPath(from, to)).toBe(false); expect(filtered.clearGroundPath({ x: Number.NaN, z: 0 }, to)).toBe(false);
            actor.root.position.copy(at); alignActorContact(actor, at.y - .1); expect(filtered.poseClear(actor)).toBe(false);
            actor.root.position.z += 1; alignActorContact(actor, at.y - .1); expect(filtered.poseClear(actor)).toBe(true);
            actor.sparkle!.position.z = -1 / .45; actor.sparkle!.scale.setScalar(1000); expect(filtered.poseClear(actor)).toBe(true);
        } finally { disposeActor(actor); m.dispose(); free(root); }
    });

    it('does not apply head width to low roots and checks each actual pose mesh instead of the space between feet and head', () => {
        const { world } = authoredAccessWorld(), layout = sceneLayout(newIsland('low-root', 1000), false, world), at = layout.point({ x: 0, z: -2 }, 0);
        const root = obstacle([at.clone().add(new T.Vector3(.12, 0, -.02)), at.clone().add(new T.Vector3(.12, .1, -.02)), at.clone().add(new T.Vector3(.12, .1, .02))]);
        const actorRoot = new T.Group(), foot = new T.Mesh(new T.BoxGeometry(.04, .1, .04), new T.MeshBasicMaterial()), head = new T.Mesh(new T.BoxGeometry(.4, .1, .4), new T.MeshBasicMaterial());
        foot.position.y = .05; head.position.y = .35; actorRoot.add(foot, head); actorRoot.position.copy(at);
        const actor: Actor = { id: 'wide-head', root: actorRoot, body: head, feet: [foot] };
        try {
            const base = new Set(['0,-2']), envelope = { ...smallEnvelope, radius: .2, height: .5, bands: [{ radius: .03, minY: 0, maxY: .1 }, { radius: .2, minY: .3, maxY: .5 }] };
            expect(authoredFlowerWalkSet(base, world, layout, root, { ...envelope, bands: undefined }).walkable.size).toBe(0);
            const filtered = authoredFlowerWalkSet(base, world, layout, root, envelope);
            expect(filtered.walkable).toEqual(base); expect(filtered.poseClear(actor)).toBe(true);
            head.position.y = .05; expect(filtered.poseClear(actor)).toBe(false);
        } finally { disposeActor(actor); free(root); }
    });

    it('uses cached indexed local bounds far from support, refreshes uploaded geometry/index changes and keeps live mesh transforms', () => {
        const { world } = authoredAccessWorld(), layout = sceneLayout(newIsland('broad-stock', 1000), false, world), at = layout.point({ x: 0, z: -2 }, .1);
        const root = obstacle([at.clone().add(new T.Vector3(0, -.1, -.2)), at.clone().add(new T.Vector3(0, .4, -.2)), at.clone().add(new T.Vector3(0, .4, .2))]);
        const geometry = new T.BufferGeometry().setFromPoints([new T.Vector3(-.1, -.1, -.1), new T.Vector3(.1, -.1, .1), new T.Vector3(0, .2, 0), new T.Vector3(5, 5, 5), new T.Vector3(6, 6, 6), new T.Vector3(7, 7, 7)]); geometry.setIndex([0, 1, 2]);
        const body = new T.Mesh(geometry, new T.MeshBasicMaterial()), actorRoot = new T.Group(); actorRoot.add(body);
        const actor: Actor = { id: 'broad-actor', root: actorRoot, body, feet: [] }, positions = geometry.getAttribute('position'), read = vi.spyOn(positions, 'getX');
        try {
            const filtered = authoredFlowerWalkSet(new Set(['0,-2']), world, layout, root, smallEnvelope);
            actor.root.position.copy(at).add(new T.Vector3(20, 0, 0)); expect(filtered.poseClear(actor)).toBe(true);
            read.mockClear(); expect(filtered.poseClear(actor)).toBe(true); expect(read).not.toHaveBeenCalled();
            actor.root.position.copy(at).add(new T.Vector3(0, .2, 0)); actor.root.scale.set(-.45, .45, .45); expect(filtered.poseClear(actor)).toBe(false); expect(read).toHaveBeenCalled();
            actor.root.scale.setScalar(1); geometry.setIndex([3, 4, 5]); expect(filtered.poseClear(actor)).toBe(true);
            geometry.setIndex([0, 1, 2]); actor.root.position.copy(at).add(new T.Vector3(20, .2, 0));
            for (let i = 0; i < 3; i++) positions.setX(i, positions.getX(i) - 20); positions.needsUpdate = true;
            expect(filtered.poseClear(actor)).toBe(false); body.visible = false; expect(filtered.poseClear(actor)).toBe(true);
        } finally { read.mockRestore(); disposeActor(actor); free(root); }
    });

    it('retains legacy/support-free walking, validates enabled envelopes, and does not infer physical stock from ordinary flowers or preview siblings', () => {
        const state = newIsland('legacy-stock', 1000), layout = sceneLayout(state), base = new Set(['2,1']), { world } = authoredAccessWorld();
        const root = obstacle([new T.Vector3(), new T.Vector3(0, 1, 0), new T.Vector3(1, 0, 0)]), enabled = sceneLayout(state, false, world);
        try {
            expect(authoredFlowerWalkSet(base, world, layout, root, smallEnvelope).walkable).toEqual(base);
            expect(authoredFlowerWalkSet(base, world, enabled, undefined, smallEnvelope).walkable).toEqual(base);
            expect(() => authoredFlowerWalkSet(base, world, enabled, root, { ...smallEnvelope, height: Number.NaN })).toThrow();
            const live = new T.Group(), outer = new T.Group(); outer.add(live, root);
            expect(authoredFlowerWalkSet(base, world, enabled, live, smallEnvelope).proof.triangles).toBe(0);
            root.children[0].name = 'ordinary-flower'; expect(authoredFlowerWalkSet(base, world, enabled, root, smallEnvelope).walkable).toEqual(base);
        } finally { free(root); }
    });
});


describe('committed native grove guard and runtime owner endpoints', () => {
    it('counts native tree, shared trunk and branch triangles once, excluding replaced, prospective and hit-only shapes', () => {
        const { world } = authoredAccessWorld(), layout = sceneLayout(newIsland('grove-index', 1000), false, world);
        const at = layout.point({ x: 2, z: -2 }, 0), points = [at, at.clone().add(new T.Vector3(0, .5, 0)), at.clone().add(new T.Vector3(.1, .5, 0))];
        const root = new T.Group(), add = (name: string, parent = root) => {
            const holder = obstacle(points, name); parent.add(holder); return holder.children[0];
        };
        const tree = add('growing-tree-spread'); tree.userData.nativePart = 'willow';
        const shared = add('place-native-shared-tree');
        add('place-native-mature-branch', shared);
        const replaced = add('growing-tree-spire'); replaced.userData.nativePart = 'spire'; replaced.visible = false;
        const procedural = add('growing-tree-branch');
        const ghost = new T.Group(); ghost.name = 'growing-ghost'; root.add(ghost);
        const future = add('growing-tree-spread', ghost); future.userData.nativePart = 'willow';
        const projection = new T.Group(); projection.name = 'growing-place-preview'; root.add(projection);
        add('place-native-shared-tree', projection); add('authored-cove-shell', projection);
        const proxy = add('place-native-mature-branch'); proxy.userData.placementHitOnly = true;
        const read = () => authoredFlowerWalkSet(new Set(['2,-2']), world, layout, root, smallEnvelope);
        try {
            expect(procedural.userData.nativePart).toBeUndefined();
            expect(read().proof).toMatchObject({ groveCount: 3, coveCount: 0, triangles: 3 });
            tree.visible = false; tree.userData.authoredPreviewHidden = true;
            expect(read().proof).toMatchObject({ groveCount: 3, triangles: 3 });
            tree.children[0].visible = false;
            expect(read().proof.triangles).toBe(2);
            delete tree.userData.authoredPreviewHidden;
            expect(read().proof).toMatchObject({ groveCount: 2, triangles: 2 });
        } finally { free(root); }
    });

    it('discovers a safe second ring through real neighbors without authorizing the rejected first ring', () => {
        const { world } = authoredAccessWorld(), owner = { cell: { x: 2, z: -2 } }, safe = { x: 3, z: -2 };
        const allowed = new Set([key(safe)]), before = JSON.stringify(world.definition);
        const entries = authoredOwnerApproaches([owner], world, allowed, allowed).get(key(owner.cell));
        expect(entries).toEqual([safe]);
        expect(world.route(owner.cell, safe, allowed)).toBeUndefined();
        expect(authoredOwnerApproaches([owner], world, allowed, new Set()).get(key(owner.cell))).toEqual([]);
        expect(authoredOwnerApproaches([owner], world, new Set(['3.25,-2']), new Set(['3.25,-2'])).get(key(owner.cell))).toEqual([]);
        // Nearby floor without a connecting authored walk edge is not a candidate.
        const disconnected = compileWorldDefinition({ ...world.definition, edges: [] });
        expect(authoredOwnerApproaches([owner], disconnected, allowed, allowed).get(key(owner.cell))).toEqual([]);
        expect(JSON.stringify(world.definition)).toBe(before); expect([...allowed]).toEqual([key(safe)]);
    });
});
