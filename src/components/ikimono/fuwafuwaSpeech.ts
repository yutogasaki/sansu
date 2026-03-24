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

export type HomeSpeechGroup = "everyday" | "magic" | "ambient";

export type HomeSpeechTopic =
    | "greeting"
    | "mood"
    | "mechanic"
    | "progress"
    | "omen"
    | "growth"
    | "ambient"
    | "naming";

export interface HomeSpeechSelection {
    group: HomeSpeechGroup;
    topic: HomeSpeechTopic;
    replyIndex: number;
}

export interface HomeSpeechCandidate {
    selection: HomeSpeechSelection;
    speech: FuwafuwaSpeech;
    replyId: string;
}

export interface HomeMagicSpeechState {
    percent: number;
    isFull: boolean;
    isSending?: boolean;
    useKanjiText?: boolean;
}

type HitokotoReason = "open" | "tap";

const textByMode = (useKanjiText: boolean, kana: string, kanji: string): string => (
    useKanjiText ? kanji : kana
);

const pickVariant = (variants: string[][], replyIndex: number): string[] => (
    variants[replyIndex % variants.length] ?? variants[0] ?? []
);

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

export function getHomeEventSpeech(
    scene: IkimonoSceneText,
    currentEventType: EventType | null,
    weakCount: number,
    magicState?: HomeMagicSpeechState,
): FuwafuwaSpeech | null {
    if (currentEventType || magicState?.isSending || magicState?.isFull) {
        return getHomeFuwafuwaSpeech(scene, currentEventType, weakCount, magicState);
    }

    return null;
}

function getEverydayGreetingLines(
    scene: IkimonoSceneText,
    useKanjiText: boolean,
    replyIndex: number,
): string[] {
    if (scene.stage === "egg" || scene.stage === "hatching") {
        return pickVariant([
            getMagicLines("greeting", useKanjiText),
            [scene.nowLine],
            [scene.whisper],
            [scene.nowLine, scene.transition],
        ], replyIndex);
    }

    return pickVariant([
        [
            textByMode(useKanjiText, "また きたね", "また来たね"),
            textByMode(useKanjiText, "ゆっくり いこう", "ゆっくり行こう"),
        ],
        [
            textByMode(useKanjiText, "あえて うれしいな", "会えてうれしいな"),
            textByMode(useKanjiText, "ふわふわ ごきげんだよ", "ふわふわ ごきげんだよ"),
        ],
        [scene.whisper],
        [scene.nowLine, textByMode(useKanjiText, "ここに いるよ", "ここにいるよ")],
    ], replyIndex);
}

function getEverydayMoodLines(
    scene: IkimonoSceneText,
    useKanjiText: boolean,
    replyIndex: number,
): string[] {
    return pickVariant([
        [scene.moodLine, scene.whisper],
        [scene.nowLine, scene.moodLine],
        [scene.moodLine, textByMode(useKanjiText, "むりは しなくて いいよ", "無理はしなくていいよ")],
        [scene.whisper, textByMode(useKanjiText, "きょうの ペースで だいじょうぶ", "今日のペースで大丈夫")],
    ], replyIndex);
}

function getMagicMechanicLines(
    useKanjiText: boolean,
    replyIndex: number,
): string[] {
    return pickVariant([
        getMagicLines("mechanic", useKanjiText),
        [
            textByMode(useKanjiText, "まほうエネルギーは", "魔法エネルギーは"),
            textByMode(useKanjiText, "ここで ふわっと そだつよ", "ここでふわっと育つよ"),
        ],
        [
            textByMode(useKanjiText, "べんきょうの ひかりが", "勉強の光が"),
            textByMode(useKanjiText, "ふわふわに たまっていくんだ", "ふわふわにたまっていくんだ"),
        ],
        [
            textByMode(useKanjiText, "がんばりが", "がんばりが"),
            textByMode(useKanjiText, "ここに のこってるよ", "ここに残ってるよ"),
        ],
    ], replyIndex);
}

