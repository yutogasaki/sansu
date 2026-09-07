import * as THREE from 'three';
import { IslandMaterials } from './primitives';
import type { IslandStageItem } from './types';
import { getFurnitureAnchors } from './furniture';
import { sampleFurnitureSwing, type FurniturePoint } from './furnitureVisuals';
import { planResidentRoute, RESIDENT_FOOTPRINT, residentGroundHeight, type ResidentRoute } from './navigation';
import { ISLAND_ITEMS } from '../../../domain/island/catalog';
import type { LearningReactionKind } from './learningReaction';
import type { ResidentInterestSample } from './residentInterest';
import { clampUnit, easeResident, FURNITURE_USE_MS, makeResidentRig, RESIDENT_SCALE, residentFootY,
    residentSeatContactY, residentSeatRootY, sampleResidentStride, SEATED_BODY_Y, turnResidentToward, type ResidentSpecies } from './residentRig';

export type ResidentAction = 'idle' | 'walk' | 'sit' | 'sniff' | 'admire' | 'swing' | 'rest' | 'watch';
export type SharedResidentPose = 'carry' | 'offer' | 'receive' | 'enjoy';
export type SharedResidentHand = 'left' | 'right';
const ACTIONS: Record<IslandStageItem['kind'], ResidentAction> = {
    bench: 'sit', flower: 'sniff', lantern: 'admire', swing: 'swing', mushroom: 'rest', fountain: 'watch',
};
export const RESIDENT_NAMES = { otter: 'カワウソ', rabbit: 'ウサギ', fox: 'キツネ' } as const;
const USE_CAPTIONS: Record<IslandStageItem['kind'], string> = {
    bench: 'ベンチに すわった', flower: 'おはなの においを くんくん', lantern: 'あかりを みあげた',
    swing: 'ブランコに すわった', mushroom: 'きのこの いすで ひとやすみ', fountain: 'ふんすいを のぞいた',
};
const angleDelta = (from: number, to: number) => Math.atan2(Math.sin(to - from), Math.cos(to - from));

/** Navigation owns the root. The local rig supplies steps, shared seat contact,
 * and short replies without changing the path, input clock or saved placement. */
export class IslandResident {
    readonly group = new THREE.Group();
    readonly pose: THREE.Group;
    readonly body: THREE.Group;
    readonly head: THREE.Group;
    readonly feet: THREE.Mesh[];
    readonly seatContact: THREE.Object3D;
    private readonly shoulders: THREE.Group[];
    private readonly handContacts: THREE.Object3D[];
    private sharedPose?: { body: THREE.Quaternion; head: THREE.Quaternion; shoulders: THREE.Quaternion[] };
    private readonly learningHeadDelta = new THREE.Vector3();
    private learningArmDelta?: { index: number; x: number; z: number };
    private readonly destination = new THREE.Vector3();
    private readonly standingBounds: THREE.Box3;
    private startTime = 0;
    private duration = 0;
    private useStartedAt = 0;
    private lastUpdate = 0;
    private arrivalReported = true;
    private destinationYaw = .28;
    private target?: IslandStageItem;
    private departingFurniture?: IslandStageItem;
    private pointWalk = false;
    private path: THREE.Vector3[] = [];
    private distances: number[] = [];
    private expanded = false;
    private reduced = false;
    private standing?: { startedAt: number; y: number; yaw: number; position: THREE.Vector3; tilt: number;
        bodyY: number; feet: THREE.Vector3[] };
    action: ResidentAction = 'idle';
    itemId = '';
    /** A stopped resident may leave an overlapping seat without pretending to
     * occupy/use it. This never becomes saved game state or a replay request. */
    departingId?: string;
    /** Runtime applies this same phase to the visited furniture's moving group. */
    usePhase = 1;

