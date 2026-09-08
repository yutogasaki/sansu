import * as THREE from 'three';
import { ISLAND_ITEMS, type IslandLandAccess } from '../../../domain/island/catalog';
import type { IslandResident, SharedResidentHand } from './animals';
import { SEATED_BODY_Y, easeResident } from './residentRig';
import { SharedJobActor } from './sharedJobActor';
import { findSafeResidentSpawn, planResidentPointRoute, residentObstacles, type GroundPoint } from './navigation';
import { makeOptionalFurnitureRouteGuard, optionalFurnitureWalkingYaw, optionalResidentFootprint, type OptionalFurnitureRoute } from './optionalFurnitureNavigation';
import type { IslandPlayResult, IslandStageItem } from './types';
import { CUP_GRIPS, HAMMOCK_SEAT, TEA_DESTINATION, TEA_SOURCE, TEA_TRANSFER, configureTelescope,
    hammockAngle, isOptionalFurniture, optionalFurnitureAnchors, optionalFurnitureGroundSupports, setHammockAngle } from './optionalFurnitureGeometry';

type Phase = 'walking' | 'mounting' | 'contact' | 'using' | 'pickup' | 'offering' | 'handoff' | 'receiving' | 'returning' | 'settled';
export interface OptionalFurnitureStart {
    item: IslandStageItem; group: THREE.Group; requestId: string; residentId?: IslandResident['species']; partnerId?: IslandResident['species'];
    borrowed: boolean; items: IslandStageItem[]; land: IslandLandAccess; obstacles?: readonly { x: number; z: number; radius: number }[];
    now: number; reduced: boolean;
}
interface Actor { rig: SharedJobActor; route: OptionalFurnitureRoute; hand?: SharedResidentHand; side: number; origin: THREE.Vector3 }
interface Visit extends OptionalFurnitureStart {
    phase: Phase; phaseAt: number; actors: Actor[]; contactSeen: boolean; transferSeen: boolean;
    cupHolder: 'table' | IslandResident['species']; presentationBounds: THREE.Box3;
    walkingRendered: boolean; lastUpdatedAt: number;
}
const v = (point: GroundPoint) => new THREE.Vector3(point.x, 0, point.z);
const localEye = (resident: IslandResident) => new THREE.Vector3(resident.species === 'rabbit' ? -.108 : -.15, .047,
    resident.species === 'rabbit' ? .265 : .294);
const worldEye = (resident: IslandResident) => resident.head.localToWorld(localEye(resident));

/** Temporary control of actual residents and one actual tool. It has no writer,
 * discovery hook, clone of an owned object, or automatic replay after cancel. */
