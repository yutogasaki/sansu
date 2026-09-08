import { describe, expect, it } from 'vitest';
import { createIsland } from './catalog';
import { getIslandCustomization } from './customization';
import { canonicalIslandExperienceAction, getIslandExperience, reduceIslandExperience, type IslandExperienceAction } from './experience';
import { canonicalIslandExpressionAction, cloneIslandExpressionSelection, createIslandExpressionSelection, getIslandExpression,
    getIslandExpressionEligibility, hasValidIslandExpression, hasValidIslandExpressionSelection, ISLAND_EXPRESSION_CATALOG,
    IslandExpressionConflict, ownsIslandExpressionSelection, previewIslandExpression, reduceIslandExpression, sameIslandExpressionSelection,
    type IslandExpressionAction, type IslandExpressionEquipAction, type IslandExpressionState } from './expression';
import { ISLAND_AMBIENCES, ISLAND_RESIDENT_IDS, ISLAND_RESIDENT_LOOKS } from './residentIdentity';
import type { IslandRecord } from './types';
import { reduceIslandWorkshop, WORKSHOP_SPECIMENS, WORKSHOP_SPECIMEN_IDS, workshopLayoutKey } from './workshop';

function wallet(points = 100): IslandRecord {
    const island = createIsland('child', 0);
    return { ...island, customization: { ...getIslandCustomization(island), points, desiredItemId: 'candy-complete' } };
}
const act = (island: IslandRecord, action: IslandExpressionAction) => reduceIslandExpression(island, action);
const experience = (island: IslandRecord, action: IslandExperienceAction) => reduceIslandExperience(island, action, 10);
function completedBell() {
    let island = { ...createIsland('child', 0), completedSets: 1 };
    let now = 0;
    for (const specimenId of WORKSHOP_SPECIMEN_IDS) {
        for (let section = 0; section < 6; section++) island = reduceIslandWorkshop(island, { type: 'brush', specimenId, section }, ++now);
        for (const result of ['clean', WORKSHOP_SPECIMENS[specimenId].identityResult] as const) {
            island = reduceIslandWorkshop(island, { type: 'observe-specimen', specimenId, result, cleanedMask: 63 }, ++now);
        }
    }
    for (const [col, partId] of (['straight', 'wheel', 'bell'] as const).entries()) {
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'assemble', partId } }, ++now);
        island = reduceIslandWorkshop(island, { type: 'edit-draft', edit: { type: 'move', partId, position: { col, row: 1 } } }, ++now);
    }
    return { island, now };
}

