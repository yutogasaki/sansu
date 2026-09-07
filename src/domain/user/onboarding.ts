import { db, type SansuDatabase } from '../../db';
import type { AppData, MemoryState, UserProfile } from '../types';
import { getAvailableSkills, MAX_MATH_LEVEL } from '../math/curriculum';
import { getNextReviewDate } from '../algorithms/srs';
import { createInitialProfile } from './profile';

export type OnboardingSubject = 'math' | 'vocab' | 'mix';
export type OnboardingMathRange = 'q_count' | 'q_add' | 'q_sub' | 'q_col' | 'q_mul';
export type OnboardingEnglishRange = 'beginner' | 'some' | 'confident';
export type OnboardingIntent = 'first' | 'legacy-first' | 'add';
export interface OnboardingSelection {
    name: string;
    grade: number | null;
    subject: OnboardingSubject | null;
    mathRange: OnboardingMathRange | null;
    englishRange: OnboardingEnglishRange | null;
}

export const ONBOARDING_GRADES = [
    { label: '年少', value: -2 }, { label: '年中', value: -1 }, { label: '年長', value: 0 },
    ...Array.from({ length: 6 }, (_, i) => ({ label: `小学 ${i + 1} 年生`, value: i + 1 })),
];
export const ONBOARDING_SUBJECTS = [
    { label: 'さんすう', value: 'math' }, { label: 'えいご', value: 'vocab' }, { label: 'さんすう と えいご', value: 'mix' },
] as const;
export const ONBOARDING_MATH_RANGES = [
    { label: '数をかぞえる・くらべる', value: 'q_count' }, { label: '足し算まで', value: 'q_add' },
    { label: '引き算まで', value: 'q_sub' }, { label: '筆算（2けたのたし算・ひき算）', value: 'q_col' },
    { label: 'かけ算（九九）', value: 'q_mul' },
] as const;
export const ONBOARDING_ENGLISH_RANGES = [
    { label: 'はじめて', value: 'beginner' }, { label: 'すこし', value: 'some' }, { label: 'よくやってる', value: 'confident' },
] as const;
const baseByGrade: Record<number, number> = { [-2]: 0, [-1]: 2, 0: 8, 1: 10, 2: 11, 3: 13, 4: 14, 5: 15, 6: 16 };
const mathAdjustment = { q_count: -6, q_add: -3, q_sub: -1, q_col: 1, q_mul: 4 };
const englishLevel = { beginner: 1, some: 4, confident: 7 };

export class OnboardingConflict extends Error {}
export class OnboardingAlreadyCompleted extends OnboardingConflict {}

/** Parent spec 2.4 mappings apply only after the required selections exist. */
export function resolveOnboardingSelection(selection: OnboardingSelection, intent: OnboardingIntent) {
    const { grade, subject, mathRange, englishRange } = selection;
    if (grade === null || !Object.prototype.hasOwnProperty.call(baseByGrade, grade) || !Number.isInteger(grade)
        || !ONBOARDING_SUBJECTS.some(option => option.value === subject)
        || (subject !== 'vocab' && !ONBOARDING_MATH_RANGES.some(option => option.value === mathRange))
        || (subject !== 'math' && !ONBOARDING_ENGLISH_RANGES.some(option => option.value === englishRange))) {
        throw new OnboardingConflict('Choose every learning setting');
    }
    const name = selection.name.trim();
    if (!name && intent !== 'first') throw new OnboardingConflict('Profile name is required');
    return {
        name: name || 'プレイヤー', grade, subject: subject!,
        mathStartLevel: Math.max(1, Math.min(MAX_MATH_LEVEL, baseByGrade[grade] + (subject !== 'vocab' ? mathAdjustment[mathRange!] : 0))),
        vocabStartLevel: subject !== 'math' ? englishLevel[englishRange!] : 1,
        // Inactive math fields remain compatible defaults, not observed ability.
        seedMath: intent !== 'first' || subject !== 'vocab',
    };
}

/** No storage writes: route resolution must not create a preview profile. */
export function onboardingDestination(hasProfile: boolean, search: string): 'launch' | 'add' | 'first' {
    return hasProfile ? new URLSearchParams(search).get('mode') === 'add' ? 'add' : 'launch' : 'first';
}

/** The creation ID lives for one setup flow; retry never retires skills twice. */
export async function completeOnboardingProfile(selection: OnboardingSelection, completionId: string,
    intent: OnboardingIntent, database: SansuDatabase = db): Promise<{ profile: UserProfile; activeProfileId: string }> {
    const resolved = resolveOnboardingSelection(selection, intent);
    if (!completionId.trim()) throw new OnboardingConflict('Creation identity missing');
    return database.transaction('rw', [database.appData, database.profiles, database.memoryMath], async () => {
        const stored = await database.appData.get('app');
        const profiles = stored?.profiles ?? Object.fromEntries((await database.profiles.toArray()).map(profile => [profile.id, profile]));
        const app: AppData = stored ?? { schemaVersion: 1, activeProfileId: null, profiles };
        const existing = profiles[completionId];
        if (existing) {
            if (existing.name !== resolved.name || existing.grade !== resolved.grade || existing.subjectMode !== resolved.subject
                || existing.mathStartLevel !== resolved.mathStartLevel || existing.vocabStartLevel !== resolved.vocabStartLevel) {
                throw new OnboardingConflict('Creation choices changed');
            }
            return { profile: existing, activeProfileId: app.activeProfileId && profiles[app.activeProfileId] ? app.activeProfileId : existing.id };
        }
        if (intent !== 'add' && Object.keys(profiles).length) throw new OnboardingAlreadyCompleted('First profile already exists');
        const profile = { ...createInitialProfile(resolved.name, resolved.grade, resolved.mathStartLevel, resolved.vocabStartLevel, resolved.subject), id: completionId };
        if (resolved.seedMath) {
            const now = new Date().toISOString(), nextReview = getNextReviewDate(5).toISOString();
            const memories: MemoryState[] = getAvailableSkills(resolved.mathStartLevel).map(id => ({
                profileId: profile.id, id, strength: 5, nextReview, totalAnswers: 0, correctAnswers: 0,
                incorrectAnswers: 0, skippedAnswers: 0, updatedAt: now, status: 'retired',
            }));
            await database.memoryMath.bulkAdd(memories);
        }
        await database.profiles.add(profile);
        await database.appData.put({ ...app, id: 'app', profiles: { ...profiles, [profile.id]: profile }, activeProfileId: profile.id });
        return { profile, activeProfileId: profile.id };
    });
}
