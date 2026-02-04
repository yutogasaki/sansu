/**
 * Block generation utilities for useStudySession
 * Extracted for better maintainability and error handling
 */

import { Problem, SubjectKey, UserProfile } from "../domain/types";
import { generateMathProblem } from "../domain/math";
import { generateVocabProblem } from "../domain/english/generator";
import { getSkillsForLevel } from "../domain/math/curriculum";
import { getWordsByLevel, ENGLISH_WORDS } from "../domain/english/words";

// ============================================================
// Types
// ============================================================

export interface BlockGeneratorContext {
    profileId: string;
    profile: UserProfile;
    blockCount: number;
    sessionKind: SessionKind;
    sessionHistory: SessionHistoryItem[];
}

export interface SessionHistoryItem {
    id: string;
    subject: SubjectKey;
    isReview: boolean;
}

export type SessionKind = "normal" | "review" | "weak" | "check-normal" | "check-event" | "weak-review" | "periodic-test";

export interface ProblemGenerationResult {
    problem: Omit<Problem, 'id' | 'subject' | 'isReview'>;
    isReview: boolean;
    isMaintenanceCheck: boolean;
}

export interface GeneratorOptions {
    cooldownIds: string[];
    skippedTodayIds: string[];
    blockCounts: Map<string, number>;
    recentIds: string[];
}

// ============================================================
// Constants
// ============================================================

export const BLOCK_SIZE = 10;
export const COOLDOWN_WINDOW = 5;
export const SAME_ID_LIMIT = 2;
export const REVIEW_BLOCK_CHECK_WINDOW = 40;
export const MIX_WINDOW = 20;
export const REVIEW_BLOCK_THRESHOLD = 0.5;
export const SESSION_REVIEW_CAP = 0.6;
export const WEAK_INJECTION_CAP = 0.3;
export const MAINTENANCE_RATE = 0.01;

// ============================================================
// Error Handling
// ============================================================

/**
 * Create a safe fallback problem when generation fails
 */
export const createFallbackProblem = (subject: SubjectKey, errorContext: string): Omit<Problem, 'id' | 'subject' | 'isReview'> => {
    console.warn(`[BlockGenerator] Using fallback problem due to: ${errorContext}`);

    if (subject === 'math') {
        // Try count_10 as the safest fallback
        try {
            return generateMathProblem("count_10");
        } catch {
            // Ultimate fallback - hardcoded problem
            return {
                categoryId: "count_10",
                questionText: "1 + 1 = ",
                inputType: "number",
                correctAnswer: "2"
            };
        }
    } else {
        // Vocab fallback
        return {
            categoryId: "fallback",
            questionText: "apple",
            inputType: "choice",
            inputConfig: {
                choices: [
                    { label: "りんご", value: "りんご" },
                    { label: "みかん", value: "みかん" },
                    { label: "バナナ", value: "バナナ" },
                    { label: "いちご", value: "いちご" }
                ]
            },
            correctAnswer: "りんご"
        };
    }
};

/**
 * Safe wrapper for problem generation with comprehensive error handling
 */
export const safeGenerateProblem = <T>(
    generator: () => T,
    fallback: () => T,
    context: string
): T => {
    try {
        return generator();
    } catch (error) {
        console.error(`[BlockGenerator] Error in ${context}:`, error);
        try {
            return fallback();
        } catch (fallbackError) {
            console.error(`[BlockGenerator] Fallback also failed in ${context}:`, fallbackError);
            throw new Error(`Both primary and fallback generation failed: ${context}`);
        }
    }
};

// ============================================================
// ID Selection Utilities
// ============================================================

/**
 * Pick a random ID from candidates, respecting cooldown and skip rules
 */
export const pickId = (
    candidates: string[],
    options: GeneratorOptions
): string | undefined => {
    const { skippedTodayIds, blockCounts, recentIds } = options;

    // Filter out skipped items (skip guard: 3+ skips today)
    const notSkipped = candidates.filter(id => !skippedTodayIds.includes(id));

    // Filter out overused items in this block
    const notOverused = notSkipped.filter(id => (blockCounts.get(id) || 0) < SAME_ID_LIMIT);

    if (notOverused.length === 0) return undefined;

    // Prefer items not recently used
    const cooled = notOverused.filter(id => !recentIds.includes(id));
    const pool = cooled.length > 0 ? cooled : notOverused;

    return pool[Math.floor(Math.random() * pool.length)];
};

