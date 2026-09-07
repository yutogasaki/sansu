import type { SubjectKey, UserProfile } from "../types";
import { updateProfileAtomically } from "../user/repository";
import { buildPeriodicTestSet } from "./testSet";
import { cancelPendingPaperTest, recordPaperTestScore, upsertPendingPaperTest } from "./paperTest";

export type PendingPaperTest = NonNullable<UserProfile["pendingPaperTests"]>[number];

export const preparePaperTest = async (profileId: string, subject: SubjectKey) => {
    const profile = await updateProfileAtomically(profileId, current => {
        if (current.pendingPaperTests?.some(test => test.subject === subject)) return current;
        const level = subject === "math" ? current.mathMainLevel : current.vocabMainLevel;
        const existing = current.periodicTestSets?.[subject];
        const useExisting = existing?.subject === subject && existing.problems.length === 20
            && (existing.level === level || current.periodicTestState?.[subject]?.isPending);
        const testSet = useExisting ? existing : buildPeriodicTestSet(current, subject);
        if (testSet.problems.length !== 20) throw new Error("20問を用意できませんでした。もう一度お試しください。");
        return upsertPendingPaperTest({
            ...current,
            periodicTestSets: { ...current.periodicTestSets, [subject]: testSet },
        }, subject, testSet.level, testSet);
    });
    if (!profile) throw new Error("プロフィールが見つかりません。設定を開き直してください。");
    const paper = profile.pendingPaperTests!.find(test => test.subject === subject)!;
    return { profile, paper };
};

export const savePaperTestScore = async (
    profileId: string,
    paper: Pick<PendingPaperTest, "id" | "subject" | "level">,
    correctCount: number,
) => updateProfileAtomically(profileId, current => recordPaperTestScore(current, paper, correctCount));

export const cancelPaperTest = async (profileId: string, paperId: string) =>
    updateProfileAtomically(profileId, current => cancelPendingPaperTest(current, paperId));
