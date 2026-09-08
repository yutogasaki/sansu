import { describe, expect, it } from 'vitest';
import { canRunLivingActivities, livingCandidates, livingVisitHasSetting, livingVisitsForItem } from './livingActivities';
import type { IslandStageItem, IslandStageState } from './types';

const flower: IslandStageItem = { id: 'flower', kind: 'flower', habitatId: 'garden', growthLevel: 3,
    position: { x: 1.5, z: .8 }, rotation: 0 };
const state: IslandStageState = { items: [flower], completedSets: 24, pulse: 0, learning: false,
    growth: { version: 1, progress: { garden: 6, waterside: 6, grove: 6, village: 6 }, focus: 'garden', memories: [], discoveries: [] } };

describe('living island opportunities', () => {
    it('unlocks actual behaviors at earned stages, independent of old appearances', () => {
        expect(livingVisitsForItem({ ...flower, growthLevel: 0 })).toEqual([]);
        expect(livingVisitsForItem({ ...flower, growthLevel: 1 }).map(visit => visit.discoveryId)).toEqual(['flower-scent']);
        expect(livingVisitsForItem({ ...flower, appearanceLevel: 0 }).map(visit => visit.discoveryId))
            .toEqual(['flower-scent', 'butterfly-visit', 'petal-ripple', 'ribbon-butterfly', 'flower-sharing']);
        expect(livingVisitsForItem({ ...flower, position: undefined })).toEqual([]);
    });
    it('never schedules life while learning, editing, viewing an album, offscreen or in legacy scenes', () => {
        expect(canRunLivingActivities(state)).toBe(true);
        for (const update of [{ learning: true }, { readOnly: true }, { preview: flower }, { growth: undefined }]) {
            expect(canRunLivingActivities({ ...state, ...update })).toBe(false);
        }
        expect(canRunLivingActivities(state, false)).toBe(false);
    });
    it('rotates all opportunities without randomness or a rare time requirement', () => {
        expect([0, 1].map(turn => livingCandidates(state, turn)[0].discoveryId))
            .toEqual(['flower-scent', 'butterfly-visit']);
        expect(livingCandidates(state, 2)[0].discoveryId).toBe('flower-scent');
        expect(state.growth!.discoveries).toEqual([]);
    });
    it('focuses the actual selected district and distinguishes grove lamps from home lamps', () => {
        const lamp: IslandStageItem = { id: 'lamp', kind: 'lantern', habitatId: 'grove', growthLevel: 3,
            position: { x: -5.9, z: -.35 }, rotation: 0 };
        expect(livingVisitsForItem(lamp).map(visit => visit.discoveryId)).toEqual(['lantern-sharing', 'lantern-reflection']);
        expect(livingCandidates({ ...state, items: [flower, lamp], districtFocus: 'west' }, 0)).toEqual([]);
        const seat: IslandStageItem = { id: 'seat', kind: 'mushroom', habitatId: 'grove', growthLevel: 3,
            position: { x: -5.8, z: 1.3 }, rotation: Math.atan2(-.1, -1.65) };
        const visits = livingCandidates({ ...state, items: [flower, lamp, seat], districtFocus: 'west' }, 0);
        expect(visits.some(visit => visit.item.id === lamp.id)).toBe(true);
        expect(visits.every(visit => visit.item.id !== flower.id)).toBe(true);
        expect(livingVisitsForItem({ ...lamp, habitatId: 'village' }).map(visit => visit.discoveryId))
            .toEqual(['home-visit', 'lantern-sharing', 'terrace-time', 'lantern-reflection']);
    });
    it('changes water watching and shade discoveries when furniture is moved or turned', () => {
        const fountain: IslandStageItem = { id: 'water', kind: 'fountain', habitatId: 'waterside', growthLevel: 3,
            position: { x: 3.4, z: 1.3 }, rotation: 0 };
        const swing: IslandStageItem = { id: 'swing', kind: 'swing', habitatId: 'waterside', growthLevel: 3,
            position: { x: 6.2, z: 1.15 }, rotation: Math.atan2(-2.8, .15) };
        const scene = { ...state, items: [fountain, swing], districtFocus: 'east' as const };
        const watching = livingVisitsForItem(swing).find(visit => visit.discoveryId === 'water-gazing')!;
        expect(livingVisitHasSetting(scene, watching)).toBe(true);
        expect(livingVisitHasSetting(scene, { ...watching, item: { ...swing, rotation: swing.rotation + Math.PI } })).toBe(false);
        expect(livingVisitHasSetting({ ...scene, items: [swing] }, watching)).toBe(false);
        expect(livingCandidates(scene, 0).some(visit => visit.item.id === fountain.id)).toBe(true);
        const mushroom: IslandStageItem = { id: 'seat', kind: 'mushroom', habitatId: 'grove', growthLevel: 3,
            position: { x: -5.8, z: 1.3 }, rotation: 0 };
        const resting = livingVisitsForItem(mushroom).find(visit => visit.discoveryId === 'shade-rest')!;
        expect(livingVisitHasSetting(state, resting)).toBe(true);
        expect(livingVisitHasSetting({ ...state, growth: { ...state.growth!, expansionLevel: 1 } }, resting)).toBe(false);
        expect(livingVisitHasSetting({ ...state, completedSets: 6, growth: { ...state.growth!, expansionLevel: 2 } }, resting)).toBe(true);
        expect(livingVisitHasSetting(state, { ...resting, item: { ...mushroom, position: { x: 6.5, z: .5 } } })).toBe(false);
    });
});
