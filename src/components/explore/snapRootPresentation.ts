import type { ExploreProblemFeedback } from "./ExploreProblemPanel";

export const SNAP_ROOT_BEAT_COUNT = 3;
export const SNAP_ROOT_CAMERA_KEY = "opening-snap-root-side-v2";

export type SnapRootOpeningStage = "ready" | "dig-one" | "dig-two" | "popped";

const RESTING_STAGES: readonly SnapRootOpeningStage[] = [
    "ready",
    "dig-one",
    "dig-two",
    "popped",
];

const CORRECT_STAGES: readonly SnapRootOpeningStage[] = [
    "dig-one",
    "dig-two",
    "popped",
];

export const getSnapRootOpeningStage = (
    completedSteps: number,
    feedback: ExploreProblemFeedback,
): SnapRootOpeningStage => {
    const safeSteps = Number.isFinite(completedSteps) ? Math.trunc(completedSteps) : 0;
    const beat = Math.max(0, Math.min(SNAP_ROOT_BEAT_COUNT, safeSteps));
    if (feedback !== "correct") return RESTING_STAGES[beat];
    return CORRECT_STAGES[Math.min(beat, SNAP_ROOT_BEAT_COUNT - 1)];
};

const completedBeatCount = (stage: SnapRootOpeningStage): number => (
    stage === "ready" ? 0 : stage === "dig-one" ? 1 : stage === "dig-two" ? 2 : 3
);

export const getSnapRootProgressMarks = (stage: SnapRootOpeningStage): string => {
    const completed = completedBeatCount(stage);
    return `${"●".repeat(completed)}${"○".repeat(SNAP_ROOT_BEAT_COUNT - completed)}`;
};

export const getSnapRootKickerCopy = (stage: SnapRootOpeningStage): string => {
    const remaining = SNAP_ROOT_BEAT_COUNT - completedBeatCount(stage);
    if (remaining === 0) return `${getSnapRootProgressMarks(stage)} できた！`;
    return `${getSnapRootProgressMarks(stage)} あと${remaining}もん`;
};

export const getSnapRootTitleCopy = (stage: SnapRootOpeningStage): string => {
    if (stage === "popped") return "すっぽん！ でてきた！";
    if (stage === "dig-two") return "あしが みえた！ あと 1もん！";
    if (stage === "dig-one") return "ざくっ！ あと 2もん！";
    return "3もんで おおきな ねっこを ほりだそう！";
};

export const getSnapRootStateLabel = (stage: SnapRootOpeningStage): string => {
    if (stage === "popped") return "すっぽん";
    if (stage === "dig-two") return "あし ちらり";
    if (stage === "dig-one") return "ざくっ";
    return "ほる じゅんび";
};

export const getSnapRootStatusCopy = (
    stage: SnapRootOpeningStage,
    feedback: ExploreProblemFeedback,
): string => {
    if (feedback === "incorrect") return "だいじょうぶ。もういちど！";
    if (stage === "popped") return "できた！ つちぼうし！";
    if (stage === "dig-two") return "あしが みえた！";
    if (stage === "dig-one") return "ざくっ！ すぐ つぎ！";
    return "こたえるたびに つちが ほれるよ";
};

export const getSnapRootAccessibleDescription = (
    stage: SnapRootOpeningStage,
): string => {
    if (stage === "popped") {
        return "大きな赤い根の生き物が全身で土から抜けて立ち、小さな黄色い相棒は離れた場所で安全に尻もちをついている。柔らかい土のかたまりが小さな相棒の葉へ帽子のように載っている。";
    }
    if (stage === "dig-two") {
        return "小さな黄色い相棒が大きな赤い根の生き物には触れず、手前の同じ土をもう一度スコップで掘っている。根の生き物がさらに持ち上がり、土の上に足が見えている。";
    }
    if (stage === "dig-one") {
        return "小さな黄色い相棒が大きな赤い根の生き物には触れず、手前の土をスコップで一度掘っている。土が飛び、根の生き物が少し持ち上がっている。";
    }
    return "小さな黄色い相棒がスコップを持ち、土に埋まった大きな赤い根の生き物から離れた手前の土を掘ろうとしている。";
};
