import { getLearningDayStart } from "../../utils/learningDay";
import { beginRelearning, getNextReviewDate, updateMemoryState, updateSkillStatus, wilsonLower } from "./srs";
import { MemoryState } from "../types";

describe("srs", () => {
    const now = new Date(2026, 8, 8, 12);
    const yesterday = new Date(2026, 8, 7, 12).toISOString();
    const today = getLearningDayStart(now).toISOString();
    const tomorrow = new Date(2026, 8, 9, 12).toISOString();
    const dayMs = 24 * 60 * 60 * 1000;
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
        "schedules strength %i after exactly %i elapsed 24-hour days",
        (strength, days) => {
            const next = getNextReviewDate(strength, now);
            expect(next.getTime() - now.getTime()).toBe(days * dayMs);
        },
    );

    it("increases a due item's strength by only one after a spaced correct answer", () => {
        const result = updateMemoryState(memory({ nextReview: "2026-01-01" }), true, false, now);
        expect(result.strength).toBe(4);
        expect(result.nextReview).toBe(new Date(2026, 8, 22, 12).toISOString());
        expect(result.totalAnswers).toBe(11);
        expect(result.correctAnswers).toBe(8);
        expect(result.incorrectAnswers).toBe(3);
        expect(result.lastCorrectAt).toBe(now.toISOString());
        expect(result.updatedAt).toBe(now.toISOString());
    });

    it("caps strength at 5", () => {
        const result = updateMemoryState(memory({ strength: 5 }), true, false, now);
        expect(result.strength).toBe(5);
        expect(result.nextReview).toBe(new Date(2026, 9, 8, 12).toISOString());
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
        expect(result.nextReview).toBe(new Date(2026, 8, 15, 12).toISOString());
    });

    it("does not treat crossing 04:00 within a minute as a spaced success", () => {
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
        expect(afterBoundary.strength).toBe(1);
        expect(afterBoundary.nextReview).toBe(new Date(2026, 8, 9, 4).toISOString());
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
        expect(corrected.nextReview).toBe(new Date(2026, 8, 9, 12, 1).toISOString());
        expect(corrected.skippedAnswers).toBe(1);
        expect(corrected.correctAnswers).toBe(8);

        const remembered = updateMemoryState(corrected, true, false, new Date(2026, 8, 9, 12, 1));
        expect(remembered.strength).toBe(2);
        expect(remembered.nextReview).toBe(new Date(2026, 8, 12, 12, 1).toISOString());
    });

    it.each([undefined, "", "not-a-date", "2026-09-09T12:00:00"])(
        "does not infer a spaced success from a missing, invalid, or future correct timestamp %s",
        (lastCorrectAt) => {
            const result = updateMemoryState(memory({ lastCorrectAt }), true, false, now);
            expect(result.strength).toBe(3);
            expect(result.nextReview).toBe(new Date(2026, 8, 15, 12).toISOString());
        },
    );

    it("repairs invalid review dates without advancing strength", () => {
        const result = updateMemoryState(memory({ nextReview: "not-a-date" }), true, false, now);
        expect(result.strength).toBe(3);
        expect(result.nextReview).toBe(new Date(2026, 8, 15, 12).toISOString());
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
            state = updateMemoryState(state, true, false, new Date(Math.max(
                Date.parse(state.nextReview), Date.parse(state.updatedAt) + dayMs,
            )));
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

    it("requires 24 hours after the most recent contact before a due item advances", () => {
        const previous = memory({ lastIndependentCorrectAt: yesterday });
        const justBefore = new Date(now.getTime() - 1);
        expect(updateMemoryState(previous, true, false, justBefore, { independence: 'independent' }).strength).toBe(3);
        expect(updateMemoryState(previous, true, false, now, { independence: 'independent' }).strength).toBe(4);
        expect(updateMemoryState({ ...previous, updatedAt: new Date(now.getTime() - 1000).toISOString() },
            true, false, now, { independence: 'independent' }).strength).toBe(3);
    });

    it.each([
        { independence: 'unknown' as const },
        { independence: 'independent' as const, wholeProblem: false },
    ])("does not turn %j into independent recall or extend an existing deadline", (evidence) => {
        const previous = memory({ lastIndependentCorrectAt: yesterday, independentCorrectAnswers: 4 });
        const result = updateMemoryState(previous, true, false, now, evidence);
        expect(result).toMatchObject({
            strength: 3, nextReview: previous.nextReview,
            correctAnswers: 8, totalAnswers: 11, independentCorrectAnswers: 4,
            lastIndependentCorrectAt: yesterday, lastCorrectAt: now.toISOString(),
        });
    });

    it("never borrows a legacy raw correct timestamp for explicitly independent new evidence", () => {
        const result = updateMemoryState(memory(), true, false, now, { independence: 'independent' });
        expect(result.strength).toBe(3);
        expect(result.lastIndependentCorrectAt).toBe(now.toISOString());
    });

    it("records an assisted correction as a raw success while keeping relearning due", () => {
        const previous = memory({ strength: 5, status: 'retired', lastIndependentCorrectAt: yesterday });
        const result = updateMemoryState(previous, true, false, now, { independence: 'assisted' });
        expect(result).toMatchObject({
            strength: 1, status: 'retired', needsRelearning: true,
            relearningStartedAt: now.toISOString(), nextReview: previous.nextReview,
            totalAnswers: 11, correctAnswers: 8, incorrectAnswers: 3,
            lastIndependentCorrectAt: yesterday, lastCorrectAt: now.toISOString(),
        });
        expect(updateSkillStatus(result, Array(10).fill(true), true)).toBe('retired');
    });

    it.each(['retired', 'maintenance'] as const)("keeps %s graduation while failure creates a dated relearning obligation", (status) => {
        const failed = updateMemoryState(memory({ strength: 5, status }), false, false, now);
        expect(failed).toMatchObject({ strength: 1, status, needsRelearning: true, nextReview: tomorrow });
        expect(updateSkillStatus(failed, [false, false, ...Array(8).fill(true)], true)).toBe(status);
    });

    it("does not manufacture answers when support opens or move an existing overdue check later", () => {
        const previous = memory({ strength: 5, status: 'retired', independentCorrectAnswers: 5 });
        const result = beginRelearning(previous, now);
        expect(result).toMatchObject({
            status: 'retired', strength: 1, needsRelearning: true,
            nextReview: previous.nextReview, updatedAt: now.toISOString(), relearningStartedAt: now.toISOString(),
            totalAnswers: 10, correctAnswers: 7, incorrectAnswers: 3, skippedAnswers: 0,
            independentCorrectAnswers: 5, lastCorrectAt: yesterday,
        });
        expect(beginRelearning(memory({ nextReview: 'not-a-date' }), now).nextReview).toBe(now.toISOString());
        expect(beginRelearning(memory({ nextReview: tomorrow }), now).nextReview).toBe(now.toISOString());
    });

    it("requires a delayed independent check after same-day recovery and restarts at no more than strength 2", () => {
        const support = beginRelearning(memory({ strength: 5, status: 'retired' }), now);
        const firstRecoveryAt = new Date(now.getTime() + 60_000);
        const recovery = updateMemoryState(support, true, false, firstRecoveryAt, { independence: 'independent' });
        expect(recovery).toMatchObject({ strength: 1, status: 'retired', needsRelearning: true });
        expect(Date.parse(recovery.nextReview) - firstRecoveryAt.getTime()).toBe(dayMs);
        const tooSoon = updateMemoryState(recovery, true, false, new Date(firstRecoveryAt.getTime() + dayMs - 1),
            { independence: 'independent' });
        expect(tooSoon.needsRelearning).toBe(true);
        expect(tooSoon.strength).toBe(1);
        const delayed = updateMemoryState(recovery, true, false, new Date(recovery.nextReview), { independence: 'independent' });
        expect(delayed).toMatchObject({ strength: 2, status: 'retired', needsRelearning: false });
        expect(delayed.relearningStartedAt).toBeUndefined();
        expect(Date.parse(delayed.nextReview) - Date.parse(recovery.nextReview)).toBe(3 * dayMs);
    });

    it("does not finish relearning from unknown evidence or invalid contact dates", () => {
        const previous = memory({ strength: 5, needsRelearning: true, relearningStartedAt: yesterday });
        expect(updateMemoryState(previous, true, false, now, { independence: 'unknown' }).needsRelearning).toBe(true);
        const invalid = updateMemoryState({ ...previous, relearningStartedAt: 'invalid' }, true, false, now,
            { independence: 'independent' });
        expect(invalid).toMatchObject({ strength: 1, needsRelearning: true, relearningStartedAt: now.toISOString() });
        expect(updateMemoryState(invalid, true, false, new Date(invalid.nextReview), { independence: 'independent' }))
            .toMatchObject({ strength: 2, needsRelearning: false });
    });

    it('keeps full elapsed intervals across 04:00 and daylight-saving transitions', () => {
        for (const origin of [new Date(2026, 8, 8, 3, 59), new Date('2026-03-08T01:59:00-08:00'),
            new Date('2026-11-01T01:59:00-07:00')]) {
            expect(getNextReviewDate(1, origin).getTime() - origin.getTime()).toBe(dayMs);
            expect(getNextReviewDate(5, origin).getTime() - origin.getTime()).toBe(30 * dayMs);
        }
    });

    it("never releases a pending relearning obligation through retirement", () => {
        expect(updateSkillStatus(memory({ strength: 5, totalAnswers: 50, status: 'active', needsRelearning: true }),
            Array(10).fill(true))).toBe('active');
    });

    it.each(['retired', 'maintenance'] as const)('preserves %s after recovery even while earlier failures remain recent', status => {
        const recovered = memory({ status, strength: 2, needsRelearning: false,
            lastIndependentCorrectAt: now.toISOString() });
        expect(updateSkillStatus(recovered, [true, false, false, false, false], true)).toBe(status);
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
