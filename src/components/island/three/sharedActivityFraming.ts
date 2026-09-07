import * as THREE from 'three';
import { residentGroundHeight } from './navigation';
import { boxCorners } from './sceneFraming';
import { isSharedActivityOccluderMaterial, segmentHitsMesh, type SharedActivityOccluder } from './sharedActivityOcclusion';
import type { SharedActivityPlan } from './sharedActivities';
import type { IslandResident } from './animals';
import type { SharedActivityHands } from './sharedActivityController';
import { sampleSharedActivityPoses, type SharedActivityPoseSample, type SharedActivityCompositionChannel } from './sharedActivityPoseSamples';
import type { SharedActivityPropPhase } from './sharedActivityVisuals';

export interface SharedActivityFrameObjects {
    carrier: THREE.Object3D;
    receiver: THREE.Object3D;
    source: THREE.Object3D;
    seat: THREE.Object3D;
    /** Actual stationary residents/scenery, excluding ground envelopes. Mesh
     * triangles are tested without fading, moving, or framing these objects. */
    occluders?: readonly THREE.Object3D[];
    residents?: readonly IslandResident[];
    completedSets?: number;
    viewportWidth?: number;
    /** A resize keeps the physical paws selected at gather entry. */
    presentationHands?: SharedActivityHands;
}
type VisibilityPhase = SharedActivityPropPhase | 'reduced';
type IdentityChannel = 'carrierHead' | 'receiverHead' | 'carrierBody' | 'receiverBody';
interface PoseIdentityVisibility { phase: VisibilityPhase; progress: number; visibility: Partial<Record<IdentityChannel, number>> }
const IDENTITY_CHANNELS: readonly SharedActivityCompositionChannel[] = ['carrierHead', 'receiverHead', 'carrierBody', 'receiverBody'];
type CompositionVisibility = Partial<Record<VisibilityPhase, Partial<Record<SharedActivityCompositionChannel, number>>>>;
export interface SharedActivityFrame {
    position: THREE.Vector3;
    quaternion: THREE.Quaternion;
    left: number;
    right: number;
    top: number;
    bottom: number;
    presentationHands?: SharedActivityHands;
    visibilityDiagnostics?: { sampleCount: number; cameraCandidates: number; handCandidates: number;
        phaseVisibility: Partial<Record<SharedActivityPropPhase | 'reduced', number>>; minimumPhaseVisibility: number;
        fullyHiddenPhases: number; testedRays: number; bodySeparationPx: number; minimumPawSpanPx: number;
        compositionVisibility: CompositionVisibility; minimumCompositionVisibility: number; fullyHiddenCompositionChannels: number;
        poseIdentityVisibility: PoseIdentityVisibility[]; minimumPoseIdentityVisibility: number;
        compositionRays: number; cameraHeight: number; readabilitySatisfied: boolean };
}

/** Keep a readable current delivery without scoring alternatives. An exhausted
 * set is explicit: return the original plan/frame with satisfied=false, never
 * convert its best-effort composition into a successful presentation. */
export function chooseSharedActivityPresentation(plans: readonly [SharedActivityPlan, ...SharedActivityPlan[]],
    fit: (plan: SharedActivityPlan) => SharedActivityFrame) {
    const current = plans[0], currentFrame = fit(current);
    if (currentFrame.visibilityDiagnostics?.readabilitySatisfied === true) {
        return { plan: current, frame: currentFrame, attemptedPlans: 1, satisfied: true };
    }
    for (let index = 1; index < plans.length; index++) {
        const frame = fit(plans[index]);
        if (frame.visibilityDiagnostics?.readabilitySatisfied === true) {
            return { plan: plans[index], frame, attemptedPlans: index + 1, satisfied: true };
        }
    }
    return { plan: current, frame: currentFrame, attemptedPlans: plans.length, satisfied: false };
}

