import { describe, expect, it } from "vitest";
import {
    chooseNextDailyConversation,
    EMPTY_DAILY_CONVERSATION_STATE,
    type DailyConversationContext,
    type DailyConversationState,
} from "./fuwafuwaDailyConversation";
import type { HomeSpeechCandidate } from "./fuwafuwaSpeech";

function candidate(
    group: "everyday" | "magic" | "ambient",
    topic: "greeting" | "mood" | "mechanic" | "progress" | "omen" | "growth" | "ambient",
    replyId: string,
    replyIndex = 0,
): HomeSpeechCandidate {
    return {
        selection: { group, topic, replyIndex },
        replyId,
        speech: {
            lines: [replyId],
            accent: group === "magic" ? "magic" : group === "ambient" ? "ambient" : "everyday",
            reactionStyle: group === "magic" ? "growing" : "cozy",
        },
    };
}

function context(candidates: HomeSpeechCandidate[], overrides: Partial<DailyConversationContext> = {}): DailyConversationContext {
    return {
        ambientAvailable: false,
        percent: 0,
        hasGrowthLite: false,
        hasNamingHint: false,
        candidates,
        ...overrides,
    };
}

function state(overrides: Partial<DailyConversationState> = {}): DailyConversationState {
    return {
        ...EMPTY_DAILY_CONVERSATION_STATE,
        ...overrides,
    };
}

describe("fuwafuwaDailyConversation", () => {
    it("prefers magic when everyday appeared twice in a row", () => {
        const dailyContext = context([
            candidate("everyday", "greeting", "greeting:0"),
            candidate("magic", "mechanic", "mechanic:0"),
        ]);

        const result = chooseNextDailyConversation(state({
            currentGroup: "everyday",
            currentTopic: "greeting",
            currentReplyId: "greeting:0",
            recentGroups: ["everyday", "everyday"],
            recentTopics: ["greeting", "greeting"],
            recentReplyIds: ["greeting:0"],
            ambientGap: 2,
            turn: 2,
        }), dailyContext, "tick");

        expect(result.candidate).toMatchObject({
            selection: {
                group: "magic",
                topic: "mechanic",
            },
            replyId: "mechanic:0",
        });
        expect(result.nextState.currentGroup).toBe("magic");
    });

    it("never keeps ambient twice in a row", () => {
        const dailyContext = context([
            candidate("everyday", "greeting", "greeting:0"),
            candidate("magic", "mechanic", "mechanic:0"),
            candidate("ambient", "ambient", "ambient:0"),
        ], { ambientAvailable: true });

        const result = chooseNextDailyConversation(state({
            currentGroup: "ambient",
            currentTopic: "ambient",
            currentReplyId: "ambient:0",
            recentGroups: ["ambient", "magic"],
            recentTopics: ["ambient", "mechanic"],
            recentReplyIds: ["ambient:0"],
            ambientGap: 0,
            turn: 3,
        }), dailyContext, "tick");

        expect(result.candidate?.selection.group).not.toBe("ambient");
    });

    it("switches to a different topic on tap", () => {
        const dailyContext = context([
            candidate("everyday", "greeting", "greeting:0", 0),
            candidate("everyday", "greeting", "greeting:1", 1),
            candidate("everyday", "mood", "mood:0", 0),
            candidate("magic", "mechanic", "mechanic:0", 0),
        ]);

        const result = chooseNextDailyConversation(state({
            currentGroup: "everyday",
            currentTopic: "greeting",
            currentReplyId: "greeting:0",
            recentGroups: ["everyday"],
            recentTopics: ["greeting"],
            recentReplyIds: ["greeting:0"],
            ambientGap: 1,
            turn: 1,
        }), dailyContext, "tap");

        expect(result.candidate?.selection.topic).not.toBe("greeting");
    });

    it("moves to another group on tap when current group topics are penalized", () => {
        const dailyContext = context([
            candidate("everyday", "greeting", "greeting:0", 0),
            candidate("magic", "mechanic", "mechanic:0", 0),
        ]);

        const result = chooseNextDailyConversation(state({
            currentGroup: "everyday",
            currentTopic: "greeting",
            currentReplyId: "greeting:0",
            recentGroups: ["everyday", "everyday"],
            recentTopics: ["greeting", "greeting"],
            recentReplyIds: ["greeting:0"],
            ambientGap: 3,
            turn: 2,
        }), dailyContext, "tap");

        expect(result.candidate).toMatchObject({
            selection: {
                group: "magic",
                topic: "mechanic",
            },
            replyId: "mechanic:0",
        });
    });
});
