import { UserProfile, SubjectKey, TriggerState, MemoryState } from "../types";
import { getSkillsForLevel } from "../math/curriculum";
import { ENGLISH_WORDS } from "../english/words";
import { db } from "../../db";

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

/**
 * DBテーブルから対象itemIdのMemoryStateをバッチ取得
 */
const getMemoryStatesFromDB = async (
    profileId: string,
    itemIds: string[],
    subject: SubjectKey
): Promise<Map<string, MemoryState>> => {
    const table = subject === 'math' ? db.memoryMath : db.memoryVocab;
    const result = new Map<string, MemoryState>();

    // バッチ取得（1クエリ）
    const items = await table
        .filter((item: any) => item.profileId === profileId)
        .toArray();

    const idSet = new Set(itemIds);
    for (const item of items) {
        if (idSet.has(item.id)) {
            result.set(item.id, item);
        }
    }

    return result;
};

export const checkPeriodTestTrigger = async (
    profile: UserProfile,
    subject: SubjectKey
): Promise<{ isTriggered: boolean; reason: TriggerState['reason'] }> => {

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

const checkMathTrigger = async (profile: UserProfile, level: number): Promise<{ isTriggered: boolean; reason: TriggerState['reason'] }> => {
    const skills = getSkillsForLevel(level);
    if (skills.length === 0) return { isTriggered: false, reason: null };

    // DBから対象スキルのMemoryStateをバッチ取得
    const memoryMap = await getMemoryStatesFromDB(profile.id, skills, 'math');

    // A. Pre-LevelUp (Completion)
    let masteredCount = 0;
    skills.forEach(skillId => {
        const m = memoryMap.get(skillId);
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

    let totalCountInLevel = 0;
    skills.forEach(skillId => {
        const m = memoryMap.get(skillId);
        if (m) totalCountInLevel += m.totalAnswers;
    });

    if (daysInLevel >= MATH_SLOW_DAYS || totalCountInLevel >= MATH_SLOW_COUNT) {
        return { isTriggered: true, reason: 'slow' };
    }

    // C. Struggle (Recent High Volume but Low Accuracy)
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

const checkVocabTrigger = async (profile: UserProfile, level: number): Promise<{ isTriggered: boolean; reason: TriggerState['reason'] }> => {
    const vocabCandidates = ENGLISH_WORDS.filter(w => w.level === level);
    if (vocabCandidates.length === 0) return { isTriggered: false, reason: null };
    const wordIds = vocabCandidates.map(w => w.id);

    // DBから対象単語のMemoryStateをバッチ取得
    const memoryMap = await getMemoryStatesFromDB(profile.id, wordIds, 'vocab');

    // A. Pre-LevelUp
    let masteredCount = 0;
    wordIds.forEach(id => {
        const m = memoryMap.get(id);
        if (m && m.strength >= 4) masteredCount++;
    });
    const completionRate = masteredCount / wordIds.length;

    if (completionRate >= VOCAB_PRE_LEVELUP_RATE) {
        return { isTriggered: true, reason: 'pre-levelup' };
    }

    // B. Slow
    const levelState = profile.vocabLevels?.find(l => l.level === level);
    const startDate = levelState?.updatedAt ? new Date(levelState.updatedAt).getTime() : Date.now();
    const daysInLevel = (Date.now() - startDate) / MILLIS_PER_DAY;

    let totalCountInLevel = 0;
    wordIds.forEach(id => {
        const m = memoryMap.get(id);
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
