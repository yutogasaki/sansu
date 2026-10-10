import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../src/db/index.ts';
import { GrowingIslandDatabase } from '../src/domain/growingIsland/repository.ts';
import { createInitialProfile } from '../src/domain/user/profile.ts';
import { newIsland } from '../src/domain/growingIsland/island.ts';
import { parsePlacePack, preparePlacePreview } from '../src/prototypes/placeQa/pack.ts';
import { createPlacePreview, readPlacePreview, readPlaceSelection, restorePlaceSelection } from '../src/prototypes/placeQa/store.ts';
import { makePlacePack } from './growing-place-fixtures.mjs';

const stores = [];
let pack;
beforeEach(() => {
    const values = new Map();
    vi.stubGlobal('localStorage', { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) });
});
afterEach(async () => { await Promise.all(stores.splice(0).map(store => store.delete())); vi.unstubAllGlobals(); });
const databases = () => {
    const value = { app: new SansuDatabase(`SansuPlaceQa-${crypto.randomUUID()}`), growing: new GrowingIslandDatabase(`SansuGrowingIslandPreviewQa-${crypto.randomUUID()}`) };
    stores.push(value.app, value.growing); return value;
};
const fixture = async () => { pack ??= await makePlacePack(); return pack; };

describe('dedicated DEV place fixture upload', () => {
    it('accepts the current 20 diagnostic cases and rejects changed payload or forged use evidence', async () => {
        const source = await fixture();
        expect((await parsePlacePack(JSON.stringify(source))).cases).toHaveLength(20);
        const changed = structuredClone(source); changed.cases[0].island.state.drops++;
        await expect(parsePlacePack(JSON.stringify(changed))).rejects.toThrow('ハッシュ');
        await expect(parsePlacePack(JSON.stringify({ ...source, synthetic: false }))).rejects.toThrow('診断ファイル');
        await expect(parsePlacePack(JSON.stringify({ ...source, cases: source.cases.slice(1) }))).rejects.toThrow('20 件');
    });
    it('creates fresh ownership while preserving all placed owner identities and exact maturity', async () => {
        const source = (await fixture()).cases[0], before = structuredClone(source), now = 1_800_000_000_000;
        const result = preparePlacePreview(source, 'qa-place-preview-fresh', now);
        expect(result.profile.id).toBe('qa-place-preview-fresh'); expect(result.island.state.seed).toBe(result.profile.id);
        expect(result.island.state.landmarks).toEqual(source.island.state.landmarks);
        expect(result.island.state.placeProgress).toEqual(source.island.state.placeProgress);
        expect(result.island.state.nature.hours).toBe(source.island.state.nature.hours); expect(result.island.state.nature.realAt).toBe(now);
        expect(source).toEqual(before);
        expect(() => preparePlacePreview(source, source.id, now)).toThrow('新しい診断');
    });
    it('only adds a fresh QA profile/current preview table, leaves existing rights/learning/legacy tables intact and restores selection', async () => {
        const database = databases(), profile = { ...createInitialProfile('existing', 2, 1, 1, 'math'), id: 'existing-owner' };
        const island = { profileId: profile.id, version: 4, revision: 9, createdAt: 1, updatedAt: 1, state: newIsland(profile.id, 1) };
        await database.app.profiles.add(profile); await database.app.appData.put({ id: 'app', schemaVersion: 1, profiles: { [profile.id]: profile }, activeProfileId: profile.id });
        await database.app.logs.add({ profileId: profile.id, subject: 'math', itemId: 'existing-fact', result: 'correct', timestamp: '2026-10-01' });
        await database.growing.islands.add(island);
        const id = await createPlacePreview((await fixture()).cases[0], true, database, 1_800_000_000_000);
        expect(id).toMatch(/^qa-place-preview-/); expect(await readPlaceSelection(database)).toBe(id);
        expect(await database.app.profiles.get(profile.id)).toEqual(profile); expect(await database.growing.islands.get(profile.id)).toEqual(island);
        expect(await database.app.logs.count()).toBe(1); expect(await database.growing.guidedIslands.count()).toBe(0);
        expect(await database.growing.balancedIslands.count()).toBe(0); expect(await database.growing.legacyIslands.count()).toBe(0);
        const beforeRead = await database.growing.islands.get(id), native = await readPlacePreview(id, database);
        expect(native.table).toBe('placedIslands'); expect(native.record.version).toBe(4); expect(native.logs).toEqual([]);
        expect(await database.growing.islands.get(id)).toEqual(beforeRead);
        await restorePlaceSelection(profile.id, true, database);
        expect(await readPlaceSelection(database)).toBe(profile.id); expect(localStorage.getItem('sansu_active_profile')).toBe(profile.id);
        expect(await database.growing.islands.get(id)).toEqual(beforeRead);
    });
    it('rejects production calls before any profile/island write and permits restoring an originally empty selection', async () => {
        const database = databases(), entry = (await fixture()).cases[0];
        await expect(createPlacePreview(entry, false, database)).rejects.toThrow('Preview DB');
        await expect(restorePlaceSelection(null, false, database)).rejects.toThrow('Preview DB');
        expect(await database.app.profiles.count()).toBe(0); expect(await database.growing.islands.count()).toBe(0);
        await createPlacePreview(entry, true, database); await restorePlaceSelection(null, true, database);
        expect(await readPlaceSelection(database)).toBeNull(); expect(localStorage.getItem('sansu_active_profile')).toBeNull();
    });
    it('removes only a fresh QA island when profile insertion fails', async () => {
        const database = databases();
        database.app.profiles.hook('creating', () => { throw new Error('profile-write-failed'); });
        await expect(createPlacePreview((await fixture()).cases[0], true, database)).rejects.toThrow('profile-write-failed');
        expect(await database.growing.islands.count()).toBe(0); expect(await database.app.profiles.count()).toBe(0);
    });
});
