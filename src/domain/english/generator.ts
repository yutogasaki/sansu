import { Problem } from "../types";
import { ENGLISH_WORDS } from "./words";
import { shuffleArray } from "../../utils/shuffle";

type VocabGeneratorOptions = {
    cooldownIds?: string[];
    kanjiMode?: boolean;
};

export const generateVocabProblem = (
    targetWordId: string,
    options: VocabGeneratorOptions = {}
): Omit<Problem, 'id' | 'subject' | 'isReview'> => {
    const target = ENGLISH_WORDS.find(w => w.id === targetWordId);
    if (!target) throw new Error(`Word not found: ${targetWordId}`);

    const cooldownSet = new Set(options.cooldownIds || []);
    const useKanji = options.kanjiMode === true;

    const filterCandidates = (words: typeof ENGLISH_WORDS) => {
        return words.filter(w =>
            w.id !== target.id &&
            w.japanese !== target.japanese &&
            !cooldownSet.has(w.id)
        );
    };
    const filterWithoutCooldown = (words: typeof ENGLISH_WORDS) => {
        return words.filter(w =>
            w.id !== target.id &&
            w.japanese !== target.japanese
        );
    };

    // 1. Select Distractors (3 words)
    // Strategy: Same level first, then adjacent levels
    let pool = filterCandidates(ENGLISH_WORDS.filter(w => w.level === target.level));

    if (pool.length < 3) {
        const adjacent = ENGLISH_WORDS.filter(w => w.level === target.level - 1 || w.level === target.level + 1);
        pool = filterCandidates([...pool, ...adjacent]);
    }

    if (pool.length < 3) {
        pool = filterCandidates(ENGLISH_WORDS);
    }

    // Last resort: allow cooldown items if still not enough
    if (pool.length < 3) {
        pool = filterWithoutCooldown(ENGLISH_WORDS);
    }

    // Shuffle pool and pick 3
    const shuffledPool = shuffleArray(pool);
    const distractors = shuffledPool.slice(0, 3);

    // Helper to get display label based on mode
    const getLabel = (w: typeof ENGLISH_WORDS[0]) => {
        if (useKanji && w.japaneseKanji) {
            return w.japaneseKanji; // 漢字モードかつ漢字データがあれば漢字
        }
        return w.japanese; // それ以外はひらがな
    };

    // Create 4 choices
    const choices = shuffleArray(
        [target, ...distractors].map(w => ({ label: getLabel(w), value: w.id }))
    );

    return {
        categoryId: target.id,
        questionText: target.id, // id自体が英単語（例: "apple"）
        inputType: "choice",
        inputConfig: {
            choices: choices
        },
        correctAnswer: target.id,
        displayAnswer: getLabel(target) // 正解表示用（これがないとIDが表示されてしまう）
    };
};
