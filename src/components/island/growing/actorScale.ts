import * as T from 'three';
import type { Actor } from './actors';

export const AUTHORED_ACTOR_VISUAL_SCALE = .45;
const seatContacts = new WeakMap<Actor, T.Vector3 | undefined>();
const soleVertices = new WeakMap<T.BufferGeometry, readonly number[]>();
const neutralFeet = new WeakMap<Actor, readonly T.Vector3[]>();

/** Only the visual subtree changes units. The root remains a world-space anchor. */
export function prepareActorVisual(actor: Actor) {
    if (!actor.visual) {
        const visual = new T.Group(); visual.name = 'growing-actor-visual';
        visual.userData.actorId = actor.id;
        if (actor.root.children.length) visual.add(...actor.root.children);
        actor.root.add(visual); actor.visual = visual;
    }
    if (!neutralFeet.has(actor)) neutralFeet.set(actor, actor.feet.map(foot => foot.position.clone()));
    if (!seatContacts.has(actor)) {
        // Capture the actual neutral torso underside once, before any play pose.
        // Central rays exclude the dangling feet and the off-centre tail/arms.
        actor.root.updateWorldMatrix(true, true);
        const origin = actor.body.getWorldPosition(new T.Vector3()); origin.y -= 4;
        const hits = new T.Raycaster(origin, new T.Vector3(0, 1, 0)).intersectObject(actor.body, true);
        const contact = hits[0]?.point;
        seatContacts.set(actor, contact ? actor.body.worldToLocal(contact.clone()) : undefined);
    }
    return actor.visual;
}

export function setActorVisualScale(actor: Actor, scale: number) {
    if (!Number.isFinite(scale) || scale <= 0) throw Error('Actor visual scale must be positive');
    const visual = prepareActorVisual(actor);
    visual.scale.setScalar(scale); resetActorVisualContact(actor);
}

/** Pose contact corrections never become another accumulated scale or world move. */
export function resetActorVisualContact(actor: Actor) {
    actor.visual?.position.set(0, 0, 0);
    neutralFeet.get(actor)?.forEach((at, i) => actor.feet[i]?.position.copy(at));
}

export function actorSeatContact(actor: Actor) {
    const point = seatContacts.get(actor); if (!point) return undefined;
    actor.root.updateWorldMatrix(true, true);
    return point.clone().applyMatrix4(actor.body.matrixWorld);
}

/** Indexed mesh vertices, rather than rotated bounding-box corners, give the sole. */
export function actorFootMinY(actor: Actor) {
    actor.root.updateWorldMatrix(true, true);
    let min = Infinity;
    for (const foot of actor.feet) foot.traverse(object => {
        if (!(object instanceof T.Mesh) || !object.visible) return;
        const geometry = object.geometry;
        let vertices = soleVertices.get(geometry);
        if (!vertices) {
            const position = geometry.getAttribute('position'); if (!position) return;
            const used = geometry.index ? new Set(Array.from(geometry.index.array)) : new Set(Array.from({ length: position.count }, (_, i) => i));
            const values: number[] = [];
            for (const index of used) values.push(position.getX(index), position.getY(index), position.getZ(index));
            vertices = values; soleVertices.set(geometry, vertices);
        }
        const e = object.matrixWorld.elements;
        for (let i = 0; i < vertices.length; i += 3) min = Math.min(min, e[1] * vertices[i] + e[5] * vertices[i + 1] + e[9] * vertices[i + 2] + e[13]);
    });
    return Number.isFinite(min) ? min : undefined;
}

/** Blend only during the existing seat exit; stable poses touch the real surface. */
export function alignActorContact(actor: Actor, footY: number, seatY?: number, seatWeight = 0) {
    if (!actor.visual) return false;
    const foot = actorFootMinY(actor), seat = seatY === undefined ? undefined : actorSeatContact(actor);
    const weight = seat ? Math.max(0, Math.min(1, seatWeight)) : 0;
    const correction = (foot === undefined ? 0 : (footY - foot) * (1 - weight))
        + (seat && seatY !== undefined ? (seatY - seat.y) * weight : 0);
    // Contact moves along world Y even when the root leans with a swing. Moving
    // only along local Y would also move X/Z and leave the sampled seat plane.
    const linear = new T.Matrix3().setFromMatrix4(actor.root.matrixWorld);
    if (!Number.isFinite(correction) || Math.abs(linear.determinant()) < 1e-6 || foot === undefined && !seat) return false;
    actor.visual.position.add(new T.Vector3(0, correction, 0).applyMatrix3(linear.invert()));
    actor.root.updateWorldMatrix(true, true);
    return true;
}

