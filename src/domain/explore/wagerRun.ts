/**
 * コア候補: かけ探検（core-wager-v1）
 *
 * 借りるのは Balatro のブラインド選択（目標点を宣言し、どこで賭けるかを選ぶ）、
 * Slay the Spire の道選択（次に何と戦うかを先に選ぶ）、
 * Vampire Survivors のレベルアップ3択（数手ごとにビルドが伸びる）の3つ。
 * キャラクター、固有名、画面構図、音、造形は借りない。
 *
 * Sansu固有の中心は、賭ける対象が武器でも敵でもなく
 * **これから自分が解く問題そのもの** である点に置く。
 *
 * - やさしい札: 問題数が多く、1問の点が小さい
 * - むずかしい札: 1問だけだが、点が大きい
 * - 速さは倍率になる。急かさない。遅くても0点にはならない
 * - 誤答は減点でも run 終了でもない。その問題の倍率が伸びないだけ
 *
 * 全118 skill が持つのは「難易度」と「速さ」だけなので、
 * この2つだけをゲーム量へ変換する（docs/product/19_problem_first_core_design.md §3）。
 * 数量の意味（和・差・積・商）は共通レイヤに置かない。
 *
 * このモジュールは skill も Problem も知らない。難易度は baseLevel からの
 * オフセットとしてのみ表現し、実際の出題は呼び出し側が解決する。
 * planner / SRS への接続は G1 の課題であり、ここでは行わない。
 *
 * production挙動は上書きしない。dev専用ラボのための純粋ドメイン。
 */
import { createSeededRandom } from "../../utils/random";

export const WAGER_EXPERIMENT_ID = "core-wager-v1" as const;

export const WAGER_ROUND_COUNT = 4;

/**
 * 目標点。ante が上がるほど高くなる（Balatro のブラインド上昇から借りる）。
 *
 * ante 1 の 300 は「1問ずつ ゆっくり 正解する子（倍率1倍）でも、
 * むずかしい札を選び続ければ 360 で届く」下限として置く。
 * 速い子は初回で余裕を持って超えるので、ante を上げて緊張を戻す。
 * 届かなかった run では ante を上げない。学習の遅さを罰にしない。
 */
export const WAGER_BASE_TARGET_SCORE = 300;
/**
 * 80 は「やさしい札だけを最高倍率で4回（360点）」を ante 2 で超える最小の刻み。
 * ante 1 は入口なので やさしい札だけでも届いてよいが、
 * ante 2 からは必ずどこかで賭ける必要がある。
 */
export const WAGER_TARGET_STEP = 80;

export const getWagerTargetScore = (ante: number): number => (
    WAGER_BASE_TARGET_SCORE + WAGER_TARGET_STEP * Math.max(0, ante - 1)
);

/** 速さの倍率のしきい値。カウントダウンは出さない。 */
const FAST_MS = 3000;
const MID_MS = 6000;
/** 「はやてのふえ」で緩む幅。 */
const SWIFT_BONUS_MS = 1500;

export type WagerCardId = "easy" | "normal" | "hard";
export type WagerToolId = "swift" | "twin" | "steady" | "bold" | "guard";
export type WagerStatus = "choosing" | "solving" | "tooling" | "carrying" | "over";

export interface WagerCardDef {
    id: WagerCardId;
    label: string;
    glyph: string;
    /** 何問解くか。 */
    problemCount: number;
    /** baseLevel からのずれ。出題の解決は呼び出し側が行う。 */
    levelOffset: number;
    /** 1問あたりの素点。 */
    basePoints: number;
}

export interface WagerToolDef {
    id: WagerToolId;
    label: string;
    detail: string;
    glyph: string;
}

export const WAGER_CARD_IDS: readonly WagerCardId[] = ["easy", "normal", "hard"];

const BASE_CARDS: Record<WagerCardId, WagerCardDef> = {
    easy: {
        id: "easy",
        label: "やさしい",
        glyph: "★",
        problemCount: 3,
        levelOffset: -1,
        basePoints: 10,
    },
    normal: {
        id: "normal",
        label: "ふつう",
        glyph: "★★",
        problemCount: 2,
        levelOffset: 0,
        basePoints: 25,
    },
    hard: {
        id: "hard",
        label: "むずかしい",
        glyph: "★★★",
        problemCount: 1,
        levelOffset: 1,
        basePoints: 90,
    },
};

