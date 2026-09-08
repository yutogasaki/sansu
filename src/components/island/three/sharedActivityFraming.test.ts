import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandResident } from './animals';
import { makeFurniture } from './furniture';
import { disposeGeometry, IslandMaterials } from './primitives';
import { boxCorners } from './sceneFraming';
import { makeExpansion, makeLighthouse, makeScenery, makeStarTree } from './scenery';
import { chooseSharedActivityPresentation, fitSharedActivityFrame, type SharedActivityFrame } from './sharedActivityFraming';
import type { SharedActivityPlan } from './sharedActivities';
import { SharedActivityVisuals } from './sharedActivityVisuals';
import { chooseSharedActivity, sharedActivityDeliveryPlans } from './sharedActivities';
import type { IslandStageItem } from './types';

const PAIRS = [
    { kind: 'flower', source: 'flower', seat: 'bench' },
    { kind: 'star', source: 'lantern', seat: 'mushroom' },
    { kind: 'bubble', source: 'fountain', seat: 'swing' },
] as const;
const VIEWS = [{ name: 'phone', width: 390, height: 386 }, { name: 'tablet', width: 768, height: 430 }];
function camera(frame: SharedActivityFrame) {
    const result = new THREE.OrthographicCamera(frame.left, frame.right, frame.top, frame.bottom, .1, 100);
    result.position.copy(frame.position); result.quaternion.copy(frame.quaternion);
    result.updateMatrixWorld(true); result.updateProjectionMatrix();
    return result;
}
function visible(object: THREE.Object3D, view: THREE.Camera) {
    for (const corner of boxCorners(new THREE.Box3().setFromObject(object, true))) {
        corner.project(view);
        expect(Math.abs(corner.x), `${object.name} exceeds horizontal frame`).toBeLessThan(.97);
        expect(Math.abs(corner.y), `${object.name} exceeds vertical frame`).toBeLessThan(.97);
        expect(Math.abs(corner.z)).toBeLessThan(1);
    }
}
function blockedAt(point: THREE.Vector3, view: THREE.Camera, object: THREE.Object3D) {
    object.updateWorldMatrix(true, true);
    const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(view.quaternion);
    const distance = view.position.clone().sub(point).dot(backward);
    const ray = new THREE.Raycaster(point.clone().addScaledVector(backward, distance), backward.negate(), 0, distance - .04);
    return ray.intersectObject(object, true).length > 0;
}

