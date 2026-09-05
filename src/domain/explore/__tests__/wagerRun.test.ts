import { describe, expect, it } from "vitest";
import {
    WAGER_ROUND_COUNT,
    carryWagerTool,
    createWagerSession,
    getWagerCardBestPoints,
    getWagerSpeedMultiplier,
    getWagerTargetScore,
    pickWagerCard,
    pickWagerTool,
    replayWagerSession,
    resolveWagerCard,
    submitWagerAnswer,
    type WagerCardId,
    type WagerSession,
} from "../wagerRun";

const FAST = 1200;
const SLOW = 20000;

const playCard = (
    session: WagerSession,
    cardId: WagerCardId,
    elapsedMs: number,
): WagerSession => {
    let next = pickWagerCard(session, cardId);
    const card = resolveWagerCard(cardId, next.run.tools);
    for (let index = 0; index < card.problemCount; index += 1) {
        next = submitWagerAnswer(next, { correct: true, elapsedMs });
    }
    return next;
};

/** 道具の3択は毎回同じ位置を取り、途中の分岐を作らない。 */
const playRun = (
    session: WagerSession,
    cardId: WagerCardId,
    elapsedMs: number,
): WagerSession => {
    let next = session;
    for (let round = 0; round < WAGER_ROUND_COUNT; round += 1) {
        next = playCard(next, cardId, elapsedMs);
        if (next.run.status === "tooling") {
            next = pickWagerTool(next, next.run.offer[0]);
        }
    }
    return next;
};

describe("getWagerSpeedMultiplier", () => {
    it("速いほど倍率が上がる", () => {
        expect(getWagerSpeedMultiplier(1000, [])).toBe(3);
        expect(getWagerSpeedMultiplier(5000, [])).toBe(2);
        expect(getWagerSpeedMultiplier(30000, [])).toBe(1);
    });

    it("遅くても0倍にはしない", () => {
        expect(getWagerSpeedMultiplier(10 * 60 * 1000, [])).toBeGreaterThan(0);
    });

    it("はやてのふえ はしきい値を緩める", () => {
        expect(getWagerSpeedMultiplier(4000, [])).toBe(2);
        expect(getWagerSpeedMultiplier(4000, ["swift"])).toBe(3);
    });
});

describe("札の設計", () => {
    it("むずかしいほど1回で稼げる上限が大きい", () => {
        expect(getWagerCardBestPoints("easy", [])).toBeLessThan(
            getWagerCardBestPoints("normal", []),
        );
        expect(getWagerCardBestPoints("normal", [])).toBeLessThan(
            getWagerCardBestPoints("hard", []),
        );
    });

    it("ふたごのいし は問題数を減らしても総取り分を変えない", () => {
        expect(getWagerCardBestPoints("easy", ["twin"]))
            .toBe(getWagerCardBestPoints("easy", []));
        expect(resolveWagerCard("easy", ["twin"]).problemCount).toBe(2);
    });

    it("むずかしい札ほど上のレベルを引く", () => {
        expect(resolveWagerCard("easy", []).levelOffset).toBeLessThan(0);
        expect(resolveWagerCard("hard", []).levelOffset).toBeGreaterThan(0);
    });
});

describe("誤答の扱い", () => {
    it("誤答しても点は減らず、run も進まない", () => {
        const session = pickWagerCard(createWagerSession("seed", 9), "normal");
        const after = submitWagerAnswer(session, { correct: false, elapsedMs: 2000 });

        expect(after.run.score).toBe(0);
        expect(after.run.cardPoints).toBe(0);
        expect(after.run.remainingProblems).toBe(session.run.remainingProblems);
        expect(after.run.status).toBe("solving");
        expect(after.metrics.totalWrong).toBe(1);
    });

    it("誤答した問題は速さの倍率が付かないが、素点は必ず入る", () => {
        const base = pickWagerCard(createWagerSession("seed", 9), "normal");
        const missed = submitWagerAnswer(base, { correct: false, elapsedMs: 2000 });
        const solved = submitWagerAnswer(missed, { correct: true, elapsedMs: FAST });

        const card = resolveWagerCard("normal", []);
        expect(solved.run.lastAward?.multiplier).toBe(1);
        expect(solved.run.lastAward?.points).toBe(card.basePoints);
    });

    it("まもりのは は run 中1回だけ倍率を守る", () => {
        let session = createWagerSession("seed", 9, ["guard"]);
        session = pickWagerCard(session, "normal");
        session = submitWagerAnswer(session, { correct: false, elapsedMs: 2000 });
        session = submitWagerAnswer(session, { correct: true, elapsedMs: FAST });
        expect(session.run.lastAward?.multiplier).toBe(3);
        expect(session.run.guardUsed).toBe(true);

        session = submitWagerAnswer(session, { correct: false, elapsedMs: 2000 });
        session = submitWagerAnswer(session, { correct: true, elapsedMs: FAST });
        expect(session.run.lastAward?.multiplier).toBe(1);
    });
});

