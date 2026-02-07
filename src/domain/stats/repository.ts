import { db } from "../../db";
import { getLearningDayStart, getLearningDayEnd } from "../../utils/learningDay";
import { getRecentAccuracy } from "../learningRepository";

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
        .where('timestamp')
        .between(start, end)
        .filter(log => log.profileId === profileId)
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
        .filter((item: any) => item.profileId === profileId && item.status === 'active')
        .toArray();

    for (const item of mathItems) {
        const accuracy = await getRecentAccuracy(profileId, item.id, 'math');
        // 苦手判定: 5回以上かつ正答率60%未満
        if (accuracy !== null && accuracy < 0.6) {
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
        .filter((item: any) => item.profileId === profileId)
        .toArray();

    for (const item of vocabItems) {
        const accuracy = await getRecentAccuracy(profileId, item.id, 'vocab');
        if (accuracy !== null && accuracy < 0.6) {
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