/**
 * Mark an ID as picked for block-level deduplication
 */
export const markPicked = (id: string, blockCounts: Map<string, number>): void => {
    blockCounts.set(id, (blockCounts.get(id) || 0) + 1);
};

// ============================================================
// Math Problem Generation
// ============================================================

export interface MathGeneratorContext {
    profile: UserProfile;
    mathDue: { id: string }[];
    weakMathPool: string[];
    maintenanceMathIds: string[];
    retiredMathIds: string[];
    options: GeneratorOptions;
    canAddReview: boolean;
    currentWeakCount: number;
    plusCount: number;
    plusLimit: number;
}

/**
 * Generate a single math problem with proper error handling and fallback
 */
export const generateSingleMathProblem = (
    ctx: MathGeneratorContext
): ProblemGenerationResult & { newPlusCount: number } => {
    const {
        profile,
        mathDue,
        weakMathPool,
        maintenanceMathIds,
        retiredMathIds,
        options,
        canAddReview,
        currentWeakCount,
        plusCount,
        plusLimit
    } = ctx;

    let problem: Omit<Problem, 'id' | 'subject' | 'isReview'> | undefined;
    let isReview = false;
    let isMaintenanceCheck = false;
    let newPlusCount = plusCount;

    // Priority 1: Review items
    if (mathDue.length > 0 && canAddReview) {
        const dueId = pickId(mathDue.map(v => v.id), options);
        if (dueId) {
            isReview = true;
            problem = safeGenerateProblem(
                () => generateMathProblem(dueId),
                () => generateMathProblem("count_10"),
                `math review: ${dueId}`
            );
        }
    }

    // Priority 2: Maintenance/Retired check (1% chance)
    if (!problem) {
        const maintenancePool = [...maintenanceMathIds, ...retiredMathIds];
        const useMaintenanceOrRetired = maintenancePool.length > 0 && Math.random() < MAINTENANCE_RATE;

        if (useMaintenanceOrRetired) {
            const maintenanceId = pickId(maintenancePool, options);
            if (maintenanceId) {
                isMaintenanceCheck = true;
                problem = safeGenerateProblem(
                    () => generateMathProblem(maintenanceId),
                    () => generateMathProblem("count_10"),
                    `math maintenance: ${maintenanceId}`
                );
            }
        }
    }

    // Priority 3: Weak skill injection (30% cap)
    if (!problem) {
        const weakLimit = Math.max(1, Math.floor(BLOCK_SIZE * WEAK_INJECTION_CAP));
        const canUseWeak = weakMathPool.length > 0 && currentWeakCount < weakLimit;
        const useWeak = canUseWeak && Math.random() < WEAK_INJECTION_CAP;

        if (useWeak) {
            const weakId = pickId(weakMathPool, options);
            if (weakId) {
                problem = safeGenerateProblem(
                    () => generateMathProblem(weakId),
                    () => generateMathProblem("count_10"),
                    `math weak: ${weakId}`
                );
            }
        }
    }

    // Priority 4: Normal level-based generation
    if (!problem) {
        const mathLevel = profile.mathMainLevel || 1;
        const nextMathLevel = profile.mathMaxUnlocked >= mathLevel + 1 ? mathLevel + 1 : mathLevel;

        const usePlus = nextMathLevel !== mathLevel && newPlusCount < plusLimit && Math.random() < 0.3;
        const targetLevel = usePlus ? nextMathLevel : mathLevel;

        const levelSkills = getSkillsForLevel(targetLevel);
        const skills = levelSkills.length > 0 ? levelSkills : getSkillsForLevel(1);
        const skillId = pickId(skills, options) || skills[0];

        if (skillId) {
            problem = safeGenerateProblem(
                () => generateMathProblem(skillId),
                () => generateMathProblem("count_10"),
                `math normal: ${skillId}`
            );
            if (usePlus) newPlusCount += 1;
        } else {
            problem = createFallbackProblem('math', 'no valid skill found');
        }
    }

    // Final fallback
    if (!problem) {
        problem = createFallbackProblem('math', 'all generation paths failed');
    }

    return { problem, isReview, isMaintenanceCheck, newPlusCount };
};

// ============================================================
// Vocab Problem Generation
// ============================================================

