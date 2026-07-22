import type { ExploreProblemFeedback } from "./ExploreProblemPanel";
import type {
    ExploreOpeningPresentationKey,
    ExploreRootPullAssetSet,
} from "../../domain/explore/openingExperience";

export const ROOT_PULL_BEAT_COUNT = 3;
export const ROOT_PULL_CAMERA_KEY = "opening-root-pull-side-v1";
export const ROOT_PULL_VIEW_BOX = "0 0 390 500";

export type RootPullOpeningStage =
    | "ready"
    | "small-pull"
    | "bigger-pull"
    | "comic-release";

export const ROOT_PULL_PAYOFF_VARIANTS = ["dirt-hat", "leaf-hat"] as const;
export type RootPullPayoffVariant = typeof ROOT_PULL_PAYOFF_VARIANTS[number];

export const selectOpeningProblemPresentation = (
    presentationKey: ExploreOpeningPresentationKey,
): "makimodon" | "root-pull" | "snap-root" => {
    if (presentationKey === "root-pull") return "root-pull";
    if (presentationKey === "snap-root") return "snap-root";
    return "makimodon";
};

export interface RootPullStagePresentation {
    imageSrc: string;
    actorState: "watching" | "small-brace" | "full-brace" | "safe-seated";
    subjectState: "asking" | "rising" | "almost-free" | "free";
    actionState: "offered-leaves" | "small-pull" | "bigger-pull" | "release";
    title: string;
    actorDescription: string;
    subjectDescription: string;
    actionDescription: string;
}

const ROOT_PULL_ASSET_BASE = "/assets/explore/opening-root-pull-v1";
const ROOT_PULL_V2_ASSET_BASE = "/assets/explore/opening-root-pull-v2";

export const ROOT_PULL_STAGE_PRESENTATIONS: Readonly<
    Record<RootPullOpeningStage, RootPullStagePresentation>
> = {
    ready: {
        imageSrc: `${ROOT_PULL_ASSET_BASE}/ready.jpg`,
        actorState: "watching",
        subjectState: "asking",
        actionState: "offered-leaves",
        title: "はっぱを ひっぱれ！",
        actorDescription: "相棒が、差し出された葉を両手でつかんでいる。",
        subjectDescription: "丸い生き物が土から顔を出し、自分でも下から土を押し上げている。",
        actionDescription: "生き物が葉を相棒へ差し出し、いっしょに上へ出ようとしている。",
    },
    "small-pull": {
        imageSrc: `${ROOT_PULL_ASSET_BASE}/pull-one.jpg`,
        actorState: "small-brace",
        subjectState: "rising",
        actionState: "small-pull",
        title: "ちょっと ういた！",
        actorDescription: "相棒が葉を引き、一歩だけ後ろへ滑っている。",
        subjectDescription: "丸い生き物が少し持ち上がり、まわりの土が小さく跳ねている。",
        actionDescription: "相棒と生き物が同じ葉を引き合い、土から少し抜けた。",
    },
    "bigger-pull": {
        imageSrc: `${ROOT_PULL_ASSET_BASE}/pull-two.jpg`,
        actorState: "full-brace",
        subjectState: "almost-free",
        actionState: "bigger-pull",
        title: "ぐぐぐ… もうすこし！",
        actorDescription: "相棒が足を踏ん張り、全身を後ろへ傾けて葉を引いている。",
        subjectDescription: "丸い生き物の体がさらに見え、自分でも上へ押し続けている。",
        actionDescription: "強く引いた葉は切れず、生き物と土がいっしょに大きく持ち上がった。",
    },
    "comic-release": {
        imageSrc: `${ROOT_PULL_ASSET_BASE}/payoff.jpg`,
        actorState: "safe-seated",
        subjectState: "free",
        actionState: "release",
        title: "スポン！ ぬけた！",
        actorDescription: "相棒は勢いで後ろへ転び、安全に尻もちをついている。",
        subjectDescription: "丸い生き物が土から飛び出し、地面の上へ無事に着地した。",
        actionDescription: "最後のひと引きで生き物が抜け、その勢いが相棒へ返ってきた。",
    },
};

const ROOT_PULL_V2_STAGE_ASSETS: Readonly<Record<Exclude<
    RootPullOpeningStage,
    "comic-release"
>, string>> = {
    ready: `${ROOT_PULL_V2_ASSET_BASE}/ready.jpg`,
    "small-pull": `${ROOT_PULL_V2_ASSET_BASE}/pull-one.jpg`,
    "bigger-pull": `${ROOT_PULL_V2_ASSET_BASE}/pull-two.jpg`,
};

