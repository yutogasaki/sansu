import { afterEach, describe, expect, it, vi } from 'vitest';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { SansuDatabase } from '../../db';
import { createInitialProfile } from '../user/profile';
import { parkHissanGrid } from '../park/learning';
import { commitIslandLearning } from './commit';
import { openIsland, startIslandPlan, assertIsland } from './repository';
import { advanceHomeJourney, homeJourneyView } from './homeJourney';
import type { IslandEvent, IslandPlan } from './types';
const databases: SansuDatabase[] = [];
afterEach(async () => { vi.unstubAllEnvs(); for (const d of databases.splice(0)) { d.close(); await d.delete(); } });
async function setup() {
    const d = new SansuDatabase(`home-journey-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange }); databases.push(d);
    const profile = { ...createInitialProfile('test', 2, 1, 1, 'math'), id: 'child' };
    await d.profiles.put(profile);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: 'child', profiles: { child: profile } });
    await openIsland('child', d); return d;
}
function correct(plan: IslandPlan) {
    const slot = plan.slots[plan.cursor], grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
}
async function finish(d: SansuDatabase, plan: IslandPlan) {
    while (plan.status === 'active') plan = (await commitIslandLearning('child', plan.id, plan.revision, correct(plan), d)).plan;
    return plan;
}
describe('home journey reservation and persistence', () => {
    it('reaches the same milestones with 3 or 6 question completions and stops at the finite end', () => {
        let state;
        for (let i = 0; i < 15; i++) state = advanceHomeJourney(state, 3);
        expect(homeJourneyView(state)).toMatchObject({ answers: 45, home: 3, shop: 2, bench: 2, flower: 2 });
        let other = advanceHomeJourney(undefined, 3);
        for (let i = 0; i < 7; i++) other = advanceHomeJourney(other, 6);
        expect(other).toEqual(state); expect(advanceHomeJourney(other, 6)).toEqual(other);
    });
    it('does not retrofit an existing reservation and freezes opt-in through flag removal', async () => {
        const d = await setup(), old = await startIslandPlan('child', d);
        vi.stubEnv('VITE_HOME_JOURNEY_PREVIEW', 'true');
        expect((await startIslandPlan('child', d)).homeJourneyVersion).toBeUndefined();
        await finish(d, old); expect((await d.islands.get('child'))?.homeJourney).toBeUndefined();
        const fresh = await startIslandPlan('child', d); expect(fresh.homeJourneyVersion).toBe(1);
        vi.stubEnv('VITE_HOME_JOURNEY_PREVIEW', 'false'); await finish(d, fresh);
        expect((await d.islands.get('child'))?.homeJourney?.answers).toBe(fresh.slots.length);
    });
    it('rolls back a failed final save and ignores duplicate receipts after reopening', async () => {
        vi.stubEnv('VITE_HOME_JOURNEY_PREVIEW', 'true'); const d = await setup(); let plan = await startIslandPlan('child', d);
        while (plan.cursor < plan.slots.length - 1) plan = (await commitIslandLearning('child', plan.id, plan.revision, correct(plan), d)).plan;
        const action = correct(plan), before = await d.islands.get('child');
        const fail = (_key: unknown, event: IslandEvent) => { if (event.type === 'plan_completed') throw new Error('save-failed'); };
        d.islandEvents.hook('creating', fail);
        await expect(commitIslandLearning('child', plan.id, plan.revision, action, d)).rejects.toThrow('save-failed');
        d.islandEvents.hook('creating').unsubscribe(fail); expect(await d.islands.get('child')).toEqual(before);
        await commitIslandLearning('child', plan.id, plan.revision, action, d);
        const after = await d.islands.get('child'); expect(after?.homeJourney?.answers).toBe(3);
        d.close(); await d.open(); await commitIslandLearning('child', plan.id, plan.revision, action, d);
        expect(await d.islands.get('child')).toEqual(after);
    });
    it('counts supported completion without requiring independent correctness', async () => {
        vi.stubEnv('VITE_HOME_JOURNEY_PREVIEW', 'true'); const d = await setup(); let plan = await startIslandPlan('child', d);
        while (plan.status === 'active') {
            for (const type of ['support_opened', 'model_opened', 'supported_completed'] as const)
                plan = (await commitIslandLearning('child', plan.id, plan.revision, { type }, d)).plan;
        }
        const island = (await d.islands.get('child'))!;
        expect(island.homeJourney?.answers).toBe(3);
        expect(() => assertIsland({ ...island, homeJourney: { version: 1, answers: NaN } })).toThrow();
    });
});
