import Dexie from 'dexie';
import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase, SANSU_V6_STORES } from '../../db';
import { createInitialProfile } from '../user/profile';
import { deleteProfileOwnedIndexedDbRows } from '../user/repository';
import { getLevelForSkill, getSkillsForLevel } from '../math/curriculum';
import { ENGLISH_WORDS } from '../english/words';
import { parkHissanGrid } from '../park/learning';
import { createPark } from '../park/course';
import type { MemoryState, UserProfile } from '../types';
import { createIsland, findAvailablePosition, ISLAND_EAST_LAND, ISLAND_ITEMS, ISLAND_MAIN_LAND,
    ISLAND_RESERVED_AREAS, ISLAND_WEST_LAND, isValidIslandPlacement } from './catalog';
import { claimIslandReward, IslandConflict, islandTables, openIsland, saveIslandEdit, startIslandPlan } from './repository';
import { commitIslandLearning } from './commit';
import type { IslandPlan } from './types';

const databases: SansuDatabase[] = [];
const options = { indexedDB, IDBKeyRange };
const profile = (id = 'child', level = 1, subject: UserProfile['subjectMode'] = 'math') => ({
    ...createInitialProfile('test', 2, level, 1, subject), id, soundEnabled: false,
});
const memory = (id: string, profileId = 'child'): MemoryState => ({
    id, profileId, strength: 4, totalAnswers: 10, correctAnswers: 10, incorrectAnswers: 0, skippedAnswers: 0,
    updatedAt: '2026-01-01', nextReview: '2099-01-01', status: 'active',
});
const setup = async (p = profile(), familiar = false) => {
    const database = new SansuDatabase(`island-test-${crypto.randomUUID()}`, options);
    databases.push(database);
    await database.profiles.put(p);
    await database.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: p.id, profiles: { [p.id]: p } });
    if (familiar) {
        await database.memoryMath.bulkPut(getSkillsForLevel(p.mathMainLevel).map(id => memory(id, p.id)));
        await database.memoryVocab.bulkPut(ENGLISH_WORDS.map(word => memory(word.id, p.id)));
    }
    await openIsland(p.id, database);
    return database;
};
const correctAction = (plan: IslandPlan) => {
    const slot = plan.slots[plan.cursor];
    const grid = parkHissanGrid(slot.problem);
    return { type: 'answer' as const, answer: grid ? grid.steps[slot.hissanStep ?? 0].correctValues : slot.problem.correctAnswer };
};
const finish = async (database: SansuDatabase, plan: IslandPlan) => {
    let current = plan;
    while (current.status === 'active') current = (await commitIslandLearning(current.profileId, current.id, current.revision, correctAction(current), database)).plan;
    return current;
};
// Explicit old-plan compatibility: only reservations without the new marker issue gifts.
async function startLegacyGiftPlan(d: SansuDatabase) {
    const plan = await startIslandPlan('child', d);
    delete plan.growthTarget;
    await d.islandPlans.put(plan);
    return plan;
}
afterEach(async () => {
    for (const database of databases.splice(0)) { database.close(); await database.delete(); }
});

