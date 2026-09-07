import "fake-indexeddb/auto";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "../../db";
import { createInitialProfile } from "../user/profile";
import { getProfile, saveProfile, updateProfileAtomically } from "../user/repository";
import { preparePaperTest, savePaperTestScore, cancelPaperTest } from "./paperTestRepository";
import { ensurePeriodicTestSet } from "./testSet";

describe("paper test persistence", () => {
    beforeEach(async () => {
        await db.appData.clear();
        await db.profiles.clear();
    });

    const setup = async () => {
        const profile = createInitialProfile("テスト", 1, 8, 1, "mix");
        await saveProfile(profile);
        return profile;
    };

    it("atomically reserves one identical paper under double clicks and preserves unrelated settings", async () => {
        const profile = await setup();
        await updateProfileAtomically(profile.id, current => ({ ...current, name: "変更後", todayCount: 42 }));
        const [first, second] = await Promise.all([
            preparePaperTest(profile.id, "math"), preparePaperTest(profile.id, "math"),
        ]);
        expect(first.paper).toEqual(second.paper);
        expect(first.paper.testSet?.problems).toHaveLength(20);
        expect(second.profile.pendingPaperTests).toHaveLength(1);
        expect(second.profile.name).toBe("変更後");
        expect(second.profile.todayCount).toBe(42);
        expect(await ensurePeriodicTestSet(profile, "math")).toEqual(first.paper.testSet);
        expect((await getProfile(profile.id))?.name).toBe("変更後");
    });

    it("reprints the original snapshot after level changes and online test replacement", async () => {
        const profile = await setup();
        const first = await preparePaperTest(profile.id, "vocab");
        await updateProfileAtomically(profile.id, current => ({ ...current, vocabMainLevel: 2, periodicTestSets: {} }));
        const online = await ensurePeriodicTestSet(profile, "vocab");
        expect(online.level).toBe(2);
        const again = await preparePaperTest(profile.id, "vocab");
        expect(again.paper).toEqual(first.paper);
        expect(again.profile.vocabMainLevel).toBe(2);
        expect(again.paper.testSet?.problems.every(p => p.inputConfig?.choices?.length === 4)).toBe(true);
    });

    it("records once, keeps another subject and profile, and never alters learning progress", async () => {
        const profile = await setup();
        const other = createInitialProfile("別の子", 1, 3, 2, "mix");
        await saveProfile(other);
        const { paper } = await preparePaperTest(profile.id, "math");
        await preparePaperTest(profile.id, "vocab");
        await updateProfileAtomically(profile.id, p => ({ ...p, soundEnabled: false, todayCount: 77 }));
        const before = await getProfile(profile.id);
        await Promise.all([savePaperTestScore(profile.id, paper, 17), savePaperTestScore(profile.id, paper, 9)]);
        const after = await getProfile(profile.id);
        expect(after?.testHistory).toHaveLength(1);
        expect(after?.testHistory?.[0]).toMatchObject({ level: paper.level, method: "paper", correctCount: 17, score: 85 });
        expect(after?.pendingPaperTests).toHaveLength(1);
        expect(after).toMatchObject({ soundEnabled: false, todayCount: 77, mathMainLevel: before!.mathMainLevel, mathMaxUnlocked: before!.mathMaxUnlocked, mathSkills: before!.mathSkills });
        await savePaperTestScore(other.id, paper, 20);
        expect(await getProfile(other.id)).toEqual(other);
        expect(await db.profiles.get(profile.id)).toEqual(after);
    });

    it("legacy entries stay scoreable/cancellable and are not silently replaced", async () => {
        const profile = await setup();
        const legacy = { id: "old", subject: "math" as const, level: 4, createdAt: "2026-01-01" };
        await updateProfileAtomically(profile.id, p => ({ ...p, pendingPaperTests: [legacy] }));
        expect((await preparePaperTest(profile.id, "math")).paper).toEqual(legacy);
        await cancelPaperTest(profile.id, legacy.id);
        await savePaperTestScore(profile.id, legacy, 20);
        expect((await getProfile(profile.id))?.testHistory).toBeUndefined();
        const replacement = await preparePaperTest(profile.id, "math");
        expect(replacement.paper.id).not.toBe(legacy.id);
        expect(replacement.paper.testSet?.problems).toHaveLength(20);
    });

    it("rejects non-finite scores and deleted profiles without resurrecting data", async () => {
        const profile = await setup();
        const { paper } = await preparePaperTest(profile.id, "math");
        await expect(savePaperTestScore(profile.id, paper, Number.NaN)).rejects.toThrow();
        expect((await getProfile(profile.id))?.pendingPaperTests?.[0].id).toBe(paper.id);
        await expect(preparePaperTest("missing", "math")).rejects.toThrow();
        await expect(ensurePeriodicTestSet({ ...profile, id: "missing" }, "math")).rejects.toThrow();
    });

    it("completes the matching automatic paper, but never clears a newer automatic test", async () => {
        const profile = await setup();
        const initialState = {
            math: { isPending: true, reason: "slow" as const, lastTriggeredAt: null },
            vocab: { isPending: false, reason: null, lastTriggeredAt: null },
        };
        await updateProfileAtomically(profile.id, p => ({ ...p, periodicTestState: initialState }));
        const { paper } = await preparePaperTest(profile.id, "math");
        expect(paper.mode).toBe("auto");
        const completed = await savePaperTestScore(profile.id, paper, 18);
        expect(completed?.periodicTestState?.math).toMatchObject({ isPending: false, reason: null });
        expect(completed?.periodicTestState?.math.lastTriggeredAt).toBeTypeOf("number");
        expect(completed?.testHistory?.[0].mode).toBe("auto");
        expect(completed?.periodicTestSets?.math).toBeUndefined();

        await updateProfileAtomically(profile.id, p => ({ ...p, periodicTestState: initialState }));
        const second = await preparePaperTest(profile.id, "math");
        await updateProfileAtomically(profile.id, p => ({ ...p, periodicTestSets: {
            ...p.periodicTestSets, math: { ...second.paper.testSet!, createdAt: "2030-01-01" },
        } }));
        const newer = await savePaperTestScore(profile.id, second.paper, 12);
        expect(newer?.periodicTestState?.math.isPending).toBe(true);
        expect(newer?.periodicTestSets?.math?.createdAt).toBe("2030-01-01");
    });
});
