import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase, SANSU_V9_STORES } from '../../db';
import { deleteProfileOwnedIndexedDbRows } from '../user/repository';
import { openIsland, startIslandPlan } from '../island/repository';
import { createInitialProfile } from '../user/profile';
import { acknowledgeFoundationCompletion, beginFoundationOwnerDeletion, commitFoundationAction, finishFoundationIntroduction, pendingFoundationCompletions, presentFoundationSlot, readFoundationCourse, recordFoundationExposure, reserveFoundationPlan, setFoundationCourse, verifyFoundationCompletion } from './repository';
import type { FoundationPlan } from './types';
const databases: SansuDatabase[] = [];
const options = { indexedDB, IDBKeyRange };
const NOW = Date.UTC(2026, 9, 20);
const DAY = 86400000;
async function setup() {
    const d = new SansuDatabase(`foundation-${crypto.randomUUID()}`, options);
    databases.push(d);
    const p = { ...createInitialProfile('test', 2, 1, 1, 'vocab'), id: 'child' };
    await d.profiles.put(p);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: p.id, profiles: { [p.id]: p } });
    await setFoundationCourse(p.id, 'foundation', 'F01', d);
    return d;
}
async function start(d: SansuDatabase, now = NOW) {
    let p = (await reserveFoundationPlan('child', d, now))!;
    p = await finishFoundationIntroduction('child', p.id, p.revision, d, now);
    return presentFoundationSlot('child', p.id, d, now);
}
const answer = (p: FoundationPlan, d: SansuDatabase, now = NOW) => commitFoundationAction({ profileId: 'child', planId: p.id, revision: p.revision, action: 'answer', answer: p.slots[p.cursor].target }, d, now);
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
describe('English foundation persistence and evidence', () => {
    it('reserves one frozen snapshot concurrently, introductions never emit completion', async () => {
        const d = await setup();
        const [a, b] = await Promise.all([reserveFoundationPlan('child', d, NOW), reserveFoundationPlan('child', d, NOW + 1)]);
        expect(a).toEqual(b);
        expect(a!.slots).toHaveLength(3);
        expect(await pendingFoundationCompletions('child', d)).toEqual([]);
        const p = await start(d);
        expect((await reserveFoundationPlan('child', d, NOW + DAY))!.slots).toEqual(p.slots);
        expect(await d.logs.count()).toBe(0);
    });
    it('records a first wrong answer permanently and supported completion without invented correct', async () => {
        const d = await setup(); let p = await start(d);
        p = (await commitFoundationAction({ profileId: 'child', planId: p.id, revision: p.revision, action: 'answer', answer: p.slots[0].choices.find(t => t !== p.slots[0].target)! }, d, NOW)).plan;
        p = (await commitFoundationAction({ profileId: 'child', planId: p.id, revision: p.revision, action: 'model' }, d, NOW)).plan;
        const result = await commitFoundationAction({ profileId: 'child', planId: p.id, revision: p.revision, action: 'supported_completed' }, d, NOW);
        expect(result.completion!.completionKind).toBe('assisted');
        expect(result.plan.slots[0].firstAnswer!.correct).toBe(false);
        expect((await d.foundationEvents.toArray()).filter(e => e.correct)).toEqual([]);
        expect(await d.memoryVocab.count()).toBe(0);
        expect(await verifyFoundationCompletion(result.completion!, d)).toBe(true);
    });
    it('replays a lost response exactly once and rejects a different action at that revision', async () => {
        const d = await setup(); const p = await start(d);
        const first = await answer(p, d); const retried = await answer(p, d, NOW + 50);
        expect(retried.completion).toEqual(first.completion);
        expect(await d.foundationOutbox.count()).toBe(1);
        await expect(commitFoundationAction({ profileId: 'child', planId: p.id, revision: p.revision, action: 'hint' }, d, NOW)).rejects.toThrow('changed');
        await acknowledgeFoundationCompletion(first.completion!, d);
        expect(await pendingFoundationCompletions('child', d)).toEqual([]);
    });
    it('rolls back slot, progress, event and outbox together on disk write failure', async () => {
        const d = await setup(); const p = await start(d);
        const fail = () => { throw new Error('disk full'); };
        d.foundationOutbox.hook('creating', fail);
        await expect(answer(p, d)).rejects.toThrow('disk full');
        d.foundationOutbox.hook('creating').unsubscribe(fail);
        expect(await d.foundationPlans.get(p.id)).toEqual(p);
        expect(await d.foundationOutbox.count()).toBe(0);
        expect((await d.foundationEvents.toArray()).filter(e => e.type === 'answer')).toEqual([]);
        expect((await answer(p, d)).completion).toBeDefined();
    });
    it('queues course changes until current reservation ends', async () => {
        const d = await setup(); let p = await start(d);
        expect((await setFoundationCourse('child', 'foundation', 'F02', d)).pending?.unit).toBe('F02');
        expect((await reserveFoundationPlan('child', d, NOW))!.id).toBe(p.id);
        while (p.status === 'pending') { p = await presentFoundationSlot('child', p.id, d, NOW); p = (await answer(p, d)).plan; }
        const next = (await reserveFoundationPlan('child', d, NOW))!;
        expect(next.unit).toBe('F02'); expect((await readFoundationCourse('child', d)).pending).toBeUndefined();
    });
    it('preserves a classic reservation and defers the requested foundation course', async () => {
        const d = await setup();
        await openIsland('child', d);
        const classic = await startIslandPlan('child', d);
        const pref = await setFoundationCourse('child', 'foundation', 'F02', d);
        expect(pref.pending?.unit).toBe('F02');
        expect(await reserveFoundationPlan('child', d, NOW)).toBeNull();
        expect((await d.islandPlans.get(classic.id))!.status).toBe('active');
        expect(await d.foundationPlans.count()).toBe(0);
    });
    it('rolls pending preference application back when the next reservation cannot save', async () => {
        const d = await setup(); let p = await start(d);
        await setFoundationCourse('child', 'foundation', 'F02', d);
        while (p.status === 'pending') { p = await presentFoundationSlot('child', p.id, d, NOW); p = (await answer(p, d)).plan; }
        const fail = () => { throw new Error('reservation disk full'); };
        d.foundationPlans.hook('creating', fail);
        await expect(reserveFoundationPlan('child', d, NOW)).rejects.toThrow('disk full');
        d.foundationPlans.hook('creating').unsubscribe(fail);
        expect((await readFoundationCourse('child', d)).pending?.unit).toBe('F02');
        expect(await d.foundationOutbox.count()).toBe(3);
        expect((await reserveFoundationPlan('child', d, NOW))!.unit).toBe('F02');
    });
    it('uses pre-stimulus 24-hour eligibility, invalidates cross-tab exposure, and never delays Due for early practice', async () => {
        const d = await setup(); let p = await start(d);
        const slot = p.slots[0]; const key: [string, string] = ['child', `${slot.target}:${slot.form}`];
        const initial = (await d.foundationProgress.get(key))!;
        await d.foundationProgress.put({ ...initial, strength: 2, nextReview: NOW - 1, lastContactAt: NOW - DAY - 1 });
        delete p.slots[0].presentation; await d.foundationPlans.put(p);
        p = await presentFoundationSlot('child', p.id, d, NOW);
        expect(p.slots[0].presentation!.delayedEligible).toBe(true);
        await recordFoundationExposure('child', [slot.target], 'replay', d, NOW + 1);
        expect((await answer(p, d, NOW + 2)).completion!.completionKind).toBe('assisted');
        const after = (await d.foundationProgress.get(key))!;
        expect(after.strength).toBe(2); expect(after.nextReview).toBe(NOW - 1);
    });
    it('counts delayed independent retrieval but cannot gain delay by leaving a question open', async () => {
        const d = await setup(); let p = await start(d); const slot = p.slots[0];
        const key: [string, string] = ['child', `${slot.target}:${slot.form}`];
        const prior = (await d.foundationProgress.get(key))!;
        await d.foundationProgress.put({ ...prior, strength: 1, nextReview: NOW - 1, lastContactAt: NOW - DAY - 1 });
        delete slot.presentation; await d.foundationPlans.put(p); p = await presentFoundationSlot('child', p.id, d, NOW);
        await answer(p, d, NOW + 50);
        expect((await d.foundationProgress.get(key))!.delayedCount).toBe(1);
        p = await presentFoundationSlot('child', p.id, d, NOW);
        await answer(p, d, NOW + DAY * 2);
        expect((await d.foundationProgress.toArray()).reduce((sum, r) => sum + r.delayedCount, 0)).toBe(1);
    });
    it('keeps the presentation eligibility and independent evidence through its own required prompt replay', async () => {
        const d = await setup(); let p = await start(d); const target = p.slots[0].target;
        const key: [string, string] = ['child', `${target}:${p.slots[0].form}`];
        const prior = (await d.foundationProgress.get(key))!;
        await d.foundationProgress.put({ ...prior, strength: 1, nextReview: NOW - 1, lastContactAt: NOW - DAY - 1 });
        delete p.slots[0].presentation; await d.foundationPlans.put(p);
        p = await presentFoundationSlot('child', p.id, d, NOW);
        const snapshot = structuredClone(p.slots[0].presentation!);
        const before = (await d.foundationProgress.get(key))!;
        await recordFoundationExposure('child', [target], 'replay', d, NOW + 3600000, snapshot.id);
        const replayed = (await d.foundationProgress.get(key))!;
        expect(replayed.contactRevision).toBe(before.contactRevision);
        expect(replayed.lastContactAt).toBe(NOW + 3600000);
        expect((await d.foundationPlans.get(p.id))!.slots[0].presentation).toEqual(snapshot);
        expect(snapshot.delayedEligible).toBe(true);
        const result = await answer(p, d, NOW + 3600001);
        expect(result.completion!.completionKind).toBe('independent');
        expect((await d.foundationProgress.get(key))!.delayedCount).toBe(1);
    });
    it('measures a future delayed check from the most recent replay rather than the original question opening', async () => {
        const d = await setup(); let p = await start(d); const slot = p.slots[0];
        const key: [string, string] = ['child', `${slot.target}:${slot.form}`];
        const prior = (await d.foundationProgress.get(key))!;
        await d.foundationProgress.put({ ...prior, strength: 1, nextReview: NOW - 1 });
        await recordFoundationExposure('child', [slot.target], 'replay', d, NOW + 3600000, slot.presentation!.id);
        // A fresh saved presentation is eligible to evaluate time again, unlike
        // reopening the original snapshot. Keep the same target/form as a fixture.
        const fresh = structuredClone(p); fresh.id = crypto.randomUUID(); fresh.revision = 0;
        delete fresh.slots[0].presentation; await d.foundationPlans.add(fresh);
        p = await presentFoundationSlot('child', fresh.id, d, NOW + DAY + 1);
        expect(p.slots[0].presentation!.delayedEligible).toBe(false);
        expect((await answer(p, d, NOW + DAY + 2)).completion!.completionKind).toBe('independent');
        expect((await d.foundationProgress.get(key))!.strength).toBe(1);
        expect((await d.foundationProgress.get(key))!.delayedCount).toBe(0);
    });
    it('invalidates independent evidence when the target was a distractor in a different presentation', async () => {
        const d = await setup(); const first = await start(d); const target = first.slots[0].target;
        const other = structuredClone(first); other.id = crypto.randomUUID(); other.revision = 0;
        other.slots[0].target = first.slots[0].choices.find(t => t !== target)!;
        delete other.slots[0].presentation;
        await d.foundationPlans.add(other);
        await presentFoundationSlot('child', other.id, d, NOW + 1);
        const result = await answer(first, d, NOW + 2);
        expect(result.plan.slots[0].firstAnswer!.correct).toBe(true);
        expect(result.completion!.completionKind).toBe('assisted');
        expect((await d.foundationProgress.get(['child', `${target}:${first.slots[0].form}`]))!.independentCount).toBe(0);
    });
    it('sound-unavailable support does not invent a wrong answer and blocks independent evidence', async () => {
        const d = await setup(); let p = await start(d);
        p = (await commitFoundationAction({ profileId: 'child', planId: p.id, revision: p.revision, action: 'alternative' }, d, NOW)).plan;
        expect(p.slots[0].firstAnswer).toBeUndefined();
        expect((await answer(p, d)).completion!.completionKind).toBe('assisted');
    });
    it('persistent deletion fence rejects stale writes and receipt verification after deletion starts', async () => {
        const d = await setup(); const p = await start(d); const r = await answer(p, d);
        await beginFoundationOwnerDeletion('child', d);
        expect(await verifyFoundationCompletion(r.completion!, d)).toBe(false);
        await expect(reserveFoundationPlan('child', d, NOW)).rejects.toThrow('unavailable');
        expect(await pendingFoundationCompletions('child', d)).toEqual([]);
    });
    it('deletes all foundation source rows but keeps a fence against reused profile identifiers', async () => {
        const d = await setup(); const p = await start(d); const owner = (await d.profiles.get('child'))!;
        await answer(p, d); await beginFoundationOwnerDeletion('child', d);
        await d.transaction('rw', d.tables, () => deleteProfileOwnedIndexedDbRows(d, 'child'));
        expect(await d.foundationPlans.count()).toBe(0);
        expect(await d.foundationProgress.count()).toBe(0);
        expect(await d.foundationEvents.count()).toBe(0);
        expect(await d.foundationOutbox.count()).toBe(0);
        expect(await d.foundationCourses.count()).toBe(0);
        expect((await d.foundationOwners.get('child'))!.status).toBe('deleting');
        await d.profiles.put(owner);
        await expect(reserveFoundationPlan('child', d, NOW)).rejects.toThrow('unavailable');
    });
    it('upgrades legacy profiles to vocabulary without altering existing progress', async () => {
        const name = `legacy-${crypto.randomUUID()}`; const legacy = new Dexie(name, options);
        legacy.version(9).stores(SANSU_V9_STORES);
        const p = { ...createInitialProfile('legacy', 2, 1, 1, 'vocab'), id: 'legacy' };
        await legacy.table('profiles').put(p); await legacy.table('memoryVocab').put({ profileId: p.id, id: 'old-word', strength: 5 }); legacy.close();
        const d = new SansuDatabase(name, options); databases.push(d);
        expect((await readFoundationCourse(p.id, d)).course).toBe('vocabulary');
        expect((await d.memoryVocab.get([p.id, 'old-word']))!.strength).toBe(5);
        expect(await d.profiles.get(p.id)).toEqual(p);
    });
    it('keeps foundation snapshots when a legacy writer reopens, and fences missing owners after old reset', async () => {
        const d = await setup(); const plan = await start(d); const result = await answer(plan, d); const name = d.name;
        d.close();
        const older = new Dexie(name, options);
        older.version(9).stores(SANSU_V9_STORES);
        try {
            await older.open();
            const owner = await older.table('profiles').get('child');
            await older.table('profiles').put({ ...owner, name: 'renamed by old app' });
            const reopened = new SansuDatabase(name, options); databases.push(reopened);
            expect((await reopened.foundationPlans.get(plan.id))!.slots[0].completedAt).toBe(NOW);
            expect(await verifyFoundationCompletion(result.completion!, reopened)).toBe(true);
            await older.table('profiles').clear();
            expect(await verifyFoundationCompletion(result.completion!, reopened)).toBe(false);
            await expect(reserveFoundationPlan('child', reopened, NOW)).rejects.toThrow('unavailable');
        } finally { older.close(); }
    });
});
