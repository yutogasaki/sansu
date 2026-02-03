import { Problem, UserProfile, SubjectKey } from "./types";
import { generateMathProblem } from "./math";
import { generateVocabProblem } from "./english/generator";
import { getSkillsForLevel, getAvailableSkills } from "./math/curriculum";
import { ENGLISH_WORDS } from "./english/words";
import { isDue } from "./algorithms/srs";

// Constants from Spec 01 (Supplement B)
const CONSTANTS = {
    BLOCK_SIZE: 5,
    BLOCK_DUP_LIMIT: 2,
    WEAK_THRESHOLD_IN: 0.6,
    WEAK_MAX_RATIO: 0.3,
    ENGLISH_REVIEW_RATIO_TRIGGER: 0.5, // Used in Block Decision
    MAINTENANCE_RATE: 0.01,
};

// --- Helper Types ---

interface QueueItem {
    id: string; // skillId or wordId
    subject: SubjectKey;
    isReview: boolean;
    isMaintenance?: boolean;
    priority: number; // For sorting candidates
}

// --- Main Generator ---

export const generateSessionQueue = (user: UserProfile, count = 5): Omit<Problem, 'id' | 'isReview'>[] => {
    const queue: Omit<Problem, 'id' | 'isReview'>[] = [];

    // 1. Decide Subject for this Block (Spec 5.3)
    const englishDueIds = Object.values(user.vocabWords || {})
        .filter(m => isDue(m))
        .map(m => m.id);

    const mathDueIds = Object.values(user.mathSkills || {})
        .filter(m => isDue(m) && m.status === 'active') // Only active for normal review
        .map(m => m.id);

    // Block Subject Decision
    let subject: SubjectKey = 'math';

    if (user.subjectMode === 'math') {
        subject = 'math';
    } else if (user.subjectMode === 'vocab') {
        subject = 'vocab';
    } else {
        // Mix Mode
        if (englishDueIds.length > 0) {
            subject = Math.random() < 0.7 ? 'vocab' : 'math';
        } else {
            subject = Math.random() < 0.5 ? 'math' : 'vocab';
        }
    }

    // 2. Build Candidate List based on Subject

    // --- English Logic ---
    if (subject === 'vocab') {
        const candidates: QueueItem[] = [];

        // A. Due Items (Review)
        englishDueIds.forEach(id => {
            // Priority could be based on overdue days, here static high
            candidates.push({ id, subject: 'vocab', isReview: true, priority: 100 });
        });

        // B. New Items (from Main Level)
        const levelWords = ENGLISH_WORDS.filter(w => w.level === user.vocabMainLevel);
        const touchedIds = new Set(Object.keys(user.vocabWords || {}));

        const newWords = levelWords.filter(w => !touchedIds.has(w.id));

        newWords.forEach(w => {
            candidates.push({ id: w.id, subject: 'vocab', isReview: false, priority: 50 });
        });

        // If no new words, pick random from current level (non-due)
        if (newWords.length === 0 && levelWords.length > 0) {
            levelWords.forEach(w => {
                if (!user.vocabWords[w.id] || !isDue(user.vocabWords[w.id])) {
                    candidates.push({ id: w.id, subject: 'vocab', isReview: false, priority: 10 });
                }
            });
        }

        // Fill Queue
        fillQueue(queue, candidates, count, CONSTANTS.BLOCK_DUP_LIMIT, (id) => generateVocabProblem(id));
    }

    // --- Math Logic ---
    if (subject === 'math') {
        const candidates: QueueItem[] = [];

        // A. Due Items (Review) - Active only
        mathDueIds.forEach(id => {
            candidates.push({ id, subject: 'math', isReview: true, priority: 100 });
        });

        // B. New / Main Items (Active)
        const skills = getSkillsForLevel(user.mathMainLevel);
        skills.forEach(skillId => {
            const mem = user.mathSkills[skillId];
            if (!mem) {
                // New
                candidates.push({ id: skillId, subject: 'math', isReview: false, priority: 50 });
            } else if (mem.status === 'active') {
                // Active but not Due
                if (!isDue(mem)) {
                    candidates.push({ id: skillId, subject: 'math', isReview: false, priority: 40 });
                }
            }
        });

        // C. Maintenance (Retired) - 1% chance
        // Includes Explicit Retired (in DB) AND Implicit Retired (Levels < Main but not in DB)
        if (Math.random() < CONSTANTS.MAINTENANCE_RATE) {
            // 1. Explicit Retired
            const explicitRetired = Object.values(user.mathSkills || {})
                .filter(m => m.status === 'retired')
                .map(m => m.id);

            // 2. Implicit Retired: All skills < MainLevel that are NOT in mathSkills (neither active nor retired)
            // This covers skipped levels.
            const lowerSkills = getAvailableSkills(user.mathMainLevel - 1);
            const knownSkillIds = new Set(Object.keys(user.mathSkills || {}));
            const implicitRetired = lowerSkills.filter(id => !knownSkillIds.has(id));

            const allRetired = [...explicitRetired, ...implicitRetired];

            if (allRetired.length > 0) {
                const rndId = allRetired[Math.floor(Math.random() * allRetired.length)];
                candidates.push({ id: rndId, subject: 'math', isReview: true, isMaintenance: true, priority: 200 });
            }
        }

        // Fill Queue
        fillQueue(queue, candidates, count, CONSTANTS.BLOCK_DUP_LIMIT, (id) => generateMathProblem(id));
    }

    return queue;
};

