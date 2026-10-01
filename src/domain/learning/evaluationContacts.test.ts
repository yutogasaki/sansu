import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { evaluationContactTimes, recordEvaluationContact } from './evaluationContacts';

const databases: SansuDatabase[] = [];
async function setup() {
    const database = new SansuDatabase(`evaluation-contact-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
    databases.push(database);
    const profile = { ...createInitialProfile('test', 2, 10, 2, 'math'), id: 'child' };
    await database.profiles.put(profile);
    await database.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: profile.id, profiles: { child: profile } });
    return { database, profile };
}
afterEach(async () => { for (const database of databases.splice(0)) { database.close(); await database.delete(); } });
describe('evaluation display contacts', () => {
    it('shares the elapsed clock across math representations but keeps lexical items separate', async () => {
        const { profile } = await setup();
        profile.evaluationContacts = { math: { add_2d1d_nc_bridge: 'recent', sub_2d1d_nc: 'unrelated' },
            vocab: { word_a: 'first', word_b: 'second' } };
        expect(evaluationContactTimes(profile, 'math', 'add_2d1d_nc')).toEqual(['recent']);
        expect(evaluationContactTimes(profile, 'vocab', 'word_a')).toEqual(['first']);
    });
    it('keeps owner and subject clocks separate without manufacturing learning', async () => {
        const { database, profile } = await setup();
        const timestamp = '2026-10-01T01:00:00.000Z';
        expect(await recordEvaluationContact('child', 'math', 'same', timestamp, database)).toBe(true);
        expect(await recordEvaluationContact('child', 'vocab', 'same', '2026-10-01T02:00:00.000Z', database)).toBe(true);
        expect(await recordEvaluationContact('child', 'math', 'same', '2026-09-01T01:00:00.000Z', database)).toBe(true);
        const saved = await database.profiles.get('child');
        expect(saved?.evaluationContacts).toEqual({ math: { same: timestamp }, vocab: { same: '2026-10-01T02:00:00.000Z' } });
        expect({ ...saved, evaluationContacts: undefined }).toEqual({ ...profile, evaluationContacts: undefined });
        expect(await database.logs.count()).toBe(0);
        expect(await database.memoryMath.count()).toBe(0);
        expect(await database.memoryVocab.count()).toBe(0);
        expect(await recordEvaluationContact('other', 'math', 'same', timestamp, database)).toBe(false);
        await database.appData.update('app', { activeProfileId: 'other' });
        expect(await recordEvaluationContact('child', 'math', 'same', timestamp, database)).toBe(false);
        await expect(recordEvaluationContact('child', 'math', 'same', 'invalid', database)).rejects.toThrow();
    });
});
