import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import Dexie from 'dexie';
import { SansuDatabase } from '../../db';
import { newIsland } from '../growingIsland/island';
import { applyIntent } from '../growingIsland/commands';
import { GrowingIslandDatabase } from '../growingIsland/repository';
import { landCells } from '../growingIsland/space';
import { canPlace } from '../growingIsland/commands';
import { completeOnboardingProfile } from './onboarding';
import { enterFirstPlay, firstPlayTable, readFirstPlay, saveFirstPlayName, saveFirstPlaySetup } from './firstPlay';

const databases: Dexie[] = [];
const fresh = () => { const d = new SansuDatabase(`first-play-${crypto.randomUUID()}`); databases.push(d); return d; };
const selection = { name: '', grade: 1, subject: 'vocab' as const, mathRange: null, englishRange: 'beginner' as const };
afterEach(async () => { await Promise.all(databases.splice(0).map(d => d.delete())); });

describe('first play identity and learning handoff', () => {
    it('reserves one owner across concurrent entries without creating learning data', async () => {
        const d = fresh();
        const [a, b] = await Promise.all([enterFirstPlay(d), enterFirstPlay(d)]);
        expect(a).toEqual(b);
        for (const table of d.tables.filter(t => t.name !== 'appData')) expect(await table.count()).toBe(0);
        expect((await d.appData.toArray()).map(r => r.id)).toEqual(['island-first-play']);
        d.close(); await d.open();
        expect((await enterFirstPlay(d)).ownerId).toBe(a.ownerId);
    });

    it('keeps an actually planted first home and its rights under the exact profile ID', async () => {
        const d = fresh(), session = await enterFirstPlay(d), now = Date.now();
        const growing = new GrowingIslandDatabase(`first-play-world-${crypto.randomUUID()}`); databases.push(growing);
        const state = newIsland(session.ownerId, now);
        const cell = landCells(state).find(c => canPlace(state, c))!;
        const planted = applyIntent(state, { id: 'plant-home', command: { type: 'plant', kind: 'home', cell } }, now).state;
        expect(planted.tutorial).toBe('done');
        expect(planted.villagers).toHaveLength(1);
        await growing.islands.put({ profileId: session.ownerId, version: 4, revision: 1, createdAt: now, updatedAt: now, state: planted });
        const before = await growing.islands.get(session.ownerId);
        const result = await completeOnboardingProfile(selection, session.ownerId, 'first', d);
        expect(result.profile.id).toBe(session.ownerId);
        expect(await growing.islands.get(result.profile.id)).toEqual(before);
        expect((await readFirstPlay(d))?.completed).toBe(true);
        expect((await d.appData.get('app'))?.activeProfileId).toBe(session.ownerId);
        expect(await d.memoryMath.count()).toBe(0);
        expect(await d.logs.count()).toBe(0);
        expect(await d.islandPlans.count()).toBe(0);
        expect(await completeOnboardingProfile(selection, session.ownerId, 'first', d)).toEqual(result);
        expect(await d.profiles.count()).toBe(1);
    });

    it('saves choices and the step together; nickname writes cannot rewind navigation', async () => {
        const d = fresh(), session = await enterFirstPlay(d);
        await saveFirstPlaySetup(session.ownerId, 'subject', { ...selection, subject: null, englishRange: null }, d);
        await saveFirstPlayName(session.ownerId, 'あお', d);
        d.close(); await d.open();
        expect(await readFirstPlay(d)).toMatchObject({ step: 'subject', selection: { name: 'あお', grade: 1, subject: null } });
        await saveFirstPlaySetup(session.ownerId, 'island', selection, d);
        expect((await readFirstPlay(d))?.ownerId).toBe(session.ownerId);
    });

    it('rolls back the completion mark, app and memories together on profile write failure', async () => {
        const d = fresh(), session = await enterFirstPlay(d);
        const fail = () => { throw new Error('simulated storage failure'); };
        d.profiles.hook('creating', fail);
        await expect(completeOnboardingProfile({ ...selection, subject: 'math', mathRange: 'q_add' }, session.ownerId, 'first', d)).rejects.toThrow('simulated');
        expect((await readFirstPlay(d))?.completed).toBe(false);
        expect(await d.profiles.count()).toBe(0);
        expect(await d.memoryMath.count()).toBe(0);
        expect(await d.appData.get('app')).toBeUndefined();
        d.profiles.hook('creating').unsubscribe(fail);
        await completeOnboardingProfile(selection, session.ownerId, 'first', d);
        expect((await readFirstPlay(d))?.completed).toBe(true);
    });

    it('refuses an unrelated first identity and leaves an existing sibling untouched', async () => {
        const d = fresh(), session = await enterFirstPlay(d);
        await expect(completeOnboardingProfile(selection, 'different-owner', 'first', d)).rejects.toThrow('same first island');
        await completeOnboardingProfile(selection, session.ownerId, 'first', d);
        const app = await d.appData.get('app');
        await expect(enterFirstPlay(d)).rejects.toThrow();
        await expect(saveFirstPlaySetup(session.ownerId, 'grade', selection, d)).rejects.toThrow();
        expect(await d.appData.get('app')).toEqual(app);
        expect((await readFirstPlay(d))?.ownerId).toBe(session.ownerId);
    });

    it('preserves unknown future draft versions instead of overwriting them', async () => {
        const d = fresh(), session = await enterFirstPlay(d);
        await firstPlayTable(d).put({ ...session, version: 2 as 1 });
        await expect(enterFirstPlay(d)).rejects.toThrow('あたらしいばん');
        expect((await firstPlayTable(d).get(session.id))?.version).toBe(2);
    });
});
