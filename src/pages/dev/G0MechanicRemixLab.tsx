import {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { G0MechanicRemixStage } from "../../components/dev/g0v2/G0MechanicRemixStage";
import {
    G0_CHAIN_MAX_ACTIONS,
    createG0ChainShotState,
    reduceG0ChainShotState,
    type G0ChainShotTargetId,
} from "../../domain/explore/g0ChainShot";
import { getG0MechanicMetrics } from "../../domain/explore/g0MechanicMetrics";
import {
    G0_MECHANIC_EXPERIMENT_ID,
    G0_MECHANIC_PROTOTYPE_IDS,
    G0_MECHANIC_PROTOTYPES,
    getNextG0MechanicPrototypeId,
    isG0MechanicPrototypeId,
    type G0MechanicPrototypeId,
} from "../../domain/explore/g0MechanicRemix";
import {
    G0_NUMBER_VESSEL_MAX_ACTIONS,
    createG0NumberVesselState,
    reduceG0NumberVesselState,
} from "../../domain/explore/g0NumberVessel";
import type { G0MechanicPhase } from "../../domain/explore/g0MechanicTypes";
import "./G0MechanicRemixLab.css";

const DEFAULT_SESSION_SEED = "g0-mechanic-remix-v2";

type LabTone = "select" | "impact" | "payoff";

const formatDuration = (durationMs: number | null): string => {
    if (durationMs === null) return "—";
    return `${(durationMs / 1000).toFixed(1)}秒`;
};

const formatAverageActions = (actionCount: number | null): string => (
    actionCount === null ? "—" : `${actionCount.toFixed(1)}手`
);

export const G0MechanicRemixLab = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const requestedVariant = searchParams.get("variant");
    const participantMode = searchParams.get("mode") === "participant";
    const forceReducedMotion = searchParams.get("motion") === "reduce";
    const reverseOrder = searchParams.get("order") === "ba";
    const sessionSeed = searchParams.get("seed")?.trim() || DEFAULT_SESSION_SEED;
    const displayOrder = useMemo<readonly G0MechanicPrototypeId[]>(
        () => reverseOrder
            ? ["number-vessel", "chain-shot"]
            : G0_MECHANIC_PROTOTYPE_IDS,
        [reverseOrder],
    );
    const initialPrototypeId = isG0MechanicPrototypeId(requestedVariant)
        ? requestedVariant
        : displayOrder[0];
    const [activePrototypeId, setActivePrototypeId] = useState(
        initialPrototypeId,
    );
    const [invalidVariant, setInvalidVariant] = useState<string | null>(
        requestedVariant !== null && !isG0MechanicPrototypeId(requestedVariant)
            ? requestedVariant
            : null,
    );
    const [chainState, dispatchChain] = useReducer(
        reduceG0ChainShotState,
        sessionSeed,
        createG0ChainShotState,
    );
    const [numberState, dispatchNumber] = useReducer(
        reduceG0NumberVesselState,
        sessionSeed,
        createG0NumberVesselState,
    );
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(() => (
        forceReducedMotion || (typeof window !== "undefined"
            ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
            : false)
    ));
    const audioContextRef = useRef<AudioContext | null>(null);
    const actionCounterRef = useRef(0);
    const announcedPayoffsRef = useRef(new Set<string>());
    const labScrollRef = useRef<HTMLDivElement | null>(null);

    const activeDefinition = G0_MECHANIC_PROTOTYPES[activePrototypeId];
    const activeState = activePrototypeId === "chain-shot"
        ? chainState
        : numberState;
    const activeMetrics = useMemo(
        () => getG0MechanicMetrics(activeState),
        [activeState],
    );
    const activeMaxActions = activePrototypeId === "chain-shot"
        ? G0_CHAIN_MAX_ACTIONS
        : G0_NUMBER_VESSEL_MAX_ACTIONS;
    const activeOutcome = activeState.outcome;
    const activePhase: G0MechanicPhase = activeState.phase;

    useEffect(() => {
        document.body.classList.add("app-mode-fullscreen");
        return () => document.body.classList.remove("app-mode-fullscreen");
    }, []);

    useEffect(() => {
        labScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }, [activePrototypeId]);

    useEffect(() => {
        if (requestedVariant === null) return;
        if (isG0MechanicPrototypeId(requestedVariant)) {
            setInvalidVariant(null);
            setActivePrototypeId(requestedVariant);
            return;
        }
        setInvalidVariant(requestedVariant);
    }, [requestedVariant]);

    useEffect(() => {
        if (forceReducedMotion) {
            setReducedMotion(true);
            return;
        }

        const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        if (!mediaQuery) return;

        const handleChange = (event: MediaQueryListEvent) => {
            setReducedMotion(event.matches);
        };
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
    }, [forceReducedMotion]);

    useEffect(() => {
        const reactionId = chainState.activeReactionId;
        if (chainState.phase !== "reacting" || !reactionId) return;

        const timeoutId = window.setTimeout(() => {
            dispatchChain({
                type: "REACTION_FINISHED",
                reactionId,
                atMs: performance.now(),
            });
        }, G0_MECHANIC_PROTOTYPES["chain-shot"].reactionDurationMs);
        return () => window.clearTimeout(timeoutId);
    }, [chainState.activeReactionId, chainState.phase]);

    useEffect(() => {
        const reactionId = numberState.activeReactionId;
        if (numberState.phase !== "reacting" || !reactionId) return;

        const timeoutId = window.setTimeout(() => {
            dispatchNumber({
                type: "REACTION_FINISHED",
                reactionId,
                atMs: performance.now(),
            });
        }, G0_MECHANIC_PROTOTYPES["number-vessel"].reactionDurationMs);
        return () => window.clearTimeout(timeoutId);
    }, [numberState.activeReactionId, numberState.phase]);

    useEffect(() => () => {
        const audioContext = audioContextRef.current;
        if (audioContext && audioContext.state !== "closed") {
            void audioContext.close();
        }
    }, []);

    const playTone = useCallback((tone: LabTone, value = 0) => {
        if (!soundEnabled) return;

        const context = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = context;
        if (context.state === "suspended") {
            void context.resume();
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const frequency = tone === "payoff"
            ? 620
            : tone === "select"
                ? 250
                : 170 + value * 70;
        const duration = tone === "payoff" ? 0.18 : 0.07;

        oscillator.type = tone === "impact" ? "square" : "sine";
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.01);
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            context.currentTime + duration,
        );
        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start();
        oscillator.stop(context.currentTime + duration + 0.01);
    }, [soundEnabled]);

    useEffect(() => {
        const candidates = [
            { id: "chain-shot", state: chainState },
            { id: "number-vessel", state: numberState },
        ] as const;

        for (const candidate of candidates) {
            if (candidate.state.phase !== "payoff" || !candidate.state.outcome) {
                continue;
            }
            const payoffKey = [
                candidate.id,
                candidate.state.runId,
                candidate.state.outcome.id,
            ].join(":");
            if (announcedPayoffsRef.current.has(payoffKey)) continue;
            announcedPayoffsRef.current.add(payoffKey);
            playTone("payoff");
        }
    }, [chainState, numberState, playTone]);

    const selectPrototype = useCallback((
        prototypeId: G0MechanicPrototypeId,
    ) => {
        setInvalidVariant(null);
        setActivePrototypeId(prototypeId);
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set("variant", prototypeId);
        setSearchParams(nextSearchParams);
    }, [searchParams, setSearchParams]);

    const getClientActionId = useCallback((prefix: string): string => {
        actionCounterRef.current += 1;
        return `${prefix}:${actionCounterRef.current}`;
    }, []);

    const handleChainTargetTap = useCallback((
        targetId: G0ChainShotTargetId,
    ) => {
        if (
            activePrototypeId !== "chain-shot"
            || chainState.phase !== "await-action"
        ) {
            return;
        }
        playTone("impact", chainState.actionCount + 1);
        dispatchChain({
            type: "WORLD_TARGET_TAPPED",
            targetId,
            clientActionId: getClientActionId(chainState.runId),
            atMs: performance.now(),
        });
    }, [
        activePrototypeId,
        chainState.actionCount,
        chainState.phase,
        chainState.runId,
        getClientActionId,
        playTone,
    ]);

    const handleNumberTokenTap = useCallback((tokenId: string) => {
        if (
            activePrototypeId !== "number-vessel"
            || numberState.phase !== "await-action"
        ) {
            return;
        }

        const commitsOperation = (
            numberState.selectedTokenId !== null
            && numberState.selectedTokenId !== tokenId
        );
        playTone(
            commitsOperation ? "impact" : "select",
            numberState.actionCount + 1,
        );
        dispatchNumber({
            type: "TOKEN_TAPPED",
            tokenId,
            clientActionId: getClientActionId(numberState.runId),
            atMs: performance.now(),
        });
    }, [
        activePrototypeId,
        getClientActionId,
        numberState.actionCount,
        numberState.phase,
        numberState.runId,
        numberState.selectedTokenId,
        playTone,
    ]);

    const handleNumberSplit = useCallback(() => {
        if (
            activePrototypeId !== "number-vessel"
            || numberState.phase !== "await-action"
        ) {
            return;
        }
        playTone("impact", numberState.actionCount + 1);
        dispatchNumber({
            type: "SPLIT_SELECTED",
            clientActionId: getClientActionId(numberState.runId),
            atMs: performance.now(),
        });
    }, [
        activePrototypeId,
        getClientActionId,
        numberState.actionCount,
        numberState.phase,
        numberState.runId,
        playTone,
    ]);

    const handleReplay = useCallback(() => {
        if (activePrototypeId === "chain-shot") {
            dispatchChain({ type: "REPLAY" });
            return;
        }
        dispatchNumber({ type: "REPLAY" });
    }, [activePrototypeId]);

    if (invalidVariant !== null) {
        return (
            <div
                className="g0v2-lab g0v2-lab--invalid"
                data-testid="g0v2-invalid-variant"
                data-experiment-id={G0_MECHANIC_EXPERIMENT_ID}
            >
                <section className="g0v2-invalid-card">
                    <span>DEV G0 v2</span>
                    <h1>この候補IDは v2 では使いません</h1>
                    <p>
                        <code>{invalidVariant}</code>
                        は旧実験または未知の候補です。黙って別候補へ置き換えず、ここで停止しました。
                    </p>
                    <div>
                        {displayOrder.map((prototypeId) => (
                            <button
                                key={prototypeId}
                                type="button"
                                onClick={() => selectPrototype(prototypeId)}
                            >
                                {G0_MECHANIC_PROTOTYPES[prototypeId].candidateLabel}
                                {" · "}
                                {G0_MECHANIC_PROTOTYPES[prototypeId].title}
                            </button>
                        ))}
                    </div>
                    <button type="button" onClick={() => navigate("/__dev/g0")}>
                        旧 G0 v1 を開く
                    </button>
                </section>
            </div>
        );
    }

    return (
        <div
            ref={labScrollRef}
            className={[
                "g0v2-lab",
                participantMode ? "g0v2-lab--participant" : "",
            ].filter(Boolean).join(" ")}
            data-testid="g0-mechanic-remix-lab"
            data-experiment-id={G0_MECHANIC_EXPERIMENT_ID}
            data-prototype-id={activePrototypeId}
            data-phase={activePhase}
            data-lab-mode={participantMode ? "participant" : "evaluator"}
            data-reduced-motion={reducedMotion ? "true" : "false"}
            data-presentation-order={reverseOrder ? "ba" : "ab"}
            data-session-seed={sessionSeed}
        >
            {!participantMode && (
                <>
                    <header className="g0v2-header">
                        <button
                            type="button"
                            className="g0v2-icon-button"
                            aria-label="G0 v2ラボを とじる"
                            onClick={() => navigate("/")}
                        >
                            ←
                        </button>
                        <div className="g0v2-heading">
                            <span>DEV · {G0_MECHANIC_EXPERIMENT_ID}</span>
                            <h1>別々のゲームを比べる</h1>
                        </div>
                        <button
                            type="button"
                            className="g0v2-icon-button"
                            aria-label={soundEnabled ? "実験音を けす" : "実験音を だす"}
                            aria-pressed={soundEnabled}
                            onClick={() => setSoundEnabled((enabled) => !enabled)}
                        >
                            {soundEnabled ? "♪" : "×♪"}
                        </button>
                    </header>

                    <nav className="g0v2-tabs" aria-label="G0 v2候補をえらぶ">
                        {displayOrder.map((prototypeId) => {
                            const prototype = G0_MECHANIC_PROTOTYPES[prototypeId];
                            return (
                                <button
                                    key={prototypeId}
                                    type="button"
                                    aria-pressed={prototypeId === activePrototypeId}
                                    onClick={() => selectPrototype(prototypeId)}
                                >
                                    <span>{prototype.candidateLabel}</span>
                                    <strong>{prototype.shortLabel}</strong>
                                    <small>
                                        {prototypeId === "chain-shot"
                                            ? "一打→連鎖→持ち越し"
                                            : "合成/分解→容器圧→recipe"}
                                    </small>
                                </button>
                            );
                        })}
                    </nav>
                </>
            )}

            <main className="g0v2-main">
                <section className="g0v2-stage-shell">
                    {!participantMode && (
                        <div className="g0v2-stage-heading">
                            <div>
                                <p>{activeDefinition.hypothesis}</p>
                                <h2>{activeDefinition.title}</h2>
                            </div>
                            <div
                                className="g0v2-actions-meter"
                                aria-label={`${activeState.actionCount}/${activeMaxActions}手`}
                            >
                                {Array.from({ length: activeMaxActions }, (_, index) => (
                                    <span
                                        key={index}
                                        data-filled={index < activeState.actionCount}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <G0MechanicRemixStage
                        prototypeId={activePrototypeId}
                        chainState={chainState}
                        numberState={numberState}
                        reducedMotion={reducedMotion}
                        onChainTargetTap={handleChainTargetTap}
                        onNumberTokenTap={handleNumberTokenTap}
                        onNumberSplitSelected={handleNumberSplit}
                    />
                </section>

                {!participantMode && (
                    <section className="g0v2-action-dock" aria-label="評価者向け案内">
                        {activePhase !== "payoff" ? (
                            <>
                                <p>{activeDefinition.evaluatorPrompt}</p>
                                <small>{activeDefinition.evaluatorHint}</small>
                            </>
                        ) : activeOutcome ? (
                            <div className="g0v2-payoff-actions">
                                <div>
                                    <strong>{activeOutcome.title}</strong>
                                    <p>{activeOutcome.detail}</p>
                                </div>
                                <button
                                    type="button"
                                    data-testid="g0v2-replay"
                                    autoFocus
                                    onClick={handleReplay}
                                >
                                    もう一回
                                </button>
                                <button
                                    type="button"
                                    onClick={() => selectPrototype(
                                        getNextG0MechanicPrototypeId(
                                            activePrototypeId,
                                        ),
                                    )}
                                >
                                    もう一つのゲーム
                                </button>
                            </div>
                        ) : null}
                    </section>
                )}

                {participantMode && activePhase === "payoff" && (
                    <section className="g0v2-participant-replay">
                        <button
                            type="button"
                            data-testid="g0v2-replay"
                            aria-label="もう一度ためす"
                            autoFocus
                            onClick={handleReplay}
                        >
                            ↻
                        </button>
                    </section>
                )}
            </main>

            {!participantMode && (
                <details className="g0v2-metrics">
                    <summary>診断記録を見る</summary>
                    <p>
                        A/Bは操作文法が違うため、速さや手数だけで勝者を決めない。
                    </p>
                    <dl>
                        <div><dt>完走</dt><dd>{activeMetrics.completedRuns}回</dd></div>
                        <div><dt>自発リプレイ</dt><dd>{activeMetrics.replayStarts}回</dd></div>
                        <div>
                            <dt>別の初手</dt>
                            <dd>{activeMetrics.triedDifferentFirstActions ? "試した" : "まだ"}</dd>
                        </div>
                        <div>
                            <dt>別の戦略</dt>
                            <dd>{activeMetrics.changedStrategy ? "試した" : "まだ"}</dd>
                        </div>
                        <div>
                            <dt>目標到達</dt>
                            <dd>{activeMetrics.goalReachedRuns}回</dd>
                        </div>
                        <div>
                            <dt>回復して着地</dt>
                            <dd>{activeMetrics.recoveredRiskRuns}回</dd>
                        </div>
                        <div>
                            <dt>平均手数</dt>
                            <dd>{formatAverageActions(activeMetrics.averageActionCount)}</dd>
                        </div>
                        <div>
                            <dt>平均時間</dt>
                            <dd>{formatDuration(activeMetrics.averageDurationMs)}</dd>
                        </div>
                    </dl>
                </details>
            )}
        </div>
    );
};

export default G0MechanicRemixLab;
