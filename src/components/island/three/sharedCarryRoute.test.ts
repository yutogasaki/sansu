import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { sharedCarryRouteIsClear } from './sharedCarryRoute';

// Explicit world-geometry fixture; no progression or UI earning is asserted.
const held = new THREE.Box3(new THREE.Vector3(-.55, .67, -.9), new THREE.Vector3(.55, 1.1, -.1));
const root = new THREE.Vector3();
describe('the carried object has its own swept clearance', () => {
    it('rejects a side obstacle that clears the feet but clips the real tray', () => {
        const route = { points: [{ x: 0, z: 0 }, { x: 0, z: -3 }], yaw: Math.PI };
        expect(sharedCarryRouteIsClear(route, held, root, Math.PI, [{ x: .6, z: -2, radius: .1 }])).toBe(false);
        expect(sharedCarryRouteIsClear(route, held, root, Math.PI, [{ x: 1, z: -2, radius: .1 }])).toBe(true);
    });
    it('checks the actual swept turn, including rotation into the final contact', () => {
        const route = { points: [{ x: 0, z: 0 }, { x: 0, z: -1 }], yaw: Math.PI / 2 };
        expect(sharedCarryRouteIsClear(route, held, root, Math.PI, [{ x: .8, z: -1, radius: .08 }])).toBe(false);
        expect(sharedCarryRouteIsClear(route, held, root, Math.PI, [])).toBe(true);
    });
});
