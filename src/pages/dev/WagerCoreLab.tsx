import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ExploreAnswerPad } from "../../components/explore/ExploreAnswerPad";
import {
    WAGER_CARD_IDS,
    WAGER_EXPERIMENT_ID,
    WAGER_ROUND_COUNT,
    WAGER_TOOLS,
    carryWagerTool,
    createWagerSession,
    getWagerCardBestPoints,
    getWagerScoreRatio,
    pickWagerCard,
    pickWagerTool,
    replayWagerSession,
    resolveWagerCard,
    submitWagerAnswer,
    switchWagerBaseLevel,
    type WagerCardId,
    type WagerToolId,
} from "../../domain/explore/wagerRun";
import { createWagerProblem } from "../../domain/explore/wagerProblemSource";
import "./WagerCoreLab.css";

const DEFAULT_SEED = WAGER_EXPERIMENT_ID;
const DEFAULT_BASE_LEVEL = 9;

/** ラボで切り替えられる難易度帯。実際の出題は近いレベルへ寄ることがある。 */
const LEVEL_PRESETS: { level: number; label: string; hint: string }[] = [
    { level: 3, label: "かず", hint: "10までの かず" },
    { level: 9, label: "たしざん", hint: "くりあがりの あるたしざん" },
    { level: 11, label: "2けた", hint: "2けたの たしひき" },
    { level: 14, label: "かけざん", hint: "九九" },
    { level: 19, label: "しょうすう", hint: "小数の たしひき" },
];

const CARD_TONE: Record<WagerCardId, string> = {
    easy: "var(--brand-leaf)",
    normal: "var(--brand-sky)",
    hard: "var(--brand-coral)",
};

