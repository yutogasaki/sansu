import { addDays, set } from "date-fns";

export const LEARNING_DAY_START_HOUR = 4;

export const getLearningDayStart = (now: Date = new Date()): Date => {
    const boundary = set(now, {
        hours: LEARNING_DAY_START_HOUR,
        minutes: 0,
        seconds: 0,
        milliseconds: 0
    });
    if (now.getTime() < boundary.getTime()) {
        return addDays(boundary, -1);
    }
    return boundary;
};

export const getLearningDayEnd = (now: Date = new Date()): Date => {
    return addDays(getLearningDayStart(now), 1);
};

/**
 * ローカルタイムゾーンで "YYYY-MM-DD" 形式の日付キーを返す。
 * toISOString().split('T')[0] は UTC 変換されるため、
 * ローカル時間とのずれが発生する。この関数で統一する。
 */
export const toLocaleDateKey = (date: Date = new Date()): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};
