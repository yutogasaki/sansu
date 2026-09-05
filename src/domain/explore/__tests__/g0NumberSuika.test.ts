import { describe, expect, it } from "vitest";
import {
    G0_SUIKA_CHARMS,
    G0_SUIKA_PROFILES,
    G0_SUIKA_PROFILE_IDS,
    SUIKA_WORLD_WIDTH,
    aimG0SuikaRun,
    canDropG0SuikaBall,
    canSuikaMerge,
    createG0SuikaRun,
    createG0SuikaSession,
    dropG0SuikaBall,
    dropG0SuikaSession,
    getG0SuikaMetrics,
    getSuikaBallRadius,
    getSuikaDropCooldownMs,
    getSuikaPreviewLength,
    getSuikaWorldWidth,
    isSuikaTargetHit,
    pickG0SuikaCharm,
    replayG0SuikaSession,
    stepG0SuikaRun,
    stepG0SuikaSession,
    switchG0SuikaProfile,
    type G0SuikaProfileId,
    type G0SuikaRunState,
} from "../g0NumberSuika";
import {
    createQuantity,
    formatQuantity,
    type SuikaQuantity,
} from "../suikaQuantity";

const q = createQuantity;

const advance = (
    run: G0SuikaRunState,
    totalMs: number,
    frameMs = 16,
): G0SuikaRunState => {
    let current = run;
    for (let elapsed = 0; elapsed < totalMs; elapsed += frameMs) {
        current = stepG0SuikaRun(current, frameMs);
    }
    return current;
};

const withQueue = (
    run: G0SuikaRunState,
    quantity: SuikaQuantity,
): G0SuikaRunState => ({
    ...run,
    queue: [quantity, ...run.queue.slice(1)],
});

const dropAt = (
    run: G0SuikaRunState,
    quantity: SuikaQuantity,
    x: number,
): G0SuikaRunState => dropG0SuikaBall(
    aimG0SuikaRun(withQueue(run, quantity), x),
);

const labelsOf = (run: G0SuikaRunState): string[] => {
    const display = G0_SUIKA_PROFILES[run.profileId].display;
    return run.balls
        .map((ball) => formatQuantity(ball.quantity, display))
        .sort();
};

describe("合体規則", () => {
    it("整数: 和が10以下なら合体、ちょうど10なら解放、11以上は不成立", () => {
        const target = q(10);

        expect(canSuikaMerge(q(3), q(4), target)).toBe(true);
        expect(canSuikaMerge(q(6), q(4), target)).toBe(true);
        expect(isSuikaTargetHit(q(6), q(4), target)).toBe(true);
        expect(canSuikaMerge(q(6), q(5), target)).toBe(false);
    });

    it("小数: 和が1以下なら合体、ちょうど1なら解放、超えたら不成立", () => {
        const target = q(1);

        expect(canSuikaMerge(q(3, 10), q(4, 10), target)).toBe(true);
        expect(isSuikaTargetHit(q(6, 10), q(4, 10), target)).toBe(true);
        expect(canSuikaMerge(q(6, 10), q(5, 10), target)).toBe(false);
    });

    it("分数: 異分母でも同じ規則で判定する", () => {
        const target = q(1);

        expect(canSuikaMerge(q(1, 3), q(1, 6), target)).toBe(true);
        expect(isSuikaTargetHit(q(1, 2), q(1, 2), target)).toBe(true);
        expect(isSuikaTargetHit(q(2, 3), q(1, 3), target)).toBe(true);
        expect(canSuikaMerge(q(2, 3), q(1, 2), target)).toBe(false);
    });
});