export const WagerCoreLab = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const participantMode = searchParams.get("mode") === "participant";
    const seed = searchParams.get("seed")?.trim() || DEFAULT_SEED;
    const requestedLevel = Number.parseInt(searchParams.get("level") ?? "", 10);
    const initialLevel = Number.isFinite(requestedLevel)
        ? requestedLevel
        : DEFAULT_BASE_LEVEL;

    const [session, setSession] = useState(
        () => createWagerSession(seed, initialLevel),
    );
    const [answer, setAnswer] = useState("");
    const [wobble, setWobble] = useState(false);

    const { run } = session;
    const startedAtRef = useRef<number>(0);

    const problemPlan = useMemo(() => {
        if (run.status !== "solving" || run.pickedCardId === null) return null;
        const card = resolveWagerCard(run.pickedCardId, run.tools);
        const solvedIndex = card.problemCount - run.remainingProblems;
        return createWagerProblem(
            run.seed,
            run.baseLevel + card.levelOffset,
            `r${run.roundIndex}-${run.pickedCardId}-p${solvedIndex}`,
        );
    }, [
        run.baseLevel,
        run.pickedCardId,
        run.remainingProblems,
        run.roundIndex,
        run.seed,
        run.status,
        run.tools,
    ]);

    useEffect(() => {
        document.body.classList.add("app-mode-fullscreen");
        return () => document.body.classList.remove("app-mode-fullscreen");
    }, []);

    useEffect(() => {
        if (!problemPlan) return;
        startedAtRef.current = performance.now();
        setAnswer("");
    }, [problemPlan]);

    const handleSubmit = useCallback(() => {
        if (!problemPlan || answer.length === 0) return;

        const correct = answer === problemPlan.problem.correctAnswer;
        const elapsedMs = performance.now() - startedAtRef.current;

        if (!correct) {
            setWobble(true);
            window.setTimeout(() => setWobble(false), 320);
            setAnswer("");
            startedAtRef.current = performance.now();
        }

        setSession((current) => submitWagerAnswer(current, { correct, elapsedMs }));
    }, [answer, problemPlan]);

    const handlePickCard = useCallback((cardId: WagerCardId) => {
        setSession((current) => pickWagerCard(current, cardId));
    }, []);

    const handlePickTool = useCallback((toolId: WagerToolId) => {
        setSession((current) => pickWagerTool(current, toolId));
    }, []);

    const handleCarry = useCallback((toolId: WagerToolId) => {
        setSession((current) => carryWagerTool(current, toolId));
    }, []);

    const handleReplay = useCallback(() => {
        setSession((current) => replayWagerSession(current));
    }, []);

    const handleSelectLevel = useCallback((level: number) => {
        setSession((current) => switchWagerBaseLevel(current, level));
        const next = new URLSearchParams(searchParams);
        next.set("level", String(level));
        setSearchParams(next);
    }, [searchParams, setSearchParams]);

    const scoreRatio = getWagerScoreRatio(run);
    const liveScore = run.score + run.cardPoints;
    const liveRatio = Math.min(1, liveScore / run.targetScore);
    const { metrics } = session;
    const totalPicks = WAGER_CARD_IDS
        .reduce((sum, id) => sum + metrics.cardPicks[id], 0);

    return (
        <div
            className={[
                "wager-lab",
                participantMode ? "wager-lab--participant" : "",
            ].filter(Boolean).join(" ")}
            data-testid="wager-core-lab"
            data-experiment-id={WAGER_EXPERIMENT_ID}
            data-run-status={run.status}
            data-base-level={run.baseLevel}
            data-lab-mode={participantMode ? "participant" : "evaluator"}
        >
            {!participantMode && (
                <>
                    <header className="wager-header">
                        <button
                            type="button"
                            className="wager-icon-button"
                            aria-label="ラボを とじる"
                            onClick={() => navigate("/")}
                        >
                            ←
                        </button>
                        <div className="wager-heading">
                            <span>DEV · {WAGER_EXPERIMENT_ID}</span>
                            <h1>かけ探検</h1>
                        </div>
                        <span className="wager-icon-spacer" aria-hidden="true" />
                    </header>

                    <nav className="wager-tabs" aria-label="むずかしさの たいを えらぶ">
                        {LEVEL_PRESETS.map((preset) => (
                            <button
                                key={preset.level}
                                type="button"
                                data-testid={`wager-level-${preset.level}`}
                                aria-pressed={preset.level === run.baseLevel}
                                onClick={() => handleSelectLevel(preset.level)}
                            >
                                <strong>{preset.label}</strong>
                                <small>Lv{preset.level}</small>
                            </button>
                        ))}
                    </nav>
                </>
            )}

            <main className="wager-main">
                <section className="wager-hud" aria-label="いまの とくてん">
                    <span className="wager-ante" data-testid="wager-ante">
                        {run.ante}
                    </span>
                    <div className="wager-gauge">
                        <div
                            className="wager-gauge__fill"
                            style={{ width: `${liveRatio * 100}%` }}
                        />
                        <div
                            className="wager-gauge__committed"
                            style={{ width: `${scoreRatio * 100}%` }}
                        />
                        <span className="wager-gauge__label">
                            <strong data-testid="wager-score">{liveScore}</strong>
                            <small>/ {run.targetScore}</small>
                        </span>
                    </div>
                    <ol className="wager-pips" aria-label="のこりの かい">
                        {Array.from({ length: WAGER_ROUND_COUNT }, (_, index) => (
                            <li
                                key={index}
                                data-done={index < run.roundIndex ? "true" : "false"}
                                data-current={index === run.roundIndex ? "true" : "false"}
                            >
                                <span className="wager-visually-hidden">
                                    {index + 1}かいめ
                                </span>
                            </li>
                        ))}
                    </ol>
                </section>

                {run.tools.length > 0 && (
                    <section className="wager-shelf" aria-label="もっている どうぐ">
                        {run.tools.map((toolId) => (
                            <span key={toolId} className="wager-shelf__item">
                                <b aria-hidden="true">{WAGER_TOOLS[toolId].glyph}</b>
                                {WAGER_TOOLS[toolId].label}
                            </span>
                        ))}
                    </section>
                )}

                {run.status === "choosing" && (
                    <section className="wager-choice" data-testid="wager-card-choice">
                        <p className="wager-choice__lead">どれを やる？</p>
                        <div className="wager-card-row">
                            {WAGER_CARD_IDS.map((cardId) => {
                                const card = resolveWagerCard(cardId, run.tools);
                                const best = getWagerCardBestPoints(cardId, run.tools);
                                return (
                                    <button
                                        key={cardId}
                                        type="button"
                                        className="wager-card"
                                        data-testid={`wager-card-${cardId}`}
                                        style={{ "--wager-card-tone": CARD_TONE[cardId] } as React.CSSProperties}
                                        onClick={() => handlePickCard(cardId)}
                                    >
                                        <span className="wager-card__glyph" aria-hidden="true">
                                            {card.glyph}
                                        </span>
                                        <strong className="wager-card__label">
                                            {card.label}
                                        </strong>
                                        <span className="wager-card__count">
                                            {card.problemCount}もん
                                        </span>
                                        <span className="wager-card__points">
                                            {best}
                                            <small>てん</small>
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    </section>
                )}

                {run.status === "solving" && problemPlan && run.pickedCardId && (
                    <section className="wager-solve" data-testid="wager-solve">
                        <div className="wager-solve__meta">
                            <span
                                className="wager-chip"
                                style={{ background: CARD_TONE[run.pickedCardId] }}
                            >
                                {resolveWagerCard(run.pickedCardId, run.tools).label}
                            </span>
                            <span className="wager-solve__remaining">
                                のこり {run.remainingProblems}もん
                            </span>
                            {run.lastAward && (
                                <span
                                    className="wager-award"
                                    key={run.lastAward.id}
                                    data-testid="wager-award"
                                >
                                    +{run.lastAward.points}
                                    <small>×{run.lastAward.multiplier}</small>
                                </span>
                            )}
                        </div>

                        <p
                            className={[
                                "wager-question",
                                wobble ? "wager-question--wobble" : "",
                            ].filter(Boolean).join(" ")}
                            data-testid="wager-question"
                        >
                            {problemPlan.problem.questionText}
                        </p>
                        <p className="wager-answer" data-testid="wager-answer">
                            {answer || "　"}
                        </p>

                        <ExploreAnswerPad
                            problem={problemPlan.problem}
                            answer={answer}
                            disabled={false}
                            className="wager-pad"
                            onAnswerChange={setAnswer}
                            onSubmit={handleSubmit}
                        />
                    </section>
                )}

                {run.status === "tooling" && (
                    <section className="wager-choice" data-testid="wager-tool-choice">
                        <p className="wager-choice__lead">ひとつ もらう</p>
                        <div className="wager-tool-row">
                            {run.offer.map((toolId, index) => (
                                <button
                                    key={toolId}
                                    type="button"
                                    className="wager-tool"
                                    data-testid={`wager-tool-${toolId}`}
                                    autoFocus={index === 0}
                                    onClick={() => handlePickTool(toolId)}
                                >
                                    <span aria-hidden="true">{WAGER_TOOLS[toolId].glyph}</span>
                                    <strong>{WAGER_TOOLS[toolId].label}</strong>
                                    <small>{WAGER_TOOLS[toolId].detail}</small>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {run.status === "carrying" && (
                    <section className="wager-choice" data-testid="wager-carry-choice">
                        <p className="wager-choice__lead" data-testid="wager-result">
                            {run.cleared
                                ? `${run.score}てん。とどいた。`
                                : `${run.score}てん。あと ${run.targetScore - run.score}。`}
                        </p>
                        <p className="wager-choice__sub">つぎに もっていく ひとつ</p>
                        <div className="wager-tool-row">
                            {run.offer.map((toolId, index) => (
                                <button
                                    key={toolId}
                                    type="button"
                                    className="wager-tool"
                                    data-testid={`wager-carry-${toolId}`}
                                    autoFocus={index === 0}
                                    onClick={() => handleCarry(toolId)}
                                >
                                    <span aria-hidden="true">{WAGER_TOOLS[toolId].glyph}</span>
                                    <strong>{WAGER_TOOLS[toolId].label}</strong>
                                    <small>{WAGER_TOOLS[toolId].detail}</small>
                                </button>
                            ))}
                        </div>
                    </section>
                )}

                {run.status === "over" && (
                    <section className="wager-over" data-testid="wager-over">
                        <p className="wager-over__score">{run.score}</p>
                        <button
                            type="button"
                            className="wager-replay"
                            data-testid="wager-replay"
                            aria-label="もういちど"
                            autoFocus
                            onClick={handleReplay}
                        >
                            ↻
                        </button>
                    </section>
                )}
            </main>

            {!participantMode && (
                <details className="wager-metrics">
                    <summary>診断記録を見る</summary>
                    <p>
                        これは試験器が動く証拠であり、楽しさのPASSやproduction採用の証拠ではない。
                        判定は子どもの自発リプレイと札の選び方で行う。
                    </p>
                    <p className="wager-metrics__hint">
                        planner / SRS へは接続していない。難易度はレベル帯だけで表現しており、
                        Due・weak の混ぜ方は G1 の課題。
                        {problemPlan && (
                            <>
                                {" "}いまの skill: <code>{problemPlan.skillId}</code>
                            </>
                        )}
                    </p>
                    <dl>
                        <div>
                            <dt>やさしいを 選んだ</dt>
                            <dd data-testid="wager-pick-easy">
                                {metrics.cardPicks.easy}回
                                {totalPicks > 0
                                    && ` (${Math.round(metrics.cardPicks.easy / totalPicks * 100)}%)`}
                            </dd>
                        </div>
                        <div>
                            <dt>ふつうを 選んだ</dt>
                            <dd>{metrics.cardPicks.normal}回</dd>
                        </div>
                        <div>
                            <dt>むずかしいを 選んだ</dt>
                            <dd data-testid="wager-pick-hard">{metrics.cardPicks.hard}回</dd>
                        </div>
                        <div><dt>完走</dt><dd>{metrics.runs}回</dd></div>
                        <div><dt>目標到達</dt><dd>{metrics.clears}回</dd></div>
                        <div>
                            <dt>自発リプレイ</dt>
                            <dd data-testid="wager-replay-count">{metrics.replayStarts}回</dd>
                        </div>
                        <div><dt>解いた問題</dt><dd>{metrics.totalProblems}問</dd></div>
                        <div><dt>誤答</dt><dd>{metrics.totalWrong}回</dd></div>
                        <div>
                            <dt>平均解答時間</dt>
                            <dd>
                                {metrics.averageAnswerMs === null
                                    ? "—"
                                    : `${(metrics.averageAnswerMs / 1000).toFixed(1)}秒`}
                            </dd>
                        </div>
                        <div><dt>最高スコア</dt><dd>{metrics.bestScore}</dd></div>
                    </dl>
                </details>
            )}
        </div>
    );
};

export default WagerCoreLab;
