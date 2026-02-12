import { db } from "../../db";
import { getLearningDayStart, getLearningDayEnd } from "../../utils/learningDay";
import { getBatchRecentAccuracy } from "../learningRepository";

export interface DailyStats {
    count: number;
    correct: number;
}

export interface TotalStats {
    count: number;
    correct: number;
}

export interface WeakPoint {
    id: string;
    subject: 'math' | 'vocab';
    strength: number;
    nextReview: string;
    accuracy: number;
    lastCorrectAt?: string;
}

export const getTodayStats = async (profileId: string): Promise<DailyStats> => {
    const start = getLearningDayStart().toISOString();
    const end = getLearningDayEnd().toISOString();

    const logs = await db.logs
        .where('[profileId+timestamp]')
        .between([profileId, start], [profileId, end])
        .toArray();

    return {
        count: logs.length,
        correct: logs.filter(l => l.result === 'correct').length
    };
};

export const getTotalStats = async (profileId: string): Promise<TotalStats> => {
    const logs = await db.logs
        .where('profileId')
        .equals(profileId)
        .toArray();

    return {
        count: logs.length,
        correct: logs.filter(l => l.result === 'correct').length
    };
};

// 仕様 5.5: 直近10回の正答率を取得
// 仕様 5.5: 苦手判定
// - 最低5回以上回答 & 直近10回の正答率 < 60% → 苦手
// - 直近10回の正答率 >= 80% → 苦手解除
export const getWeakPoints = async (profileId: string): Promise<WeakPoint[]> => {
    const weakPoints: WeakPoint[] = [];

    // Math: active ステータスのスキルのみ対象（仕様 5.4）
    const mathItems = await db.memoryMath
        .where('profileId')
        .equals(profileId)
        .filter(item => item.status === 'active')
        .toArray();

    const mathIds = mathItems.map(item => item.id);
    const mathAccuracyMap = await getBatchRecentAccuracy(profileId, mathIds, 'math');

    for (const item of mathItems) {
        const accuracy = mathAccuracyMap.get(item.id);
        if (accuracy !== null && accuracy !== undefined && accuracy < 0.6) {
            weakPoints.push({
                id: item.id,
                subject: 'math',
                strength: item.strength,
                nextReview: item.nextReview,
                accuracy,
                lastCorrectAt: item.lastCorrectAt
            });
        }
    }

    // Vocab: 全ての単語が対象
    const vocabItems = await db.memoryVocab
        .where('profileId')
        .equals(profileId)
        .toArray();

    const vocabIds = vocabItems.map(item => item.id);
    const vocabAccuracyMap = await getBatchRecentAccuracy(profileId, vocabIds, 'vocab');

    for (const item of vocabItems) {
        const accuracy = vocabAccuracyMap.get(item.id);
        if (accuracy !== null && accuracy !== undefined && accuracy < 0.6) {
            weakPoints.push({
                id: item.id,
                subject: 'vocab',
                strength: item.strength,
                nextReview: item.nextReview,
                accuracy,
                lastCorrectAt: item.lastCorrectAt
            });
        }
    }

    return weakPoints;
};