describe("玉の大きさ", () => {
    it("表記が違っても同じ量なら同じ大きさになる", () => {
        const integerHalf = getSuikaBallRadius(q(5), q(10));
        const decimalHalf = getSuikaBallRadius(q(5, 10), q(1));
        const fractionHalf = getSuikaBallRadius(q(1, 2), q(1));

        expect(decimalHalf).toBe(integerHalf);
        expect(fractionHalf).toBe(integerHalf);
    });

    it("量が大きいほど大きくなる", () => {
        expect(getSuikaBallRadius(q(1, 6), q(1)))
            .toBeLessThan(getSuikaBallRadius(q(1, 2), q(1)));
        expect(getSuikaBallRadius(q(1, 2), q(1)))
            .toBeLessThan(getSuikaBallRadius(q(1), q(1)));
    });
});

describe("整数profile", () => {
    it("触れた2つが和の玉になる", () => {
        let run = createG0SuikaRun("merge-test", 0, [], "tens");
        run = advance(dropAt(run, q(3), 50), 1600);
        expect(labelsOf(run)).toEqual(["3"]);

        run = advance(dropAt(run, q(4), 50), 1600);

        expect(labelsOf(run)).toEqual(["7"]);
        expect(run.mergeCount).toBe(1);
        expect(run.score).toBe(7);
    });

    it("ちょうど10になると弾けて消える", () => {
        let run = createG0SuikaRun("pop-test", 0, [], "tens");
        run = advance(dropAt(run, q(4), 50), 1600);
        run = advance(dropAt(run, q(6), 50), 1600);

        expect(run.targetPopCount).toBe(1);
        expect(run.balls).toHaveLength(0);
        expect(run.score).toBeGreaterThanOrEqual(100);
    });

    it("和が11以上なら合体せず積み上がる", () => {
        let run = createG0SuikaRun("reject-test", 0, [], "tens");
        run = advance(dropAt(run, q(9), 50), 1600);
        run = advance(dropAt(run, q(9), 50), 1600);

        expect(labelsOf(run)).toEqual(["9", "9"]);
        expect(run.mergeCount).toBe(0);
    });

    it("合体できない接触は無反応にせず弾きイベントを残す", () => {
        let run = createG0SuikaRun("reject-event-test", 0, [], "tens");
        run = advance(dropAt(run, q(9), 50), 1600);
        run = advance(dropAt(run, q(9), 50), 1300);

        expect(run.events.some((event) => event.kind === "reject")).toBe(true);
    });
});

describe("小数profile", () => {
    it("0.3と0.4が触れて0.7になる", () => {
        let run = createG0SuikaRun("dec-merge", 0, [], "decimal");
        run = advance(dropAt(run, q(3, 10), 50), 1600);
        run = advance(dropAt(run, q(4, 10), 50), 1600);

        expect(labelsOf(run)).toEqual(["0.7"]);
        expect(run.mergeCount).toBe(1);
    });

    it("0.1を10回ぶんまで足しても誤差なく1で解放する", () => {
        let run = createG0SuikaRun("dec-pop", 0, [], "decimal");
        run = advance(dropAt(run, q(1, 10), 50), 1600);
        run = advance(dropAt(run, q(2, 10), 50), 1600);
        // 0.1 + 0.2 = 0.3、そこへ 0.7 を重ねてちょうど1にする。
        run = advance(dropAt(run, q(7, 10), 50), 1600);

        expect(run.targetPopCount).toBe(1);
        expect(run.balls).toHaveLength(0);
    });

    it("1を超える組は合体しない", () => {
        let run = createG0SuikaRun("dec-reject", 0, [], "decimal");
        run = advance(dropAt(run, q(6, 10), 50), 1600);
        run = advance(dropAt(run, q(5, 10), 50), 1600);

        expect(labelsOf(run)).toEqual(["0.5", "0.6"]);
        expect(run.mergeCount).toBe(0);
    });
});

