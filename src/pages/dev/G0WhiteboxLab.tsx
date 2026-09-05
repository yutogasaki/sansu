import React, {
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useRef,
    useState,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { G0WhiteboxStage } from "../../components/dev/g0/G0WhiteboxStage";
import {
    G0_ACTIONS_PER_RUN,
    G0_PROTOTYPE_IDS,
    G0_PROTOTYPES,
    createInitialG0LabState,
    getG0PrototypeMetrics,
    getG0Targets,
    getNextG0PrototypeId,
    reduceG0LabState,
    type G0PrototypeId,
    type G0TargetId,
} from "../../domain/explore/g0Whitebox";
import "./G0WhiteboxLab.css";

const DEFAULT_SESSION_SEED = "g0-whitebox-v2";
const REACTION_DURATION_MS = 360;

const isG0PrototypeId = (value: string | null): value is G0PrototypeId => (
    value !== null && G0_PROTOTYPE_IDS.some((prototypeId) => prototypeId === value)
);

const formatDuration = (durationMs: number | null): string => {
    if (durationMs === null) return "—";
    return `${(durationMs / 1000).toFixed(1)}秒`;
};

type LabTone = "impact" | "payoff";

export const G0WhiteboxLab: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const requestedVariant = searchParams.get("variant");
    const initialPrototype = isG0PrototypeId(requestedVariant)
        ? requestedVariant
        : "chain-excavation";
    const participantMode = searchParams.get("mode") === "participant";
    const forceReducedMotion = searchParams.get("motion") === "reduce";
    const sessionSeed = searchParams.get("seed")?.trim() || DEFAULT_SESSION_SEED;
    const [state, dispatch] = useReducer(
        reduceG0LabState,
        undefined,
        () => createInitialG0LabState(initialPrototype, sessionSeed),
    );
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(() => (
        forceReducedMotion || (typeof window !== "undefined"
            ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
            : false)
    ));
    const audioContextRef = useRef<AudioContext | null>(null);
    const actionCounterRef = useRef(0);
    const reactionTimersRef = useRef(new Map<string, number>());
    const announcedPayoffsRef = useRef(new Set<string>());

    const activePrototypeId = state.activePrototypeId;
    const prototype = G0_PROTOTYPES[activePrototypeId];
    const prototypeState = state.prototypes[activePrototypeId];
    const targets = useMemo(
        () => getG0Targets(state, activePrototypeId),
        [activePrototypeId, state],
    );
    const metrics = useMemo(
        () => getG0PrototypeMetrics(prototypeState),
        [prototypeState],
    );
    const promptIndex = Math.min(prototypeState.turn, G0_ACTIONS_PER_RUN - 1);
    const prompt = prototype.promptByTurn[promptIndex];

    useEffect(() => {
        document.body.classList.add("app-mode-fullscreen");
        return () => {
            document.body.classList.remove("app-mode-fullscreen");
        };
    }, []);

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
        const timers = reactionTimersRef.current;
        const activeReactionIds = new Set(
            G0_PROTOTYPE_IDS.flatMap((prototypeId) => {
                const reactionId = state.prototypes[prototypeId].activeReactionId;
                return reactionId ? [reactionId] : [];
            }),
        );

        for (const [reactionId, timeoutId] of timers) {
            if (!activeReactionIds.has(reactionId)) {
                window.clearTimeout(timeoutId);
                timers.delete(reactionId);
            }
        }

        for (const prototypeId of G0_PROTOTYPE_IDS) {
            const candidate = state.prototypes[prototypeId];
            const reactionId = candidate.activeReactionId;
            if (candidate.phase !== "reacting" || !reactionId || timers.has(reactionId)) {
                continue;
            }

            const timeoutId = window.setTimeout(() => {
                reactionTimersRef.current.delete(reactionId);
                dispatch({
                    type: "REACTION_FINISHED",
                    prototypeId,
                    reactionId,
                    atMs: performance.now(),
                });
            }, REACTION_DURATION_MS);
            timers.set(reactionId, timeoutId);
        }
    }, [state.prototypes]);

    useEffect(() => () => {
        for (const timeoutId of reactionTimersRef.current.values()) {
            window.clearTimeout(timeoutId);
        }
        reactionTimersRef.current.clear();

        const audioContext = audioContextRef.current;
        if (audioContext && audioContext.state !== "closed") {
            void audioContext.close();
        }
    }, []);

    const playTone = useCallback((tone: LabTone, turn = 0) => {
        if (!soundEnabled) return;

        const context = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = context;
        if (context.state === "suspended") {
            void context.resume();
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const frequency = tone === "payoff" ? 610 : 170 + turn * 78;
        const duration = tone === "payoff" ? 0.18 : 0.08;

        oscillator.type = tone === "impact" ? "square" : "sine";
        oscillator.frequency.setValueAtTime(frequency, context.currentTime);
        gain.gain.setValueAtTime(0.0001, context.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
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
        for (const prototypeId of G0_PROTOTYPE_IDS) {
            const candidate = state.prototypes[prototypeId];
            if (candidate.phase !== "payoff" || !candidate.outcome) continue;

            const payoffKey = `${prototypeId}:${candidate.runId}:${candidate.outcome.id}`;
            if (announcedPayoffsRef.current.has(payoffKey)) continue;
            announcedPayoffsRef.current.add(payoffKey);
            playTone("payoff");
        }
    }, [playTone, state.prototypes]);

    const handleSwitchPrototype = useCallback((prototypeId: G0PrototypeId) => {
        dispatch({
            type: "SWITCH_PROTOTYPE",
            prototypeId,
        });
    }, []);

    const handleTargetTap = useCallback((targetId: G0TargetId) => {
        if (
            prototypeState.phase === "payoff"
            || prototypeState.queuedAction !== null
        ) {
            return;
        }

        actionCounterRef.current += 1;
        const nextTurn = Math.min(
            G0_ACTIONS_PER_RUN,
            prototypeState.turn + 1,
        );
        playTone("impact", nextTurn);
        dispatch({
            type: "WORLD_TARGET_TAPPED",
            prototypeId: activePrototypeId,
            targetId,
            clientActionId: `${prototypeState.runId}:tap-${actionCounterRef.current}`,
            atMs: performance.now(),
        });
    }, [
        activePrototypeId,
        playTone,
        prototypeState.phase,
        prototypeState.queuedAction,
        prototypeState.runId,
        prototypeState.turn,
    ]);

    const handleReplay = useCallback(() => {
        dispatch({
            type: "REPLAY",
            prototypeId: activePrototypeId,
        });
    }, [activePrototypeId]);

    return (
        <div
            className={[
                "g0-lab",
                participantMode ? "g0-lab--participant" : "",
            ].filter(Boolean).join(" ")}
            data-testid="g0-whitebox-lab"
            data-prototype-id={activePrototypeId}
            data-phase={prototypeState.phase}
            data-lab-mode={participantMode ? "participant" : "evaluator"}
            data-reduced-motion={reducedMotion ? "true" : "false"}
        >
            {!participantMode && (
                <>
                    <header className="g0-lab-header">
                        <button
                            type="button"
                            className="g0-lab-icon-button"
                            aria-label="G0ラボを とじる"
                            onClick={() => navigate("/")}
                        >
                            ←
                        </button>
                        <div className="g0-lab-heading">
                            <span>DEV G0 · かんせい絵なし</span>
                            <h1>3タップ ゲーム実験</h1>
                        </div>
                        <button
                            type="button"
                            className="g0-lab-icon-button"
                            aria-label={soundEnabled ? "実験音を けす" : "実験音を だす"}
                            aria-pressed={soundEnabled}
                            onClick={() => setSoundEnabled((enabled) => !enabled)}
                        >
                            {soundEnabled ? "♪" : "×♪"}
                        </button>
                    </header>

                    <nav className="g0-lab-tabs" aria-label="G0 しさくを えらぶ">
                        {G0_PROTOTYPE_IDS.map((prototypeId, index) => {
                            const tabPrototype = G0_PROTOTYPES[prototypeId];
                            return (
                                <button
                                    key={prototypeId}
                                    type="button"
                                    aria-pressed={prototypeId === activePrototypeId}
                                    onClick={() => handleSwitchPrototype(prototypeId)}
                                >
                                    <span>{index + 1}</span>
                                    {tabPrototype.shortLabel}
                                </button>
                            );
                        })}
                    </nav>
                </>
            )}

            <main className="g0-lab-main">
                <section
                    className="g0-lab-stage-shell"
                    aria-labelledby={participantMode ? undefined : "g0-lab-title"}
                    aria-label={participantMode ? "3タップ ゲーム実験" : undefined}
                >
                    {!participantMode && (
                        <div className="g0-lab-stage-heading">
                            <div>
                                <p>{prototype.hypothesis}</p>
                                <h2 id="g0-lab-title">{prototype.title}</h2>
                            </div>
                            <div
                                className="g0-lab-turns"
                                aria-label={`${prototypeState.turn}かい うごかした`}
                            >
                                {Array.from({ length: G0_ACTIONS_PER_RUN }, (_, index) => (
                                    <span
                                        key={index}
                                        data-filled={index < prototypeState.turn}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    <G0WhiteboxStage
                        prototypeId={activePrototypeId}
                        phase={prototypeState.phase}
                        turn={prototypeState.turn}
                        history={prototypeState.history}
                        targets={targets}
                        outcome={prototypeState.outcome}
                        queuedTargetId={prototypeState.queuedAction?.targetId ?? null}
                        activeReactionId={prototypeState.activeReactionId}
                        onTargetTap={handleTargetTap}
                        reducedMotion={reducedMotion}
                    />
                </section>

                {!participantMode && (
                    <section className="g0-lab-action-dock" aria-label="G0 そうさ">
                        {prototypeState.phase !== "payoff" && (
                            <>
                                <p className="g0-lab-prompt">{prompt}</p>
                                <p className="g0-lab-hint">
                                    {prototypeState.queuedAction
                                        ? "つぎの一手を うけつけた！"
                                        : "舞台の どちらかを 直接タップ"}
                                </p>
                            </>
                        )}

                        {prototypeState.phase === "payoff" && prototypeState.outcome && (
                            <div className="g0-lab-payoff-actions">
                                <div>
                                    <strong>{prototypeState.outcome.title}</strong>
                                    <p>{prototypeState.outcome.detail}</p>
                                </div>
                                <button
                                    type="button"
                                    className="g0-lab-action-button"
                                    data-testid="g0-replay"
                                    autoFocus
                                    onClick={handleReplay}
                                >
                                    もう一回
                                </button>
                                <button
                                    type="button"
                                    className="g0-lab-next-button"
                                    onClick={() => handleSwitchPrototype(
                                        getNextG0PrototypeId(activePrototypeId),
                                    )}
                                >
                                    つぎの しさく
                                </button>
                            </div>
                        )}
                    </section>
                )}

                {participantMode && prototypeState.phase === "payoff" && (
                    <section
                        className="g0-lab-participant-replay"
                        aria-label="もう一度ためす"
                    >
                        <button
                            type="button"
                            data-testid="g0-replay"
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
                <details className="g0-lab-metrics">
                    <summary>けいそくを見る</summary>
                    <dl>
                        <div><dt>完走</dt><dd>{metrics.completedRuns}回</dd></div>
                        <div><dt>自発リプレイ</dt><dd>{metrics.replayStarts}回</dd></div>
                        <div>
                            <dt>別の初手</dt>
                            <dd>{metrics.triedDifferentFirstTargets ? "試した" : "まだ"}</dd>
                        </div>
                        <div><dt>平均</dt><dd>{formatDuration(metrics.averageDurationMs)}</dd></div>
                    </dl>
                    <button
                        type="button"
                        onClick={() => dispatch({
                            type: "RESET_PROTOTYPE",
                            prototypeId: activePrototypeId,
                        })}
                    >
                        この試作の記録をリセット
                    </button>
                </details>
            )}
        </div>
    );
};

export default G0WhiteboxLab;
