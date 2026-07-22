import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AttemptLog } from "../db";
import type { MemoryState } from "./types";
import { getLearningDayStart } from "../utils/learningDay";

const mocks = vi.hoisted(() => ({
    mathItems: [] as MemoryState[],
    vocabItems: [] as MemoryState[],
    mathDueItems: [] as MemoryState[],
    vocabDueItems: [] as MemoryState[],
    logs: [] as AttemptLog[],
    transaction: vi.fn(),
}));

vi.mock("../db", () => {
    const createMemoryTable = (subject: "math" | "vocab") => {
        const getItems = () => subject === "math" ? mocks.mathItems : mocks.vocabItems;
        return {
            bulkGet: vi.fn(async (keys: [string, string][]) => keys.map(([, id]) => (
                getItems().find(item => item.id === id)
            ))),
            update: vi.fn(async ([, id]: [string, string], changes: Partial<MemoryState>) => {
                const items = getItems();
                const index = items.findIndex(item => item.id === id);
                if (index < 0) return 0;
                items[index] = { ...items[index], ...changes };
                return 1;
            }),
            where: vi.fn((index: string) => {
                if (index === "[profileId+nextReview]") {
                    return {
                        between: vi.fn(() => ({
                            toArray: async () => [
                                ...(subject === "math" ? mocks.mathDueItems : mocks.vocabDueItems),
                            ],
                        })),
                    };
                }

                return {
                    equals: vi.fn(() => ({
                        filter: vi.fn((predicate: (item: MemoryState) => boolean) => ({
                            toArray: async () => getItems().filter(predicate),
                        })),
                    })),
                };
            }),
        };
    };

    return {
        db: {
            transaction: mocks.transaction,
            memoryMath: createMemoryTable("math"),
            memoryVocab: createMemoryTable("vocab"),
            logs: {
                where: vi.fn(() => ({
                    equals: vi.fn(() => ({
                        filter: vi.fn((predicate: (log: AttemptLog) => boolean) => {
                            const filtered = mocks.logs.filter(predicate);
                            return {
                                toArray: async () => [...filtered],
                                reverse: vi.fn(() => ({
                                    toArray: async () => [...filtered].reverse(),
                                })),
                            };
                        }),
                    })),
                })),
            },
        },
    };
});

vi.mock("./user/repository", () => ({
    getProfile: vi.fn(),
    saveProfile: vi.fn(),
}));

import {
    getReviewItems,
    getBatchWeakStatus,
    getSkippedItemsToday,
    getWeakMathSkillIds,
    resolveWeakState,
    resolveWeakStateAfterAttempt,
} from "./learningRepository";

const memory = (id: string, status?: MemoryState["status"], nextReview = "2026-07-01T00:00:00.000Z"): MemoryState => ({
    profileId: "p1",
    id,
    strength: 3,
    nextReview,
    totalAnswers: 10,
    correctAnswers: 7,
    incorrectAnswers: 3,
    skippedAnswers: 0,
    updatedAt: "2026-07-01T00:00:00.000Z",
    status,
});

const logsFor = (itemId: string, results: AttemptLog["result"][]): AttemptLog[] => (
    results.map((result, index) => ({
        profileId: "p1",
        subject: "math",
        itemId,
        result,
        timestamp: new Date(Date.UTC(2026, 6, 1, 0, index)).toISOString(),
    }))
);

beforeEach(() => {
    mocks.mathItems = [];
    mocks.vocabItems = [];
    mocks.mathDueItems = [];
    mocks.vocabDueItems = [];
    mocks.logs = [];
    mocks.transaction.mockClear();
    mocks.transaction.mockImplementation(async (...args: unknown[]) => {
        const callback = args.at(-1) as () => Promise<unknown>;
        return callback();
    });
});

describe("getReviewItems", () => {
    it("excludes retired and maintenance math skills from normal Due", async () => {
        mocks.mathDueItems = [
            memory("active", "active", "2026-07-10T00:00:00.000Z"),
            memory("retired", "retired", "2026-07-01T00:00:00.000Z"),
            memory("maintenance", "maintenance", "2026-07-02T00:00:00.000Z"),
            memory("legacy", undefined, "2026-07-03T00:00:00.000Z"),
        ];

        const items = await getReviewItems("p1", "math");

        expect(new Set(items.map(item => item.id))).toEqual(new Set(["active", "legacy"]));
    });

    it("does not apply math status filtering to vocabulary", async () => {
        mocks.vocabDueItems = [memory("word", undefined)];

        await expect(getReviewItems("p1", "vocab")).resolves.toEqual([
            expect.objectContaining({ id: "word" }),
        ]);
    });
});

