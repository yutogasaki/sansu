import * as THREE from 'three';
import type { IslandLandAccess } from '../../../domain/island/catalog';
import type { IslandStageItem } from './types';
import type { SharedJobActor } from './sharedJobActor';
import { residentGroundHeight, residentGroundIsSafe, residentObstacles } from './navigation';
import { optionalFootprintClearsCircle, optionalFootprintsAreSeparate, optionalResidentFootprint } from './optionalFurnitureNavigation';

export interface ExpressionSeat { item: IslandStageItem; group: THREE.Object3D }
interface Piece { mesh: THREE.Mesh; points: THREE.Vector3[] }
interface Transform { object: THREE.Object3D; fromPosition: THREE.Vector3; toPosition: THREE.Vector3; fromQuaternion: THREE.Quaternion; toQuaternion: THREE.Quaternion }
export interface ExpressionDepartureAttempt { distance: number; angle: number; step?: number; reason?: string }
export interface ExpressionDeparture {
    end: THREE.Vector3; bounds: THREE.Box3; seatId: string; seatUuid: string;
    support: { meshUuid: string; point: number[]; normal: number[]; bounds: { min: number[]; max: number[] } };
    sample(t: number): void;
}

/** Batch merges materials, not physical solids. Recover connected pieces so a
 * bench's empty front is not mistaken for its whole enclosing box. Bounds are
 * conservative actual-vertex envelopes; the model and collision never shrink. */
function pieces(group: THREE.Object3D): Piece[] {
    const result: Piece[] = [];
    group.traverseVisible(mesh => {
        if (!(mesh instanceof THREE.Mesh)) return;
        const attr = mesh.geometry.getAttribute('position'), index = mesh.geometry.index;
        const points: THREE.Vector3[] = [], ids: number[] = [], unique = new Map<string, number>(), parents: number[] = [];
        for (let i = 0; i < attr.count; i++) {
            const point = new THREE.Vector3().fromBufferAttribute(attr, i), key = point.toArray().map(v => v.toFixed(5)).join(':');
            let id = unique.get(key);
            if (id === undefined) { id = points.length; points.push(point); unique.set(key, id); parents.push(id); }
            ids.push(id);
        }
        const root = (id: number): number => parents[id] === id ? id : (parents[id] = root(parents[id]));
        for (let i = 0; i < (index?.count ?? attr.count); i += 3) {
            const triangle = [0, 1, 2].map(j => ids[index ? index.getX(i + j) : i + j]);
            for (const id of triangle.slice(1)) parents[root(id)] = root(triangle[0]);
        }
        const groups = new Map<number, THREE.Vector3[]>();
        points.forEach((point, id) => { const key = root(id), list = groups.get(key) ?? []; list.push(point); groups.set(key, list); });
        for (const points of groups.values()) result.push({ mesh, points });
    });
    return result;
}
function boxes(parts: Piece[], inverse: THREE.Matrix4) {
    const point = new THREE.Vector3();
    return parts.map(part => {
        const matrix = inverse.clone().multiply(part.mesh.matrixWorld), box = new THREE.Box3();
        part.points.forEach(value => box.expandByPoint(point.copy(value).applyMatrix4(matrix))); return box;
    });
}
const overlap = (a: THREE.Box3, b: THREE.Box3) => {
    return Math.max(0, Math.min(a.max.x, b.max.x) - Math.max(a.min.x, b.min.x) - .001)
        * Math.max(0, Math.min(a.max.y, b.max.y) - Math.max(a.min.y, b.min.y) - .001)
        * Math.max(0, Math.min(a.max.z, b.max.z) - Math.max(a.min.z, b.min.z) - .001);
};

/** The captured seat contact may already touch the support. Departure can only
 * reduce those initial conservative overlaps, never introduce a new one. Every
 * unrelated obstacle/body remains a full obstacle throughout the short step. */