    constructor(readonly species: ResidentSpecies, m: IslandMaterials,
        position: [number, number, number], private onArrival: (caption: string) => void) {
        const rig = makeResidentRig(species, m);
        this.standingBounds = new THREE.Box3().setFromObject(rig.pose, true);
        this.pose = rig.pose; this.body = rig.body; this.head = rig.head; this.feet = rig.feet;
        this.shoulders = rig.shoulders; this.handContacts = rig.handContacts; this.seatContact = rig.seatContact;
        this.group.position.set(...position);
        this.group.scale.setScalar(RESIDENT_SCALE);
        this.group.rotation.y = .28;
        this.group.add(this.pose);
    }

    /** Snapshot the current pose and any already-started motion. The scene can fit
     * this envelope at section entry without moving residents or following them. */
    learningFrameBounds() {
        const bounds = new THREE.Box3().setFromObject(this.group, true).expandByScalar(.16);
        if (this.action !== 'walk' && !this.standing) return bounds;
        const shape = this.standingBounds, scale = RESIDENT_SCALE;
        const radius = Math.hypot(Math.max(Math.abs(shape.min.x), Math.abs(shape.max.x)),
            Math.max(Math.abs(shape.min.z), Math.abs(shape.max.z))) * scale + .16;
        const roots = this.action === 'walk' ? [...this.path, this.destination] : [this.group.position];
        for (const point of roots) {
            const ground = residentGroundHeight(point, this.expanded);
            const low = Math.min(ground, point.y), high = Math.max(ground, point.y, this.action === 'walk' ? this.destination.y : 0);
            bounds.expandByPoint(new THREE.Vector3(point.x - radius, low - .08, point.z - radius));
            bounds.expandByPoint(new THREE.Vector3(point.x + radius, high + shape.max.y * scale + .16, point.z + radius));
        }
        return bounds;
    }

    visit(item: IslandStageItem, now: number, reduced: boolean, items: IslandStageItem[], completedSets: number, plannedRoute?: ResidentRoute) {
        if (!item.position) return false;
        const route = plannedRoute ?? planResidentRoute(this.group.position, item, items, completedSets, this.itemId || this.departingId);
        if (!route) return false;
        this.clearSharedPose(); this.clearLearningPose();
        this.expanded = completedSets >= 2;
        this.reduced = reduced;
        this.standing = undefined;
        this.rememberDeparture();
        this.target = item;
        this.departingId = undefined;
        this.pointWalk = false;
        this.itemId = item.id;
        const end = route.points[route.points.length - 1], seat = getFurnitureAnchors(item.kind).seat;
        this.destination.set(end.x, seat ? residentSeatRootY(this.species, seat.y) : residentGroundHeight(end, this.expanded), end.z);
        this.beginRoute(route, now, reduced);
        return true;
    }

