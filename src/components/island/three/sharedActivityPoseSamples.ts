import * as THREE from 'three';
import { IslandResident } from './animals';
import { disposeGeometry, IslandMaterials } from './primitives';
import { FURNITURE_USE_MS } from './residentRig';
import { applyFurnitureUse, makeFurniture } from './furniture';
import { SHARED_ACTIVITY_TIMING, SharedActivityController, type SharedActivityHands } from './sharedActivityController';
import { SharedActivityVisuals, type SharedActivityPropPhase } from './sharedActivityVisuals';
import { isSharedActivityOccluderMaterial, type SharedActivityOccluder } from './sharedActivityOcclusion';
import type { SharedActivityPlan } from './sharedActivities';

export type SharedActivityCompositionChannel = 'source' | 'carrierHead' | 'receiverHead' | 'carrierBody' | 'receiverBody'
    | 'carrierArm' | 'receiverArm' | 'carrierContact' | 'receiverContact';
export interface SharedActivityPoseSample {
    phase: SharedActivityPropPhase;
    progress: number;
    reduced: boolean;
    surface: THREE.Vector3[];
    composition: Partial<Record<SharedActivityCompositionChannel, THREE.Vector3[]>>;
    self: (SharedActivityOccluder & { bounds: THREE.Box3 })[];
    bounds: THREE.Box3;
    carrierHand: THREE.Vector3;
    receiverHand: THREE.Vector3;
}
export interface SharedActivityPoseOption { hands: SharedActivityHands; samples: SharedActivityPoseSample[] }

const WINDOWS: Record<SharedActivityPropPhase, readonly number[]> = {
    gather: [0, .25, .65, .9], carry: [.08, .3, .5, .7, .92],
    share: [.08, .35, .65, .92], enjoy: [.15, .42, .75], settled: [1],
};

/** Each retained mesh uses its real geometry/material and the inverse from this
 * pose. The proxies can advance without mutating any earlier sample. */
function posedMeshes(object: THREE.Object3D) {
    const result: SharedActivityPoseSample['self'] = [];
    object.updateWorldMatrix(true, true);
    object.traverseVisible(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        if (materials.some(isSharedActivityOccluderMaterial)) {
            // Proxy geometry never changes; only its real rigid pose does.
            if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
            result.push({ mesh: child, inverse: child.matrixWorld.clone().invert(),
                bounds: child.geometry.boundingBox!.clone().applyMatrix4(child.matrixWorld) });
        }
    });
    return result;
}

/** Triangle centroids lie on the actual prop surfaces. A bounded cloud covers
 * each visible material, including separate blossom petals and bubble drops. */
function sampleSurface(object: THREE.Object3D) {
    const points: THREE.Vector3[] = [];
    const meshes: THREE.Mesh[] = [];
    object.updateWorldMatrix(true, true);
    if (!object.visible) return points;
    object.traverseVisible(child => {
        if (!(child instanceof THREE.Mesh)) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        if (!materials.some(material => isSharedActivityOccluderMaterial(material) && material.side !== THREE.BackSide)) return;
        if (child.geometry.getAttribute('position')) meshes.push(child);
    });
    const weights = meshes.map(mesh => Math.sqrt((mesh.geometry.index?.count ?? mesh.geometry.getAttribute('position').count) / 3));
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    meshes.forEach((child, meshIndex) => {
        const position = child.geometry.getAttribute('position'), index = child.geometry.index;
        const count = Math.floor((index?.count ?? position.count) / 3);
        const samples = Math.min(count, 3 + Math.floor((96 - meshes.length * 3) * weights[meshIndex] / total));
        for (let sample = 0; sample < samples; sample++) {
            const triangle = Math.floor(sample * count / samples) * 3, point = new THREE.Vector3();
            for (let corner = 0; corner < 3; corner++) point.add(new THREE.Vector3().fromBufferAttribute(position,
                index ? index.getX(triangle + corner) : triangle + corner));
            points.push(point.multiplyScalar(1 / 3).applyMatrix4(child.matrixWorld));
        }
    });
    return points;
}