export interface VocabGeneratorContext {
    profile: UserProfile;
    vocabDue: { id: string }[];
    vocabLevelWeights: { level: number; weight: number }[];
    options: GeneratorOptions;
    canAddReview: boolean;
    forceReviewBlock: boolean;
    pendingVocabIds: string[];
    buildCooldownIds: (pending: string[]) => string[];
}

/**
 * Pick a weighted vocab level based on profile settings
 */
export const pickWeightedLevel = (weights: { level: number; weight: number }[]): number => {
    if (weights.length === 0) return 1;

    const totalWeight = weights.reduce((sum, w) => sum + w.weight, 0);
    let r = Math.random() * totalWeight;

    for (const w of weights) {
        r -= w.weight;
        if (r <= 0) return w.level;
    }

    return weights[0]?.level || 1;
};

/**
 * Generate a single vocab problem with proper error handling
 */
export const generateSingleVocabProblem = (
    ctx: VocabGeneratorContext
): ProblemGenerationResult => {
    const {
        vocabDue,
        vocabLevelWeights,
        options,
        canAddReview,
        forceReviewBlock,
        pendingVocabIds,
        buildCooldownIds
    } = ctx;

    let problem: Omit<Problem, 'id' | 'subject' | 'isReview'> | undefined;
    let isReview = false;

    // Priority 1: Forced review block
    if (forceReviewBlock && vocabDue.length > 0 && canAddReview) {
        const dueId = pickId(vocabDue.map(v => v.id), options);
        if (dueId) {
            isReview = true;
            problem = safeGenerateProblem(
                () => generateVocabProblem(dueId, {
                    cooldownIds: buildCooldownIds(pendingVocabIds),
                    kanjiMode: ctx.profile.kanjiMode
                }),
                () => {
                    // Try first due item as fallback
                    if (vocabDue.length > 0) {
                        return generateVocabProblem(vocabDue[0].id, {
                            cooldownIds: buildCooldownIds(pendingVocabIds),
                            kanjiMode: ctx.profile.kanjiMode
                        });
                    }
                    throw new Error('No vocab due items');
                },
                `vocab review: ${dueId}`
            );
        }
    }

    // Priority 2: Normal level-based generation
    if (!problem) {
        const level = pickWeightedLevel(vocabLevelWeights);
        const words = getWordsByLevel(level);
        const wordId = pickId(words.map(w => w.id), options) || words[0]?.id;

        if (wordId) {
            problem = safeGenerateProblem(
                () => generateVocabProblem(wordId, {
                    cooldownIds: buildCooldownIds(pendingVocabIds),
                    kanjiMode: ctx.profile.kanjiMode
                }),
                () => createFallbackProblem('vocab', `vocab level ${level}`),
                `vocab normal: ${wordId}`
            );
        }
    }

    // Final fallback
    if (!problem) {
        problem = createFallbackProblem('vocab', 'all vocab generation paths failed');
    }

    return { problem, isReview, isMaintenanceCheck: false };
};

// ============================================================
// Level Block Generation (For Special Check / Paper Test Alignment)
// ============================================================

export const generateLevelBlock = (
    profile: UserProfile,
    blockSize: number,
    forcedSubject?: SubjectKey
): Problem[] => {
    const q: Problem[] = [];
    const blockCounts = new Map<string, number>();

    // Determine subject based on subjectMode
    let subject: SubjectKey = forcedSubject || (profile.subjectMode === 'vocab' ? 'vocab' : 'math');

    // If not forced and mode is mix, initial subject checks (though loop handles mix)
    // If forcedSubject is set, we stick to it exclusively.

    for (let i = 0; i < blockSize; i++) {
        // For mix, alternate math/vocab (ONLY if not forced)
        if (!forcedSubject && profile.subjectMode === 'mix') {
            subject = i % 2 === 0 ? 'math' : 'vocab';
        }

        const genOptions: GeneratorOptions = {
            cooldownIds: [],
            skippedTodayIds: [],
            blockCounts,
            recentIds: [] // No history filtering for test mode
        };

        let problem: Omit<Problem, 'id' | 'subject' | 'isReview'> | undefined;

        if (subject === 'math') {
            // Strict Level Logic (Level Test)
            const level = profile.mathMainLevel || 1;
            const skills = getSkillsForLevel(level);
            // Fallback (e.g. if level has no skills defined, use level-1 or level 1)
            const validSkills = skills.length > 0 ? skills : getSkillsForLevel(1);

            const skillId = pickId(validSkills, genOptions) || validSkills[0];

            problem = safeGenerateProblem(
                () => generateMathProblem(skillId),
                () => createFallbackProblem('math', 'level block failed'),
                `level block math: ${skillId}`
            );
        } else {
            // Cumulative Logic for Vocab (Standard)
            const level = profile.vocabMainLevel || 1;
            const candidates = ENGLISH_WORDS.filter(w => w.level <= level);
            const wordId = pickId(candidates.map(w => w.id), genOptions) || candidates[0]?.id;

            problem = safeGenerateProblem(
                () => generateVocabProblem(wordId, { cooldownIds: [], kanjiMode: profile.kanjiMode }),
                () => createFallbackProblem('vocab', 'level block failed'),
                `level block vocab: ${wordId}`
            );
        }

        q.push({
            ...problem,
            id: `level-test-${i}-${Date.now()}`,
            subject,
            isReview: false
        });

        markPicked(problem.categoryId, blockCounts);
    }

    return q;
};