describe('island frozen learning sets', () => {
    it('reserves three introductory questions, then six familiar questions, and restores the exact plan', async () => {
        const known = await setup(profile(), true);
        const fresh = await setup();
        const introduction = await startIslandPlan('child', known);
        expect(introduction.slots).toHaveLength(3);
        expect(await known.logs.count()).toBe(0);
        await finish(known, introduction);
        expect((await startIslandPlan('child', known)).slots).toHaveLength(6);
        const before = await fresh.appData.get('app');
        const first = await startIslandPlan('child', fresh);
        expect(first.slots).toHaveLength(3);
        expect(await fresh.logs.count()).toBe(0);
        expect(await fresh.appData.get('app')).toEqual(before);
        const changed = { ...before!.profiles.child, mathMainLevel: 20, mathMaxUnlocked: 20 };
        await fresh.appData.put({ ...before!, profiles: { child: changed } });
        fresh.close(); await fresh.open();
        expect(await startIslandPlan('child', fresh)).toEqual(first);
        expect(await fresh.islandEvents.where('type').equals('plan_started').count()).toBe(1);
    });

    it('rolls back a failed reservation and leaves the same set identity available for retry', async () => {
        const d = await setup();
        const before = await d.islands.get('child');
        const fail = () => { throw new Error('disk full'); };
        d.islandEvents.hook('creating', fail);
        await expect(startIslandPlan('child', d)).rejects.toThrow('disk full');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await d.islands.get('child')).toEqual(before);
        expect(await d.islandPlans.count()).toBe(0);
        expect((await startIslandPlan('child', d)).id).toBe(JSON.stringify(['island-plan-v1', 'child', 0]));
    });

    it('keeps wrong answers on the same problem and assistance sticky without fabricating mastery', async () => {
        const d = await setup(profile(), true);
        let plan = await startIslandPlan('child', d);
        const original = plan.slots[0].problem;
        plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'answer', answer: 'wrong' }, d)).plan;
        expect(plan.cursor).toBe(0);
        expect(plan.slots[0].problem).toEqual(original);
        const afterWrong = await d.memoryMath.get(['child', original.categoryId]);
        plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'support_opened' }, d)).plan;
        d.close(); await d.open();
        expect((await startIslandPlan('child', d)).slots[0].assisted).toBe(true);
        plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        expect(plan.cursor).toBe(1);
        const assistedMemory = await d.memoryMath.get(['child', original.categoryId]);
        expect(assistedMemory?.strength).toBe(afterWrong?.strength);
        expect(assistedMemory?.correctAnswers).toBe(afterWrong?.correctAnswers);
        expect(Date.parse(assistedMemory!.nextReview)).toBeLessThanOrEqual(Date.now());
        expect(await d.logs.toArray()).toEqual([expect.objectContaining({ result: 'incorrect' })]);
        expect(await d.islandEvents.where('type').equals('answer').last()).toMatchObject({ result: 'assisted-correct' });
    });

    it('records a real skip then opens persisted support on the same slot, preserving its later growth', async () => {
        const d = await setup();
        let plan = await startIslandPlan('child', d);
        const original = plan.slots[0].problem;
        plan = (await commitIslandLearning('child', plan.id, plan.revision, { type: 'skipped' }, d)).plan;
        expect(plan.cursor).toBe(0);
        expect(plan.slots[0]).toMatchObject({ problem: original, assisted: true, completed: false });
        d.close(); await d.open();
        expect((await startIslandPlan('child', d)).slots[0].assisted).toBe(true);
        plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        expect(await d.logs.toArray()).toEqual([expect.objectContaining({ result: 'skipped', itemId: original.categoryId })]);
        await finish(d, plan);
        expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(0);
        expect((await d.islands.get('child'))?.growth?.progress.garden).toBe(1);
        expect((await d.memoryMath.get(['child', original.categoryId]))?.skippedAnswers).toBe(1);
    });

    it('supports mixed vocabulary sets and applies vocabulary progression only to independent answers', async () => {
        const p = { ...profile('child', 1, 'mix'), vocabLevels: [{ level: 1, unlocked: true, enabled: true,
            recentAnswersNonReview: Array(19).fill(true), recentIndependentAnswersNonReview: Array(19).fill(true) }] };
        const d = await setup(p, true);
        const math = await startIslandPlan('child', d);
        expect(math.subject).toBe('math');
        await finish(d, math);
        let vocab = await startIslandPlan('child', d);
        expect(vocab.subject).toBe('vocab');
        expect(vocab.slots).toHaveLength(6);
        expect(vocab.slots.every(slot => slot.problem.inputType === 'choice' && slot.problem.inputConfig?.choices?.length === 4)).toBe(true);
        const frozen = structuredClone(vocab);
        d.close(); await d.open();
        expect(await startIslandPlan('child', d)).toEqual(frozen);
        vocab = (await commitIslandLearning('child', vocab.id, vocab.revision, { type: 'support_opened' }, d)).plan;
        vocab = (await commitIslandLearning('child', vocab.id, vocab.revision, correctAction(vocab), d)).plan;
        expect((await d.profiles.get('child'))?.vocabMaxUnlocked).toBe(1);
        await commitIslandLearning('child', vocab.id, vocab.revision, correctAction(vocab), d);
        expect((await d.profiles.get('child'))?.vocabMaxUnlocked).toBe(2);
    });

    it('preserves fraction multi-input and stepwise written arithmetic in complete reserved plans', async () => {
        for (const skill of ['frac_add_same', 'add_2d1d_hissan_c']) {
            const level = getLevelForSkill(skill);
            expect(level).not.toBeNull();
            const d = await setup(profile('child', level!), true);
            await d.memoryMath.put({ ...memory(skill), nextReview: '2000-01-01' });
            let plan = await startIslandPlan('child', d);
            expect(plan.slots[0].problem.categoryId).toBe(skill);
            expect(plan.slots).toHaveLength(3);
            const slot = plan.slots[0];
            if (parkHissanGrid(slot.problem)) {
                const grid = parkHissanGrid(slot.problem)!;
                for (let step = 0; step < grid.steps.length; step += 1) {
                    plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
                    expect(await d.logs.count()).toBe(step === grid.steps.length - 1 ? 1 : 0);
                    d.close(); await d.open();
                    expect(await startIslandPlan('child', d)).toEqual(plan);
                }
            } else {
                expect(slot.problem.inputType).toBe('multi-number');
                plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
                expect(await d.logs.count()).toBe(1);
            }
            expect(plan.cursor).toBe(1);
        }
    });
});

