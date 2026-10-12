import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as T from 'three';
import { BLOOM_HOURS } from '../../../../domain/growingIsland/environment';
import { makeNativeAuthoredFlower, type AuthoredFlowerSupportInput, type NativeAuthoredFlowerSkin } from './nativeAuthoredFlower';

const skin = JSON.parse(gunzipSync(readFileSync('prototypes/place-qa/native-flower-support.json.gz')).toString()) as NativeAuthoredFlowerSkin;
const leaf = skin.parts.find(part => part.role === 'leaf')!, stem = skin.parts.find(part => part.role === 'canopy-stem')!;
const vector = (value: readonly number[]) => new T.Vector3(value[0], value[1], value[2]);
const meshes = (root: T.Object3D) => { const found: T.Mesh[] = []; root.traverse(node => { if (node instanceof T.Mesh) found.push(node); }); return found; };
const factories: ReturnType<typeof makeNativeAuthoredFlower>[] = [], roots: T.Group[] = [];
function fixture(overrides: Partial<AuthoredFlowerSupportInput> = {}): AuthoredFlowerSupportInput {
    return { owners: [0, 1, 2, 3].map(x => ({ id: `flower-${x}`, point: new T.Vector3(x, .2, 0), growth: BLOOM_HOURS })),
        crownBase: new T.Vector3(1.5, 2, 0), crownScale: .45, connected: true,
        links: [['flower-0', 'flower-1'], ['flower-1', 'flower-2'], ['flower-2', 'flower-3']],
        seats: [{ id: 'place-seat-current', point: new T.Vector3(4, .2, 0) }], ...overrides };
}
function build(input = fixture(), support = makeNativeAuthoredFlower(skin)) {
    if (!factories.includes(support)) factories.push(support);
    const root = support.build(input); roots.push(root); return { root, support };
}
afterEach(() => {
    for (const root of roots.splice(0)) for (const mesh of meshes(root)) mesh.geometry.dispose();
    for (const factory of factories.splice(0)) factory.dispose();
});

