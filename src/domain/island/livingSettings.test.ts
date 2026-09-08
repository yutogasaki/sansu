import { describe, expect, it } from 'vitest';
import { resolveIslandLivingSetting, type IslandLivingScene } from './livingSettings';
import type { IslandItem } from './types';

const fountain = (id: string, x: number, z: number): IslandItem => ({ id, kind: 'fountain', habitatId: 'waterside',
    growthLevel: 1, position: { x, z }, rotation: 0 });
const flower: IslandItem = { id: 'flower', kind: 'flower', habitatId: 'garden', growthLevel: 2, position: { x: 0, z: 0 }, rotation: 0 };
const scene = (items: IslandItem[]): IslandLivingScene => ({ items, completedSets: 24 });

describe('physical living settings', () => {
    it('watches the fountain in front, even when the first fountain is closer behind', () => {
        const swing: IslandItem = { ...flower, id: 'swing', kind: 'swing', habitatId: 'waterside' };
        const state = scene([swing, fountain('behind', 0, -1), fountain('ahead', 0, 2)]);
        expect(resolveIslandLivingSetting(state, swing, 'water-gazing')).toEqual({ sourceItemId: 'swing', supportingItemId: 'ahead', anchor: { x: 0, y: .327, z: 2 } });
        expect(resolveIslandLivingSetting(state, { ...swing, rotation: Math.PI }, 'water-gazing')?.supportingItemId).toBe('behind');
    });
    it('uses distance then stable identity, independent of inventory ordering', () => {
        const a = fountain('a', 1.5, 0), b = fountain('b', -1.5, 0);
        for (const items of [[flower, a, b], [b, flower, a]]) {
            expect(resolveIslandLivingSetting(scene(items), flower, 'petal-ripple')?.supportingItemId).toBe('a');
        }
    });
    it('removes a combination when either growth, proximity or placement is missing', () => {
        const water = fountain('water', 2.9, 0), state = scene([flower, water]);
        expect(resolveIslandLivingSetting(state, flower, 'petal-ripple')).toBeDefined();
        expect(resolveIslandLivingSetting(scene([flower, { ...water, position: { x: 2.91, z: 0 } }]), flower, 'petal-ripple')).toBeUndefined();
        expect(resolveIslandLivingSetting(scene([flower, { ...water, position: undefined }]), flower, 'petal-ripple')).toBeUndefined();
        expect(resolveIslandLivingSetting(scene([flower, { ...water, growthLevel: 0 }]), flower, 'petal-ripple')).toBeUndefined();
        expect(resolveIslandLivingSetting(state, { ...flower, growthLevel: 1 }, 'petal-ripple')).toBeUndefined();
        expect(resolveIslandLivingSetting(state, { ...flower, appearanceLevel: 0 }, 'petal-ripple')).toBeDefined();
    });
    it('reflects actual grove and village lamps and never substitutes a wrong source', () => {
        const water = fountain('water', 2, 0);
        for (const habitatId of ['grove', 'village'] as const) {
            const lamp = { ...flower, kind: 'lantern' as const, habitatId };
            expect(resolveIslandLivingSetting(scene([lamp, water]), lamp, 'lantern-reflection')?.supportingItemId).toBe('water');
        }
        expect(resolveIslandLivingSetting(scene([flower, water]), flower, 'lantern-reflection')).toBeUndefined();
    });
});