// ============================================================
// New New Generators (Plan A)
// ============================================================

/**
 * Weakness Review Block (10 questions)
 * Prioritizes: Weak > Maintenance/LowStrength > Random in Main Level
 */
export const generateWeakReviewBlock = async (
    profile: UserProfile,
    ctx: {
        weakMathIds: string[];
        maintenanceMathIds: string[];
        mathDue: { id: string }[];
        vocabDue: { id: string }[];
    }
): Promise<Problem[]> => {
    const q: Problem[] = [];
    const blockSize = 10;
    const blockCounts = new Map<string, number>();

    // Determine subject (Same logic as normal block, or strictly mix?)
    // Spec says: "Subject independently" but usually we run mixed session.
    // For simplicity in V1, we respect subjectMode.

    // Helper to decide subject for each question
    const getSubject = (i: number): SubjectKey => {
        if (profile.subjectMode === 'math') return 'math';
        if (profile.subjectMode === 'vocab') return 'vocab';
        return i % 2 === 0 ? 'math' : 'vocab';
    };

    const { weakMathIds, maintenanceMathIds, mathDue, vocabDue } = ctx;
    const mathLevel = profile.mathMainLevel || 1;
    const mathSkills = getSkillsForLevel(mathLevel);

    const vocabLevel = profile.vocabMainLevel || 1;
    const vocabWords = getWordsByLevel(vocabLevel);


    for (let i = 0; i < blockSize; i++) {
        const subject = getSubject(i);
        const options: GeneratorOptions = {
            cooldownIds: [],
            skippedTodayIds: [], // We might want to allow skipped items in review? No, stick to standard.
            blockCounts,
            recentIds: [] // We explicitly want to REVIEW, so recent check might be loose.
        };

        let problem: Omit<Problem, 'id' | 'subject' | 'isReview'> | undefined;

        if (subject === 'math') {
            // Priority 1: Weak Math
            const availableWeak = weakMathIds.filter(id => mathSkills.includes(id));
            const weakId = pickId(availableWeak, options);
            if (weakId) {
                problem = safeGenerateProblem(
                    () => generateMathProblem(weakId),
                    () => generateMathProblem("count_10"),
                    `weak-review math weak: ${weakId}`
                );
            }

            // Priority 2: Due / Maintenance (Low Strength)
            if (!problem) {
                const pool = [...mathDue.map(d => d.id), ...maintenanceMathIds];
                const id = pickId(pool, options);
                if (id) {
                    problem = safeGenerateProblem(
                        () => generateMathProblem(id),
                        () => generateMathProblem("count_10"),
                        `weak-review math due/maint: ${id}`
                    );
                }
            }

            // Priority 3: Random in Level
            if (!problem) {
                const id = pickId(mathSkills, options) || mathSkills[0];
                if (id) {
                    problem = safeGenerateProblem(
                        () => generateMathProblem(id),
                        () => generateMathProblem("count_10"),
                        `weak-review math random: ${id}`
                    );
                }
            }
        } else {
            // Vocab Logic
            // Priority 1: Due
            const dueId = pickId(vocabDue.map(v => v.id), options);
            if (dueId) {
                problem = safeGenerateProblem(
                    () => generateVocabProblem(dueId, { cooldownIds: [], kanjiMode: profile.kanjiMode }),
                    () => createFallbackProblem('vocab', 'weak-review fallback'),
                    `weak-review vocab due: ${dueId}`
                );
            }

            // Priority 2: Random in Level
            if (!problem) {
                const id = pickId(vocabWords.map(w => w.id), options) || vocabWords[0]?.id;
                if (id) {
                    problem = safeGenerateProblem(
                        () => generateVocabProblem(id, { cooldownIds: [], kanjiMode: profile.kanjiMode }),
                        () => createFallbackProblem('vocab', 'weak-review level fallback'),
                        `weak-review vocab random: ${id}`
                    );
                }
            }
        }

        if (!problem) {
            problem = createFallbackProblem(subject, 'weak-review total failure');
        }

        q.push({
            ...problem,
            id: `weak-${i}-${Date.now()}`,
            subject,
            isReview: true // Always treat as review for data purposes? Or depend on source?
            // Spec says: "Weak update OK".
        });
        markPicked(problem.categoryId, blockCounts);
    }

    return q;
};

