import { describe, expect, it } from 'vitest';
import * as T from 'three';
import { createHomeJourneyInterior } from './interior';
import { buildHomeJourney } from './scene';

describe('the growing home and its real interior', () => {
    it.each([0, 9, 33, 45])('keeps the room and camera within the same basic house at %i answers', answers => {
        const content = buildHomeJourney({ version: 1, answers });
        const house = content.world.getObjectByName('home')!;
        const interior = createHomeJourneyInterior(house);
        for (const aspect of [390 / 460, 768 / 540]) {
            expect(interior.update({ completedSets: 5, state: { version: 1, displayed: ['first-completion', 'completed-5'] } }, aspect)).toBe(true);
            expect(interior.room.group.parent).toBe(house);
            house.updateWorldMatrix(true, true);
            const camera = house.worldToLocal(interior.camera.position.clone());
            expect(Math.abs(camera.x)).toBeLessThan(.9);
            expect(camera.y).toBeGreaterThan(0);
            expect(camera.y).toBeLessThan(1.56);
            expect(camera.z).toBeGreaterThan(-1.25);
            expect(camera.z).toBeLessThan(.25);
            expect(interior.room.describe().awards.filter(award => award.visible).map(award => award.id)).toEqual(['first-completion', 'completed-5']);
            const uuid = house.uuid;
            interior.update(undefined, aspect);
            expect(interior.room.group.visible).toBe(false);
            expect(content.world.getObjectByName('home')?.uuid).toBe(uuid);
        }
        interior.dispose(); content.dispose();
    });

    it('never displays an unavailable award and keeps focus on the actual earned object', () => {
        const house = new T.Group(), interior = createHomeJourneyInterior(house);
        interior.update({ completedSets: 1, state: { version: 1, displayed: ['first-completion', 'completed-5'] }, selectedId: 'completed-5' }, 1);
        expect(interior.room.selectedObject()).toBeUndefined();
        expect(interior.room.describe().awards.filter(award => award.visible).map(award => award.id)).toEqual(['first-completion']);
        interior.update({ completedSets: 1, state: { version: 1, displayed: ['first-completion'] }, selectedId: 'first-completion' }, 1);
        expect(interior.room.selectedObject()?.name).toBe('keepsake-first-completion');
        interior.dispose();
        expect(house.children).toHaveLength(0);
    });
});