export const WAGER_TOOLS: Record<WagerToolId, WagerToolDef> = {
    swift: {
        id: "swift",
        label: "はやてのふえ",
        detail: "ばいりつが つきやすい",
        glyph: "♪",
    },
    twin: {
        id: "twin",
        label: "ふたごのいし",
        detail: "★が 2もんに なる",
        glyph: "◎",
    },
    steady: {
        id: "steady",
        label: "どっしりいし",
        detail: "★★の 点が ふえる",
        glyph: "■",
    },
    bold: {
        id: "bold",
        label: "おおきなさいころ",
        detail: "★★★の 点が ふえる",
        glyph: "◆",
    },
    guard: {
        id: "guard",
        label: "まもりのは",
        detail: "1かい まちがえても へいき",
        glyph: "◇",
    },
};

export const WAGER_TOOL_IDS: readonly WagerToolId[] = [
    "swift",
    "twin",
    "steady",
    "bold",
    "guard",
];

export interface WagerRoundRecord {
    roundIndex: number;
    cardId: WagerCardId;
    points: number;
    wrongCount: number;
    /** この札で使った解答時間の合計。 */
    elapsedMs: number;
}

export interface WagerRun {
    seed: string;
    baseLevel: number;
    /** 何段目の目標か。1から始まる。 */
    ante: number;
    status: WagerStatus;
    roundIndex: number;
    score: number;
    targetScore: number;
    /** いま選んでいる札。solving 以外では null。 */
    pickedCardId: WagerCardId | null;
    /** 選んだ札のうち、まだ解いていない問題数。 */
    remainingProblems: number;
    /** いま解いている問題での誤答数。倍率の判定に使う。 */
    currentWrongCount: number;
    /** この札でここまでに稼いだ点。 */
    cardPoints: number;
    cardWrongCount: number;
    cardElapsedMs: number;
    tools: WagerToolId[];
    /** status が tooling / carrying のときの3択。 */
    offer: WagerToolId[];
    /** まもりのは を使い切ったか。run 単位で1回。 */
    guardUsed: boolean;
    history: WagerRoundRecord[];
    cleared: boolean;
    /** 直近の1問の結果。演出用。 */
    lastAward: WagerAward | null;
}

export interface WagerAward {
    id: string;
    points: number;
    multiplier: number;
    basePoints: number;
    guarded: boolean;
}

export interface WagerMetrics {
    runs: number;
    clears: number;
    replayStarts: number;
    cardPicks: Record<WagerCardId, number>;
    totalProblems: number;
    totalWrong: number;
    averageAnswerMs: number | null;
    bestScore: number;
}

export interface WagerSession {
    run: WagerRun;
    /** 次の run へ持ち越す おまもり。 */
    carriedTools: WagerToolId[];
    metrics: WagerMetrics;
    runCounter: number;
}

/** 札の定義に、持っている道具の効果を反映する。 */
export const resolveWagerCard = (
    cardId: WagerCardId,
    tools: readonly WagerToolId[],
): WagerCardDef => {
    const base = BASE_CARDS[cardId];

    if (cardId === "easy" && tools.includes("twin")) {
        return { ...base, problemCount: 2, basePoints: 15 };
    }
    if (cardId === "normal" && tools.includes("steady")) {
        return { ...base, basePoints: 35 };
    }
    if (cardId === "hard" && tools.includes("bold")) {
        return { ...base, basePoints: 135 };
    }
    return base;
};

/** 札を最後まで正解し、最大倍率が付いた場合の点。札の比較表示に使う。 */
export const getWagerCardBestPoints = (
    cardId: WagerCardId,
    tools: readonly WagerToolId[],
): number => {
    const card = resolveWagerCard(cardId, tools);
    return card.problemCount * card.basePoints * 3;
};

/**
 * 速さの倍率。3秒以内で3倍、6秒以内で2倍、それ以外は1倍。
 * 遅くても0にはしない。誤答した問題は1倍に固定する。
 */
export const getWagerSpeedMultiplier = (
    elapsedMs: number,
    tools: readonly WagerToolId[],
): number => {
    const bonus = tools.includes("swift") ? SWIFT_BONUS_MS : 0;
    if (elapsedMs <= FAST_MS + bonus) return 3;
    if (elapsedMs <= MID_MS + bonus) return 2;
    return 1;
};

const createRun = (
    seed: string,
    baseLevel: number,
    tools: readonly WagerToolId[],
    ante: number,
): WagerRun => ({
    seed,
    baseLevel,
    ante,
    status: "choosing",
    roundIndex: 0,
    score: 0,
    targetScore: getWagerTargetScore(ante),
    pickedCardId: null,
    remainingProblems: 0,
    currentWrongCount: 0,
    cardPoints: 0,
    cardWrongCount: 0,
    cardElapsedMs: 0,
    tools: [...tools],
    offer: [],
    guardUsed: false,
    history: [],
    cleared: false,
    lastAward: null,
});