export class OptionalFurnitureController {
    private visit?: Visit;
    constructor(private readonly residents: readonly IslandResident[]) {}
    get active() { return Boolean(this.visit); }
    get phase() { return this.visit?.phase; }
    get caption() {
        const visit = this.visit; if (!visit) return undefined;
        if (visit.phase === 'walking') return visit.item.kind === 'telescope' ? 'そらを のぞく ばしょへ とことこ'
            : visit.item.kind === 'hammock' ? 'やわらかい ぬのへ とことこ' : 'ふたりで おちゃの じゅんび';
        if (visit.item.kind === 'telescope') return visit.phase === 'settled' ? 'ぼうえんきょうで そらを ながめているよ' : 'てで ささえて、そらを のぞこう';
        if (visit.item.kind === 'hammock') return visit.phase === 'mounting' ? 'ぬのに そっと からだを あずけよう'
            : visit.phase === 'settled' ? 'ハンモックで ゆったり ひとやすみ' : 'ぬのと いっしょに ゆらゆら';
        return visit.phase === 'settled' ? 'ふたりで おちゃを たのしんでいるよ'
            : ['handoff', 'receiving'].includes(visit.phase) ? 'おなじ カップを てから てへ' : 'カップを そっと はこんでいるよ';
    }
    owns(resident: IslandResident) { return this.visit?.actors.some(actor => actor.rig.resident === resident) ?? false; }
    get itemId() { return this.visit?.item.id; }
    get requestId() { return this.visit?.requestId; }
    get borrowed() { return this.visit?.borrowed ?? false; }
    get group() { return this.visit?.group; }
    get framingBounds() { return this.visit?.presentationBounds.clone(); }
    get framingSubjects() {
        const visit = this.visit;
        return visit ? [[visit.group, ...visit.actors.map(actor => actor.rig.resident.group)], ...visit.actors.map(actor => actor.rig.resident.head)] : [];
    }
    /** Camera-only inspection of the exact target posture. Every original
     * transform, including the same cup/cloth, is restored before rendering. */
    withPresentation(inspect: () => void) {
        const visit = this.visit; if (!visit) { inspect(); return; }
        const saved: { object: THREE.Object3D; position: THREE.Vector3; quaternion: THREE.Quaternion; scale: THREE.Vector3 }[] = [];
        for (const root of [visit.group, ...visit.actors.map(actor => actor.rig.resident.group)]) root.traverse(object => {
            saved.push({ object, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() });
        });
        try {
            for (const actor of visit.actors) {
                if (visit.item.kind === 'telescope') this.telescopePose(visit, actor);
                else if (visit.item.kind === 'hammock') this.hammockPose(visit, actor, 0);
                else this.teaPose(visit, actor, TEA_TRANSFER, true);
            }
            if (visit.item.kind === 'tea-table') visit.group.getObjectByName('optional-tea-cup')!.position.copy(TEA_TRANSFER);
            inspect();
        } finally {
            for (const transform of saved) { transform.object.position.copy(transform.position); transform.object.quaternion.copy(transform.quaternion); transform.object.scale.copy(transform.scale); }
            visit.group.updateWorldMatrix(true, true); visit.actors.forEach(actor => actor.rig.resident.group.updateWorldMatrix(true, true));
        }
    }
    private world(visit: OptionalFurnitureStart, point: THREE.Vector3) { return visit.group.localToWorld(point.clone()); }
    private yaw(visit: OptionalFurnitureStart) { return new THREE.Euler().setFromQuaternion(visit.group.getWorldQuaternion(new THREE.Quaternion()), 'YXZ').y; }

