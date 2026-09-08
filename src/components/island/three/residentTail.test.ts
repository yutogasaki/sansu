import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandResident } from './animals';
import { IslandMaterials, disposeGeometry } from './primitives';
import { SharedJobActor } from './sharedJobActor';
import { makeFurniture } from './furniture';
import { applyFurnitureGrowth } from './growthVisuals';
import type { IslandStageItem } from './types';
import { makeExpansion, makeLighthouse, makeScenery, makeStarTree } from './scenery';
import { fitSharedActivityFrame } from './sharedActivityFraming';
import { sampleSharedActivityPoses } from './sharedActivityPoseSamples';
import { segmentHitsMesh } from './sharedActivityOcclusion';
import type { SharedActivityPlan } from './sharedActivities';

const species = ['otter', 'rabbit', 'fox'] as const;
function vertices(mesh: THREE.Mesh, relativeTo: THREE.Object3D) {
    mesh.updateWorldMatrix(true, false); relativeTo.updateWorldMatrix(true, false);
    const matrix = relativeTo.matrixWorld.clone().invert().multiply(mesh.matrixWorld), attr = mesh.geometry.getAttribute('position');
    return Array.from({ length: attr.count }, (_, i) => new THREE.Vector3().fromBufferAttribute(attr, i).applyMatrix4(matrix));
}
describe('the same actual tail has a reversible sitting joint', () => {
    for (const id of species) it(`${id}: original standing shape, clear backboards and standing borrowed pose`, () => {
        const materials = new IslandMaterials(), scene = new THREE.Scene(), resident = new IslandResident(id, materials, [0, 0, 2], () => {});
        scene.add(resident.group);
        const shape = resident.tail.children[0] as THREE.Mesh, raw = Array.from(shape.geometry.getAttribute('position').array);
        const reference = new THREE.Mesh(new THREE.SphereGeometry(1, id === 'otter' ? 32 : 16, id === 'otter' ? 24 : 12));
        reference.position.set(0, id === 'otter' ? .245 : .19, id === 'otter' ? -.28 : -.31);
        reference.scale.set(...(id === 'otter' ? [.105, .105, .105] : id === 'rabbit' ? [.12, .12, .12] : [.2, .105, .6]) as [number, number, number]);
        if (id !== 'otter') reference.rotation.x = -.2;
        const space = new THREE.Group(); space.add(reference); space.updateMatrixWorld(true);
        const expected = vertices(reference, space), standing = vertices(shape, resident.body);
        expect(standing).toHaveLength(expected.length); standing.forEach((point, i) => expect(point.distanceTo(expected[i])).toBeLessThan(1e-7));
        const bench: IslandStageItem = { id: 'seat', kind: 'bench', position: { x: 0, z: 0 }, rotation: Math.PI * .54, growthLevel: 3 };
        const support = makeFurniture('bench', materials); applyFurnitureGrowth(support, bench, materials); support.rotation.y = bench.rotation; scene.add(support);
        resident.visit(bench, 0, true, [bench], 0, { points: [{ x: 0, z: 2 }, { x: 0, z: 0 }], yaw: bench.rotation });
        expect(resident.seatContact.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(0, .5, 0))).toBeLessThan(1e-7);
        const seated = vertices(shape, support), index = shape.geometry.index;
        // Conservative boxes include the actual rounded backboard solids. A
        // real tail triangle clearing these boxes cannot cross either board.
        const boards = [.685, .875].map(y => new THREE.Box3(new THREE.Vector3(-.57, y - .08, -.295), new THREE.Vector3(.57, y + .08, -.185)));
        const folded = resident.tail.quaternion.clone(); resident.tail.rotation.set(0, 0, 0);
        const oldPose = vertices(shape, support);
        expect(oldPose.some(point => boards.some(board => board.containsPoint(point))), 'The prior unfolded sitting pose really crossed a backboard').toBe(true);
        resident.tail.quaternion.copy(folded);
        for (let i = 0; i < (index?.count ?? seated.length); i += 3) {
            const triangle = new THREE.Triangle(...[0, 1, 2].map(j => seated[index ? index.getX(i + j) : i + j]) as [THREE.Vector3, THREE.Vector3, THREE.Vector3]);
            expect(boards.some(board => board.intersectsTriangle(triangle))).toBe(false);
        }
        // Check the real grown support meshes too: clearing its backboards
        // must not move the tail through a seat slat, armrest or leg instead.
        support.updateWorldMatrix(true, true);
        const supportMeshes: THREE.Mesh[] = [];
        support.traverseVisible(object => { if (object instanceof THREE.Mesh) supportMeshes.push(object); });
        const world = vertices(shape, scene);
        for (const mesh of supportMeshes) {
            const occluder = { mesh, inverse: mesh.matrixWorld.clone().invert() };
            for (let i = 0; i < (index?.count ?? world.length); i += 3) for (let edge = 0; edge < 3; edge++) {
                const a = world[index ? index.getX(i + edge) : i + edge];
                const b = world[index ? index.getX(i + (edge + 1) % 3) : i + (edge + 1) % 3];
                expect(segmentHitsMesh(a, b, occluder) || segmentHitsMesh(b, a, occluder)).toBe(false);
            }
        }
        if (id === 'fox') {
            const bounds = new THREE.Box3().setFromPoints(seated);
            expect(bounds.max.y, 'The long tail hangs beside the hip, below the offered objects').toBeLessThan(1);
            expect(bounds.max.x).toBeLessThan(.1);
            expect(bounds.min.y).toBeGreaterThan(0);
            const bodyPoints = vertices(shape, resident.body);
            expect(bodyPoints.some(p => (p.x / .33) ** 2 + ((p.y - .51) / .37) ** 2 + (p.z / .265) ** 2 < 1),
                'The same tail still joins the actual torso').toBe(true);
        }
        const uuid = resident.tail.uuid, shapeUuid = shape.uuid;
        const actor = new SharedJobActor(resident); actor.pose(new THREE.Vector3(1.5, 0, 2), 1.2);
        expect(resident.tail.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-7);
        actor.restore(); expect(resident.tail.quaternion.angleTo(folded)).toBeLessThan(1e-7);
        expect(resident.tail.uuid).toBe(uuid); expect(shape.uuid).toBe(shapeUuid);
        expect(Array.from(shape.geometry.getAttribute('position').array)).toEqual(raw);
        resident.disposeAppearance(); disposeGeometry(scene); materials.dispose(); reference.geometry.dispose();
        (reference.material as THREE.Material).dispose();
    });

    it('keeps the recorded star handoff visible past the real fox tail in every shared phase', () => {
        const materials = new IslandMaterials();
        const actors = (['otter', 'rabbit', 'fox'] as const).map((id, index) => new IslandResident(id, materials,
            [[.7233865332371675, 0, 1.721584880845756], [1.5, 0, 2.52], [-.5, .5668, .75]][index] as [number, number, number], () => {}));
        const sourceItem: IslandStageItem = { id: 'source', kind: 'lantern', position: { x: 1.5, z: 1.75 }, rotation: 0 };
        const seatItem: IslandStageItem = { id: 'seat', kind: 'mushroom', position: { x: -.5, z: .75 }, rotation: Math.PI / 2 };
        const from = { x: 1.5, z: 2.52 }, handoffPoint = { x: .64, z: .75 }, items = [sourceItem, seatItem];
        const plan: SharedActivityPlan = { kind: 'star', pairId: '0875-tablet-star', selectedItemId: 'source', source: sourceItem,
            seat: seatItem, carrier: 1, receiver: 2, handoffPoint,
            receiverRoute: { points: [seatItem.position!, seatItem.position!], yaw: Math.PI / 2 },
            gatherRoute: { points: [from, from], yaw: Math.PI },
            deliveryRoute: { points: [from, { x: 1.75, z: 1.5 }, { x: 1, z: .75 }, handoffPoint], yaw: -Math.PI / 2 } };
        actors[1].visit(sourceItem, 0, true, items, 6, plan.gatherRoute);
        actors[2].visit(seatItem, 0, true, items, 6, plan.receiverRoute);
        actors[1].replayUse(-.0017500000000048505 * 1200, false); actors[1].update(0);
        const source = makeFurniture('lantern', materials), seat = makeFurniture('mushroom', materials);
        source.position.set(1.5, 0, 1.75); seat.position.set(-.5, 0, .75); seat.rotation.y = Math.PI / 2;
        const scenery = [makeScenery(materials), makeStarTree(materials), makeExpansion(materials), makeLighthouse(materials)];
        const frame = fitSharedActivityFrame(plan, { carrier: actors[1].group, receiver: actors[2].group, source, seat,
            residents: actors, completedSets: 6, viewportWidth: 768, occluders: [...scenery, actors[0].group] }, 1.6340988096492153);
        const sampled = sampleSharedActivityPoses(plan, actors, 6, frame.presentationHands)!;
        try {
            expect(frame.visibilityDiagnostics?.readabilitySatisfied).toBe(true);
            const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(frame.quaternion), depth = frame.position.dot(backward);
            let rays = 0, oldFoldHits = 0;
            for (const sample of sampled.options[0].samples) {
                const tail = sample.self.find(entry => entry.mesh.parent?.name === 'resident-tail' && entry.mesh.scale.z > .5)!;
                expect(tail).toBeDefined();
                // Isolate the former defect on these identical surfaces/camera:
                // only the old joint transform is substituted, never the rays.
                const bodyWorld = tail.inverse.clone().invert().multiply(tail.mesh.matrix.clone().invert())
                    .multiply(tail.mesh.parent!.matrix.clone().invert());
                const oldJoint = new THREE.Matrix4().compose(new THREE.Vector3(.18, .19, .3),
                    new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, Math.PI, 0)), new THREE.Vector3(1, 1, 1));
                const oldShape = new THREE.Matrix4().compose(new THREE.Vector3(-.18, 0, -.61),
                    new THREE.Quaternion().setFromEuler(new THREE.Euler(-.2, 0, 0)), new THREE.Vector3(.2, .105, .6));
                const oldTail = { mesh: tail.mesh, inverse: bodyWorld.multiply(oldJoint).multiply(oldShape).invert() };
                for (const point of sample.surface) {
                    const origin = point.clone().addScaledVector(backward, depth - point.dot(backward));
                    const end = point.clone().addScaledVector(backward, .015);
                    expect(segmentHitsMesh(origin, end, tail), `${sample.phase}: the actual tail hides the offered star`).toBe(false);
                    if (segmentHitsMesh(origin, end, oldTail)) oldFoldHits++;
                    rays++;
                }
            }
            expect(rays).toBeGreaterThan(1000);
            expect(oldFoldHits, 'The prior upright tail really obstructed the same star surfaces').toBeGreaterThan(0);
            expect(new Set(sampled.options[0].samples.map(sample => sample.phase))).toEqual(new Set(['gather', 'carry', 'share', 'enjoy', 'settled']));
            expect(sampled.options[0].samples.some(sample => sample.reduced)).toBe(true);
        } finally {
            sampled.dispose();
            [...actors.map(actor => actor.group), source, seat, ...scenery].forEach(disposeGeometry); materials.dispose();
        }
    });
});
