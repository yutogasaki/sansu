import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { NumberSuikaStage } from "../../components/dev/suika/NumberSuikaStage";
import { getSuikaQuantityFill } from "../../components/dev/suika/suikaPalette";
import {
    G0_SUIKA_CHARMS,
    G0_SUIKA_EXPERIMENT_ID,
    G0_SUIKA_PROFILES,
    G0_SUIKA_PROFILE_IDS,
    aimG0SuikaSession,
    createG0SuikaSession,
    dropG0SuikaSession,
    getG0SuikaMetrics,
    getSuikaBallRadius,
    getSuikaPreviewLength,
    isG0SuikaProfileId,
    pickG0SuikaCharm,
    replayG0SuikaSession,
    stepG0SuikaSession,
    switchG0SuikaProfile,
    type G0SuikaCharmId,
    type G0SuikaProfileId,
} from "../../domain/explore/g0NumberSuika";
import { formatQuantity } from "../../domain/explore/suikaQuantity";
import "./NumberSuikaLab.css";

const DEFAULT_SESSION_SEED = G0_SUIKA_EXPERIMENT_ID;
const MAX_FRAME_MS = 48;

type LabTone = "drop" | "merge" | "pop";

const formatDuration = (durationMs: number | null): string => (
    durationMs === null ? "—" : `${(durationMs / 1000).toFixed(1)}秒`
);

const formatAverage = (value: number | null): string => (
    value === null ? "—" : value.toFixed(1)
);

