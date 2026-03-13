import { EventType } from "../../domain/sessionManager";
import type { IkimonoSceneText } from "./sceneText";
import { IkimonoStage } from "./types";

export type FuwafuwaSpeechAccent = "everyday" | "magic" | "event" | "ambient";

export type FuwafuwaReactionStyle =
    | "cozy"
    | "growing"
    | "sharing"
    | "celebrating"
    | "guiding";

export interface FuwafuwaSpeech {
    lines: string[];
    accent: FuwafuwaSpeechAccent;
    reactionStyle: FuwafuwaReactionStyle;
    actionLabel?: string;
}

type HitokotoReason = "open" | "tap";

export function getHomeFuwafuwaSpeech(
    scene: IkimonoSceneText,
    currentEventType: EventType | null,
    weakCount: number,
): FuwafuwaSpeech {
    if (currentEventType === "level_up") {
        return {
            lines: [scene.moodLine, scene.transition],
            accent: "event",
            reactionStyle: "celebrating",
        };
    }

    if (currentEventType === "periodic_test" || currentEventType === "paper_test_remind") {
        return {
            lines: [scene.whisper, scene.transition],
            accent: "event",
            reactionStyle: "guiding",
        };
    }

    if (currentEventType) {
        return {
            lines: [scene.nowLine, scene.transition],
            accent: "event",
            reactionStyle: "guiding",
        };
    }

    if (scene.stage === "egg" || scene.stage === "hatching") {
        return {
            lines: [scene.nowLine, scene.transition],
            accent: "ambient",
            reactionStyle: "sharing",
        };
    }

    if (weakCount === 0) {
        return {
            lines: [scene.nowLine, scene.moodLine],
            accent: "magic",
            reactionStyle: "growing",
        };
    }

    if (weakCount >= 6) {
        return {
            lines: [scene.moodLine, scene.whisper],
            accent: "ambient",
            reactionStyle: "guiding",
        };
    }

    if (scene.stage === "adult" || scene.stage === "fading") {
        return {
            lines: [scene.nowLine, scene.moodLine],
            accent: "ambient",
            reactionStyle: "cozy",
        };
    }

    return {
        lines: [scene.nowLine, scene.moodLine],
        accent: "everyday",
        reactionStyle: scene.stage === "medium" ? "growing" : "sharing",
    };
}

export function getHitokotoSpeech(
    text: string,
    stage: IkimonoStage,
    reason: HitokotoReason,
): FuwafuwaSpeech {
    if (stage === "egg") {
        return {
            lines: [text],
            accent: "ambient",
            reactionStyle: reason === "tap" ? "cozy" : "sharing",
        };
    }

    if (stage === "hatching") {
        return {
            lines: [text],
            accent: "ambient",
            reactionStyle: reason === "tap" ? "growing" : "sharing",
        };
    }

    if (stage === "adult" || stage === "fading") {
        return {
            lines: [text],
            accent: "magic",
            reactionStyle: reason === "tap" ? "celebrating" : "cozy",
        };
    }

    return {
        lines: [text],
        accent: "everyday",
        reactionStyle: reason === "tap" ? "growing" : "guiding",
    };
}
