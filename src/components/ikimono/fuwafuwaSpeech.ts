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

export interface HomeMagicSpeechState {
    percent: number;
    isFull: boolean;
    isSending?: boolean;
    useKanjiText?: boolean;
}

type HitokotoReason = "open" | "tap";

function getMagicLines(kind: "delivery" | "full" | "almost" | "growing" | "small" | "warm" | "mechanic" | "greeting", useKanjiText: boolean): string[] {
    if (useKanjiText) {
        switch (kind) {
            case "greeting":
                return ["会えて うれしいな", "ふわふわ ごきげんだよ"];
            case "delivery":
                return ["魔法エネルギーが", "いま ふわふわに 届いてるよ"];
            case "full":
                return ["魔法エネルギーが", "いっぱいだよ", "届けてくれたら うれしいな"];
            case "almost":
                return ["魔法エネルギーが", "もう少しで 満タン！"];
            case "growing":
                return ["魔法エネルギーが", "じわっと 増えてるよ"];
            case "small":
                return ["魔法エネルギーが", "少したまってきたよ"];
            case "warm":
                return ["なんだか ぽかぽか", "してきたよ"];
            case "mechanic":
            default:
                return ["魔法エネルギーは", "ここに たまるんだよ"];
        }
    }

    switch (kind) {
        case "greeting":
            return ["あえて うれしいな", "ふわふわ ごきげんだよ"];
        case "delivery":
            return ["まほうエネルギーが", "いま ふわふわに とどいてるよ"];
        case "full":
            return ["まほうエネルギーが", "いっぱいだよ", "とどけてくれたら うれしいな"];
        case "almost":
            return ["まほうエネルギーが", "もうすこしで まんたん！"];
        case "growing":
            return ["まほうエネルギーが", "じわっと ふえてるよ"];
        case "small":
            return ["まほうエネルギーが", "すこし たまってきたよ"];
        case "warm":
            return ["なんだか ぽかぽか", "してきたよ"];
        case "mechanic":
        default:
            return ["まほうエネルギーは", "ここに たまるんだよ"];
    }
}

export function getHomeFuwafuwaSpeech(
    scene: IkimonoSceneText,
    currentEventType: EventType | null,
    weakCount: number,
    magicState?: HomeMagicSpeechState,
): FuwafuwaSpeech {
    const useKanjiText = Boolean(magicState?.useKanjiText);

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

    if (magicState?.isSending) {
        return {
            lines: getMagicLines("delivery", useKanjiText),
            accent: "magic",
            reactionStyle: "celebrating",
        };
    }

    if (magicState?.isFull) {
        return {
            lines: getMagicLines("full", useKanjiText),
            accent: "magic",
            reactionStyle: "guiding",
        };
    }

    if (scene.stage === "egg" || scene.stage === "hatching") {
        return {
            lines: getMagicLines("greeting", useKanjiText),
            accent: "ambient",
            reactionStyle: "sharing",
        };
    }

    if ((magicState?.percent ?? 0) >= 90) {
        return {
            lines: getMagicLines("almost", useKanjiText),
            accent: "magic",
            reactionStyle: "growing",
        };
    }

    if ((magicState?.percent ?? 0) >= 31) {
        return {
            lines: getMagicLines("growing", useKanjiText),
            accent: "magic",
            reactionStyle: "growing",
        };
    }

    if ((magicState?.percent ?? 0) > 0) {
        return {
            lines: getMagicLines("small", useKanjiText),
            accent: "magic",
            reactionStyle: "sharing",
        };
    }

    if (weakCount === 0) {
        return {
            lines: getMagicLines("warm", useKanjiText),
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
        lines: getMagicLines("mechanic", useKanjiText),
        accent: "magic",
        reactionStyle: "guiding",
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
