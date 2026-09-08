import type { Transaction } from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { getIslandLearningKeepsakes, type IslandLearningKeepsakeAction } from './learningKeepsakes';
import { readIslandLearningKeepsakeSummary, saveIslandLearningKeepsakes } from './learningKeepsakesRepository';
import { IslandConflict, openIsland, startIslandPlan } from './repository';
import type { IslandEvent, IslandPlan, IslandRecord } from './types';

const options = { indexedDB, IDBKeyRange }, databases: SansuDatabase[] = [];
async function setup() {
    const database = new SansuDatabase(`island-keepsakes-${crypto.randomUUID()}`, options); databases.push(database);
    const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child', hissanModeEnabled: false };
    await database.profiles.put(profile);
    await database.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await openIsland('child', database); return database;
}
const current = async (d: SansuDatabase) => (await d.islands.get('child'))!;
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
function answer(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finish(d: SansuDatabase, initial?: IslandPlan) {
    let plan = initial ?? await startIslandPlan('child', d);
    while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).plan;
    return plan;
}
const certificate = { type: 'display', keepsakeId: 'first-completion', displayed: true } as const;
const put = async (d: SansuDatabase, action: IslandLearningKeepsakeAction) => saveIslandLearningKeepsakes('child', (await current(d)).revision, action, d);
function expectOnlyShelfWrite(before: Awaited<ReturnType<typeof snapshot>>, after: Awaited<ReturnType<typeof snapshot>>,
    previous: IslandRecord, updated: IslandRecord, action: IslandLearningKeepsakeAction) {
    const expected = structuredClone(before);
    expected.islands = (expected.islands as IslandRecord[]).map(row => row.profileId === updated.profileId
        ? { ...previous, learningKeepsakes: updated.learningKeepsakes, revision: previous.revision + 1, updatedAt: updated.updatedAt } : row);
    expected.islandEvents = [...expected.islandEvents as IslandEvent[], { id: JSON.stringify(['island-learning-keepsakes-v1', 'child', previous.revision]),
        profileId: 'child', type: 'learning_keepsakes_changed', timestamp: updated.updatedAt, action }]
        .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    expect(after).toStrictEqual(expected);
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('atomic owned learning keepsakes', () => {
    it('reads an old absent shelf without migration and refuses unearned selection without any store change', async () => {
        const d = await setup(), initial = await current(d), before = await snapshot(d);
        expect(getIslandLearningKeepsakes(initial)).toEqual({ version: 1, displayed: [] });
        expect(await readIslandLearningKeepsakeSummary('child', 'first-completion', d)).toMatchObject({ available: false, completedSets: 0, recordScope: 'count-only' });
        await expect(saveIslandLearningKeepsakes('child', initial.revision, certificate, d)).rejects.toMatchObject({ code: 'not-eligible' });
        expect(await openIsland('child', d)).toStrictEqual(initial); expect(await snapshot(d)).toStrictEqual(before);
    });
    it('earns first and five-section awards through real learning, changes only shelf+receipt, and preserves the same reservation', async () => {
        const d = await setup(), first = await finish(d), initial = await current(d), before = await snapshot(d);
        expect(initial.completedSets).toBe(1); expect(initial.learningKeepsakes).toBeUndefined();
        const saved = await put(d, certificate);
        expectOnlyShelfWrite(before, await snapshot(d), initial, saved, certificate);
        const firstSummary = await readIslandLearningKeepsakeSummary('child', 'first-completion', d);
        expect(firstSummary).toMatchObject({ available: true, recordScope: 'complete', completedAt: first.completedAt,
            verifiedCompletedSets: 1, problemCount: first.slots.length });
        while ((await current(d)).completedSets < 5) await finish(d);
        expect((await current(d)).learningKeepsakes).toEqual(saved.learningKeepsakes);
        const reserved = await startIslandPlan('child', d), prior = await current(d), allBefore = await snapshot(d);
        const action = { type: 'display', keepsakeId: 'completed-5', displayed: true } as const, displayed = await put(d, action);
        expectOnlyShelfWrite(allBefore, await snapshot(d), prior, displayed, action);
        expect(displayed.learningKeepsakes).toEqual({ version: 1, displayed: ['first-completion', 'completed-5'] });
        const summaryBefore = await snapshot(d), summary = await readIslandLearningKeepsakeSummary('child', 'completed-5', d);
        expect(summary).toMatchObject({ available: true, verifiedCompletedSets: 5, recordScope: 'complete' });
        expect(summary.problemCount).toBe((await d.islandPlans.toArray()).filter(plan => plan.status === 'completed').reduce((sum, plan) => sum + plan.slots.length, 0));
        expect(await snapshot(d)).toStrictEqual(summaryBefore);
        d.close(); await d.open(); expect(await startIslandPlan('child', d)).toStrictEqual(reserved);
        const beforeAnswer = await current(d);
        expect(reserved.cursor).toBe(0); expect(reserved.slots.length).toBeGreaterThan(1); expect(beforeAnswer.pendingMathChecks ?? []).toHaveLength(0);
        const result = await commitIslandLearning('child', reserved.id, reserved.revision, answer(reserved), d);
        expect(result.plan.cursor).toBe(1); expect(result.plan.status).toBe('active'); expect(result.island).toStrictEqual(beforeAnswer);
        const beforeStore = await snapshot(d), storing = { type: 'display', keepsakeId: 'completed-5', displayed: false } as const;
        const stored = await put(d, storing); expectOnlyShelfWrite(beforeStore, await snapshot(d), beforeAnswer, stored, storing);
        expect(stored.learningKeepsakes).toEqual({ version: 1, displayed: ['first-completion'] });
        const beforeBulk = await snapshot(d), restored = await put(d, { type: 'display-earned' });
        expectOnlyShelfWrite(beforeBulk, await snapshot(d), stored, restored, { type: 'display-earned' });
        expect(restored.learningKeepsakes).toEqual(displayed.learningKeepsakes);
    });
    it('supported completion is a completed section, not a mastery claim; retries do not increase problem counts', async () => {
        const d = await setup(); let plan = await startIslandPlan('child', d);
        while (plan.status === 'active') {
            plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'answer', answer: 'wrong' }, d)).plan;
            plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'support_opened' }, d)).plan;
            plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'model_opened' }, d)).plan;
            plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'supported_completed' }, d)).plan;
        }
        await put(d, certificate);
        expect(await readIslandLearningKeepsakeSummary('child', 'first-completion', d)).toMatchObject({ available: true, verifiedCompletedSets: 1,
            problemCount: plan.slots.length, completedAt: plan.completedAt });
        expect(await d.islandEvents.where('type').equals('supported_completed').count()).toBe(plan.slots.length);
    });
    it('rolls back native aborts and retries the identical operation without a lost or duplicated award', async () => {
        const d = await setup(); await finish(d); const initial = await current(d), before = await snapshot(d);
        let aborted = 0, abortedDone!: () => void;
        const nativeAborted = new Promise<void>(resolve => { abortedDone = resolve; });
        const abort = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'learning_keepsakes_changed') {
                transaction.idbtrans.addEventListener('abort', () => { aborted++; abortedDone(); }); transaction.idbtrans.abort();
            }
        };
        d.islandEvents.hook('creating', abort);
        await expect(saveIslandLearningKeepsakes('child', initial.revision, certificate, d)).rejects.toThrow();
        d.islandEvents.hook('creating').unsubscribe(abort); await nativeAborted;
        expect(aborted).toBe(1); expect(await snapshot(d)).toStrictEqual(before);
        await saveIslandLearningKeepsakes('child', initial.revision, certificate, d);
        expect(await d.islandEvents.where('type').equals('learning_keepsakes_changed').count()).toBe(1);
    });
    it('a lost native completion and canonical retry return the latest shelf rather than reinstating an old choice', async () => {
        const d = await setup(); await finish(d); const initial = await current(d); let commits = 0;
        const observe = (_key: unknown, event: IslandEvent, transaction: Transaction) => {
            if (event.type === 'learning_keepsakes_changed') transaction.idbtrans.addEventListener('complete', () => commits++);
        };
        d.islandEvents.hook('creating', observe);
        await expect(saveIslandLearningKeepsakes('child', initial.revision, certificate, d).then(() => { throw new Error('notification lost'); })).rejects.toThrow('notification lost');
        d.islandEvents.hook('creating').unsubscribe(observe); expect(commits).toBe(1);
        const later = await put(d, { type: 'display', keepsakeId: 'first-completion', displayed: false }), before = await snapshot(d);
        expect(await saveIslandLearningKeepsakes('child', initial.revision, { keepsakeId: 'first-completion', displayed: true, type: 'display' }, d)).toStrictEqual(later);
        await expect(saveIslandLearningKeepsakes('child', initial.revision, { type: 'display', keepsakeId: 'first-completion', displayed: false }, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await snapshot(d)).toStrictEqual(before);
    });
    it('serializes distinct concurrent choices, coalesces identical retries, and rejects another active profile even on replay', async () => {
        const d = await setup(); await finish(d); const initial = await current(d), second = new SansuDatabase(d.name, options); await second.open();
        try {
            const [a, b] = await Promise.all([saveIslandLearningKeepsakes('child', initial.revision, certificate, d), saveIslandLearningKeepsakes('child', initial.revision, certificate, second)]);
            expect(a).toEqual(b); expect(await d.islandEvents.where('type').equals('learning_keepsakes_changed').count()).toBe(1);
            const outcomes = await Promise.allSettled([saveIslandLearningKeepsakes('child', a.revision, { type: 'display', keepsakeId: 'first-completion', displayed: false }, d),
                saveIslandLearningKeepsakes('child', a.revision, certificate, second)]);
            expect(outcomes.filter(value => value.status === 'fulfilled')).toHaveLength(1);
            expect(outcomes.find(value => value.status === 'rejected')).toMatchObject({ reason: expect.any(IslandConflict) });
            const app = (await d.appData.get('app'))!, other = { ...app.profiles.child, id: 'other' };
            await d.profiles.put(other); await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } }); await openIsland('other', d);
            const before = await snapshot(d);
            await expect(saveIslandLearningKeepsakes('child', initial.revision, certificate, d)).rejects.toBeInstanceOf(IslandConflict);
            await expect(readIslandLearningKeepsakeSummary('child', 'first-completion', d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await readIslandLearningKeepsakeSummary('other', 'first-completion', d)).toMatchObject({ available: false, recordScope: 'count-only' });
            expect(await snapshot(d)).toStrictEqual(before);
        } finally { second.close(); }
    });
    it('a bulk retry after more real learning cannot automatically display newly eligible keepsakes', async () => {
        const d = await setup(); await finish(d); const initial = await current(d);
        await expect(saveIslandLearningKeepsakes('child', initial.revision, { type: 'display-earned' }, d)
            .then(() => { throw new Error('notification lost'); })).rejects.toThrow('notification lost');
        while ((await current(d)).completedSets < 5) await finish(d);
        const latest = await current(d), before = await snapshot(d);
        expect(latest.learningKeepsakes).toEqual({ version: 1, displayed: ['first-completion'] });
        expect(await saveIslandLearningKeepsakes('child', initial.revision, { type: 'display-earned' }, d)).toStrictEqual(latest);
        expect(await snapshot(d)).toStrictEqual(before);
        const explicitlyDisplayed = await put(d, { type: 'display-earned' });
        expect(explicitlyDisplayed.learningKeepsakes).toEqual({ version: 1, displayed: ['first-completion', 'completed-5'] });
    });
    it('survives missing old plans/events without inventing dates', async () => {
        const d = await setup(), first = await finish(d), before = await snapshot(d);
        expect((await readIslandLearningKeepsakeSummary('child', 'first-completion', d)).completedAt).toBe(first.completedAt);
        expect(await snapshot(d)).toStrictEqual(before);
        await d.islandPlans.delete(first.id);
        expect(await readIslandLearningKeepsakeSummary('child', 'first-completion', d)).toMatchObject({ available: true, completedAt: first.completedAt, recordScope: 'partial' });
        await d.islandEvents.delete(`${first.id}:completed`);
        const noHistory = await snapshot(d), summary = await readIslandLearningKeepsakeSummary('child', 'first-completion', d);
        expect(summary).toMatchObject({ available: true, recordScope: 'count-only', verifiedCompletedSets: 0 });
        expect(summary.completedAt).toBeUndefined(); expect(summary.problemCount).toBeUndefined(); expect(await snapshot(d)).toStrictEqual(noHistory);
    });
    it('loads only one canonical plan/event for a large legacy milestone, without scanning or writing history', async () => {
        const d = await setup(), initial = await current(d);
        // A legacy-count storage fixture checks the read bound; this is not proof of 1000 real learning completions.
        await d.islands.put({ ...initial, completedSets: 1000 });
        const before = await snapshot(d), plans = vi.spyOn(d.islandPlans, 'bulkGet'), events = vi.spyOn(d.islandEvents, 'bulkGet');
        try {
            const summary = await readIslandLearningKeepsakeSummary('child', 'completed-1000', d);
            const id = JSON.stringify(['island-plan-v1', 'child', 999]);
            expect(plans).toHaveBeenCalledTimes(1); expect(plans).toHaveBeenCalledWith([id]);
            expect(events).toHaveBeenCalledTimes(1); expect(events).toHaveBeenCalledWith([`${id}:completed`]);
            expect(summary).toMatchObject({ available: true, completedSets: 1000, recordScope: 'count-only' });
            expect(summary.completedAt).toBeUndefined(); expect(summary.problemCount).toBeUndefined();
            expect(await snapshot(d)).toStrictEqual(before);
        } finally { plans.mockRestore(); events.mockRestore(); }
    });
    it('ordinary writers reject corrupted persisted shelf selections without deleting them', async () => {
        const d = await setup(), plan = await startIslandPlan('child', d), initial = await current(d);
        for (const learningKeepsakes of [null, { version: 2, displayed: [] }, { version: 1, displayed: ['completed-1000'] }]) {
            await d.islands.put({ ...initial, learningKeepsakes } as IslandRecord); const before = await snapshot(d);
            await expect(openIsland('child', d)).rejects.toBeInstanceOf(IslandConflict);
            await expect(saveIslandLearningKeepsakes('child', initial.revision, { type: 'display', keepsakeId: 'first-completion', displayed: false }, d)).rejects.toBeInstanceOf(IslandConflict);
            await expect(commitIslandLearning('child', plan.id, plan.revision, answer(plan), d)).rejects.toBeInstanceOf(IslandConflict);
            expect(await snapshot(d)).toStrictEqual(before);
        }
    });
});
