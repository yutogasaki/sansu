import { describe, expect, it } from 'vitest';
import { gardenRuntimeAsset } from './runtimeAssetSlots';
import type { LifeItem } from '../../../domain/islandLife/model';
const flower: LifeItem = { id: 'flower', kind: 'flower', cell: { x: 0, z: 2 }, growth: 0, style: 'original' };
describe('generated garden assets preserve gameplay cues', () => {
    it('never shows a fully blooming flowerbed before the actual maturity boundary', () => {
        for (const growth of [0, 1.99, 2, 5.99]) expect(gardenRuntimeAsset({ ...flower, growth }, false)).toBeUndefined();
        expect(gardenRuntimeAsset({ ...flower, growth: 6 }, false)).toBe('flowerbed');
        expect(gardenRuntimeAsset({ ...flower, growth: 5 }, false)).toBeUndefined();
    });
    it('retains purchased colors and the placement preview for both additions', () => {
        for (const kind of ['flower', 'lantern'] as const) {
            const item = { ...flower, kind, growth: 6 };
            expect(gardenRuntimeAsset(item, true)).toBeUndefined();
            for (const style of ['sunshine', 'starlight'] as const) expect(gardenRuntimeAsset({ ...item, style }, false)).toBeUndefined();
        }
        expect(gardenRuntimeAsset({ ...flower, kind: 'lantern' }, false)).toBe('streetlamp');
    });
});
