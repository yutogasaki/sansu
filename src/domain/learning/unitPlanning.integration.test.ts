import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SansuDatabase, type AttemptLog } from '../../db';
import type { UserProfile } from '../types';
import { createInitialProfile } from '../user/profile';
import { getLevelForSkill } from '../math/curriculum';
import { generateMathProblem, planMathProblems } from '../math';
import { getLearningAttemptTransactionTables, writeLearningAttemptInTransaction } from '../learningAttemptWriter';
import { openPark, startParkPlan } from '../park/repository';
import { openIsland, startIslandPlan } from '../island/repository';
import { getLearningItemMapping } from './catalog';
import { createLearningProblemContext } from './context';
import { evaluateMathLevel11Pilot, type LearningEvidenceRecord } from './evidence';
import { MATH_LV11_UNIT_IDS } from './mathCatalog';
import { createMathPilotScenarios } from './pilotReport';
import { readMathLevel11Pilot } from './pilotRepository';
import { getMathLevel11Practice } from './unitPractice';

const CHILD = 'unit-planning-child';
const NOW = '2026-09-12T12:00:00.000Z';
const databases: SansuDatabase[] = [];
const profile = (main = 11, max = main): UserProfile => {
    const p = { ...createInitialProfile('Unit planning', 2, main, 2, 'math'), id: CHILD,
        mathMainLevel: main, mathMaxUnlocked: max, hissanModeEnabled: false, mathSkills: {} };
    p.mathLevels = p.mathLevels?.map(level => ({ ...level, enabled: level.level <= max, unlocked: level.level <= max }));
    return p;
};
const emptyPractice = () => getMathLevel11Practice(evaluateMathLevel11Pilot([], CHILD, NOW));
const unitId = (itemId: string) => getLearningItemMapping('math', itemId)!.unitId;
const toLog = (record: LearningEvidenceRecord): AttemptLog => ({
    profileId: CHILD, subject: 'math', itemId: record.itemId,
    result: record.result === 'barrier' ? 'incorrect' : record.result,
    timestamp: record.timestamp, isReview: false, learningEvidence: record.learningEvidence,
});
const scenarioLogs = (index: number) => createMathPilotScenarios()[index].records.map(toLog);
const timedLogs = (records: AttemptLog[]) => records.map((record, index) => ({ ...record,
    timestamp: new Date(Date.parse('2026-09-08T10:00:00.000Z') + index * 60_000).toISOString() }));
const saveProfile = async (d: SansuDatabase, p: UserProfile) => {
    await d.profiles.put(p);
    await d.appData.put({ id: 'app', schemaVersion: 1, activeProfileId: CHILD, profiles: { [CHILD]: p } });
};
async function database(p = profile()) {
    const d = new SansuDatabase(`unit-planning-${crypto.randomUUID()}`, { indexedDB, IDBKeyRange });
    databases.push(d);
    await saveProfile(d, p);
    return d;
}
const write = (d: SansuDatabase, log = scenarioLogs(0)[0]) => d.transaction('rw',
    getLearningAttemptTransactionTables(d), async () => writeLearningAttemptInTransaction(d, {
        profileId: CHILD, subject: 'math', itemId: log.itemId, result: log.result,
        timestamp: NOW, isReview: false, isMaintenanceCheck: false, learningEvidence: log.learningEvidence,
    }));

afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    for (const d of databases.splice(0)) { d.close(); await d.delete(); }
});

