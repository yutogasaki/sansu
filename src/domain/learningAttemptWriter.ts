import { addDays } from "date-fns";
import { applyFinishRecoveryAttempt } from "./finishRecovery";
import { evaluationContactTimes } from './learning/evaluationContacts';
import type { AttemptLog, SansuDatabase } from "../db";
import { getLearningDayStart, toLocaleDateKey } from "../utils/learningDay";
import { getNextReviewDate, updateMemoryState, updateSkillStatus } from "./algorithms/srs";
import { getWordLevel } from "./english/words";
import {
    getLevelForSkill,
} from "./math/curriculum";
import type { MemoryState, SubjectKey, UserProfile } from "./types";
import type { LearningEvidenceContext } from './learning/types';
import { validateLearningEvidenceContext } from './learning/context';
import { hasKnownWholeAttempt, independentCorrectCount, isIndependentCorrect } from './learning/independentProgress';
import { isMathFoundation } from './math/foundationConfig';

const APP_DATA_ID = "app";

export type LearningAttemptResult = "correct" | "incorrect" | "skipped";

export interface LearningAttemptWriteInput {
    profileId: string;
    subject: SubjectKey;
    itemId: string;
    result: LearningAttemptResult;
    isReview: boolean;
    isMaintenanceCheck: boolean;
    timestamp: string;
    timeMs?: number;
    learningEvidence?: LearningEvidenceContext;
}

export interface LearningAttemptWriteReceipt {
    logId: number;
    memory: MemoryState;
    profile: UserProfile | null;
}

export const getInitialNextReviewIso = (strength: number, skipped: boolean, now: Date = new Date()): string => {
    if (skipped) return getLearningDayStart(now).toISOString();
    return getNextReviewDate(strength, now).toISOString();
};

/** Unknown/assisted success is neutral, never an independent recovery or a failure. */
export const weakAttemptOutcome = (attempt: AttemptLog["result"] | AttemptLog): boolean | undefined => {
    if (typeof attempt === "string") return attempt === "correct";
    if (attempt.result !== "correct" || attempt.skipped) return false;
    return isIndependentCorrect(attempt) ? true : undefined;
};

export const resolveWeakStateAfterAttempt = (
    previous: boolean | undefined,
    resultsNewestFirst: (AttemptLog["result"] | AttemptLog)[],
    minAnswers: number = 5,
): boolean | undefined => {
    if (resultsNewestFirst.length < minAnswers) return previous ?? false;
    const outcomes = resultsNewestFirst.map(weakAttemptOutcome);
    const failureRate = outcomes.filter(value => value === false).length / outcomes.length;
    const recoveryRate = outcomes.filter(value => value === true).length / outcomes.length;
    if (failureRate > 0.4) return true;
    if (recoveryRate >= 0.8) return false;
    return previous;
};

const hydrateProfileMemory = async (
    database: SansuDatabase,
    profile: UserProfile,
): Promise<UserProfile> => {
    const [mathMemory, vocabMemory] = await Promise.all([
        database.memoryMath.where("profileId").equals(profile.id).toArray(),
        database.memoryVocab.where("profileId").equals(profile.id).toArray(),
    ]);
    const mathSkills = { ...(profile.mathSkills || {}) };
    const vocabWords = { ...(profile.vocabWords || {}) };
    mathMemory.forEach((memory) => {
        mathSkills[memory.id] = memory;
    });
    vocabMemory.forEach((memory) => {
        vocabWords[memory.id] = memory;
    });
    return { ...profile, mathSkills, vocabWords };
};

const getProfileFromDatabase = async (
    database: SansuDatabase,
    profileId: string,
): Promise<UserProfile | null> => {
    const appData = await database.appData.get(APP_DATA_ID);
    const stored = appData?.profiles[profileId] ?? await database.profiles.get(profileId);
    return stored ? hydrateProfileMemory(database, stored) : null;
};

const saveProfileToDatabase = async (
    database: SansuDatabase,
    profile: UserProfile,
): Promise<void> => {
    await database.profiles.put(profile);
    const appData = await database.appData.get(APP_DATA_ID);
    if (appData) {
        await database.appData.put({
            ...appData,
            profiles: {
                ...appData.profiles,
                [profile.id]: profile,
            },
        });
        return;
    }

    const profiles = await database.profiles.toArray();
    const profileMap = Object.fromEntries(profiles.map((item) => [item.id, item]));
    await database.appData.put({
        id: APP_DATA_ID,
        schemaVersion: 1,
        activeProfileId: profile.id,
        profiles: profileMap,
    });
};