describe('legacy frozen-plan atomic completion and deferred rewards', () => {
    it('serializes final answers across tabs and gives one entitlement with exactly one final log', async () => {
        const d = await setup();
        let plan = await startLegacyGiftPlan(d);
        while (plan.cursor < plan.slots.length - 1) plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        const second = new SansuDatabase(d.name, options);
        await second.open();
        try {
            const action = correctAction(plan);
            await Promise.all([commitIslandLearning('child', plan.id, plan.revision, action, d), commitIslandLearning('child', plan.id, plan.revision, action, second)]);
            await commitIslandLearning('child', plan.id, plan.revision, action, d);
            expect(await d.logs.count()).toBe(plan.slots.length);
            expect((await d.islands.get('child'))?.pendingRewards).toEqual([{ id: plan.rewardId, planId: plan.id, choices: plan.rewardChoices, earnedAt: expect.any(Number) }]);
            expect((await d.islands.get('child'))?.completedSets).toBe(1);
            expect(await d.islandEvents.where('type').equals('plan_completed').count()).toBe(1);
            expect(await d.parks.count()).toBe(0);
            await expect(commitIslandLearning('child', plan.id, plan.revision, { type: 'skipped' }, d)).rejects.toBeInstanceOf(IslandConflict);
        } finally { second.close(); }
    });

    it('rolls back the last answer, learning, cursor and entitlement if its completion event fails', async () => {
        const d = await setup();
        let plan = await startLegacyGiftPlan(d);
        while (plan.cursor < plan.slots.length - 1) plan = (await commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).plan;
        const snapshot = async () => ({ island: await d.islands.get('child'), profile: await d.appData.get('app'), logs: await d.logs.toArray(), memory: await d.memoryMath.toArray(), events: await d.islandEvents.toArray() });
        const before = await snapshot();
        const fail = (_key: unknown, event: { type: string }) => { if (event.type === 'plan_completed') throw new Error('disk failure'); };
        d.islandEvents.hook('creating', fail);
        await expect(commitIslandLearning('child', plan.id, plan.revision, correctAction(plan), d)).rejects.toThrow('disk failure');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await snapshot()).toEqual(before);
        expect(await d.islandPlans.get(plan.id)).toEqual(plan);
        await finish(d, plan);
        expect((await d.islands.get('child'))?.pendingRewards).toHaveLength(1);
    });

    it('lets new sets continue with rewards deferred and persists exactly one selected object across retries', async () => {
        const d = await setup();
        await finish(d, await startLegacyGiftPlan(d));
        const firstIsland = (await d.islands.get('child'))!;
        const reward = firstIsland.pendingRewards[0];
        const next = await startLegacyGiftPlan(d);
        expect(next.id).not.toBe(reward.planId);
        expect((await d.islands.get('child'))?.pendingRewards[0]).toEqual(reward);
        await expect(claimIslandReward('child', firstIsland.revision, reward.id, reward.choices[0], d)).rejects.toBeInstanceOf(IslandConflict);
        const island = (await d.islands.get('child'))!;
        const claimed = await claimIslandReward('child', island.revision, reward.id, reward.choices[0], d);
        expect(claimed.pendingPlanId).toBe(next.id);
        expect(claimed.pendingRewards).toHaveLength(0);
        expect(claimed.items.at(-1)).toEqual({ id: `${reward.id}:item`, kind: reward.choices[0], rotation: 0 });
        d.close(); await d.open();
        expect(await claimIslandReward('child', island.revision, reward.id, reward.choices[0], d)).toEqual(claimed);
        await expect(claimIslandReward('child', claimed.revision, reward.id, reward.choices[1], d)).rejects.toBeInstanceOf(IslandConflict);
        await finish(d, next);
        const expanded = (await d.islands.get('child'))!;
        expect(expanded.completedSets).toBe(2);
        expect(expanded.pendingRewards).toHaveLength(1);
        expect(expanded.items).toHaveLength(3);
    });

    it('rolls back a reward claim when its receipt fails, retaining the saved choices', async () => {
        const d = await setup();
        await finish(d, await startLegacyGiftPlan(d));
        const island = (await d.islands.get('child'))!;
        const reward = island.pendingRewards[0];
        const fail = (_key: unknown, event: { type: string }) => { if (event.type === 'reward_claimed') throw new Error('claim write failed'); };
        d.islandEvents.hook('creating', fail);
        await expect(claimIslandReward('child', island.revision, reward.id, reward.choices[0], d)).rejects.toThrow('claim write failed');
        d.islandEvents.hook('creating').unsubscribe(fail);
        expect(await d.islands.get('child')).toEqual(island);
        expect((await claimIslandReward('child', island.revision, reward.id, reward.choices[0], d)).items).toHaveLength(3);
    });

    it('resolves simultaneous different reward choices to one object and rejects the losing choice', async () => {
        const d = await setup();
        await finish(d, await startLegacyGiftPlan(d));
        const island = (await d.islands.get('child'))!;
        const reward = island.pendingRewards[0];
        const second = new SansuDatabase(d.name, options);
        await second.open();
        try {
            const results = await Promise.allSettled([
                claimIslandReward('child', island.revision, reward.id, reward.choices[0], d),
                claimIslandReward('child', island.revision, reward.id, reward.choices[1], second),
            ]);
            expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
            expect((await d.islands.get('child'))?.items).toHaveLength(3);
            expect(await d.islandEvents.where('type').equals('reward_claimed').count()).toBe(1);
        } finally { second.close(); }
    });
});