function getMagicProgressLines(
    scene: IkimonoSceneText,
    weakCount: number,
    magicState: HomeMagicSpeechState | undefined,
    replyIndex: number,
): string[] {
    const useKanjiText = Boolean(magicState?.useKanjiText);
    const percent = magicState?.percent ?? 0;

    if (percent >= 90) {
        return pickVariant([
            getMagicLines("almost", useKanjiText),
            [
                textByMode(useKanjiText, "ひかりが ぎゅっと してきた", "光がぎゅっとしてきた"),
                textByMode(useKanjiText, "もうすぐ とどきそう", "もうすぐ届きそう"),
            ],
            [scene.transition, textByMode(useKanjiText, "いま かなり いい かんじ", "今かなりいい感じ")],
            [scene.moodLine, textByMode(useKanjiText, "あと ちょっとで まんたん", "あとちょっとで満タン")],
        ], replyIndex);
    }

    if (percent >= 31) {
        return pickVariant([
            getMagicLines("growing", useKanjiText),
            [
                textByMode(useKanjiText, "ひかりが すこしずつ", "光が少しずつ"),
                textByMode(useKanjiText, "ふくらんでるよ", "ふくらんでるよ"),
            ],
            [scene.transition, textByMode(useKanjiText, "このまま そだっていけそう", "このまま育っていけそう")],
            [scene.nowLine, textByMode(useKanjiText, "ちゃんと たまってる", "ちゃんとたまってる")],
        ], replyIndex);
    }

    if (percent > 0) {
        return pickVariant([
            getMagicLines("small", useKanjiText),
            [
                textByMode(useKanjiText, "ちいさな ひかりが", "小さな光が"),
                textByMode(useKanjiText, "もう あるよ", "もうあるよ"),
            ],
            [scene.nowLine, textByMode(useKanjiText, "すこしずつ あたたかい", "少しずつあたたかい")],
            [scene.whisper, textByMode(useKanjiText, "まだ これから", "まだこれから")],
        ], replyIndex);
    }

    if (weakCount === 0) {
        return pickVariant([
            getMagicLines("warm", useKanjiText),
            [scene.moodLine, textByMode(useKanjiText, "いま すごく かるいよ", "今すごく軽いよ")],
            [scene.whisper, textByMode(useKanjiText, "しずかに ひかり はじめてる", "静かに光りはじめてる")],
            [scene.nowLine, textByMode(useKanjiText, "いい じゅんびが できてる", "いい準備ができてる")],
        ], replyIndex);
    }

    return pickVariant([
        getMagicLines("mechanic", useKanjiText),
        [scene.whisper, textByMode(useKanjiText, "ひかりは これから たまるよ", "光はこれからたまるよ")],
        [scene.nowLine, textByMode(useKanjiText, "まだ しずか", "まだ静か")],
        [scene.moodLine, textByMode(useKanjiText, "でも ちゃんと はじまるよ", "でもちゃんとはじまるよ")],
    ], replyIndex);
}

function getMagicGrowthLines(
    scene: IkimonoSceneText,
    useKanjiText: boolean,
    replyIndex: number,
): string[] {
    return pickVariant([
        [scene.transition, textByMode(useKanjiText, "すこしずつ かわっていくよ", "少しずつ変わっていくよ")],
        [
            textByMode(useKanjiText, "いまの ひかりが", "今の光が"),
            textByMode(useKanjiText, "つぎの すがたを つくってる", "次の姿を作ってる"),
        ],
        [scene.nowLine, scene.transition],
        [scene.moodLine, textByMode(useKanjiText, "せいちょうの きはいが ある", "成長の気配がある")],
    ], replyIndex);
}

function getMagicOmenLines(
    scene: IkimonoSceneText,
    useKanjiText: boolean,
    replyIndex: number,
): string[] {
    return pickVariant([
        [scene.transition, textByMode(useKanjiText, "つぎの けはいが してる", "次の気配がしてる")],
        [
            `${scene.aura[0]} と ${scene.aura[1]}`,
            textByMode(useKanjiText, "そんな ふんいきが あるよ", "そんな雰囲気があるよ"),
        ],
        [scene.nowLine, textByMode(useKanjiText, "なにかが かわりそう", "何かが変わりそう")],
        [scene.moodLine, textByMode(useKanjiText, "そろそろ つぎへ すすめそう", "そろそろ次へ進めそう")],
    ], replyIndex);
}

function getAmbientLines(
    scene: IkimonoSceneText,
    useKanjiText: boolean,
    replyIndex: number,
): string[] {
    return pickVariant([
        [scene.nowLine, scene.moodLine],
        [scene.whisper, scene.nowLine],
        [
            textByMode(useKanjiText, "きょうの くうきは", "今日の空気は"),
            textByMode(useKanjiText, "なんだか やさしいね", "なんだかやさしいね"),
        ],
        [`${scene.aura[0]} ・ ${scene.aura[1]}`, scene.moodLine],
    ], replyIndex);
}

