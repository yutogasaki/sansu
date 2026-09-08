import { describe, expect, it } from 'vitest';
import { createIsland, isValidIslandPlacement } from './catalog';
import { createIslandAppearance } from './appearance';
import { getIslandCustomization } from './customization';
import { canonicalIslandExperienceAction, getIslandExperience, hasValidIslandExperience, ISLAND_RESIDENT_PROFILES,
    IslandExperienceConflict, normalizeIslandExperienceName, previewIslandLayout, reduceIslandExperience,
    type IslandExperienceAction, type IslandExperienceState } from './experience';
import { growIslandAfterCompletedSet } from './growth';
import { assertIsland, IslandConflict } from './repository';
import type { IslandRecord } from './types';

const saved = (island = createIsland('child', 0)) => reduceIslandExperience(island, { type: 'save-layout', layoutId: 'slot-1', name: 'はじめの にわ' }, 1);
const invalidState = (value: unknown) => ({ ...createIsland('child', 0), experience: value as IslandExperienceState });
function expectCode(action: () => unknown, code: IslandExperienceConflict['code']) {
    try { action(); throw new Error('Expected an experience conflict'); } catch (error) {
        expect(error).toBeInstanceOf(IslandExperienceConflict);
        expect((error as IslandExperienceConflict).code).toBe(code);
    }
}