/**
 * Writes one learning attempt using the caller's active Dexie transaction.
 * Callers must use getLearningAttemptTransactionTables, including the event
 * tables needed for unit evidence, in that transaction. This lets Explore combine the learning write with its
 * unique attempt event and run aggregate without nesting transactions.
 */
export const writeLearningAttemptInTransaction = async (
    database: SansuDatabase,
    input: LearningAttemptWriteInput,
): Promise<LearningAttemptWriteReceipt> => {
    if (await database.challengeRuns.where('[profileId+status]').anyOf(
        [input.profileId, 'countdown'], [input.profileId, 'running'],
    ).count()) {
        throw new Error('challenge-already-active');
    }
    const skipped = input.result === "skipped";
    const scoredResult = input.result === "correct" ? "correct" : "incorrect";
    const recentItemLogs = await database.logs
        .where("[profileId+subject]")
        .equals([input.profileId, input.subject])
        .filter((log) => log.itemId === input.itemId)
        .reverse()
        .limit(9)
        .toArray();

    const log: AttemptLog = {
        profileId: input.profileId,
        subject: input.subject,
        itemId: input.itemId,
        result: skipped ? "skipped" : scoredResult,
        skipped: skipped || undefined,
        isReview: input.isReview,
        timestamp: input.timestamp,
        timeMs: input.timeMs,
    };
    const learningEvidence = validateLearningEvidenceContext(input.learningEvidence, input.subject, input.itemId);
    if (learningEvidence) log.learningEvidence = learningEvidence;
    const logId = await database.logs.add(log);
    const table = input.subject === "math" ? database.memoryMath : database.memoryVocab;
    const existing = await table.get([input.profileId, input.itemId]);
    const independent = isIndependentCorrect(log);
    const knownWhole = hasKnownWholeAttempt(log);
    // Existing explicit evidence can be counted; raw legacy successes cannot.
    const previousIndependentCount = existing?.independentCorrectAnswers === undefined
        ? await database.logs.where('[profileId+subject]').equals([input.profileId, input.subject])
            .filter(previous => previous.id !== logId && previous.itemId === input.itemId && isIndependentCorrect(previous)).count()
        : independentCorrectCount(existing);
    const challengeContact = input.subject === 'math' ? await database.challengeContacts.get([input.profileId, input.itemId]) : undefined;
    let profile = await getProfileFromDatabase(database, input.profileId);
    const contactTimes = [challengeContact?.latestAt, ...evaluationContactTimes(profile, input.subject, input.itemId)]
        .filter((value): value is string => value !== undefined);
    const contactUncertain = contactTimes.some(value => !Number.isFinite(Date.parse(value)));
    const latestContactAt = contactTimes.filter(value => Number.isFinite(Date.parse(value)))
        .sort((a, b) => Date.parse(b) - Date.parse(a))[0];
    const memoryEvidence = {
        latestChallengeContactAt: latestContactAt,
        challengeContactUncertain: challengeContact?.uncertain || contactUncertain,
        independence: learningEvidence?.assistance ?? 'unknown',
        wholeProblem: learningEvidence?.completion === 'whole-problem',
    } as const;
    let newState: MemoryState;

    if (existing) {
        newState = updateMemoryState(existing, scoredResult === "correct", skipped, new Date(input.timestamp), memoryEvidence);
        newState = {
            ...newState,
            updatedAt: input.timestamp,
            isWeak: resolveWeakStateAfterAttempt(
                existing.isWeak,
                [log, ...recentItemLogs],
            ),
        };
        if (input.subject === "math" && (independent || scoredResult !== 'correct' || skipped)) {
            const recentResults = [
                independent,
                ...recentItemLogs.map(isIndependentCorrect),
            ];
            const status = updateSkillStatus(
                newState,
                recentResults,
                input.isMaintenanceCheck,
            );
            if (status) newState.status = status;
        }
    } else {
        const correct = scoredResult === "correct" && !skipped;
        const strength = 1;
        newState = {
            id: input.itemId,
            strength,
            nextReview: getInitialNextReviewIso(strength, skipped, new Date(input.timestamp)),
            totalAnswers: 1,
            correctAnswers: correct ? 1 : 0,
            incorrectAnswers: correct ? 0 : 1,
            skippedAnswers: skipped ? 1 : 0,
            lastCorrectAt: correct ? input.timestamp : undefined,
            lastIndependentCorrectAt: independent ? input.timestamp : undefined,
            ...(!independent ? { needsRelearning: true, relearningStartedAt: input.timestamp } : {}),
            updatedAt: input.timestamp,
            status: input.subject === "math" ? "active" : undefined,
            isWeak: false,
        };
    }

    newState.independentCorrectAnswers = previousIndependentCount + (independent ? 1 : 0);

    const dbMemory = { ...newState, profileId: input.profileId };
    await table.put(dbMemory);

    if (profile) {
        const level = input.subject === "math"
            ? getLevelForSkill(input.itemId)
            : getWordLevel(input.itemId);
        if (!input.isReview && level !== null && !(input.subject === 'math' && isMathFoundation(input.itemId))) {
            if (input.subject === "math" && level === profile.mathMainLevel) {
                // Legacy Lv0 profiles had no level state. Create it only when
                // an actual Lv0 answer arrives; never infer independent history.
                if (level === 0 && !profile.mathLevels?.some(item => item.level === 0)) {
                    profile = { ...profile, mathLevels: [...(profile.mathLevels ?? []), {
                        level: 0, unlocked: true, enabled: true, recentAnswersNonReview: [],
                        recentIndependentAnswersNonReview: [], updatedAt: input.timestamp,
                    }] };
                }
                profile = {
                    ...profile,
                    mathLevels: profile.mathLevels?.map((item) => item.level === level
                        ? {
                            ...item,
                            recentAnswersNonReview: [
                                ...(item.recentAnswersNonReview || []),
                                scoredResult === "correct" && !skipped,
                            ].slice(-20),
                            recentIndependentAnswersNonReview: knownWhole ? [
                                ...(item.recentIndependentAnswersNonReview || []), independent,
                            ].slice(-20) : item.recentIndependentAnswersNonReview,
                            updatedAt: input.timestamp,
                        }
                        : item),
                };
            } else if (input.subject === "vocab" && level === profile.vocabMainLevel) {
                profile = {
                    ...profile,
                    vocabLevels: profile.vocabLevels?.map((item) => item.level === level
                        ? {
                            ...item,
                            recentAnswersNonReview: [
                                ...(item.recentAnswersNonReview || []),
                                scoredResult === "correct" && !skipped,
                            ].slice(-20),
                            recentIndependentAnswersNonReview: knownWhole ? [
                                ...(item.recentIndependentAnswersNonReview || []), independent,
                            ].slice(-20) : item.recentIndependentAnswersNonReview,
                            updatedAt: input.timestamp,
                        }
                        : item),
                };
            }
        }

        const dayStart = getLearningDayStart(new Date(input.timestamp));
        const todayKey = toLocaleDateKey(dayStart);
        const yesterdayKey = toLocaleDateKey(addDays(dayStart, -1));
        const isSameDay = profile.lastStudyDate === todayKey;
        const isYesterday = profile.lastStudyDate === yesterdayKey;
        const recentResult: LearningAttemptResult = skipped ? "skipped" : scoredResult;
        const recentAttempts: NonNullable<UserProfile["recentAttempts"]> = [
            ...(profile.recentAttempts || []),
            {
                id: logId.toString(),
                timestamp: input.timestamp,
                subject: input.subject,
                skillId: input.itemId,
                result: recentResult,
                skipped: skipped || undefined,
                timeMs: input.timeMs,
                assistance: independent ? "independent" as const : learningEvidence?.assistance === "assisted" ? "assisted" as const : "unknown" as const,
            },
        ].slice(-300);

        const updatedProfile: UserProfile = {
            ...profile,
            mathSkills: input.subject === "math"
                ? { ...(profile.mathSkills || {}), [input.itemId]: dbMemory }
                : profile.mathSkills,
            vocabWords: input.subject === "vocab"
                ? { ...(profile.vocabWords || {}), [input.itemId]: dbMemory }
                : profile.vocabWords,
            streak: isSameDay
                ? (profile.streak || 0)
                : isYesterday
                    ? (profile.streak || 0) + 1
                    : 1,
            todayCount: isSameDay ? (profile.todayCount || 0) + 1 : 1,
            lastStudyDate: todayKey,
            recentAttempts,
            ...(profile.finishRecovery?.[input.subject] ? {
                finishRecovery: { ...profile.finishRecovery, [input.subject]: applyFinishRecoveryAttempt(
                    profile.finishRecovery[input.subject]!, log,
                ) },
            } : {}),
        };
        // Practice records readiness; finish-test completion owns progression.
        await saveProfileToDatabase(database, updatedProfile);
        profile = updatedProfile;
    }

    return { logId, memory: dbMemory, profile };
};

export const getLearningAttemptTransactionTables = (database: SansuDatabase) => [
    database.challengeRuns,
    database.challengeContacts,
    database.logs,
    database.memoryMath,
    database.memoryVocab,
    database.appData,
    database.profiles,
    database.parkEvents,
    database.islandEvents,
] as const;
