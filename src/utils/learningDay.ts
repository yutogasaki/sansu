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