function bodySurface(body: THREE.Object3D) {
    return body.children.filter(child => child instanceof THREE.Mesh && child.visible).flatMap(child => sampleSurface(child));
}

function routeProgress(plan: SharedActivityPlan, position: THREE.Vector3) {
    let total = 0, nearest: { error: number; distance: number } | undefined;
    for (let i = 1; i < plan.deliveryRoute.points.length; i++) {
        const a = plan.deliveryRoute.points[i - 1], b = plan.deliveryRoute.points[i], x = b.x - a.x, z = b.z - a.z;
        const length = Math.hypot(x, z);
        if (length < 1e-8) continue;
        const along = THREE.MathUtils.clamp(((position.x - a.x) * x + (position.z - a.z) * z) / (length * length), 0, 1);
        const error = Math.hypot(position.x - a.x - x * along, position.z - a.z - z * along);
        if (!nearest || error < nearest.error) nearest = { error, distance: total + length * along };
        total += length;
    }
    return nearest && total ? nearest.distance / total : 1;
}

/** Replay the existing controller on an isolated pair of real rigs. No live
 * actor, route, furniture, or saved record is modified. Geometry is shared by
 * all four hand options until the caller has finished scoring and disposes it. */
export function sampleSharedActivityPoses(plan: SharedActivityPlan, residents: readonly IslandResident[], completedSets: number,
    fixedHands?: SharedActivityHands) {
    const actualCarrier = residents[plan.carrier], actualReceiver = residents[plan.receiver];
    if (!actualCarrier || !actualReceiver) return undefined;
    const materials = new IslandMaterials(), proxies: IslandResident[] = [];
    const carrierStart = plan.gatherRoute.points[0], receiverStart = plan.receiverRoute.points[0];
    const carrier = new IslandResident(actualCarrier.species, materials, [carrierStart.x, 0, carrierStart.z], () => {});
    const receiver = new IslandResident(actualReceiver.species, materials, [receiverStart.x, 0, receiverStart.z], () => {});
    proxies[plan.carrier] = carrier; proxies[plan.receiver] = receiver;
    const visuals = new SharedActivityVisuals(materials), controller = new SharedActivityController(proxies, visuals, () => {});
    const source = makeFurniture(plan.source.kind, materials), seat = makeFurniture(plan.seat.kind, materials);
    for (const [object, item] of [[source, plan.source], [seat, plan.seat]] as const) {
        object.position.set(item.position!.x, 0, item.position!.z); object.rotation.y = item.rotation;
    }
    const items = [plan.source, plan.seat];
    const hands: SharedActivityHands[] = fixedHands ? [{ ...fixedHands }] : [
        { carrier: 'right', receiver: 'left' }, { carrier: 'left', receiver: 'right' },
        { carrier: 'right', receiver: 'right' }, { carrier: 'left', receiver: 'left' },
    ];
    const options: SharedActivityPoseOption[] = [];
    const dispose = () => {
        controller.cancel(40000); visuals.dispose();
        disposeGeometry(carrier.group); disposeGeometry(receiver.group); disposeGeometry(source); disposeGeometry(seat); materials.dispose();
    };
    try {
        for (const selected of hands) {
            controller.cancel(0);
            // Install legitimate source/seat targets, then let the controller
            // perform its exact preflighted routes and normal phase transitions.
            carrier.visit(plan.source, 0, true, items, completedSets, plan.gatherRoute);
            receiver.visit(plan.seat, 0, true, items, completedSets, plan.receiverRoute);
            controller.start(plan, 0, false, items, completedSets, selected);
            // Initial walking is outside the scored pickup→payoff interval.
            // Finish those exact preflighted routes before sampling that interval.
            proxies.forEach(resident => resident.update(20000)); controller.update(20000, false);
            for (const [proxy, actual] of [[carrier, actualCarrier], [receiver, actualReceiver]]) {
                proxy.replayUse(20000 - actual.usePhase * FURNITURE_USE_MS, false); proxy.update(20000);
            }
            controller.update(20000, false);
            let last = controller.snapshot();
            const samples: SharedActivityPoseSample[] = [], captured = new Map<SharedActivityPropPhase, number>();
            const retain = (phase: SharedActivityPropPhase, progress: number, reduced = false) => {
                const snapshot = controller.snapshot()!;
                applyFurnitureUse(seat, receiver.usePhase);
                const self = [...posedMeshes(carrier.group), ...posedMeshes(receiver.group), ...posedMeshes(source), ...posedMeshes(seat)];
                const bounds = new THREE.Box3();
                for (const mesh of self) bounds.union(mesh.bounds);
                if (visuals.group.visible) for (const object of visuals.group.children) if (object.visible) bounds.union(new THREE.Box3().setFromObject(object));
                samples.push({ phase, progress, reduced, surface: sampleSurface(visuals.group), self, bounds,
                    composition: {
                        source: phase === 'gather' ? sampleSurface(source) : [],
                        carrierHead: sampleSurface(carrier.head), receiverHead: sampleSurface(receiver.head),
                        // Direct body meshes retain real torso/tail surfaces;
                        // head and articulated arms are measured independently.
                        carrierBody: bodySurface(carrier.body), receiverBody: bodySurface(receiver.body),
                        carrierArm: sampleSurface(carrier.group.getObjectByName(`shoulder-${selected.carrier}`)!),
                        receiverArm: sampleSurface(receiver.group.getObjectByName(`shoulder-${selected.receiver}`)!),
                        carrierContact: [new THREE.Vector3(...snapshot.carrierHand)], receiverContact: [new THREE.Vector3(...snapshot.receiverHand)],
                    },
                    carrierHand: new THREE.Vector3(...snapshot.carrierHand), receiverHand: new THREE.Vector3(...snapshot.receiverHand) });
            };
            for (let now = 20000; now <= 40000; now += 32) {
                proxies.forEach(resident => resident.update(now));
                if (!last || !(last.phase in WINDOWS)) break;
                const previousPhase = last.phase as SharedActivityPropPhase;
                const duration = previousPhase === 'gather' ? SHARED_ACTIVITY_TIMING.gather : previousPhase === 'share' ? SHARED_ACTIVITY_TIMING.share
                    : previousPhase === 'enjoy' ? SHARED_ACTIVITY_TIMING.enjoy : 1;
                const nextProgress = previousPhase === 'carry' ? routeProgress(plan, carrier.group.position)
                    : previousPhase === 'settled' ? 1 : (now - last.startedAt) / duration;
                const pendingWindow = captured.get(previousPhase) ?? 0;
                const transition = previousPhase === 'carry' ? carrier.action !== 'walk' : nextProgress >= 1;
                // Base walking still advances every 32ms (including bounded
                // turning). The additive controller pose has no integration;
                // evaluate it on retained frames and real phase boundaries.
                if (!transition && (pendingWindow >= WINDOWS[previousPhase].length || nextProgress < WINDOWS[previousPhase][pendingWindow])) continue;
                controller.update(now, false);
                const snapshot = controller.snapshot();
                if (!snapshot || !(snapshot.phase in WINDOWS)) continue;
                last = snapshot;
                const phase = snapshot.phase as SharedActivityPropPhase;
                const progress = phase === 'carry' ? routeProgress(plan, carrier.group.position) : snapshot.prop.progress;
                const window = captured.get(phase) ?? 0;
                if (window < WINDOWS[phase].length && progress >= WINDOWS[phase][window]) {
                    retain(phase, progress);
                    captured.set(phase, window + 1);
                }
                if (phase === 'settled') break;
            }
            // The same fixed view must also contain/see the real reduced-motion
            // outcome, including its persistent 1.25× bubble after normal popping.
            controller.start(plan, 40000, true, items, completedSets, selected);
            retain('settled', 1, true);
            options.push({ hands: selected, samples });
        }
        return { options, dispose };
    } catch (error) { dispose(); throw error; }
}
