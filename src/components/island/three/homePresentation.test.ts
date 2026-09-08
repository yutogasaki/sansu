import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { IslandHomePresentation, ISLAND_HOME_INTERIOR } from './homePresentation';
import { IslandLearningKeepsakeScenery } from './learningKeepsakeScenery';

describe('the house stays in the same island', () => {
    it('interpolates the outdoor camera to its authored destination and respects reduced motion', () => {
        const presentation = new IslandHomePresentation(), camera = new THREE.OrthographicCamera(-10, 10, 8, -8, .1, 100);
        camera.position.set(5, 9, 14); presentation.begin(camera, 100, false);
        camera.position.set(-2, 1, -1); camera.left = -1; camera.right = 1;
        expect(presentation.animate(camera, 100, false)).toBe(true); expect(camera.position.toArray()).toEqual([5, 9, 14]);
        expect(presentation.animate(camera, 360, false)).toBe(true); expect(camera.position.x).toBeCloseTo(1.5);
        expect(presentation.animate(camera, 620, false)).toBe(false); expect(camera.position.toArray()).toEqual([-2, 1, -1]);
        expect(camera.left).toBe(-1); expect(camera.right).toBe(1);
        presentation.begin(camera, 800, true); camera.position.set(5, 9, 14);
        expect(presentation.animate(camera, 800, true)).toBe(false); expect(camera.position.toArray()).toEqual([5, 9, 14]);
    });
    it('places the actual interior and selected award inside the existing cottage footprint', () => {
        const room = new IslandLearningKeepsakeScenery(); room.group.position.set(...ISLAND_HOME_INTERIOR.position);
        room.group.scale.setScalar(ISLAND_HOME_INTERIOR.scale);
        try {
            room.update({ version: 1, displayed: ['first-completion'] }, 1, true);
            const bounds = new THREE.Box3().setFromPoints(room.framePoints(null));
            expect(bounds.min.x).toBeGreaterThan(-3.6); expect(bounds.max.x).toBeLessThan(-1.6);
            expect(bounds.min.z).toBeGreaterThan(-2.4); expect(bounds.max.z).toBeLessThan(-.9);
            const award = room.describe().awards.find(item => item.id === 'first-completion')!;
            expect(bounds.containsPoint(new THREE.Vector3(...award.position))).toBe(true);
            const close = room.frameView('first-completion');
            expect(bounds.containsPoint(new THREE.Vector3(...close.target))).toBe(true);
            expect(room.group.getObjectByName('home-album')).toBeDefined();
            expect(room.group.getObjectByName('home-notice-board')).toBeDefined();
        } finally { room.dispose(); }
    });
    it('cancels a pending camera transition on disposal without applying a stale destination', () => {
        const presentation = new IslandHomePresentation(), camera = new THREE.OrthographicCamera(-4, 4, 3, -3, .1, 100);
        camera.position.set(4, 5, -10); presentation.begin(camera, 0, false);
        camera.position.set(2, 3, 4); camera.lookAt(0, 1, 0); camera.updateMatrixWorld(true);
        const before = [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements];
        presentation.dispose(); presentation.dispose();
        expect(presentation.animate(camera, 100, false)).toBe(false);
        expect([...camera.matrixWorld.elements, ...camera.projectionMatrix.elements]).toEqual(before);
    });
});
