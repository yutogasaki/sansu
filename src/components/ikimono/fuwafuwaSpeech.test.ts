import { describe, expect, it } from "vitest";
import { getHitokotoSpeech, getHomeFuwafuwaSpeech } from "./fuwafuwaSpeech";
import { IkimonoSceneText } from "./sceneText";

const makeScene = (overrides: Partial<IkimonoSceneText> = {}): IkimonoSceneText => ({
    stage: "small",
    nowLine: "ちいさく うごいてる。",
    transition: "ゆっくり おおきく なる。",
    moodLine: "ごきげん みたい。",
    aura: ["好奇心", "軽さ", "あたらしさ"],
    whisper: "そばに いたいみたい。",
    ...overrides,
});

describe("fuwafuwa speech", () => {
    it("uses event accent and celebratory motion for level-up speech", () => {
        const speech = getHomeFuwafuwaSpeech(makeScene(), "level_up", 2);

        expect(speech.accent).toBe("event");
        expect(speech.reactionStyle).toBe("celebrating");
        expect(speech.lines[1]).toContain("ゆっくり");
    });

    it("uses ambient sharing speech for egg stage", () => {
        const speech = getHomeFuwafuwaSpeech(makeScene({ stage: "egg" }), null, 3);

        expect(speech.accent).toBe("ambient");
        expect(speech.reactionStyle).toBe("sharing");
        expect(speech.lines[0]).toContain("うれしい");
    });

    it("prefers magic growing speech when weak count is zero", () => {
        const speech = getHomeFuwafuwaSpeech(makeScene({ stage: "adult" }), null, 0);

        expect(speech.accent).toBe("magic");
        expect(speech.reactionStyle).toBe("growing");
    });

    it("maps egg tap hitokoto to ambient cozy speech", () => {
        const speech = getHitokotoSpeech("コンコン", "egg", "tap");

        expect(speech.accent).toBe("ambient");
        expect(speech.reactionStyle).toBe("cozy");
        expect(speech.lines).toEqual(["コンコン"]);
    });

    it("switches to keep-going style action hint when the tank is full", () => {
        const speech = getHomeFuwafuwaSpeech(makeScene({ stage: "adult" }), null, 2, {
            percent: 100,
            isFull: true,
        });

        expect(speech.accent).toBe("magic");
        expect(speech.reactionStyle).toBe("guiding");
        expect(speech.lines[0]).toContain("まほうエネルギー");
    });

    it("uses delivery speech while magic energy is being sent", () => {
        const speech = getHomeFuwafuwaSpeech(makeScene({ stage: "adult" }), null, 2, {
            percent: 100,
            isFull: true,
            isSending: true,
        });

        expect(speech.accent).toBe("magic");
        expect(speech.reactionStyle).toBe("celebrating");
        expect(speech.lines[1]).toContain("とどいてる");
    });
});