/**
 * Periodic Test Block (20 questions)
 * Strict Level Range, No Weighting.
 */
export const generatePeriodicTestBlock = async (
    profile: UserProfile,
    forcedSubject?: SubjectKey
): Promise<Problem[]> => {
    // Re-use strict level block logic but fixed to 20 size
    const q = generateLevelBlock(profile, 20, forcedSubject);
    // Overwrite IDs to identify as test
    return q.map((p, i) => ({
        ...p,
        id: `test-${i}-${Date.now()}`,
        isReview: false
    }));
};


// ============================================================
// Utility Functions
// ============================================================

/**
 * Calculate session review ratio
 */
export const canAddSessionReview = (
    sessionHistory: SessionHistoryItem[],
    pendingMeta: { isReview: boolean }[]
): boolean => {
    const total = sessionHistory.length + pendingMeta.length;
    if (total === 0) return true;

    const reviewCount =
        sessionHistory.filter(h => h.isReview).length +
        pendingMeta.filter(p => p.isReview).length;

    return reviewCount / total < SESSION_REVIEW_CAP;
};

/**
 * Calculate recent review ratio from attempts
 */
export const calculateRecentReviewRatio = (
    recentAttempts: { isReview: boolean }[]
): number => {
    if (recentAttempts.length === 0) return 0;
    const reviewCount = recentAttempts.filter(r => r.isReview).length;
    return reviewCount / recentAttempts.length;
};

/**
 * Determine subject for mixed mode based on recent history
 */
export const getMixSubject = (
    recentAttempts: { subject: SubjectKey; isReview: boolean }[]
): SubjectKey => {
    const recent = recentAttempts.slice(0, MIX_WINDOW);
    const nonReview = recent.filter(r => !r.isReview);

    if (nonReview.length < 5) {
        return Math.random() > 0.5 ? 'math' : 'vocab';
    }

    const mathCount = nonReview.filter(r => r.subject === 'math').length;
    const ratio = mathCount / nonReview.length;

    if (ratio > 0.7) return 'vocab';
    if (ratio < 0.3) return 'math';
    return Math.random() > 0.5 ? 'math' : 'vocab';
};

/**
 * Build vocab cooldown IDs from recent attempts and session history
 */
export const buildVocabCooldownIds = (
    recentAttempts: { subject: SubjectKey; itemId: string; result: string }[],
    sessionHistory: SessionHistoryItem[],
    pendingIds: string[] = []
): string[] => {
    const ids: string[] = [];
    const seen = new Set<string>();

    const push = (id: string) => {
        if (!seen.has(id)) {
            seen.add(id);
            ids.push(id);
        }
    };

    recentAttempts
        .filter(r => r.subject === 'vocab' && r.result !== 'skipped')
        .slice(0, 10)
        .forEach(r => push(r.itemId));

    sessionHistory
        .filter(h => h.subject === 'vocab')
        .slice(-10)
        .forEach(h => push(h.id));

    pendingIds.forEach(id => push(id));

    return ids;
};

/**
 * Build vocab level weights based on profile
 */
export const buildVocabLevelWeights = (vocabLevel: number): { level: number; weight: number }[] => {
    return [
        { level: vocabLevel, weight: 0.5 },
        { level: vocabLevel - 1, weight: 0.25 },
        { level: vocabLevel - 2, weight: 0.15 },
        { level: vocabLevel - 3, weight: 0.1 }
    ].filter(w => w.level >= 1);
};