describe('native source flower foliage and the current seat edge', () => {
    it('joins unscaled source leaves to each real grown branch tip, above the low walking space', () => {
        const { root } = build();
        const branches = skin.parts.filter(part => part.role === 'grown-branch');
        expect(branches).toHaveLength(3);
        for (const stock of root.getObjectsByProperty('name', 'authored-flower-owned-stock')) {
            const tips = stock.getObjectByName('authored-flower-branch-foliage')!, mesh = tips.children[0] as T.Mesh;
            const positions = mesh.geometry.getAttribute('position'), owner = vector(stock.userData.groundPoint);
            expect(positions.count).toBe(branches.length * leaf.positions.length / 3);
            expect(mesh.userData).toMatchObject({ objectId: stock.userData.ownerId, ownerId: stock.userData.ownerId, nativeRoles: ['leaf'] });
            for (const [i, branch] of branches.entries()) {
                const sourceTip = vector(branch.joints![branch.joints!.length - 1]);
                const tip = sourceTip.clone().multiply(new T.Vector3(.65, stock.userData.stockHeight / skin.stockHeight, .65)).add(owner);
                const direction = sourceTip.clone().sub(vector(branch.joints![0]));
                const rotation = new T.Matrix4().makeRotationY(Math.atan2(-direction.x, -direction.z));
                for (let j = 0; j < leaf.positions.length / 3; j++) {
                    const actual = new T.Vector3().fromBufferAttribute(positions, i * leaf.positions.length / 3 + j);
                    const expected = vector(leaf.positions.slice(j * 3, j * 3 + 3)).sub(vector(leaf.attach!)).applyMatrix4(rotation).add(tip);
                    expect(actual.distanceTo(expected)).toBeLessThan(3e-7);
                    expect(actual.y - owner.y).toBeGreaterThan(1.2);
                }
                expect(tips.userData.branchLeafJoints[i].point).toEqual(tip.toArray());
            }
            // High leaf spread must not inflate the grounded stock envelope.
            for (const low of meshes(stock).filter(mesh => mesh.name === 'authored-flower-stock')) {
                const positions = low.geometry.getAttribute('position');
                for (let i = 0; i < positions.count; i++) {
                    expect(Math.abs(positions.getX(i) - owner.x)).toBeLessThan(.46);
                    expect(Math.abs(positions.getZ(i) - owner.z)).toBeLessThan(.46);
                }
            }
        }
    });

    it('uses rigid source length and actual source joints for the seat stem and its leaves', () => {
        const input = fixture(), before = input.owners.map(owner => owner.point.toArray()), crown = input.crownBase.toArray();
        const { root } = build(input), edges = root.getObjectsByProperty('name', 'authored-flower-seat-bough');
        expect(edges).toHaveLength(1);
        const edge = edges[0], stock = edge.parent!;
        expect(edge.userData).toMatchObject({ ownerId: 'flower-3', ownerIds: ['flower-3'], seatId: 'place-seat-current', sourceScale: .45 });
        expect(stock.name).toBe('authored-flower-owned-stock');
        const start = vector(stem.joints![0]), end = vector(stem.joints![2]), span = end.clone().sub(start);
        const reach = Math.hypot(span.x, span.z);
        expect(reach).toBeCloseTo(1.0727097697, 9);
        const yaw = Math.atan2(span.z, span.x), rotation = new T.Matrix4().makeRotationY(yaw);
        const at = input.owners[3].point.clone().add(new T.Vector3(0, stock.userData.stockHeight * .75, 0));
        const stemMesh = meshes(edge).find(mesh => mesh.userData.nativeRoles.includes('canopy-stem'))!;
        const positions = stemMesh.geometry.getAttribute('position');
        for (let i = 0; i < positions.count; i++) {
            const actual = new T.Vector3().fromBufferAttribute(positions, i);
            const expected = vector(stem.positions.slice(i * 3, i * 3 + 3)).sub(start).applyMatrix4(rotation).add(at);
            expect(actual.distanceTo(expected)).toBeLessThan(3e-7);
            expect(actual.y - input.seats![0].point.y).toBeGreaterThan(.45 * 1.166671391 + .14);
        }
        const joints = edge.userData.joints.map(vector) as T.Vector3[];
        expect(joints[2].distanceTo(joints[0])).toBeCloseTo(end.distanceTo(start), 10);
        expect(joints[2].x - joints[0].x).toBeCloseTo(reach, 10);
        expect(joints[2].x).toBeGreaterThan(input.seats![0].point.x);
        const leaves = meshes(edge).find(mesh => mesh.userData.nativeRoles.includes('leaf'))!;
        const leafPositions = leaves.geometry.getAttribute('position');
        const blades = [[1, -.22], [1, .22], [2, Math.PI]];
        expect(leafPositions.count).toBe(blades.length * leaf.positions.length / 3);
        for (const [i, [jointIndex, angle]] of blades.entries()) {
            const rotate = new T.Matrix4().makeRotationY(-Math.PI / 2 + angle);
            for (let j = 0; j < leaf.positions.length / 3; j++) {
                const expected = vector(leaf.positions.slice(j * 3, j * 3 + 3)).sub(vector(leaf.attach!)).applyMatrix4(rotate).add(joints[jointIndex]);
                expect(new T.Vector3().fromBufferAttribute(leafPositions, i * leaf.positions.length / 3 + j).distanceTo(expected)).toBeLessThan(3e-7);
            }
        }
        expect(meshes(edge).every(mesh => mesh.userData.objectId === 'flower-3' && mesh.userData.seatId === 'place-seat-current')).toBe(true);
        expect(input.owners.map(owner => owner.point.toArray())).toEqual(before); expect(input.crownBase.toArray()).toEqual(crown);
    });

    it('places a real leaf surface above the current seat center, including rotated gardens', () => {
        for (const yaw of [0, .7, Math.PI / 2, Math.PI]) {
            const input = fixture(), rotation = new T.Matrix4().makeRotationY(yaw);
            input.owners.forEach(owner => owner.point.applyMatrix4(rotation));
            input.crownBase.applyMatrix4(rotation); input.seats!.forEach(seat => seat.point.applyMatrix4(rotation));
            const { root } = build(input); root.updateMatrixWorld(true);
            const edge = root.getObjectByName('authored-flower-seat-bough')!;
            const leaves = meshes(edge).filter(mesh => mesh.userData.nativeRoles.includes('leaf'));
            const seat = input.seats![0].point, down = new T.Vector3(0, -1, 0);
            const hits = new T.Raycaster(seat.clone().add(new T.Vector3(0, 5, 0)), down).intersectObjects(leaves);
            expect(hits.length).toBeGreaterThan(0);
            expect(hits[0].point.y - seat.y).toBeGreaterThan(.45 * 1.166671391 + .14);
            // Check an area around the seat, not a coincidental triangle edge.
            let covered = 0;
            for (const x of [-.06, 0, .06]) for (const z of [-.06, 0, .06]) {
                const point = new T.Vector3(x, 5, z).applyMatrix4(rotation).add(seat);
                if (new T.Raycaster(point, down).intersectObjects(leaves).length) covered++;
            }
            expect(covered).toBeGreaterThanOrEqual(7);
        }
    });

    it('joins the stock-top leaf pair to the actual trunk joint and overlaps the branch-tip mass', () => {
        const { root } = build(), trunk = skin.parts.find(part => part.role === 'trunk')!;
        const branches = skin.parts.filter(part => part.role === 'grown-branch');
        root.updateMatrixWorld(true);
        for (const stock of root.getObjectsByProperty('name', 'authored-flower-owned-stock')) {
            const group = stock.getObjectByName('authored-flower-stock-top-foliage')!, mesh = group.children[0] as T.Mesh;
            const positions = mesh.geometry.getAttribute('position'), owner = vector(stock.userData.groundPoint);
            const top = vector(trunk.joints![trunk.joints!.length - 1]).multiply(new T.Vector3(.78, stock.userData.stockHeight / skin.stockHeight, .78)).add(owner);
            expect(group.userData.joint).toEqual(top.toArray());
            expect(positions.count).toBe(2 * leaf.positions.length / 3);
            for (const [i, branch] of [branches[0], branches[2]].entries()) {
                const tip = vector(branch.joints![branch.joints!.length - 1]).multiply(new T.Vector3(.65, stock.userData.stockHeight / skin.stockHeight, .65)).add(owner);
                const direction = tip.clone().sub(top), rotate = new T.Matrix4().makeRotationY(Math.atan2(-direction.x, -direction.z));
                for (let j = 0; j < leaf.positions.length / 3; j++) {
                    const expected = vector(leaf.positions.slice(j * 3, j * 3 + 3)).sub(vector(leaf.attach!)).applyMatrix4(rotate).add(top);
                    expect(new T.Vector3().fromBufferAttribute(positions, i * leaf.positions.length / 3 + j).distanceTo(expected)).toBeLessThan(3e-7);
                }
                const capPoint = top.clone().add(direction.clone().normalize().multiplyScalar(.08));
                const hits = new T.Raycaster(capPoint.clone().add(new T.Vector3(0, 1, 0)), new T.Vector3(0, -1, 0)).intersectObject(mesh);
                expect(hits.length).toBeGreaterThan(0); expect(hits[0].point.y).toBeGreaterThan(top.y + .02);
                // The top blade reaches the old tip leaf's base, so the two
                // source pieces make one connected high plant mass.
                expect(new T.Raycaster(tip.clone().add(new T.Vector3(0, 1, 0)), new T.Vector3(0, -1, 0)).intersectObject(mesh).length).toBeGreaterThan(0);
            }
        }
    });

    it('rebuilds toward only the nearest current seat and preserves rigid length when its direction changes', () => {
        const { root, support } = build();
        const current = fixture({ seats: [{ id: 'farther', point: new T.Vector3(4.04, .2, 0) }, { id: 'moved', point: new T.Vector3(3, .2, 1) }] });
        const moved = build(current, support).root.getObjectsByProperty('name', 'authored-flower-seat-bough');
        expect(moved).toHaveLength(1); expect(moved[0].userData.seatId).toBe('moved');
        const joints = moved[0].userData.joints.map(vector) as T.Vector3[];
        expect(joints[2].x).toBeCloseTo(3, 10); expect(joints[2].z).toBeCloseTo(moved[0].userData.sourcePlanarReach, 10);
        expect(root.getObjectByName('authored-flower-seat-bough')!.userData.seatId).toBe('place-seat-current');
        expect(build(fixture({ seats: [] }), support).root.getObjectByName('authored-flower-seat-bough')).toBeUndefined();
    });

    it('omits seat growth without a connected mature garden or an explicitly supplied current seat', () => {
        const options: Partial<AuthoredFlowerSupportInput>[] = [
            { connected: false }, { seats: [] }, { seats: undefined },
            { owners: fixture().owners.map((owner, i) => ({ ...owner, growth: i ? BLOOM_HOURS : BLOOM_HOURS - .01 })) },
            { seats: [{ id: 'beyond-source-span', point: new T.Vector3(4.08, .2, 0) }] },
            { seats: [{ id: 'elevated-seat', point: new T.Vector3(4, 1, 0) }] },
        ];
        for (const input of options) expect(build(fixture(input)).root.getObjectByName('authored-flower-seat-bough')).toBeUndefined();
    });

    it('keeps finite owned mesh data, per-build geometries, and a factory-owned source material palette', () => {
        const first = build(), second = build(fixture(), first.support), firstMeshes = meshes(first.root), secondMeshes = meshes(second.root);
        const materialSet = new Set<T.Material>();
        for (const [i, mesh] of firstMeshes.entries()) {
            expect(mesh.geometry).not.toBe(secondMeshes[i].geometry);
            expect(mesh.material).toBe(secondMeshes[i].material);
            expect(mesh.userData).toMatchObject({ nativeSharedMaterial: true, nativeSharedGeometry: false, visualOnly: true, sourceSha256: skin.source.sha256 });
            expect(Array.from(mesh.geometry.getAttribute('position').array).every(Number.isFinite)).toBe(true);
            expect(Array.from(mesh.geometry.getAttribute('normal').array).every(Number.isFinite)).toBe(true);
            const material = mesh.material as T.MeshStandardMaterial;
            expect(skin.parts.some(part => part.material.name === material.name && part.material.color.slice(1) === material.color.getHexString())).toBe(true);
            materialSet.add(material);
        }
        const disposed = [...materialSet].map(material => vi.spyOn(material, 'dispose'));
        first.support.dispose(); first.support.dispose();
        expect(disposed.every(spy => spy.mock.calls.length === 1)).toBe(true);
        expect(() => first.support.build(fixture())).toThrow('disposed');
    });

    it('rejects malformed current-seat inputs without generating non-finite geometry', () => {
        const { support } = build();
        for (const seats of [[{ id: '', point: new T.Vector3() }], [{ id: 'bad', point: new T.Vector3(NaN, 0, 0) }],
            [{ id: 'duplicate', point: new T.Vector3() }, { id: 'duplicate', point: new T.Vector3(1, 0, 0) }]]) {
            expect(() => support.build(fixture({ seats }))).toThrow('owners differ');
        }
    });
});
