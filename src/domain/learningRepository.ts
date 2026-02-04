import { db, AttemptLog } from "../db";
import { MemoryState, SubjectKey } from "./types";
import { updateMemoryState, updateSkillStatus, getNextReviewDate } from "./algorithms/srs";
import { addDays, differenceInCalendarDays, parseISO } from "date-fns";
import { getLearningDayStart } from "../utils/learningDay";

export const logAttempt = async (
    profileId: string,
    subject: SubjectKey,
    itemId: string,
    result: 'correct' | 'incorrect',
    skipped: boolean = false,
    isReview: boolean = false,
    isMaintenanceCheck: boolean = false // 維持確認として出題されたか
) => {
    const timestamp = new Date().toISOString();

    const recentMathLogs =
        subject === 'math'
            ? await db.logs
                .where('[profileId+subject]')
                .equals([profileId, 'math'])
                .filter(log => log.itemId === itemId)
                .reverse()
                .limit(9)
                .toArray()
            : [];

    // 1. Add Log
    const log: AttemptLog = {
        profileId,
        subject,
        itemId,
        result: skipped ? 'skipped' : result,
        isReview,
        timestamp
    };
    const logId = await db.logs.add(log);

    // 2. Update Memory State
    const table = subject === 'math' ? db.memoryMath : db.memoryVocab;
    const existing = await table.get([profileId, itemId]);

    let newState: MemoryState;

    if (existing) {
        // スキップフラグを渡して正しくstrengthを更新
        newState = updateMemoryState(existing, result === 'correct', skipped);
        // Math status update（仕様 5.4: status遷移）
        if (subject === 'math') {
            const currentCorrect = result === 'correct' && !skipped;
            const recentResults = [currentCorrect, ...recentMathLogs.map(l => l.result === 'correct')];

            // 維持確認フラグを渡してstatus遷移を判定
            const status = updateSkillStatus(newState, recentResults, isMaintenanceCheck);
            if (status) newState.status = status;
        }
    } else {
        // Initial State
        newState = {
            id: itemId,
            strength: result === 'correct' ? 2 : 1,
            nextReview: "", // Will be set below
            totalAnswers: 1,
            correctAnswers: result === 'correct' ? 1 : 0,
            incorrectAnswers: result === 'correct' ? 0 : 1,
            skippedAnswers: skipped ? 1 : 0,
            lastCorrectAt: result === 'correct' ? timestamp : undefined,
            updatedAt: timestamp,
            status: subject === 'math' ? 'active' : undefined
        };
        // Use updateMemoryState to set nextReview correctly based on strength
        // actually updateMemoryState expects a state to modify.
        // Let's just manually set nextReview or call getNextReviewDate
        // But wait, updateMemoryState sets nextReview.
        // Let's just use the srs logic.
        // Or simpler: Treat new item as strength 0 -> update?
        // No, let's keep manual init for now to match srs.ts logic if possible.
        // Let's just import getNextReviewDate.
    }

    // Fix: We need to set nextReview for new items if we didn't use updateMemoryState
    if (!existing) {
        // We need getNextReviewDate export
        // For now, let's just use a simple mock if import is hard, but I should add the import.
        // I'll add getNextReviewDate to imports.
        newState.nextReview = getNextReviewDate(newState.strength).toISOString();
    }

    // 3. Save to DB (Extend with profileId)
    // Dexie needs the keys in the object due to [profileId+id] primary key definition
    const dbItem = { ...newState, profileId };
    await table.put(dbItem);

    const profile = await db.profiles.get(profileId);
    if (profile) {
        const dayStart = getLearningDayStart();
        const todayKey = dayStart.toISOString().split("T")[0];
        const yesterdayKey = addDays(dayStart, -1).toISOString().split("T")[0];

        const isSameDay = profile.lastStudyDate === todayKey;
        const isYesterday = profile.lastStudyDate === yesterdayKey;
        const nextStreak = isSameDay ? profile.streak : isYesterday ? profile.streak + 1 : 1;
        const nextTodayCount = isSameDay ? profile.todayCount + 1 : 1;

        const recentAttempts = profile.recentAttempts ? [...profile.recentAttempts] : [];
        recentAttempts.push({
            id: logId.toString(),
            timestamp,
            subject,
            skillId: itemId,
            result: skipped ? "skipped" : result
        });
        const trimmed = recentAttempts.slice(-300);

        await db.profiles.put({
            ...profile,
            streak: nextStreak,
            todayCount: nextTodayCount,
            lastStudyDate: todayKey,
            recentAttempts: trimmed
        });
    }
};