describe('finite expression acquisition and confirmed qualifications', () => {
    it('has exactly six star purchases totaling 85 and four independent zero-star observation acquisitions', () => {
        expect(ISLAND_EXPRESSION_CATALOG.map(item => [item.itemId, item.price])).toEqual([
            ['raincoat', 25], ['star-beret', 20], ['river-check', 10], ['butterfly-stitch', 0], ['leaf-trail', 10],
            ['water-ring-trail', 15], ['shell-three-notes', 0], ['leaf-album-cover', 5], ['butterfly-stamp', 0], ['leaf-bird-flag-trim', 0],
        ]);
        expect(ISLAND_EXPRESSION_CATALOG.reduce((total, item) => total + item.price, 0)).toBe(85);
        expect(ISLAND_EXPRESSION_CATALOG.filter(item => item.requirement)).toHaveLength(4);
        let island = wallet(85); const before = structuredClone(island);
        for (const item of [...ISLAND_EXPRESSION_CATALOG].reverse()) if (item.price) island = act(island, { type: 'acquire', itemId: item.itemId });
        expect(island.customization).toEqual({ ...before.customization, points: 0 });
        expect(island.expression!.ownedItemIds).toEqual(['raincoat', 'star-beret', 'river-check', 'leaf-trail', 'water-ring-trail', 'leaf-album-cover']);
        expect(island.expression!.selection).toEqual(createIslandExpressionSelection());
        expect(island.items).toEqual(before.items); expect(island.growth).toEqual(before.growth);
        expect(island.experience).toBeUndefined(); expect(island.revision).toBe(before.revision);
        expect(() => act(island, { type: 'acquire', itemId: 'raincoat' })).toThrowError(expect.objectContaining({ code: 'already-owned' }));
        expect(() => act(wallet(24), { type: 'acquire', itemId: 'raincoat' })).toThrowError(expect.objectContaining({ code: 'insufficient-stars' }));
    });
    it('reads detached defaults, keeps old absence, and gives each resident an independent selection', () => {
        const island = createIsland('child', 0), before = structuredClone(island), state = getIslandExpression(island);
        state.selection.residents.otter.outfit = 'raincoat'; state.ownedItemIds.push('raincoat');
        expect(state.selection.residents.rabbit.outfit).toBeNull();
        expect(getIslandExpression(island)).toEqual({ version: 1, ownedItemIds: [], selection: createIslandExpressionSelection() });
        expect(island).toEqual(before); expect(island.expression).toBeUndefined();
    });
    it('uses old saved butterfly and bird observations as eligibility without automatically granting either product', () => {
        const island = createIsland('child', 0);
        for (const itemId of ['butterfly-stitch', 'butterfly-stamp', 'leaf-bird-flag-trim'] as const) {
            expect(getIslandExpressionEligibility(island, itemId).eligible).toBe(false);
            expect(() => act(island, { type: 'acquire', itemId })).toThrowError(expect.objectContaining({ code: 'not-eligible' }));
        }
        // Explicit old-record fixture: qualification is the already saved observation, not a new encounter or clock.
        island.growth!.discoveries = ['ribbon-butterfly', 'leaf-bird'].map(id => ({ id, itemId: island.items[0].id, discoveredAt: 1 }));
        const before = structuredClone(island);
        expect(getIslandExpressionEligibility(island, 'butterfly-stamp')).toEqual({ eligible: true });
        expect(getIslandExpressionEligibility(island, 'leaf-bird-flag-trim')).toEqual({ eligible: true });
        expect(island).toEqual(before); expect(island.expression).toBeUndefined();
        const stitch = act(island, { type: 'acquire', itemId: 'butterfly-stitch' });
        expect(stitch.expression!.ownedItemIds).toEqual(['butterfly-stitch']);
        expect(stitch.customization).toBeUndefined(); expect(stitch.expression!.selection).toEqual(createIslandExpressionSelection());
        expect(stitch.growth).toEqual(before.growth);
    });
    it('requires the saved visible bell result even after all parts connect, and permits it with ambience off', () => {
        const { island, now } = completedBell();
        expect(getIslandExpressionEligibility(island, 'shell-three-notes')).toEqual({ eligible: false, reason: 'bell' });
        expect(() => act(island, { type: 'acquire', itemId: 'shell-three-notes' })).toThrowError(expect.objectContaining({ code: 'not-eligible' }));
        const observed = reduceIslandWorkshop(island, { type: 'observe-creation', partId: 'bell', layoutKey: workshopLayoutKey(island.workshop!.draftCheckpoint.draft.layout) }, now + 1);
        expect(getIslandExperience(observed).ambience).toBe('off');
        const acquired = act(observed, { type: 'acquire', itemId: 'shell-three-notes' });
        expect(acquired.workshop).toEqual(observed.workshop); expect(acquired.expression!.selection.soundscape).toBeNull();
        expect(act(acquired, { type: 'equip-soundscape', itemId: 'shell-three-notes' }).expression!.selection.soundscape).toBe('shell-three-notes');
    });
});

