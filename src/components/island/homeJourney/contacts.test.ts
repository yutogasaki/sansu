import { expect, it } from 'vitest';
import * as T from 'three';
import { placeHand } from './contacts';

it('aims a fingertip under a transformed resident without moving or distorting its shoulder', () => {
    const resident = new T.Group();
    resident.position.set(.7, .24, .6);
    resident.rotation.y = Math.PI;
    resident.scale.setScalar(.7);
    const shoulder = new T.Group(), hand = new T.Object3D();
    shoulder.position.set(-.2, .7, 0);
    hand.position.set(0, -.334, .026);
    resident.add(shoulder); shoulder.add(hand);
    resident.updateMatrixWorld(true);
    const root = shoulder.getWorldPosition(new T.Vector3());
    for (const target of [new T.Vector3(.45, .91, .3), new T.Vector3(.75, .91, .3)]) {
        shoulder.scale.setScalar(1); shoulder.quaternion.identity(); resident.updateMatrixWorld(true);
        const before=hand.getWorldPosition(new T.Vector3()).distanceTo(target);
        placeHand(shoulder, hand, target);
        expect(hand.getWorldPosition(new T.Vector3()).distanceTo(target)).toBeLessThan(before);
        expect(shoulder.scale.x).toBeGreaterThanOrEqual(.8);
        expect(shoulder.scale.x).toBeLessThanOrEqual(1.25);
        expect(shoulder.getWorldPosition(new T.Vector3()).distanceTo(root)).toBeLessThan(1e-6);
    }
});
