import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryState } from "../types";

const mocks = vi.hoisted(() => ({
    mathItems: [] as MemoryState[],
    vocabItems: [] as MemoryState[],
    mathAccuracy: new Map<string, number | null>(),
    vocabAccuracy: new Map<string, number | null>(),
    mathWeak: new Map<string, boolean>(),
    vocabWeak: new Map<string, boolean>(),
    getBatchRecentAccuracy: vi.fn(),
    getBatchWeakStatus: vi.fn(),
}));

vi.mock("../../db", () => {
    const createMemoryTable = (subject: "math" | "vocab") => ({
        where: vi.fn(() => ({
            equals: vi.fn(() => ({
                filter: vi.fn((predicate: (item: MemoryState) => boolean) => ({
                    toArray: async () => (
                        subject === "math" ? mocks.mathItems : mocks.vocabItems
                    ).filter(predicate),
                })),
                toArray: async () => [
                    ...(subject === "math" ? mocks.mathItems : mocks.vocabItems),
                ],
            })),
        })),
    });

    return {
        db: {
            memoryMath: createMemoryTable("math"),
            memoryVocab: createMemoryTable("vocab"),
        },
    };
});

vi.mock("../learningRepository", () => ({
    getBatchRecentAccuracy: mocks.getBatchRecentAccuracy,
    getBatchWeakStatus: mocks.getBatchWeakStatus,
}));

import { getWeakPoints } from "./repository";

const memory = (id: string, status?: MemoryState["status"]): MemoryState => ({
    profileId: "p1",
    id,
    strength: 2,
    nextReview: "2026-07-20T00:00:00.000Z",
    totalAnswers: 10,
    correctAnswers: 7,
    incorrectAnswers: 3,
    skippedAnswers: 0,
    updatedAt: "2026-07-18T00:00:00.000Z",
    status,
});

describe("getWeakPoints", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.mathItems = [];
        mocks.vocabItems = [];
        mocks.mathAccuracy = new Map();
        mocks.vocabAccuracy = new Map();
        mocks.mathWeak = new Map();
        mocks.vocabWeak = new Map();
        mocks.getBatchRecentAccuracy.mockImplementation(async (_profileId, _ids, subject) => (
            subject === "math" ? mocks.mathAccuracy : mocks.vocabAccuracy
        ));
        mocks.getBatchWeakStatus.mockImplementation(async (_profileId, _ids, subject) => (
            subject === "math" ? mocks.mathWeak : mocks.vocabWeak
        ));
    });

    it("uses the same hysteresis state as scheduling, including the recovery band", async () => {
        mocks.mathItems = [
            memory("recovering", "active"),
            memory("stable", "active"),
            memory("retired", "retired"),
        ];
        mocks.vocabItems = [memory("word-weak"), memory("word-recovered")];
        mocks.mathAccuracy = new Map([
            ["recovering", 0.7],
            ["stable", 0.7],
        ]);
        mocks.mathWeak = new Map([
            ["recovering", true],
            ["stable", false],
        ]);
        mocks.vocabAccuracy = new Map([
            ["word-weak", 0.5],
            ["word-recovered", 0.8],
        ]);
        mocks.vocabWeak = new Map([
            ["word-weak", true],
            ["word-recovered", false],
        ]);

        const points = await getWeakPoints("p1");

        expect(points.map(point => point.id)).toEqual(["recovering", "word-weak"]);
        expect(points[0]?.accuracy).toBe(0.7);
        expect(mocks.getBatchWeakStatus).toHaveBeenCalledWith(
            "p1",
            ["recovering", "stable"],
            "math"
        );
    });
});