describe('one side view contains the complete shared delivery', () => {
    it.each(PAIRS)('$kind fits all quarter-turn chair directions and phone/tablet stage shapes', pair => {
        const materials = new IslandMaterials();
        for (const rotation of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
            const front = new THREE.Vector3(Math.sin(rotation), 0, Math.cos(rotation));
            const side = new THREE.Vector3(front.z, 0, -front.x);
            const seatPoint = { x: 0, z: .2 };
            const sourcePoint = { x: front.x * 1.9, z: .2 + front.z * 1.9 };
            const gatherPoint = { x: front.x * 2.65, z: .2 + front.z * 2.65 };
            const handoffPoint = { x: front.x * 1.24, z: .2 + front.z * 1.24 };
            const sourceItem: IslandStageItem = { id: 'source', kind: pair.source, position: sourcePoint, rotation };
            const seatItem: IslandStageItem = { id: 'seat', kind: pair.seat, position: seatPoint, rotation };
            // Navigation is tested by the selector suite. This constructed bend
            // deliberately extends beyond the direct source→seat line to test
            // whether framing contains a whole route rather than its endpoints.
            const plan: SharedActivityPlan = { kind: pair.kind, pairId: pair.kind, selectedItemId: 'source',
                source: sourceItem, seat: seatItem, receiver: 0, carrier: 1, handoffPoint,
                receiverRoute: { points: [seatPoint, seatPoint], yaw: rotation },
                gatherRoute: { points: [gatherPoint, gatherPoint], yaw: rotation + Math.PI },
                deliveryRoute: { points: [gatherPoint,
                    { x: sourcePoint.x + side.x * .95, z: sourcePoint.z + side.z * .95 }, handoffPoint], yaw: rotation + Math.PI } };
            const carrier = new IslandResident('otter', materials, [gatherPoint.x, 0, gatherPoint.z], () => {});
            const receiver = new IslandResident('rabbit', materials, [seatPoint.x, 0, seatPoint.z], () => {});
            const source = makeFurniture(pair.source, materials), seat = makeFurniture(pair.seat, materials);
            source.position.set(sourcePoint.x, 0, sourcePoint.z); source.rotation.y = rotation;
            seat.position.set(seatPoint.x, 0, seatPoint.z); seat.rotation.y = rotation;
            carrier.group.name = 'carrier'; receiver.group.name = 'receiver'; source.name = 'source'; seat.name = 'seat';
            const visuals = new SharedActivityVisuals(materials);
            try {
                for (const viewport of VIEWS) {
                    carrier.group.position.set(gatherPoint.x, 0, gatherPoint.z);
                    carrier.group.rotation.y = rotation + Math.PI;
                    carrier.visit(sourceItem, 0, true, [sourceItem, seatItem], 6, plan.gatherRoute);
                    receiver.visit(seatItem, 0, true, [sourceItem, seatItem], 6, plan.receiverRoute);
                    const beforeRoots = [carrier.group.position.toArray(), receiver.group.position.toArray(), source.position.toArray(), seat.position.toArray()];
                    // Property insertion order must not determine which object
                    // supplies the carrier sweep or the recipient envelope.
                    const frame = fitSharedActivityFrame(plan, { source, seat, receiver: receiver.group, carrier: carrier.group,
                        viewportWidth: viewport.width }, viewport.width / viewport.height);
                    const view = camera(frame), frozen = [...view.matrixWorld.elements, ...view.projectionMatrix.elements];
                    expect([carrier.group.position.toArray(), receiver.group.position.toArray(), source.position.toArray(), seat.position.toArray()]).toEqual(beforeRoots);
                    for (const object of [carrier.group, receiver.group, source, seat]) visible(object, view);
                    const horizontal = new THREE.Vector3(0, 0, 1).applyQuaternion(view.quaternion).setY(0).normalize();
                    expect(Math.abs(horizontal.dot(front))).toBeLessThan(1e-10);
                    expect(horizontal.dot(new THREE.Vector3(4.7, 0, 13.5))).toBeGreaterThanOrEqual(-1e-10);
                    const elevation = new THREE.Vector3(0, 0, 1).applyQuaternion(view.quaternion);
                    expect(elevation.y / Math.hypot(elevation.x, elevation.z)).toBeCloseTo(8 / 13, 8);
                    const recipientCenter = receiver.group.position.clone().project(view);
                    const carrierAtHandoff = new THREE.Vector3(handoffPoint.x, receiver.group.position.y, handoffPoint.z).project(view);
                    // The two centerlines occupy separate lateral positions;
                    // one resident's back cannot cover the other centerline.
                    expect(Math.abs(recipientCenter.x - carrierAtHandoff.x) * viewport.width / 2).toBeGreaterThan(60);
                    carrier.walkToPoint(plan.deliveryRoute, 0, false, 6);
                    for (let time = 0; time <= 7000; time += 100) {
                        carrier.update(time);
                        carrier.setSharedPose('offer', 1, receiver.handAnchor(new THREE.Vector3()));
                        visible(carrier.group, view); visible(receiver.group, view);
                    }
                    receiver.replayUse(7000, false);
                    for (let time = 7000; time <= 8200; time += 100) {
                        receiver.update(time);
                        const target = receiver.group.position.clone().add(new THREE.Vector3(front.x * .5, .87, front.z * .5));
                        receiver.setSharedPose('receive', 1, target);
                        const hand = receiver.handAnchor(new THREE.Vector3());
                        visuals.update({ kind: pair.kind, phase: 'enjoy', progress: (time - 7000) / 1200,
                            source: source.position, carrier: carrier.handAnchor(new THREE.Vector3()), receiver: hand, reduced: false });
                        visible(receiver.group, view);
                        // Inspect only the actual visible prop, excluding the
                        // preallocated hidden alternatives at the scene origin.
                        for (const child of visuals.group.children) if (child.visible && visuals.group.visible) visible(child, view);
                    }
                    expect([...view.matrixWorld.elements, ...view.projectionMatrix.elements]).toEqual(frozen);
                }
            } finally {
                visuals.dispose();
                for (const object of [carrier.group, receiver.group, source, seat]) disposeGeometry(object);
            }
        }
        materials.dispose();
    });

    it.each([
        { name: '624 star spectator', kind: 'star', source: 'lantern', seat: 'mushroom', carrier: 1, receiver: 2,
            positions: [[.47479093270390016, 0, 1.432555959257745], [1.5, 0, 2.52], [-.5, 0, .75]] },
        { name: '484 star self-occlusion', kind: 'star', source: 'lantern', seat: 'mushroom', carrier: 1, receiver: 2,
            positions: [[1.2651768805826085, 0, 2.4860067114370348], [1.5, 0, .98], [-.5, 0, .75]] },
        { name: '484 bubble self-occlusion', kind: 'bubble', source: 'fountain', seat: 'swing', carrier: 2, receiver: 0,
            positions: [[-.5, 0, .75], [.25, 0, 2.5], [1.5, 0, 2.85]] },
    ] as const)('scores actual held poses for $name across every phase without touching the live rigs', fixture => {
        const materials = new IslandMaterials();
        const sourceItem: IslandStageItem = { id: 'source', kind: fixture.source, position: { x: 1.5, z: 1.75 }, rotation: 0 };
        const seatItem: IslandStageItem = { id: 'seat', kind: fixture.seat, position: { x: -.5, z: .75 }, rotation: Math.PI / 2 };
        const actors = (['otter', 'rabbit', 'fox'] as const).map((species, index) => new IslandResident(species, materials,
            [...fixture.positions[index]], () => {}));
        const source = makeFurniture(fixture.source, materials), seat = makeFurniture(fixture.seat, materials);
        source.position.set(1.5, 0, 1.75); seat.position.set(-.5, 0, .75); seat.rotation.y = Math.PI / 2;
        const items = [sourceItem, seatItem];
        // These are the recorded occupied source approaches, including the
        // north-side 484 lantern approach selected around the nearby otter.
        const occupiedSource = actors[fixture.carrier].group.position;
        const sourcePoint = { x: occupiedSource.x, z: occupiedSource.z };
        actors[fixture.carrier].visit(sourceItem, 0, true, items, 6, { points: [sourcePoint, sourcePoint],
            yaw: Math.atan2(sourceItem.position!.x - sourcePoint.x, sourceItem.position!.z - sourcePoint.z) });
        actors[fixture.receiver].visit(seatItem, 0, true, items, 6);
        const plan = chooseSharedActivity(items, actors.map(actor => ({ position: actor.group.position, visible: true, itemId: actor.itemId })), 6, 'source')!;
        expect(plan).toBeDefined(); expect(plan.carrier).toBe(fixture.carrier); expect(plan.receiver).toBe(fixture.receiver);
        const objects = { carrier: actors[plan.carrier].group, receiver: actors[plan.receiver].group, source, seat,
            residents: actors, completedSets: 6, occluders: actors.filter((_, index) => index !== plan.carrier && index !== plan.receiver).map(actor => actor.group) };
        const transforms = () => actors.flatMap(actor => {
            const result: unknown[] = [];
            actor.group.traverse(object => result.push({ position: object.position.toArray(), quaternion: object.quaternion.toArray(), scale: object.scale.toArray() }));
            return result;
        });
        const before = transforms();
        try {
            for (const viewport of VIEWS) {
                const frame = fitSharedActivityFrame(plan, { ...objects, viewportWidth: viewport.width }, viewport.width / viewport.height);
                const diagnostic = frame.visibilityDiagnostics!;
                expect(frame.presentationHands).toBeDefined(); expect(diagnostic.sampleCount).toBe(18);
                expect(diagnostic.handCandidates).toBe(4); expect(diagnostic.cameraCandidates).toBe(6);
                expect(diagnostic.fullyHiddenPhases).toBe(0); expect(diagnostic.minimumPhaseVisibility).toBeGreaterThan(.5);
                for (const phase of ['gather', 'carry', 'share', 'enjoy', 'reduced'] as const) expect(diagnostic.phaseVisibility[phase]).toBeGreaterThan(.5);
                expect(diagnostic.bodySeparationPx).toBeGreaterThanOrEqual(60);
                expect(diagnostic.testedRays).toBeLessThanOrEqual(18 * 9);
                const view = camera(frame);
                for (const object of [objects.carrier, objects.receiver, source, seat]) visible(object, view);
                expect(fitSharedActivityFrame(plan, { ...objects, viewportWidth: viewport.width }, viewport.width / viewport.height)).toEqual(frame);
                const resized = fitSharedActivityFrame(plan, { ...objects, viewportWidth: viewport.width, presentationHands: frame.presentationHands }, viewport.width / viewport.height);
                expect(resized.presentationHands).toEqual(frame.presentationHands);
                expect(resized.visibilityDiagnostics!.handCandidates).toBe(1);
            }
            expect(transforms()).toEqual(before);
        } finally { actors.forEach(actor => disposeGeometry(actor.group)); disposeGeometry(source); disposeGeometry(seat); materials.dispose(); }
    });

    it.each([
        { name: 'phone star', kind: 'star', width: 390, aspect: 1.0103593585391548, carrier: 1, receiver: 2,
            positions: [[.75, 0, 2.5], [1.5, 0, .98], [-.5, .5668, .75]], usePhase: .002083333313469969,
            handoff: [.4338333304894507, 1.4038771374401926], approachYaw: Math.PI * 2, deliveryYaw: -2.181661564992912 },
        { name: 'tablet star', kind: 'star', width: 768, aspect: 1.6340988096492153, carrier: 1, receiver: 2,
            positions: [[.7233865332371675, 0, 1.721584880845756], [1.5, 0, 2.52], [-.5, .5668, .75]], usePhase: .0017500000000048505,
            handoff: [.6400000000000001, .7500000000000001], approachYaw: Math.PI, deliveryYaw: -Math.PI / 2 },
        { name: 'phone flower', kind: 'flower', width: 390, aspect: 1.0103580835765642, carrier: 0, receiver: 1,
            positions: [[1.5, 0, 2.52], [-.5, .3902, .75], [6.26, 0, .83]], usePhase: .0023333333333357587,
            handoff: [.47479093270390016, 1.4325559592577448], approachYaw: Math.PI, deliveryYaw: -2.181661564992912 },
        { name: 'tablet flower', kind: 'flower', width: 768, aspect: 1.6340542071961468, carrier: 0, receiver: 1,
            positions: [[1.5, 0, 2.52], [-.5, .3902, .75], [6.26, 0, .83]], usePhase: .024749999999997576,
            handoff: [.47479093270390016, 1.4325559592577448], approachYaw: Math.PI, deliveryYaw: -2.181661564992912 },
        { name: 'phone bubble', kind: 'bubble', width: 390, aspect: 1.0103526142087893, carrier: 2, receiver: 0,
            positions: [[-.5, .439, .75], [.25, 0, 2.5], [1.5, 0, 2.85]], usePhase: .0015000000099341074,
            handoff: [.8400000000000001, .7500000000000001], approachYaw: Math.PI, deliveryYaw: -Math.PI / 2 },
        { name: 'tablet bubble', kind: 'bubble', width: 768, aspect: 1.6340600067423305, carrier: 2, receiver: 0,
            positions: [[-.5, .439, .75], [3, 0, 2.25], [1.5, 0, 2.85]], usePhase: .0017500000397315792,
            handoff: [.8400000000000001, .7500000000000001], approachYaw: Math.PI, deliveryYaw: -Math.PI / 2 },
    ] as const)('keeps each subject readable in the recorded 0875 $name scene', fixture => {
        // Captured 0875 roots, routes, stage ratios, and first-gather use phase.
        // In the star scenes the old prop-only choice hid the lamp (phone) or
        // rabbit torso/selected arm/contact (tablet). Full scenery is necessary:
        // its actual trees/cottage also block several opposite-side candidates.
        const materials = new IslandMaterials(), pair = PAIRS.find(pair => pair.kind === fixture.kind)!;
        const sourceItem: IslandStageItem = { id: 'source', kind: pair.source, position: { x: 1.5, z: 1.75 }, rotation: 0 };
        const seatItem: IslandStageItem = { id: 'seat', kind: pair.seat, position: { x: -.5, z: .75 }, rotation: Math.PI / 2 };
        const actors = (['otter', 'rabbit', 'fox'] as const).map((species, index) =>
            new IslandResident(species, materials, [...fixture.positions[index]], () => {}));
        const source = makeFurniture(pair.source, materials), seat = makeFurniture(pair.seat, materials);
        source.position.set(1.5, 0, 1.75); seat.position.set(-.5, 0, .75); seat.rotation.y = Math.PI / 2;
        const start = actors[fixture.carrier].group.position, from = { x: start.x, z: start.z };
        const handoffPoint = { x: fixture.handoff[0], z: fixture.handoff[1] };
        const chair = seatItem.position!, items = [sourceItem, seatItem];
        const plan: SharedActivityPlan = { kind: fixture.kind, pairId: fixture.kind, selectedItemId: sourceItem.id,
            source: sourceItem, seat: seatItem, receiver: fixture.receiver, carrier: fixture.carrier, handoffPoint,
            receiverRoute: { points: [chair, chair], yaw: Math.PI / 2 },
            gatherRoute: { points: [from, from], yaw: fixture.approachYaw },
            deliveryRoute: { points: [from, ...(fixture.name === 'tablet star' ? [{ x: 1.75, z: 1.5 }, { x: 1, z: .75 }] : []), handoffPoint], yaw: fixture.deliveryYaw } };
        actors[plan.carrier].visit(sourceItem, 0, true, items, 6, plan.gatherRoute);
        actors[plan.receiver].visit(seatItem, 0, true, items, 6, plan.receiverRoute);
        actors[plan.carrier].replayUse(-fixture.usePhase * 1200, false); actors[plan.carrier].update(0);
        const scenery = [makeScenery(materials), makeStarTree(materials), makeExpansion(materials), makeLighthouse(materials)];
        try {
            const frame = fitSharedActivityFrame(plan, { carrier: actors[plan.carrier].group, receiver: actors[plan.receiver].group,
                source, seat, residents: actors, completedSets: 6, viewportWidth: fixture.width,
                occluders: [...scenery, ...actors.filter((_, index) => index !== plan.carrier && index !== plan.receiver).map(actor => actor.group)] }, fixture.aspect);
            const diagnostic = frame.visibilityDiagnostics!;
            expect(diagnostic.sampleCount).toBe(18); expect(diagnostic.handCandidates).toBe(4);
            expect(diagnostic.cameraCandidates).toBe(fixture.kind === 'star' ? 18 : 6);
            expect(diagnostic.cameraHeight).toBe(fixture.kind === 'star' ? 13 : 8);
            expect(diagnostic.readabilitySatisfied).toBe(true);
            expect(diagnostic.minimumPhaseVisibility).toBeGreaterThanOrEqual(.5);
            expect(diagnostic.minimumCompositionVisibility).toBeGreaterThanOrEqual(.5);
            expect(diagnostic.fullyHiddenCompositionChannels).toBe(0);
            expect(diagnostic.compositionVisibility.gather!.source).toBeGreaterThanOrEqual(.5);
            expect(diagnostic.bodySeparationPx).toBeGreaterThanOrEqual(60);
            for (const phase of ['gather', 'carry', 'share', 'enjoy', 'settled', 'reduced'] as const) {
                const composition = diagnostic.compositionVisibility[phase]!;
                for (const value of Object.values(composition)) expect(value).toBeGreaterThanOrEqual(.5);
                if (fixture.kind === 'star') {
                    expect(composition.carrierContact).toBe(1); expect(composition.receiverContact).toBe(1);
                    expect(composition.carrierHead).toBe(1); expect(composition.receiverHead).toBe(1);
                }
            }
            for (const object of [actors[plan.carrier].group, actors[plan.receiver].group, source, seat]) visible(object, camera(frame));
        } finally { actors.forEach(actor => disposeGeometry(actor.group)); [source, seat, ...scenery].forEach(disposeGeometry); materials.dispose(); }
    });

    it.each(['phone', 'tablet', 'obstructed'] as const)('selects a legal fixed presentation for cdc5 %s without inventing readability', scenario => {
        const materials = new IslandMaterials(), phone = scenario === 'phone';
        const sourceItem: IslandStageItem = { id: 'source', kind: 'lantern', position: { x: 1.5, z: 1.75 }, rotation: 0 };
        const seatItem: IslandStageItem = { id: 'seat', kind: 'mushroom', position: { x: -.5, z: .75 }, rotation: Math.PI / 2 };
        const items = [sourceItem, seatItem];
        const actors = [
            new IslandResident('otter', materials, phone ? [.75, 0, 2.5] : [.5, 0, 2.25], () => {}),
            new IslandResident('rabbit', materials, [1.5, 0, phone ? .98 : 2.52], () => {}),
            new IslandResident('fox', materials, [-.5, .5668, .75], () => {}),
        ];
        const approach = { x: 1.5, z: phone ? .98 : 2.52 };
        actors[1].visit(sourceItem, 0, true, items, 6, { points: [approach, approach], yaw: phone ? Math.PI * 2 : Math.PI });
        actors[2].visit(seatItem, 0, true, items, 6);
        actors[1].replayUse(-(phone ? .02441666666666909 : .0020833333432650155) * 1200, false); actors[1].update(0);
        const candidates = actors.map(actor => ({ position: actor.group.position, visible: true, itemId: actor.itemId }));
        const current = chooseSharedActivity(items, candidates, 6, 'source')!;
        const plans = sharedActivityDeliveryPlans(current, items, candidates, 6);
        expect(plans).toHaveLength(3);
        const source = makeFurniture('lantern', materials), seat = makeFurniture('mushroom', materials);
        source.position.set(1.5, 0, 1.75); seat.position.set(-.5, 0, .75); seat.rotation.y = Math.PI / 2;
        const scenery: THREE.Object3D[] = [makeScenery(materials), makeStarTree(materials), makeExpansion(materials), makeLighthouse(materials)];
        const obstructionMaterial = new THREE.MeshBasicMaterial();
        if (scenario === 'obstructed') {
            // A real opaque enclosure covers every sampled subject from every
            // bounded view. Exhaustion must remain an explicit failed result.
            const obstruction = new THREE.Mesh(new THREE.BoxGeometry(12, 8, 12), obstructionMaterial);
            obstruction.position.y = 2; scenery.push(obstruction);
        }
        const before = JSON.stringify({ plans, roots: actors.map(actor => actor.group.position.toArray()) });
        const attempted: SharedActivityPlan[] = [];
        try {
            const result = chooseSharedActivityPresentation(plans, candidate => {
                attempted.push(candidate);
                return fitSharedActivityFrame(candidate, { carrier: actors[1].group, receiver: actors[2].group, source, seat,
                    residents: actors, completedSets: 6, viewportWidth: phone ? 390 : 768, occluders: [...scenery, actors[0].group] },
                phone ? 1.0103642189236905 : 1.6340638092168869);
            });
            expect(result.attemptedPlans).toBe(phone ? 1 : scenario === 'tablet' ? 2 : 3);
            expect(attempted).toEqual(plans.slice(0, result.attemptedPlans));
            expect(result.plan).toBe(scenario === 'tablet' ? plans[1] : current);
            expect(result.satisfied).toBe(scenario !== 'obstructed');
            expect(result.frame.visibilityDiagnostics!.readabilitySatisfied).toBe(result.satisfied);
            if (result.satisfied) {
                expect(result.frame.visibilityDiagnostics!.minimumPhaseVisibility).toBeGreaterThanOrEqual(.5);
                expect(result.frame.visibilityDiagnostics!.minimumCompositionVisibility).toBeGreaterThanOrEqual(.5);
                expect(result.frame.visibilityDiagnostics!.bodySeparationPx).toBeGreaterThanOrEqual(60);
                expect(result.frame.visibilityDiagnostics!.cameraHeight).toBe(phone ? 13 : 8);
            } else expect(result.frame.visibilityDiagnostics!.minimumCompositionVisibility).toBe(0);
            expect(JSON.stringify({ plans, roots: actors.map(actor => actor.group.position.toArray()) })).toBe(before);
        } finally {
            actors.forEach(actor => disposeGeometry(actor.group)); [source, seat, ...scenery].forEach(disposeGeometry);
            obstructionMaterial.dispose(); materials.dispose();
        }
    });

    it('fits actual transformed world objects and a bridge waypoint without changing their transforms', () => {
        const scene = new THREE.Group(); scene.position.set(4, 0, 0);
        const bodyGeometry = new THREE.BoxGeometry(.8, 2.2, .9), material = new THREE.MeshBasicMaterial();
        const carrier = new THREE.Mesh(bodyGeometry, material), receiver = new THREE.Mesh(bodyGeometry, material);
        const source = new THREE.Mesh(new THREE.BoxGeometry(.7, 1.2, .7), material), seat = new THREE.Mesh(new THREE.BoxGeometry(1.4, .7, .8), material);
        carrier.position.set(.1, 1.1, .2); receiver.position.set(1.5, 1.45, -.2);
        source.position.set(.1, .6, .3); seat.position.set(1.5, .35, -.2);
        scene.add(carrier, receiver, source, seat);
        const plan = { handoffPoint: { x: 5.1, z: -.2 }, deliveryRoute: { points: [{ x: 4.1, z: .2 }, { x: 4.7, z: 0 }, { x: 5.1, z: -.2 }], yaw: Math.PI / 2 } } as SharedActivityPlan;
        try {
            const objects = { carrier, receiver, source, seat }, baseFrame = fitSharedActivityFrame(plan, objects, 390 / 386);
            const view = camera(baseFrame);
            for (const object of [carrier, receiver, source, seat]) visible(object, view);
            expect(carrier.position.toArray()).toEqual([.1, 1.1, .2]);
            for (const point of plan.deliveryRoute.points) {
                const translated = new THREE.Box3(new THREE.Vector3(point.x - .4, 0, point.z - .45), new THREE.Vector3(point.x + .4, 2.2, point.z + .45));
                for (const corner of boxCorners(translated)) { corner.project(view); expect(Math.abs(corner.x)).toBeLessThan(1); expect(Math.abs(corner.y)).toBeLessThan(1); }
            }
            const ground = new THREE.Mesh(new THREE.BoxGeometry(100, .1, 100), material);
            ground.position.y = -3;
            const crown = new THREE.Mesh(new THREE.SphereGeometry(2, 12, 8), material); crown.position.y = 20;
            scene.add(ground, crown);
            // The aggregate parent box surrounds every target, but its actual
            // ground and crown triangles do not lie in front of any hand.
            expect(fitSharedActivityFrame(plan, { ...objects, occluders: [scene] }, 390 / 386)).toEqual(baseFrame);
            const hiddenParent = new THREE.Group(); hiddenParent.visible = false;
            const hidden = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), material); hiddenParent.add(hidden); scene.add(hiddenParent);
            expect(fitSharedActivityFrame(plan, { ...objects, occluders: [hidden] }, 390 / 386)).toEqual(baseFrame);

            const obstacleParent = new THREE.Group(); obstacleParent.position.set(-3, 1, 2); obstacleParent.rotation.y = .43;
            obstacleParent.scale.set(1.1, .9, 1.2);
            const obstacle = new THREE.Mesh(new THREE.SphereGeometry(.8, 12, 8), material); obstacleParent.add(obstacle);
            const anchor = new THREE.Box3().setFromObject(source, true).getCenter(new THREE.Vector3());
            const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(view.quaternion);
            obstacleParent.updateWorldMatrix(true, true);
            obstacle.position.copy(obstacleParent.worldToLocal(anchor.clone().addScaledVector(backward, 1.5)));
            obstacle.updateWorldMatrix(true, true);
            const flat = obstacle.clone(); flat.matrix.identity(); flat.position.set(0, 0, 0); flat.quaternion.identity(); flat.scale.set(1, 1, 1);
            flat.applyMatrix4(obstacle.matrixWorld);
            const transformed = fitSharedActivityFrame(plan, { ...objects, occluders: [obstacleParent] }, 390 / 386);
            expect(transformed).toEqual(fitSharedActivityFrame(plan, { ...objects, occluders: [flat] }, 390 / 386));
            expect(blockedAt(anchor, view, obstacleParent)).toBe(true);
            expect(blockedAt(anchor, camera(transformed), obstacleParent)).toBe(false);
            disposeGeometry(obstacleParent);
        } finally { disposeGeometry(scene); material.dispose(); }
    });
});