/** A named seat is support; its overhead beam or table top is not a seat. */
export function actorSeatSurface(model: T.Object3D | undefined, kind: 'sit' | 'swing' | 'eat') {
    const name = kind === 'sit' ? 'life-bench-seat' : kind === 'swing' ? 'swing-seat' : 'life-picnic-seat--1';
    const seat = model?.getObjectByName(name);
    return seat instanceof T.Mesh ? seat : undefined;
}

function translateVisualInWorld(actor: Actor, delta: T.Vector3) {
    if (!actor.visual) return;
    const linear = new T.Matrix3().setFromMatrix4(actor.root.matrixWorld);
    if (Math.abs(linear.determinant()) > 1e-6) actor.visual.position.add(delta.applyMatrix3(linear.invert()));
    actor.root.updateWorldMatrix(true, true);
}

/** Keep the torso on the real seat with the small actor's feet tucked on top.
 * This is an authored sitting pose; it changes no mesh, world anchor or rig size.
 */
export function alignActorOnSeat(actor: Actor, seat: T.Mesh, groundY: number, extra = 0, weight = 1) {
    const contact = actorSeatContact(actor); if (!contact) return false;
    seat.updateWorldMatrix(true, true); seat.geometry.computeBoundingBox();
    const bounds = seat.geometry.boundingBox; if (!bounds) return false;
    const remaining = Math.max(0, Math.min(1, weight));
    const top = new T.Vector3(0, bounds.max.y, bounds.max.z - Math.min(.05, (bounds.max.z - bounds.min.z) * .25)).applyMatrix4(seat.matrixWorld);
    translateVisualInWorld(actor, new T.Vector3((top.x - contact.x) * remaining, 0, (top.z - contact.z) * remaining));
    alignActorContact(actor, groundY + extra, top.y + extra, remaining);
    if (remaining === 0) return true;
    const inverse = seat.matrixWorld.clone().invert();
    for (const foot of actor.feet) {
        let minY = Infinity;
        foot.traverse(node => {
            if (!(node instanceof T.Mesh)) return;
            const positions = node.geometry.getAttribute('position'); if (!positions) return;
            const transform = inverse.clone().multiply(node.matrixWorld), point = new T.Vector3();
            for (let i = 0; i < positions.count; i++) {
                point.fromBufferAttribute(positions, i).applyMatrix4(transform); minY = Math.min(minY, point.y);
            }
        });
        if (!Number.isFinite(minY) || minY >= bounds.max.y + .001 || !foot.parent) continue;
        // Lift the same feet onto the seat plane without pushing them away from
        // their body. Seat-local Y follows the actual moving swing's tilt.
        const worldDelta = new T.Vector3(0, (bounds.max.y + .001 - minY) * remaining, 0).applyMatrix3(new T.Matrix3().setFromMatrix4(seat.matrixWorld));
        const parentLinear = new T.Matrix3().setFromMatrix4(foot.parent.matrixWorld);
        if (Math.abs(parentLinear.determinant()) < 1e-6) continue;
        foot.position.add(worldDelta.applyMatrix3(parentLinear.invert()));
        actor.root.updateWorldMatrix(true, true);
    }
    return true;
}

/** Read an actual upward model face; furniture dimensions stay in world units. */
export function actorSurfaceY(model: T.Object3D | undefined, at: Pick<T.Vector3, 'x' | 'z'>) {
    if (!model) return undefined;
    model.updateWorldMatrix(true, true);
    const bounds = new T.Box3().setFromObject(model);
    if (bounds.isEmpty()) return undefined;
    const ray = new T.Raycaster(new T.Vector3(at.x, bounds.max.y + .01, at.z), new T.Vector3(0, -1, 0));
    for (const hit of ray.intersectObject(model, true)) {
        let visible = true;
        for (let node: T.Object3D | null = hit.object; node; node = node.parent) if (!node.visible) { visible = false; break; }
        if (!visible || !hit.face) continue;
        const normal = hit.face.normal.clone().applyNormalMatrix(new T.Matrix3().getNormalMatrix(hit.object.matrixWorld));
        if (normal.y > .5) return hit.point.y;
    }
    return undefined;
}