describe("run の進行", () => {
    it("札を解き切ると点が確定し、進行中の集計は0へ戻る", () => {
        const session = playCard(createWagerSession("seed", 9), "hard", SLOW);
        const card = resolveWagerCard("hard", []);

        expect(session.run.score).toBe(card.basePoints);
        expect(session.run.cardPoints).toBe(0);
        expect(session.run.status).toBe("tooling");
        expect(session.run.offer).toHaveLength(3);
    });

    it("4回で run が終わり、持ち帰りの3択が出る", () => {
        const session = playRun(createWagerSession("seed", 9), "normal", FAST);
        expect(session.run.status).toBe("carrying");
        expect(session.run.roundIndex).toBe(WAGER_ROUND_COUNT);
        expect(session.run.history).toHaveLength(WAGER_ROUND_COUNT);
    });

    it("同じ速さなら むずかしい札のほうが必ず多く稼げる", () => {
        for (const elapsedMs of [FAST, 5000, SLOW]) {
            const easy = playCard(createWagerSession("seed", 9), "easy", elapsedMs);
            const normal = playCard(createWagerSession("seed", 9), "normal", elapsedMs);
            const hard = playCard(createWagerSession("seed", 9), "hard", elapsedMs);

            expect(easy.run.score).toBeLessThan(normal.run.score);
            expect(normal.run.score).toBeLessThan(hard.run.score);
        }
    });

    /**
     * ante 1 は入口なので、速ければ やさしい札だけでも届いてよい。
     * 賭けが意味を持ち始めるのは ante 2 以降とする。
     */
    it("ante 2 からは やさしい札だけでは届かない", () => {
        let session = createWagerSession("seed", 9);
        session = { ...session, run: { ...session.run, ante: 2, targetScore: getWagerTargetScore(2) } };
        session = playRun(session, "easy", FAST);

        expect(session.run.score).toBeLessThan(session.run.targetScore);
        expect(session.run.cleared).toBe(false);
    });

    /**
     * 学習の速さを罰しないための下限。1問ずつ時間をかけて正解する子でも、
     * むずかしい札を選び続ければ ante 1 は必ず届く。
     */
    it("ゆっくりでも むずかしい札を選び続ければ ante 1 は届く", () => {
        const session = playRun(createWagerSession("seed", 9), "hard", SLOW);
        expect(session.run.cleared).toBe(true);
    });
});

describe("持ち帰りと ante", () => {
    it("持ち帰った道具は次の run の開始装備になる", () => {
        const finished = playRun(createWagerSession("seed", 9), "hard", SLOW);
        const carried = carryWagerTool(finished, finished.run.offer[0]);
        const next = replayWagerSession(carried);

        expect(next.run.tools).toContain(finished.run.offer[0]);
        expect(next.metrics.replayStarts).toBe(1);
        expect(next.metrics.runs).toBe(1);
    });

    it("届いた run のあとだけ目標が上がる", () => {
        const cleared = playRun(createWagerSession("seed", 9), "hard", SLOW);
        const nextAfterClear = replayWagerSession(
            carryWagerTool(cleared, cleared.run.offer[0]),
        );
        expect(nextAfterClear.run.ante).toBe(2);
        expect(nextAfterClear.run.targetScore).toBe(getWagerTargetScore(2));

        const missed = playRun(createWagerSession("seed", 9), "easy", SLOW);
        const nextAfterMiss = replayWagerSession(
            carryWagerTool(missed, missed.run.offer[0]),
        );
        expect(nextAfterMiss.run.ante).toBe(1);
    });

    it("run が終わるまでは持ち帰りも replay も受け付けない", () => {
        const session = pickWagerCard(createWagerSession("seed", 9), "normal");
        expect(carryWagerTool(session, "swift")).toBe(session);
        expect(replayWagerSession(session)).toBe(session);
    });
});

describe("観察用メトリクス", () => {
    it("札の選び方を数える", () => {
        let session = createWagerSession("seed", 9);
        session = playCard(session, "easy", FAST);
        session = pickWagerTool(session, session.run.offer[0]);
        session = playCard(session, "hard", FAST);

        expect(session.metrics.cardPicks.easy).toBe(1);
        expect(session.metrics.cardPicks.hard).toBe(1);
        expect(session.metrics.cardPicks.normal).toBe(0);
    });

    it("平均解答時間は解けた問題だけで出す", () => {
        let session = pickWagerCard(createWagerSession("seed", 9), "normal");
        session = submitWagerAnswer(session, { correct: true, elapsedMs: 2000 });
        session = submitWagerAnswer(session, { correct: true, elapsedMs: 4000 });

        expect(session.metrics.totalProblems).toBe(2);
        expect(session.metrics.averageAnswerMs).toBe(3000);
    });
});