describe('optional island experience and supported text', () => {
    it('reads legacy defaults without writes and returns independent resident/layout objects', () => {
        const island = createIsland('child', 0), before = structuredClone(island), defaults = getIslandExperience(island);
        expect(defaults).toMatchObject({ version: 1, islandName: 'わたしの しま', emblem: 'leaf', ambience: 'off', layouts: [] });
        expect(Object.values(defaults.residents).every(resident => resident.look === 'original')).toBe(true);
        defaults.residents.otter.name = 'かわちゃん';
        expect(getIslandExperience(island).residents.otter.name).toBe('カワウソ');
        expect(island).toEqual(before);
        const withLayout = saved(), clone = getIslandExperience(withLayout);
        clone.layouts[0].poses[0].position!.x = 99;
        clone.layouts[0].cosmetics.themeId = 'starry';
        clone.residents.fox.look = 'scarf';
        expect(withLayout.experience!.layouts[0].poses[0].position!.x).not.toBe(99);
        expect(withLayout.experience!.layouts[0].cosmetics.themeId).toBe('moon-garden');
        expect(withLayout.experience!.residents.fox.look).toBe('original');
    });

    it('normalizes Unicode names, counts code points, and preserves markup only as literal text', () => {
        expect(normalizeIslandExperienceName('  か\u3099くの しま　')).toBe('がくの しま');
        expect(normalizeIslandExperienceName('🌟'.repeat(16))).toBe('🌟'.repeat(16));
        expect(normalizeIslandExperienceName('<b>しま</b>')).toBe('<b>しま</b>');
        for (const name of ['', '　 ', '🌟'.repeat(17), 'しま\n', '\tしま', 'し\u202eま', 'し\u0000ま', null, 12]) {
            expectCode(() => normalizeIslandExperienceName(name), 'invalid-name');
        }
    });

    it.each([
        null, { version: 2 }, { islandName: '' }, { islandName: ' name ' }, { emblem: 'unknown' }, { ambience: 'music' },
        { extraVersion: true }, { residents: {} }, { residents: { otter: null, rabbit: {}, fox: {} } }, { layouts: null },
    ])('does not replace invalid or unknown stored formats: %j', fields => {
        const island = invalidState(fields === null ? null : { ...getIslandExperience({}), ...fields });
        expect(hasValidIslandExperience(island)).toBe(false);
        expectCode(() => getIslandExperience(island), 'invalid-state');
        expect(() => assertIsland(island)).toThrow(IslandConflict);
    });

    it('rejects malformed residents and layouts without masking the original data', () => {
        const base = saved().experience!;
        const malformed: unknown[] = [
            { ...base, residents: { ...base.residents, cat: { name: 'ねこ', look: 'original' } } },
            { ...base, residents: { ...base.residents, otter: { name: 'かわちゃん', look: 'hat' } } },
            { ...base, residents: { ...base.residents, otter: { name: 'かわちゃん', look: 'original', points: 1 } } },
            ...[
                { id: 'slot-4' }, { name: ' ' }, { capturedAt: -1 }, { capturedAt: Infinity }, { growth: {} },
                { cosmetics: { themeId: 'unknown', accentId: null } }, { cosmetics: { themeId: 'moon-garden', accentId: null, points: 1 } },
                { poses: [null] }, { poses: [{ id: '', rotation: 0 }] }, { poses: [{ id: 'one', rotation: Infinity }] },
                { poses: [{ id: 'one', rotation: 0, position: null }] }, { poses: [{ id: 'one', rotation: 0, position: { x: NaN, z: 0 } }] },
                { poses: [{ id: 'one', rotation: 0, position: { x: 0, z: 0, y: 1 } }] },
                { poses: [{ id: 'one', rotation: 0, growthLevel: 3 }] },
                { poses: [{ id: 'one', rotation: 0 }, { id: 'one', rotation: 0 }] },
            ].map(fields => ({ ...base, layouts: [{ ...base.layouts[0], ...fields }] })),
            { ...base, layouts: [base.layouts[0], base.layouts[0]] },
            { ...base, layouts: Array(4).fill(base.layouts[0]) },
        ];
        for (const state of malformed) expect(hasValidIslandExperience(invalidState(state))).toBe(false);
        expect(hasValidIslandExperience(invalidState(base))).toBe(true);
    });

    it('canonicalizes every supported action and rejects callers supplying a snapshot or an unknown choice', () => {
        expect(canonicalIslandExperienceAction({ type: 'resident', residentId: 'otter', name: ' かわちゃん ', look: 'scarf' }))
            .toEqual({ type: 'resident', residentId: 'otter', name: 'かわちゃん', look: 'scarf' });
        for (const action of [null, {}, { type: 'emblem', emblem: 'moon' }, { type: 'ambience', ambience: 'rain' },
            { type: 'resident', residentId: 'cat', name: 'ねこ', look: 'original' },
            { type: 'resident', residentId: 'fox', name: 'きつね', look: 'unknown' },
            { type: 'save-layout', layoutId: 'slot-4', name: 'にわ' },
            { type: 'save-layout', layoutId: 'slot-1', name: 'にわ', poses: [] },
            { type: 'rename-island', name: 'にわ', completedSets: 100 },
        ]) expectCode(() => canonicalIslandExperienceAction(action as IslandExperienceAction), 'unknown-action');
    });

    it('changes each expression independently while favorite profiles remain about play, not learning', () => {
        let island = createIsland('child', 0);
        const before = structuredClone(island);
        for (const action of [{ type: 'rename-island', name: 'ひかりの しま' }, { type: 'emblem', emblem: 'wave' },
            { type: 'ambience', ambience: 'brook' }, { type: 'resident', residentId: 'otter', name: 'かわちゃん', look: 'cap' }] as const) {
            island = reduceIslandExperience(island, action, 10);
        }
        expect(island.experience).toMatchObject({ islandName: 'ひかりの しま', emblem: 'wave', ambience: 'brook', residents: { otter: { name: 'かわちゃん', look: 'cap' } } });
        expect({ ...island, experience: undefined }).toEqual({ ...before, experience: undefined });
        expect(Object.fromEntries(Object.entries(ISLAND_RESIDENT_PROFILES).map(([id, profile]) => [id, profile.favoriteItemKind])))
            .toEqual({ otter: 'fountain', rabbit: 'flower', fox: 'lantern' });
    });
});

