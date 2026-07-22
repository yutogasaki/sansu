import type { ExploreProblemFeedback } from "./ExploreProblemPanel";
import type { MakimodonArtStage } from "./MakimodonEncounterArt";

export const MAKIMODON_BEAT_COUNT = 3;

const READY_STAGES: readonly MakimodonArtStage[] = ["rolled", "trip", "path"];

export const getMakimodonArtStage = (
    completedSteps: number,
    feedback: ExploreProblemFeedback,
): MakimodonArtStage => {
    const beat = Math.max(0, Math.min(MAKIMODON_BEAT_COUNT - 1, completedSteps));
    if (feedback !== "correct") return READY_STAGES[beat];
    return beat === 0 ? "trip" : beat === 1 ? "path" : "payoff";
};

const getMakimodonCompletedBeatCount = (stage: MakimodonArtStage): 0 | 1 | 2 | 3 => (
    stage === "rolled" ? 0 : stage === "trip" ? 1 : stage === "path" ? 2 : 3
);

export const getMakimodonProgressMarks = (stage: MakimodonArtStage): string => {
    const completedBeats = getMakimodonCompletedBeatCount(stage);
    return `${"●".repeat(completedBeats)}${"○".repeat(MAKIMODON_BEAT_COUNT - completedBeats)}`;
};

export const getMakimodonKickerCopy = (stage: MakimodonArtStage): string => {
    const marks = getMakimodonProgressMarks(stage);
    if (stage === "rolled") return `${marks} ？？？`;
    if (stage === "trip") return `${marks} ほどけた`;
    if (stage === "path") return `${marks} みちになった`;
    return `${marks} まきもどった`;
};

export const getMakimodonTitleCopy = (stage: MakimodonArtStage): string => {
    if (stage === "payoff") return "ぜんぶ まきもどった！";
    if (stage === "path") return "みちに なった。";
    if (stage === "trip") return "ほどけて、ぺたん。";
    return "この まきまき、いきもの？";
};

export const getMakimodonStateLabel = (stage: MakimodonArtStage): string => {
    if (stage === "payoff") return "どん";
    if (stage === "path") return "みち";
    if (stage === "trip") return "ぺたん";
    return "まきまき";
};

export const getMakimodonStatusCopy = (
    stage: MakimodonArtStage,
    feedback: ExploreProblemFeedback,
): string => {
    if (feedback === "incorrect") return "まきまきは そのまま。もういちど";
    if (stage === "payoff") return "あいぼうが せなかへ どん。";
    if (stage === "path") return "のってみる？";
    if (stage === "trip") return "まだ つづきが まいてある";
    return "はしっこが もぞもぞ。こたえてみよう";
};
