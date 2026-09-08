import { describe, expect, it } from 'vitest';
import { createIsland } from './catalog';
import { getIslandCustomization } from './customization';
import { getIslandExperience, hasValidIslandExperience, previewIslandLayout, reduceIslandExperience } from './experience';
import { createIslandExpressionSelection, getIslandExpression, ISLAND_EXPRESSION_CATALOG, reduceIslandExpression } from './expression';
import { getIslandGrowthTarget, growIslandAfterCompletedSet } from './growth';
import { hasValidIslandGrowth } from './growthValidation';
import { captureIslandSceneStyle, cloneIslandSceneStyle, hasValidIslandSceneStyle, type IslandSavedSceneStyle, type IslandSavedSceneStyleV2 } from './sceneStyle';
import type { IslandRecord } from './types';

function decorated(): IslandRecord {
    let island = createIsland('child', 0);
    // Explicit ownership fixture: these tests concern immutable captures, not earning qualifications.
    island.expression = { ...getIslandExpression(island), ownedItemIds: ISLAND_EXPRESSION_CATALOG.map(item => item.itemId) };
    island.customization = { ...getIslandCustomization(island), points: 80, desiredItemId: 'candy-complete' };
    island = reduceIslandExperience(island, { type: 'resident', residentId: 'otter', name: 'かわちゃん', look: 'cap' }, 1);
    island = reduceIslandExperience(island, { type: 'emblem', emblem: 'wave' }, 1);
    for (const action of [
        { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' }, { type: 'equip-outfit', residentId: 'fox', itemId: 'star-beret' },
        { type: 'equip-pattern', residentId: 'otter', itemId: 'river-check' }, { type: 'equip-trail', residentId: 'otter', itemId: 'leaf-trail' },
        { type: 'equip-soundscape', itemId: 'shell-three-notes' }, { type: 'equip-album-cover', itemId: 'leaf-album-cover' },
        { type: 'equip-album-stamp', itemId: 'butterfly-stamp' }, { type: 'equip-flag-trim', itemId: 'leaf-bird-flag-trim' },
        { type: 'period', period: 'evening' }, { type: 'season', season: 'autumn' },
    ] as const) island = reduceIslandExpression(island, action);
    return island;
}
const save = (island: IslandRecord) => reduceIslandExperience(island, { type: 'save-layout', layoutId: 'slot-1', name: 'あきの しま' }, 10);
const apply = (island: IslandRecord) => reduceIslandExperience(island, { type: 'apply-layout', layoutId: 'slot-1' }, 11);

describe('versioned confirmed full-scene selection', () => {
    it('captures v2 with all null defaults without materializing old extensions, and clones every nested selection', () => {
        const island = createIsland('child', 0), before = structuredClone(island), captured = captureIslandSceneStyle(island);
        expect(captured).toEqual({ version: 2, residentLooks: { otter: 'original', rabbit: 'original', fox: 'original' },
            ambience: 'off', emblem: 'leaf', expression: createIslandExpressionSelection() });
        expect(island).toEqual(before); expect(island.expression).toBeUndefined(); expect(island.experience).toBeUndefined();
        const original = captureIslandSceneStyle(decorated()), cloned = cloneIslandSceneStyle(original) as IslandSavedSceneStyleV2;
        cloned.residentLooks.otter = 'original'; cloned.expression.residents.otter.pattern = null;
        cloned.expression.environment.season = 'summer'; cloned.expression.album.stamp = null;
        expect(original.residentLooks.otter).toBe('cap'); expect(original.expression.residents.otter.pattern).toBe('river-check');
        expect(original.expression.environment.season).toBe('autumn'); expect(original.expression.album.stamp).toBe('butterfly-stamp');
        expect(Object.keys(original).sort()).toEqual(['ambience', 'emblem', 'expression', 'residentLooks', 'version']);
        expect(Object.keys(original.expression)).not.toContain('ownedItemIds');
    });
    it('validates v1 and v2 strictly and never upgrades an unknown/missing field to defaults', () => {
        const valid = captureIslandSceneStyle(decorated());
        const v1 = { version: 1, residentLooks: valid.residentLooks, ambience: valid.ambience, emblem: valid.emblem } as const;
        expect(hasValidIslandSceneStyle(v1)).toBe(true); expect(cloneIslandSceneStyle(v1)).toEqual(v1);
        const invalid: unknown[] = [null, { ...valid, version: 3 }, { ...v1, expression: valid.expression },
            { ...valid, expression: undefined }, { ...valid, residentLooks: { otter: 'original', rabbit: 'original' } },
            { ...valid, residentLooks: { ...valid.residentLooks, fox: 'raincoat' } }, { ...valid, ambience: 'shell-three-notes' },
            { ...valid, ownedItemIds: ['raincoat'] }, { ...valid, expression: { ...valid.expression, future: true } }];
        for (const style of invalid) {
            expect(hasValidIslandSceneStyle(style)).toBe(false);
            expect(() => cloneIslandSceneStyle(style as IslandSavedSceneStyle)).toThrow();
            const island = save(decorated()); island.experience!.layouts[0].sceneStyle = style as IslandSavedSceneStyle;
            expect(hasValidIslandExperience(island)).toBe(false);
        }
        const corrupt = decorated(); (corrupt.experience as unknown as { version: number }).version = 99;
        expect(() => captureIslandSceneStyle(corrupt)).toThrow();
    });
    it('restores all v2 selection through the exact preview reducer while retaining names, rights, money and later items', () => {
        let island = save(decorated()); const snapshot = structuredClone(island.experience!.layouts[0]);
        island = reduceIslandExperience(island, { type: 'resident-name', residentId: 'otter', name: 'あたらしい なまえ' }, 12);
        for (const action of [{ type: 'equip-outfit', residentId: 'otter', itemId: null }, { type: 'equip-pattern', residentId: 'otter', itemId: 'butterfly-stitch' },
            { type: 'season', season: 'winter' }, { type: 'period', period: 'morning' }, { type: 'equip-album-stamp', itemId: null }] as const) {
            island = reduceIslandExpression(island, action);
        }
        island.customization!.points = 7;
        island.items.push({ id: 'optional-telescope', kind: 'telescope', rotation: 2 });
        const before = structuredClone(island), preview = previewIslandLayout(island, 'slot-1'), applied = apply(island);
        expect(applied).toEqual(preview); expect(island).toEqual(before);
        expect(applied.expression!.selection).toEqual((snapshot.sceneStyle as IslandSavedSceneStyleV2).expression);
        expect(applied.expression!.ownedItemIds).toEqual(before.expression!.ownedItemIds);
        expect(applied.customization!.points).toBe(7); expect(applied.customization!.desiredItemId).toBe('candy-complete');
        expect(applied.experience!.residents.otter.name).toBe('あたらしい なまえ');
        expect(applied.items.at(-1)).toEqual(before.items.at(-1)); expect(applied.growth).toEqual(before.growth);
        expect(applied.experience!.layouts[0]).toEqual(snapshot);
        const copied = getIslandExperience(applied); (copied.layouts[0].sceneStyle as IslandSavedSceneStyleV2).expression.environment.season = null;
        expect(applied.experience!.layouts[0]).toEqual(snapshot);
    });
    it('distinguishes legacy omission, v1 free overrides and explicit v2 nulls', () => {
        const baseline = save(decorated()), omitted = structuredClone(baseline); delete omitted.experience!.layouts[0].sceneStyle;
        expect(apply(omitted).expression).toEqual(omitted.expression);
        const legacy = structuredClone(baseline);
        legacy.experience!.layouts[0].sceneStyle = { version: 1, residentLooks: { otter: 'original', rabbit: 'scarf', fox: 'cap' }, ambience: 'brook', emblem: 'star' };
        const restored = apply(legacy), expected = structuredClone(legacy.expression!);
        for (const id of ['otter', 'rabbit', 'fox'] as const) expected.selection.residents[id].outfit = null;
        expected.selection.soundscape = null;
        expect(restored.expression).toEqual(expected); expect(restored.experience!.ambience).toBe('brook');
        expect(restored.experience!.residents.otter).toEqual({ name: 'かわちゃん', look: 'original' });
        const plain = structuredClone(baseline);
        (plain.experience!.layouts[0].sceneStyle as IslandSavedSceneStyleV2).expression = createIslandExpressionSelection();
        expect(apply(plain).expression!.selection).toEqual(createIslandExpressionSelection());
        const oldBlank = save(createIsland('child', 0));
        expect(apply(oldBlank).expression).toBeUndefined();
    });
    it('does not acquire an item from a snapshot or partially apply a colliding snapshot', () => {
        const missing = save(decorated()); missing.expression!.selection.residents.otter.outfit = null;
        missing.expression!.ownedItemIds = missing.expression!.ownedItemIds.filter(id => id !== 'raincoat');
        const before = structuredClone(missing);
        expect(() => previewIslandLayout(missing, 'slot-1')).toThrowError(expect.objectContaining({ code: 'not-owned' }));
        expect(() => apply(missing)).toThrowError(expect.objectContaining({ code: 'not-owned' }));
        expect(missing).toEqual(before);
        const collision = save(decorated()); collision.items.push({ id: 'late-bench', kind: 'bench', position: { ...collision.items[0].position! }, rotation: 0 });
        expect(() => apply(collision)).toThrowError(expect.objectContaining({ code: 'layout-collision' }));
    });
    it('freezes newly earned growth memories but preserves old omitted memories and the current selection through later learning', () => {
        let island = decorated();
        delete island.growth!.memories[0].sceneStyle;
        const old = structuredClone(island.growth!.memories[0]), selected = captureIslandSceneStyle(island);
        while (island.completedSets < 6) island = growIslandAfterCompletedSet({ ...island, completedSets: island.completedSets + 1 }, getIslandGrowthTarget(island), island.completedSets + 1);
        expect(island.growth!.memories[0]).toEqual(old);
        const latest = island.growth!.memories.at(-1)!;
        expect(latest.sceneStyle).toEqual(selected); expect(latest.completedSets).toBe(6);
        const original = structuredClone(latest);
        island = reduceIslandExpression(island, { type: 'season', season: 'winter' });
        expect(island.growth!.memories.at(-1)).toEqual(original); expect(hasValidIslandGrowth(island)).toBe(true);
        const malformed = structuredClone(island);
        malformed.growth!.memories.at(-1)!.sceneStyle = { ...selected, version: 9 } as unknown as IslandSavedSceneStyleV2;
        expect(hasValidIslandGrowth(malformed)).toBe(false);
        const legacyStyle = { version: 1, residentLooks: selected.residentLooks, ambience: selected.ambience, emblem: selected.emblem };
        malformed.growth!.memories.at(-1)!.sceneStyle = legacyStyle as unknown as IslandSavedSceneStyleV2;
        expect(hasValidIslandGrowth(malformed)).toBe(false);
        const without = createIsland('child', 0), before = structuredClone(without);
        growIslandAfterCompletedSet({ ...without, completedSets: 1 }, 'garden', 1);
        expect(without).toEqual(before); expect(without.expression).toBeUndefined();
    });
});