describe('strict selection, free trials and explicit equipment', () => {
    it('previews each item in only its target slot, then owned equip uses the same selection without consuming ownership', () => {
        const actions: IslandExpressionEquipAction[] = [
            { type: 'equip-outfit', residentId: 'otter', itemId: 'raincoat' }, { type: 'equip-outfit', residentId: 'rabbit', itemId: 'star-beret' },
            { type: 'equip-pattern', residentId: 'fox', itemId: 'river-check' }, { type: 'equip-pattern', residentId: 'rabbit', itemId: 'butterfly-stitch' },
            { type: 'equip-trail', residentId: 'otter', itemId: 'leaf-trail' }, { type: 'equip-trail', residentId: 'fox', itemId: 'water-ring-trail' },
            { type: 'equip-soundscape', itemId: 'shell-three-notes' }, { type: 'equip-album-cover', itemId: 'leaf-album-cover' },
            { type: 'equip-album-stamp', itemId: 'butterfly-stamp' }, { type: 'equip-flag-trim', itemId: 'leaf-bird-flag-trim' },
        ];
        const island = wallet(), before = structuredClone(island);
        const owned = { ...island, expression: { ...getIslandExpression(island), ownedItemIds: ISLAND_EXPRESSION_CATALOG.map(item => item.itemId) } };
        for (const action of actions) {
            const preview = previewIslandExpression(island, action);
            expect(Object.keys(preview).sort()).toEqual(['action', 'selection']);
            expect(() => act(island, action)).toThrowError(expect.objectContaining({ code: 'not-owned' }));
            const equipped = act(owned, action);
            expect(equipped.expression!.selection).toEqual(preview.selection);
            expect(equipped.expression!.ownedItemIds).toEqual(owned.expression.ownedItemIds);
            expect(equipped.customization).toEqual(owned.customization);
        }
        expect(island).toEqual(before);
        expect(() => previewIslandExpression(island, { type: 'acquire', itemId: 'raincoat' } as unknown as IslandExpressionEquipAction)).toThrow(IslandExpressionConflict);
    });
    it('allows every free day period and season with no wallet and cancels to the explicit null defaults', () => {
        let island = createIsland('child', 0);
        for (const period of ['morning', 'day', 'evening', null] as const) for (const season of ['spring', 'summer', 'autumn', 'winter', null] as const) {
            island = act(act(island, { type: 'period', period }), { type: 'season', season });
            expect(island.expression!.selection.environment).toEqual({ period, season });
            expect(island.expression!.ownedItemIds).toEqual([]); expect(island.customization).toBeUndefined();
        }
        expect(island.expression!.selection).toEqual(createIslandExpressionSelection());
    });
    it('rejects missing, unknown, misplaced, sparse and unowned fields without silently replacing their state', () => {
        const base = getIslandExpression({}), selection = createIslandExpressionSelection();
        const malformed: unknown[] = [null, { ...base, version: 2 }, { ...base, ownedItemIds: ['unknown'] }, { ...base, extra: 1 },
            { ...base, ownedItemIds: ['raincoat', 'raincoat'] }, { ...base, ownedItemIds: ['star-beret', 'raincoat'] }, { ...base, ownedItemIds: new Array(1) },
            { ...base, ownedItemIds: ISLAND_EXPRESSION_CATALOG.map(item => item.itemId).concat('raincoat') },
            { ...base, selection: { ...selection, version: 2 } }, { ...base, selection: { ...selection, flagTrim: undefined } },
            { ...base, selection: { ...selection, album: { cover: 'raincoat', stamp: null } } },
            { ...base, selection: { ...selection, residents: { ...selection.residents, otter: { outfit: 'raincoat', pattern: null, trail: null } } } },
            { ...base, selection: { ...selection, residents: { ...selection.residents, fox: { outfit: null, pattern: null, trail: null, name: 'こん' } } } },
        ];
        for (const value of malformed) {
            const island = { ...wallet(), expression: value as IslandExpressionState }, before = structuredClone(island);
            expect(hasValidIslandExpression(island)).toBe(false);
            expect(() => getIslandExpression(island)).toThrow(IslandExpressionConflict);
            expect(() => act(island, { type: 'period', period: 'day' })).toThrow(IslandExpressionConflict);
            expect(island).toEqual(before);
        }
        expect(hasValidIslandExpressionSelection({ ...selection, residents: {} })).toBe(false);
        expect(ownsIslandExpressionSelection([], { ...selection, soundscape: 'shell-three-notes' })).toBe(false);
    });
    it('canonicalizes equivalent property order and rejects extra fields or invalid action targets', () => {
        expect(canonicalIslandExpressionAction({ itemId: 'raincoat', residentId: 'fox', type: 'equip-outfit' }))
            .toEqual({ type: 'equip-outfit', residentId: 'fox', itemId: 'raincoat' });
        for (const action of [null, { type: 'acquire', itemId: 'raincoat', price: 0 }, { type: 'equip-outfit', residentId: 'otter', itemId: 'river-check' },
            { type: 'equip-trail', residentId: 'other', itemId: 'leaf-trail' }, { type: 'equip-soundscape', itemId: 'off' }, { type: 'season', season: 'today' },
            { type: 'period' }, { type: 'equip-pattern', residentId: 'otter' }]) expect(() => canonicalIslandExpressionAction(action)).toThrow(IslandExpressionConflict);
        const a = createIslandExpressionSelection(), b = createIslandExpressionSelection();
        b.residents.otter = { trail: null, pattern: null, outfit: null };
        expect(sameIslandExpressionSelection(a, b)).toBe(true);
        const cloned = cloneIslandExpressionSelection(a); cloned.residents.otter.pattern = 'river-check';
        expect(a.residents.otter.pattern).toBeNull();
    });
});