export const createWagerSession = (
    seed: string,
    baseLevel: number,
    carriedTools: readonly WagerToolId[] = [],
): WagerSession => ({
    run: createRun(`${seed}:run-1`, baseLevel, carriedTools, 1),
    carriedTools: [...carriedTools],
    metrics: {
        runs: 0,
        clears: 0,
        replayStarts: 0,
        cardPicks: { easy: 0, normal: 0, hard: 0 },
        totalProblems: 0,
        totalWrong: 0,
        averageAnswerMs: null,
        bestScore: 0,
    },
    runCounter: 1,
});

/** 未所持を優先して3つ提示する。同じ seed と同じ所持で同じ3択になる。 */
const rollOffer = (
    seed: string,
    roundIndex: number,
    owned: readonly WagerToolId[],
): WagerToolId[] => {
    const random = createSeededRandom(`${seed}:offer:${roundIndex}`);
    const unowned = WAGER_TOOL_IDS.filter((id) => !owned.includes(id));
    const pool = unowned.length >= 3 ? [...unowned] : [...WAGER_TOOL_IDS];

    const picked: WagerToolId[] = [];
    const remaining = [...pool];
    while (picked.length < 3 && remaining.length > 0) {
        const index = Math.floor(random() * remaining.length);
        picked.push(remaining.splice(index, 1)[0]);
    }
    return picked;
};

export const pickWagerCard = (
    session: WagerSession,
    cardId: WagerCardId,
): WagerSession => {
    const { run } = session;
    if (run.status !== "choosing") return session;

    const card = resolveWagerCard(cardId, run.tools);

    return {
        ...session,
        run: {
            ...run,
            status: "solving",
            pickedCardId: cardId,
            remainingProblems: card.problemCount,
            currentWrongCount: 0,
            cardPoints: 0,
            cardWrongCount: 0,
            cardElapsedMs: 0,
            lastAward: null,
        },
        metrics: {
            ...session.metrics,
            cardPicks: {
                ...session.metrics.cardPicks,
                [cardId]: session.metrics.cardPicks[cardId] + 1,
            },
        },
    };
};

export interface WagerAnswerInput {
    correct: boolean;
    elapsedMs: number;
}

/**
 * 1問ぶんの結果を反映する。
 *
 * 誤答は減点せず、run も進めない。同じ問題へ戻すのは呼び出し側の責務であり、
 * ここでは倍率が伸びなくなることだけを記録する。
 */
export const submitWagerAnswer = (
    session: WagerSession,
    input: WagerAnswerInput,
): WagerSession => {
    const { run } = session;
    if (run.status !== "solving" || run.pickedCardId === null) return session;

    const metricsBase = {
        ...session.metrics,
        totalWrong: session.metrics.totalWrong + (input.correct ? 0 : 1),
    };

    if (!input.correct) {
        return {
            ...session,
            run: {
                ...run,
                currentWrongCount: run.currentWrongCount + 1,
                cardWrongCount: run.cardWrongCount + 1,
                cardElapsedMs: run.cardElapsedMs + input.elapsedMs,
            },
            metrics: metricsBase,
        };
    }

    const card = resolveWagerCard(run.pickedCardId, run.tools);
    const speedMultiplier = getWagerSpeedMultiplier(input.elapsedMs, run.tools);
    const missed = run.currentWrongCount > 0;
    const canGuard = missed && run.tools.includes("guard") && !run.guardUsed;
    const multiplier = missed && !canGuard ? 1 : speedMultiplier;
    const points = card.basePoints * multiplier;

    const solvedProblems = session.metrics.totalProblems + 1;
    const totalMs = (session.metrics.averageAnswerMs ?? 0)
        * session.metrics.totalProblems
        + input.elapsedMs;

    const nextRemaining = run.remainingProblems - 1;
    const cardPoints = run.cardPoints + points;
    const cardElapsedMs = run.cardElapsedMs + input.elapsedMs;

    const award: WagerAward = {
        id: `${run.seed}:award:${run.roundIndex}:${nextRemaining}`,
        points,
        multiplier,
        basePoints: card.basePoints,
        guarded: canGuard,
    };

    const metrics: WagerMetrics = {
        ...metricsBase,
        totalProblems: solvedProblems,
        averageAnswerMs: totalMs / solvedProblems,
    };

    const solvingRun: WagerRun = {
        ...run,
        remainingProblems: nextRemaining,
        currentWrongCount: 0,
        cardPoints,
        cardElapsedMs,
        guardUsed: run.guardUsed || canGuard,
        lastAward: award,
    };

    if (nextRemaining > 0) {
        return { ...session, run: solvingRun, metrics };
    }

    return { ...session, run: settleRound(solvingRun), metrics: settleMetrics(solvingRun, metrics) };
};

