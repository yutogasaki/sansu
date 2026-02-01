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


    // Create initial objects
    const profile: UserProfile = {
        id: profileId,
        name,
        grade,
        mathStartLevel,
        vocabStartLevel,
        subjectMode,
        soundEnabled: true,
        dailyGoal: 20,

        // Logic: mathStartLevel is the "max unlocked" initially. 
        // And Main is Start+1? Or Start is the one to learn?
        // Spec 5.6: "mathStartLevel の1つ上を mainLevel とする"
        // "mathStartLevel 以下のレベルはすべて unlocked=true かつ retired"
        // So if Start=5, Levels 1-5 are Cleared. Main is 6.
        mathMainLevel: mathStartLevel + 1,
        mathMaxUnlocked: mathStartLevel + 1,

        vocabMainLevel: vocabStartLevel,
        vocabMaxUnlocked: vocabStartLevel,

        mathLevels: createLevelStates(20, mathStartLevel + 1, mathStartLevel + 1),
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