describe('Lv11 unit planning and persistence integration', () => {
    it.each([0, 0.999])('rotates all seven units through main slots with RNG %s', randomValue => {
        const plans = planMathProblems({ profile: profile(), count: 14, unitPractice: emptyPractice(), random: () => randomValue });
        expect(plans).toHaveLength(14);
        expect(plans.every(item => item.source === 'main' && !item.isReview && !item.countsTowardReviewCap)).toBe(true);
        expect(new Set(plans.slice(0, 7).map(item => unitId(item.skillId)))).toEqual(new Set(MATH_LV11_UNIT_IDS));
        const counts = MATH_LV11_UNIT_IDS.map(id => plans.filter(item => unitId(item.skillId) === id).length);
        expect(counts).toEqual(Array(7).fill(2));
    });

    it('keeps Due admission and daily skips ahead of unit preferences', () => {
        const plan = planMathProblems({ profile: profile(), count: 7, unitPractice: emptyPractice(),
            dueSkillIds: ['count_10'], skippedTodayIds: ['add_2d1d_nc'],
            canAddReview: items => items.filter(item => item.countsTowardReviewCap).length < 1,
            random: () => 0 });
        expect(plan[0]).toMatchObject({ skillId: 'count_10', source: 'due', isReview: true });
        expect(plan.filter(item => item.countsTowardReviewCap)).toHaveLength(1);
        expect(plan.some(item => item.skillId === 'add_2d1d_nc')).toBe(false);
        expect(plan.slice(1).every(item => item.source === 'main')).toBe(true);
    });

    it('keeps disabled parent ranges and the plus-one ceiling intact', () => {
        const p = profile(10, 11);
        const plan = planMathProblems({ profile: p, count: 10, unitPractice: emptyPractice(),
            plusOneRate: 1, plusOneLimit: 3, random: () => 0 });
        expect(plan.filter(item => item.source === 'plus-one')).toHaveLength(3);
        expect(plan.filter(item => item.source === 'main')).toHaveLength(7);
        p.mathLevels = p.mathLevels?.map(level => level.level === 11 ? { ...level, enabled: false } : level);
        const disabled = planMathProblems({ profile: p, count: 10, unitPractice: emptyPractice(),
            dueSkillIds: ['sub_2d2d'], plusOneRate: 1, random: () => 0 });
        expect(disabled).toHaveLength(10);
        expect(disabled.every(item => getLevelForSkill(item.skillId) === 10 && item.source === 'main')).toBe(true);
    });

    it.each([0, 0.999])('generates both requested subtraction variants even with constant RNG %s', randomValue => {
        const planned = planMathProblems({ profile: profile(), count: 14, unitPractice: emptyPractice(), random: () => randomValue });
        const subtraction = planned.filter(item => item.skillId === 'sub_2d2d');
        expect(subtraction.map(item => item.preferredVariant)).toEqual(['no-regroup', 'regroup']);
        for (const selection of subtraction) {
            const problem = generateMathProblem(selection.skillId, { random: () => randomValue,
                preferredLearningVariant: selection.preferredVariant });
            expect(problem.categoryId).toBe('sub_2d2d');
            expect(createLearningProblemContext('math', problem)?.variant).toBe(selection.preferredVariant);
            const [a, b] = problem.questionText!.match(/\d+/g)!.map(Number);
            expect(String(a - b)).toBe(problem.correctAnswer);
            expect(a % 10 < b % 10).toBe(selection.preferredVariant === 'regroup');
        }
    });

    it('refuses addition-only main promotion despite 30 independently correct answers', async () => {
        const d = await database(profile(10, 11));
        await d.logs.bulkAdd(scenarioLogs(0).slice(0, 29));
        const receipt = await write(d);
        expect(await d.logs.count()).toBe(30);
        expect(receipt.profile?.mathMainLevel).toBe(10);
        expect((await readMathLevel11Pilot(d, CHILD, NOW)).practice.missingUnitIds).toHaveLength(6);
    });

    it.each([[3, 11], [4, 10]])('requires 17 of the last 20 in addition to full unit coverage (%s errors)', async (errors, expectedMain) => {
        const d = await database(profile(10, 11));
        const content = generateMathProblem('add_2d1d_nc_bridge', { random: () => 0 });
        const incorrect: AttemptLog = { ...scenarioLogs(0)[0], itemId: content.categoryId, result: 'incorrect',
            learningEvidence: { problem: createLearningProblemContext('math', content)!,
                assistance: 'independent', completion: 'whole-problem' } };
        // Bridge errors are known failures in a separate representation. The
        // seven symbol units stay covered, isolating the recent-accuracy gate.
        const history = timedLogs([...scenarioLogs(3), ...Array<AttemptLog>(errors).fill(incorrect),
            ...scenarioLogs(0).slice(0, 5 - errors)]);
        expect(history).toHaveLength(29);
        await d.logs.bulkAdd(history);
        expect((await readMathLevel11Pilot(d, CHILD, NOW)).practice.coverageReady).toBe(true);
        const receipt = await write(d);
        expect(receipt.profile?.mathMainLevel).toBe(expectedMain);
        expect((await d.profiles.get(CHILD))?.mathMainLevel).toBe(expectedMain);
    });

    it('still requires 30 non-review answers when every unit is covered', async () => {
        const d = await database(profile(10, 11));
        await d.logs.bulkAdd(timedLogs([...scenarioLogs(3), ...scenarioLogs(0).slice(0, 4)]));
        expect((await readMathLevel11Pilot(d, CHILD, NOW)).practice.coverageReady).toBe(true);
        const receipt = await write(d);
        expect(await d.logs.count()).toBe(29);
        expect(receipt.profile?.mathMainLevel).toBe(10);
    });

    it.each([[0, 11], [3, 12]])('requires all units before unlocking Lv12 (scenario %s)', async (scenario, expectedMax) => {
        const p = profile();
        // A previously recorded, known independent window: 16 successes and
        // three errors. The next independent answer reaches exactly 17/20.
        p.mathLevels = p.mathLevels?.map(level => level.level === 11 ? { ...level,
            recentIndependentAnswersNonReview: [...Array<boolean>(16).fill(true), false, false, false] } : level);
        const d = await database(p);
        await d.logs.bulkAdd(scenarioLogs(scenario));
        const receipt = await write(d);
        expect(receipt.profile?.mathMainLevel).toBe(11);
        expect(receipt.profile?.mathMaxUnlocked).toBe(expectedMax);
        expect(receipt.profile?.mathLevels?.find(level => level.level === 11)?.recentIndependentAnswersNonReview)
            .toHaveLength(20);
    });

    it.each(['park', 'island'] as const)('%s reads unit preferences only for new reservations and preserves a resumed problem', async mode => {
        vi.useFakeTimers({ toFake: ['Date'] });
        vi.setSystemTime(new Date(NOW));
        const d = await database();
        await d.logs.bulkAdd(scenarioLogs(0).map((record, index) => ({ ...record,
            timestamp: new Date(Date.parse('2026-09-12T11:00:00.000Z') + index * 1000).toISOString() })));
        if (mode === 'park') await openPark(CHILD, d); else await openIsland(CHILD, d);
        const reserve = () => mode === 'park' ? startParkPlan(CHILD, 'bubble', d) : startIslandPlan(CHILD, d);
        const first = await reserve();
        expect(first.slots[0].source).toBe('main');
        expect(unitId(first.slots[0].problem.categoryId)).not.toBe('math.add-two-one-no-regroup');
        const frozen = structuredClone(first);
        // Changes that would alter a new plan must not regenerate a reservation.
        await d.logs.bulkAdd(scenarioLogs(3));
        const changed = profile();
        changed.mathLevels = changed.mathLevels?.map(level => ({ ...level, enabled: false }));
        await saveProfile(d, changed);
        vi.setSystemTime(new Date('2026-10-12T12:00:00.000Z'));
        expect(await reserve()).toEqual(frozen);
        expect(mode === 'park' ? await d.parkPlans.get(first.id) : await d.islandPlans.get(first.id)).toEqual(frozen);
    });
});
