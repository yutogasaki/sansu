import { differenceInCalendarDays } from "date-fns";
import { getLearningDayStart } from "../../utils/learningDay";
import { getNextReviewDate, updateMemoryState, updateSkillStatus, wilsonLower } from "./srs";
import { MemoryState } from "../types";

describe("srs", () => {
    const now = new Date(2026, 8, 8, 12);
    const yesterday = new Date(2026, 8, 7, 12).toISOString();
    const today = getLearningDayStart(now).toISOString();
    const tomorrow = new Date(2026, 8, 9, 4).toISOString();
    const memory = (overrides: Partial<MemoryState> = {}): MemoryState => ({
        id: "test",
        strength: 3,
        nextReview: today,
        totalAnswers: 10,
        correctAnswers: 7,
        incorrectAnswers: 3,
        skippedAnswers: 0,
        lastCorrectAt: yesterday,
        updatedAt: yesterday,
        ...overrides,
    });

    it.each([[1, 1], [2, 3], [3, 7], [4, 14], [5, 30]])(
        "schedules strength %i after %i learning days",
        (strength, days) => {
            const next = getNextReviewDate(strength, now);
            expect(differenceInCalendarDays(next, getLearningDayStart(now))).toBe(days);
            expect(next.getHours()).toBe(4);
        },
    );

    it("increases a due item's strength by only one after a spaced correct answer", () => {
        const result = updateMemoryState(memory({ nextReview: "2026-01-01" }), true, false, now);
        expect(result.strength).toBe(4);
        expect(result.nextReview).toBe(new Date(2026, 8, 22, 4).toISOString());
        expect(result.totalAnswers).toBe(11);
        expect(result.correctAnswers).toBe(8);
        expect(result.incorrectAnswers).toBe(3);
        expect(result.lastCorrectAt).toBe(now.toISOString());
        expect(result.updatedAt).toBe(now.toISOString());
    });

    it("caps strength at 5", () => {
        const result = updateMemoryState(memory({ strength: 5 }), true, false, now);
        expect(result.strength).toBe(5);
        expect(result.nextReview).toBe(new Date(2026, 9, 8, 4).toISOString());
    });

    it("keeps the first correct answer at strength 1 even after earlier failed attempts", () => {
        const result = updateMemoryState(memory({
            strength: 1,
            correctAnswers: 0,
            incorrectAnswers: 10,
            lastCorrectAt: undefined,
        }), true, false, now);
        expect(result.strength).toBe(1);
        expect(result.nextReview).toBe(tomorrow);
        expect(result.correctAnswers).toBe(1);
    });

    it("does not extend strength or the scheduled date through repeated same-day practice", () => {
        let state = updateMemoryState(memory(), true, false, now);
        const scheduledDate = state.nextReview;
        for (let index = 0; index < 10; index++) {
            state = updateMemoryState(state, true, false, new Date(2026, 8, 8, 13, index));
        }
        expect(state.strength).toBe(4);
        expect(state.nextReview).toBe(scheduledDate);
        expect(state.correctAnswers).toBe(18);
        expect(state.totalAnswers).toBe(21);
    });

    it("keeps a future review date during early practice on a different learning day", () => {
        const result = updateMemoryState(memory({ nextReview: tomorrow }), true, false, now);
        expect(result.strength).toBe(3);
        expect(result.nextReview).toBe(tomorrow);
        expect(result.lastCorrectAt).toBe(now.toISOString());
    });

    it("reschedules an already due same-day correct answer at its existing strength", () => {
        const result = updateMemoryState(memory({
            lastCorrectAt: new Date(2026, 8, 8, 5).toISOString(),
            updatedAt: new Date(2026, 8, 8, 5).toISOString(),
        }), true, false, now);
        expect(result.strength).toBe(3);
        expect(result.nextReview).toBe(new Date(2026, 8, 15, 4).toISOString());
    });

    it("uses the local 04:00 boundary for advancing rather than calendar midnight", () => {
        const previous = memory({
            strength: 1,
            nextReview: new Date(2026, 8, 8, 4).toISOString(),
            lastCorrectAt: new Date(2026, 8, 7, 23).toISOString(),
            updatedAt: new Date(2026, 8, 7, 23).toISOString(),
        });
        const beforeBoundary = updateMemoryState(previous, true, false, new Date(2026, 8, 8, 3, 59));
        expect(beforeBoundary.strength).toBe(1);
        expect(beforeBoundary.nextReview).toBe(previous.nextReview);

        const afterBoundary = updateMemoryState(beforeBoundary, true, false, new Date(2026, 8, 8, 4));
        expect(afterBoundary.strength).toBe(2);
        expect(afterBoundary.nextReview).toBe(new Date(2026, 8, 11, 4).toISOString());
    });

    it.each([1, 2, 3, 4, 5])("resets incorrect answers from strength %i to 1 for tomorrow", (strength) => {
        const result = updateMemoryState(memory({ strength }), false, false, now);
        expect(result.strength).toBe(1);
        expect(result.nextReview).toBe(tomorrow);
        expect(result.totalAnswers).toBe(11);
        expect(result.correctAnswers).toBe(7);
        expect(result.incorrectAnswers).toBe(4);
        expect(result.skippedAnswers).toBe(0);
        expect(result.lastCorrectAt).toBe(yesterday);
    });

    it("does not advance strength when an incorrect answer is corrected immediately", () => {
        const failed = updateMemoryState(memory(), false, false, now);
        const corrected = updateMemoryState(failed, true, false, new Date(2026, 8, 8, 12, 1));
        expect(corrected.strength).toBe(1);
        expect(corrected.nextReview).toBe(tomorrow);
        expect(corrected.incorrectAnswers).toBe(4);
        expect(corrected.correctAnswers).toBe(8);
    });

    it.each([false, true])("keeps skip Due today even if isCorrect is %s", (isCorrect) => {
        const result = updateMemoryState(memory(), isCorrect, true, now);
        expect(result.strength).toBe(1);
        expect(result.nextReview).toBe(today);
        expect(result.totalAnswers).toBe(11);
        expect(result.correctAnswers).toBe(7);
        expect(result.incorrectAnswers).toBe(4);
        expect(result.skippedAnswers).toBe(1);
        expect(result.lastCorrectAt).toBe(yesterday);
    });

    it("does not use an old correct timestamp to advance immediately after a skip", () => {
        const skipped = updateMemoryState(memory(), false, true, now);
        const corrected = updateMemoryState(skipped, true, false, new Date(2026, 8, 8, 12, 1));
        expect(corrected.strength).toBe(1);
        expect(corrected.nextReview).toBe(tomorrow);
        expect(corrected.skippedAnswers).toBe(1);
        expect(corrected.correctAnswers).toBe(8);

        const remembered = updateMemoryState(corrected, true, false, new Date(2026, 8, 9, 12));
        expect(remembered.strength).toBe(2);
        expect(remembered.nextReview).toBe(new Date(2026, 8, 12, 4).toISOString());
    });

    it.each([undefined, "", "not-a-date", "2026-09-09T12:00:00"])(
        "does not infer a spaced success from a missing, invalid, or future correct timestamp %s",
        (lastCorrectAt) => {
            const result = updateMemoryState(memory({ lastCorrectAt }), true, false, now);
            expect(result.strength).toBe(3);
            expect(result.nextReview).toBe(new Date(2026, 8, 15, 4).toISOString());
        },
    );

    it("repairs invalid review dates without advancing strength", () => {
        const result = updateMemoryState(memory({ nextReview: "not-a-date" }), true, false, now);
        expect(result.strength).toBe(3);
        expect(result.nextReview).toBe(new Date(2026, 8, 15, 4).toISOString());
    });

    it("does not infer recovery timing from a legacy invalid attempt timestamp", () => {
        const result = updateMemoryState(memory({ updatedAt: "not-a-date" }), true, false, now);
        expect(result.strength).toBe(3);
        expect(result.updatedAt).toBe(now.toISOString());
    });

    it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        "normalizes nonfinite strength %s without persisting an invalid number",
        (strength) => {
            expect(getNextReviewDate(strength, now).toISOString()).toBe(tomorrow);
            const result = updateMemoryState(memory({ strength, lastCorrectAt: undefined }), true, false, now);
            expect(result.strength).toBe(1);
            expect(result.nextReview).toBe(tomorrow);
        },
    );

    it("keeps 30 same-day successes active until later spaced reviews reach strength 4", () => {
        let state = memory({
            strength: 1, totalAnswers: 0, correctAnswers: 0, incorrectAnswers: 0,
            lastCorrectAt: undefined, status: "active",
        });
        let recent: boolean[] = [];
        for (let index = 0; index < 30; index++) {
            state = updateMemoryState(state, true, false, new Date(2026, 8, 8, 12, index));
            recent = [true, ...recent].slice(0, 10);
            state.status = updateSkillStatus(state, recent);
        }
        expect(state).toMatchObject({ strength: 1, totalAnswers: 30, status: "active", nextReview: tomorrow });

        for (const expectedStrength of [2, 3, 4]) {
            state = updateMemoryState(state, true, false, new Date(state.nextReview));
            state.status = updateSkillStatus(state, recent);
            expect(state.strength).toBe(expectedStrength);
            expect(state.status).toBe(expectedStrength === 4 ? "retired" : "active");
        }
    });

    it.each([1, 2, 3, 3.9, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
        "does not retire a skill with insufficient or invalid strength %s",
        (strength) => {
            expect(updateSkillStatus(memory({ strength, totalAnswers: 30, status: "active" }), Array(10).fill(true)))
                .toBe("active");
        },
    );

    it("still requires 30 answers and recent 90% accuracy after spaced recall", () => {
        const spaced = memory({ strength: 4, totalAnswers: 30, status: "active" });
        expect(updateSkillStatus({ ...spaced, totalAnswers: 29 }, Array(10).fill(true))).toBe("active");
        expect(updateSkillStatus(spaced, [...Array(8).fill(true), false, false])).toBe("active");
        expect(updateSkillStatus(spaced, [...Array(9).fill(true), false])).toBe("retired");
    });

    it("preserves an existing retired status when old records lack spaced strength", () => {
        expect(updateSkillStatus(memory({ strength: 1, status: "retired" }), Array(10).fill(true)))
            .toBe("retired");
    });
});

describe("wilsonLower", () => {
    it("returns 0 for 0 total", () => {
        expect(wilsonLower(0, 0)).toBe(0);
    });

    it("returns lower bound for small sample (conservative)", () => {
        // 3/5 = 60% raw, but Wilson lower should be well below 60%
        const score = wilsonLower(3, 5);
        expect(score).toBeLessThan(0.6);
        expect(score).toBeGreaterThan(0.1);
    });

    it("returns higher lower bound for large sample", () => {
        // 6/10 = 60% raw, larger sample → closer to raw rate
        const small = wilsonLower(3, 5);
        const large = wilsonLower(6, 10);
        expect(large).toBeGreaterThan(small);
    });

    it("approaches raw rate with very large sample", () => {
        // 600/1000 = 60%, Wilson lower should be close to 0.6
        const score = wilsonLower(600, 1000);
        expect(score).toBeGreaterThan(0.57);
        expect(score).toBeLessThan(0.6);
    });

    it("perfect score gives high lower bound", () => {
        const score = wilsonLower(10, 10);
        expect(score).toBeGreaterThan(0.9);
    });

    it("zero correct gives low lower bound", () => {
        const score = wilsonLower(0, 10);
        expect(score).toBeLessThan(0.05);
    });
});