describe("分数profile", () => {
    it("1/3と1/6が触れて1/2になる", () => {
        let run = createG0SuikaRun("frac-merge", 0, [], "fraction");
        run = advance(dropAt(run, q(1, 3), 50), 1600);
        run = advance(dropAt(run, q(1, 6), 50), 1600);

        expect(labelsOf(run)).toEqual(["1/2"]);
        expect(run.mergeCount).toBe(1);
    });

    it("1/4と1/3で7/12という異分母の和も作れる", () => {
        let run = createG0SuikaRun("frac-twelfth", 0, [], "fraction");
        run = advance(dropAt(run, q(1, 4), 50), 1600);
        run = advance(dropAt(run, q(1, 3), 50), 1600);

        expect(labelsOf(run)).toEqual(["7/12"]);
    });

    it("1/2どうしがちょうど1になって解放する", () => {
        let run = createG0SuikaRun("frac-pop", 0, [], "fraction");
        run = advance(dropAt(run, q(1, 2), 50), 1600);
        run = advance(dropAt(run, q(1, 2), 50), 1600);

        expect(run.targetPopCount).toBe(1);
        expect(run.balls).toHaveLength(0);
    });

    it("1を超える組は合体しない", () => {
        let run = createG0SuikaRun("frac-reject", 0, [], "fraction");
        run = advance(dropAt(run, q(2, 3), 50), 1600);
        run = advance(dropAt(run, q(1, 2), 50), 1600);

        expect(labelsOf(run)).toEqual(["1/2", "2/3"]);
        expect(run.mergeCount).toBe(0);
    });
});

describe("落下操作", () => {
    it("クールダウン中は次の玉を落とせない", () => {
        const run = dropG0SuikaBall(createG0SuikaRun("cooldown-test"));
        expect(run.dropCount).toBe(1);
        expect(canDropG0SuikaBall(run)).toBe(false);
        expect(dropG0SuikaBall(run)).toBe(run);
        expect(canDropG0SuikaBall(advance(run, 600))).toBe(true);
    });

    it("狙いは容器の内側へ丸める", () => {
        const run = createG0SuikaRun("aim-test");

        expect(aimG0SuikaRun(run, -40).aimX).toBeGreaterThan(0);
        expect(aimG0SuikaRun(run, 999).aimX).toBeLessThan(run.worldWidth);
    });

    it("落とすとキューが1つ進む", () => {
        const run = createG0SuikaRun("queue-test");
        const nextRun = dropG0SuikaBall(run);

        expect(nextRun.queue[0]).toEqual(run.queue[1]);
        expect(nextRun.queue).toHaveLength(run.queue.length);
    });

    it("どのprofileでもキューは pool の量だけを出す", () => {
        for (const profileId of G0_SUIKA_PROFILE_IDS) {
            const run = createG0SuikaRun("pool-test", 0, [], profileId);
            const allowed = G0_SUIKA_PROFILES[profileId].pool
                .map((entry) => `${entry.quantity.n}/${entry.quantity.d}`);

            for (const quantity of run.queue) {
                expect(allowed).toContain(`${quantity.n}/${quantity.d}`);
            }
        }
    });
});

describe("決定論", () => {
    it("同じseedと同じ操作列からは同じ盤面になる", () => {
        const play = (profileId: G0SuikaProfileId): G0SuikaRunState => {
            let run = createG0SuikaRun("determinism-test", 0, [], profileId);
            for (const x of [30, 60, 45, 70, 20]) {
                run = advance(dropG0SuikaBall(aimG0SuikaRun(run, x)), 900);
            }
            return run;
        };

        for (const profileId of G0_SUIKA_PROFILE_IDS) {
            const left = play(profileId);
            const right = play(profileId);
            expect(JSON.stringify(left.balls)).toBe(JSON.stringify(right.balls));
            expect(left.score).toBe(right.score);
        }
    });
});

describe("あふれ", () => {
    it("デッドラインを超えたまま時間が経つとrunが終わる", () => {
        let run = createG0SuikaRun("overflow-test");

        for (let index = 0; index < 40 && run.status === "playing"; index += 1) {
            run = advance(dropAt(run, q(9), index % 2 === 0 ? 25 : 72), 520);
        }

        expect(run.status).toBe("over");
        expect(run.endedAtMs).not.toBeNull();
    });
});