// --- Helper Functions ---

const fillQueue = (
    queue: Omit<Problem, 'id' | 'isReview'>[],
    candidates: QueueItem[],
    targetCount: number,
    dupLimit: number,
    generator: (id: string) => any
) => {
    // usedCounts tracks how many times each ID has been added to THIS queue
    const usedCounts: Record<string, number> = {};

    const attemptFill = (limit: number) => {
        // Safety Break after reasonable attempts to avoid infinite loop if no candidates available
        // Loop condition: queue not full
        // Break condition: no available candidates

        while (queue.length < targetCount) {
            // Filter candidates that can still be used
            const available = candidates.filter(c => (usedCounts[c.id] || 0) < limit);

            if (available.length === 0) break; // No more candidates

            // Sort: Priority DESC, then Random
            available.sort((a, b) => {
                if (a.priority !== b.priority) return b.priority - a.priority;
                return Math.random() - 0.5;
            });

            const best = available[0];

            try {
                const problemData = generator(best.id);
                queue.push({
                    ...problemData,
                    subject: best.subject,
                    isReview: best.isReview,
                    isMaintenanceCheck: best.isMaintenance
                });
                usedCounts[best.id] = (usedCounts[best.id] || 0) + 1;
            } catch (e) {
                console.error(`Failed to generate problem for ${best.id}`, e);
                usedCounts[best.id] = 999;
            }
        }
    };

    // 1. First Pass: Strict Limit
    attemptFill(dupLimit);

    // 2. Fallback: If not full, relax limit to targetCount (allow filling completely with available)
    if (queue.length < targetCount && candidates.length > 0) {
        attemptFill(targetCount);
    }
};

// Helper for Events
export type EventType =
    | "streak_3"      // 連続学習3日
    | "streak_7"      // 連続学習7日
    | "total_100"     // 100問達成（100の倍数）
    | "level_up_near" // レベルアップ直前
    | "weak_decrease"; // 苦手スキル減少

export interface EventCheckParams {
    profile: UserProfile;
    totalCount: number;
    recentCorrectCount?: number;
    prevWeakCount?: number;
    currentWeakCount?: number;
}

// Check if a special event should be triggered
export const checkEventCondition = (params: EventCheckParams): EventType | null => {
    const { profile, totalCount, recentCorrectCount, prevWeakCount, currentWeakCount } = params;

    if (profile.streak === 3) return "streak_3";
    if (profile.streak === 7) return "streak_7";
    if (totalCount > 0 && totalCount % 100 === 0) return "total_100";
    if (recentCorrectCount !== undefined && recentCorrectCount === 16) return "level_up_near";
    if (prevWeakCount !== undefined && currentWeakCount !== undefined) {
        if (currentWeakCount < prevWeakCount && prevWeakCount > 0) return "weak_decrease";
    }

    return null;
};

// 後方互換性のためのラッパー
export const checkEventConditionSimple = (profile: UserProfile, totalCount: number): EventType | null => {
    return checkEventCondition({ profile, totalCount });
};
