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
    if (completedSteps >= RAPID_TRAIL_START_STEP + RAPID_TRAIL_CLUE_COUNT + 1) {
        return "light-path";
    }
    if (
        completedSteps >= RAPID_TRAIL_START_STEP + RAPID_TRAIL_CLUE_COUNT
        && feedback === "correct"
    ) {
        return "light-path";
    }
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
    if (stage === "light-path") return "花のなかに 四滴";
    if (stage === "ringing-petals") return "しりもちで ぱっ";
    if (stage === "warm-bud") return "葉帽子 ぐらり";
    if (stage === "dew-trail") return "しずくを はこぶ";
    return "つぼみ すやすや";
};

export const getRapidTrailStatusCopy = (
    stage: FireflyFlowerArtStage,
    feedback: ExploreProblemFeedback,
): string => {
    if (feedback === "incorrect") {
        if (stage === "light-path") return "花の四滴は そのまま。もういちど";
        if (stage === "warm-bud") return "葉帽子は そのまま。もういちど";
        if (stage === "dew-trail") return "しずくは そのまま。もういちど";
        if (stage === "ringing-petals") return "はなびらは そのまま。もういちど";
        return "つぼみは そのまま。もういちど";
    }

    if (feedback === "correct") {
        if (stage === "light-path") return "四つのしずくが、花のまんなかへ ぽちゃん！";
        if (stage === "ringing-petals") return "ころん。四つのしずくが飛んで、花が ぱっ！";
        if (stage === "warm-bud") return "でこぼこで 葉帽子が ぐらり。つぎ！";
        if (stage === "dew-trail") return "四つのしずくが 葉帽子へのった。つぎ！";
    }

    if (stage === "light-path") return "ずれた葉帽子で、花の四滴を みよう";
    if (stage === "ringing-petals") return "しりもちで ひらいた花を たしかめよう";
    if (stage === "warm-bud") return "でこぼこを ゆっくり こえよう";
    if (stage === "dew-trail") return "葉帽子で しずくを はこぼう";
    return "四つのしずくを 葉帽子へ のせよう";
};
