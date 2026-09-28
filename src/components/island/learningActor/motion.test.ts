import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { ACTOR_CATCH_MS, ACTOR_PLACE_MS, ACTOR_JUMP_MS, ACTOR_LAND_MS, sampleInputGesture, sampleBurstGesture } from './motion';
import { makeLearningActorRig } from './rig';
import { poseLearningActor } from './pose';

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
            expect(sampleBurstGesture(t, true, true)).toEqual({ height: 0, squash: 1, arms: 0, tilt: 0, turn: 0, kick: 0, spread: 0, smile: 0 });
            expect(sampleInputGesture(t, true)).toEqual({ reach: 0, look: 0, follow: 0 });
        }
    });

    it('keeps the original ears and both feet in frame through the jump on compact layouts', () => {
        const rig = makeLearningActorRig();
        try {
            for (const [width, height] of [[184, 192], [145, 150], [100, 110], [94, 98]]) {
                rig.camera.left = -.82 * width / height;
                rig.camera.right = .82 * width / height;
                rig.camera.updateProjectionMatrix();
                for (const big of [false, true]) for (const elapsed of [0, 100, 220, 335, 440, 560, 700, 1100, 1520]) {
                    const pose = sampleBurstGesture(elapsed, true, false, big);
                    poseLearningActor(rig, sampleInputGesture(Infinity, false), pose, -1, 0, big);
                    rig.hero.updateMatrixWorld(true);
                    const bounds = new T.Box3().setFromObject(rig.hero);
                    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
                        const projected = new T.Vector3(x, y, z).project(rig.camera);
                        expect(Math.abs(projected.x)).toBeLessThan(1);
                        expect(Math.abs(projected.y)).toBeLessThan(1);
                    }
                    expect(rig.heroFeet).toHaveLength(2);
                    if (!pose.height) {
                        expect(new T.Box3().setFromObject(rig.heroFeet[0]).min.y).toBeCloseTo(0, 7);
                        expect(new T.Box3().setFromObject(rig.heroFeet[1]).min.y).toBeCloseTo(0, 7);
                    }
                }
            }
        } finally { rig.dispose(); }
    });

    it('bows toward the digit while keeping both feet and the catching paw attached', () => {
        const rig = makeLearningActorRig();
        try {
            const rest = sampleBurstGesture(Infinity, false, false);
            for (const side of [-1, 1]) {
                poseLearningActor(rig, sampleInputGesture(200, false), rest, side, 0, false);
                rig.hero.updateMatrixWorld(true);
                expect(rig.heroBody.rotation.x).toBeGreaterThan(.25);
                expect(new T.Box3().setFromObject(rig.heroFeet[0]).min.y).toBeCloseTo(0, 7);
                expect(new T.Box3().setFromObject(rig.heroFeet[1]).min.y).toBeCloseTo(0, 7);
                const hand = rig.arms[side < 0 ? 0 : 1].hand;
                expect(hand.parent).toBe(rig.arms[side < 0 ? 0 : 1].pivot);
                const atCatch = hand.getWorldPosition(new T.Vector3());
                poseLearningActor(rig, sampleInputGesture(299, false), rest, side, 0, false);
                rig.hero.updateMatrixWorld(true);
                expect(hand.getWorldPosition(new T.Vector3()).distanceTo(atCatch)).toBeLessThan(.000001);
                const bounds = new T.Box3().setFromObject(rig.hero);
                for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
                    const projected = new T.Vector3(x, y, z).project(rig.camera);
                    expect(Math.abs(projected.x)).toBeLessThan(1);
                    expect(Math.abs(projected.y)).toBeLessThan(1);
                }
            }
        } finally { rig.dispose(); }
    });

    it('holds the five-streak smile after landing and restores every neutral face part', () => {
        const rig = makeLearningActorRig();
        try {
            const originals = rig.expression.neutral.map(part => ({ part, geometry: part.geometry, material: part.material, position: part.position.clone(), scale: part.scale.clone() }));
            const small = sampleBurstGesture(335, true, false);
            const big = sampleBurstGesture(335, true, false, true);
            expect(small.kick).toBeGreaterThan(0);
            expect(big.kick).toBe(0);
            expect(big.spread).toBeGreaterThan(small.spread);
            const held = sampleBurstGesture(1050, true, false, true);
            expect(held.height).toBe(0);
            poseLearningActor(rig, sampleInputGesture(Infinity, false), held, -1, 0, true);
            expect(rig.expression.happy.visible).toBe(true);
            expect(rig.expression.neutral.every(part => !part.visible)).toBe(true);
            expect(Math.abs(rig.arms[0].pivot.rotation.z)).toBeGreaterThan(1.5);
            poseLearningActor(rig, sampleInputGesture(Infinity, false), sampleBurstGesture(1520, true, false, true), -1, 0, true);
            expect(rig.expression.happy.visible).toBe(false);
            for (const original of originals) {
                expect(original.part.visible).toBe(true);
                expect(original.part.geometry).toBe(original.geometry);
                expect(original.part.material).toBe(original.material);
                expect(original.part.position.equals(original.position)).toBe(true);
                expect(original.part.scale.equals(original.scale)).toBe(true);
            }
        } finally { rig.dispose(); }
    });
});
