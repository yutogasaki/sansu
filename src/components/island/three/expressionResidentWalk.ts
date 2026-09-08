import * as THREE from 'three';
import type { IslandLandAccess } from '../../../domain/island/catalog';
import type { IslandResidentId } from '../../../domain/island/residentIdentity';
import type { IslandResident } from './animals';
import type { IslandStageItem } from './types';
import { planResidentPointRoute, residentGroundHeight, residentObstacles } from './navigation';
import { makeOptionalFurnitureRouteGuard, optionalResidentFootprint, optionalFurnitureWalkingYaw, optionalFootprintClearsCircle, optionalFootprintsAreSeparate, type OptionalFurnitureRoute } from './optionalFurnitureNavigation';
import { SharedJobActor } from './sharedJobActor';
import { fitLearningFrame } from './sceneFraming';
import { expressionDepartures, type ExpressionDeparture, type ExpressionDepartureAttempt, type ExpressionSeat } from './expressionResidentDeparture';
import { expressionFootContact } from './expressionFootTrails';

interface Input {
    request: { id: string; residentId: IslandResidentId };
    items: IslandStageItem[]; land: IslandLandAccess;
    obstacles: readonly { x: number; z: number; radius: number }[];
    seat?: ExpressionSeat;
}
interface WalkPlan { route: OptionalFurnitureRoute; departure?: ExpressionDeparture }
interface Walk extends Input {
    actor: SharedJobActor; phase: 'preparing' | 'departing' | 'walking' | 'settled' | 'blocked'; checked: number;
    origin: THREE.Vector3; yaw: number; bounds: THREE.Box3;
    search?: Generator<undefined, WalkPlan | undefined>;
    departureAttempts: ExpressionDepartureAttempt[]; route?: OptionalFurnitureRoute; departure?: ExpressionDeparture; startedAt: number;
}

/** An explicitly requested short walk of the same resident. The scene owns
 * no receipt or reward here; cancellation returns the borrowed rig exactly. */