const ROOT_PULL_V2_PAYOFF_ASSETS: Readonly<Record<RootPullPayoffVariant, string>> = {
    "dirt-hat": `${ROOT_PULL_V2_ASSET_BASE}/payoff-dirt-hat.jpg`,
    "leaf-hat": `${ROOT_PULL_V2_ASSET_BASE}/payoff-leaf-hat.jpg`,
};

const ROOT_PULL_V2_SMALL_PULL_PRESENTATION: RootPullStagePresentation = {
    ...ROOT_PULL_STAGE_PRESENTATIONS["small-pull"],
    imageSrc: ROOT_PULL_V2_STAGE_ASSETS["small-pull"],
    title: "ぺろん！ まえが みえない！",
    actorDescription: "相棒が葉を握ったまま少し滑り、返ってきた葉先を目の上にかぶっている。",
    subjectDescription: "丸い生き物が少し持ち上がり、自分でも下から押し続けながら相棒を見ている。",
    actionDescription: "最初のひと引きで生き物が少し浮き、やわらかい葉先だけが相棒の顔へ返った。",
};

const ROOT_PULL_V2_BIGGER_PULL_PRESENTATION: RootPullStagePresentation = {
    ...ROOT_PULL_STAGE_PRESENTATIONS["bigger-pull"],
    imageSrc: ROOT_PULL_V2_STAGE_ASSETS["bigger-pull"],
    title: "ぐぐぐ… あしが ぴーん！",
    actorDescription: "相棒が葉を握り、片足を前へぴんと伸ばして全身で踏ん張っている。",
    subjectDescription: "丸い生き物の体がさらに見え、自分でも上へ押し続けながら相棒を見ている。",
    actionDescription: "二度目のひと引きで土が大きく持ち上がり、相棒の片足までまっすぐ浮いた。",
};

const ROOT_PULL_V2_DIRT_HAT_PRESENTATION: RootPullStagePresentation = {
    ...ROOT_PULL_STAGE_PRESENTATIONS["comic-release"],
    imageSrc: ROOT_PULL_V2_PAYOFF_ASSETS["dirt-hat"],
    title: "スポン！ つちぼうし！",
    actorDescription: "相棒は安全に尻もちをつき、跳ねた土を小さな帽子のように頭へ乗せている。",
    subjectDescription: "丸い生き物が土から抜け、細い足で無事に立って相棒を見ている。",
    actionDescription: "最後のひと引きで生き物が抜け、やわらかい土のかたまりが相棒の頭へぽふっと着地した。",
};

const ROOT_PULL_V2_LEAF_HAT_PRESENTATION: RootPullStagePresentation = {
    ...ROOT_PULL_STAGE_PRESENTATIONS["comic-release"],
    imageSrc: ROOT_PULL_V2_PAYOFF_ASSETS["leaf-hat"],
    title: "スポン！ はっぱぼうし！",
    actorDescription: "相棒は安全に尻もちをつき、大きな葉を帽子のようにかぶって片目だけを出している。",
    subjectDescription: "丸い生き物が土から抜け、細い足で無事に立って相棒を見ている。",
    actionDescription: "最後のひと引きで生き物が抜け、返った葉が相棒へ大きな帽子のように着地した。",
};

export const selectRootPullPayoffVariant = (
    runSeed: string,
    previousVariant?: RootPullPayoffVariant,
): RootPullPayoffVariant => {
    let hash = 0;
    for (let index = 0; index < runSeed.length; index += 1) {
        hash = ((hash * 31) + runSeed.charCodeAt(index)) >>> 0;
    }
    const selected = ROOT_PULL_PAYOFF_VARIANTS[hash % ROOT_PULL_PAYOFF_VARIANTS.length];
    if (selected !== previousVariant) return selected;
    return ROOT_PULL_PAYOFF_VARIANTS.find((variant) => variant !== previousVariant)
        ?? selected;
};

const RESTING_STAGES: readonly RootPullOpeningStage[] = [
    "ready",
    "small-pull",
    "bigger-pull",
    "comic-release",
];

const CORRECT_STAGES: readonly RootPullOpeningStage[] = [
    "small-pull",
    "bigger-pull",
    "comic-release",
];

/**
 * Maps committed correct-answer count and current feedback to a visible physical state.
 * Incorrect and idle feedback never advance the encounter.
 */
