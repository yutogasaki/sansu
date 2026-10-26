import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase, SANSU_V10_STORES } from '../../db';
import { createInitialProfile } from '../user/profile';
import { deleteProfileOwnedIndexedDbRows } from '../user/repository';
import { actKokugo } from './actions';
import { KOKUGO_ITEMS } from './catalog';
import { AGE_BANDS, KOKUGO_STARTER_UNITS } from './curriculum';
import { confirmed, DAY, emptyProgress, grade, progressId } from './evaluation';
import { chooseKokugo, presentKokugo, reserveKokugo, verifyKokugoCompletion, saveKokugoWork } from './repository';
import type { KokugoPlan } from './types';
const databases: SansuDatabase[] = [];
const T = Date.UTC(2026, 9, 25);
async function setup() {
    const d = new SansuDatabase(`kokugo-${crypto.randomUUID()}`); databases.push(d);
    const child = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'kid' };
    await d.profiles.put(child);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: child.id, profiles: { kid: child } });
    return d;
}
async function ready(d: SansuDatabase, unitId = 'R01', now = T) {
    await chooseKokugo('kid', unitId, 2, true, d);
    let plan = await reserveKokugo('kid', unitId, d, now);
    if (!plan.introDone) plan = await actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action: 'intro' }, d, now + 1);
    return presentKokugo('kid', plan.id, d, now + 2);
}
async function act(d: SansuDatabase, plan: KokugoPlan, action: Parameters<typeof actKokugo>[0]['action'], answer?: string, now = T + 3) {
    return actKokugo({ profileId: 'kid', planId: plan.id, revision: plan.revision, action, answer }, d, now);
}
afterEach(async () => { vi.restoreAllMocks(); await Promise.all(databases.splice(0).map(d => d.delete())); });
describe('original national-language starter curriculum', () => {
    it('supplies every age band and every one of the 46 units with valid frozen materials', () => {
        expect(AGE_BANDS).toHaveLength(8); expect(KOKUGO_STARTER_UNITS).toHaveLength(46);
        expect(new Set(KOKUGO_ITEMS.map(item => item.id)).size).toBe(KOKUGO_ITEMS.length);
        for (const unit of KOKUGO_STARTER_UNITS) {
            const items = KOKUGO_ITEMS.filter(item => item.unitId === unit.id);
            expect(items.length).toBeGreaterThanOrEqual(3);
            for (const item of items) {
                expect(item.model).toBeTruthy();
                if (item.form === 'activity') expect(grade(item, '自分の 文章')).toBeNull();
                else { expect(grade(item, item.answer)).toBe(true); expect(new Set(item.choices).size).toBe(3); }
            }
        }
    });
    it('groups equivalent word constructions together rather than declaring each item ID a new family', () => {
        const items = KOKUGO_ITEMS.filter(item => item.unitId === 'K02').slice(0, 3);
        expect(new Set(items.map(item => item.exposureGroup)).size).toBe(3);
        expect(new Set(items.map(item => item.family)).size).toBe(1);
        const p = { ...emptyProgress('kid', items[0]), independentItems: items.map(item => item.id),
            independentFamilies: [...new Set(items.map(item => item.family))], independentConditions: ['基本例'] };
        expect(confirmed(p)).toBe(false);
    });
    it('keeps confirmation pending when the required condition coverage is missing', () => {
        const item = KOKUGO_ITEMS.find(item => item.unitId === 'K04')!;
        const progress = { ...emptyProgress('kid', item), independentItems: ['a', 'b', 'c'],
            independentFamilies: ['x', 'y', 'z'], independentConditions: ['促音', '拗音'] };
        expect(confirmed(progress)).toBe(false);
        progress.independentConditions.push('長音'); expect(confirmed(progress)).toBe(true);
    });
    it('does not automatically call an unrecognized open short answer incorrect', () => {
        expect(grade({ ...KOKUGO_ITEMS[0], form: 'short' }, '別の表現')).toBeNull();
    });
});
describe('versioned, owner-fenced Kokugo persistence', () => {
    it('reserves once under races and freezes text, choice order and first answer across restart', async () => {
        const d = await setup(), plans = await Promise.all([ready(d), ready(d)]);
        expect(plans[0].id).toBe(plans[1].id);
        let plan = plans[0];
        plan = await act(d, plan, 'answer', plan.slots[0].item.choices.find(choice => choice !== plan.slots[0].item.answer));
        const frozen = structuredClone(plan);
        d.close(); await d.open();
        expect(await reserveKokugo('kid', 'H01', d)).toEqual(frozen);
        expect((await presentKokugo('kid', plan.id, d)).slots[0].firstAnswer?.correct).toBe(false);
        expect(await d.kokugoOutbox.count()).toBe(0);
    });
    it('commits replayed commands once, rejects stale conflicting commands, and rolls back on storage failure', async () => {
        const d = await setup(), plan = await ready(d), answer = plan.slots[0].item.answer;
        const done = await act(d, plan, 'answer', answer);
        expect(await act(d, plan, 'answer', answer)).toEqual(done);
        await expect(act(d, plan, 'hint')).rejects.toThrow();
        expect(await d.kokugoOutbox.count()).toBe(1);
        let next = await act(d, done, 'next'); next = await presentKokugo('kid', next.id, d);
        vi.spyOn(d.kokugoPlans, 'put').mockRejectedValueOnce(new Error('disk-full'));
        await expect(act(d, next, 'answer', next.slots[1].item.answer)).rejects.toThrow('disk-full');
        expect(await d.kokugoOutbox.count()).toBe(1);
        expect((await d.kokugoPlans.get(next.id))?.slots[1].firstAnswer).toBeUndefined();
    });
    it('separates first wrong answers, support completion and skip from independent evidence', async () => {
        const d = await setup(); let plan = await ready(d);
        plan = await act(d, plan, 'answer', plan.slots[0].item.choices.find(choice => choice !== plan.slots[0].item.answer));
        plan = await act(d, plan, 'model');
        plan = await act(d, plan, 'complete-supported');
        expect(plan.slots[0]).toMatchObject({ completionKind: 'assisted', firstAnswer: { correct: false } });
        const proof = (await d.kokugoOutbox.toArray())[0];
        expect(await verifyKokugoCompletion(proof, d)).toBe(true);
        expect(await verifyKokugoCompletion({ ...proof, completedAt: proof.completedAt + 1 }, d)).toBe(false);
        plan = await act(d, plan, 'next'); plan = await presentKokugo('kid', plan.id, d);
        await act(d, plan, 'skip');
        expect(await d.kokugoOutbox.count()).toBe(1);
        expect((await d.kokugoProgress.toArray()).every(p => !p.independentItems.length)).toBe(true);
    });
    it('preserves a typed draft and treats an unknown short answer as unscorable, with supported completion', async () => {
        const d = await setup(); let plan = await ready(d, 'K05');
        plan = await act(d, plan, 'draft', '別の こたえ');
        d.close(); await d.open();
        expect((await reserveKokugo('kid', 'K05', d)).slots[0].draft).toBe('別の こたえ');
        plan = await act(d, plan, 'answer', '別の こたえ');
        expect(plan.slots[0].firstAnswer?.correct).toBeNull();
        expect(plan.slots[0].support).toBe('model');
        expect(await d.kokugoOutbox.count()).toBe(0);
        const events = await d.kokugoEvents.toArray(); expect(events.filter(event => event.unscorable)).toHaveLength(1);
        plan = await act(d, plan, 'complete-supported');
        expect(plan.slots[0].completionKind).toBe('assisted');
    });
    it('requires heard audio and never silently grades a listening task without it', async () => {
        const d = await setup(); let plan = await ready(d, 'K01');
        await expect(act(d, plan, 'answer', plan.slots[0].item.answer)).rejects.toThrow('音を');
        plan = await act(d, plan, 'heard');
        plan = await act(d, plan, 'answer', plan.slots[0].item.answer);
        expect(plan.slots[0].completionKind).toBe('independent');
    });
    it('requires 3 independent examples, preserves confirmation history and checks delayed unseen context only when due', async () => {
        const d = await setup(); let plan = await ready(d);
        for (let i = 0; i < 3; i++) {
            plan = await act(d, plan, 'answer', plan.slots[i].item.answer, T + 10 + 100 * i);
            plan = await act(d, plan, 'next', undefined, T + 20 + 100 * i);
            if (i < 2) plan = await presentKokugo('kid', plan.id, d, T + 30 + 100 * i);
        }
        const p = (await d.kokugoProgress.toArray())[0];
        expect(confirmed(p)).toBe(true); expect(p.delayedCount).toBe(0);
        const early = await reserveKokugo('kid', 'R01', d, T + DAY);
        const shown = await presentKokugo('kid', early.id, d, T + DAY);
        expect(shown.slots[0].presentation?.delayedEligible).toBe(false);
        // A separate unit with a due, untouched target and unseen material.
        await d.kokugoPlans.clear();
        const item = KOKUGO_ITEMS.find(item => item.unitId === 'H01')!;
        await d.kokugoProgress.put({ ...emptyProgress('kid', item), introduced: true, lastContactAt: T,
            seenExposures: [item.exposureGroup], nextReview: T + DAY, independentItems: [item.id], independentFamilies: [item.family] });
        plan = await ready(d, 'H01', T + 2 * DAY);
        expect(plan.slots[0].item.id).not.toBe(item.id);
        expect(plan.slots[0].presentation?.delayedEligible).toBe(true);
        await act(d, plan, 'answer', plan.slots[0].item.answer, T + 2 * DAY + 3);
        expect((await d.kokugoProgress.get(['kid', progressId(item)]))?.delayedCount).toBe(1);
        expect(confirmed((await d.kokugoProgress.toArray()).find(p => p.unitId === 'R01')!)).toBe(true);
    });
    it('does not postpone a due date after an early practice or support contact', async () => {
        const d = await setup(); let plan = await ready(d);
        plan = await act(d, plan, 'answer', plan.slots[0].item.answer);
        const due = (await d.kokugoProgress.toArray())[0].nextReview;
        plan = await act(d, plan, 'next'); plan = await presentKokugo('kid', plan.id, d, T + 100);
        plan = await act(d, plan, 'model', undefined, T + 200);
        await act(d, plan, 'complete-supported', undefined, T + 300);
        expect((await d.kokugoProgress.toArray())[0].nextReview).toBe(due);
    });
    it('does not count a repeated material or a clock reversal as new independent evidence', async () => {
        const d = await setup(); let plan = await ready(d);
        const item = plan.slots[0].item;
        await act(d, plan, 'answer', item.answer);
        await d.kokugoPlans.clear();
        const p = (await d.kokugoProgress.toArray())[0];
        p.seenExposures = KOKUGO_ITEMS.filter(i => i.unitId === 'R01').map(i => i.exposureGroup);
        await d.kokugoProgress.put(p);
        plan = await reserveKokugo('kid', 'R01', d, T - DAY);
        plan = await presentKokugo('kid', plan.id, d, T - DAY);
        plan = await act(d, plan, 'answer', plan.slots[0].item.answer, T - DAY + 3);
        expect(plan.slots[0].completionKind).toBe('assisted');
        expect((await d.kokugoProgress.toArray())[0].independentItems).toHaveLength(1);
    });
    it('preserves a saved edition when the child starts changing its draft', async () => {
        const d = await setup();
        const work = { id: 'kid:work', profileId: 'kid', unitId: 'E05', text: '最初の 作品', saved: true, updatedAt: T };
        await saveKokugoWork(work, d);
        await saveKokugoWork({ ...work, text: '新しい 下書き', saved: false, updatedAt: T + 1 }, d);
        expect((await d.kokugoWorks.get(work.id))?.revisions).toEqual([{ text: work.text, at: T }]);
        await saveKokugoWork({ ...work, text: '新しい 作品', updatedAt: T + 2 }, d);
        expect((await d.kokugoWorks.get(work.id))?.revisions).toHaveLength(2);
        expect(await d.kokugoOutbox.count()).toBe(0);
    });
    it('rejects wrong or deleting owners, preserves legacy records and deletes all new owned data', async () => {
        const d = await setup(), plan = await ready(d);
        await saveKokugoWork({ id: 'kid:draft', profileId: 'kid', unitId: 'E05', text: '下書き', saved: false, updatedAt: T }, d);
        await d.appData.update('app', { activeProfileId: 'other' });
        await expect(act(d, plan, 'model')).rejects.toThrow('プロフィール');
        await d.appData.update('app', { activeProfileId: 'kid' });
        await d.foundationOwners.put({ profileId: 'kid', status: 'deleting', updatedAt: T });
        await expect(act(d, plan, 'model')).rejects.toThrow('プロフィール');
        await d.transaction('rw', d.tables, () => deleteProfileOwnedIndexedDbRows(d, 'kid'));
        for (const table of [d.kokugoPlans, d.kokugoCourses, d.kokugoWorks, d.kokugoProgress, d.kokugoEvents, d.kokugoOutbox]) expect(await table.count()).toBe(0);
        expect((await d.foundationOwners.get('kid'))?.status).toBe('deleting');
    });
    it('upgrades v10 additively, without changing an existing legacy reservation or English preference', async () => {
        const d = new SansuDatabase(`kokugo-migrate-${crypto.randomUUID()}`); databases.push(d);
        const old = new Dexie(d.name); old.version(10).stores(SANSU_V10_STORES);
        await old.table('foundationCourses').put({ profileId: 'kid', course: 'foundation', unit: 'F02' });
        await old.table('islandPlans').put({ id: 'legacy', profileId: 'kid', status: 'pending', immutable: ['same'] });
        old.close(); await d.open();
        expect(await d.foundationCourses.get('kid')).toMatchObject({ course: 'foundation', unit: 'F02' });
        expect(await d.islandPlans.get('legacy')).toMatchObject({ immutable: ['same'] });
        expect(await d.kokugoPlans.count()).toBe(0);
    });
});
