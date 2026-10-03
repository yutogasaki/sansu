import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { growingHitTarget } from './growingHitTarget';

function hit(id: string, distance: number, data: Record<string, unknown>): T.Intersection<T.Object3D> {
    const object = new T.Object3D();
    object.name = id;
    object.userData = data;
    return { distance, point: new T.Vector3(), object };
}

describe('growing island tap priority', () => {
    it('preserves the nearest front visible target among friends, trees, home, and owned objects', () => {
        const seedPad = hit('seed-pad', 1, { objectId: 'seed', placementHitOnly: true });
        const backSeedArt = hit('seed-art', 5, { objectId: 'seed' });
        const targets = [
            hit('resident', 2, { actorId: 'resident' }),
            hit('tree', 2, { objectId: 'young-tree' }),
            hit('lord-tree', 2, { objectId: 'lord-tree' }),
            hit('home', 2, { objectId: 'house' }),
            hit('owned-bench', 2, { objectId: 'bench' }),
            hit('bud', 2, { budId: 'bud' }),
        ];
        for (const front of targets) {
            const behind = hit('behind', 3, { objectId: 'behind' });
            expect(growingHitTarget([seedPad, front, behind, backSeedArt], false)).toBe(front);
            expect(growingHitTarget([front, behind], false)).toBe(front);
        }
        const boat = hit('arrival-boat', 2, { boat: 'arrival' });
        expect(growingHitTarget([seedPad, boat, backSeedArt], true)).toBe(boat);
        expect(growingHitTarget([seedPad, boat, backSeedArt], false)).toBe(backSeedArt);
    });

    it('uses an invisible seed target only when no drawn interactive target is hit, with no stale selection', () => {
        const seedPad = hit('seed-pad', 1, { objectId: 'seed', placementHitOnly: true });
        const scenery = hit('scenery', 0.5, {});
        const tree = hit('tree', 2, { objectId: 'tree' });
        expect(growingHitTarget([scenery, seedPad], false)).toBe(seedPad);
        expect(growingHitTarget([scenery, seedPad, tree], false)).toBe(tree);
        // A rebuilt layer supplies a new ray result; no object or last target is cached.
        expect(growingHitTarget([scenery, tree], false)).toBe(tree);
        expect(growingHitTarget([scenery], false)).toBeUndefined();
        expect(growingHitTarget([], false)).toBeUndefined();
    });
});
