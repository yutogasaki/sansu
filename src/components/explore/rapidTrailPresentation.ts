import type { ExploreProblemFeedback } from "./ExploreProblemPanel";
import type { FireflyFlowerArtStage } from "./FireflyFlowerEncounterArt";

export const RAPID_TRAIL_START_STEP = 3;
export const RAPID_TRAIL_CLUE_COUNT = 3;

const STAGES: readonly FireflyFlowerArtStage[] = [
    "waiting",
    "dew-trail",
    "warm-bud",
    "ringing-petals",
];

const clampClueCount = (completedSteps: number) => Math.max(
    0,
    Math.min(RAPID_TRAIL_CLUE_COUNT, completedSteps - RAPID_TRAIL_START_STEP),
);

export const getRapidTrailArtStage = (
    completedSteps: number,
    feedback: ExploreProblemFeedback,
): FireflyFlowerArtStage => {
    const completedClues = clampClueCount(completedSteps);
    const visibleClues = feedback === "correct"
        ? Math.min(RAPID_TRAIL_CLUE_COUNT, completedClues + 1)
        : completedClues;
    return STAGES[visibleClues];
};

export const getRapidTrailClueCount = (stage: FireflyFlowerArtStage): 0 | 1 | 2 | 3 => (
    stage === "waiting"
        ? 0
        : stage === "dew-trail"
            ? 1
            : stage === "warm-bud"
                ? 2
                : 3
);

export const getRapidTrailProgressMarks = (stage: FireflyFlowerArtStage): string => {
    const completedClues = getRapidTrailClueCount(stage);
    return `${"●".repeat(completedClues)}${"○".repeat(RAPID_TRAIL_CLUE_COUNT - completedClues)}`;
};

export const getRapidTrailStateLabel = (stage: FireflyFlowerArtStage): string => {
    if (stage === "ringing-petals") return "はなびら りん";
    if (stage === "warm-bud") return "つぼみ ぽかぽか";
    if (stage === "dew-trail") return "しずくの道";
    return "つぼみ すやすや";
};

export const getRapidTrailStatusCopy = (
    stage: FireflyFlowerArtStage,
    feedback: ExploreProblemFeedback,
): string => {
    if (feedback === "incorrect") {
        if (stage === "warm-bud") return "あたたかさは そのまま。もういちど";
        if (stage === "dew-trail") return "しずくは そのまま。もういちど";
        if (stage === "ringing-petals") return "はなびらは そのまま。もういちど";
        return "つぼみは そのまま。もういちど";
    }

    if (feedback === "correct") {
        if (stage === "ringing-petals") return "はなびらが りん。道の先が きこえた！";
        if (stage === "warm-bud") return "つぼみが ぽっと あたたかい。つぎ！";
        if (stage === "dew-trail") return "しずくが つぼみへ ならんだ。つぎ！";
    }

    if (stage === "ringing-petals") return "はなびらの 音が のこっている";
    if (stage === "warm-bud") return "あたたかい つぼみを たしかめよう";
    if (stage === "dew-trail") return "しずくの 先を たしかめよう";
    return "しずくの 行き先を たしかめよう";
};