const ORIGINAL_HORIZONTAL_VIEW = new THREE.Vector3(4.7, 0, 13.5);
const OCCUPIED_FRAME = .76; // Twelve percent breathing room at each edge.
const HAND_AND_PROP_ROOM = .30;
const MINIMUM_READABILITY = .5; // Each phase/channel must remain independently legible.
const UP = new THREE.Vector3(0, 1, 0);
function occludingMeshes(objects: SharedActivityFrameObjects) {
    const paired = new Set([objects.carrier, objects.receiver, objects.source, objects.seat]);
    const meshes = new Set<THREE.Mesh>();
    for (const root of objects.occluders ?? []) {
        let visible = true;
        for (let parent: THREE.Object3D | null = root; parent; parent = parent.parent) if (!parent.visible) visible = false;
        if (!visible) continue;
        root.updateWorldMatrix(true, true);
        root.traverseVisible(child => {
            if (!(child instanceof THREE.Mesh)) return;
            for (let parent: THREE.Object3D | null = child; parent; parent = parent.parent) if (paired.has(parent)) return;
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            if (materials.some(isSharedActivityOccluderMaterial)) meshes.add(child);
        });
    }
    return [...meshes].map(mesh => ({ mesh, inverse: mesh.matrixWorld.clone().invert(), bounds: new THREE.Box3().setFromObject(mesh, true) }));
}

/** Select representatives from real triangle centroids across the visible
 * prop silhouette. Every ray ends at an actual surface from an actual pose. */
function surfacePoints(points: THREE.Vector3[], right: THREE.Vector3, up: THREE.Vector3, backward: THREE.Vector3) {
    if (!points.length) return [];
    const projected = new Float64Array(points.length * 3);
    let lowX = Infinity, highX = -Infinity, lowY = Infinity, highY = -Infinity;
    points.forEach((point, index) => {
        const x = point.dot(right), y = point.dot(up);
        projected[index * 3] = x; projected[index * 3 + 1] = y; projected[index * 3 + 2] = point.dot(backward);
        lowX = Math.min(lowX, x); highX = Math.max(highX, x); lowY = Math.min(lowY, y); highY = Math.max(highY, y);
    });
    const width = Math.max(.001, highX - lowX), height = Math.max(.001, highY - lowY);
    return [-.55, 0, .55].flatMap(y => [-.55, 0, .55].map(x => {
        const targetX = (lowX + highX) / 2 + x * width / 2, targetY = (lowY + highY) / 2 + y * height / 2;
        let selected = 0, best = Infinity;
        for (let index = 0; index < points.length; index++) {
            const distance = ((projected[index * 3] - targetX) / width) ** 2 + ((projected[index * 3 + 1] - targetY) / height) ** 2;
            if (distance < best - .0001 || (Math.abs(distance - best) <= .0001 && projected[index * 3 + 2] > projected[selected * 3 + 2])) {
                selected = index; best = distance;
            }
        }
        return points[selected];
    }));
}