// Actual 5d7 report/trace fixtures: the tablet fox pickup had a hidden rabbit
// face despite phase-average head19/36. The unchanged cloud still includes ears;
// these numerical checks require a separate review of the real rendered face.
describe('recorded 5d7 subjects cannot borrow visibility from later poses', () => {
    it.each([
        {"name":"phone-flower","kind":"flower","width":390,"aspect":1.0103580835765642,"carrier":0,"receiver":1,"source":{"x":1.5,"z":1.75},"seat":{"x":-0.5,"z":0.75},"rotation":1.5707963267948966,"positions":[[1.5,0,2.52],[-0.5,0.39020000000000005,0.75],[6.26,0,0.83]],"usePhase":0.02325000001987064,"gather":{"points":[{"x":1.5,"z":2.52},{"x":1.5,"z":2.52}],"yaw":3.141592653589793},"delivery":{"points":[{"x":1.5,"z":2.52},{"x":0.47479093270390016,"z":1.4325559592577448}],"yaw":-2.181661564992912},"hands":{"carrier":"right","receiver":"left"}},
        {"name":"phone-star","kind":"star","width":390,"aspect":1.0103642112659563,"carrier":1,"receiver":2,"source":{"x":1.5,"z":1.75},"seat":{"x":-0.5,"z":0.75},"rotation":1.5707963267948966,"positions":[[1.75,0,2.75],[1.5,0,0.98],[-0.5,0.5668,0.75]],"usePhase":0.02333333332340165,"gather":{"points":[{"x":1.5,"z":0.98},{"x":1.5,"z":0.98}],"yaw":6.283185307179586},"delivery":{"points":[{"x":1.5,"z":0.98},{"x":0.4338333304894507,"z":1.4038771374401926}],"yaw":-2.181661564992912},"hands":{"carrier":"left","receiver":"left"}},
        {"name":"phone-bubble","kind":"bubble","width":390,"aspect":1.0103526142087893,"carrier":2,"receiver":0,"source":{"x":1.5,"z":1.75},"seat":{"x":-0.5,"z":0.75},"rotation":1.5707963267948966,"positions":[[-0.5,0.439,0.75],[2.5,0,0.75],[1.5,0,2.85]],"usePhase":0.007333333333335758,"gather":{"points":[{"x":1.5000000000000002,"z":0.6499999999999999},{"x":1.5,"z":2.85}],"yaw":3.141592653589793},"delivery":{"points":[{"x":1.5,"z":2.85},{"x":0.8400000000000001,"z":0.7500000000000001}],"yaw":-1.5707963267948968},"hands":{"carrier":"left","receiver":"left"}},
        {"name":"tablet-flower","kind":"flower","width":768,"aspect":1.6340542071961468,"carrier":0,"receiver":1,"source":{"x":1.5,"z":1.75},"seat":{"x":-0.5,"z":0.75},"rotation":1.5707963267948966,"positions":[[1.5,0,2.52],[-0.5,0.39020000000000005,0.75],[6.26,0,0.83]],"usePhase":0.013083333343268654,"gather":{"points":[{"x":1.5,"z":2.52},{"x":1.5,"z":2.52}],"yaw":3.141592653589793},"delivery":{"points":[{"x":1.5,"z":2.52},{"x":0.47479093270390016,"z":1.4325559592577448}],"yaw":-2.181661564992912},"hands":{"carrier":"right","receiver":"left"}},
        {"name":"tablet-star","kind":"star","width":768,"aspect":1.6340574565762696,"carrier":1,"receiver":2,"source":{"x":1.5,"z":1.75},"seat":{"x":-0.5,"z":0.75},"rotation":1.5707963267948966,"positions":[[1.619907711302245,0,2.619385918486055],[1.5,0,0.98],[-0.5,0.5668,0.75]],"usePhase":0.002083333323401651,"gather":{"points":[{"x":1.5,"z":0.98},{"x":1.5,"z":0.98}],"yaw":6.283185307179586},"delivery":{"points":[{"x":1.5,"z":0.98},{"x":0.4338333304894507,"z":1.4038771374401926}],"yaw":-2.181661564992912},"hands":{"carrier":"left","receiver":"left"}},
        {"name":"tablet-bubble","kind":"bubble","width":768,"aspect":1.6340600067423305,"carrier":2,"receiver":0,"source":{"x":1.5,"z":1.75},"seat":{"x":-0.5,"z":0.75},"rotation":1.5707963267948966,"positions":[[-0.5,0.439,0.75],[0,0,2.25],[1.5,0,2.85]],"usePhase":0.001999999990063467,"gather":{"points":[{"x":1.5,"z":2.85},{"x":1.5,"z":2.85}],"yaw":3.141592653589793},"delivery":{"points":[{"x":1.5,"z":2.85},{"x":0.8400000000000001,"z":0.7500000000000001}],"yaw":-1.5707963267948968},"hands":{"carrier":"left","receiver":"right"}},
        {"name":"tablet-fox-flower","kind":"flower","width":768,"aspect":1.6340613694224841,"carrier":1,"receiver":2,"source":{"x":2.5,"z":1.25},"seat":{"x":0.5,"z":1.5},"rotation":1.5707963267948966,"positions":[[2.5,0,2.02],[2.5,0,0.48],[0.5,0.4268,1.5]],"usePhase":0.0241666666468033,"gather":{"points":[{"x":2.5,"z":0.48},{"x":2.5,"z":0.48}],"yaw":6.283185307179586},"delivery":{"points":[{"x":2.5,"z":0.48},{"x":1.69,"z":1.5}],"yaw":-1.5707963267948966},"hands":{"carrier":"left","receiver":"right"}},
    ] as const)('$name preserves a legal readable presentation', fixture => {
        const materials = new IslandMaterials(), pair = PAIRS.find(pair => pair.kind === fixture.kind)!;
        const sourceItem: IslandStageItem = { id: 'source', kind: pair.source, position: { ...fixture.source }, rotation: 0 };
        const seatItem: IslandStageItem = { id: 'seat', kind: pair.seat, position: { ...fixture.seat }, rotation: fixture.rotation };
        const items = [sourceItem, seatItem], actors = (['otter', 'rabbit', 'fox'] as const).map((species, index) =>
            new IslandResident(species, materials, [...fixture.positions[index]], () => {}));
        const plan: SharedActivityPlan = { kind: fixture.kind, pairId: fixture.name, selectedItemId: sourceItem.id,
            source: sourceItem, seat: seatItem, carrier: fixture.carrier, receiver: fixture.receiver,
            receiverRoute: { points: [{ ...fixture.seat }, { ...fixture.seat }], yaw: fixture.rotation },
            gatherRoute: { points: fixture.gather.points.map(point => ({ ...point })), yaw: fixture.gather.yaw },
            deliveryRoute: { points: fixture.delivery.points.map(point => ({ ...point })), yaw: fixture.delivery.yaw },
            handoffPoint: { ...fixture.delivery.points[fixture.delivery.points.length - 1] } };
        actors[plan.carrier].visit(sourceItem, 0, true, items, 6, plan.gatherRoute);
        actors[plan.receiver].visit(seatItem, 0, true, items, 6, plan.receiverRoute);
        actors[plan.carrier].replayUse(-fixture.usePhase * 1200, false); actors[plan.carrier].update(0);
        const source = makeFurniture(pair.source, materials), seat = makeFurniture(pair.seat, materials);
        source.position.set(fixture.source.x, 0, fixture.source.z); seat.position.set(fixture.seat.x, 0, fixture.seat.z); seat.rotation.y = fixture.rotation;
        const scenery = [makeScenery(materials), makeStarTree(materials), makeExpansion(materials), makeLighthouse(materials)];
        const candidates = actors.map(actor => ({ position: { x: actor.group.position.x, z: actor.group.position.z }, visible: true, itemId: actor.itemId }));
        const objects = { source, seat, carrier: actors[plan.carrier].group, receiver: actors[plan.receiver].group,
            residents: actors, completedSets: 6, viewportWidth: fixture.width,
            occluders: [...scenery, ...actors.filter((_, index) => index !== plan.carrier && index !== plan.receiver).map(actor => actor.group)] };
        const frames: SharedActivityFrame[] = [];
        try {
            const plans = sharedActivityDeliveryPlans(plan, items, candidates, 6);
            const selected = chooseSharedActivityPresentation(plans, candidate => {
                const frame = fitSharedActivityFrame(candidate, objects, fixture.aspect); frames.push(frame); return frame;
            });
            expect(selected.satisfied).toBe(true);
            const diagnostic = selected.frame.visibilityDiagnostics!;
            expect(diagnostic.sampleCount).toBe(18); expect(diagnostic.poseIdentityVisibility).toHaveLength(18);
            expect(diagnostic.minimumPoseIdentityVisibility).toBeGreaterThanOrEqual(.5);
            for (const pose of diagnostic.poseIdentityVisibility) {
                expect(Object.keys(pose.visibility)).toHaveLength(4);
                for (const value of Object.values(pose.visibility)) expect(value).toBeGreaterThanOrEqual(.5);
            }
            expect(diagnostic.minimumPhaseVisibility).toBeGreaterThanOrEqual(.5);
            expect(diagnostic.minimumCompositionVisibility).toBeGreaterThanOrEqual(.5);
            expect(diagnostic.bodySeparationPx).toBeGreaterThanOrEqual(60);
            expect(diagnostic.cameraCandidates).toBe(6); expect(diagnostic.cameraHeight).toBe(8);
            for (const object of [source, seat, objects.carrier, objects.receiver]) visible(object, camera(selected.frame));
            if (fixture.name === 'tablet-fox-flower') {
                expect(plans).toHaveLength(3); expect(selected.attemptedPlans).toBe(3);
                const rejected = frames[1].visibilityDiagnostics!;
                expect(rejected.compositionVisibility.gather!.carrierHead).toBeCloseTo(19 / 36);
                expect(rejected.compositionVisibility.gather!.carrierBody).toBeCloseTo(20 / 36);
                expect(rejected.minimumPoseIdentityVisibility).toBeCloseTo(3 / 9);
                expect(rejected.readabilitySatisfied).toBe(false);
                expect(rejected.poseIdentityVisibility.filter(pose => pose.phase === 'gather').map(pose => pose.visibility.carrierHead))
                    .toEqual([5 / 9, 5 / 9, 6 / 9, 3 / 9]);
                expect(selected.plan).toBe(plans[2]);
                expect(selected.plan.handoffPoint.x).toBeCloseTo(1.4747909327039002);
                expect(selected.plan.handoffPoint.z).toBeCloseTo(2.182555959257745);
                expect(diagnostic.minimumPoseIdentityVisibility).toBe(1);
                expect(selected.frame.presentationHands).toEqual({ carrier: 'left', receiver: 'left' });
            } else {
                expect(selected.plan).toBe(plan); expect(selected.attemptedPlans).toBe(1); expect(frames).toHaveLength(1);
                expect(selected.frame.presentationHands).toEqual(fixture.hands);
            }
        } finally { [...actors.map(actor => actor.group), source, seat, ...scenery].forEach(disposeGeometry); materials.dispose(); }
    });
});