export class ExpressionResidentWalk {
    private walk?: Walk;
    private seen?: string;
    constructor(private readonly residents: readonly IslandResident[]) {}
    get active() { return Boolean(this.walk); }
    get moving() { return this.walk?.phase === 'preparing' || this.walk?.phase === 'departing' || this.walk?.phase === 'walking'; }
    get walkingResidentId() { return this.walk?.phase === 'walking' ? this.walk.request.residentId : undefined; }
    set(input?: Input) {
        if (!input) { this.cancel(); return; }
        if (input.request.id === this.seen) return;
        this.cancel(); this.seen = input.request.id;
        const resident = this.residents.find(value => value.species === input.request.residentId && value.group.visible);
        if (!resident) return;
        resident.group.updateWorldMatrix(true, true);
        const forward = new THREE.Vector3(0, 0, 1).transformDirection(resident.group.matrixWorld);
        const actor = new SharedJobActor(resident), origin = resident.group.position.clone(), yaw = Math.atan2(forward.x, forward.z);
        const walk: Walk = { ...input, actor, origin, yaw, phase: 'preparing', checked: 0, startedAt: 0,
            departureAttempts: [], bounds: resident.learningFrameBounds() };
        this.walk = walk; walk.search = this.search(walk);
    }
    private *search(walk: Walk): Generator<undefined, WalkPlan | undefined> {
        const resident = walk.actor.resident;
        // Include the visible clothes and actual tail in the planning hull.
        walk.actor.pose(new THREE.Vector3(), 0);
        const local = optionalResidentFootprint(resident.group); walk.actor.restore();
        const others = this.residents.filter(value => value !== resident && value.group.visible);
        const bodies = others.map(value => optionalResidentFootprint(value.group));
        const circles = [...residentObstacles(walk.items, ''), ...walk.obstacles];
        const departures = walk.seat ? expressionDepartures(walk.actor, walk.seat, walk.items, walk.land, walk.obstacles, bodies, attempt => walk.departureAttempts.push(attempt)) : [undefined];
        for (const departure of departures) {
            if (walk.seat && !departure) { walk.checked++; yield; continue; }
            const origin = departure?.end ?? walk.origin;
            for (const distance of [.8, 1.15]) for (const angle of [0, Math.PI / 2, -Math.PI / 2, Math.PI, Math.PI / 4, -Math.PI / 4, Math.PI * .75, -Math.PI * .75]) {
                const yaw = walk.yaw + angle, end = { x: origin.x + Math.sin(yaw) * distance, z: origin.z + Math.cos(yaw) * distance };
                const guard = makeOptionalFurnitureRouteGuard(local, circles, bodies, end, yaw);
                const route = planResidentPointRoute(origin, end, walk.items, walk.land,
                    { yaw, occupied: others.map(value => value.group.position), obstacles: walk.obstacles, segmentIsClear: guard });
                walk.checked++;
                if (route) {
                    const length = route.points.slice(1).reduce((sum, point, i) => sum + Math.hypot(point.x - route.points[i].x, point.z - route.points[i].z), 0);
                    if (length <= 1.8) {
                        const actual = { ...route, facingYaws: route.points.slice(1).map((point, i) => guard.facing(route.points[i], point)!) };
                        let clear = true;
                        for (const reduced of [false, true]) for (let i = 0; i <= 24 && clear; i++) {
                            walk.actor.walk(actual, i / 24, walk.land, reduced, 0, optionalFurnitureWalkingYaw(actual, i / 24, reduced));
                            const hull = optionalResidentFootprint(resident.group);
                            clear = circles.every(circle => optionalFootprintClearsCircle(hull, circle)) && bodies.every(body => optionalFootprintsAreSeparate(hull, body));
                            if (clear && i > 0 && i < 24 && i % 6 === 0) { walk.actor.restore(); yield; }
                        }
                        walk.actor.restore();
                        if (clear) return { route: actual, departure };
                    }
                }
                yield;
            }
        }
        return undefined;
    }
    update(now: number, reduced: boolean) {
        const walk = this.walk; if (!walk) return false;
        if (walk.phase === 'preparing') {
            const next = walk.search!.next();
            if (next.done) {
                walk.search = undefined;
                if (!next.value) { walk.phase = 'blocked'; return false; }
                walk.route = next.value.route; walk.departure = next.value.departure;
                walk.phase = walk.departure ? 'departing' : 'walking'; walk.startedAt = now;
                const original = walk.bounds.clone();
                for (const point of walk.route.points) walk.bounds.union(original.clone().translate(new THREE.Vector3(point.x - walk.origin.x, 0, point.z - walk.origin.z)));
                if (walk.departure) walk.bounds.union(walk.departure.bounds);
            }
        }
        if (walk.phase === 'departing') {
            const t = Math.min(1, Math.max(0, (now - walk.startedAt) / (reduced ? 420 : 700)));
            walk.departure!.sample(t);
            if (t >= 1) { walk.phase = 'walking'; walk.startedAt = now; }
        }
        if (walk.phase === 'walking') {
            const t = Math.min(1, Math.max(0, (now - walk.startedAt) / (reduced ? 900 : 1500)));
            walk.actor.walk(walk.route!, t, walk.land, reduced, 0, optionalFurnitureWalkingYaw(walk.route!, t, reduced));
            if (t >= 1) walk.phase = 'settled';
        }
        return this.moving;
    }
    frame(camera: THREE.OrthographicCamera, aspect: number) {
        const walk = this.walk; if (!walk) return false;
        const target = walk.bounds.getCenter(new THREE.Vector3());
        camera.position.copy(target).add(new THREE.Vector3(Math.sin(walk.yaw) * 5, 2.8, Math.cos(walk.yaw) * 5));
        camera.lookAt(target); camera.updateMatrixWorld(true);
        return fitLearningFrame(camera, [walk.bounds], aspect, 3.4);
    }
    describe() {
        const walk = this.walk;
        const feet = walk?.actor.resident.feet.map((foot, i) => {
            const point = expressionFootContact(walk.actor.resident, i);
            return { uuid: foot.uuid, sole: point.toArray(), groundY: residentGroundHeight(point, walk.land) };
        });
        return walk && { requestId: walk.request.id, residentId: walk.request.residentId, residentUuid: walk.actor.resident.group.uuid,
            phase: walk.phase, checked: walk.checked, departureAttempts: walk.departureAttempts, position: walk.actor.resident.group.position.toArray(),
            feet, tail: { uuid: walk.actor.resident.tail.uuid, candidate: walk.actor.resident.tail.userData.visualCandidate, quaternion: walk.actor.resident.tail.quaternion.toArray() },
            departure: walk.departure && { seatId: walk.departure.seatId, seatUuid: walk.departure.seatUuid, support: walk.departure.support,
                landed: (walk.phase === 'walking' || walk.phase === 'settled') && feet!.some(foot => Math.abs(foot.sole[1] - foot.groundY) <= .008), end: walk.departure.end.toArray() },
            route: walk.route?.points.map(point => ({ ...point })) };
    }
    cancel() { this.walk?.search?.return(undefined); this.walk?.actor.restore(); this.walk = undefined; }
    dispose() { this.cancel(); }
}
