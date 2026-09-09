import { MemoryState, SkillStatus } from "../types";
import { parseISO } from "date-fns";
import { getLearningDayStart } from "../../utils/learningDay";
import { isReviewDue } from '../learning/reviewPolicy';

// 仕様 5.1: strength → 次回出題間隔
// strength 1: 1日後, 2: 3日後, 3: 7日後, 4: 14日後, 5: 30日後
const INTERVALS = [0, 1, 3, 7, 14, 30]; // Index 1..5
const DAY_MS = 24 * 60 * 60 * 1000;

export interface MemoryAttemptEvidence {
    independence: 'independent' | 'assisted' | 'unknown';
    wholeProblem?: boolean;
    latestChallengeContactAt?: string;
    challengeContactUncertain?: boolean;
}

const normalizeStrength = (strength: number): number => Number.isFinite(strength)
    ? Math.max(1, Math.min(Math.floor(strength), 5))
    : 1;

const parseTimestamp = (value: string | undefined): number => typeof value === "string"
    ? parseISO(value).getTime()
    : Number.NaN;

export const getNextReviewDate = (strength: number, now: Date = new Date()): Date => {
    const days = INTERVALS[normalizeStrength(strength)];
    return new Date(now.getTime() + days * DAY_MS);
};

/** Support can require a check without manufacturing an answer or removing graduation. */
export const beginRelearning = (current: MemoryState, now: Date = new Date()): MemoryState => ({
    ...current,
    strength: 1,
    needsRelearning: true,
    relearningStartedAt: now.toISOString(),
    nextReview: parseTimestamp(current.nextReview) <= now.getTime() ? current.nextReview : now.toISOString(),
    updatedAt: now.toISOString(),
});

export const updateMemoryState = (
    current: MemoryState,
    isCorrect: boolean,
    isSkipped: boolean = false,
    now: Date = new Date(),
    evidence?: MemoryAttemptEvidence,
): MemoryState => {
    const correct = isCorrect && !isSkipped;
    // Only omitted evidence retains the old direct-call contract. A new writer
    // must explicitly identify unknown/assisted or incomplete observations.
    const independent = correct && (!evidence
        || evidence.independence === 'independent' && evidence.wholeProblem !== false);
    const strength = normalizeStrength(current.strength);
    const learningDayStart = getLearningDayStart(now);
    const nextReviewAt = parseTimestamp(current.nextReview);
    const lastIndependentAt = parseTimestamp(current.lastIndependentCorrectAt
        ?? (!evidence ? current.lastCorrectAt : undefined));
    const lastAttemptAt = Math.max(parseTimestamp(current.updatedAt), parseTimestamp(evidence?.latestChallengeContactAt) || -Infinity);
    const elapsed = (timestamp: number) => Number.isFinite(timestamp)
        && now.getTime() - timestamp >= DAY_MS;
    // 仕様34: a learning-day boundary alone is not one elapsed day.
    const canAdvance = !evidence?.challengeContactUncertain && nextReviewAt <= now.getTime()
        && elapsed(lastIndependentAt) && elapsed(lastAttemptAt)
        && lastIndependentAt < learningDayStart.getTime();
    const canFinishRelearning = !evidence?.challengeContactUncertain && nextReviewAt <= now.getTime()
        && elapsed(parseTimestamp(current.relearningStartedAt)) && elapsed(lastAttemptAt);

    let next = { ...current, strength };
    if (!correct) {
        next = beginRelearning(next, now);
        next.nextReview = isSkipped
            ? learningDayStart.toISOString()
            : getNextReviewDate(1, now).toISOString();
    } else if (evidence?.independence === 'assisted') {
        // A correction remains a raw success, but cannot postpone its check.
        next = beginRelearning(next, now);
    } else if (independent) {
        next.strength = current.needsRelearning
            ? canFinishRelearning ? Math.min(strength + 1, 2) : 1
            : Math.min(strength + (canAdvance ? 1 : 0), 5);
        if (current.needsRelearning && canFinishRelearning) {
            next.needsRelearning = false;
            next.relearningStartedAt = undefined;
        } else if (current.needsRelearning && !Number.isFinite(parseTimestamp(current.relearningStartedAt))) {
            // A legacy/incomplete obligation establishes a baseline now; it
            // must not become either immediate mastery or permanent relearning.
            next.relearningStartedAt = now.toISOString();
        }
        // Existing future reservations stay immutable during early practice.
        next.nextReview = nextReviewAt > now.getTime()
            ? current.nextReview
            : getNextReviewDate(next.strength, now).toISOString();
    }

    const timestamp = now.toISOString();
    return {
        ...next,
        totalAnswers: current.totalAnswers + 1,
        correctAnswers: current.correctAnswers + (correct ? 1 : 0),
        incorrectAnswers: current.incorrectAnswers + (correct ? 0 : 1),
        skippedAnswers: (current.skippedAnswers || 0) + (isSkipped ? 1 : 0),
        lastCorrectAt: correct ? timestamp : current.lastCorrectAt,
        lastIndependentCorrectAt: independent ? timestamp : current.lastIndependentCorrectAt,
        updatedAt: timestamp
    };
};