export const getRootPullOpeningStage = (
    completedSteps: number,
    feedback: ExploreProblemFeedback,
): RootPullOpeningStage => {
    const finiteCompletedSteps = Number.isFinite(completedSteps)
        ? Math.trunc(completedSteps)
        : 0;
    const completedBeatCount = Math.max(
        0,
        Math.min(ROOT_PULL_BEAT_COUNT, finiteCompletedSteps),
    );

    if (feedback !== "correct") {
        return RESTING_STAGES[completedBeatCount];
    }

    return CORRECT_STAGES[Math.min(completedBeatCount, ROOT_PULL_BEAT_COUNT - 1)];
};

export const getRootPullStagePresentation = (
    stage: RootPullOpeningStage,
    assetSet: ExploreRootPullAssetSet = "v1",
    payoffVariant: RootPullPayoffVariant = "dirt-hat",
): RootPullStagePresentation => {
    if (assetSet === "v1") return ROOT_PULL_STAGE_PRESENTATIONS[stage];
    if (stage === "small-pull") return ROOT_PULL_V2_SMALL_PULL_PRESENTATION;
    if (stage === "bigger-pull") return ROOT_PULL_V2_BIGGER_PULL_PRESENTATION;
    if (stage === "comic-release" && payoffVariant === "leaf-hat") {
        return ROOT_PULL_V2_LEAF_HAT_PRESENTATION;
    }
    if (stage === "comic-release") {
        return ROOT_PULL_V2_DIRT_HAT_PRESENTATION;
    }
    return {
        ...ROOT_PULL_STAGE_PRESENTATIONS[stage],
        imageSrc: ROOT_PULL_V2_STAGE_ASSETS[stage],
    };
};

const getRootPullCompletedBeatCount = (
    stage: RootPullOpeningStage,
): 0 | 1 | 2 | 3 => (
    stage === "ready"
        ? 0
        : stage === "small-pull"
            ? 1
            : stage === "bigger-pull"
                ? 2
                : 3
);

export const getRootPullProgressMarks = (stage: RootPullOpeningStage): string => {
    const completedBeats = getRootPullCompletedBeatCount(stage);
    return `${"●".repeat(completedBeats)}${"○".repeat(
        ROOT_PULL_BEAT_COUNT - completedBeats,
    )}`;
};

export const getRootPullKickerCopy = (stage: RootPullOpeningStage): string => (
    `${getRootPullProgressMarks(stage)} はっぱを ひっぱる`
);

export const getRootPullStateLabel = (stage: RootPullOpeningStage): string => {
    if (stage === "comic-release") return "ぽんっ";
    if (stage === "bigger-pull") return "もうすこし";
    if (stage === "small-pull") return "ちょっと ういた";
    return "うまってる";
};

export const getRootPullStatusCopy = (
    stage: RootPullOpeningStage,
    feedback: ExploreProblemFeedback,
    assetSet: ExploreRootPullAssetSet = "v1",
    payoffVariant: RootPullPayoffVariant = "dirt-hat",
): string => {
    if (feedback === "incorrect") return "まだ ぬけない。もういちど！";
    if (assetSet === "v2" && stage === "comic-release" && payoffVariant === "leaf-hat") {
        return "スポン！ はっぱぼうし だいせいこう";
    }
    if (assetSet === "v2" && stage === "comic-release") {
        return "ぽふっ！ つちぼうし だいせいこう";
    }
    if (assetSet === "v2" && stage === "bigger-pull") {
        return "ぐぐぐっ！ あしまで ぴーん";
    }
    if (assetSet === "v2" && stage === "small-pull") {
        return "ぺろん！ はっぱで まえが みえない";
    }
    if (stage === "comic-release") return "スポン！ しりもちも だいせいこう";
    if (stage === "bigger-pull") return "ぐぐぐっ！ あと ひといき";
    if (stage === "small-pull") return "ぐいっ！ ちょっと ういた";
    return "こたえて、ぐいっ！";
};

export const getRootPullAccessibleDescription = (
    stage: RootPullOpeningStage,
    assetSet: ExploreRootPullAssetSet = "v1",
    payoffVariant: RootPullPayoffVariant = "dirt-hat",
): string => {
    const presentation = getRootPullStagePresentation(stage, assetSet, payoffVariant);
    return [
        presentation.actorDescription,
        presentation.subjectDescription,
        presentation.actionDescription,
    ].join(" ");
};
