import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AppData, MemoryState, UserProfile } from "../types";

const mocks = vi.hoisted(() => ({
    storedAppData: undefined as (AppData & { id: string }) | undefined,
    localActiveId: null as string | null,
    appDataGet: vi.fn(),
    appDataPut: vi.fn(),
    profilesToArray: vi.fn(),
    profilesPut: vi.fn(),
    profilesDelete: vi.fn(),
    transaction: vi.fn(),
    memoryMathWhere: vi.fn(),
    memoryMathEquals: vi.fn(),
    memoryMathToArray: vi.fn(),
    memoryMathDelete: vi.fn(),
    memoryVocabWhere: vi.fn(),
    memoryVocabEquals: vi.fn(),
    memoryVocabToArray: vi.fn(),
    memoryVocabDelete: vi.fn(),
    logsWhere: vi.fn(),
    logsEquals: vi.fn(),
    logsDelete: vi.fn(),
    exploreRunsWhere: vi.fn(),
    exploreRunsEquals: vi.fn(),
    exploreRunsDelete: vi.fn(),
    exploreRunEventsWhere: vi.fn(),
    exploreRunEventsEquals: vi.fn(),
    exploreRunEventsDelete: vi.fn(),
    exploreDiscoveriesWhere: vi.fn(),
    exploreDiscoveriesEquals: vi.fn(),
    exploreDiscoveriesDelete: vi.fn(),
    getLocalActiveId: vi.fn(),
    setLocalActiveId: vi.fn(),
    clearLocalActiveId: vi.fn(),
    clearProfileStorageData: vi.fn(),
}));

vi.mock("../../db", () => ({
    db: {
        transaction: mocks.transaction,
        appData: {
            get: mocks.appDataGet,
            put: mocks.appDataPut,
        },
        profiles: {
            toArray: mocks.profilesToArray,
            put: mocks.profilesPut,
            delete: mocks.profilesDelete,
        },
        memoryMath: {
            where: mocks.memoryMathWhere,
        },
        memoryVocab: {
            where: mocks.memoryVocabWhere,
        },
        logs: {
            where: mocks.logsWhere,
        },
        exploreRuns: {
            where: mocks.exploreRunsWhere,
        },
        exploreRunEvents: {
            where: mocks.exploreRunEventsWhere,
        },
        exploreDiscoveries: {
            where: mocks.exploreDiscoveriesWhere,
        },
    },
}));

vi.mock("../../utils/storage", () => ({
    clearProfileStorageData: mocks.clearProfileStorageData,
    profileStorage: {
        getActiveId: mocks.getLocalActiveId,
        setActiveId: mocks.setLocalActiveId,
        clearActiveId: mocks.clearLocalActiveId,
    },
}));

import { generateMathProblem } from "../math";
import {
    deleteProfile,
    getActiveProfile,
    getProfile,
    saveProfile,
    updateProfileAtomically,
} from "./repository";

const profile = (id: string): UserProfile => ({
    id,
    name: id,
    soundEnabled: false,
} as UserProfile);

const appData = (
    profiles: UserProfile[],
    activeProfileId: string | null,
): AppData & { id: string } => ({
    id: "app",
    schemaVersion: 1,
    activeProfileId,
    profiles: Object.fromEntries(profiles.map((item) => [item.id, item])),
});

const memory = (
    id: string,
    profileId: string,
    totalAnswers: number,
    status?: MemoryState["status"],
): MemoryState => ({
    profileId,
    id,
    strength: 2,
    nextReview: "2026-07-21T00:00:00.000Z",
    totalAnswers,
    correctAnswers: totalAnswers,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    updatedAt: "2026-07-18T00:00:00.000Z",
    status,
});