describe('free choices are authoritative over acquired overrides', () => {
    it.each(ISLAND_RESIDENT_IDS)('preserves %s outfit when naming and clears only its outfit on any explicit free look', residentId => {
        let island = act(act(wallet(), { type: 'acquire', itemId: 'raincoat' }), { type: 'acquire', itemId: 'river-check' });
        island = act(island, { type: 'equip-pattern', residentId, itemId: 'river-check' });
        for (const look of ISLAND_RESIDENT_LOOKS) {
            island = experience(island, { type: 'resident-look', residentId, look });
            island = act(island, { type: 'equip-outfit', residentId, itemId: 'raincoat' });
            island = experience(island, { type: 'resident-name', residentId, name: ' か\u3099く ' });
            expect(island.experience!.residents[residentId]).toEqual({ name: 'がく', look });
            expect(island.expression!.selection.residents[residentId].outfit).toBe('raincoat');
            const restored = experience(island, { type: 'resident-look', residentId, look });
            expect(restored.expression!.selection.residents[residentId]).toEqual({ outfit: null, pattern: 'river-check', trail: null });
            expect(restored.expression!.ownedItemIds).toEqual(['raincoat', 'river-check']);
        }
        const legacy = experience(island, { type: 'resident', residentId, name: 'ともだち', look: 'cap' });
        expect(legacy.expression!.selection.residents[residentId].outfit).toBeNull();
        expect(legacy.expression!.selection.residents[residentId].pattern).toBe('river-check');
    });
    it.each(ISLAND_AMBIENCES)('choosing free %s clears the collected sound even when that fallback already has the same value', ambience => {
        let island = wallet(); island.expression = { ...getIslandExpression(island), ownedItemIds: ['shell-three-notes'] };
        island = experience(island, { type: 'ambience', ambience });
        island = act(island, { type: 'equip-soundscape', itemId: 'shell-three-notes' });
        const updated = experience(island, { type: 'ambience', ambience });
        expect(updated.experience!.ambience).toBe(ambience); expect(updated.expression!.selection.soundscape).toBeNull();
        expect(updated.expression!.ownedItemIds).toEqual(['shell-three-notes']);
    });
    it('keeps optional expression absent for free legacy settings and validates each narrow name/look action', () => {
        let island = createIsland('child', 0);
        for (const action of [{ type: 'ambience', ambience: 'off' }, { type: 'resident-look', residentId: 'otter', look: 'original' },
            { type: 'resident-name', residentId: 'otter', name: 'かわちゃん' }, { type: 'resident', residentId: 'fox', name: 'こん', look: 'scarf' }] as const) {
            island = experience(island, action); expect(island.expression).toBeUndefined();
        }
        expect(() => canonicalIslandExperienceAction({ type: 'resident-name', residentId: 'otter', name: '' })).toThrow();
        expect(() => canonicalIslandExperienceAction({ type: 'resident-look', residentId: 'otter', look: 'raincoat' } as unknown as IslandExperienceAction)).toThrow();
    });
});
