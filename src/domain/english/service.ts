import { UserProfile } from "../types";
import { ENGLISH_WORDS } from "./words";

// 仕様 5.2: 英語レベル解放判定
// 最大解放レベル内の単語の 70% を「1回でも解いた（totalAnswers > 0）」ら昇格
export const checkEnglishLevelProgression = (profile: UserProfile): boolean => {
    const currentMax = profile.vocabMaxUnlocked;

    // 1. Get words for current max level
    const targetWords = ENGLISH_WORDS.filter(w => w.level === currentMax);
    if (targetWords.length === 0) return false; // No words in this level (maybe max reached)

    // 2. Count unlocked words (totalAnswers > 0)
    let unlockedCount = 0;

    // We check purely against the `vocabWords` map in profile
    // This map contains MemoryState for words user has "touched" (or initialized)
    for (const word of targetWords) {
        const memory = profile.vocabWords[word.id];
        if (memory && memory.totalAnswers > 0) {
            unlockedCount++;
        }
    }

    // 3. Check Ratio
    const ratio = unlockedCount / targetWords.length;

    // Threshold: 70%
    return ratio >= 0.7;
};

// Start Level Inferece (Simple)
// 簡易推定ロジック
export const estimateVocabStartLevel = (grade: number, experienceLevel: number): number => {
    // experienceLevel: 1=Low, 5=Mid, 10=High (from Onboarding)

    // Base by Grade
    // Junior High starts? Sansu App targets Elementary mainly, but English is for Pre-JH preparation.
    // Grade 1-6.

    let base = 1;
    if (grade >= 5) base = 3; // G5 starts abstract
    if (grade >= 6) base = 5;

    // Adjust by experience
    // Exp 1: Base
    // Exp 5: Base + 2
    // Exp 10: Base + 5

    let additional = 0;
    if (experienceLevel >= 5) additional += 2;
    if (experienceLevel >= 10) additional += 3; // Total +5

    return Math.min(20, base + additional);
};