export function* expressionDepartures(actor: SharedJobActor, seat: ExpressionSeat, items: IslandStageItem[], land: IslandLandAccess,
    obstacles: readonly { x: number; z: number; radius: number }[], bodies: readonly { x: number; z: number }[][], onAttempt?: (attempt: ExpressionDepartureAttempt) => void): Generator<undefined | ExpressionDeparture> {
    const resident = actor.resident, origin = resident.group.position.clone();
    resident.group.updateWorldMatrix(true, true);
    const forward = new THREE.Vector3(0, 0, 1).transformDirection(resident.group.matrixWorld), yaw = Math.atan2(forward.x, forward.z);
    if (!seat.item.position || resident.itemId !== seat.item.id || !['sit', 'rest', 'swing'].includes(resident.action)
        || !['bench', 'mushroom', 'swing'].includes(seat.item.kind)) return;
    seat.group.updateWorldMatrix(true, true); resident.group.updateWorldMatrix(true, true);
    const contact = resident.seatContact.getWorldPosition(new THREE.Vector3()), meshes: THREE.Mesh[] = [];
    seat.group.traverseVisible(object => { if (object instanceof THREE.Mesh) meshes.push(object); });
    const support = new THREE.Raycaster(contact.clone().add(new THREE.Vector3(0, .04, 0)), new THREE.Vector3(0, -1, 0), 0, .09).intersectObjects(meshes, false)[0];
    if (!support || Math.abs(support.point.y - contact.y) > .025) return;
    const supportBounds = new THREE.Box3().setFromObject(support.object, true);
    const supportDescription = { meshUuid: support.object.uuid, point: support.point.toArray(),
        normal: support.face!.normal.clone().transformDirection(support.object.matrixWorld).toArray(),
        bounds: { min: supportBounds.min.toArray(), max: supportBounds.max.toArray() } };
    const inverse = seat.group.matrixWorld.clone().invert(), solids = boxes(pieces(seat.group), inverse), bodyPieces = pieces(resident.group);
    const initialBoxes = boxes(bodyPieces, inverse), initialOverlaps = initialBoxes.map(box => solids.map(solid => overlap(box, solid)));
    const transforms: Transform[] = [];
    resident.group.traverse(object => { if (object !== resident.group) transforms.push({ object, fromPosition: object.position.clone(), toPosition: new THREE.Vector3(),
        fromQuaternion: object.quaternion.clone(), toQuaternion: new THREE.Quaternion() }); });
    actor.pose(origin, yaw);
    transforms.forEach(value => { value.toPosition.copy(value.object.position); value.toQuaternion.copy(value.object.quaternion); }); actor.restore();
    const circles = [...residentObstacles(items, '', seat.item.id), ...obstacles];
    const completeCircles = [...residentObstacles(items, ''), ...obstacles];
    const directions = seat.item.kind === 'mushroom' ? [0, Math.PI / 2, -Math.PI / 2, Math.PI] : [0, Math.PI / 6, -Math.PI / 6, Math.PI / 3, -Math.PI / 3];
    for (const distance of [1.15, 1.4, 1.65]) for (const angle of directions) {
        const end = origin.clone().add(new THREE.Vector3(Math.sin(yaw + angle) * distance, 0, Math.cos(yaw + angle) * distance));
        end.y = residentGroundHeight(end, land);
        // A short continuous step down, including reduced motion, never starts
        // with the old seated root teleported onto the floor inside its bench.
        const sample = (fraction: number) => {
            const t = THREE.MathUtils.clamp(fraction, 0, 1), travel = THREE.MathUtils.clamp((t - .45) / .55, 0, 1);
            const stand = THREE.MathUtils.clamp((t - .25) / .2, 0, 1), lower = THREE.MathUtils.clamp((t - .8) / .2, 0, 1);
            const edge = origin.clone().add(new THREE.Vector3(Math.sin(yaw) * .5, 0, Math.cos(yaw) * .5));
            actor.restore(); resident.group.position.lerpVectors(t < .25 ? origin : edge, t < .25 ? edge : end, t < .25 ? t / .25 : travel);
            resident.group.position.y = THREE.MathUtils.lerp(THREE.MathUtils.lerp(origin.y, support.point.y + .26, stand), end.y, lower);
            transforms.forEach(value => {
                const amount = value.object === resident.tail ? THREE.MathUtils.clamp((t - .9) / .1, 0, 1) : stand;
                value.object.position.lerpVectors(value.fromPosition, value.toPosition, amount);
                value.object.quaternion.slerpQuaternions(value.fromQuaternion, value.toQuaternion, amount);
            });
            resident.group.updateWorldMatrix(true, true);
        };
        const bounds = new THREE.Box3(); let clear = true; const attempt: ExpressionDepartureAttempt = { distance, angle };
        for (let step = 0; step <= 48 && clear; step++) {
            sample(step / 48); const hull = optionalResidentFootprint(resident.group), point = resident.group.position;
            clear = residentGroundIsSafe(point, land) && circles.every(circle => optionalFootprintClearsCircle(hull, circle))
                && bodies.every(body => optionalFootprintsAreSeparate(hull, body));
            if (!clear) { attempt.reason = 'world-body'; attempt.step = step; }
            if (clear) {
                const current = boxes(bodyPieces, inverse);
                clear = current.every((box, i) => solids.every((solid, j) => {
                    const clear = overlap(box, solid) <= initialOverlaps[i][j] + 1e-7;
                    if (!clear) { attempt.reason = `support-mesh:${i}:${j}`; attempt.step = step; } return clear;
                }));
            }
            if (clear && step === 48) { clear = completeCircles.every(circle => optionalFootprintClearsCircle(hull, circle)); if (!clear) { attempt.reason = 'landing-footprint'; attempt.step = step; } }
            bounds.union(new THREE.Box3().setFromObject(resident.group, true));
            // Preflight is optional UI work. Return the original pose between
            // small batches so input/cancellation never waits for a whole arc.
            if (clear && step > 0 && step < 48 && step % 6 === 0) { actor.restore(); yield undefined; }
        }
        actor.restore(); onAttempt?.(attempt);
        yield clear ? { end, bounds, seatId: seat.item.id, seatUuid: seat.group.uuid, support: supportDescription, sample } : undefined;
    }
}