export function getHomeDailySpeech(
    selection: HomeSpeechSelection,
    scene: IkimonoSceneText,
    weakCount: number,
    magicState?: HomeMagicSpeechState,
): FuwafuwaSpeech {
    const useKanjiText = Boolean(magicState?.useKanjiText);

    switch (selection.topic) {
        case "greeting":
            return {
                lines: getEverydayGreetingLines(scene, useKanjiText, selection.replyIndex),
                accent: scene.stage === "egg" || scene.stage === "hatching" ? "ambient" : "everyday",
                reactionStyle: scene.stage === "egg" || scene.stage === "hatching" ? "sharing" : "cozy",
            };
        case "mood":
            return {
                lines: getEverydayMoodLines(scene, useKanjiText, selection.replyIndex),
                accent: "everyday",
                reactionStyle: "cozy",
            };
        case "mechanic":
            return {
                lines: getMagicMechanicLines(useKanjiText, selection.replyIndex),
                accent: "magic",
                reactionStyle: "guiding",
            };
        case "progress":
            return {
                lines: getMagicProgressLines(scene, weakCount, magicState, selection.replyIndex),
                accent: "magic",
                reactionStyle: (magicState?.percent ?? 0) >= 31 ? "growing" : "sharing",
            };
        case "growth":
            return {
                lines: getMagicGrowthLines(scene, useKanjiText, selection.replyIndex),
                accent: "magic",
                reactionStyle: "growing",
            };
        case "omen":
            return {
                lines: getMagicOmenLines(scene, useKanjiText, selection.replyIndex),
                accent: "ambient",
                reactionStyle: "sharing",
            };
        case "ambient":
            return {
                lines: getAmbientLines(scene, useKanjiText, selection.replyIndex),
                accent: "ambient",
                reactionStyle: "sharing",
            };
        case "naming":
            return {
                lines: [
                    textByMode(useKanjiText, "なまえ、あると うれしいな", "名前、あるとうれしいな"),
                    textByMode(useKanjiText, "よんでもらえると もっと ちかくなる", "呼んでもらえるともっと近くなる"),
                ],
                accent: "everyday",
                reactionStyle: "cozy",
            };
        default:
            return {
                lines: getMagicMechanicLines(useKanjiText, selection.replyIndex),
                accent: "magic",
                reactionStyle: "guiding",
            };
    }
}

export function getHomeSpeechReplyId(speech: FuwafuwaSpeech): string {
    return [speech.accent, speech.actionLabel ?? "", ...speech.lines].join("|");
}

export function buildHomeSpeechCandidates(
    scene: IkimonoSceneText,
    weakCount: number,
    magicState?: HomeMagicSpeechState,
): HomeSpeechCandidate[] {
    const hasGrowthLite = scene.stage === "egg"
        || scene.stage === "hatching"
        || scene.stage === "small"
        || scene.stage === "medium";

    const baseSelections: Omit<HomeSpeechSelection, "replyIndex">[] = [
        { group: "everyday", topic: "greeting" },
        { group: "everyday", topic: "mood" },
        { group: "magic", topic: "mechanic" },
        { group: "magic", topic: "progress" },
        { group: "magic", topic: "omen" },
        ...(hasGrowthLite ? [{ group: "magic" as const, topic: "growth" as const }] : []),
        { group: "ambient", topic: "ambient" },
    ];

    return baseSelections
        .flatMap((selection) => (
            Array.from({ length: 4 }, (_, replyIndex) => ({
                ...selection,
                replyIndex,
            }))
        ))
        .map((selection) => {
            const speech = getHomeDailySpeech(selection, scene, weakCount, magicState);
            return {
                selection,
                speech,
                replyId: getHomeSpeechReplyId(speech),
            };
        })
        .filter((candidate, index, allCandidates) => {
            return allCandidates.findIndex((other) => (
                other.selection.group === candidate.selection.group
                && other.selection.topic === candidate.selection.topic
                && other.replyId === candidate.replyId
            )) === index;
        });
}

export function buildHomeSpeechConversationContext(
    scene: IkimonoSceneText,
    weakCount: number,
    magicState?: HomeMagicSpeechState,
) {
    const candidates = buildHomeSpeechCandidates(scene, weakCount, magicState);

    return {
        ambientAvailable: true,
        percent: magicState?.percent ?? 0,
        hasGrowthLite: scene.stage === "egg"
            || scene.stage === "hatching"
            || scene.stage === "small"
            || scene.stage === "medium",
        hasNamingHint: false,
        candidates,
    };
}

export function findHomeSpeechCandidate(
    candidates: HomeSpeechCandidate[],
    selection: HomeSpeechSelection,
): HomeSpeechCandidate | null {
    return candidates.find((candidate) => (
        candidate.selection.group === selection.group
        && candidate.selection.topic === selection.topic
        && candidate.selection.replyIndex === selection.replyIndex
    )) ?? null;
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
