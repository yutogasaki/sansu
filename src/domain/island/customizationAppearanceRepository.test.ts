import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { getIslandCustomization, getIslandCosmetics, hasIslandCustomizationItem, quoteIslandCustomization } from './customization';
import { customizeIsland } from './customizationRepository';
import { saveIslandExperience } from './experienceRepository';
import { getIslandExperience } from './experience';
import { IslandConflict, openIsland, startIslandPlan } from './repository';
import type { IslandEvent } from './types';

const options = { indexedDB, IDBKeyRange }, databases: SansuDatabase[] = [];
async function setup() {
    const d = new SansuDatabase(`island-appearance-${crypto.randomUUID()}`, options);
    databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await openIsland('child', d);
    await startIslandPlan('child', d);
    const island = (await d.islands.get('child'))!;
    // A wallet-only unit fixture; the active learning reservation remains the ordinary planner's output.
    island.customization = { ...getIslandCustomization(island), points: 300 };
    await d.islands.put(island);
    return d;
}
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
async function nonAppearance(d: SansuDatabase) {
    const state = await snapshot(d);
    delete state.islands;
    state.islandEvents = (state.islandEvents as IslandEvent[]).filter(event => !['customization_changed', 'experience_changed'].includes(event.type));
    return state;
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('part ownership and full-scene native persistence', () => {
    it('saves only the chosen application slot and preserves every learning/photo/workshop table across reload', async () => {
        const d = await setup(), initial = await current(d), learning = await nonAppearance(d);
        const bought = await customizeIsland('child', initial.revision, { type: 'purchase', itemId: 'candy-house', slot: 'houseRoof' }, d);
        expect(bought.customization!.points).toBe(275);
        expect(bought.customization!.appearance!.slots.houseRoof).toBe('parts-v1:candy:houseRoof');
        expect(bought.customization!.appearance!.slots.houseWindows).toBe('legacy-v1:moon-garden:houseWindows');
        expect(bought.items).toEqual(initial.items);
        expect(bought.growth).toEqual(initial.growth);
        expect(bought.pendingPlanId).toBe(initial.pendingPlanId);
        const received = await customizeIsland('child', bought.revision, { type: 'purchase', itemId: 'candy-complete' }, d);
        expect(received.customization!.points).toBe(180);
        expect(hasIslandCustomizationItem(received, 'candy')).toBe(true);
        expect(quoteIslandCustomization(received, 'candy-house').price).toBe(0);
        d.close(); await d.open();
        expect(await openIsland('child', d)).toEqual(received);
        expect(await nonAppearance(d)).toEqual(learning);
    });
    it('native abort after island writes rolls back the entire set, wallet and receipt, then the same intent succeeds', async () => {
        const d = await setup(), island = await current(d), before = await snapshot(d);
        const intent = { type: 'purchase' as const, itemId: 'crystal-complete' as const };
        let aborted = false;
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'customization_changed') { aborted = true; transaction.idbtrans.abort(); }
        };
        d.islandEvents.hook('creating', abort);
        await expect(customizeIsland('child', island.revision, intent, d)).rejects.toThrow();
        d.islandEvents.hook('creating').unsubscribe(abort);
        expect(aborted).toBe(true);
        expect(await snapshot(d)).toEqual(before);
        const result = await customizeIsland('child', island.revision, intent, d);
        expect(result.customization!.points).toBe(125);
        expect(quoteIslandCustomization(result, 'crystal-complete').price).toBe(0);
        expect(await d.islandEvents.where('type').equals('customization_changed').count()).toBe(1);
    });
    it('a lost committed response replays its original receipt before quoting against newer grants or equipment', async () => {
        const d = await setup(), island = await current(d), second = new SansuDatabase(d.name, options);
        await second.open();
        const intent = { type: 'purchase' as const, itemId: 'starry-house' as const, slot: 'houseRoof' as const };
        try {
            // The writer commits normally; the caller never receives its completion value.
            await expect(customizeIsland('child', island.revision, intent, d).then(() => { throw new Error('response lost'); })).rejects.toThrow('response lost');
            let newest = await current(d);
            newest = await customizeIsland('child', newest.revision, { type: 'purchase', itemId: 'starry-complete' }, second);
            newest = await customizeIsland('child', newest.revision, { type: 'restore-part', partId: 'house', slot: 'houseRoof' }, second);
            const before = await snapshot(d);
            expect(await customizeIsland('child', island.revision, intent, d)).toEqual(newest);
            expect(await snapshot(d)).toEqual(before);
            expect(newest.customization!.points).toBe(225);
            expect(newest.customization!.appearance!.slots.houseRoof).toBe('legacy-v1:moon-garden:houseRoof');
            await expect(customizeIsland('child', island.revision, { ...intent, slot: 'houseWindows' }, d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toEqual(before);
        } finally { second.close(); }
    });
    it('keeps an actual old theme receipt valid without repainting the legacy scene or charging again', async () => {
        const d = await setup(), island = await current(d), revision = island.revision;
        const legacy = { ...island, revision: revision + 1, customization: { ...getIslandCustomization(island), points: 240,
            themeId: 'starry' as const, ownedItemIds: ['moon-garden', 'starry'] as ('moon-garden' | 'starry')[] } };
        await d.islands.put(legacy);
        await d.islandEvents.add({ id: JSON.stringify(['island-customization-v1', 'child', revision]), profileId: 'child', type: 'customization_changed',
            timestamp: 1, action: { type: 'purchase', itemId: 'starry' } });
        const before = await snapshot(d);
        expect(await customizeIsland('child', revision, { itemId: 'starry', type: 'purchase' }, d)).toEqual(legacy);
        expect((await current(d)).customization!.appearance).toBeUndefined();
        expect(await snapshot(d)).toEqual(before);
    });
    it('serializes a part and its enclosing set across tabs, with a deliberate new-revision retry charging only the remainder', async () => {
        const d = await setup(), island = await current(d), second = new SansuDatabase(d.name, options);
        await second.open();
        try {
            const actions = [{ type: 'purchase', itemId: 'starry-water' }, { type: 'purchase', itemId: 'starry-complete' }] as const;
            const results = await Promise.allSettled(actions.map((action, index) => customizeIsland('child', island.revision, action, index ? second : d)));
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            const failed = results.findIndex(result => result.status === 'rejected');
            expect(failed).toBeGreaterThanOrEqual(0);
            const latest = await current(d);
            const final = await customizeIsland('child', latest.revision, actions[failed], d);
            expect(final.customization!.points).toBe(225);
            expect(hasIslandCustomizationItem(final, 'starry-complete')).toBe(true);
            expect(await d.islandEvents.where('type').equals('customization_changed').count()).toBe(2);
        } finally { second.close(); }
    });
    it('binds a full-scene receipt to its first capture through later overwrite, deletion and retry', async () => {
        const d = await setup();
        let island = await current(d);
        island = await customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry-house', slot: 'houseWindows' }, d);
        island = await saveIslandExperience('child', island.revision, { type: 'resident', residentId: 'fox', name: 'こん', look: 'cap' }, d);
        const revision = island.revision, action = { type: 'save-layout' as const, layoutId: 'slot-1' as const, name: 'さいしょの けしき' };
        await expect(saveIslandExperience('child', revision, action, d).then(() => { throw new Error('capture response lost'); })).rejects.toThrow();
        const firstCapture = structuredClone((await current(d)).experience!.layouts[0]);
        island = await current(d);
        island = await customizeIsland('child', island.revision, { type: 'purchase', itemId: 'candy-house', slot: 'houseWindows' }, d);
        island = await saveIslandExperience('child', island.revision, { type: 'resident', residentId: 'fox', name: 'いまの こん', look: 'scarf' }, d);
        const later = await saveIslandExperience('child', island.revision, { ...action, name: 'いまの けしき' }, d);
        const overwritten = await snapshot(d);
        expect(await saveIslandExperience('child', revision, action, d)).toEqual(later);
        expect(await snapshot(d)).toEqual(overwritten);
        expect(firstCapture.cosmetics.appearance!.slots.houseWindows).toBe('parts-v1:starry:houseWindows');
        expect(firstCapture.sceneStyle!.residentLooks.fox).toBe('cap');
        const deleted = await saveIslandExperience('child', later.revision, { type: 'delete-layout', layoutId: 'slot-1' }, d);
        const afterDeletion = await snapshot(d);
        expect(await saveIslandExperience('child', revision, action, d)).toEqual(deleted);
        expect(getIslandExperience(await current(d)).layouts).toHaveLength(0);
        expect(await snapshot(d)).toEqual(afterDeletion);
    });
    it('native abort of scene apply rolls back outfits, sound, emblem and cosmetic slots together', async () => {
        const d = await setup();
        let island = await current(d);
        island = await customizeIsland('child', island.revision, { type: 'purchase', itemId: 'starry-complete' }, d);
        island = await saveIslandExperience('child', island.revision, { type: 'ambience', ambience: 'brook' }, d);
        island = await saveIslandExperience('child', island.revision, { type: 'emblem', emblem: 'flower' }, d);
        island = await saveIslandExperience('child', island.revision, { type: 'resident', residentId: 'rabbit', name: 'うさ', look: 'cap' }, d);
        island = await saveIslandExperience('child', island.revision, { type: 'save-layout', layoutId: 'slot-1', name: 'ほしの けしき' }, d);
        const remembered = structuredClone(island.experience!.layouts[0]);
        island = await customizeIsland('child', island.revision, { type: 'restore-part', partId: 'sky' }, d);
        island = await saveIslandExperience('child', island.revision, { type: 'ambience', ambience: 'off' }, d);
        island = await saveIslandExperience('child', island.revision, { type: 'emblem', emblem: 'wave' }, d);
        island = await saveIslandExperience('child', island.revision, { type: 'resident', residentId: 'rabbit', name: 'いまの うさ', look: 'scarf' }, d);
        const before = await snapshot(d), learning = await nonAppearance(d), revision = island.revision;
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'experience_changed') transaction.idbtrans.abort();
        };
        d.islandEvents.hook('creating', abort);
        await expect(saveIslandExperience('child', revision, { type: 'apply-layout', layoutId: 'slot-1' }, d)).rejects.toThrow();
        d.islandEvents.hook('creating').unsubscribe(abort);
        expect(await snapshot(d)).toEqual(before);
        const result = await saveIslandExperience('child', revision, { type: 'apply-layout', layoutId: 'slot-1' }, d);
        expect(getIslandCosmetics(result)).toEqual(remembered.cosmetics);
        expect(result.experience).toMatchObject({ ambience: 'brook', emblem: 'flower', residents: { rabbit: { name: 'いまの うさ', look: 'cap' } } });
        expect(result.customization!.points).toBe(island.customization!.points);
        expect(result.growth).toEqual(island.growth);
        expect(result.pendingPlanId).toBe(island.pendingPlanId);
        expect(await nonAppearance(d)).toEqual(learning);
    });
    it('a changed active owner cannot inspect or replay another profile receipt', async () => {
        const d = await setup(), initial = await current(d);
        const action = { type: 'purchase' as const, itemId: 'starry-house' as const, slot: 'houseRoof' as const };
        await customizeIsland('child', initial.revision, action, d);
        const app = (await d.appData.get('app'))!, other = { ...app.profiles.child, id: 'other' };
        await d.profiles.put(other);
        await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } });
        await openIsland('other', d);
        const before = await snapshot(d);
        await expect(customizeIsland('child', initial.revision, action, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toEqual(before);
    });
});