describe("おまもり", () => {
    it("ひろいうつわは容器を広げる", () => {
        expect(getSuikaWorldWidth(["wide-vessel"]))
            .toBeGreaterThan(SUIKA_WORLD_WIDTH);
        expect(getSuikaWorldWidth([])).toBe(SUIKA_WORLD_WIDTH);
    });

    it("さきよみは見える先を伸ばす", () => {
        expect(getSuikaPreviewLength(["far-sight"]))
            .toBeGreaterThan(getSuikaPreviewLength([]));
    });

    it("はやおとしはクールダウンを短くする", () => {
        expect(getSuikaDropCooldownMs(["quick-hand"]))
            .toBeLessThan(getSuikaDropCooldownMs([]));
    });

    it("ラベルは数の種類に依存しない言い方にする", () => {
        for (const charm of Object.values(G0_SUIKA_CHARMS)) {
            expect(charm.label.length).toBeGreaterThan(0);
            expect(charm.detail.length).toBeGreaterThan(0);
            expect(charm.detail).not.toContain("10");
        }
    });
});

describe("セッション", () => {
    const playUntilOver = (seed: string) => {
        let session = createG0SuikaSession(seed);

        for (let index = 0; index < 40 && session.run.status === "playing"; index += 1) {
            session = {
                ...session,
                run: aimG0SuikaRun(
                    withQueue(session.run, q(9)),
                    index % 2 === 0 ? 25 : 72,
                ),
            };
            session = dropG0SuikaSession(session);
            for (let frame = 0; frame < 33; frame += 1) {
                session = stepG0SuikaSession(session, 16);
            }
        }

        return session;
    };

    it("run終了時におまもりを3つ提示する", () => {
        const session = playUntilOver("session-offer");

        expect(session.run.status).toBe("over");
        expect(session.charmOffer).toHaveLength(3);
        expect(session.history).toHaveLength(1);
    });

    it("選んだおまもりは次のrunへ持ち越す", () => {
        const session = playUntilOver("session-carry");
        const picked = pickG0SuikaCharm(session, session.charmOffer[0]);
        const replayed = replayG0SuikaSession(picked);

        expect(replayed.charms).toEqual(picked.charms);
        expect(replayed.run.charms).toEqual(picked.charms);
        expect(replayed.run.status).toBe("playing");
        expect(replayed.replayStarts).toBe(1);
    });

    it("提示していないおまもりは受け付けない", () => {
        const session = playUntilOver("session-guard");
        const outside = (
            ["small-hands", "wide-vessel", "pop-blast", "far-sight", "quick-hand"] as const
        ).find((charmId) => !session.charmOffer.includes(charmId));

        if (outside) {
            expect(pickG0SuikaCharm(session, outside)).toBe(session);
        }
    });

    it("数の種類を切り替えてもおまもりと履歴は残る", () => {
        const session = pickG0SuikaCharm(
            playUntilOver("session-switch"),
            playUntilOver("session-switch").charmOffer[0],
        );
        const switched = switchG0SuikaProfile(session, "fraction");

        expect(switched.profileId).toBe("fraction");
        expect(switched.run.profileId).toBe("fraction");
        expect(switched.run.target).toEqual(q(1));
        expect(switched.charms).toEqual(session.charms);
        expect(switched.run.charms).toEqual(session.charms);
        expect(switched.history.length).toBeGreaterThanOrEqual(
            session.history.length,
        );
        expect(switched.profileSwitches).toBe(1);
    });

    it("同じ種類への切替は何もしない", () => {
        const session = createG0SuikaSession("session-same", "decimal");

        expect(switchG0SuikaProfile(session, "decimal")).toBe(session);
    });

    it("メトリクスは自発リプレイと完走を数える", () => {
        const session = replayG0SuikaSession(playUntilOver("session-metrics"));
        const metrics = getG0SuikaMetrics(session);

        expect(metrics.completedRuns).toBe(1);
        expect(metrics.replayStarts).toBe(1);
        expect(metrics.averageDropCount).not.toBeNull();
        expect(metrics.playedProfileIds).toContain("tens");
    });
});
