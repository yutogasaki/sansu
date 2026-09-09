import { indexedDB, IDBKeyRange } from 'fake-indexeddb';
import { afterEach, describe, expect, it } from 'vitest';
import { SansuDatabase } from '../../db';
import { getAvailableSkills } from '../math/curriculum';
import { createInitialProfile } from './profile';
import { completeOnboardingProfile, onboardingDestination, OnboardingAlreadyCompleted, OnboardingConflict,
    ONBOARDING_GRADES, ONBOARDING_MATH_RANGES, resolveOnboardingSelection, type OnboardingSelection } from './onboarding';

const options = { indexedDB, IDBKeyRange };
const databases: SansuDatabase[] = [];
const selection: OnboardingSelection = { name: '', grade: 2, subject: 'math', mathRange: 'q_sub', englishRange: null };
const database = () => { const d = new SansuDatabase(`onboarding-${crypto.randomUUID()}`, options); databases.push(d); return d; };
const snapshot = async (d: SansuDatabase) => Object.fromEntries(await Promise.all(d.tables.map(async table => [table.name, await table.toArray()])));
afterEach(async () => { for (const d of databases.splice(0)) { d.close(); await d.delete(); } });

describe('explicit first learning setup', () => {
    it('uses the parent grade adjustments capped at the chosen topic and preserves English placement', () => {
        const bases = [[-2, 0], [-1, 2], [0, 8], [1, 10], [2, 11], [3, 13], [4, 14], [5, 15], [6, 16]];
        const adjustments = { q_count: -6, q_add: -3, q_sub: -1, q_col: 1, q_mul: 4 } as const;
        const topicEnds = { q_count: 7, q_add: 9, q_sub: 10, q_col: 11, q_mul: 14 } as const;
        for (const [grade, base] of bases) for (const [mathRange, adjustment] of Object.entries(adjustments)) {
            const range = mathRange as keyof typeof adjustments;
            const resolved = resolveOnboardingSelection({ ...selection, grade, mathRange: range }, 'first');
            expect(resolved.mathStartLevel).toBe(Math.max(1, Math.min(topicEnds[range], base + adjustment)));
        }
        for (const [englishRange, level] of Object.entries({ beginner: 1, some: 4, confident: 7 } as const)) {
            const resolved = resolveOnboardingSelection({ ...selection, subject: 'mix', englishRange: englishRange as 'beginner' | 'some' | 'confident' }, 'first');
            expect(resolved.vocabStartLevel).toBe(level);
        }
    });

    it('keeps every range available and ordered for preschool through sixth grade', () => {
        for (const { value: grade } of ONBOARDING_GRADES) {
            const levels = ONBOARDING_MATH_RANGES.map(({ value: mathRange }) =>
                resolveOnboardingSelection({ ...selection, grade, mathRange }, 'first').mathStartLevel);
            expect(levels).toEqual([...levels].sort((a, b) => a - b));
            expect(levels.at(-1)).toBe(28);
        }
    });

    it.each([
        ['q_div', 18, 19], ['q_decimal', 19, 20], ['q_decimal_mul', 20, 21],
        ['q_fraction', 22, 23], ['q_fraction_mul', 24, 25], ['q_application', 27, 28], ['q_speed', 28, 28],
    ] as const)('starts beyond %s for both second and sixth graders without inventing answer evidence', async (mathRange, start, main) => {
        for (const grade of [2, 6]) for (const intent of ['first', 'legacy-first', 'add'] as const) {
            const d = database();
            const chosen = { ...selection, name: 'あおい', grade, mathRange };
            const result = await completeOnboardingProfile(chosen, 'new-profile', intent, d);
            expect(result.profile).toMatchObject({ islandTutorialVersion: 1, grade, mathStartLevel: start, mathMainLevel: main,
                mathMaxUnlocked: main, todayCount: 0, recentAttempts: [] });
            const rows = await d.memoryMath.toArray();
            expect(rows.map(row => row.id).sort()).toEqual([...getAvailableSkills(start)].sort());
            expect(rows.every(row => row.status === 'retired' && row.totalAnswers === 0 && row.correctAnswers === 0)).toBe(true);
            expect(await d.logs.count()).toBe(0);
            expect(await d.islandPlans.count()).toBe(0);
            expect(await completeOnboardingProfile(chosen, 'new-profile', intent, d)).toEqual(result);
            expect(await d.memoryMath.toArray()).toEqual(rows);
        }
    });

    it('does not retire written multiplication, division or decimals when a sixth grader chooses only九九', async () => {
        const d = database();
        const { profile } = await completeOnboardingProfile({ ...selection, grade: 6, mathRange: 'q_mul' }, 'sixth', 'first', d);
        expect(profile).toMatchObject({ mathStartLevel: 14, mathMainLevel: 15, mathMaxUnlocked: 15 });
        expect((await d.memoryMath.toArray()).map(row => row.id).sort()).toEqual([...getAvailableSkills(14)].sort());
    });

    it('rejects missing or invalid required choices before creating any data', async () => {
        const d = database(), before = await snapshot(d);
        for (const incomplete of [
            { grade: null }, { grade: 7 }, { grade: 1.5 }, { subject: null }, { mathRange: null },
            { subject: 'mix' as const }, { subject: 'vocab' as const, mathRange: null },
        ]) {
            await expect(completeOnboardingProfile({ ...selection, ...incomplete }, 'create-first', 'first', d)).rejects.toBeInstanceOf(OnboardingConflict);
            expect(await snapshot(d)).toEqual(before);
        }
    });

    it('allows an unnamed first profile, seeds only its explicit math range and creates no answers or game progress', async () => {
        const d = database();
        const result = await completeOnboardingProfile(selection, 'first', 'first', d);
        expect(result.profile).toMatchObject({ id: 'first', name: 'プレイヤー', grade: 2, subjectMode: 'math',
            mathStartLevel: 10, mathMainLevel: 11, mathMaxUnlocked: 11, vocabStartLevel: 1, todayCount: 0, recentAttempts: [] });
        const rows = await d.memoryMath.toArray();
        expect(rows.map(row => row.id).sort()).toEqual([...getAvailableSkills(10)].sort());
        expect(rows.every(row => row.profileId === 'first' && row.status === 'retired' && row.strength === 5
            && row.totalAnswers === 0 && row.correctAnswers === 0 && row.incorrectAnswers === 0 && row.skippedAnswers === 0)).toBe(true);
        expect(await d.appData.get('app')).toMatchObject({ activeProfileId: 'first', profiles: { first: result.profile } });
        for (const table of [d.logs, d.memoryVocab, d.islands, d.islandPlans, d.islandEvents, d.exploreRuns, d.parkPlans]) expect(await table.count()).toBe(0);
    });

    it('creates no retired math or learning evidence for a new vocab-only choice', async () => {
        const d = database();
        const result = await completeOnboardingProfile({ ...selection, subject: 'vocab', mathRange: null, englishRange: 'some' }, 'vocab', 'first', d);
        expect(result.profile).toMatchObject({ mathStartLevel: 11, mathMainLevel: 12, mathMaxUnlocked: 12,
            mathSkills: {}, vocabStartLevel: 4, vocabMainLevel: 4, vocabMaxUnlocked: 4 });
        expect(await d.memoryMath.count()).toBe(0);
        expect(await d.memoryVocab.count()).toBe(0);
        expect(await d.logs.count()).toBe(0);
    });
});