describe("resolveWeakState", () => {
    it("does not classify 4/5 correct as weak", () => {
        expect(resolveWeakState(["correct", "correct", "correct", "correct", "incorrect"])).toBe(false);
    });

    it("keeps weak through the 60%-79% recovery band and clears at 80%", () => {
        const enteredThenRecoveredTo70: AttemptLog["result"][] = [
            "incorrect", "incorrect", "incorrect", "correct", "correct",
            "correct", "correct", "correct", "correct", "correct",
        ];

        expect(resolveWeakState(enteredThenRecoveredTo70)).toBe(true);
        expect(resolveWeakState([...enteredThenRecoveredTo70, "correct"])).toBe(false);
    });

    it("does not enter weak at exactly 60%", () => {
        expect(resolveWeakState(["correct", "correct", "correct", "incorrect", "incorrect"])).toBe(false);
    });

    it("persists the hysteresis band and changes only at the IN/OUT thresholds", () => {
        expect(resolveWeakStateAfterAttempt(false, [
            "incorrect", "incorrect", "incorrect", "correct", "correct",
        ])).toBe(true);
        expect(resolveWeakStateAfterAttempt(true, [
            "incorrect", "incorrect", "incorrect", "correct", "correct",
            "correct", "correct", "correct", "correct", "correct",
        ])).toBe(true);
        expect(resolveWeakStateAfterAttempt(true, [
            "incorrect", "incorrect", "correct", "correct", "correct",
            "correct", "correct", "correct", "correct", "correct",
        ])).toBe(false);
    });
});

describe("getWeakMathSkillIds", () => {
    it("uses the shared hysteresis contract and only considers active skills", async () => {
        mocks.mathItems = [
            memory("recovering", "active"),
            memory("stable", "active"),
            memory("retired-weak", "retired"),
        ];
        mocks.logs = [
            ...logsFor("recovering", [
                "incorrect", "incorrect", "incorrect", "correct", "correct",
                "correct", "correct", "correct", "correct", "correct",
            ]),
            ...logsFor("stable", [
                "correct", "correct", "correct", "correct", "incorrect",
                "correct", "incorrect", "correct", "incorrect", "correct",
            ]),
            ...logsFor("retired-weak", [
                "incorrect", "incorrect", "incorrect", "incorrect", "incorrect",
            ]),
        ];

        await expect(getWeakMathSkillIds("p1")).resolves.toEqual(["recovering"]);
    });

    it("uses persisted hysteresis state without replaying it from the current window", async () => {
        mocks.mathItems = [
            { ...memory("persisted-weak", "active"), isWeak: true },
            { ...memory("persisted-stable", "active"), isWeak: false },
        ];
        mocks.logs = [];

        await expect(getWeakMathSkillIds("p1")).resolves.toEqual(["persisted-weak"]);
    });

    it("backfills a legacy weak state only once", async () => {
        mocks.mathItems = [memory("legacy-weak", "active")];
        mocks.logs = logsFor("legacy-weak", [
            "incorrect", "incorrect", "incorrect", "correct", "correct",
        ]);

        await expect(getBatchWeakStatus("p1", ["legacy-weak"], "math")).resolves.toEqual(
            new Map([["legacy-weak", true]]),
        );
        await expect(getBatchWeakStatus("p1", ["legacy-weak"], "math")).resolves.toEqual(
            new Map([["legacy-weak", true]]),
        );
        expect(mocks.transaction).toHaveBeenCalledTimes(1);
        expect(mocks.mathItems[0].isWeak).toBe(true);
    });
});

describe("getSkippedItemsToday", () => {
    const todayLog = (itemId: string, result: AttemptLog["result"], order: number): AttemptLog => ({
        profileId: "p1",
        subject: "math",
        itemId,
        result,
        skipped: result === "skipped" || undefined,
        timestamp: new Date(getLearningDayStart().getTime() + order * 60_000).toISOString(),
    });

    it("stops an item after three consecutive skips", async () => {
        mocks.logs = [
            todayLog("repeat-skip", "skipped", 3),
            todayLog("repeat-skip", "skipped", 2),
            todayLog("repeat-skip", "skipped", 1),
        ];

        await expect(getSkippedItemsToday("p1", "math")).resolves.toEqual(["repeat-skip"]);
    });

    it("does not treat skips separated by answers as consecutive", async () => {
        mocks.logs = [
            todayLog("interleaved", "skipped", 5),
            todayLog("interleaved", "correct", 4),
            todayLog("interleaved", "skipped", 3),
            todayLog("interleaved", "incorrect", 2),
            todayLog("interleaved", "skipped", 1),
        ];

        await expect(getSkippedItemsToday("p1", "math")).resolves.toEqual([]);
    });
});
