import { Problem, UserProfile, SubjectKey } from "./types";
import { generateMathProblem } from "./math";
import { generateVocabProblem } from "./english/generator";
import { isDue } from "./algorithms/srs";

// This manager would be stateful in a React Hook or Store.
// Here we define the pure logic to "get next batch".

export const generateSessionQueue = (user: UserProfile, count = 5): Omit<Problem, 'id' | 'isReview'>[] => {
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
    const subject = pickSubject(user);

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

const pickSubject = (user: UserProfile): SubjectKey => {
    // If mix mode, toggle or random.
    return Math.random() > 0.5 ? 'math' : 'vocab';
};