describe('one atomic profile completion', () => {
    it('returns one profile and unchanged seed rows for parallel same-ID submissions and retry after reload', async () => {
        const d = database(), second = new SansuDatabase(d.name, options);
        try {
            await second.open();
            const [one, two] = await Promise.all([completeOnboardingProfile(selection, 'same', 'first', d), completeOnboardingProfile(selection, 'same', 'first', second)]);
            expect(two).toEqual(one);
            const before = await snapshot(d);
            d.close(); await d.open();
            expect(await completeOnboardingProfile(selection, 'same', 'first', d)).toEqual(one);
            expect(await snapshot(d)).toEqual(before);
            expect(await d.profiles.count()).toBe(1);
        } finally { second.close(); }
    });

    it('serializes different-tab initial creations without guessing or overwriting the winner', async () => {
        const d = database(), second = new SansuDatabase(d.name, options);
        try {
            await second.open();
            const outcomes = await Promise.allSettled([completeOnboardingProfile(selection, 'first-a', 'first', d),
                completeOnboardingProfile({ ...selection, grade: 6, mathRange: 'q_mul' }, 'first-b', 'first', second)]);
            expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
            const rejected = outcomes.find(result => result.status === 'rejected');
            expect(rejected?.status === 'rejected' && rejected.reason).toBeInstanceOf(OnboardingAlreadyCompleted);
            expect(await d.profiles.count()).toBe(1);
            const saved = (await d.profiles.toArray())[0];
            expect((await d.memoryMath.toArray()).every(row => row.profileId === saved.id)).toBe(true);
        } finally { second.close(); }
    });

    it('rolls back profile, active owner and seed rows together, then retries the same creation ID', async () => {
        const d = database(), before = await snapshot(d);
        const fail = () => { throw new Error('disk full'); };
        d.appData.hook('creating', fail);
        try { await expect(completeOnboardingProfile(selection, 'retry', 'first', d)).rejects.toThrow('disk full'); }
        finally { d.appData.hook('creating').unsubscribe(fail); }
        expect(await snapshot(d)).toEqual(before);
        const result = await completeOnboardingProfile(selection, 'retry', 'first', d);
        expect(result.profile.id).toBe('retry');
        expect(await d.profiles.count()).toBe(1);
    });

    it('rejects changed creation choices without rewriting the existing profile or SRS rows', async () => {
        const d = database();
        await completeOnboardingProfile(selection, 'same', 'first', d);
        const before = await snapshot(d);
        await expect(completeOnboardingProfile({ ...selection, mathRange: 'q_mul' }, 'same', 'first', d)).rejects.toBeInstanceOf(OnboardingConflict);
        expect(await snapshot(d)).toEqual(before);
    });

    it('keeps existing Settings add-profile names and off-subject seeding, preserving the old profile and run', async () => {
        const d = database();
        const old = { ...createInitialProfile('existing', 1, 4, 1, 'math'), id: 'old' };
        await d.profiles.add(old);
        await d.appData.add({ id: 'app', schemaVersion: 1, profiles: { old }, activeProfileId: 'old' });
        const run = { runId: 'old-run', profileId: old.id, status: 'active', checkpoint: { untouched: true } };
        await d.exploreRuns.add(run as never);
        const add = { ...selection, subject: 'vocab' as const, mathRange: null, englishRange: 'beginner' as const };
        await expect(completeOnboardingProfile(add, 'new', 'add', d)).rejects.toBeInstanceOf(OnboardingConflict);
        const result = await completeOnboardingProfile({ ...add, name: 'new child' }, 'new', 'add', d);
        expect(result.profile.name).toBe('new child');
        expect((await d.memoryMath.toArray()).map(row => row.id).sort()).toEqual([...getAvailableSkills(11)].sort());
        expect(await d.profiles.get('old')).toEqual(old);
        expect(await d.exploreRuns.get('old-run')).toEqual(run);
        expect((await d.appData.get('app'))?.profiles.old).toEqual(old);
        expect(await d.logs.count()).toBe(0);
    });

    it('recognizes a legacy profile table before appData exists without creating a second first profile', async () => {
        const d = database(), profile = { ...createInitialProfile('legacy', 1, 4, 1, 'math'), id: 'old' };
        await d.profiles.add(profile);
        const before = await snapshot(d);
        await expect(completeOnboardingProfile(selection, 'new-first', 'first', d)).rejects.toBeInstanceOf(OnboardingAlreadyCompleted);
        expect(await snapshot(d)).toEqual(before);
    });
});

describe('onboarding route intent', () => {
    it('sends existing users back through LaunchRoute unless Settings explicitly asks to add a profile', () => {
        expect(onboardingDestination(true, '')).toBe('launch');
        expect(onboardingDestination(true, '?mode=add')).toBe('add');
        expect(onboardingDestination(true, '?mode=unknown')).toBe('launch');
        expect(onboardingDestination(false, '')).toBe('first');
        expect(onboardingDestination(false, '?mode=add')).toBe('first');
    });
});
