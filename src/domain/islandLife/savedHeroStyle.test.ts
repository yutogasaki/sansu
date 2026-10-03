import { expect, it } from 'vitest';
import { newLife } from './model';
import { savedHeroStyle } from './savedHeroStyle';

it('retains a saved hero outfit while ignoring furniture colors and future commands', () => {
    const record = newLife('kid', 1000);
    record.actions = [
        { id: 'hero', at: 1000, command: { type: 'style', style: 'sunshine' } },
        { id: 'flower', at: 1000, command: { type: 'style', itemId: 'flower', style: 'starlight' } },
        { id: 'future', at: 2000, command: { type: 'style', style: 'starlight' } },
    ];
    const before = structuredClone(record);
    expect(savedHeroStyle(record)).toBe('sunshine'); expect(record).toEqual(before);
    record.now = 2000; expect(savedHeroStyle(record)).toBe('starlight');
    record.actions.push({ id: 'restore', at: 2000, command: { type: 'style', style: 'original' } });
    expect(savedHeroStyle(record)).toBe('original');
});
it('uses the original outfit for a new owner or an island with no outfit commands', () => {
    expect(savedHeroStyle()).toBe('original'); expect(savedHeroStyle(newLife('kid', 1000))).toBe('original');
});
