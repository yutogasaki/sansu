import * as THREE from 'three';
import type { IslandResident } from './animals';
import { residentFootY, sampleResidentStride } from './residentRig';
import { residentGroundHeight, type ResidentRoute } from './navigation';
import type { IslandLandAccess } from '../../../domain/island/catalog';

interface Transform { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }
export interface SharedContactPose { root: THREE.Vector3; yaw: number; lean: number }

/** Borrows the actual rig without rewriting its ordinary action or navigation. */
export class SharedJobActor {
    private readonly transforms: Transform[] = [];
    private readonly shoulders: THREE.Object3D[];
    constructor(readonly resident: IslandResident) {
        this.shoulders = ['shoulder-left', 'shoulder-right'].map(name => resident.group.getObjectByName(name)!);
        resident.clearSharedPose();
        resident.group.traverse(object => this.transforms.push({ object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() }));
    }
    restore() {
        this.resident.clearSharedPose();
        for (const saved of this.transforms) { saved.object.position.copy(saved.position); saved.object.quaternion.copy(saved.quaternion); saved.object.scale.copy(saved.scale); }
        this.resident.group.updateWorldMatrix(true, true);
    }
    pose(root: THREE.Vector3, yaw: number, lean = 0, targets: THREE.Vector3[] = []) {
        this.restore();
        const actor = this.resident;
        actor.group.position.copy(root); actor.group.rotation.set(0, yaw, 0);
        actor.pose.position.set(0, 0, 0); actor.pose.rotation.set(0, 0, 0);
        actor.body.position.y = 0; actor.body.rotation.set(lean, 0, 0); actor.head.rotation.set(0, 0, 0);
        actor.tail.rotation.set(0, 0, 0);
        actor.feet.forEach(foot => { foot.position.y = residentFootY(actor.species); foot.position.z = .12; });
        actor.group.updateWorldMatrix(true, true);
        this.aimHands(targets);
    }
    aimHands(targets: THREE.Vector3[]) {
        const actor = this.resident, yaw = actor.group.rotation.y;
        const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const ordered = targets.length === 2 ? [...targets].sort((a, b) => a.dot(right) - b.dot(right)) : targets;
        ordered.forEach((target, index) => {
            const shoulder = this.shoulders[index];
            const contact = shoulder.worldToLocal(actor.handAnchor(new THREE.Vector3(), index === 0 ? 'left' : 'right')).normalize();
            const localTarget = shoulder.parent!.worldToLocal(target.clone()).sub(shoulder.position).normalize();
            shoulder.quaternion.setFromUnitVectors(contact, localTarget);
        });
        if (ordered.length) this.look(ordered[ordered.length - 1]);
        actor.group.updateWorldMatrix(true, true);
    }
    look(target: THREE.Vector3, offer = false) {
        const actor = this.resident;
        const local = actor.body.worldToLocal(target.clone()).sub(actor.head.position);
        actor.head.rotation.set(THREE.MathUtils.clamp(Math.atan2(-local.y, Math.hypot(local.x, local.z)), -.5, .65),
            THREE.MathUtils.clamp(Math.atan2(local.x, local.z), -1.05, 1.05), offer ? -.09 : 0);
        actor.group.updateWorldMatrix(true, true);
    }
    /** Actual arm lengths solve the grounded root; callers still validate the
     * complete route and occupied footprint before accepting any candidate. */
    contactCandidates(targets: THREE.Vector3[], yaw: number): SharedContactPose[] {
        const actor = this.resident, right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
        const forward = new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
        const ordered = targets.length === 2 ? [...targets].sort((a, b) => a.dot(right) - b.dot(right)) : targets;
        const candidates: SharedContactPose[] = [];
        for (const lean of [0, .15, .3, .45, .6, .72]) {
            this.pose(new THREE.Vector3(), yaw, lean);
            const shoulders = ordered.map((_, index) => this.shoulders[index].getWorldPosition(new THREE.Vector3()));
            const lengths = shoulders.map((point, index) => actor.handAnchor(new THREE.Vector3(), index === 0 ? 'left' : 'right').distanceTo(point));
            const lateral = ordered.reduce((sum, point, index) => sum + point.clone().sub(shoulders[index]).dot(right), 0) / ordered.length;
            const distances = ordered.map((point, index) => {
                const side = point.clone().sub(shoulders[index]).dot(right) - lateral, height = point.y - shoulders[index].y;
                return lengths[index] ** 2 - side ** 2 - height ** 2;
            });
            if (distances.some(value => value <= 0)) continue;
            const ahead = ordered.reduce((sum, point, index) => sum + point.clone().sub(shoulders[index]).dot(forward) - Math.sqrt(distances[index]), 0) / ordered.length;
            const root = right.clone().multiplyScalar(lateral).addScaledVector(forward, ahead);
            this.pose(root, yaw, lean, ordered);
            if (ordered.every((point, index) => actor.handAnchor(new THREE.Vector3(), index === 0 ? 'left' : 'right').distanceTo(point) <= .035)) candidates.push({ root, yaw, lean });
        }
        this.restore(); return candidates;
    }
    walk(route: ResidentRoute, fraction: number, land: IslandLandAccess, reduced: boolean, lean = 0, facingYaw?: number) {
        const lengths = [0];
        for (let i = 1; i < route.points.length; i++) lengths.push(lengths[i - 1] + Math.hypot(route.points[i].x - route.points[i - 1].x, route.points[i].z - route.points[i - 1].z));
        const total = lengths[lengths.length - 1], t = THREE.MathUtils.clamp(fraction, 0, 1);
        const distance = total * (reduced ? t < .35 ? 0 : t < .75 ? .5 : 1 : t);
        let i = 1; while (i < route.points.length - 1 && lengths[i] < distance) i++;
        const from = route.points[i - 1], to = route.points[i];
        const part = lengths[i] === lengths[i - 1] ? 1 : (distance - lengths[i - 1]) / (lengths[i] - lengths[i - 1]);
        const point = new THREE.Vector3(THREE.MathUtils.lerp(from.x, to.x, part), 0, THREE.MathUtils.lerp(from.z, to.z, part));
        point.y = residentGroundHeight(point, land);
        const heading = Math.atan2(to.x - from.x, to.z - from.z), yaw = facingYaw ?? (t >= .99 ? route.yaw : heading);
        this.pose(point, yaw, lean);
        if (!reduced) {
            const stride = sampleResidentStride(distance, total);
            this.resident.feet.forEach((foot, index) => {
                const travel = stride.feet[index].z - .12;
                foot.position.y += stride.feet[index].lift; foot.position.x += Math.sin(heading - yaw) * travel;
                foot.position.z = .12 + Math.cos(heading - yaw) * travel;
            });
        }
        return distance;
    }
}