function poseVisibility(camera: THREE.OrthographicCamera, samples: SharedActivityPoseSample[],
    stationary: (SharedActivityOccluder & { bounds: THREE.Box3 })[]) {
    const backward = new THREE.Vector3(0, 0, 1).applyQuaternion(camera.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion), up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
    const phases = new Map<VisibilityPhase, { rays: number; visible: number }>();
    const composition = new Map<VisibilityPhase, Map<SharedActivityCompositionChannel, { rays: number; visible: number }>>();
    const cameraDepth = camera.position.dot(backward), origin = new THREE.Vector3(), end = new THREE.Vector3();
    const ray = new THREE.Ray(origin, backward.clone().negate()), intersection = new THREE.Vector3();
    const seen = (target: THREE.Vector3, self: SharedActivityPoseSample['self'] = []) => {
        const depth = target.dot(backward), endDepth = depth + .015;
        origin.copy(target).addScaledVector(backward, cameraDepth - depth); end.copy(target).addScaledVector(backward, .015);
        const farSquared = origin.distanceToSquared(end);
        const blocks = (mesh: SharedActivityOccluder & { bounds: THREE.Box3 }) => {
            if (!mesh.bounds.containsPoint(origin) && (ray.intersectBox(mesh.bounds, intersection) === null
                || intersection.distanceToSquared(origin) > farSquared)) return false;
            return segmentHitsMesh(origin, end, mesh);
        };
        return cameraDepth > endDepth && !self.some(blocks) && !stationary.some(blocks);
    };
    const poseIdentityVisibility: PoseIdentityVisibility[] = [];
    let testedRays = 0, visible = 0, compositionRays = 0;
    for (const sample of samples) {
        const phase: VisibilityPhase = sample.reduced ? 'reduced' : sample.phase;
        const points = surfacePoints(sample.surface, right, up, backward);
        if (points.length) { // A popped bubble has no remaining prop to hide.
            const result = phases.get(phase) ?? { rays: 0, visible: 0 };
            for (const point of points) {
                result.rays++; testedRays++;
                if (seen(point, sample.self)) { result.visible++; visible++; }
            }
            phases.set(phase, result);
        }
        const channels = composition.get(phase) ?? new Map();
        const identity: PoseIdentityVisibility = { phase, progress: sample.progress, visibility: {} };
        for (const channel of Object.keys(sample.composition) as SharedActivityCompositionChannel[]) {
            const cloud = sample.composition[channel]!;
            const anchors = channel.endsWith('Contact') ? cloud : surfacePoints(cloud, right, up, backward);
            if (!anchors.length) continue;
            const result = channels.get(channel) ?? { rays: 0, visible: 0 };
            let poseVisible = 0;
            for (const point of anchors) {
                result.rays++; compositionRays++;
                // Identity and contact composition is judged against outsiders.
                // A legitimate seated body/paw may overlap its own partner/seat.
                if (seen(point)) { result.visible++; poseVisible++; }
            }
            channels.set(channel, result);
            if (IDENTITY_CHANNELS.includes(channel)) identity.visibility[channel as IdentityChannel] = poseVisible / anchors.length;
        }
        if (channels.size) composition.set(phase, channels);
        if (Object.keys(identity.visibility).length) poseIdentityVisibility.push(identity);
    }
    const phaseVisibility = Object.fromEntries([...phases].map(([phase, value]) => [phase, value.visible / value.rays]));
    const visibility = Object.values(phaseVisibility);
    const compositionVisibility: CompositionVisibility = Object.fromEntries([...composition].map(([phase, channels]) =>
        [phase, Object.fromEntries([...channels].map(([channel, value]) => [channel, value.visible / value.rays]))]));
    const compositionValues = [...composition.values()].flatMap(channels => [...channels.values()].map(value => value.visible / value.rays));
    // A visible later pose cannot compensate for a hidden head/body now.
    // Retain the phase means above as diagnostics; reuse these same exact rays.
    const identityValues = poseIdentityVisibility.flatMap(pose => Object.values(pose.visibility));
    return { poseIdentityVisibility, minimumPoseIdentityVisibility: identityValues.length ? Math.min(...identityValues) : 1,
        phaseVisibility, minimumPhaseVisibility: visibility.length ? Math.min(...visibility) : 1,
        fullyHiddenPhases: visibility.filter(value => value === 0).length, testedRays, total: testedRays ? visible / testedRays : 1,
        compositionVisibility, minimumCompositionVisibility: compositionValues.length ? Math.min(...compositionValues) : 1,
        fullyHiddenCompositionChannels: compositionValues.filter(value => value === 0).length, compositionRays };

}

/** Capture once at gather entry. Runtime holds this view for the whole delivery;
 * no subsequent hand, foot, or prop sample moves the camera. */