describe("getActiveProfile", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.storedAppData = undefined;
        mocks.localActiveId = null;
        mocks.appDataGet.mockImplementation(async () => mocks.storedAppData);
        mocks.appDataPut.mockImplementation(async (value: AppData & { id: string }) => {
            mocks.storedAppData = value;
        });
        mocks.profilesToArray.mockResolvedValue([]);
        mocks.transaction.mockImplementation(async (...args: unknown[]) => {
            const callback = args.at(-1) as () => Promise<unknown>;
            return callback();
        });
        mocks.memoryMathWhere.mockReturnValue({ equals: mocks.memoryMathEquals });
        mocks.memoryMathEquals.mockReturnValue({
            toArray: mocks.memoryMathToArray,
            delete: mocks.memoryMathDelete,
        });
        mocks.memoryMathToArray.mockResolvedValue([]);
        mocks.memoryVocabWhere.mockReturnValue({ equals: mocks.memoryVocabEquals });
        mocks.memoryVocabEquals.mockReturnValue({
            toArray: mocks.memoryVocabToArray,
            delete: mocks.memoryVocabDelete,
        });
        mocks.memoryVocabToArray.mockResolvedValue([]);
        mocks.logsWhere.mockReturnValue({ equals: mocks.logsEquals });
        mocks.logsEquals.mockReturnValue({ delete: mocks.logsDelete });
        mocks.exploreRunsWhere.mockReturnValue({ equals: mocks.exploreRunsEquals });
        mocks.exploreRunsEquals.mockReturnValue({ delete: mocks.exploreRunsDelete });
        mocks.exploreRunEventsWhere.mockReturnValue({ equals: mocks.exploreRunEventsEquals });
        mocks.exploreRunEventsEquals.mockReturnValue({ delete: mocks.exploreRunEventsDelete });
        mocks.exploreDiscoveriesWhere.mockReturnValue({ equals: mocks.exploreDiscoveriesEquals });
        mocks.exploreDiscoveriesEquals.mockReturnValue({ delete: mocks.exploreDiscoveriesDelete });
        mocks.getLocalActiveId.mockImplementation(() => mocks.localActiveId);
        mocks.setLocalActiveId.mockImplementation((id: string) => {
            mocks.localActiveId = id;
        });
        mocks.clearLocalActiveId.mockImplementation(() => {
            mocks.localActiveId = null;
        });
    });

    it("repairs a stale local id from the valid AppData active profile", async () => {
        const expected = profile("valid");
        mocks.storedAppData = appData([expected], expected.id);
        mocks.localActiveId = "deleted";

        await expect(getActiveProfile()).resolves.toBe(expected);
        expect(mocks.setLocalActiveId).toHaveBeenCalledWith(expected.id);
        expect(mocks.appDataPut).not.toHaveBeenCalled();
    });

    it("falls back to the first profile and repairs both active ids", async () => {
        const expected = profile("first");
        mocks.storedAppData = appData([expected, profile("second")], "deleted-in-db");
        mocks.localActiveId = "deleted-locally";

        await expect(getActiveProfile()).resolves.toBe(expected);
        expect(mocks.setLocalActiveId).toHaveBeenCalledWith(expected.id);
        expect(mocks.appDataPut).toHaveBeenCalledWith(expect.objectContaining({
            activeProfileId: expected.id,
        }));
    });

    it("keeps a valid local selection and repairs divergent AppData", async () => {
        const expected = profile("local");
        mocks.storedAppData = appData([expected, profile("stored")], "stored");
        mocks.localActiveId = expected.id;

        await expect(getActiveProfile()).resolves.toBe(expected);
        expect(mocks.setLocalActiveId).not.toHaveBeenCalled();
        expect(mocks.appDataPut).toHaveBeenCalledWith(expect.objectContaining({
            activeProfileId: expected.id,
        }));
    });

    it("clears stale pointers when no profiles remain", async () => {
        mocks.storedAppData = appData([], "deleted-in-db");
        mocks.localActiveId = "deleted-locally";

        await expect(getActiveProfile()).resolves.toBeNull();
        expect(mocks.clearLocalActiveId).toHaveBeenCalledOnce();
        expect(mocks.appDataPut).toHaveBeenCalledWith(expect.objectContaining({
            activeProfileId: null,
        }));
    });

    it("hydrates canonical memory rows while preserving legacy-only map entries", async () => {
        const legacyMath = memory("legacy_math", "valid", 2, "active");
        const staleMath = memory("count_5", "valid", 0, "active");
        const legacyVocab = memory("legacy_vocab", "valid", 1);
        const expected = {
            ...profile("valid"),
            mathSkills: {
                legacy_math: legacyMath,
                count_5: staleMath,
            },
            vocabWords: {
                legacy_vocab: legacyVocab,
            },
        };
        const canonicalMath = memory("count_5", "valid", 3, "active");
        const canonicalVocab = memory("apple", "valid", 4);
        mocks.storedAppData = appData([expected], expected.id);
        mocks.localActiveId = expected.id;
        mocks.memoryMathToArray.mockResolvedValue([canonicalMath]);
        mocks.memoryVocabToArray.mockResolvedValue([canonicalVocab]);

        const hydrated = await getActiveProfile();

        expect(hydrated?.mathSkills).toEqual({
            legacy_math: legacyMath,
            count_5: canonicalMath,
        });
        expect(hydrated?.vocabWords).toEqual({
            legacy_vocab: legacyVocab,
            apple: canonicalVocab,
        });
        expect(mocks.memoryMathWhere).toHaveBeenCalledWith("profileId");
        expect(mocks.memoryMathEquals).toHaveBeenCalledWith(expected.id);
    });

    it("passes canonical attempt counts into math problem generation", async () => {
        const staleMath = memory("count_5", "valid", 0, "active");
        const expected = {
            ...profile("valid"),
            mathSkills: { count_5: staleMath },
            vocabWords: {},
        };
        mocks.storedAppData = appData([expected], expected.id);
        mocks.memoryMathToArray.mockResolvedValue([
            memory("count_5", expected.id, 3, "active"),
        ]);

        const hydrated = await getProfile(expected.id);
        expect(hydrated).not.toBeNull();

        const problem = generateMathProblem("count_5", { profile: hydrated! });
        expect(problem.correctAnswer).toBe("4");
    });

    it("saves the profile mirrors in one read-write transaction", async () => {
        const expected = profile("saved");
        mocks.storedAppData = appData([expected], expected.id);

        await saveProfile({ ...expected, name: "updated" });

        expect(mocks.transaction).toHaveBeenCalledWith(
            "rw",
            [expect.anything(), expect.anything()],
            expect.any(Function),
        );
        expect(mocks.appDataPut).toHaveBeenCalledWith(expect.objectContaining({
            profiles: expect.objectContaining({
                [expected.id]: expect.objectContaining({ name: "updated" }),
            }),
        }));
        expect(mocks.profilesPut).toHaveBeenCalledWith(expect.objectContaining({
            id: expected.id,
            name: "updated",
        }));
    });

    it("updates from the latest profile snapshot inside the mirror transaction", async () => {
        const expected = { ...profile("atomic"), soundEnabled: true, todayCount: 4 };
        mocks.storedAppData = appData([expected], expected.id);

        const updated = await updateProfileAtomically(expected.id, current => ({
            ...current,
            todayCount: (current.todayCount || 0) + 1,
        }));

        expect(updated).toEqual(expect.objectContaining({
            id: expected.id,
            soundEnabled: true,
            todayCount: 5,
        }));
        expect(mocks.appDataPut).toHaveBeenCalledWith(expect.objectContaining({
            profiles: expect.objectContaining({
                [expected.id]: expect.objectContaining({
                    soundEnabled: true,
                    todayCount: 5,
                }),
            }),
        }));
        expect(mocks.profilesPut).toHaveBeenCalledWith(updated);
    });

    it("deletes all IndexedDB rows owned by a profile and selects the next profile", async () => {
        const removed = profile("removed");
        const kept = profile("kept");
        mocks.storedAppData = appData([removed, kept], removed.id);
        mocks.localActiveId = removed.id;

        await deleteProfile(removed.id);

        expect(mocks.appDataPut).toHaveBeenCalledWith(expect.objectContaining({
            activeProfileId: kept.id,
            profiles: { [kept.id]: kept },
        }));
        expect(mocks.profilesDelete).toHaveBeenCalledWith(removed.id);
        expect(mocks.logsDelete).toHaveBeenCalledOnce();
        expect(mocks.memoryMathDelete).toHaveBeenCalledOnce();
        expect(mocks.memoryVocabDelete).toHaveBeenCalledOnce();
        expect(mocks.exploreRunsDelete).toHaveBeenCalledOnce();
        expect(mocks.exploreRunEventsDelete).toHaveBeenCalledOnce();
        expect(mocks.exploreDiscoveriesDelete).toHaveBeenCalledOnce();
        expect(mocks.clearProfileStorageData).toHaveBeenCalledWith(removed.id);
        expect(mocks.setLocalActiveId).toHaveBeenCalledWith(kept.id);
    });
});
