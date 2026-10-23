import * as subjectScheduling from './subjectSelection';
import * as parkPlanning from '../park/learning';
import { getSkillsForLevel } from '../math/curriculum';
import { vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { commitFoundationAction, finishFoundationIntroduction, presentFoundationSlot, reserveFoundationPlan, setFoundationCourse } from '../englishFoundation/repository';
import { parkHissanGrid } from '../park/learning';
import type { UserProfile } from '../types';
import { createInitialProfile } from '../user/profile';
import { commitIslandLearning } from './commit';
import { resolveIslandLearningEntry } from './learningEntry';
import { commitIslandLearningSession } from './learningSession';
import { openIsland, startIslandPlan } from './repository';
import type { IslandPlan } from './types';
const databases: SansuDatabase[] = [];
const options = { indexedDB, IDBKeyRange };
async function setup(mode: UserProfile['subjectMode'] = 'vocab') {
    const d = new SansuDatabase(`learning-entry-${crypto.randomUUID()}`, options); databases.push(d);
    const p = { ...createInitialProfile('child', 2, 1, 1, mode), id: 'child', soundEnabled: false };
    await d.profiles.put(p);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: p.id, profiles: { child: p } });
    await openIsland(p.id, d);
    return d;
}
function correct(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function beforeFinal(d: SansuDatabase, plan: IslandPlan) {
    while (plan.cursor < plan.slots.length - 1) plan = (await commitIslandLearning('child', plan.id, plan.revision, correct(plan), d)).plan;
    return plan;
}
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
describe('one reservation boundary for English foundation and vocabulary', () => {
    it('resumes the complete frozen classic reservation despite a queued foundation change', async () => {
        const d = await setup(); const old = await startIslandPlan('child', d);
        const before = structuredClone(old);
        await setFoundationCourse('child', 'foundation', 'F02', d);
        const entry = await resolveIslandLearningEntry('child', d);
        expect(entry).toEqual({ kind: 'island', plan: before });
        expect((await d.foundationCourses.get('child'))!.pending?.unit).toBe('F02');
        expect(await d.foundationPlans.count()).toBe(0);
        expect(await d.logs.count()).toBe(0);
    });
    it('opens the requested foundation unit only after the last classic answer commits', async () => {
        const d = await setup(); let old = await startIslandPlan('child', d);
        await setFoundationCourse('child', 'foundation', 'F02', d);
        old = await beforeFinal(d, old);
        const result = await commitIslandLearningSession('child', old.id, old.revision, correct(old), d);
        expect(result.receipt.plan.status).toBe('completed');
        expect(result.nextEntry?.kind).toBe('foundation');
        if (result.nextEntry?.kind === 'foundation') expect(result.nextEntry.plan.unit).toBe('F02');
        expect((await d.foundationCourses.get('child'))!.pending).toBeUndefined();
        expect(await d.foundationOutbox.count()).toBe(0);
    });
    it('keeps an unselected English-only profile at course choice without reserving vocabulary', async () => {
        const d = await setup();
        await d.foundationCourses.put({ profileId: 'child', unit: 'F01' });
        expect(await resolveIslandLearningEntry('child', d)).toEqual({ kind: 'course-choice' });
        expect(await d.foundationPlans.count()).toBe(0);
        expect(await d.islandPlans.count()).toBe(0);
        expect((await d.islands.get('child'))!.pendingPlanId).toBeUndefined();
    });
    it('lets an unselected mixed profile practice math and retains its explicit unselected course', async () => {
        const d = await setup('mix');
        await d.foundationCourses.put({ profileId: 'child', unit: 'F01' });
        const entry = await resolveIslandLearningEntry('child', d);
        expect(entry.kind).toBe('island');
        if (entry.kind === 'island') expect(entry.plan.subject).toBe('math');
        expect((await d.foundationCourses.get('child'))!.course).toBeUndefined();
        expect(await d.foundationPlans.count()).toBe(0);
    });
    it('restores foundation snapshots, support, cursor and first answer without replacing the reservation', async () => {
        const d = await setup(); await setFoundationCourse('child', 'foundation', 'F01', d);
        let p = (await reserveFoundationPlan('child', d))!;
        p = await finishFoundationIntroduction('child', p.id, p.revision, d);
        p = await presentFoundationSlot('child', p.id, d);
        const wrong = p.slots[0].choices.find(target => target !== p.slots[0].target)!;
        p = (await commitFoundationAction({ profileId: 'child', planId: p.id, revision: p.revision, action: 'answer', answer: wrong }, d)).plan;
        d.close(); await d.open();
        expect(await resolveIslandLearningEntry('child', d)).toEqual({ kind: 'foundation', plan: p });
        expect(await d.islandPlans.count()).toBe(0);
    });
    it('treats foundation completion as the latest English turn without generating vocabulary logs', async () => {
        const d = await setup(); await setFoundationCourse('child', 'foundation', 'F01', d);
        let p = (await reserveFoundationPlan('child', d))!;
        p = await finishFoundationIntroduction('child', p.id, p.revision, d);
        while (p.status === 'pending') {
            p = await presentFoundationSlot('child', p.id, d);
            p = (await commitFoundationAction({ profileId: 'child', planId: p.id, revision: p.revision, action: 'answer', answer: p.slots[p.cursor].target }, d)).plan;
        }
        const profile = { ...(await d.profiles.get('child'))!, subjectMode: 'mix' as const };
        await d.profiles.put(profile);
        const app = (await d.appData.get('app'))!; await d.appData.put({ ...app, profiles: { child: profile } });
        const next = await resolveIslandLearningEntry('child', d);
        expect(next.kind).toBe('island');
        if (next.kind === 'island') expect(next.plan.subject).toBe('math');
        expect(await d.logs.count()).toBe(0);
        expect(await d.memoryVocab.count()).toBe(0);
        expect(await d.foundationOutbox.count()).toBe(3);
    });
    it('does not undo the saved classic answer when opening the queued foundation section fails', async () => {
        const d = await setup(); let old = await startIslandPlan('child', d);
        await setFoundationCourse('child', 'foundation', 'F02', d);
        old = await beforeFinal(d, old);
        const fail = () => { throw new Error('foundation disk failure'); };
        d.foundationPlans.hook('creating', fail);
        const result = await commitIslandLearningSession('child', old.id, old.revision, correct(old), d);
        d.foundationPlans.hook('creating').unsubscribe(fail);
        expect(result.receipt.plan.status).toBe('completed');
        expect(result.nextPlanError).toBe(true);
        expect((await d.foundationCourses.get('child'))!.pending?.unit).toBe('F02');
        expect((await d.islandPlans.get(old.id))!.status).toBe('completed');
        expect(await d.logs.count()).toBe(old.slots.length);
        expect(await d.foundationPlans.count()).toBe(0);
        const retry = await resolveIslandLearningEntry('child', d);
        expect(retry.kind).toBe('foundation');
        expect((await d.foundationCourses.get('child'))!.pending).toBeUndefined();
    });
});

it('preserves existing introduction practice when the entry agrees with the normal subject scheduler', async () => {
    const d = await setup('mix');
    const id = getSkillsForLevel((await d.profiles.get('child'))!.mathMainLevel)[0];
    const scheduling = vi.spyOn(subjectScheduling, 'selectIslandSubject').mockReturnValue({ subject: 'math', practiceItemIds: [id] });
    const planning = vi.spyOn(parkPlanning, 'planParkLearning');
    try {
        await startIslandPlan('child', d, 'math');
        expect(planning.mock.calls[0][7]?.practiceItemIds).toEqual([id]);
    } finally { scheduling.mockRestore(); planning.mockRestore(); }
});
