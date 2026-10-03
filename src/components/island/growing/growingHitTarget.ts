import type * as T from 'three';

/** A seed's invisible finger target fills gaps, but visible interactive art wins overlaps. */
export function growingHitTarget(hits: readonly T.Intersection<T.Object3D>[], arrivalBoatVisible: boolean) {
    const actionable = hits.filter(hit => {
        const data = hit.object.userData;
        return data.budId || data.boat === 'arrival' && arrivalBoatVisible || data.actorId || data.objectId;
    });
    return actionable.find(hit => !hit.object.userData.placementHitOnly) ?? actionable[0];
}