describe('layout capture and the shared preview/apply reducer', () => {
    it('captures current poses and resolved scene styles in three replaceable slots, with storage represented by absent position', () => {
        let island = createIsland('child', 0);
        island.items[0].position = undefined;
        island.customization = { ...getIslandCustomization(island), points: 7, ownedItemIds: ['moon-garden', 'candy'], themeId: 'candy' };
        for (const layoutId of ['slot-3', 'slot-1', 'slot-2'] as const) island = reduceIslandExperience(island, { type: 'save-layout', layoutId, name: layoutId }, 10);
        expect(island.experience!.layouts.map(layout => layout.id)).toEqual(['slot-1', 'slot-2', 'slot-3']);
        const first = island.experience!.layouts[0];
        expect(first.poses[0]).toEqual({ id: island.items[0].id, rotation: 0 });
        expect(first.cosmetics).toEqual({ themeId: 'candy', accentId: null, appearance: createIslandAppearance('candy', 'legacy-v1') });
        expect(Object.keys(first).sort()).toEqual(['capturedAt', 'cosmetics', 'id', 'name', 'poses', 'sceneStyle']);
        island = reduceIslandExperience(island, { type: 'save-layout', layoutId: 'slot-1', name: 'かえた にわ' }, 11);
        expect(island.experience!.layouts).toHaveLength(3);
        expect(island.experience!.layouts[0]).toMatchObject({ name: 'かえた にわ', capturedAt: 11 });
        const deleted = reduceIslandExperience(island, { type: 'delete-layout', layoutId: 'slot-1' }, 12);
        expect(deleted.experience!.layouts).toHaveLength(2);
        expect(deleted.items).toEqual(island.items);
        expect(deleted.customization).toEqual(island.customization);
        expectCode(() => previewIslandLayout(deleted, 'slot-1'), 'layout-missing');
        expectCode(() => reduceIslandExperience(deleted, { type: 'delete-layout', layoutId: 'slot-1' }, 13), 'layout-missing');
    });

    it('previews exactly the actual apply result, supports simultaneous swaps, and leaves the original untouched', () => {
        const island = saved(), before = structuredClone(island);
        const [a, b] = island.items;
        island.items = [{ ...a, position: b.position }, { ...b, position: a.position }];
        expect(island.items.every(item => isValidIslandPlacement(island, item.id, item.position!, item.rotation))).toBe(true);
        const edited = structuredClone(island), preview = previewIslandLayout(island, 'slot-1');
        expect(preview).toEqual(reduceIslandExperience(island, { type: 'apply-layout', layoutId: 'slot-1' }, 90));
        expect(preview.items.map(item => item.position)).toEqual(before.items.map(item => item.position));
        expect(preview.revision).toBe(edited.revision);
        expect(preview.updatedAt).toBe(edited.updatedAt);
        expect(island).toEqual(edited);
        expect(preview.customization).toBeUndefined(); // Reading/applying the default cannot materialize legacy credit.
    });

    it('preserves later growth, new possessions, pending plans, wallet spending, and histories on restoration', () => {
        let island = saved();
        island.customization = { ...getIslandCustomization(island), points: 8, ownedItemIds: ['moon-garden', 'starry'], themeId: 'starry' };
        for (let set = 1; set <= 6; set++) island = growIslandAfterCompletedSet({ ...island, completedSets: set }, 'garden', set);
        island.pendingPlanId = 'learning-in-progress';
        island.items.push({ id: 'later-earned', kind: 'lantern', rotation: 1 });
        island.items[0] = { ...island.items[0], position: undefined, appearanceLevel: 0 };
        const before = structuredClone(island), restored = previewIslandLayout(island, 'slot-1');
        expect(restored.items[0]).toMatchObject({ position: { x: 1.5, z: .8 }, growthLevel: 3, appearanceLevel: 0 });
        expect(restored.items.find(item => item.id === 'later-earned')).toEqual(before.items.at(-1));
        expect(restored.growth).toEqual(before.growth);
        expect(restored.pendingPlanId).toBe(before.pendingPlanId);
        expect(restored.completedSets).toBe(6);
        expect(restored.customization).toEqual({ ...before.customization, themeId: 'moon-garden', appearance: createIslandAppearance('moon-garden', 'legacy-v1') });
        expect(island).toEqual(before);
    });

    it('refuses collisions with new items, missing old items, unavailable cosmetics and invalid land as whole operations', () => {
        const make = () => { const island = saved(); island.items[0].position = undefined; return island; };
        const cases: [IslandRecord, IslandExperienceConflict['code']][] = [];
        const collision = make(); collision.items.push({ id: 'new', kind: 'flower', rotation: 0, position: { x: 1.5, z: .8 } });
        cases.push([collision, 'layout-collision']);
        const missing = make(); missing.items.splice(0, 1); cases.push([missing, 'layout-item-missing']);
        const unowned = make(); unowned.experience!.layouts[0].cosmetics.themeId = 'starry'; cases.push([unowned, 'cosmetics-not-owned']);
        const unownedAccent = make(); unownedAccent.experience!.layouts[0].cosmetics.accentId = 'candy-flags'; cases.push([unownedAccent, 'cosmetics-not-owned']);
        const outside = make(); outside.experience!.layouts[0].poses[0].position = { x: 99, z: 0 }; cases.push([outside, 'layout-collision']);
        for (const [island, code] of cases) {
            const before = structuredClone(island);
            expectCode(() => previewIslandLayout(island, 'slot-1'), code);
            expectCode(() => reduceIslandExperience(island, { type: 'apply-layout', layoutId: 'slot-1' }, 10), code);
            expect(island).toEqual(before);
        }
    });
});