describe('free placement and ownership', () => {
    it('opens substantial outer land without invalidating any position from the earlier shore', () => {
        const island = createIsland('shore-compatibility', 0);
        // Existing saves predate habitat-earned chapters and retain their old shores.
        delete island.growth!.expansionLevel;
        for (const [land, completedSets, sign] of [[ISLAND_EAST_LAND, 2, 1], [ISLAND_WEST_LAND, 12, -1]] as const) {
            expect(land.radiusX * land.radiusZ / (ISLAND_MAIN_LAND.radiusX * ISLAND_MAIN_LAND.radiusZ)).toBeGreaterThan(.58);
            expect(land.x - sign * land.radiusX).toBeCloseTo(sign * 4.3);
            for (const [kind, { radius }] of Object.entries(ISLAND_ITEMS)) {
                const item = { ...island.items[0], kind: kind as keyof typeof ISLAND_ITEMS };
                const layout = { ...island, completedSets, items: [item] };
                for (let sample = 0; sample < 72; sample++) {
                    const angle = sample / 72 * Math.PI * 2;
                    const position = { x: sign * 6.2 + Math.cos(angle) * (1.9 - radius) * .999,
                        z: Math.sin(angle) * (2.3 - radius) * .999 };
                    if (ISLAND_RESERVED_AREAS.some(area => Math.hypot(position.x - area.x, position.z - area.z) < radius + area.radius)) continue;
                    expect(isValidIslandPlacement(layout, item.id, position), `${kind}: ${JSON.stringify(position)}`).toBe(true);
                }
                const outer = { x: sign * 9, z: 1 };
                expect(isValidIslandPlacement(layout, item.id, outer)).toBe(true);
                expect(isValidIslandPlacement({ ...layout, completedSets: completedSets - 1 }, item.id, outer)).toBe(false);
            }
        }
    });

    it.each([[2, 1], [12, -1]])('finds new outer ground when the previous area is full at section %s', (completedSets, sign) => {
        const island = { ...createIsland('outer-placement', 0), completedSets };
        delete island.growth!.expansionLevel;
        // Deliberately dense legacy possessions block the old search range.
        for (let x = sign > 0 ? -4.5 : -8; x <= (sign > 0 ? 8 : 10); x += .5) {
            for (let z = -3.5; z <= 3.5; z += .5) island.items.push({ id: `${x}:${z}`, kind: 'flower', rotation: 0, position: { x, z } });
        }
        const before = structuredClone(island), item = island.items[0];
        const position = findAvailablePosition(island, item.kind, item.id);
        expect(position).toBeDefined();
        expect(position!.x * sign).toBeGreaterThan(8);
        expect(isValidIslandPlacement(island, item.id, position!)).toBe(true);
        expect(island).toEqual(before);
    });

    it('supports moving, rotating, storing and restoring a unique item without adding any learning', async () => {
        const d = await setup();
        let island = (await d.islands.get('child'))!;
        const item = island.items[0];
        const position = findAvailablePosition(island, item.kind, item.id)!;
        const edit = { type: 'place' as const, itemId: item.id, position, rotation: Math.PI / 2 };
        const initialRevision = island.revision;
        island = await saveIslandEdit('child', island.revision, edit, d);
        expect(await saveIslandEdit('child', initialRevision, edit, d)).toEqual(island);
        expect(island.items[0]).toMatchObject({ position, rotation: Math.PI / 2 });
        await expect(saveIslandEdit('child', initialRevision, { type: 'store', itemId: item.id }, d)).rejects.toBeInstanceOf(IslandConflict);
        island = await saveIslandEdit('child', island.revision, { type: 'store', itemId: item.id }, d);
        expect(island.items[0].position).toBeUndefined();
        d.close(); await d.open();
        expect(await openIsland('child', d)).toEqual(island);
        island = await saveIslandEdit('child', island.revision, edit, d);
        expect(island.items).toHaveLength(2);
        expect(await d.logs.count()).toBe(0);
    });

    it('rejects water, houses, trees, collisions and premature expansion while finding clear positions for every kind', () => {
        const island = createIsland('child', 0);
        const item = island.items[0];
        for (const position of [{ x: NaN, z: 0 }, { x: 0, z: 4 }, { x: -2.6, z: -1.65 }, { x: 1.6, z: -1.6 }, island.items[1].position!, { x: 6.2, z: 0 }]) {
            expect(isValidIslandPlacement(island, item.id, position)).toBe(false);
        }
        const expanded = { ...island, growth: { ...island.growth!, expansionLevel: 1 as const } };
        expect(isValidIslandPlacement(expanded, item.id, { x: 6.2, z: 0 })).toBe(true);
        for (const completedSets of [2, 4, 6]) {
            expect(isValidIslandPlacement({ ...expanded, completedSets }, item.id, { x: 6.35, z: -1.16 })).toBe(false);
            expect(isValidIslandPlacement({ ...expanded, completedSets }, item.id, { x: 4.75, z: 0 })).toBe(false);
        }
        for (const kind of Object.keys(ISLAND_ITEMS) as (keyof typeof ISLAND_ITEMS)[]) expect(findAvailablePosition(island, kind)).toBeDefined();
    });

    it('keeps the saved island and event history intact after an invalid placement or stale edit', async () => {
        const d = await setup();
        const island = (await d.islands.get('child'))!;
        const edit = { type: 'place' as const, itemId: island.items[0].id, position: island.items[1].position!, rotation: 0 };
        await expect(saveIslandEdit('child', island.revision, edit, d)).rejects.toBeInstanceOf(IslandConflict);
        await startIslandPlan('child', d);
        const started = await d.islands.get('child');
        await expect(saveIslandEdit('child', island.revision, { type: 'store', itemId: island.items[0].id }, d)).rejects.toBeInstanceOf(IslandConflict);
        expect(await d.islands.get('child')).toEqual(started);
        expect(await d.islandEvents.where('type').equals('item_edited').count()).toBe(0);
    });

    it('rejects stale profile actions and deletes only the removed profile island rows', async () => {
        const d = await setup();
        const plan = await startIslandPlan('child', d);
        await finish(d, plan);
        const other = profile('other');
        const app = (await d.appData.get('app'))!;
        await d.profiles.put(other);
        await d.appData.put({ ...app, activeProfileId: 'other', profiles: { ...app.profiles, other } });
        await openIsland('other', d);
        await startIslandPlan('other', d);
        await expect(commitIslandLearning('child', plan.id, 0, correctAction(plan), d)).rejects.toBeInstanceOf(IslandConflict);
        await expect(openIsland('child', d)).rejects.toBeInstanceOf(IslandConflict);
        await d.transaction('rw', [...islandTables(d), d.exploreRuns, d.exploreRunEvents, d.exploreDiscoveries, d.parks, d.parkPlans, d.parkEvents], () => deleteProfileOwnedIndexedDbRows(d, 'child'));
        expect(await d.islands.get('child')).toBeUndefined();
        expect(await d.islandPlans.where('profileId').equals('child').count()).toBe(0);
        expect(await d.islandEvents.where('profileId').equals('child').count()).toBe(0);
        expect(await d.islands.get('other')).toBeDefined();
        expect(await d.islandPlans.where('profileId').equals('other').count()).toBe(1);
        expect(await d.islandEvents.where('profileId').equals('other').count()).toBe(1);
    });

    it('adds v7 island tables without changing v6 profiles, park plans or old exploration checkpoints', async () => {
        const name = `island-migration-${crypto.randomUUID()}`;
        const legacy = new Dexie(name, options);
        legacy.version(6).stores(SANSU_V6_STORES);
        const p = profile();
        const park = createPark(p.id, 1);
        const run = { runId: 'legacy', profileId: p.id, status: 'active', activeCheckpoint: { revision: 4, payload: 'untouched' } };
        const parkPlan = { id: 'park-plan', profileId: p.id, status: 'active', slots: [{ problem: { original: 'saved' } }] };
        await legacy.table('profiles').put(p);
        await legacy.table('parks').put(park);
        await legacy.table('parkPlans').put(parkPlan);
        await legacy.table('exploreRuns').put(run);
        legacy.close();
        const d = new SansuDatabase(name, options); databases.push(d);
        await d.open();
        expect(d.verno).toBe(7);
        expect(await d.profiles.get(p.id)).toEqual(p);
        expect(await d.parks.get(p.id)).toEqual(park);
        expect(await d.parkPlans.get(parkPlan.id)).toEqual(parkPlan);
        expect(await d.exploreRuns.get(run.runId)).toEqual(run);
        expect(await d.islands.count()).toBe(0);
    });
});
