import { Problem, UserProfile, SubjectKey } from "./types";
import { generateMathProblem } from "./math";
import { generateVocabProblem } from "./english/generator";


// This manager would be stateful in a React Hook or Store.
// Here we define the pure logic to "get next batch".

export const generateSessionQueue = (_user: UserProfile, count = 5): Omit<Problem, 'id' | 'isReview'>[] => {
    const queue: Omit<Problem, 'id' | 'isReview'>[] = [];

    // 1. Identify Due Items (Review)
    // We need to scan user.mathSkills/vocabWords
    // This is expensive if lists are huge. In Dexie we query index.
    // For 'logic' testing, assume arrays are passed or we iterate everything (not efficient but ok for MVP).

    // Let's create a Queue Plan:
    // - Priority 1: Vocab Review
    // - Priority 2: Math Review (Due) -> Mixed into normal if weak?
    // Spec says: "Vocab Review Queue" is distinct blocks.

    // Simplified Logic:
    // Decide subject for this specific 5-question block.
    // "Mix" means alternating blocks, or mixing within block?
    // Spec: "5 questions = 1 block", "Math or English decided per block".

    // Strategy: Randomly pick subject based on "Need".
    const subject = pickSubject();

    for (let i = 0; i < count; i++) {
        // Problem generation logic
        // A) Review (Due)
        // B) New (Main Level)

        // Placeholder: Always generate NEW problem from Main Level
        if (subject === 'math') {
            // Pick a skill from Main Level (e.g. user.mathMainLevel)
            // Assume we have a helper to get skills by level (need to import metadata)
            // For MVP: default to "add_1d_1"
            queue.push({
                ...generateMathProblem("add_1d_1"),
                subject: 'math'
            });
        } else {
            // English
            // Pick a word from Main Level
            // Default "apple"
            queue.push({
                ...generateVocabProblem("apple"),
                subject: 'vocab'
            });
        }
    }

    return queue;
};

const pickSubject = (): SubjectKey => {
    // If mix mode, toggle or random.
    return Math.random() > 0.5 ? 'math' : 'vocab';
};

export type EventType = "streak_3" | "level_up_near" | "total_100";

// Check if a special event should be triggered
export const checkEventCondition = (profile: UserProfile, totalCount: number): EventType | null => {
    // 1. Streak (Example: 3 days)
    // Trigger only if today hasn't been counted yet? Or just if streak exists.
    // The caller should handle "already seen" logic (using localStorage or similar).
    if (profile.streak >= 3) {
        return "streak_3";
    }

    // 2. Total Count Milestones (100, 200, 300...)
    // This is tricky because exact match might be missed if multiple questions answered at once.
    // But for now, we check if close or just passed using caller logic?
    // Let's just check ranges or specific values if we can.
    // For MVP: Check if totalCount is a multiple of 100
    if (totalCount > 0 && totalCount % 100 === 0) {
        return "total_100";
    }

    return null;
};
