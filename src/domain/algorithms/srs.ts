import { MemoryState, SkillStatus } from "../types";
import { parseISO, addDays } from "date-fns";
import { getLearningDayStart } from "../../utils/learningDay";

// 仕様 5.1: strength → 次回出題間隔
// strength 1: 1日後, 2: 3日後, 3: 7日後, 4: 14日後, 5: 30日後
const INTERVALS = [0, 1, 3, 7, 14, 30]; // Index 1..5

export const getNextReviewDate = (strength: number): Date => {
    const days = INTERVALS[Math.min(strength, 5)] || 1;
    return addDays(getLearningDayStart(), days);
};

export const updateMemoryState = (
    current: MemoryState,
    isCorrect: boolean,
    isSkipped: boolean = false
): MemoryState => {
    let newStrength = current.strength;

    // 仕様 5.1: 正解→+1, 不正解/スキップ→1にリセット
    if (isSkipped) {
        newStrength = 1;
    } else if (isCorrect) {
        newStrength = Math.min(newStrength + 1, 5);
    } else {
        newStrength = 1;
    }

    const now = new Date().toISOString();

    return {
        ...current,
        strength: newStrength,
        nextReview: getNextReviewDate(newStrength).toISOString(),
        totalAnswers: current.totalAnswers + 1,
        correctAnswers: current.correctAnswers + (isCorrect && !isSkipped ? 1 : 0),
        incorrectAnswers: current.incorrectAnswers + (!isCorrect && !isSkipped ? 1 : 0),
        skippedAnswers: (current.skippedAnswers || 0) + (isSkipped ? 1 : 0),
        lastCorrectAt: isCorrect && !isSkipped ? now : current.lastCorrectAt,
        updatedAt: now
    };
};

export const isDue = (item: MemoryState): boolean => {
    const due = parseISO(item.nextReview);
    return due.getTime() <= new Date().getTime();
};

// 仕様 5.4: 算数 status 遷移
// active → retired: 30問以上 & 直近90%以上
// retired → maintenance: 維持確認出題時
// maintenance → active: 失敗が続く場合（直近5回で60%未満）
export const updateSkillStatus = (
    state: MemoryState,
    recentResults?: boolean[], // 直近の正答履歴（新しい順）
    isMaintenanceCheck?: boolean // 維持確認として出題されたか
): SkillStatus | undefined => {
    if (!state.status) return undefined;

    if (state.status === 'active') {
        // 仕様: 30問以上 & 直近90%以上でretired
        if (state.totalAnswers >= 30) {
            // 直近の正答率を計算（recentResultsがあれば使う、なければ全体で代用）
            let accuracy: number;
            if (recentResults && recentResults.length >= 10) {
                const recent10 = recentResults.slice(0, 10);
                accuracy = recent10.filter(r => r).length / recent10.length;
            } else {
                // 全体の正答率で代用
                accuracy = state.correctAnswers / state.totalAnswers;
            }

            if (accuracy >= 0.9) {
                return 'retired';
            }
        }
    }

    // retired → maintenance: 維持確認として出題された場合
    if (state.status === 'retired' && isMaintenanceCheck) {
        return 'maintenance';
    }

    // maintenance → active: 失敗が続く場合（直近5回で60%未満）
    if (state.status === 'maintenance' && recentResults && recentResults.length >= 5) {
        const recent5 = recentResults.slice(0, 5);
        const correctCount = recent5.filter(r => r).length;
        const accuracy = correctCount / 5;
        if (accuracy < 0.6) {
            return 'active';
        }
    }

    return state.status;
};
