import type { Problem } from "../types";
import { ENGLISH_WORDS } from "./words";
import type { EnglishWord } from "./types";
import { shuffleArray } from "../../utils/shuffle";
import type { RandomSource } from "../../utils/random";
import { createLearningProblemContext } from '../learning/context';

type VocabGeneratorOptions = {
    cooldownIds?: string[];
    kanjiMode?: boolean;
    random?: RandomSource;
};

export const generateVocabProblem = (
    targetWordId: string,
    options: VocabGeneratorOptions = {}
): Omit<Problem, 'id' | 'subject' | 'isReview'> => {
    const target = ENGLISH_WORDS.find(w => w.id === targetWordId);
    if (!target) throw new Error(`Word not found: ${targetWordId}`);
    const random = options.random ?? Math.random;
    const cooldown = new Set(options.cooldownIds ?? []);
    const label = (word: EnglishWord) => options.kanjiMode && word.japaneseKanji
        ? word.japaneseKanji : word.japanese;
    const labels = new Set([label(target)]);
    const ids = new Set([target.id]);
    const distractors: EnglishWord[] = [];
    // Exhaust each locality tier before widening it; count unique rendered
    // labels, not rows. Even the last cooldown relaxation cannot create aliases.
    const tiers = [
        ENGLISH_WORDS.filter(w => w.level === target.level && !cooldown.has(w.id)),
        ENGLISH_WORDS.filter(w => Math.abs(w.level - target.level) === 1 && !cooldown.has(w.id)),
        ENGLISH_WORDS.filter(w => !cooldown.has(w.id)),
        ENGLISH_WORDS,
    ];
    for (const tier of tiers) {
        for (const word of shuffleArray(tier, random)) {
            if (ids.has(word.id) || labels.has(label(word))
                || (word.surface ?? word.id) === (target.surface ?? target.id)) continue;
            distractors.push(word);
            ids.add(word.id);
            labels.add(label(word));
            if (distractors.length === 3) break;
        }
        if (distractors.length === 3) break;
    }
    if (distractors.length !== 3) throw new Error(`Insufficient distinct choices for ${targetWordId}`);
    const problem: Omit<Problem, 'id' | 'subject' | 'isReview'> = {
        categoryId: target.id,
        questionText: target.surface ?? target.id,
        inputType: "choice",
        inputConfig: {
            choices: shuffleArray([target, ...distractors].map(w => ({ label: label(w), value: w.id })), random),
        },
        correctAnswer: target.id,
        displayAnswer: label(target),
    };
    return { ...problem, learningContext: createLearningProblemContext('vocab', problem) };
};
