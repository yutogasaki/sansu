import * as THREE from 'three';
import type { IslandResident } from './animals';
import { easeResident, residentFootY, sampleResidentStride, type ResidentSpecies } from './residentRig';
import type { WorkshopSceneRequest } from './workshopScene';

interface Transform { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }
interface Execution {
    request: WorkshopSceneRequest; phase: 'walking' | 'contact' | 'operating' | 'watching'; started: number;
    points: THREE.Vector3[]; lengths: number[]; total: number; contactRoot: THREE.Vector3;
}

/** Temporarily borrows an explicitly selected live resident. All root/rig
 * transforms and visibility return to the same objects on exit; saved action,
 * item ownership, clothing and ordinary navigation are never rewritten. */
export class IslandWorkshopPresentation {
    private visibility = new Map<THREE.Object3D, boolean>();
    private transforms: Transform[] = [];
    private selectedId?: ResidentSpecies;
    private execution?: Execution;
    private handTarget?: THREE.Vector3;
    private interestTarget?: THREE.Vector3;
    actor?: IslandResident;
    get presented() { return this.visibility.size > 0; }
    get phase() { return this.execution?.phase ?? 'waiting'; }

    show(scene: THREE.Scene, workshop: THREE.Group, residents: readonly IslandResident[], residentId?: ResidentSpecies) {
        this.unpresent();
        this.actor = residentId ? residents.find(resident => resident.species === residentId && resident.group.visible) : undefined;
        if (residentId !== this.selectedId || !this.actor) this.cancel();
        this.selectedId = residentId;
        for (const object of scene.children) {
            if (object === workshop || object instanceof THREE.Light || object instanceof THREE.Camera) continue;
            this.visibility.set(object, object.visible); object.visible = false;
        }
        if (this.actor) {
            this.actor.group.traverse(object => this.transforms.push({ object, position: object.position.clone(),
                quaternion: object.quaternion.clone(), scale: object.scale.clone() }));
            this.actor.group.visible = true;
        }
    }

    private neutral() {
        const actor = this.actor!;
        actor.clearSharedPose(); this.restoreTransforms();
        actor.pose.position.set(0, 0, 0); actor.pose.rotation.set(0, 0, 0);
        actor.body.position.y = 0; actor.body.rotation.set(0, 0, 0); actor.head.rotation.set(0, 0, 0);
        actor.feet.forEach(foot => { foot.position.y = residentFootY(actor.species); foot.position.z = .12; });
    }

    private contactRoot(handle: THREE.Vector3, approach: THREE.Vector3) {
        const actor = this.actor!;
        this.neutral(); actor.group.position.copy(approach);
        actor.group.rotation.set(0, Math.atan2(handle.x - approach.x, handle.z - approach.z), 0);
        actor.group.updateMatrixWorld(true);
        const shoulder = actor.group.getObjectByName('shoulder-left')!.getWorldPosition(new THREE.Vector3());
        const reach = actor.handAnchor(new THREE.Vector3(), 'left').distanceTo(shoulder);
        const height = handle.y - shoulder.y;
        if (Math.abs(height) >= reach) return undefined;
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(actor.group.quaternion);
        const horizontal = Math.sqrt(reach * reach - height * height);
        const desired = handle.clone().addScaledVector(forward, -horizontal);
        return approach.clone().add(new THREE.Vector3(desired.x - shoulder.x, 0, desired.z - shoulder.z));
    }

    beginRun(request: WorkshopSceneRequest, now: number, handle: THREE.Vector3, approach: THREE.Vector3) {
        if (!this.actor || request.command.type !== 'run') return false;
        const contactRoot = this.contactRoot(handle, approach);
        if (!contactRoot) return false;
        // The approach lane stays outside the 4x4 board. Only the last short
        // step reaches the source; no ordinary island path is modified.
        const entry = approach.clone().add(new THREE.Vector3(0, 0, 2.1));
        const points = [entry, approach.clone(), contactRoot], lengths = [0];
        for (let index = 1; index < points.length; index++) lengths.push(lengths[index - 1] + points[index].distanceTo(points[index - 1]));
        this.execution = { request, phase: 'walking', started: now, points, lengths, total: lengths[lengths.length - 1], contactRoot };
        return true;
    }

