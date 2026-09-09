import * as T from 'three';
/** Aim the authored fingertip at a target without allowing a body-distorting stretch. */
export function placeHand(shoulder: T.Object3D, hand: T.Object3D, target: T.Vector3) {
    shoulder.updateWorldMatrix(true, true);
    const rest = shoulder.worldToLocal(hand.getWorldPosition(new T.Vector3()));
    const destination = shoulder.parent!.worldToLocal(target.clone()).sub(shoulder.position);
    if (rest.length() < 1e-6 || destination.length() < 1e-6) return;
    shoulder.quaternion.setFromUnitVectors(rest.clone().normalize(), destination.clone().normalize());
    shoulder.scale.setScalar(Math.max(.8,Math.min(1.25,destination.length()/rest.length())));
    shoulder.updateWorldMatrix(true, true);
}
export const HERO_SEATED_CONTACT = .43 - .30 - .07;