    /** Walk a preflighted shared-activity path using the ordinary feet and deck
     * height. It has no furniture ownership or furniture arrival caption. */
    walkToPoint(route: ResidentRoute, now: number, reduced: boolean, completedSets: number) {
        if (route.points.length < 2 || !Number.isFinite(route.yaw)
            || route.points.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.z))) return false;
        this.clearSharedPose(); this.clearLearningPose();
        this.expanded = completedSets >= 2; this.reduced = reduced; this.standing = undefined;
        this.rememberDeparture();
        this.target = undefined; this.pointWalk = true; this.itemId = '';
        this.departingId = undefined;
        const end = route.points[route.points.length - 1];
        this.destination.set(end.x, residentGroundHeight(end, this.expanded), end.z);
        this.beginRoute(route, now, reduced);
        return true;
    }

    private beginRoute(route: ResidentRoute, now: number, reduced: boolean) {
        this.destinationYaw = route.yaw;
        this.path = route.points.map(point => new THREE.Vector3(point.x, 0, point.z));
        this.distances = [0];
        for (let i = 1; i < this.path.length; i++) this.distances.push(this.distances[i - 1] + this.path[i].distanceTo(this.path[i - 1]));
        this.startTime = now; this.lastUpdate = now;
        const distance = this.distances[this.distances.length - 1];
        this.duration = reduced || (this.pointWalk && distance < .001) ? 0 : Math.max(1050, Math.min(6500, distance * 620));
        this.useStartedAt = now + this.duration;
        this.arrivalReported = false;
        this.action = 'walk'; this.usePhase = 0;
        this.update(reduced ? now + 1 : now);
    }

    /** Cancel only a live walk at its currently rendered x/z. A partial step or
     * seat approach settles to the same ground point via the existing release. */
    stopWalking(now = performance.now()) { if (this.action === 'walk') this.release(now); }

    /** The child can invite another look, sniff, or swing without making a
     * seated resident walk in place or changing any furniture/learning state. */
    replayUse(now: number, reduced: boolean) {
        if (!this.target) return false;
        if (this.action === 'walk') return true;
        this.clearLearningPose();
        this.reduced = reduced;
        this.startTime = now - this.duration;
        this.useStartedAt = now;
        this.lastUpdate = now;
        this.arrivalReported = false;
        this.update(now);
        return true;
    }

    /** A lifted/removed seat leaves its resident standing on the same safe root. */
    release(now = performance.now()) {
        this.clearSharedPose();
        this.clearLearningPose();
        this.rememberDeparture();
        this.departingId = this.departingFurniture?.id;
        this.standing = this.reduced ? undefined : { startedAt: now, y: this.group.position.y, yaw: this.group.rotation.y,
            position: this.pose.position.clone(), tilt: this.pose.rotation.x, bodyY: this.body.position.y,
            feet: this.feet.map(foot => foot.position.clone()) };
        this.target = undefined; this.pointWalk = false; this.itemId = ''; this.action = 'idle'; this.usePhase = 1;
        this.arrivalReported = true;
        if (this.reduced) {
            this.resetPose();
            this.group.position.y = residentGroundHeight(this.group.position, this.expanded);
            this.group.rotation.y = .28;
        }
    }

    private overlapsFurniture(item?: IslandStageItem) {
        return Boolean(item?.position && Math.hypot(this.group.position.x - item.position.x, this.group.position.z - item.position.z)
            <= ISLAND_ITEMS[item.kind].radius + RESIDENT_FOOTPRINT + 1e-8);
    }

    private rememberDeparture() {
        const departure = this.overlapsFurniture(this.target) ? this.target
            : this.overlapsFurniture(this.departingFurniture) ? this.departingFurniture : undefined;
        // Keep the footprint privately through the first steps of an escape so
        // another immediate interruption can still leave the same furniture.
        this.departingFurniture = departure ? { ...departure, position: { ...departure.position! } } : undefined;
    }

    private clearSafeDeparture() {
        if (this.departingFurniture && !this.overlapsFurniture(this.departingFurniture)) {
            this.departingFurniture = undefined; this.departingId = undefined;
        }
    }

    clearLearningPose() {
        this.head.rotation.x -= this.learningHeadDelta.x;
        this.head.rotation.y -= this.learningHeadDelta.y;
        this.head.rotation.z -= this.learningHeadDelta.z;
        this.learningHeadDelta.set(0, 0, 0);
        if (this.learningArmDelta) {
            const { index, x, z } = this.learningArmDelta;
            this.shoulders[index].rotation.x -= x;
            this.shoulders[index].rotation.z -= z;
            this.learningArmDelta = undefined;
        }
    }

    respondToLearning(kind: LearningReactionKind, paw: number, look: number, target: THREE.Vector3) {
        this.clearSharedPose(); this.clearLearningPose();
        const worldYaw = Math.atan2(target.x - this.group.position.x, target.z - this.group.position.z);
        const relative = angleDelta(this.group.rotation.y, worldYaw);
        this.learningHeadDelta.set(kind === 'correct' ? -.09 * look : -.025 * look,
            Math.max(-.48, Math.min(.48, relative)) * look, (kind === 'correct' ? -.055 : .12) * look);
        this.head.rotation.x += this.learningHeadDelta.x;
        this.head.rotation.y += this.learningHeadDelta.y;
        this.head.rotation.z += this.learningHeadDelta.z;
        const index = relative < 0 ? 0 : 1, side = index ? 1 : -1;
        this.learningArmDelta = { index, x: -.22 * paw, z: side * paw * 1.05 };
        this.shoulders[index].rotation.x += this.learningArmDelta.x;
        this.shoulders[index].rotation.z += this.learningArmDelta.z;
    }

    /** One reversible head/shoulder layer, shared by ordinary object interest
     * and the saved-light reply. The base sniff/look, feet and seat stay intact. */
    respondToInterest(sample: ResidentInterestSample, target: THREE.Vector3) {
        this.clearSharedPose(); this.clearLearningPose();
        // Aim from the actual seated/leaning body, including the target height.
        // Subtract the base gaze so an ordinary sniff is not turned twice.
        const local = this.body.worldToLocal(target.clone()).sub(this.head.position);
        const yaw = Math.atan2(local.x, local.z), pitch = Math.atan2(-local.y, Math.hypot(local.x, local.z));
        const index = local.x < 0 ? 0 : 1, side = index ? 1 : -1;
        this.learningHeadDelta.set(sample.headPitch + (THREE.MathUtils.clamp(pitch, -.35, .45) - this.head.rotation.x) * sample.look,
            (THREE.MathUtils.clamp(yaw, -.48, .48) - this.head.rotation.y) * sample.look,
            -side * sample.headRoll);
        this.head.rotation.x += this.learningHeadDelta.x;
        this.head.rotation.y += this.learningHeadDelta.y;
        this.head.rotation.z += this.learningHeadDelta.z;
        this.learningArmDelta = { index, x: -.18 * sample.lowPaw, z: side * .48 * sample.lowPaw };
        this.shoulders[index].rotation.x += this.learningArmDelta.x;
        this.shoulders[index].rotation.z += this.learningArmDelta.z;
    }

    handAnchor(out = new THREE.Vector3(), hand?: SharedResidentHand) {
        if (hand) return this.handContacts[hand === 'left' ? 0 : 1].getWorldPosition(out);
        this.handContacts[0].getWorldPosition(out);
        return out.add(this.handContacts[1].getWorldPosition(new THREE.Vector3())).multiplyScalar(.5);
    }

    clearSharedPose() {
        if (!this.sharedPose) return;
        this.body.quaternion.copy(this.sharedPose.body);
        this.head.quaternion.copy(this.sharedPose.head);
        this.shoulders.forEach((shoulder, index) => shoulder.quaternion.copy(this.sharedPose!.shoulders[index]));
        this.sharedPose = undefined;
    }

    /** An additive free-play layer, applied after update(). The selected actual
     * paw and eyes aim at the target; the other arm rests in a steady support
     * pose. Omitting hand preserves the original two-handed interaction. */
    setSharedPose(mode: SharedResidentPose, amount: number, target: THREE.Vector3, hand?: SharedResidentHand) {
        this.clearSharedPose(); this.clearLearningPose();
        const blend = Number.isFinite(amount) ? clampUnit(amount) : 0;
        if (!blend || ![target.x, target.y, target.z].every(Number.isFinite)) return;
        this.sharedPose = { body: this.body.quaternion.clone(), head: this.head.quaternion.clone(),
            shoulders: this.shoulders.map(shoulder => shoulder.quaternion.clone()) };
        // Finish lifting from a sniff/watch before the carrying walk resets its
        // base pose. Aim the real hands after this blend so the prop cannot jump
        // when the source's .07 forward lean gives way to upright walking.
        if (mode === 'carry' || mode === 'offer') this.body.rotation.x *= 1 - blend;
        const local = this.body.worldToLocal(target.clone());
        const reach = blend * (hand ? 1 : mode === 'carry' ? .9 : mode === 'enjoy' ? .95 : 1);
        this.shoulders.forEach((shoulder, index) => {
            if (hand && index !== (hand === 'left' ? 0 : 1)) {
                const support = new THREE.Quaternion().setFromEuler(new THREE.Euler(-.18, 0, (index ? 1 : -1) * .32));
                shoulder.quaternion.slerpQuaternions(this.sharedPose!.shoulders[index], support, blend);
                return;
            }
            const contact = shoulder.worldToLocal(this.handContacts[index].getWorldPosition(new THREE.Vector3())).normalize();
            const toward = local.clone().sub(shoulder.position);
            if (toward.lengthSq() < .0001) return;
            const aim = new THREE.Quaternion().setFromUnitVectors(contact, toward.normalize());
            shoulder.quaternion.slerpQuaternions(this.sharedPose!.shoulders[index], aim, reach);
        });
        const look = local.sub(this.head.position), yaw = Math.atan2(look.x, look.z);
        const pitch = Math.atan2(-look.y, Math.hypot(look.x, look.z));
        const yawLimit = hand ? 1.05 : .65;
        const head = new THREE.Quaternion().setFromEuler(new THREE.Euler(
            THREE.MathUtils.clamp(pitch, -.45, .5), THREE.MathUtils.clamp(yaw, -yawLimit, yawLimit), mode === 'enjoy' ? -.055 : 0,
            hand ? 'YXZ' : 'XYZ'));
        this.head.quaternion.slerpQuaternions(this.sharedPose.head, head, blend);
    }

    private resetPose() {
        this.sharedPose = undefined;
        this.pose.position.set(0, 0, 0); this.pose.rotation.set(0, 0, 0);
        this.body.position.y = 0; this.body.rotation.set(0, 0, 0); this.head.rotation.set(0, 0, 0);
        this.learningHeadDelta.set(0, 0, 0); this.learningArmDelta = undefined;
        this.shoulders.forEach((shoulder, index) => shoulder.rotation.set(0, 0, (index ? 1 : -1) * .2));
        this.feet.forEach(foot => { foot.position.y = residentFootY(this.species); foot.position.z = .12; });
    }

    private sitOn(seat: FurniturePoint, angle = 0, amount = 1) {
        this.body.position.y = SEATED_BODY_Y * amount;
        this.feet.forEach(foot => {
            foot.position.y += (.08 - foot.position.y) * amount;
            foot.position.z += (.27 - foot.position.z) * amount;
        });
        // Keep the butt contact on the exact animated seat while the local body tilts.
        // The navigation root x/z remains unchanged, including on the east island.
        const contact = new THREE.Vector3(0, residentSeatContactY(this.species), 0)
            .applyAxisAngle(new THREE.Vector3(1, 0, 0), angle);
        this.pose.rotation.x = angle * amount;
        this.pose.position.set(seat.x / RESIDENT_SCALE - contact.x,
            (seat.y - this.destination.y) / RESIDENT_SCALE - contact.y, seat.z / RESIDENT_SCALE - contact.z).multiplyScalar(amount);
    }

    update(now: number) {
        this.clearSharedPose();
        this.clearSafeDeparture();
        if (this.standing) {
            const standing = this.standing, t = easeResident((now - standing.startedAt) / 220);
            this.resetPose();
            this.group.position.y = THREE.MathUtils.lerp(standing.y, residentGroundHeight(this.group.position, this.expanded), t);
            this.group.rotation.y = standing.yaw + angleDelta(standing.yaw, .28) * t;
            this.pose.position.copy(standing.position).multiplyScalar(1 - t); this.pose.rotation.x = standing.tilt * (1 - t);
            this.body.position.y = standing.bodyY * (1 - t);
            this.feet.forEach((foot, index) => foot.position.lerpVectors(standing.feet[index], foot.position.clone(), t));
            if (t >= 1) this.standing = undefined;
            return t < 1;
        }
        if (!this.target && !this.pointWalk) return false;
        this.resetPose();
        const elapsed = now - this.startTime, progress = this.duration ? clampUnit(elapsed / this.duration) : 1;
        const frameElapsed = Math.max(0, now - this.lastUpdate); this.lastUpdate = now;
        const anchors = this.target ? getFurnitureAnchors(this.target.kind) : undefined;
        if (progress < 1) {
            const total = this.distances[this.distances.length - 1], traveled = easeResident(progress) * total;
            let segment = 1;
            while (segment < this.distances.length - 1 && this.distances[segment] < traveled) segment++;
            const a = this.path[segment - 1], b = this.path[segment];
            const t = (traveled - this.distances[segment - 1]) / Math.max(.001, this.distances[segment] - this.distances[segment - 1]);
            this.group.position.lerpVectors(a, b, t);
            this.clearSafeDeparture();
            const approaching = anchors?.seat ? easeResident((progress - .9) / .1) : 0;
            this.group.position.y = THREE.MathUtils.lerp(residentGroundHeight(this.group.position, this.expanded), this.destination.y, approaching);
            const yaw = Math.atan2(b.x - a.x, b.z - a.z), facing = easeResident((progress - .88) / .12);
            this.group.rotation.y = turnResidentToward(this.group.rotation.y, yaw + angleDelta(yaw, this.destinationYaw) * facing, frameElapsed);
            const stride = sampleResidentStride(traveled, total);
            this.body.position.y = stride.bob;
            this.feet.forEach((foot, i) => { foot.position.y += stride.feet[i].lift; foot.position.z = stride.feet[i].z; });
            this.shoulders.forEach((shoulder, i) => { shoulder.rotation.x = stride.feet[i].arm; });
            if (anchors?.seat && approaching) this.sitOn(anchors.seat, 0, approaching);
            return true;
        }
        this.group.position.copy(this.destination); this.group.rotation.y = this.destinationYaw;
        this.clearSafeDeparture();
        if (!this.target || !anchors) {
            this.pointWalk = false; this.action = 'idle'; this.usePhase = 1; this.arrivalReported = true;
            return false;
        }
        this.action = ACTIONS[this.target.kind];
        this.usePhase = this.reduced ? 1 : clampUnit((now - this.useStartedAt) / FURNITURE_USE_MS);
        if (anchors.seat) {
            const swing = this.action === 'swing' ? sampleFurnitureSwing(this.usePhase) : undefined;
            this.sitOn(swing?.seat ?? anchors.seat, swing?.angle ?? 0);
            this.head.rotation.x = -.025 - Math.sin(this.usePhase * Math.PI) * .09;
        } else {
            const look = new THREE.Vector3(anchors.look.x, anchors.look.y, anchors.look.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.target.rotation);
            look.x += this.target.position!.x; look.z += this.target.position!.z;
            const distance = Math.hypot(look.x - this.group.position.x, look.z - this.group.position.z);
            const leaning = this.action === 'sniff' || this.action === 'watch';
            this.body.rotation.x = leaning ? .07 : 0;
            this.head.rotation.x = Math.max(-.28, Math.min(.48, Math.atan2(this.head.position.y * RESIDENT_SCALE - look.y, distance))) - this.body.rotation.x;
            this.head.rotation.y = Math.max(-.25, Math.min(.25, angleDelta(this.group.rotation.y, Math.atan2(look.x - this.group.position.x, look.z - this.group.position.z))));
            this.head.rotation.x += Math.sin(this.usePhase * Math.PI) * (leaning ? .1 : -.1);
        }
        this.head.rotation.z = Math.sin(this.usePhase * Math.PI * 2) * .045;
        if (!this.arrivalReported) { this.arrivalReported = true; this.onArrival(`${RESIDENT_NAMES[this.species]}が ${USE_CAPTIONS[this.target.kind]}`); }
        return this.usePhase < 1;
    }
}