export const getReviewItems = async (profileId: string, subject: SubjectKey) => {
    const table = subject === 'math' ? db.memoryMath : db.memoryVocab;
    const nowIso = new Date().toISOString();

    const items = await table
        .where('nextReview')
        .belowOrEqual(nowIso)
        .filter((item: any) => item.profileId === profileId)
        .toArray();

    const capOverdue = (days: number) => Math.max(0, Math.min(days, 7));
    const learningDayStart = getLearningDayStart();

    return items.sort((a, b) => {
        const aDays = capOverdue(differenceInCalendarDays(learningDayStart, parseISO(a.nextReview)));
        const bDays = capOverdue(differenceInCalendarDays(learningDayStart, parseISO(b.nextReview)));
        return bDays - aDays;
    });
};

export const getRecentAttempts = async (profileId: string, limit: number) => {
    return await db.logs
        .where('profileId')
        .equals(profileId)
        .reverse()
        .limit(limit)
        .toArray();
};

export const getRecentAccuracy = async (
    profileId: string,
    itemId: string,
    subject: SubjectKey,
    windowSize: number = 10,
    minAnswers: number = 5
): Promise<number | null> => {
    const logs = await db.logs
        .where('[profileId+subject]')
        .equals([profileId, subject])
        .filter(log => log.itemId === itemId)
        .reverse()
        .limit(windowSize)
        .toArray();

    if (logs.length < minAnswers) return null;
    const correct = logs.filter(l => l.result === 'correct').length;
    return correct / logs.length;
};

export const getWeakMathSkillIds = async (profileId: string): Promise<string[]> => {
    const weakIds: string[] = [];
    const mathItems = await db.memoryMath
        .filter((item: any) => item.profileId === profileId && item.status === 'active')
        .toArray();

    for (const item of mathItems) {
        const accuracy = await getRecentAccuracy(profileId, item.id, 'math');
        if (accuracy !== null && accuracy < 0.6) {
            weakIds.push(item.id);
        }
    }

    return weakIds;
};

export const getWeakVocabIds = async (profileId: string): Promise<string[]> => {
    const weakIds: string[] = [];
    // Vocab items don't strictly have 'status' field like math in current implementation,
    // or if they do, it's optional. Let's just get all items for the profile.
    const vocabItems = await db.memoryVocab
        .filter((item: any) => item.profileId === profileId)
        .toArray();

    for (const item of vocabItems) {
        const accuracy = await getRecentAccuracy(profileId, item.id, 'vocab');
        if (accuracy !== null && accuracy < 0.6) {
            weakIds.push(item.id);
        }
    }

    return weakIds;
};

export const getMaintenanceMathSkillIds = async (profileId: string): Promise<string[]> => {
    const items = await db.memoryMath
        .filter((item: any) => item.profileId === profileId && item.status === 'maintenance')
        .toArray();
    return items.map(item => item.id);
};

// 仕様 4.7: スキップ3回ガード
// 同一項目のスキップが連続3回起きた場合は、当日は出題停止
export const getSkippedItemsToday = async (
    profileId: string,
    subject: SubjectKey
): Promise<string[]> => {
    const dayStart = getLearningDayStart();
    const dayStartIso = dayStart.toISOString();

    // 当日のスキップログを取得
    const logs = await db.logs
        .where('[profileId+subject]')
        .equals([profileId, subject])
        .filter(log =>
            log.result === 'skipped' &&
            log.timestamp >= dayStartIso
        )
        .toArray();

    // アイテムごとのスキップ回数をカウント
    const skipCounts = new Map<string, number>();
    for (const log of logs) {
        const count = skipCounts.get(log.itemId) || 0;
        skipCounts.set(log.itemId, count + 1);
    }

    // 3回以上スキップされたアイテムを返す
    const skippedItems: string[] = [];
    for (const [itemId, count] of skipCounts) {
        if (count >= 3) {
            skippedItems.push(itemId);
        }
    }

    return skippedItems;
};

// retiredスキルを取得
export const getRetiredMathSkillIds = async (profileId: string): Promise<string[]> => {
    const items = await db.memoryMath
        .filter((item: any) => item.profileId === profileId && item.status === 'retired')
        .toArray();
    return items.map(item => item.id);
};
