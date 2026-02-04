import { UserProfile, SubjectKey, TriggerState } from "../types";
import { getSkillsForLevel } from "../math/curriculum";
import { ENGLISH_WORDS } from "../english/words";

// Constants
const COOL_DOWN_DAYS = 7;
const COOL_DOWN_MS = COOL_DOWN_DAYS * 24 * 60 * 60 * 1000;

// Math Thresholds
const MATH_PRE_LEVELUP_RATE = 0.90;
const MATH_SLOW_DAYS = 14;
const MATH_SLOW_COUNT = 200;
const MATH_STRUGGLE_RECENT_COUNT = 120;
const MATH_STRUGGLE_ACCURACY = 0.70;

// Vocab Thresholds
const VOCAB_PRE_LEVELUP_RATE = 0.85;
const VOCAB_SLOW_DAYS = 14;
const VOCAB_SLOW_COUNT = 150;
const VOCAB_STRUGGLE_RECENT_COUNT = 100;
const VOCAB_STRUGGLE_ACCURACY = 0.65;

const MILLIS_PER_DAY = 24 * 60 * 60 * 1000;

export const checkPeriodTestTrigger = (
    profile: UserProfile,
    subject: SubjectKey
): { isTriggered: boolean; reason: TriggerState['reason'] } => {

    // 1. Cool-down Check
    const state = profile.periodicTestState?.[subject];
    if (state?.isPending) {
        return { isTriggered: false, reason: null }; // Already pending
    }
    if (state?.lastTriggeredAt) {
        const elapsed = Date.now() - state.lastTriggeredAt;
        if (elapsed < COOL_DOWN_MS) {
            return { isTriggered: false, reason: null }; // In cool-down
        }
    }

    // 2. Gather Stats
    const currentLevel = subject === 'math' ? profile.mathMainLevel : profile.vocabMainLevel;

    if (subject === 'math') {
        return checkMathTrigger(profile, currentLevel);
    } else {
        return checkVocabTrigger(profile, currentLevel);
    }
};

const checkMathTrigger = (profile: UserProfile, level: number): { isTriggered: boolean; reason: TriggerState['reason'] } => {
    const skills = getSkillsForLevel(level);
    if (skills.length === 0) return { isTriggered: false, reason: null };

    // A. Pre-LevelUp (Completion)
    let masteredCount = 0;
    skills.forEach(skillId => {
        const m = profile.mathSkills[skillId];
        // Strength >= 4 is considered "mastered" roughly, or simply calculate based on correctness
        // Strict definition of completion: usually all skills passed at least once or SRS level high
        // Using SRS strength >= 4 as "Mastered" proxy for completion rate
        if (m && m.strength >= 4) masteredCount++;
    });
    const completionRate = masteredCount / skills.length;

    if (completionRate >= MATH_PRE_LEVELUP_RATE) {
        return { isTriggered: true, reason: 'pre-levelup' };
    }

    // B. Slow (Days in Level or Total Count in Level)
    const levelState = profile.mathLevels?.find(l => l.level === level);
    const startDate = levelState?.updatedAt ? new Date(levelState.updatedAt).getTime() : Date.now();
    const daysInLevel = (Date.now() - startDate) / MILLIS_PER_DAY;

    // Count strictly for this level is hard to track without level-specific log, 
    // but we can estimate or use totalAnswers if we assume mostly working on main level.
    // Spec says "Accumulated learning volume in this level range".
    // We'll filter recent attempts or use a stored counter if available.
    // Since we don't have a per-level counter in UserProfile history easily, 
    // we will sum up attempts for skills in this level.
    let totalCountInLevel = 0;
    skills.forEach(skillId => {
        const m = profile.mathSkills[skillId];
        if (m) totalCountInLevel += m.totalAnswers;
    });

    if (daysInLevel >= MATH_SLOW_DAYS || totalCountInLevel >= MATH_SLOW_COUNT) {
        return { isTriggered: true, reason: 'slow' };
    }

    // C. Struggle (Recent High Volume but Low Accuracy)
    // Check recent attempts (last 14 days)
    const recent = profile.recentAttempts || [];
    const twoWeeksAgo = Date.now() - (14 * MILLIS_PER_DAY);
    const recentInLevel = recent.filter(a =>
        a.subject === 'math' &&
        new Date(a.timestamp).getTime() > twoWeeksAgo &&
        skills.includes(a.skillId)
    );

    if (recentInLevel.length >= MATH_STRUGGLE_RECENT_COUNT) {
        const correct = recentInLevel.filter(a => a.result === 'correct').length;
        const accuracy = correct / recentInLevel.length;
        if (accuracy < MATH_STRUGGLE_ACCURACY) {
            return { isTriggered: true, reason: 'struggle' };
        }
    }

    return { isTriggered: false, reason: null };
};

const checkVocabTrigger = (profile: UserProfile, level: number): { isTriggered: boolean; reason: TriggerState['reason'] } => {
    const vocabCandidates = ENGLISH_WORDS.filter(w => w.level === level);
    if (vocabCandidates.length === 0) return { isTriggered: false, reason: null };
    const wordIds = vocabCandidates.map(w => w.id);

    // A. Pre-LevelUp
    let masteredCount = 0;
    wordIds.forEach(id => {
        const m = profile.vocabWords[id];
        if (m && m.strength >= 4) masteredCount++;
    });
    const completionRate = masteredCount / wordIds.length;

    if (completionRate >= VOCAB_PRE_LEVELUP_RATE) {
        return { isTriggered: true, reason: 'pre-levelup' };
    }

    // B. Slow
    // Vocab level start date tracking might be less explicit, assume similar to Math or use lastStudyDate approximate
    // Use Math levels structure if VocabLevels exists (it does in type)
    const levelState = profile.vocabLevels?.find(l => l.level === level);
    const startDate = levelState?.updatedAt ? new Date(levelState.updatedAt).getTime() : Date.now();
    const daysInLevel = (Date.now() - startDate) / MILLIS_PER_DAY;

    let totalCountInLevel = 0;
    wordIds.forEach(id => {
        const m = profile.vocabWords[id];
        if (m) totalCountInLevel += m.totalAnswers;
    });

    if (daysInLevel >= VOCAB_SLOW_DAYS || totalCountInLevel >= VOCAB_SLOW_COUNT) {
        return { isTriggered: true, reason: 'slow' };
    }

    // C. Struggle
    const recent = profile.recentAttempts || [];
    const twoWeeksAgo = Date.now() - (14 * MILLIS_PER_DAY);
    const recentInLevel = recent.filter(a =>
        a.subject === 'vocab' &&
        new Date(a.timestamp).getTime() > twoWeeksAgo &&
        wordIds.includes(a.skillId)
    );

    if (recentInLevel.length >= VOCAB_STRUGGLE_RECENT_COUNT) {
        const correct = recentInLevel.filter(a => a.result === 'correct').length;
        const accuracy = correct / recentInLevel.length;
        if (accuracy < VOCAB_STRUGGLE_ACCURACY) {
            return { isTriggered: true, reason: 'struggle' };
        }
    }

    return { isTriggered: false, reason: null };
};