export const NumberSuikaLab = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const participantMode = searchParams.get("mode") === "participant";
    const forceReducedMotion = searchParams.get("motion") === "reduce";
    const sessionSeed = searchParams.get("seed")?.trim() || DEFAULT_SESSION_SEED;
    const requestedProfile = searchParams.get("profile");
    const initialProfileId: G0SuikaProfileId =
        requestedProfile !== null && isG0SuikaProfileId(requestedProfile)
            ? requestedProfile
            : "tens";

    const [session, setSession] = useState(
        () => createG0SuikaSession(sessionSeed, initialProfileId),
    );
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [reducedMotion, setReducedMotion] = useState(() => (
        forceReducedMotion || (typeof window !== "undefined"
            ? window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false
            : false)
    ));

    const audioContextRef = useRef<AudioContext | null>(null);
    const announcedEventsRef = useRef(new Set<string>());

    const { run } = session;
    const profile = G0_SUIKA_PROFILES[session.profileId];
    const metrics = useMemo(() => getG0SuikaMetrics(session), [session]);
    const previewLength = getSuikaPreviewLength(session.charms);
    const previewQuantities = run.queue.slice(1, 1 + previewLength);
    const charmSelectOpen = run.status === "over"
        && session.charmOffer.length > 0;
    const targetLabel = formatQuantity(run.target, profile.display);

    useEffect(() => {
        document.body.classList.add("app-mode-fullscreen");
        return () => document.body.classList.remove("app-mode-fullscreen");
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
        let frameId = 0;
        let lastFrameMs = performance.now();

        const tick = (nowMs: number) => {
            const frameMs = Math.min(MAX_FRAME_MS, nowMs - lastFrameMs);
            lastFrameMs = nowMs;
            setSession((current) => stepG0SuikaSession(current, frameMs));
            frameId = requestAnimationFrame(tick);
        };

        frameId = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameId);
    }, []);

    useEffect(() => () => {
        const audioContext = audioContextRef.current;
        if (audioContext && audioContext.state !== "closed") {
            void audioContext.close();
        }
    }, []);

    const playTone = useCallback((tone: LabTone, ratio = 0) => {
        if (!soundEnabled) return;

        const context = audioContextRef.current ?? new AudioContext();
        audioContextRef.current = context;
        if (context.state === "suspended") {
            void context.resume();
        }

        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const frequency = tone === "pop"
            ? 660
            : tone === "drop"
                ? 210
                : 240 + ratio * 340;
        const duration = tone === "pop" ? 0.22 : 0.07;

        oscillator.type = tone === "merge" ? "triangle" : "sine";
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
        for (const event of run.events) {
            if (announcedEventsRef.current.has(event.id)) continue;
            announcedEventsRef.current.add(event.id);
            if (event.kind === "target-pop") {
                playTone("pop");
            } else if (event.kind === "merge") {
                playTone(
                    "merge",
                    (event.result.n * run.target.d)
                        / (event.result.d * run.target.n),
                );
            }
        }
    }, [playTone, run.events, run.target]);

    const handleAim = useCallback((x: number) => {
        setSession((current) => aimG0SuikaSession(current, x));
    }, []);

    const handleDrop = useCallback(() => {
        setSession((current) => {
            const next = dropG0SuikaSession(current);
            if (next !== current) playTone("drop");
            return next;
        });
    }, [playTone]);

    const handleReplay = useCallback(() => {
        setSession((current) => replayG0SuikaSession(current));
    }, []);

    const handlePickCharm = useCallback((charmId: G0SuikaCharmId) => {
        setSession((current) => pickG0SuikaCharm(current, charmId));
    }, []);

    const handleSelectProfile = useCallback((profileId: G0SuikaProfileId) => {
        setSession((current) => switchG0SuikaProfile(current, profileId));
        const nextSearchParams = new URLSearchParams(searchParams);
        nextSearchParams.set("profile", profileId);
        setSearchParams(nextSearchParams);
    }, [searchParams, setSearchParams]);

    const status = run.status === "over"
        ? `うつわが いっぱいに なった。${run.targetPopCount}こ の ${targetLabel}を つくった。`
        : run.overflowSinceMs !== null
            ? "うつわの くちに とどきそう。"
            : "";

    return (
        <div
            className={[
                "suika-lab",
                participantMode ? "suika-lab--participant" : "",
            ].filter(Boolean).join(" ")}
            data-testid="number-suika-lab"
            data-experiment-id={G0_SUIKA_EXPERIMENT_ID}
            data-profile-id={session.profileId}
            data-run-status={run.status}
            data-lab-mode={participantMode ? "participant" : "evaluator"}
            data-reduced-motion={reducedMotion ? "true" : "false"}
            data-session-seed={sessionSeed}
        >
            {!participantMode && (
                <>
                    <header className="suika-header">
                        <button
                            type="button"
                            className="suika-icon-button"
                            aria-label="ラボを とじる"
                            onClick={() => navigate("/")}
                        >
                            ←
                        </button>
                        <div className="suika-heading">
                            <span>DEV · {G0_SUIKA_EXPERIMENT_ID}</span>
                            <h1>かずのスイカ</h1>
                        </div>
                        <button
                            type="button"
                            className="suika-icon-button"
                            aria-label={soundEnabled ? "音を けす" : "音を だす"}
                            aria-pressed={soundEnabled}
                            onClick={() => setSoundEnabled((enabled) => !enabled)}
                        >
                            {soundEnabled ? "♪" : "×♪"}
                        </button>
                    </header>

                    <nav className="suika-tabs" aria-label="かずの しゅるいを えらぶ">
                        {G0_SUIKA_PROFILE_IDS.map((profileId) => (
                            <button
                                key={profileId}
                                type="button"
                                data-testid={`suika-profile-${profileId}`}
                                aria-pressed={profileId === session.profileId}
                                onClick={() => handleSelectProfile(profileId)}
                            >
                                <strong>
                                    {G0_SUIKA_PROFILES[profileId].shortLabel}
                                </strong>
                                <small>{G0_SUIKA_PROFILES[profileId].label}</small>
                            </button>
                        ))}
                    </nav>
                </>
            )}

            <main className="suika-main">
                <section className="suika-hud" aria-label="いまのスコア">
                    <div className="suika-hud__score">
                        <strong data-testid="suika-score">{run.score}</strong>
                        <small>てん</small>
                    </div>
                    <div className="suika-hud__next" aria-label="つぎの たま">
                        {previewQuantities.map((quantity, index) => {
                            const label = formatQuantity(quantity, profile.display);
                            // 玉の大小関係は保ちつつ、"1/3" や "0.3" が収まる下限を置く。
                            const size = Math.max(
                                14 + label.length * 6,
                                getSuikaBallRadius(quantity, run.target) * 2.6,
                            );
                            return (
                                <span
                                    key={`${quantity.n}/${quantity.d}-${index}`}
                                    className="suika-chip"
                                    style={{
                                        background: getSuikaQuantityFill(
                                            quantity,
                                            run.target,
                                        ),
                                        width: `${size}px`,
                                        height: `${size}px`,
                                        fontSize: `${Math.min(0.85, size / (label.length * 22))}rem`,
                                    }}
                                >
                                    {label}
                                </span>
                            );
                        })}
                    </div>
                </section>

                <div className="suika-stage-shell">
                    <NumberSuikaStage
                        run={run}
                        reducedMotion={reducedMotion}
                        interactive={run.status === "playing"}
                        onAim={handleAim}
                        onDrop={handleDrop}
                    />

                    {charmSelectOpen && (
                        <div
                            className="suika-overlay"
                            data-testid="suika-charm-select"
                            role="dialog"
                            aria-modal="true"
                            aria-label="おまもりを ひとつ えらぶ"
                        >
                            <p className="suika-overlay__lead">
                                ひとつ もっていく
                            </p>
                            <div className="suika-charm-row">
                                {session.charmOffer.map((charmId, index) => {
                                    const charm = G0_SUIKA_CHARMS[charmId];
                                    return (
                                        <button
                                            key={charmId}
                                            type="button"
                                            className="suika-charm"
                                            autoFocus={index === 0}
                                            onClick={() => handlePickCharm(charmId)}
                                        >
                                            <span aria-hidden="true">{charm.glyph}</span>
                                            <strong>{charm.label}</strong>
                                            <small>{charm.detail}</small>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {run.status === "over" && !charmSelectOpen && (
                        <div
                            className="suika-overlay"
                            data-testid="suika-run-over"
                            role="dialog"
                            aria-modal="true"
                            aria-label="もういちど あそぶ"
                        >
                            <p className="suika-overlay__score">{run.score}</p>
                            <button
                                type="button"
                                className="suika-replay"
                                data-testid="suika-replay"
                                aria-label="もういちど"
                                autoFocus
                                onClick={handleReplay}
                            >
                                ↻
                            </button>
                        </div>
                    )}
                </div>

                <p
                    className="suika-visually-hidden"
                    role="status"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    {status}
                </p>

                {session.charms.length > 0 && (
                    <section className="suika-charm-shelf" aria-label="もっている おまもり">
                        {session.charms.map((charmId) => (
                            <span key={charmId} className="suika-charm-badge">
                                <b aria-hidden="true">{G0_SUIKA_CHARMS[charmId].glyph}</b>
                                {G0_SUIKA_CHARMS[charmId].label}
                            </span>
                        ))}
                    </section>
                )}
            </main>

            {!participantMode && (
                <details className="suika-metrics">
                    <summary>診断記録を見る</summary>
                    <p>
                        これは試験器が動く証拠であり、楽しさのPASSやproduction採用の証拠ではない。
                        判定は子どもの自発リプレイと発話で行う。
                    </p>
                    <p className="suika-metrics__hint">
                        いまの目標は <strong>{targetLabel}</strong>。
                        想定skill: <code>{profile.skillHint}</code>
                    </p>
                    <dl>
                        <div>
                            <dt>この run の {targetLabel} づくり</dt>
                            <dd data-testid="suika-target-pops">
                                {run.targetPopCount}回
                            </dd>
                        </div>
                        <div><dt>この run の 合体</dt><dd>{run.mergeCount}回</dd></div>
                        <div><dt>この run の 落下</dt><dd>{run.dropCount}回</dd></div>
                        <div>
                            <dt>この run で 出た式</dt>
                            <dd data-testid="suika-recipes">
                                {run.seenRecipes.length}種
                            </dd>
                        </div>
                        <div><dt>完走</dt><dd>{metrics.completedRuns}回</dd></div>
                        <div>
                            <dt>自発リプレイ</dt>
                            <dd data-testid="suika-replay-count">
                                {metrics.replayStarts}回
                            </dd>
                        </div>
                        <div>
                            <dt>数の種類の切替</dt>
                            <dd>{metrics.profileSwitches}回</dd>
                        </div>
                        <div><dt>最高スコア</dt><dd>{metrics.bestScore}</dd></div>
                        <div><dt>最長チェイン</dt><dd>{metrics.bestChain}</dd></div>
                        <div>
                            <dt>平均run時間</dt>
                            <dd>{formatDuration(metrics.averageDurationMs)}</dd>
                        </div>
                        <div>
                            <dt>平均落下数</dt>
                            <dd>{formatAverage(metrics.averageDropCount)}</dd>
                        </div>
                    </dl>
                </details>
            )}
        </div>
    );
};

export default NumberSuikaLab;