export function fitSharedActivityFrame(plan: SharedActivityPlan, objects: SharedActivityFrameObjects,
    aspect: number): SharedActivityFrame {
    const sampled = objects.residents && sampleSharedActivityPoses(plan, objects.residents, objects.completedSets ?? 6, objects.presentationHands);
    try {
        const boxes = [objects.carrier, objects.receiver, objects.source, objects.seat]
            .map(object => { object.updateWorldMatrix(true, true); return new THREE.Box3().setFromObject(object, true); });
        const carrierRoot = objects.carrier.getWorldPosition(new THREE.Vector3());
        const carrierBounds = boxes[0];
        if (!carrierBounds.isEmpty()) {
            // Sweep the complete body envelope around every route waypoint;
            // the actual sampled poses additionally protect outer paws/props.
            const radius = Math.hypot(
                Math.max(Math.abs(carrierBounds.min.x - carrierRoot.x), Math.abs(carrierBounds.max.x - carrierRoot.x)),
                Math.max(Math.abs(carrierBounds.min.z - carrierRoot.z), Math.abs(carrierBounds.max.z - carrierRoot.z)),
            ) + HAND_AND_PROP_ROOM;
            const low = carrierBounds.min.y - carrierRoot.y - HAND_AND_PROP_ROOM;
            const high = carrierBounds.max.y - carrierRoot.y + HAND_AND_PROP_ROOM;
            for (const point of [...plan.deliveryRoute.points, plan.handoffPoint]) {
                const ground = residentGroundHeight(point, (objects.completedSets ?? 6) >= 2);
                boxes.push(new THREE.Box3(new THREE.Vector3(point.x - radius, ground + low, point.z - radius),
                    new THREE.Vector3(point.x + radius, ground + high, point.z + radius)));
            }
        }
        boxes[1].expandByScalar(HAND_AND_PROP_ROOM);
        for (const option of sampled?.options ?? []) for (const sample of option.samples) boxes.push(sample.bounds);
        const bounds = boxes.filter(box => !box.isEmpty()), whole = new THREE.Box3();
        for (const box of bounds) whole.union(box);
        if (whole.isEmpty()) {
            const center = objects.seat.getWorldPosition(new THREE.Vector3());
            whole.set(center.clone().addScalar(-1), center.clone().addScalar(1)); bounds.push(whole);
        }
        const target = whole.getCenter(new THREE.Vector3()), seat = objects.seat.getWorldPosition(new THREE.Vector3());
        const lineX = plan.handoffPoint.x - seat.x, lineZ = plan.handoffPoint.z - seat.z;
        const side = new THREE.Vector3(lineZ, 0, -lineX);
        if (side.lengthSq() < .000001) side.copy(ORIGINAL_HORIZONTAL_VIEW);
        if (side.dot(ORIGINAL_HORIZONTAL_VIEW) < 0) side.negate();
        side.normalize();
        const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
        const viewportWidth = objects.viewportWidth && objects.viewportWidth > 0 ? objects.viewportWidth : 390;
        const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
        const stationary = occludingMeshes(objects);
        // Geometry-only callers can fit arbitrary objects without inventing a
        // resident species or simulating a made-up activity. Production always
        // supplies its residents and receives the actual-pose evidence below.
        const fallback: SharedActivityPoseSample = { phase: 'gather', progress: 0, reduced: false,
            surface: [objects.source, objects.carrier, objects.receiver].map(object => new THREE.Box3().setFromObject(object, true).getCenter(new THREE.Vector3())),
            self: [], composition: {}, bounds: whole, carrierHand: carrierRoot, receiverHand: seat };
        const options = sampled?.options ?? [{ hands: undefined, samples: [fallback] }];
        let chosen: SharedActivityFrame | undefined, best: number[] | undefined, cameraCandidates = 0;
        for (const cameraHeight of sampled ? [8, 10.5, 13] : [8]) {
            for (const angle of [0, Math.PI / 8, -Math.PI / 8]) for (const sign of [1, -1]) {
                const direction = side.clone().multiplyScalar(sign).applyAxisAngle(UP, angle);
                cameraCandidates++;
                camera.position.copy(target).addScaledVector(direction, 13); camera.position.y += cameraHeight;
                camera.lookAt(target); camera.updateMatrixWorld(true);
                const projected = new THREE.Box3().setFromPoints(bounds.flatMap(boxCorners).map(point => point.applyMatrix4(camera.matrixWorldInverse)));
                const size = projected.getSize(new THREE.Vector3()), center = projected.getCenter(new THREE.Vector3());
                const height = Math.max(.1, size.y / OCCUPIED_FRAME, size.x / (ratio * OCCUPIED_FRAME)), width = height * ratio;
                camera.left = center.x - width / 2; camera.right = center.x + width / 2;
                camera.top = center.y + height / 2; camera.bottom = center.y - height / 2; camera.updateProjectionMatrix();
                const recipient = seat.clone().project(camera), carrier = new THREE.Vector3(plan.handoffPoint.x, seat.y, plan.handoffPoint.z).project(camera);
                const bodySeparationPx = Math.abs(recipient.x - carrier.x) * viewportWidth / 2;
                for (const option of options) {
                    const visibility = poseVisibility(camera, option.samples, stationary);
                    const preference = Math.abs(angle) + (1 - direction.dot(ORIGINAL_HORIZONTAL_VIEW.clone().normalize())) * .1;
                    // No visible payoff can compensate for an entirely hidden
                    // pickup/carry phase. Compare the weakest phase before totals.
                    const minimum = Math.min(visibility.minimumPhaseVisibility, visibility.minimumCompositionVisibility, visibility.minimumPoseIdentityVisibility);
                    const score = [bodySeparationPx < 60 ? 1 : 0, visibility.fullyHiddenPhases + visibility.fullyHiddenCompositionChannels,
                        -minimum, -visibility.minimumPhaseVisibility, -visibility.total, cameraHeight, preference];
                    const better = !best || score.some((value, index) => value < best![index] - 1e-8
                        && score.slice(0, index).every((earlier, i) => Math.abs(earlier - best![i]) <= 1e-8));
                    if (!better) continue;
                    best = score;
                    chosen = { position: camera.position.clone(), quaternion: camera.quaternion.clone(),
                        left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom };
                    if (sampled && option.hands) {
                        const spans = option.samples.filter(sample => sample.phase === 'share').map(sample => {
                            const a = sample.carrierHand.clone().project(camera), b = sample.receiverHand.clone().project(camera);
                            return Math.hypot((a.x - b.x) * viewportWidth / 2, (a.y - b.y) * viewportWidth / (2 * ratio));
                        });
                        chosen.presentationHands = { ...option.hands };
                        chosen.visibilityDiagnostics = { sampleCount: option.samples.length, cameraCandidates, handCandidates: options.length,
                            phaseVisibility: visibility.phaseVisibility, minimumPhaseVisibility: visibility.minimumPhaseVisibility,
                            fullyHiddenPhases: visibility.fullyHiddenPhases, testedRays: visibility.testedRays,
                            bodySeparationPx, minimumPawSpanPx: spans.length ? Math.min(...spans) : 0,
                            compositionVisibility: visibility.compositionVisibility, minimumCompositionVisibility: visibility.minimumCompositionVisibility,
                            poseIdentityVisibility: visibility.poseIdentityVisibility, minimumPoseIdentityVisibility: visibility.minimumPoseIdentityVisibility,
                            fullyHiddenCompositionChannels: visibility.fullyHiddenCompositionChannels, compositionRays: visibility.compositionRays, cameraHeight,
                            readabilitySatisfied: bodySeparationPx >= 60 && minimum >= MINIMUM_READABILITY };
                    }
                }
            }
            // The familiar view is retained when it already makes every subject
            // readable. Only a failed base set unlocks the two bounded higher views.
            if (!sampled || chosen?.visibilityDiagnostics?.readabilitySatisfied) break;
        }
        if (chosen?.visibilityDiagnostics) chosen.visibilityDiagnostics.cameraCandidates = cameraCandidates;
        return chosen!;
    } finally { sampled?.dispose(); }
}
