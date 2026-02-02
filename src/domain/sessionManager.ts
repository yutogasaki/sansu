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

// 仕様 4.3.1: イベントちからチェック出現条件
export type EventType =
    | "streak_3"      // 連続学習3日
    | "streak_7"      // 連続学習7日
    | "total_100"     // 100問達成（100の倍数）
    | "level_up_near" // レベルアップ直前
    | "weak_decrease"; // 苦手スキル減少

export interface EventCheckParams {
    profile: UserProfile;
    totalCount: number;
    // レベルアップ直前判定用（直近20問中の正解数）
    recentCorrectCount?: number;
    // 苦手スキル減少判定用
    prevWeakCount?: number;
    currentWeakCount?: number;
}

// Check if a special event should be triggered
// 仕様 4.3.1: 以下のOR条件で出現
// - 連続学習日数到達 (3日, 7日)
// - 総問題数100の倍数
// - レベルアップ直前（85%達成直前）
// - 苦手スキル減少時
export const checkEventCondition = (params: EventCheckParams): EventType | null => {
    const { profile, totalCount, recentCorrectCount, prevWeakCount, currentWeakCount } = params;

    // 1. 連続学習日数到達 (3日, 7日)
    // ちょうど3日目/7日目のときのみトリガー（重複回避）
    if (profile.streak === 3) {
        return "streak_3";
    }
    if (profile.streak === 7) {
        return "streak_7";
    }

    // 2. 総問題数100の倍数
    if (totalCount > 0 && totalCount % 100 === 0) {
        return "total_100";
    }

    // 3. レベルアップ直前（直近20問で17問正解 = 85%に近い）
    // 16問正解時点でイベント発生（次で達成可能）
    if (recentCorrectCount !== undefined && recentCorrectCount === 16) {
        return "level_up_near";
    }

    // 4. 苦手スキル減少時
    if (prevWeakCount !== undefined && currentWeakCount !== undefined) {
        if (currentWeakCount < prevWeakCount && prevWeakCount > 0) {
            return "weak_decrease";
        }
    }

    return null;
};

// 後方互換性のためのラッパー
export const checkEventConditionSimple = (profile: UserProfile, totalCount: number): EventType | null => {
    return checkEventCondition({ profile, totalCount });
};
