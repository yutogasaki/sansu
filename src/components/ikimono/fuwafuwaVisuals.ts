import type { FuwafuwaReactionStyle } from "./fuwafuwaSpeech";
import { IkimonoStage } from "./types";

export interface EmotionParticle {
    id: number;
    x: number;
    y: number;
    emoji: string;
}

export interface RippleState {
    id: number;
    x: number;
    y: number;
}

export interface AuraVisualState {
    auraColor: string;
    pulseDuration: number;
    showFireflies: boolean;
}

export function getFuwafuwaDisplayStage(stage: IkimonoStage): 1 | 2 | 3 {
    switch (stage) {
        case "egg":
            return 1;
        case "hatching":
            return 2;
        default:
            return 3;
    }
}

export function getAuraVisualState(stage: IkimonoStage, daysAlive: number): AuraVisualState {
    if (stage === "adult" || stage === "fading") {
        return {
            auraColor: "rgba(251, 191, 36, 0.28)",
            pulseDuration: 2.2,
            showFireflies: true,
        };
    }

    if (stage === "medium" || stage === "small" || daysAlive >= 7) {
        return {
            auraColor: "rgba(244, 114, 182, 0.22)",
            pulseDuration: 3,
            showFireflies: false,
        };
    }

    return {
        auraColor: "rgba(45, 212, 191, 0.18)",
        pulseDuration: 4,
        showFireflies: false,
    };
}

export function getReactionEmojis(
    reactionStyle: FuwafuwaReactionStyle,
    stage?: IkimonoStage,
): readonly string[] {
    if (stage === "egg") {
        return ["🥚", "✨", "🫧", "💫", "🤍"];
    }

    if (stage === "hatching" && reactionStyle !== "celebrating") {
        return ["✨", "🫧", "🌱", "💖", "💫"];
    }

    switch (reactionStyle) {
        case "celebrating":
            return ["💖", "🎵", "🎉", "🌟", "✨", "🫧", "💫"];
        case "sharing":
            return ["💖", "🎵", "✨", "🫧", "🌈", "🌟", "🎶"];
        case "growing":
            return ["💖", "🎵", "🌱", "✨", "🫧", "💚", "🍀"];
        case "guiding":
            return ["💖", "🎵", "🫧", "✨", "🔆", "💡", "🌟"];
        case "cozy":
        default:
            return ["💖", "🎵", "✨", "🫧", "🌙", "🤍", "💫"];
    }
}