    pose(handle: THREE.Vector3, approach: THREE.Vector3, now: number, reduced: boolean, interest?: THREE.Vector3, running = false) {
        const actor = this.actor;
        if (!actor) return false;
        const execution = this.execution;
        this.neutral(); this.handTarget = handle.clone(); this.interestTarget = interest?.clone();
        if (!execution) {
            actor.group.position.copy(approach).add(new THREE.Vector3(0, 0, 2.1)); actor.group.rotation.set(0, Math.PI, 0);
            actor.group.updateMatrixWorld(true); return false;
        }
        if (execution.phase === 'walking') {
            const duration = reduced ? 240 : execution.total / 1.45 * 1000;
            const fraction = Math.min(1, Math.max(0, (now - execution.started) / duration));
            const distance = execution.total * (reduced ? fraction < .5 ? 0 : fraction < 1 ? .55 : 1 : fraction);
            let index = 1;
            while (index < execution.points.length - 1 && distance > execution.lengths[index]) index++;
            const from = execution.points[index - 1], to = execution.points[index];
            const t = (distance - execution.lengths[index - 1]) / (execution.lengths[index] - execution.lengths[index - 1]);
            actor.group.position.lerpVectors(from, to, Math.max(0, Math.min(1, t)));
            actor.group.rotation.set(0, Math.atan2(to.x - from.x, to.z - from.z), 0);
            if (!reduced) {
                const stride = sampleResidentStride(distance, execution.total);
                actor.pose.position.y = stride.bob;
                actor.feet.forEach((foot, index) => { foot.position.y += stride.feet[index].lift; foot.position.z = stride.feet[index].z; });
            }
            if (fraction >= 1) { execution.phase = 'contact'; execution.started = now; }
            actor.group.updateMatrixWorld(true); return true;
        }
        const root = this.contactRoot(handle, approach) ?? execution.contactRoot;
        actor.group.position.copy(root);
        actor.group.rotation.set(0, Math.atan2(handle.x - approach.x, handle.z - approach.z), 0);
        actor.group.updateMatrixWorld(true);
        if (execution.phase === 'contact' || execution.phase === 'operating') {
            const amount = execution.phase === 'contact' ? reduced ? 1 : easeResident(Math.min(1, (now - execution.started) / 280)) : 1;
            actor.setSharedPose('carry', amount, handle, 'left');
            if (execution.phase === 'operating' && now - execution.started >= (reduced ? 180 : 550)) {
                execution.phase = 'watching'; execution.started = now;
            }
        } else if (interest) {
            const t = reduced ? 1 : easeResident(Math.min(1, (now - execution.started) / 550));
            const yaw = Math.atan2(interest.x - root.x, interest.z - root.z);
            const delta = Math.atan2(Math.sin(yaw - actor.group.rotation.y), Math.cos(yaw - actor.group.rotation.y));
            actor.group.rotation.y += delta * t * .55; actor.group.updateMatrixWorld(true);
            const local = actor.body.worldToLocal(interest.clone()).sub(actor.head.position);
            actor.head.rotation.set(THREE.MathUtils.clamp(Math.atan2(-local.y, Math.hypot(local.x, local.z)), -.5, .5) * t,
                THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.1, 1.1) * t, actor.species === 'rabbit' ? .12 * t : 0);
            if (actor.species === 'rabbit') actor.body.rotation.x = .08 * t;
        }
        actor.group.updateMatrixWorld(true);
        return execution.phase !== 'watching' || running || now - execution.started < 600;
    }

    afterRender(isVisiblePoint: (point: THREE.Vector3) => boolean, now: number) {
        const execution = this.execution, actor = this.actor, target = this.handTarget;
        if (!execution || execution.phase !== 'contact' || !actor || !target) return;
        const hand = actor.handAnchor(new THREE.Vector3(), 'left');
        if (hand.distanceTo(target) > .045 || !isVisiblePoint(hand) || !isVisiblePoint(target)) return;
        execution.phase = 'operating'; execution.started = now;
        return execution.request;
    }

    diagnostic() {
        const actor = this.actor;
        return actor ? { species: actor.species, uuid: actor.group.uuid, visible: actor.group.visible, phase: this.phase,
            position: actor.group.position.toArray(), handSide: 'left', hand: actor.handAnchor(new THREE.Vector3(), 'left').toArray(),
            handTarget: this.handTarget?.toArray(), handDistance: this.handTarget ? actor.handAnchor(new THREE.Vector3(), 'left').distanceTo(this.handTarget) : undefined,
            interestTarget: this.interestTarget?.toArray() } : null;
    }

    cancel() { this.execution = undefined; this.handTarget = undefined; this.interestTarget = undefined; }
    private restoreTransforms() {
        for (const { object, position, quaternion, scale } of this.transforms) {
            object.position.copy(position); object.quaternion.copy(quaternion); object.scale.copy(scale);
        }
    }
    unpresent() {
        this.actor?.clearSharedPose(); this.restoreTransforms();
        for (const [object, visible] of this.visibility) object.visible = visible;
        this.visibility.clear(); this.transforms = []; this.actor = undefined;
    }
    restore() { this.unpresent(); this.cancel(); this.selectedId = undefined; }
}
