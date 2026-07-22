import { db, AttemptLog } from "../db";
import { SubjectKey } from "./types";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { getLearningDayStart } from "../utils/learningDay";
import {
    getLearningAttemptTransactionTables,
    writeLearningAttemptInTransaction,
} from "./learningAttemptWriter";

export { getInitialNextReviewIso, resolveWeakStateAfterAttempt } from "./learningAttemptWriter";

export const logAttempt = async (
    profileId: string,
    subject: SubjectKey,
    itemId: string,
    result: 'correct' | 'incorrect',
    skipped: boolean = false,
    isReview: boolean = false,
    isMaintenanceCheck: boolean = false, // 維持確認として出題されたか
    timeMs?: number // 回答にかかった時間（ミリ秒）
) => db.transaction(
    "rw",
    getLearningAttemptTransactionTables(db),
    // Keep the writer inside Dexie's async transaction scope. Returning its
    // native promise from a plain callback can commit IndexedDB too early.
    async () => writeLearningAttemptInTransaction(db, {
        profileId,
        subject,
        itemId,
        result: skipped ? "skipped" : result,
        isReview,
        isMaintenanceCheck,
        timestamp: new Date().toISOString(),
        timeMs,
    }),
);

export const getReviewItems = async (profileId: string, subject: SubjectKey) => {
    const table = subject === 'math' ? db.memoryMath : db.memoryVocab;
    const nowIso = new Date().toISOString();

    const items = await table
        .where('[profileId+nextReview]')
        .between([profileId, ''], [profileId, nowIso])
        .toArray();

    const capOverdue = (days: number) => Math.max(0, Math.min(days, 7));
    const learningDayStart = getLearningDayStart();

    // 算数の retired / maintenance は通常 Due ではなく、専用の
    // maintenance 抽選経路だけで扱う。status がない旧データは active 相当。
    const reviewItems = subject === 'math'
        ? items.filter(item => item.status !== 'retired' && item.status !== 'maintenance')
        : items;

    return reviewItems.sort((a, b) => {
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

/**
 * 対象itemIdリストの直近正答率をバッチ計算（1回のDBクエリ）
 * N+1クエリ問題を解消するためのバッチ版
 */
export const getBatchRecentAccuracy = async (
    profileId: string,
    itemIds: string[],
    subject: SubjectKey,
    windowSize: number = 10,
    minAnswers: number = 5
): Promise<Map<string, number | null>> => {
    const result = new Map<string, number | null>();
    if (itemIds.length === 0) return result;

    // 1回のクエリで対象科目のログをまとめて取得
    const itemIdSet = new Set(itemIds);
    const logs = await db.logs
        .where('[profileId+subject]')
        .equals([profileId, subject])
        .filter(log => itemIdSet.has(log.itemId))
        .reverse()
        .toArray();

    // itemIdごとにグルーピング（新しい順を維持）
    const byItem = new Map<string, AttemptLog[]>();
    for (const log of logs) {
        const list = byItem.get(log.itemId);
        if (list) {
            if (list.length < windowSize) list.push(log);
        } else {
            byItem.set(log.itemId, [log]);
        }
    }

    // 各itemの正答率を計算
    for (const id of itemIds) {
        const itemLogs = byItem.get(id);
        if (!itemLogs || itemLogs.length < minAnswers) {
            result.set(id, null);
        } else {
            const correct = itemLogs.filter(l => l.result === 'correct').length;
            result.set(id, correct / itemLogs.length);
        }
    }

    return result;
};

/**
 * 直近ログから正答数・総数のペアをバッチ取得する。
 * ウィルソンスコアなど、正答率以外の統計量でも使えるように分離。
 */
export const getBatchRecentCounts = async (
    profileId: string,
    itemIds: string[],
    subject: SubjectKey,
    windowSize: number = 10,
    minAnswers: number = 5
): Promise<Map<string, { correct: number; total: number } | null>> => {
    const result = new Map<string, { correct: number; total: number } | null>();
    if (itemIds.length === 0) return result;

    const itemIdSet = new Set(itemIds);
    const logs = await db.logs
        .where('[profileId+subject]')
        .equals([profileId, subject])
        .filter(log => itemIdSet.has(log.itemId))
        .reverse()
        .toArray();

    const byItem = new Map<string, AttemptLog[]>();
    for (const log of logs) {
        const list = byItem.get(log.itemId);
        if (list) {
            if (list.length < windowSize) list.push(log);
        } else {
            byItem.set(log.itemId, [log]);
        }
    }

    for (const id of itemIds) {
        const itemLogs = byItem.get(id);
        if (!itemLogs || itemLogs.length < minAnswers) {
            result.set(id, null);
        } else {
            const correct = itemLogs.filter(l => l.result === 'correct').length;
            result.set(id, { correct, total: itemLogs.length });
        }
    }

    return result;
};

/**
 * 回答履歴（古い順）から weak 状態を復元する。
 * IN: 最低5回答かつ直近10回答の正答率 < 60%
 * OUT: 直近10回答の正答率 >= 80%
 * 60%以上80%未満では直前の状態を維持する。
 */
export const resolveWeakState = (
    resultsOldestFirst: AttemptLog['result'][],
    windowSize: number = 10,
    minAnswers: number = 5
): boolean => {
    let isWeak = false;
    const recent: AttemptLog['result'][] = [];

    for (const result of resultsOldestFirst) {
        recent.push(result);
        if (recent.length > windowSize) recent.shift();
        if (recent.length < minAnswers) continue;

        const correct = recent.filter(item => item === 'correct').length;
        const accuracy = correct / recent.length;
        if (accuracy < 0.6) {
            isWeak = true;
        } else if (accuracy >= 0.8) {
            isWeak = false;
        }
    }

    return isWeak;
};

/**
 * 対象itemIdのweak状態を、ログを時系列に再生して一括復元する。
 * 状態専用カラムを持たない既存データでもIN/OUTヒステリシスを守れる。
 */
export const getBatchWeakStatus = async (
    profileId: string,
    itemIds: string[],
    subject: SubjectKey
): Promise<Map<string, boolean>> => {
    const result = new Map<string, boolean>();
    if (itemIds.length === 0) return result;

    const table = subject === 'math' ? db.memoryMath : db.memoryVocab;
    const memoryItems = await table.bulkGet(itemIds.map(id => [profileId, id] as [string, string]));
    const unresolvedIds: string[] = [];

    itemIds.forEach((id, index) => {
        const storedWeak = memoryItems[index]?.isWeak;
        if (typeof storedWeak === 'boolean') {
            result.set(id, storedWeak);
        } else {
            unresolvedIds.push(id);
        }
    });

    if (unresolvedIds.length === 0) return result;

    await db.transaction('rw', db.logs, table, async () => {
        // Re-read after acquiring the write transaction. This serializes the
        // one-time legacy backfill against a concurrent answer write.
        const currentItems = await table.bulkGet(
            unresolvedIds.map(id => [profileId, id] as [string, string]),
        );
        const stillUnresolvedIds = unresolvedIds.filter(
            (_id, index) => typeof currentItems[index]?.isWeak !== 'boolean',
        );

        currentItems.forEach((item, index) => {
            if (typeof item?.isWeak === 'boolean') {
                result.set(unresolvedIds[index], item.isWeak);
            }
        });

        if (stillUnresolvedIds.length === 0) return;

        const itemIdSet = new Set(stillUnresolvedIds);
        const logs = await db.logs
            .where('[profileId+subject]')
            .equals([profileId, subject])
            .filter(log => itemIdSet.has(log.itemId))
            .toArray();

        const byItem = new Map<string, AttemptLog[]>();
        for (const log of logs) {
            const list = byItem.get(log.itemId) || [];
            list.push(log);
            byItem.set(log.itemId, list);
        }

        await Promise.all(stillUnresolvedIds.map(async (id) => {
            const itemLogs = (byItem.get(id) || [])
                .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
            const isWeak = resolveWeakState(itemLogs.map(log => log.result));
            result.set(id, isWeak);
            await table.update([profileId, id], { isWeak });
        }));
    });

    return result;
};

export const getWeakMathSkillIds = async (profileId: string): Promise<string[]> => {
    const mathItems = await db.memoryMath
        .where('profileId')
        .equals(profileId)
        .filter(item => item.status === 'active')
        .toArray();

    const itemIds = mathItems.map(item => item.id);
    const weakStatus = await getBatchWeakStatus(profileId, itemIds, 'math');

    return itemIds.filter(id => weakStatus.get(id) === true);
};

export const getWeakVocabIds = async (profileId: string): Promise<string[]> => {
    const vocabItems = await db.memoryVocab
        .where('profileId')
        .equals(profileId)
        .toArray();

    const itemIds = vocabItems.map(item => item.id);
    const weakStatus = await getBatchWeakStatus(profileId, itemIds, 'vocab');

    return itemIds.filter(id => weakStatus.get(id) === true);
};

export const getMaintenanceMathSkillIds = async (profileId: string): Promise<string[]> => {
    const items = await db.memoryMath
        .where('profileId')
        .equals(profileId)
        .filter(item => item.status === 'maintenance')
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

    // 当日の全回答を取得する。スキップだけに絞ってから並べると、間に
    // 正答・誤答があっても「連続3回」と誤判定してしまう。
    const logs = await db.logs
        .where('[profileId+subject]')
        .equals([profileId, subject])
        .filter(log => log.timestamp >= dayStartIso)
        .toArray();

    const byItem = new Map<string, AttemptLog[]>();
    for (const log of logs) {
        const list = byItem.get(log.itemId) || [];
        list.push(log);
        byItem.set(log.itemId, list);
    }

    // 直近3回がすべてスキップなら当日停止
    const skippedItems: string[] = [];
    for (const [itemId, list] of byItem) {
        const sorted = [...list].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        const recent3 = sorted.slice(0, 3);
        if (recent3.length >= 3 && recent3.every(l => l.skipped === true || l.result === 'skipped')) {
            skippedItems.push(itemId);
        }
    }

    return skippedItems;
};

// retiredスキルを取得
export const getRetiredMathSkillIds = async (profileId: string): Promise<string[]> => {
    const items = await db.memoryMath
        .where('profileId')
        .equals(profileId)
        .filter(item => item.status === 'retired')
        .toArray();
    return items.map(item => item.id);
};