const settleRound = (run: WagerRun): WagerRun => {
    if (run.pickedCardId === null) return run;

    const record: WagerRoundRecord = {
        roundIndex: run.roundIndex,
        cardId: run.pickedCardId,
        points: run.cardPoints,
        wrongCount: run.cardWrongCount,
        elapsedMs: run.cardElapsedMs,
    };
    const score = run.score + run.cardPoints;
    const history = [...run.history, record];
    const nextRoundIndex = run.roundIndex + 1;
    const isLastRound = nextRoundIndex >= WAGER_ROUND_COUNT;

    return {
        ...run,
        status: isLastRound ? "carrying" : "tooling",
        score,
        history,
        roundIndex: nextRoundIndex,
        pickedCardId: null,
        remainingProblems: 0,
        // 札の集計は score へ畳んだので、ここで必ず0へ戻す。
        // 残すと HUD の「確定 + 進行中」が二重に加算される。
        cardPoints: 0,
        cardWrongCount: 0,
        cardElapsedMs: 0,
        cleared: score >= run.targetScore,
        offer: rollOffer(run.seed, nextRoundIndex, run.tools),
    };
};

/** settleRound と同じ合計を使う。呼び出し側は settle 前の run を渡す。 */
const settleMetrics = (run: WagerRun, metrics: WagerMetrics): WagerMetrics => {
    const score = run.score + run.cardPoints;
    return { ...metrics, bestScore: Math.max(metrics.bestScore, score) };
};

/** run 途中の3択。選ぶと次の札選びへ戻る。 */
export const pickWagerTool = (
    session: WagerSession,
    toolId: WagerToolId,
): WagerSession => {
    const { run } = session;
    if (run.status !== "tooling") return session;
    if (!run.offer.includes(toolId)) return session;

    return {
        ...session,
        run: {
            ...run,
            status: "choosing",
            tools: run.tools.includes(toolId) ? run.tools : [...run.tools, toolId],
            offer: [],
            lastAward: null,
        },
    };
};

/** run 終了時の持ち帰り3択。選ぶと次の run の開始装備になる。 */
export const carryWagerTool = (
    session: WagerSession,
    toolId: WagerToolId,
): WagerSession => {
    const { run } = session;
    if (run.status !== "carrying") return session;
    if (!run.offer.includes(toolId)) return session;

    return {
        ...session,
        carriedTools: session.carriedTools.includes(toolId)
            ? session.carriedTools
            : [...session.carriedTools, toolId],
        run: { ...run, status: "over", offer: [] },
        metrics: {
            ...session.metrics,
            runs: session.metrics.runs + 1,
            clears: session.metrics.clears + (run.cleared ? 1 : 0),
        },
    };
};

/** 子どもが自分で押した「もういちど」だけを replayStarts に数える。 */
export const replayWagerSession = (session: WagerSession): WagerSession => {
    if (session.run.status !== "over") return session;

    const runCounter = session.runCounter + 1;
    const [seedRoot] = session.run.seed.split(":run-");

    return {
        ...session,
        runCounter,
        run: createRun(
            `${seedRoot}:run-${runCounter}`,
            session.run.baseLevel,
            session.carriedTools,
            // 届いた run のあとだけ目標を上げる。届かなかった子を置いていかない。
            session.run.cleared ? session.run.ante + 1 : session.run.ante,
        ),
        metrics: {
            ...session.metrics,
            replayStarts: session.metrics.replayStarts + 1,
        },
    };
};

/** 難易度帯を変えるときは持ち越しごとやり直す。比較を混ぜないため。 */
export const switchWagerBaseLevel = (
    session: WagerSession,
    baseLevel: number,
): WagerSession => {
    const [seedRoot] = session.run.seed.split(":run-");
    const runCounter = session.runCounter + 1;
    return {
        ...session,
        runCounter,
        run: createRun(
            `${seedRoot}:run-${runCounter}`,
            baseLevel,
            session.carriedTools,
            session.run.ante,
        ),
    };
};

export const getWagerScoreRatio = (run: WagerRun): number => (
    run.targetScore <= 0 ? 1 : Math.min(1, run.score / run.targetScore)
);
