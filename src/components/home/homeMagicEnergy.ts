export interface HomeMagicEnergyParams {
    todayCount: number;
    todayCorrect: number;
    streak: number;
    weakCount: number;
}

export interface HomeMagicEnergyState {
    currentValue: number;
    maxValue: number;
    percent: number;
    isFull: boolean;
}

const MAGIC_TARGET = 12;

function clamp(value: number, min: number, max: number) {
    return Math.max(min, Math.min(max, value));
}

export function getHomeMagicEnergyState({
    todayCount,
    todayCorrect,
    streak,
    weakCount,
}: HomeMagicEnergyParams): HomeMagicEnergyState {
    const streakBoost = Math.min(3, Math.max(streak, 0));
    const studyBoost = Math.min(8, Math.max(todayCount, 0));
    const accuracyBoost = todayCount > 0 && todayCorrect === todayCount ? 1 : 0;
    const calmBoost = weakCount === 0 && todayCount > 0 ? 1 : 0;
    const weakPenalty = weakCount >= 6 ? 1 : 0;
    const currentValue = clamp(streakBoost + studyBoost + accuracyBoost + calmBoost - weakPenalty, 0, MAGIC_TARGET);
    const percent = Math.round((currentValue / MAGIC_TARGET) * 100);

    return {
        currentValue,
        maxValue: MAGIC_TARGET,
        percent,
        isFull: currentValue >= MAGIC_TARGET,
    };
}

export function getHomeMagicEnergyLabel(percent: number, useKanjiText: boolean) {
    if (percent >= 100) return useKanjiText ? "満タン✨" : "まんたん✨";
    if (percent >= 90) return useKanjiText ? "あと少し" : "あとすこし";
    if (percent >= 61) return useKanjiText ? "いっぱい" : "いっぱい";
    if (percent >= 31) return useKanjiText ? "いい感じ" : "いいかんじ";
    if (percent >= 1) return useKanjiText ? "少し" : "すこし";
    return useKanjiText ? "からっぽ" : "からっぽ";
}

export function getHomeMagicEnergyHint(percent: number, useKanjiText: boolean, isSending = false) {
    if (isSending) {
        return useKanjiText ? "いま ふわふわへ 届いてるよ" : "いま ふわふわへ とどいてるよ";
    }
    if (percent >= 100) {
        return useKanjiText ? "タップで ふわふわへ 届けよう" : "タップで ふわふわへ とどけよう";
    }
    if (percent >= 90) {
        return useKanjiText ? "あと少しで ふわふわへ 届きそう" : "あと すこしで ふわふわへ とどきそう";
    }
    if (percent >= 31) {
        return useKanjiText ? "今日のがんばりが じわっと 光ってる" : "きょうの がんばりが じわっと ひかってる";
    }
    if (percent >= 1) {
        return useKanjiText ? "勉強すると ここに 光がたまるよ" : "べんきょうすると ここに ひかりが たまるよ";
    }
    return useKanjiText ? "まだ静か。でも すぐ光りはじめるよ" : "まだ しずか。でも すぐ ひかりはじめるよ";
}
