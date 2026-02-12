import { LevelState, UserProfile } from "../types";
import { v4 as uuidv4 } from "uuid";

const createLevelStates = (maxLevel: number, unlockedUpTo: number, mainLevel: number): LevelState[] => {
    const now = new Date().toISOString();
    const states: LevelState[] = [];
    for (let level = 1; level <= maxLevel; level += 1) {
        const unlocked = level <= unlockedUpTo;
        states.push({
            level,
            unlocked,
            enabled: level === mainLevel ? true : unlocked,
            recentAnswersNonReview: [],
            updatedAt: now
        });
    }
    return states;
};


// Helper to sync level state on manual change
export const syncLevelState = (
    profile: UserProfile,
    subject: 'math' | 'vocab',
    newLevel: number
): UserProfile => {
    const updated = { ...profile };
    const now = new Date().toISOString();

    if (subject === 'math') {
        const prevMain = updated.mathMainLevel;
        updated.mathMainLevel = newLevel;
        if (newLevel > updated.mathMaxUnlocked) {
            updated.mathMaxUnlocked = newLevel;
        }
        if (prevMain !== newLevel) {
            updated.mathMainLevelStartedAt = now;
        }

        if (updated.mathLevels) {
            updated.mathLevels = updated.mathLevels.map(l => {
                if (l.level <= newLevel) {
                    return { ...l, unlocked: true, enabled: true };
                } else {
                    return { ...l, enabled: false };
                }
            });
        }
    } else {
        const prevMain = updated.vocabMainLevel;
        updated.vocabMainLevel = newLevel;
        if (newLevel > updated.vocabMaxUnlocked) {
            updated.vocabMaxUnlocked = newLevel;
        }
        if (prevMain !== newLevel) {
            updated.vocabMainLevelStartedAt = now;
        }

        if (updated.vocabLevels) {
            updated.vocabLevels = updated.vocabLevels.map(l => {
                if (l.level <= newLevel) {
                    return { ...l, unlocked: true, enabled: true };
                } else {
                    return { ...l, enabled: false };
                }
            });
        }
    }

    return updated;
};

export const syncUnlockLevel = (
    profile: UserProfile,
    subject: 'math' | 'vocab',
    newMaxUnlocked: number
): UserProfile => {
    const updated = { ...profile };

    if (subject === 'math') {
        const nextMax = Math.max(updated.mathMainLevel, Math.min(20, newMaxUnlocked));
        updated.mathMaxUnlocked = nextMax;

        if (updated.mathLevels) {
            updated.mathLevels = updated.mathLevels.map(l => {
                if (l.level <= nextMax) {
                    return { ...l, unlocked: true };
                }
                return { ...l, unlocked: false, enabled: l.level === updated.mathMainLevel };
            });
        }
    } else {
        const nextMax = Math.max(updated.vocabMainLevel, Math.min(20, newMaxUnlocked));
        updated.vocabMaxUnlocked = nextMax;

        if (updated.vocabLevels) {
            updated.vocabLevels = updated.vocabLevels.map(l => {
                if (l.level <= nextMax) {
                    return { ...l, unlocked: true };
                }
                return { ...l, unlocked: false, enabled: l.level === updated.vocabMainLevel };
            });
        }
    }

    return updated;
};

// Default Profile Factory
export const createInitialProfile = (
    name: string,
    grade: number,
    mathStartLevel: number,
    vocabStartLevel: number,
    subjectMode: "mix" | "math" | "vocab"
): UserProfile => {
    const profileId = uuidv4();
    const now = new Date().toISOString();
    const mathMainLevel = Math.min(20, mathStartLevel + 1);
    const mathMaxUnlocked = Math.min(20, mathStartLevel + 1);

    // Create initial objects
    const profile: UserProfile = {
        id: profileId,
        name,
        grade,
        mathStartLevel,
        vocabStartLevel,
        subjectMode,
        soundEnabled: true,
        uiTextMode: "standard",
        dailyGoal: 20,

        // Logic: mathStartLevel is the "max unlocked" initially. 
        // And Main is Start+1? Or Start is the one to learn?
        // Spec 5.6: "mathStartLevel の1つ上を mainLevel とする"
        // "mathStartLevel 以下のレベルはすべて unlocked=true かつ retired"
        // So if Start=5, Levels 1-5 are Cleared. Main is 6.
        mathMainLevel,
        mathMaxUnlocked,
        mathMainLevelStartedAt: now,

        vocabMainLevel: vocabStartLevel,
        vocabMaxUnlocked: vocabStartLevel,
        vocabMainLevelStartedAt: now,

        mathLevels: createLevelStates(20, mathMaxUnlocked, mathMainLevel),
        vocabLevels: createLevelStates(20, vocabStartLevel, vocabStartLevel),

        mathSkills: {}, // Will be populated as we go? Or pre-fill? 
        // Usually we only store state for touched items.
        // But if we mark lower levels as retired, we might need to "mock" their state?
        // MVP: Just logical check "if level < main, it's retired".
        vocabWords: {},

        streak: 0,
        todayCount: 0,
        lastStudyDate: "",
        recentAttempts: [],
        schemaVersion: 1,
        syncMeta: { dirty: false }
    };

    return profile;
};

// Storage operations would go here (using Dexie)
// ...