export const isDue = (item: MemoryState): boolean => isReviewDue(item);

/**
 * ウィルソンスコア区間の下限値を返す。
 * サンプル数が少ないほど保守的（低め）に推定するため、
 * 少数回答で偶然正答率が低いだけの場合に弱点と誤判定しにくい。
 * z = 1.0 (≈84%信頼区間) — 学習アプリ用に穏やかな設定
 */
export const wilsonLower = (correct: number, total: number, z: number = 1.0): number => {
    if (total === 0) return 0;
    const p = correct / total;
    const z2 = z * z;
    const denominator = 1 + z2 / total;
    const centre = p + z2 / (2 * total);
    const margin = z * Math.sqrt((p * (1 - p) + z2 / (4 * total)) / total);
    return (centre - margin) / denominator;
};

// 仕様 5.4: 算数 status 遷移
// active → retired: 30問以上 & 直近90%以上 & strength 4以上
// retired → maintenance: 維持確認出題時
// maintenance → active: 失敗が続く場合（直近5回で60%未満）
export const updateSkillStatus = (
    state: MemoryState,
    recentResults?: boolean[], // 直近の正答履歴（新しい順）
    isMaintenanceCheck?: boolean // 維持確認として出題されたか
): SkillStatus | undefined => {
    if (!state.status) return undefined;

    // Dated relearning no longer revokes graduation, including immediately
    // after recovery while the old failures are still in the recent window.
    if (state.needsRelearning || (state.status === 'retired' || state.status === 'maintenance')
        && Number.isFinite(parseTimestamp(state.lastIndependentCorrectAt))) return state.status;

    if (state.status === 'active') {
        // 同日の反復だけで卒業せず、日を空けた想起の実績も必要とする。
        if (state.totalAnswers >= 30 && normalizeStrength(state.strength) >= 4
            && recentResults && recentResults.length >= 10) {
            const recent10 = recentResults.slice(0, 10);
            const accuracy = recent10.filter(r => r).length / recent10.length;

            if (accuracy >= 0.9) {
                return 'retired';
            }
        }
    }

    // retired → maintenance: 維持確認として出題された場合
    if (state.status === 'retired' && isMaintenanceCheck) {
        return 'maintenance';
    }

    // NEW: retired → active: 失敗が続いたら復帰 (Relaxed logic)
    // maintenance → active: 失敗が続く場合
    if ((state.status === 'retired' || state.status === 'maintenance') && recentResults && recentResults.length > 0) {
        // Strict was: recentResults[0] === false -> active
        // Relaxed: active only if 2 failures in last 5, or if only 1 result and it's failure?
        // No, let's say: need at least 2 consecutive failures OR specific low accuracy.
        // Or simpler: If recent result is Fail, check previous. If also Fail, then Active.
        // Single Fail should be warning (maybe maintenance?).

        // Logic: active if recent 2 are BOTH false.
        if (recentResults.length >= 2) {
            if (recentResults[0] === false && recentResults[1] === false) {
                return 'active';
            }
        } else {
            // Less than 2 results available (very rare for retired item unless reset)
            // If just 1 result and it is false, maybe keep retired/maintenance?
            // Let's be safe: if only 1 data point and it failed, maybe it was a fluke. Keep status.
        }
    }

    // maintenance → active: 失敗が続く場合（直近5回で60%未満）- KEEP as secondary check for weaker drift
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
