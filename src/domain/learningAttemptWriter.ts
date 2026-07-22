import { addDays } from "date-fns";
import type { AttemptLog, SansuDatabase } from "../db";
import { getLearningDayStart, toLocaleDateKey } from "../utils/learningDay";
import { getNextReviewDate, updateMemoryState, updateSkillStatus } from "./algorithms/srs";
import { getWordLevel } from "./english/words";
import {
    getLevelForSkill,
    getSkillsForLevel,
    MAX_MATH_LEVEL,
} from "./math/curriculum";
import type { MemoryState, SubjectKey, UserProfile } from "./types";

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
}

export interface LearningAttemptWriteReceipt {
    logId: number;
    memory: MemoryState;
    profile: UserProfile | null;
}

export const getInitialNextReviewIso = (strength: number, skipped: boolean): string => {
    if (skipped) return getLearningDayStart().toISOString();
    return getNextReviewDate(strength).toISOString();
};

export const resolveWeakStateAfterAttempt = (
    previous: boolean | undefined,
    resultsNewestFirst: AttemptLog["result"][],
    minAnswers: number = 5,
): boolean | undefined => {
    if (resultsNewestFirst.length < minAnswers) return previous ?? false;

    const correct = resultsNewestFirst.filter((result) => result === "correct").length;
    const accuracy = correct / resultsNewestFirst.length;
    if (accuracy < 0.6) return true;
    if (accuracy >= 0.8) return false;
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

const resolveMathProgression = async (
    database: SansuDatabase,
    profile: UserProfile,
    nowIso: string,
): Promise<UserProfile> => {
    let updated = profile;

    if (
        updated.mathMainLevel < MAX_MATH_LEVEL
        && updated.mathMaxUnlocked === updated.mathMainLevel
    ) {
        const levelState = updated.mathLevels?.find(
            (level) => level.level === updated.mathMainLevel,
        );
        const recent = levelState?.recentAnswersNonReview || [];
        if (
            recent.length >= 20
            && recent.filter(Boolean).length / recent.length >= 0.85
        ) {
            const nextLevel = Math.min(MAX_MATH_LEVEL, updated.mathMaxUnlocked + 1);
            updated = {
                ...updated,
                mathMaxUnlocked: nextLevel,
                mathLevels: updated.mathLevels?.map((level) => (
                    level.level <= nextLevel ? { ...level, unlocked: true } : level
                )),
            };
        }
    }

    if (updated.mathMaxUnlocked > updated.mathMainLevel) {
        const nextMainLevel = updated.mathMaxUnlocked;
        const targetSkills = getSkillsForLevel(nextMainLevel);
        if (targetSkills.length > 0) {
            const completed = await database.logs
                .where("[profileId+subject]")
                .equals([updated.id, "math"])
                .filter((log) => (
                    targetSkills.includes(log.itemId)
                    && !log.isReview
                    && log.result !== "skipped"
                ))
                .count();
            if (completed >= 30) {
                const nextLevels = updated.mathLevels?.map((level) => (
                    level.level === nextMainLevel
                        ? {
                            ...level,
                            unlocked: true,
                            enabled: true,
                            recentAnswersNonReview: [],
                            updatedAt: nowIso,
                        }
                        : level
                ));
                const ensuredLevels = nextLevels && nextLevels.some((level) => level.enabled)
                    ? nextLevels
                    : nextLevels?.map((level) => (
                        level.level === nextMainLevel ? { ...level, enabled: true } : level
                    ));
                updated = {
                    ...updated,
                    mathMainLevel: nextMainLevel,
                    mathMainLevelStartedAt: nowIso,
                    mathLevels: ensuredLevels,
                    pendingLevelUpNotification: {
                        subject: "math",
                        newLevel: nextMainLevel,
                        achievedAt: nowIso,
                    },
                };
            }
        }
    }

    return updated;
};

/**
 * Writes one learning attempt using the caller's active Dexie transaction.
 * Callers must include logs, memoryMath, memoryVocab, profiles and appData in
 * that transaction. This lets Explore combine the learning write with its
 * unique attempt event and run aggregate without nesting transactions.
 */
export const writeLearningAttemptInTransaction = async (
    database: SansuDatabase,
    input: LearningAttemptWriteInput,
): Promise<LearningAttemptWriteReceipt> => {
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
    const logId = await database.logs.add(log);
    const table = input.subject === "math" ? database.memoryMath : database.memoryVocab;
    const existing = await table.get([input.profileId, input.itemId]);
    let newState: MemoryState;

    if (existing) {
        newState = updateMemoryState(existing, scoredResult === "correct", skipped);
        newState = {
            ...newState,
            updatedAt: input.timestamp,
            lastCorrectAt: scoredResult === "correct" && !skipped
                ? input.timestamp
                : newState.lastCorrectAt,
            isWeak: resolveWeakStateAfterAttempt(
                existing.isWeak,
                [skipped ? "skipped" : scoredResult, ...recentItemLogs.map((item) => item.result)],
            ),
        };
        if (input.subject === "math") {
            const recentResults = [
                scoredResult === "correct" && !skipped,
                ...recentItemLogs.map((item) => item.result === "correct"),
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
        const strength = correct ? 2 : 1;
        newState = {
            id: input.itemId,
            strength,
            nextReview: getInitialNextReviewIso(strength, skipped),
            totalAnswers: 1,
            correctAnswers: correct ? 1 : 0,
            incorrectAnswers: correct ? 0 : 1,
            skippedAnswers: skipped ? 1 : 0,
            lastCorrectAt: correct ? input.timestamp : undefined,
            updatedAt: input.timestamp,
            status: input.subject === "math" ? "active" : undefined,
            isWeak: false,
        };
    }

    const dbMemory = { ...newState, profileId: input.profileId };
    await table.put(dbMemory);

    let profile = await getProfileFromDatabase(database, input.profileId);
    if (profile) {
        const level = input.subject === "math"
            ? getLevelForSkill(input.itemId)
            : getWordLevel(input.itemId);
        if (!input.isReview && level !== null) {
            if (input.subject === "math" && level === profile.mathMainLevel) {
                profile = {
                    ...profile,
                    mathLevels: profile.mathLevels?.map((item) => item.level === level
                        ? {
                            ...item,
                            recentAnswersNonReview: [
                                ...(item.recentAnswersNonReview || []),
                                scoredResult === "correct" && !skipped,
                            ].slice(-20),
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
                            updatedAt: input.timestamp,
                        }
                        : item),
                };
            }
        }

        const dayStart = getLearningDayStart();
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
            },
        ].slice(-300);

        let updatedProfile: UserProfile = {
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
        };
        if (input.subject === "math") {
            updatedProfile = await resolveMathProgression(database, updatedProfile, input.timestamp);
        }
        await saveProfileToDatabase(database, updatedProfile);
        profile = updatedProfile;
    }

    return { logId, memory: dbMemory, profile };
};

export const getLearningAttemptTransactionTables = (database: SansuDatabase) => [
    database.logs,
    database.memoryMath,
    database.memoryVocab,
    database.appData,
    database.profiles,
] as const;