    /** Tea seats are on the left and right of the table. Both feet remain on
     * their own side; the inside actual hand reaches the same two-handled cup. */
    private teaRoot(visit: OptionalFurnitureStart, actor: Actor, cup: THREE.Vector3) {
        const resident = actor.rig.resident, hand = actor.hand!, index = hand === 'left' ? 0 : 1;
        actor.rig.pose(this.world(visit, new THREE.Vector3()), this.yaw(visit));
        const shoulder = resident.group.getObjectByName(index ? 'shoulder-right' : 'shoulder-left')!;
        const shoulderPoint = visit.group.worldToLocal(shoulder.getWorldPosition(new THREE.Vector3()));
        const length = shoulder.getWorldPosition(new THREE.Vector3()).distanceTo(resident.handAnchor(new THREE.Vector3(), hand));
        const grip = cup.clone().add(CUP_GRIPS[actor.side < 0 ? 0 : 1]);
        const x = actor.side * .52, lateral = grip.x - x - shoulderPoint.x, height = grip.y - shoulderPoint.y;
        const square = length ** 2 - lateral ** 2 - height ** 2;
        if (square <= 0) return undefined;
        return new THREE.Vector3(x, 0, grip.z - shoulderPoint.z - Math.sqrt(square));
    }
    private aimHand(actor: Actor, target: THREE.Vector3) {
        const resident = actor.rig.resident, hand = actor.hand!, shoulder = resident.group.getObjectByName(hand === 'left' ? 'shoulder-left' : 'shoulder-right')!;
        const contact = shoulder.worldToLocal(resident.handAnchor(new THREE.Vector3(), hand)).normalize();
        const direction = shoulder.parent!.worldToLocal(target.clone()).sub(shoulder.position).normalize();
        shoulder.quaternion.setFromUnitVectors(contact, direction); resident.group.updateWorldMatrix(true, true);
    }
    private telescopePose(visit: OptionalFurnitureStart, actor: Actor) {
        const resident = actor.rig.resident;
        actor.rig.pose(this.world(visit, new THREE.Vector3(0, 0, .28)), this.yaw(visit));
        resident.head.rotation.x = -1.10;
        for (const [i, side] of ['left', 'right'].entries()) resident.group.getObjectByName(`shoulder-${side}`)!.rotation.set(-1.10, 0, (i ? 1 : -1) * .12);
        resident.group.updateWorldMatrix(true, true);
        const eye = visit.group.worldToLocal(worldEye(resident));
        const direction = new THREE.Vector3(0, 0, 1).applyQuaternion(resident.head.getWorldQuaternion(new THREE.Quaternion()))
            .transformDirection(new THREE.Matrix4().copy(visit.group.matrixWorld).invert());
        const hands = (['left', 'right'] as const).map(hand => visit.group.worldToLocal(resident.handAnchor(new THREE.Vector3(), hand)));
        configureTelescope(visit.group, eye, direction, hands);
    }
    private hammockPose(visit: OptionalFurnitureStart, actor: Actor, angle: number) {
        const resident = actor.rig.resident;
        setHammockAngle(visit.group, angle);
        const surface = visit.group.getObjectByName('optional-hammock-cloth')!;
        const seat = surface.localToWorld(HAMMOCK_SEAT.clone());
        actor.rig.pose(seat.clone(), this.yaw(visit));
        resident.group.quaternion.copy(surface.getWorldQuaternion(new THREE.Quaternion()));
        resident.body.position.y = SEATED_BODY_Y;
        resident.feet.forEach(foot => { foot.position.y = .24; foot.position.z = .28; });
        resident.head.rotation.x = -.06;
        resident.group.updateWorldMatrix(true, true);
        resident.group.position.add(seat.sub(resident.seatContact.getWorldPosition(new THREE.Vector3())));
        resident.group.updateWorldMatrix(true, true);
    }
    private teaPose(visit: OptionalFurnitureStart, actor: Actor, cup: THREE.Vector3, reach: boolean) {
        const root = this.teaRoot(visit, actor, cup); if (!root) return false;
        actor.rig.pose(this.world(visit, root), this.yaw(visit));
        if (reach) this.aimHand(actor, this.world(visit, cup.clone().add(CUP_GRIPS[actor.side < 0 ? 0 : 1])));
        actor.rig.look(this.world(visit, cup.clone())); return true;
    }
    private endRoot(visit: OptionalFurnitureStart, actor: Actor) {
        if (visit.item.kind === 'telescope') return new THREE.Vector3(0, 0, .28);
        if (visit.item.kind === 'hammock') return new THREE.Vector3(0, 0, .90);
        return this.teaRoot(visit, actor, actor.side < 0 ? TEA_SOURCE : TEA_TRANSFER);
    }
    start(input: OptionalFurnitureStart): IslandPlayResult {
        this.cancel(input.now, input.items, input.land, input.obstacles);
        const planned = this.plan(input); this.visit = planned.visit;
        return planned.result;
    }
    /** Tests a legal trial candidate with the actual rigs before displaying it.
     * It neither cancels an active visit nor starts a walk or observation. */
    canStart(input: OptionalFurnitureStart): IslandPlayResult {
        return this.plan(input).result;
    }
    private plan(input: OptionalFurnitureStart): { result: IslandPlayResult; visit?: Visit } {
        const base = { requestId: input.requestId, itemId: input.item.id };
        if (!isOptionalFurniture(input.item.kind) || !input.item.position) return { result: { ...base, status: 'unavailable', reason: 'not-placed' } };
        const chosen = input.residentId ? this.residents.find(resident => resident.species === input.residentId && resident.group.visible)
            : this.residents.find(resident => resident.group.visible);
        if (!chosen) return { result: { ...base, status: 'unavailable', reason: 'resident-unavailable' } };
        const partners = input.item.kind === 'tea-table' ? this.residents.filter(resident => resident !== chosen && resident.group.visible
            && (!input.partnerId || resident.species === input.partnerId)) : [undefined];
        if (!partners.length) return { result: { ...base, status: 'unavailable', reason: 'partner-unavailable' } };
        input.group.updateWorldMatrix(true, true);
        for (const partner of partners) {
            const selected = partner ? [chosen, partner] : [chosen];
            const actors: Actor[] = selected.map((resident, i) => ({ rig: new SharedJobActor(resident), route: { points: [], yaw: this.yaw(input) },
                origin: resident.group.position.clone(), side: i === 0 ? -1 : 1, hand: i === 0 ? 'right' : 'left' }));
            let valid = true;
            const obstacles = optionalFurnitureGroundSupports(input.item.kind);
            const physical = obstacles.map(obstacle => ({ ...this.world(input, v(obstacle)), radius: obstacle.radius }));
            for (const [index, actor] of actors.entries()) {
                const end = this.endRoot(input, actor); actor.rig.restore();
                if (!end) { valid = false; break; }
                const worldEnd = this.world(input, end), otherItems = input.items.filter(item => item.id !== input.item.id);
                const occupied = [...this.residents.filter(resident => resident.group.visible && !selected.includes(resident)).map(resident => resident.group.position),
                    ...actors.filter((_, i) => i !== index).map((other, i) => index > 0 && i === 0 && other.route.points.length ? v(other.route.points[other.route.points.length - 1]) : other.origin)];
                const bodies = this.residents.filter(resident => resident.group.visible && !selected.includes(resident)).map(resident => optionalResidentFootprint(resident.group));
                for (const [otherIndex, other] of actors.entries()) if (other !== actor) {
                    if (otherIndex < index) other.rig.walk(other.route, 1, input.land, input.reduced);
                    bodies.push(optionalResidentFootprint(other.rig.resident.group)); other.rig.restore();
                }
                actor.rig.pose(new THREE.Vector3(), 0);
                const footprint = optionalResidentFootprint(actor.rig.resident.group); actor.rig.restore();
                const departingId = actor.rig.resident.itemId || actor.rig.resident.departingId;
                const segmentIsClear = makeOptionalFurnitureRouteGuard(footprint,
                    [...residentObstacles(otherItems, '', departingId), ...(input.obstacles ?? [])], bodies, worldEnd, this.yaw(input));
                const route = planResidentPointRoute(actor.origin, worldEnd, otherItems, input.land,
                    { departingId, occupied, segmentIsClear,
                        obstacles: [...(input.obstacles ?? []), ...physical], yaw: this.yaw(input) });
                if (!route) { valid = false; break; }
                actor.route = { ...route, facingYaws: route.points.slice(1).map((point, i) => segmentIsClear.facing(route.points[i], point)!) };
            }
            if (valid && actors.length > 1) {
                // A waiting partner already faces its safe departure direction.
                // Recheck the first route against that actual waiting body, not
                // the ordinary idle yaw that could leave a long tail in a prop.
                const [first, second] = actors;
                second.rig.walk(second.route, 0, input.land, input.reduced, 0, optionalFurnitureWalkingYaw(second.route, 0, input.reduced));
                const bodies = this.residents.filter(resident => resident.group.visible && resident !== first.rig.resident).map(resident => optionalResidentFootprint(resident.group));
                first.rig.pose(new THREE.Vector3(), 0);
                const local = optionalResidentFootprint(first.rig.resident.group); first.rig.restore(); second.rig.restore();
                const guard = makeOptionalFurnitureRouteGuard(local, [...residentObstacles(input.items.filter(item => item.id !== input.item.id), '', first.rig.resident.itemId || first.rig.resident.departingId),
                    ...(input.obstacles ?? [])], bodies, first.route.points[first.route.points.length - 1], first.route.yaw);
                const yaws = first.route.points.slice(1).map((point, i) => guard.facing(first.route.points[i], point));
                valid = yaws.every(yaw => yaw !== undefined);
                if (valid) first.route.facingYaws = yaws as number[];
            }
            actors.forEach(actor => actor.rig.restore());
            if (!valid) continue;
            const visit: Visit = { ...input, actors, phase: 'walking', phaseAt: input.now, contactSeen: false, transferSeen: false,
                cupHolder: 'table', presentationBounds: new THREE.Box3().setFromObject(input.group, true), walkingRendered: false, lastUpdatedAt: input.now };
            for (const actor of actors) {
                if (input.item.kind === 'telescope') this.telescopePose(input, actor);
                else if (input.item.kind === 'hammock') this.hammockPose(input, actor, 0);
                else this.teaPose(input, actor, TEA_TRANSFER, true);
                visit.presentationBounds.union(new THREE.Box3().setFromObject(actor.rig.resident.group, true));
                actor.rig.restore();
            }
            return { visit, result: { ...base, status: 'playing', resident: chosen.species, ...(partner ? { partner: partner.species } : {}),
                activity: input.item.kind === 'tea-table' ? 'tea' : input.item.kind } };
        }
        return { result: { ...base, status: 'blocked', reason: 'unreachable', resident: chosen.species } };
    }
    private next(phase: Phase, now: number) { this.visit!.phase = phase; this.visit!.phaseAt = now; }
    update(now: number, reduced: boolean) {
        const visit = this.visit; if (!visit) return false;
        visit.reduced = reduced;
        visit.lastUpdatedAt = now;
        // Planning and camera selection can outlast a reduced walk. They are
        // preparation, and cannot consume movement before its first real frame.
        const elapsed = visit.phase === 'walking' && !visit.walkingRendered ? 0 : Math.max(0, now - visit.phaseAt), duration = reduced ? 240 : 850;
        const t = easeResident(elapsed / duration), [first, second] = visit.actors;
        if (visit.phase === 'walking') {
            // Partners approach sequentially so their actual bodies never cross.
            const walkMs = reduced ? 300 : 2400, total = walkMs * visit.actors.length;
            visit.actors.forEach((actor, i) => {
                const fraction = THREE.MathUtils.clamp((elapsed - walkMs * i) / walkMs, 0, 1);
                actor.rig.walk(actor.route, fraction, visit.land, reduced, 0, optionalFurnitureWalkingYaw(actor.route, fraction, reduced));
            });
            if (elapsed >= total) this.next(visit.item.kind === 'hammock' ? 'mounting' : visit.item.kind === 'tea-table' ? 'pickup' : 'contact', now);
        } else if (visit.item.kind === 'telescope') {
            this.telescopePose(visit, first);
            if (visit.phase === 'contact' && visit.contactSeen) this.next('using', now);
            else if (visit.phase === 'using' && elapsed >= (reduced ? 350 : 2200)) this.next('settled', now);
        } else if (visit.item.kind === 'hammock') {
            if (visit.phase === 'mounting') {
                this.hammockPose(visit, first, 0);
                const root = first.rig.resident.group.position.clone(), from = this.world(visit, new THREE.Vector3(0, 0, .90));
                first.rig.resident.group.position.lerpVectors(from, root, t);
                first.rig.resident.group.position.y += Math.sin(t * Math.PI) * .38;
                if (t >= 1) this.next('contact', now);
            } else {
                this.hammockPose(visit, first, visit.phase === 'using' ? hammockAngle(elapsed / 2600, reduced) : 0);
                if (visit.phase === 'contact' && visit.contactSeen) this.next('using', now);
                else if (visit.phase === 'using' && elapsed >= (reduced ? 350 : 2600)) this.next('settled', now);
            }
        } else if (second) {
            const cup = visit.group.getObjectByName('optional-tea-cup')!;
            const position = visit.phase === 'offering' ? TEA_SOURCE.clone().lerp(TEA_TRANSFER, t)
                : visit.phase === 'handoff' ? TEA_TRANSFER.clone()
                : visit.phase === 'receiving' ? TEA_TRANSFER.clone().lerp(TEA_DESTINATION, t)
                : ['returning', 'settled'].includes(visit.phase) ? TEA_DESTINATION.clone() : TEA_SOURCE.clone();
            cup.position.copy(position);
            const giving = ['pickup', 'offering', 'handoff'].includes(visit.phase), taking = ['handoff', 'receiving', 'returning'].includes(visit.phase);
            this.teaPose(visit, first, giving ? position : TEA_TRANSFER, giving);
            this.teaPose(visit, second, taking ? position : TEA_TRANSFER, taking);
            if (visit.phase === 'pickup' && visit.contactSeen) { visit.cupHolder = first.rig.resident.species; this.next('offering', now); }
            else if (visit.phase === 'offering' && t >= 1) this.next('handoff', now);
            else if (visit.phase === 'handoff' && visit.transferSeen) { visit.cupHolder = second.rig.resident.species; this.next('receiving', now); }
            else if (visit.phase === 'receiving' && t >= 1) this.next('returning', now);
            else if (visit.phase === 'returning' && elapsed >= duration) { visit.cupHolder = 'table'; this.next('settled', now); }
            if (visit.phase === 'settled') {
                first.rig.look(second.rig.resident.head.getWorldPosition(new THREE.Vector3()));
                second.rig.look(first.rig.resident.head.getWorldPosition(new THREE.Vector3()));
            }
        }
        visit.group.updateWorldMatrix(true, true); return visit.phase !== 'settled';
    }
    afterRender(visible: (point: THREE.Vector3) => boolean, renderedAt?: number) {
        const visit = this.visit; if (!visit) return;
        if (visit.phase === 'walking' && !visit.walkingRendered) {
            visit.walkingRendered = true; visit.phaseAt = renderedAt ?? visit.lastUpdatedAt;
            return;
        }
        const a = optionalFurnitureAnchors(visit.group), first = visit.actors[0].rig.resident;
        if (visit.phase === 'contact') {
            const points = visit.item.kind === 'telescope' ? [worldEye(first), a.eye!, ...a.grips as THREE.Vector3[]]
                : [a.seat!, first.seatContact.getWorldPosition(new THREE.Vector3())];
            if (points.every(visible) && (visit.item.kind === 'hammock' ? points[0].distanceTo(points[1]) < .005
                : worldEye(first).distanceTo(a.eye!) < .005 && a.grips.every((point, i) => point!.distanceTo(first.handAnchor(new THREE.Vector3(), i ? 'right' : 'left')) < .005))) visit.contactSeen = true;
        }
        if (visit.phase === 'pickup' || visit.phase === 'handoff') {
            const actors = visit.phase === 'handoff' ? visit.actors : [visit.actors[0]];
            const okay = actors.every(actor => {
                const grip = a.cupGrips[actor.side < 0 ? 0 : 1]!, hand = actor.rig.resident.handAnchor(new THREE.Vector3(), actor.hand);
                return visible(grip) && visible(hand) && grip.distanceTo(hand) < .008;
            });
            if (okay && visit.phase === 'pickup') visit.contactSeen = true;
            if (okay && visit.phase === 'handoff') visit.transferSeen = true;
        }
    }
    cancel(now: number, items?: IslandStageItem[], land?: IslandLandAccess, obstacles?: OptionalFurnitureStart['obstacles']) {
        const visit = this.visit; if (!visit) return;
        this.visit = undefined;
        if (visit.item.kind === 'hammock') setHammockAngle(visit.group, 0);
        visit.group.getObjectByName('optional-tea-cup')?.position.copy(TEA_SOURCE);
        for (const actor of visit.actors) {
            actor.rig.restore(); const resident = actor.rig.resident;
            resident.release(now); resident.update(now + 1000);
            const occupied = this.residents.filter(other => other !== resident && other.group.visible).map(other => other.group.position);
            const safe = findSafeResidentSpawn(actor.origin, items ?? visit.items, land ?? visit.land, occupied, obstacles ?? visit.obstacles);
            if (safe) resident.group.position.set(safe.x, 0, safe.z);
        }
    }
    describe(): { requestId: string; itemId: string; borrowed: boolean; kind: string; phase: Phase; actorIds: string[]; actors: unknown[];
        anchors: unknown; cup?: { uuid: string; holder: string; parentUuid?: string; position: number[] }; contactSeen: boolean; transferSeen: boolean; radius: number; bounds: { min: number[]; max: number[] } } | undefined {
        const visit = this.visit; if (!visit) return undefined;
        const anchor = optionalFurnitureAnchors(visit.group), cup = visit.group.getObjectByName('optional-tea-cup');
        const all = new THREE.Box3().setFromObject(visit.group, true);
        visit.actors.forEach(actor => all.union(new THREE.Box3().setFromObject(actor.rig.resident.group, true)));
        const points = Object.fromEntries(Object.entries(anchor).map(([key, value]) => [key, Array.isArray(value) ? value.map(v => v?.toArray()) : value?.toArray()]));
        return { requestId: visit.requestId, itemId: visit.item.id, borrowed: visit.borrowed, kind: visit.item.kind, phase: visit.phase,
            actorIds: visit.actors.map(actor => actor.rig.resident.species), actors: visit.actors.map(({ rig, route }) => ({ id: rig.resident.species,
                uuid: rig.resident.group.uuid, position: rig.resident.group.getWorldPosition(new THREE.Vector3()).toArray(),
                route: route.points.map(point => [point.x, point.z]),
                facingYaws: route.facingYaws,
                eye: worldEye(rig.resident).toArray(), hands: ['left', 'right'].map(hand => rig.resident.handAnchor(new THREE.Vector3(), hand as SharedResidentHand).toArray()) })),
            anchors: points, ...(cup ? { cup: { uuid: cup.uuid, holder: visit.cupHolder, parentUuid: cup.parent?.uuid, position: cup.getWorldPosition(new THREE.Vector3()).toArray() } } : {}),
            contactSeen: visit.contactSeen, transferSeen: visit.transferSeen, radius: ISLAND_ITEMS[visit.item.kind].radius,
            bounds: { min: all.min.toArray(), max: all.max.toArray() } };
    }
}
