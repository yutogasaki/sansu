import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ACTOR_CATCH_MS, ACTOR_PLACE_MS, ACTOR_JUMP_MS, ACTOR_LAND_MS, sampleInputGesture, sampleBurstGesture } from './motion';
import { makeLearningActorRig } from './rig';

describe('Pokomoko learning contact and ground', () => {
    it('holds the paw between catch and placement, then settles instead of snapping back', () => {
        const caught = sampleInputGesture(ACTOR_CATCH_MS, false);
        expect(caught.reach).toBeGreaterThan(0);
        expect(sampleInputGesture(220, false).reach).toBe(caught.reach);
        expect(sampleInputGesture(ACTOR_PLACE_MS, false).reach).toBe(caught.reach);
        expect(sampleInputGesture(350, false).reach).toBeLessThan(caught.reach);
        expect(sampleInputGesture(350, false).reach).toBeGreaterThan(0);
        expect(sampleInputGesture(620, false).reach).toBe(0);
    });

    it('keeps feet on the ground during anticipation and after landing', () => {
        for (const t of [0, ACTOR_JUMP_MS - 1, ACTOR_LAND_MS, 650, 880])
            expect(sampleBurstGesture(t, true, false).height).toBe(0);
        expect(sampleBurstGesture((ACTOR_JUMP_MS + ACTOR_LAND_MS) / 2, true, false).height).toBeGreaterThan(.1);
        for (let t = 0; t <= 900; t += 30)
            expect(sampleBurstGesture(t, false, false).height).toBe(0);
    });

    it('removes reactive motion entirely with reduced motion', () => {
        for (let t = 0; t <= 900; t += 30) {
            expect(sampleBurstGesture(t, true, true)).toEqual({ height: 0, squash: 1, arms: 0, tilt: 0 });
            expect(sampleInputGesture(t, true)).toEqual({ reach: 0, look: 0, follow: 0 });
        }
    });

    it('keeps the original ears and both feet in frame through the jump on compact layouts', () => {
        const rig = makeLearningActorRig();
        try {
            for (const [width, height] of [[145, 150], [100, 110]]) {
                rig.camera.left = -.82 * width / height;
                rig.camera.right = .82 * width / height;
                rig.camera.updateProjectionMatrix();
                for (const elapsed of [0, 100, 220, 335, 440, 560, 700]) {
                    const pose = sampleBurstGesture(elapsed, true, false);
                    rig.hero.position.y = pose.height;
                    rig.heroBody.scale.y = pose.squash;
                    rig.arms.forEach((arm, index) => { arm.pivot.rotation.z = (index ? 1 : -1) * (.12 + pose.arms); });
                    rig.hero.updateMatrixWorld(true);
                    const bounds = new T.Box3().setFromObject(rig.hero);
                    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
                        const projected = new T.Vector3(x, y, bounds.max.z).project(rig.camera);
                        expect(Math.abs(projected.x)).toBeLessThan(1);
                        expect(Math.abs(projected.y)).toBeLessThan(1);
                    }
                    expect(rig.heroFeet).toHaveLength(2);
                    expect(rig.heroFeet[0].position.y).toBe(rig.heroFeet[1].position.y);
                }
            }
        } finally { rig.dispose(); }
    });
});
